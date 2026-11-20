/**
 * POST /api/chat { turns: [{role, content}], context } → { reply, foods }
 * AI nutrition coach. Requires a Premium pass when payments are configured.
 */
import Anthropic from '@anthropic-ai/sdk';
import { cleanTurns, coachStream, coachWithClient, type ChatImage } from '../src/lib/coach.js';
import { json } from './_lib/premium.js';
import { gate } from './_lib/quota.js';
import { cleanContext } from './_lib/context.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'The coach isn’t switched on yet.' }, 501);
  const body = (await request.json().catch(() => null)) as { turns?: unknown; context?: unknown; image?: { data?: unknown; mediaType?: unknown } } | null;
  const turns = cleanTurns(body?.turns);
  if (!turns) return json({ error: 'Invalid conversation.' }, 400);
  let image: ChatImage | undefined;
  if (body?.image) {
    const { data, mediaType } = body.image;
    if (typeof data !== 'string' || typeof mediaType !== 'string' || !IMAGE_TYPES.has(mediaType)) return json({ error: 'Unsupported image.' }, 415);
    if ((data.length * 3) / 4 > MAX_IMAGE_BYTES) return json({ error: 'Image too large (max 5 MB).' }, 413);
    image = { data, mediaType: mediaType as ChatImage['mediaType'] };
  }
  const coach = await gate(request, 'coach');
  if (!coach.ok) return json(coach.body, coach.status);
  // A photo in the chat also counts as one AI scan.
  if (image) {
    const scan = await gate(request, 'scan');
    if (!scan.ok) return json({ ...scan.body, error: `${scan.body.error} You can still chat without photos.` }, scan.status);
  }
  const pro = coach.tier === 'pro' || coach.tier === 'trial';
  const quota = { left: coach.left, limit: coach.limit, tier: coach.tier };
  // Streaming (?stream=1): newline-separated JSON — {"t": piece} while writing, then {"done": reply}.
  if (new URL(request.url).searchParams.get('stream') === '1') {
    const enc = new TextEncoder();
    const ctx = cleanContext(body?.context);
    const out = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
        let sentAny = false;
        try {
          let reply;
          try {
            reply = await coachStream(new Anthropic(), turns, ctx, image, { pro }, (t) => { sentAny = true; send({ t }); });
          } catch (e) {
            // Nothing shown yet: answer the normal way instead of failing.
            if (sentAny) throw e;
            reply = await coachWithClient(new Anthropic(), turns, ctx, image, { pro });
          }
          send({ done: { ...reply, quota } });
        } catch (e) {
          if (e instanceof Anthropic.APIError) console.error('[ai]', e.status, e.message);
          send({ error: e instanceof Anthropic.RateLimitError ? 'Busy, try again in a moment.' : e instanceof Anthropic.APIError ? `Coach service error (${e.status ?? 'network'}).` : (e as Error).message || 'Could not reply.' });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(out, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
  }
  try {
    return json({ ...(await coachWithClient(new Anthropic(), turns, cleanContext(body?.context), image, { pro })), quota });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) console.error('[ai]', e.status, e.message);
    if (e instanceof Anthropic.APIError) return json({ error: `Coach service error (${e.status ?? 'network'}).` }, 502);
    console.error('[chat]', (e as Error)?.message ?? e);
    return json({ error: (e as Error).message || 'Could not reply.' }, 500);
  }
}
