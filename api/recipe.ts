/**
 * POST /api/recipe { context, request } → Recipe
 * AI recipe; nutrition is calculated by the app from its database. Plus and Pro.
 */
import Anthropic from '@anthropic-ai/sdk';
import { contextText } from '../src/lib/coach.js';
import { recipeWithClient } from '../src/lib/recipe.js';
import { json } from './_lib/premium.js';
import { gate } from './_lib/quota.js';
import { cleanContext } from './_lib/context.js';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Recipes aren’t switched on yet.' }, 501);
  const g = await gate(request, 'recipe');
  if (!g.ok) return json(g.body, g.status);
  const body = (await request.json().catch(() => null)) as { context?: unknown; request?: unknown } | null;
  const ask = typeof body?.request === 'string' ? body.request.trim().slice(0, 300) : '';
  try {
    return json(await recipeWithClient(new Anthropic(), cleanContext(body?.context), ask, contextText));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Recipe service error (${e.status ?? 'network'}).` }, 502);
    return json({ error: (e as Error).message || 'Could not make a recipe.' }, 500);
  }
}
