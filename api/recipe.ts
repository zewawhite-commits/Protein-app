/**
 * POST /api/recipe { context, request } → Recipe
 * AI recipe; nutrition is calculated by the app from its database. Plus and Pro.
 */
import Anthropic from '@anthropic-ai/sdk';
import { contextText } from '../src/lib/coach.js';
import { recipeWithClient } from '../src/lib/recipe.js';
import { json } from './_lib/premium.js';
import { allergensInAll, avoidSet } from '../src/lib/allergens.js';
import { gate } from './_lib/quota.js';
import { cleanContext } from './_lib/context.js';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Recipes aren’t switched on yet.' }, 501);
  const g = await gate(request, 'recipe');
  if (!g.ok) return json(g.body, g.status);
  const body = (await request.json().catch(() => null)) as { context?: unknown; request?: unknown } | null;
  const ask = typeof body?.request === 'string' ? body.request.trim().slice(0, 300) : '';
  try {
    const context = cleanContext(body?.context);
    const avoid = avoidSet({ avoid: context.avoid });
    const found = (r: Awaited<ReturnType<typeof recipeWithClient>>) => allergensInAll([r.title, ...r.ingredients.map((i) => `${i.name} ${i.localName}`)], avoid);
    let r = await recipeWithClient(new Anthropic(), context, ask, contextText);
    // The prompt asks the AI to respect the avoid list; check it did, and try once more if not.
    if (found(r).length) r = await recipeWithClient(new Anthropic(), context, `${ask || ''}\nImportant: it must not contain ${found(r).join(', ').toLowerCase()} — I avoid them.`.trim(), contextText);
    return json({ ...r, allergens: found(r) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Recipe service error (${e.status ?? 'network'}).` }, 502);
    return json({ error: (e as Error).message || 'Could not make a recipe.' }, 500);
  }
}
