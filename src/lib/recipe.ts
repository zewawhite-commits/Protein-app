/**
 * AI recipes (shared by api/recipe.ts). Claude writes the recipe — ingredients with grams
 * and the method. It never states nutrition: the app matches every ingredient to a
 * database record and calculates calories, macros and micronutrients itself.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { CHAT_MODEL } from './coach.js';
import type { CoachContext } from './coach.js';

export interface RecipeIngredient { name: string; localName: string; searchQueries: string[]; grams: number; note: string }
export interface Recipe { title: string; cuisine: string; servings: number; minutes: number; ingredients: RecipeIngredient[]; steps: string[]; tip: string }

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, cuisine: { type: 'string' }, servings: { type: 'integer' }, minutes: { type: 'integer' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, localName: { type: 'string' }, searchQueries: { type: 'array', items: { type: 'string' } }, grams: { type: 'number' }, note: { type: 'string' } },
        required: ['name', 'localName', 'searchQueries', 'grams', 'note'],
        additionalProperties: false,
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    tip: { type: 'string' },
  },
  required: ['title', 'cuisine', 'servings', 'minutes', 'ingredients', 'steps', 'tip'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are a home cook and nutrition-savvy chef writing a recipe inside Nutivili AI, a nutrition-tracking app.

Write one real, tasty recipe for what the person asks (or, if they ask for nothing specific, something that fits their goals and the cuisines they enjoy):
- Any cuisine in the world; use authentic dish names and ingredients, with the local name where there is one.
- Respect their diet strictly and never use anything they avoid or are allergic to. Pregnancy: no raw/undercooked fish, meat or eggs, no unpasteurised dairy.
- Lean towards their goals (e.g. more protein for muscle, lighter for fat loss) without making the dish joyless.
- "ingredients": everything that goes in, each with "grams" = the weight as added for the WHOLE recipe (oil and spices too), "note" = prep like "diced" or "" , and "searchQueries" = 2–3 food-composition-style queries for the ingredient in the state it's weighed, most specific first (e.g. ["chicken thigh raw", "chicken thigh"]).
- "steps": clear numbered-style steps without the numbers, 4–10 of them. "minutes": total time. "tip": one short tip.
Do NOT state any nutrient values — the app calculates them from its food database.`;

export async function recipeWithClient(client: Anthropic, context: CoachContext, request: string, contextText: (c: CoachContext) => string): Promise<Recipe> {
  const response = await client.beta.messages.create({
    model: CHAT_MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    system: [
      { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: contextText(context) },
    ],
    messages: [{ role: 'user', content: request || 'Give me a recipe for today.' }],
  });
  if (response.stop_reason === 'refusal') throw new Error('No recipe available for that request.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No recipe returned.');
  return sanitizeRecipe(JSON.parse(text.text));
}

export function sanitizeRecipe(raw: unknown): Recipe {
  const r = (raw ?? {}) as Partial<Recipe>;
  const servings = Number.isFinite(r.servings) ? Math.min(12, Math.max(1, Math.round(r.servings!))) : 2;
  return {
    title: String(r.title ?? 'Recipe').slice(0, 80),
    cuisine: String(r.cuisine ?? '').slice(0, 40),
    servings,
    minutes: Number.isFinite(r.minutes) ? Math.min(600, Math.max(5, Math.round(r.minutes!))) : 30,
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).slice(0, 25).map((i) => ({
      name: String(i?.name ?? '').slice(0, 60),
      localName: String(i?.localName ?? '').slice(0, 60),
      searchQueries: (Array.isArray(i?.searchQueries) ? i.searchQueries : []).map((q) => String(q).slice(0, 60)).filter(Boolean).slice(0, 3),
      grams: Number.isFinite(i?.grams) && i.grams > 0 && i.grams <= 5000 ? Math.round(i.grams) : 0,
      note: String(i?.note ?? '').slice(0, 60),
    })).filter((i) => i.name && i.grams > 0),
    steps: (Array.isArray(r.steps) ? r.steps : []).map((s) => String(s).slice(0, 400)).filter(Boolean).slice(0, 12),
    // No nutrient numbers from the AI.
    tip: String(r.tip ?? '').replace(/\d+(\.\d+)?\s*(g|kcal|%)/gi, '').slice(0, 200),
  };
}

/**
 * The standard recipe behind a world dish ("per 1000 g cooked: 100 g Melon seed… [FAO 06_013]; 60 g Oil, palm…"),
 * so someone can start from it and change the oil, meat, fish or vegetables to how they cook.
 */
export function standardRecipe(sourceNote: string | undefined): { yieldGrams: number; items: { name: string; grams: number }[] } | null {
  const y = /per (\d+(?:\.\d+)?) g cooked:/.exec(sourceNote ?? '');
  if (!y) return null;
  const items = [...sourceNote!.slice(y.index + y[0].length).matchAll(/(\d+(?:\.\d+)?) g (.+?) \[(?:FAO|USDA)[^\]]*\]/g)].map((m) => ({ name: m[2].trim(), grams: Number(m[1]) }));
  return items.length ? { yieldGrams: Number(y[1]), items } : null;
}
