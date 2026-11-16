/**
 * Serverless endpoint for photo recognition (Vercel Functions, Web-standard handler).
 * Plan limits are enforced by api/_lib/quota.ts (sign-in required; Free/Plus/Pro monthly scans).
 * Keeps the Anthropic API key on the server: set ANTHROPIC_API_KEY in the Vercel
 * project's Environment Variables.
 *
 * POST /api/recognize  { image: <base64 JPEG/PNG/WebP>, mediaType: "image/jpeg" }
 *   → { isFood, items: [...], note }
 */
import Anthropic from '@anthropic-ai/sdk';
import { recognizeWithClient } from '../src/lib/recognition.js';
import { gate } from './_lib/quota.js';
import { popularPicks } from './_lib/popular.js';
import { readLabelWithClient } from '../src/lib/label.js';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: Request): Promise<Response> {
  let scansLeft: number | undefined;
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Recognition is not configured on this server.' }, 501);
  const g = await gate(request, 'scan');
  if (!g.ok) return json(g.body, g.status);
  if (Number.isFinite(g.left)) scansLeft = g.left;
  let body: { image?: string; mediaType?: string; text?: string; label?: boolean; menu?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
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
    const recognized = await recognizeWithClient(new Anthropic(), text ? null : image!, mediaType, text || undefined, { menu: body.menu === true && !text });
    // What most people chose for these names before, so the right record can go first.
    const popular = await popularPicks(recognized.items.flatMap((i) => [i.name, i.localName]));
    const result = { ...recognized, popular };
    return json(scansLeft != null ? { ...result, scansLeft, scanLimit: g.limit } : result, 200);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) console.error('[ai]', e.status, e.message);
    if (e instanceof Anthropic.APIError) return json({ error: `Recognition service error (${e.status ?? 'network'}).` }, 502);
    console.error('[recognize]', (e as Error)?.message ?? e);
    return json({ error: (e as Error).message || 'Recognition failed.' }, 500);
  }
}

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
