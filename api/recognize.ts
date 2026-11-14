/**
 * Serverless endpoint for photo recognition (Vercel Functions, Web-standard handler).
 * If Paystack payments are configured, callers must send a valid Premium pass
 * (Authorization: Bearer <pass>); otherwise the endpoint is open to the app.
 * Keeps the Anthropic API key on the server: set ANTHROPIC_API_KEY in the Vercel
 * project's Environment Variables.
 *
 * POST /api/recognize  { image: <base64 JPEG/PNG/WebP>, mediaType: "image/jpeg" }
 *   → { isFood, items: [...], note }
 */
import Anthropic from '@anthropic-ai/sdk';
import { recognizeWithClient } from '../src/lib/recognition';
import { bearer, paymentsEnabled, readPass, scanLimit } from './_lib/premium';
import { useScan } from './_lib/accounts';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: Request): Promise<Response> {
  let scansLeft: number | undefined;
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Recognition is not configured on this server.' }, 501);
  // When payments are set up, the server's AI key is a Premium feature.
  if (paymentsEnabled()) {
    const pass = readPass(bearer(request));
    if (!pass) return json({ error: 'Photo recognition is a Premium feature.', premium: true }, 402);
    if (pass.exp < Date.now()) return json({ error: 'Your Premium pass needs renewing.', premium: true, renew: true }, 402);
    const limit = scanLimit(pass.tier ?? 'plus');
    try {
      const left = await useScan(pass.uid ?? `cus_${pass.cid}`, limit);
      if (left < 0) return json({ error: `You’ve used all ${limit} photo scans this month.${pass.tier === 'pro' ? '' : ' Upgrade to Pro for more.'}`, limitReached: true, tier: pass.tier }, 429);
      scansLeft = left;
    } catch (e) {
      return json({ error: (e as Error).message }, 503);
    }
  }
  let body: { image?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const { image, mediaType = 'image/jpeg' } = body;
  if (!image || typeof image !== 'string') return json({ error: 'Missing image.' }, 400);
  if (!TYPES.has(mediaType)) return json({ error: 'Unsupported image type.' }, 415);
  if ((image.length * 3) / 4 > MAX_BYTES) return json({ error: 'Image too large (max 5 MB).' }, 413);

  try {
    const result = await recognizeWithClient(new Anthropic(), image, mediaType);
    return json(Number.isFinite(scansLeft) ? { ...result, scansLeft } : result, 200);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Recognition service error (${e.status ?? 'network'}).` }, 502);
    return json({ error: (e as Error).message || 'Recognition failed.' }, 500);
  }
}

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
