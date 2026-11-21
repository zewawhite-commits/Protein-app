/**
 * POST /api/plan { context, request? } → DayPlan
 * AI eating plan for one day. Requires a Premium pass when payments are configured.
 */
export const maxDuration = 60;
import { busyMessage, logAiError } from './_lib/aiErrors.js';
import Anthropic from '@anthropic-ai/sdk';
import { contextText } from '../src/lib/coach.js';
import { planWithClient } from '../src/lib/plan.js';
import { json } from './_lib/premium.js';
import { allergensInAll, avoidSet } from '../src/lib/allergens.js';
import { gate } from './_lib/quota.js';
import { cleanContext } from './_lib/context.js';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Plans aren’t switched on yet.' }, 501);
  const g = await gate(request, 'plan');
  if (!g.ok) return json(g.body, g.status);
  const body = (await request.json().catch(() => null)) as { context?: unknown; request?: unknown } | null;
  const ask = typeof body?.request === 'string' ? body.request.trim().slice(0, 500) : '';
  try {
    const context = cleanContext(body?.context);
    const avoid = avoidSet({ avoid: context.avoid });
    const found = (r: Awaited<ReturnType<typeof planWithClient>>) => allergensInAll([...r.meals.flatMap((m) => [m.title, ...m.items.map((i) => `${i.name} ${i.localName}`)])], avoid);
    let r = await planWithClient(new Anthropic({ maxRetries: 3 }), context, ask, contextText);
    // The prompt asks the AI to respect the avoid list; check it did, and try once more if not.
    if (found(r).length) r = await planWithClient(new Anthropic({ maxRetries: 3 }), context, `${ask || ''}\nImportant: it must not contain ${found(r).join(', ').toLowerCase()} — I avoid them.`.trim(), contextText);
    return json({ ...r, allergens: found(r) });
  } catch (e) {
    await logAiError('plan', e);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) console.error('[ai]', e.status, e.message);
    if (e instanceof Anthropic.APIError) return json({ error: busyMessage(e) }, 502);
    console.error('[plan]', (e as Error)?.message ?? e);
    return json({ error: (e as Error).message || 'Could not make a plan.' }, 500);
  }
}
