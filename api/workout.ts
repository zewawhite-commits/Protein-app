/**
 * POST /api/workout { context, request } → WorkoutPlan
 * AI workout guide for the week. Pro.
 */
export const maxDuration = 60;
import Anthropic from '@anthropic-ai/sdk';
import { contextText } from '../src/lib/coach.js';
import { cleanWorkoutRequest, workoutWithClient } from '../src/lib/workout.js';
import { json } from './_lib/premium.js';
import { gate } from './_lib/quota.js';
import { cleanContext } from './_lib/context.js';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Workout guides aren’t switched on yet.' }, 501);
  const g = await gate(request, 'workout');
  if (!g.ok) return json(g.body, g.status);
  const body = (await request.json().catch(() => null)) as { context?: unknown; request?: unknown } | null;
  try {
    return json(await workoutWithClient(new Anthropic(), cleanContext(body?.context), cleanWorkoutRequest(body?.request), contextText));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) console.error('[ai]', e.status, e.message);
    if (e instanceof Anthropic.APIError) return json({ error: `Workout service error (${e.status ?? 'network'}).` }, 502);
    console.error('[workout]', (e as Error)?.message ?? e);
    return json({ error: (e as Error).message || 'Could not make a workout guide.' }, 500);
  }
}
