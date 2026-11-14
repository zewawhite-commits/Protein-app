/**
 * POST /api/chat { turns: [{role, content}], context } → { reply, foods }
 * AI nutrition coach. Requires a Premium pass when payments are configured.
 */
import Anthropic from '@anthropic-ai/sdk';
import { cleanTurns, coachWithClient, type CoachContext } from '../src/lib/coach';
import { bearer, json, paymentsEnabled, readPass } from './_lib/premium';

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
  if (paymentsEnabled()) {
    const pass = readPass(bearer(request));
    if (!pass || pass.exp < Date.now()) return json({ error: 'The AI coach is a Plus and Pro feature.', premium: true }, 402);
  }
  const body = (await request.json().catch(() => null)) as { turns?: unknown; context?: unknown } | null;
  const turns = cleanTurns(body?.turns);
  if (!turns) return json({ error: 'Invalid conversation.' }, 400);
  try {
    return json(await coachWithClient(new Anthropic(), turns, cleanContext(body?.context)));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Coach service error (${e.status ?? 'network'}).` }, 502);
    return json({ error: (e as Error).message || 'Could not reply.' }, 500);
  }
}
