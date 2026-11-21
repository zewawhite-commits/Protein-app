/**
 * POST /api/recipe { context, request } → Recipe
 * AI recipe; nutrition is calculated by the app from its database. Plus.
 */
export const maxDuration = 60;
import { busyMessage, logAiError } from './_lib/aiErrors.js';
import Anthropic from '@anthropic-ai/sdk';
import { contextText } from '../src/lib/coach.js';
import { recipeWithClient } from '../src/lib/recipe.js';
import { importRecipeWithClient, pageText, safeRecipeUrl } from '../src/lib/recipeImport.js';
import { json } from './_lib/premium.js';
import { allergensInAll, avoidSet } from '../src/lib/allergens.js';
import { gate } from './_lib/quota.js';
import { cleanContext } from './_lib/context.js';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Recipes aren’t switched on yet.' }, 501);
  const body = (await request.json().catch(() => null)) as { context?: unknown; request?: unknown; import?: { text?: unknown; url?: unknown; image?: { data?: unknown; mediaType?: unknown } } } | null;
  // Importing a recipe (pasted text, a link or a photo) is part of Plus, like AI recipes.
  if (body?.import) return importRecipe(request, body.import);
  const g = await gate(request, 'recipe');
  if (!g.ok) return json(g.body, g.status);
  const ask = typeof body?.request === 'string' ? body.request.trim().slice(0, 300) : '';
  try {
    const context = cleanContext(body?.context);
    const avoid = avoidSet({ avoid: context.avoid });
    const found = (r: Awaited<ReturnType<typeof recipeWithClient>>) => allergensInAll([r.title, ...r.ingredients.map((i) => `${i.name} ${i.localName}`)], avoid);
    let r = await recipeWithClient(new Anthropic({ maxRetries: 3 }), context, ask, contextText);
    // The prompt asks the AI to respect the avoid list; check it did, and try once more if not.
    if (found(r).length) r = await recipeWithClient(new Anthropic({ maxRetries: 3 }), context, `${ask || ''}\nImportant: it must not contain ${found(r).join(', ').toLowerCase()} — I avoid them.`.trim(), contextText);
    return json({ ...r, allergens: found(r) });
  } catch (e) {
    await logAiError('recipe', e);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy — try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) console.error('[ai]', e.status, e.message);
    if (e instanceof Anthropic.APIError) return json({ error: busyMessage(e) }, 502);
    console.error('[recipe]', (e as Error)?.message ?? e);
    return json({ error: (e as Error).message || 'Could not make a recipe.' }, 500);
  }
}

async function importRecipe(request: Request, input: { text?: unknown; url?: unknown; image?: { data?: unknown; mediaType?: unknown } }): Promise<Response> {
  const g = await gate(request, 'recipe'); // Recipe import is a Plus feature.
  if (!g.ok) return json(g.body, g.status);
  try {
    let text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text && typeof input.url === 'string') {
      const url = safeRecipeUrl(input.url);
      if (!url) return json({ error: 'That link doesn’t look right. Use a normal https:// recipe page.' }, 400);
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; RecipeReader/1.0)', accept: 'text/html' } }).finally(() => clearTimeout(t));
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return json({ error: 'Couldn’t open that page. Copy the recipe text and paste it instead.' }, 422);
      if (!safeRecipeUrl(res.url)) return json({ error: 'That page redirected somewhere we can’t open.' }, 422);
      text = pageText((await res.text()).slice(0, 2_000_000));
    }
    const img = input.image;
    const image = img && typeof img.data === 'string' && ['image/jpeg', 'image/png', 'image/webp'].includes(String(img.mediaType)) && img.data.length < 7_000_000
      ? { data: img.data, mediaType: img.mediaType as 'image/jpeg' } : undefined;
    if (!text && !image) return json({ error: 'Paste a recipe, add a link or a photo.' }, 400);
    return json(await importRecipeWithClient(new Anthropic({ maxRetries: 3 }), { text, image }));
  } catch (e) {
    await logAiError('recipe', e);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy, try again in a moment.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: busyMessage(e) }, 502);
    if ((e as Error).name === 'AbortError') return json({ error: 'That page took too long. Paste the recipe text instead.' }, 504);
    return json({ error: (e as Error).message || 'Couldn’t read that recipe.' }, 500);
  }
}
