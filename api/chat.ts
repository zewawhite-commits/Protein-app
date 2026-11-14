/**
 * POST /api/chat { turns: [{role, content}], context } → { reply, foods }
 * AI nutrition coach. Requires a Premium pass when payments are configured.
 */
import Anthropic from '@anthropic-ai/sdk';
import { cleanTurns, coachWithClient, type ChatImage, type CoachContext } from '../src/lib/coach';
import { bearer, json, paymentsEnabled, readPass, scanLimit } from './_lib/premium';
import { useScan } from './_lib/accounts';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined);
const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined);

function cleanContext(raw: unknown): CoachContext {
  const c = (raw ?? {}) as Record<string, any>;
  const nums = (o: any, keys: string[], max: number) => Object.fromEntries(keys.map((k) => [k, num(o?.[k], max)]));
  return {
    name: str(c.name, 40),
    goals: Array.isArray(c.goals) ? c.goals.map((g: unknown) => String(g).slice(0, 20)).slice(0, 5) : undefined,
    activity: str(c.activity, 20),
    diet: str(c.diet, 20),
    country: str(c.country, 60),
    cuisines: Array.isArray(c.cuisines) ? c.cuisines.map((g: unknown) => String(g).slice(0, 30)).slice(0, 26) : undefined,
    avoid: Array.isArray(c.avoid) ? c.avoid.map((g: unknown) => String(g).slice(0, 30)).slice(0, 20) : undefined,
    age: num(c.age, 120),
    sex: str(c.sex, 15),
    pregnant: c.pregnant === true,
    targets: nums(c.targets, ['kcal', 'protein', 'carbs', 'fat', 'fiber'], 20000),
    today: nums(c.today, ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodiumMg'], 50000),
    eatenToday: Array.isArray(c.eatenToday) ? c.eatenToday.map((s: unknown) => String(s).slice(0, 60)).slice(0, 20) : [],
    localTime: str(c.localTime, 40),
  };
}

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
  if (paymentsEnabled()) {
    const pass = readPass(bearer(request));
    if (!pass || pass.exp < Date.now()) return json({ error: 'The AI coach is a Plus and Pro feature.', premium: true }, 402);
    // A photo in the chat counts as one photo scan, like the camera.
    if (image) {
      const limit = scanLimit(pass.tier ?? 'plus');
      try {
        if ((await useScan(pass.uid ?? `cus_${pass.cid}`, limit)) < 0) return json({ error: `You’ve used all ${limit} photo scans this month. You can still chat without photos.`, limitReached: true }, 429);
      } catch (e) {
        return json({ error: (e as Error).message }, 503);
      }
    }
  }
  try {
    return json(await coachWithClient(new Anthropic(), turns, cleanContext(body?.context), image));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Coach service error (${e.status ?? 'network'}).` }, 502);
    return json({ error: (e as Error).message || 'Could not reply.' }, 500);
  }
}
