/**
 * POST /api/recommend { country?, diet?, remainingGrams, eatenToday? } → { ideas: [...] }
 * AI meal ideas (food names only). Requires a Premium pass when payments are configured.
 */
import Anthropic from '@anthropic-ai/sdk';
import { ideasWithClient, type IdeaRequest } from '../src/lib/recommendation';
import { bearer, json, paymentsEnabled, readPass } from './_lib/premium';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Suggestions are not configured on this server.' }, 501);
  if (paymentsEnabled()) {
    const pass = readPass(bearer(request));
    if (!pass || pass.exp < Date.now()) return json({ error: 'AI meal ideas are a Plus and Pro feature.', premium: true }, 402);
  }
  const body = (await request.json().catch(() => null)) as IdeaRequest | null;
  if (!body || typeof body.remainingGrams !== 'number' || body.remainingGrams < 0 || body.remainingGrams > 1000) {
    return json({ error: 'Invalid request.' }, 400);
  }
  const req: IdeaRequest = {
    country: typeof body.country === 'string' ? body.country.slice(0, 60) : undefined,
    diet: typeof body.diet === 'string' ? body.diet.slice(0, 30) : undefined,
    remainingGrams: body.remainingGrams,
    eatenToday: Array.isArray(body.eatenToday) ? body.eatenToday.map((s) => String(s).slice(0, 60)).slice(0, 15) : [],
  };
  try {
    return json({ ideas: await ideasWithClient(new Anthropic(), req) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Suggestion service error (${e.status ?? 'network'}).` }, 502);
    return json({ error: (e as Error).message || 'Could not get suggestions.' }, 500);
  }
}
