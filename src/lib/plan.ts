/**
 * AI eating plan for one day (shared by api/plan.ts). Claude chooses foods and rough
 * portions for the person's goals and tastes; the app matches every item to a database
 * record and calculates all nutrition itself. Portions are suggestions, never logged
 * automatically.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { RECOGNITION_MODEL } from './recognition';
import type { CoachContext } from './coach';

export interface PlanItem { name: string; localName: string; searchQueries: string[]; grams: number }
export interface PlanMeal { meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'; title: string; items: PlanItem[] }
export interface DayPlan { title: string; meals: PlanMeal[]; tips: string[] }

const ITEM = {
  type: 'object',
  properties: {
    name: { type: 'string' }, localName: { type: 'string' },
    searchQueries: { type: 'array', items: { type: 'string' } }, grams: { type: 'number' },
  },
  required: ['name', 'localName', 'searchQueries', 'grams'],
  additionalProperties: false,
} as const;

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          meal: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          title: { type: 'string' },
          items: { type: 'array', items: ITEM },
        },
        required: ['meal', 'title', 'items'],
        additionalProperties: false,
      },
    },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'meals', 'tips'],
  additionalProperties: false,
} as const;

const SYSTEM = `You plan one day of eating inside Provora, a nutrition-tracking app.

Make a realistic, enjoyable day (breakfast, lunch, dinner and 1–2 snacks) for this person:
- Aim for their calorie and protein targets and their goals; spread protein across meals.
- Mix cuisines: foods available in their country plus the cuisines they enjoy. Vary it; don't default to one region unless asked.
- Respect their diet strictly and never include anything they avoid or are allergic to (check ingredients of dishes).
- Use everyday, affordable foods and simple dishes; nothing extreme. Never plan below about 1,200 kcal. Pregnancy: avoid raw/undercooked fish, meat or eggs, unpasteurised dairy and high-mercury fish.

For each item: "name" (English), "localName" (or ""), "searchQueries" (2–3 food-composition-style queries naming the main ingredient and its form, most specific first, e.g. ["jollof rice", "rice white cooked"]), and "grams" = the edible weight as eaten for a sensible portion.
Do NOT state any nutrient values — the app calculates them from its database.
"title": a short, friendly name for the day. "tips": 2–3 short practical tips (no numbers about nutrients).`;

export async function planWithClient(client: Anthropic, context: CoachContext, request: string, contextText: (c: CoachContext) => string): Promise<DayPlan> {
  const response = await client.beta.messages.create({
    model: RECOGNITION_MODEL,
    max_tokens: 12000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    system: [
      { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: contextText(context) },
    ],
    messages: [{ role: 'user', content: request || 'Plan my day.' }],
  });
  if (response.stop_reason === 'refusal') throw new Error('No plan available for that request.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No plan returned.');
  return sanitizePlan(JSON.parse(text.text));
}

const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
export function sanitizePlan(raw: unknown): DayPlan {
  const r = (raw ?? {}) as Partial<DayPlan>;
  const meals = (Array.isArray(r.meals) ? r.meals : []).filter((m) => MEALS.has(m?.meal)).slice(0, 6).map((m) => ({
    meal: m.meal,
    title: String(m.title ?? '').slice(0, 80),
    items: (Array.isArray(m.items) ? m.items : []).slice(0, 6).map((i) => ({
      name: String(i?.name ?? '').slice(0, 60),
      localName: String(i?.localName ?? '').slice(0, 60),
      searchQueries: (Array.isArray(i?.searchQueries) ? i.searchQueries : []).map((q) => String(q).slice(0, 60)).filter(Boolean).slice(0, 3),
      grams: Number.isFinite(i?.grams) && i.grams > 0 && i.grams <= 1500 ? Math.round(i.grams) : 100,
    })).filter((i) => i.name),
  })).filter((m) => m.items.length);
  return {
    title: String(r.title ?? 'Your day').slice(0, 80),
    meals,
    tips: (Array.isArray(r.tips) ? r.tips : []).map((t) => String(t).replace(/\d+(\.\d+)?\s*(g|kcal|%)/gi, '').slice(0, 160)).slice(0, 3),
  };
}
