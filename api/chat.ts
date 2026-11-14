/**
 * POST /api/chat { turns: [{role, content}], context } → { reply, foods }
 * AI nutrition coach. Requires a Premium pass when payments are configured.
 */
import Anthropic from '@anthropic-ai/sdk';
import { cleanTurns, coachWithClient, type ChatImage } from '../src/lib/coach';
import { json } from './_lib/premium';
import { gate } from './_lib/quota';
import { cleanContext } from './_lib/context';

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
  try {
    return json({ ...(await coachWithClient(new Anthropic(), turns, cleanContext(body?.context), image)), quota: { left: coach.left, limit: coach.limit, tier: coach.tier } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Coach service error (${e.status ?? 'network'}).` }, 502);
    return json({ error: (e as Error).message || 'Could not reply.' }, 500);
  }
}
