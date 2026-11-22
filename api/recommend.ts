import { busyMessage } from './_lib/aiErrors.js';
/**
 * POST /api/recommend { country?, diet?, remainingGrams, eatenToday? } → { ideas: [...] }
 * AI meal ideas (food names only). Requires a Premium pass when payments are configured.
 */
import Anthropic from '@anthropic-ai/sdk';
import { aiClient, refundOnError } from './_lib/metering.js';
import { ideasWithClient, type IdeaRequest } from '../src/lib/recommendation.js';
import { json } from './_lib/premium.js';
import { gate } from './_lib/quota.js';
import { allergensIn, avoidSet } from '../src/lib/allergens.js';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Suggestions are not configured on this server.' }, 501);
  const g = await gate(request, 'ideas');
  if (!g.ok) return json(g.body, g.status);
  const body = (await request.json().catch(() => null)) as IdeaRequest | null;
  if (!body || typeof body.remainingGrams !== 'number' || body.remainingGrams < 0 || body.remainingGrams > 1000) {
    return refundOnError(g, json({ error: 'Invalid request.' }, 400));
  }
  const req: IdeaRequest = {
    country: typeof body.country === 'string' ? body.country.slice(0, 60) : undefined,
    diet: typeof body.diet === 'string' ? body.diet.slice(0, 30) : undefined,
    remainingGrams: body.remainingGrams,
    goals: Array.isArray(body.goals) ? body.goals.map((g) => String(g).slice(0, 20)).slice(0, 5) : undefined,
    activity: typeof body.activity === 'string' ? body.activity.slice(0, 20) : undefined,
    age: typeof body.age === 'number' && body.age >= 13 && body.age <= 110 ? Math.round(body.age) : undefined,
    sex: typeof body.sex === 'string' ? body.sex.slice(0, 15) : undefined,
    pregnant: body.pregnant === true,
    cuisines: Array.isArray(body.cuisines) ? body.cuisines.map((g) => String(g).slice(0, 30)).slice(0, 26) : undefined,
    avoid: Array.isArray(body.avoid) ? body.avoid.map((g) => String(g).slice(0, 30)).slice(0, 20) : undefined,
    eatenToday: Array.isArray(body.eatenToday) ? body.eatenToday.map((s) => String(s).slice(0, 60)).slice(0, 15) : [],
    remainingKcal: typeof body.remainingKcal === 'number' && Math.abs(body.remainingKcal) < 10000 ? Math.round(body.remainingKcal) : undefined,
    recent: Array.isArray(body.recent) ? body.recent.map((s) => String(s).slice(0, 60)).slice(0, 25) : undefined,
    meal: (['breakfast', 'lunch', 'dinner', 'snack'] as const).includes(body.meal as 'snack') ? body.meal : undefined,
    maxMinutes: typeof body.maxMinutes === 'number' && body.maxMinutes > 0 && body.maxMinutes <= 240 ? Math.round(body.maxMinutes) : undefined,
    budget: body.budget === 'low' ? 'low' : 'any',
    onHand: typeof body.onHand === 'string' ? body.onHand.slice(0, 200) : undefined,
  };
  try {
    // The prompt asks the AI to respect the avoid list; this checks it did.
    const avoid = avoidSet({ avoid: req.avoid });
    const ideas = (await ideasWithClient(aiClient('ideas', g.who), req))
      .filter((i) => !allergensIn(`${i.name} ${i.localName}`, avoid).length)
      .map((i) => (allergensIn(i.swap, avoid).length ? { ...i, swap: '' } : i));
    return json({ ideas });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return refundOnError(g, json({ error: 'Busy — try again in a moment.' }, 429));
    if (e instanceof Anthropic.APIError) console.error('[ai]', e.status, e.message);
    if (e instanceof Anthropic.APIError) return refundOnError(g, json({ error: busyMessage(e) }, 502));
    console.error('[recommend]', (e as Error)?.message ?? e);
    return refundOnError(g, json({ error: (e as Error).message || 'Could not get suggestions.' }, 500));
  }
}
