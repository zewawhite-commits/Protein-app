/**
 * POST /api/plan { context, request? } → DayPlan
 * AI eating plan for one day. Requires a Premium pass when payments are configured.
 */
import Anthropic from '@anthropic-ai/sdk';
import { contextText } from '../src/lib/coach';
import { planWithClient } from '../src/lib/plan';
import { bearer, json, paymentsEnabled, readPass } from './_lib/premium';
import { cleanContext } from './_lib/context';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Plans aren’t switched on yet.' }, 501);
  if (paymentsEnabled()) {
    const pass = readPass(bearer(request));
    if (!pass || pass.exp < Date.now()) return json({ error: 'AI eating plans are a Plus and Pro feature.', premium: true }, 402);
  }
  const body = (await request.json().catch(() => null)) as { context?: unknown; request?: unknown } | null;
  const ask = typeof body?.request === 'string' ? body.request.trim().slice(0, 500) : '';
  try {
    return json(await planWithClient(new Anthropic(), cleanContext(body?.context), ask, contextText));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Plan service error (${e.status ?? 'network'}).` }, 502);
    return json({ error: (e as Error).message || 'Could not make a plan.' }, 500);
  }
}
