/**
 * Serverless endpoint for photo recognition (Vercel Functions, Web-standard handler).
 * Keeps the Anthropic API key on the server: set ANTHROPIC_API_KEY in the Vercel
 * project's Environment Variables.
 *
 * POST /api/recognize  { image: <base64 JPEG/PNG/WebP>, mediaType: "image/jpeg" }
 *   → { isFood, items: [...], note }
 */
import Anthropic from '@anthropic-ai/sdk';
import { recognizeWithClient } from '../src/lib/recognition';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Recognition is not configured on this server.' }, 501);
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
    return json(result, 200);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Recognition service error (${e.status ?? 'network'}).` }, 502);
    return json({ error: (e as Error).message || 'Recognition failed.' }, 500);
  }
}

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
