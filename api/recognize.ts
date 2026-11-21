/**
 * Serverless endpoint for photo recognition (Vercel Functions, Web-standard handler).
 * Plan limits are enforced by api/_lib/quota.ts (sign-in required; Free daily / Plus limits).
 * Keeps the Anthropic API key on the server: set ANTHROPIC_API_KEY in the Vercel
 * project's Environment Variables.
 *
 * POST /api/recognize  { image: <base64 JPEG/PNG/WebP>, mediaType: "image/jpeg" }
 *   → { isFood, items: [...], note }
 */
export const maxDuration = 60;
import { logAiError } from './_lib/aiErrors.js';
import Anthropic from '@anthropic-ai/sdk';
import { recognizeWithClient } from '../src/lib/recognition.js';
import { gate } from './_lib/quota.js';
import { pageText, safeRecipeUrl } from '../src/lib/recipeImport.js';
import { popularPicks } from './_lib/popular.js';
import { readLabelWithClient } from '../src/lib/label.js';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: Request): Promise<Response> {
  let scansLeft: number | undefined;
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Recognition is not configured on this server.' }, 501);
  let body: { image?: string; mediaType?: string; text?: string; label?: boolean; menu?: boolean; menuUrl?: string; leftovers?: unknown } | null;
  body = (await request.json().catch(() => null)) as typeof body;
  if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body.' }, 400);
  // Restaurant menus are a Plus feature with their own allowance; plate and label photos are AI scans.
  const g = await gate(request, (body.menu === true && !body.text) || typeof body.menuUrl === 'string' ? 'menu' : 'scan');
  if (!g.ok) return json(g.body, g.status);
  if (Number.isFinite(g.left)) scansLeft = g.left;
  // A menu behind a QR code or link: read the page, then list its dishes like a menu photo.
  if (typeof body.menuUrl === 'string') {
    const url = safeRecipeUrl(body.menuUrl);
    if (!url) return json({ error: 'That QR code or link doesn’t open a normal web page.' }, 400);
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; MenuReader/1.0)', accept: 'text/html,application/pdf,image/*' } }).finally(() => clearTimeout(t));
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !safeRecipeUrl(res.url)) return json({ error: 'Couldn’t open that menu. Take a photo of it instead.' }, 422);
      // Menus that open as a PDF or a picture are read directly.
      const fileType = type.includes('pdf') ? 'application/pdf' : (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].find((t) => type.includes(t)) ?? '');
      if (fileType) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > (fileType === 'application/pdf' ? 15 : 5) * 1024 * 1024) return json({ error: 'That menu file is too big to read. Take a photo of the page you want instead.' }, 413);
        const recognized = await recognizeWithClient(new Anthropic(), buf.toString('base64'), fileType, undefined, { menu: true });
        return json(scansLeft != null ? { ...recognized, popular: {}, scansLeft, scanLimit: g.limit } : { ...recognized, popular: {} }, 200);
      }
      if (!type.includes('html')) return json({ error: 'Couldn’t read that kind of menu. Take a photo of it instead.' }, 422);
      const text = pageText((await res.text()).slice(0, 2_000_000));
      if (text.length < 40) return json({ error: 'That page has no readable menu (it may load with an app). Take a photo of the menu instead.' }, 422);
      const recognized = await recognizeWithClient(new Anthropic(), null, 'text/plain', text, { menu: true });
      return json(scansLeft != null ? { ...recognized, popular: {}, scansLeft, scanLimit: g.limit } : { ...recognized, popular: {} }, 200);
    } catch (e) {
    await logAiError('recognize', e);
      if ((e as Error).name === 'AbortError') return json({ error: 'That menu took too long to open. Take a photo of it instead.' }, 504);
      if (e instanceof Anthropic.APIError) return json({ error: `Recognition service error (${e.status ?? 'network'}).` }, 502);
      return json({ error: (e as Error).message || 'Couldn’t read that menu.' }, 500);
    }
  }
  const { image, mediaType = 'image/jpeg' } = body;
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 500) : '';
  if (!text) {
    if (!image || typeof image !== 'string') return json({ error: 'Missing image.' }, 400);
    if (!TYPES.has(mediaType)) return json({ error: 'Unsupported image type.' }, 415);
    if ((image.length * 3) / 4 > MAX_BYTES) return json({ error: 'Image too large (max 5 MB).' }, 413);
  }

  try {
    if (body.label === true && !text) {
      const label = await readLabelWithClient(new Anthropic(), image!, mediaType);
      return json(scansLeft != null ? { ...label, scansLeft, scanLimit: g.limit } : label, 200);
    }
    const recognized = await recognizeWithClient(new Anthropic(), text ? null : image!, mediaType, text || undefined, { menu: body.menu === true && !text, leftovers: !text && Array.isArray(body.leftovers) ? body.leftovers.slice(0, 14).map((x) => String(x).slice(0, 100)) : undefined });
    // What most people chose for these names before, so the right record can go first.
    // Never let this optional lookup slow the answer down.
    const popular = await Promise.race([popularPicks(recognized.items.flatMap((i) => [i.name, i.localName])), new Promise<Record<string, string>>((r) => setTimeout(() => r({}), 700))]);
    const result = { ...recognized, popular };
    return json(scansLeft != null ? { ...result, scansLeft, scanLimit: g.limit } : result, 200);
  } catch (e) {
    await logAiError('recognize', e);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) console.error('[ai]', e.status, e.message);
    if (e instanceof Anthropic.APIError) return json({ error: `Recognition service error (${e.status ?? 'network'}).` }, 502);
    console.error('[recognize]', (e as Error)?.message ?? e);
    return json({ error: (e as Error).message || 'Recognition failed.' }, 500);
  }
}

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
