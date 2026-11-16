/**
 * AI meal ideas (shared by api/recommend.ts). Claude suggests *food names* people
 * actually eat in the user's country that would help close today's protein gap.
 * It never supplies nutrient values: the app matches each idea to a database record
 * and calculates protein and grams itself.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { RECOGNITION_MODEL } from './recognition.js';

export interface IdeaRequest {
  country?: string;
  diet?: string;
  goals?: string[];
  activity?: string;
  age?: number;
  sex?: string;
  pregnant?: boolean;
  cuisines?: string[];
  avoid?: string[];
  remainingGrams: number;
  /** Calories left today (may be negative), when the person has a calorie goal. */
  remainingKcal?: number;
  /** Foods already eaten today, to avoid repeats. */
  eatenToday?: string[];
  /** Foods eaten in the past week, and ideas already shown, so suggestions vary. */
  recent?: string[];
  /** Which meal this is for. */
  meal?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  /** Most minutes they want to spend making it. */
  maxMinutes?: number;
  budget?: 'low' | 'any';
  /** Ingredients they have at home, free text. */
  onHand?: string;
}

export interface Idea {
  name: string;
  localName: string;
  why: string;
  searchQueries: string[];
  /** Rough time to make it, in minutes (0 = ready to eat). */
  minutes: number;
  /** A similar alternative if this one isn't available. */
  swap: string;
}

const SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          localName: { type: 'string' },
          why: { type: 'string' },
          searchQueries: { type: 'array', items: { type: 'string' } },
          minutes: { type: 'integer' },
          swap: { type: 'string' },
        },
        required: ['name', 'localName', 'why', 'searchQueries', 'minutes', 'swap'],
        additionalProperties: false,
      },
    },
  },
  required: ['ideas'],
  additionalProperties: false,
} as const;

const SYSTEM = `You suggest what someone could eat next: everyday foods and simple meals that fit what's left of their day — mainly their protein goal, without going far past their calories.

Tailor suggestions to the person: their goals (e.g. building muscle → protein-dense meals around training; losing fat → lean, filling, lower-energy options; older adults → easy-to-eat protein spread across meals), activity level, and age. If they are pregnant or breastfeeding, avoid foods commonly advised against in pregnancy (e.g. raw or undercooked fish, meat or eggs, unpasteurised dairy, high-mercury fish).

Suggest 5 foods or simple dishes, mixing foods commonly eaten in the user's country with the cuisines they enjoy (vary them; affordable, familiar options; include at least one quick snack). Respect the diet strictly and never include anything they avoid or are allergic to. Avoid repeating foods already eaten today.

For each idea:
- "name": short English name.
- "localName": the local name if there is one, else "".
- "why": one short, friendly sentence (max 15 words) on why it fits them now (protein, calories left, time, what they have). Do NOT state any numbers (no grams, calories or percentages).
- "minutes": rough time to prepare (0 if ready to eat). Stay within their time limit if they give one.
- "swap": one similar alternative in a few words, in case this isn't available (same diet and avoid rules).
Fit the meal they're planning (breakfast, lunch, dinner or a snack). If calories left are low or below zero, suggest lighter, lean options; if many calories are left, fuller meals are fine. If they say what they have at home, build ideas around those ingredients first. If their budget is low, choose affordable staples (beans, eggs, lentils, sardines, local grains) over expensive cuts. Don't repeat foods they've eaten in the past week or ideas already shown, unless they're staples with no good alternative.
- "searchQueries": 2–3 short queries phrased like food-composition database entries, most specific first, then generic (e.g. ["moi moi", "cowpeas cooked", "beans cooked"]).

Never give nutrient values. Never give medical advice.`;

export async function ideasWithClient(client: Anthropic, req: IdeaRequest): Promise<Idea[]> {
  const user = [
    `Country: ${req.country || 'not specified (suggest widely available foods)'}`,
    `Diet: ${req.diet || 'eats everything'}`,
    `Cuisines they enjoy: ${req.cuisines?.length ? req.cuisines.join(', ') : 'not given (mix several)'}`,
    `Avoid (allergies/preferences): ${req.avoid?.length ? req.avoid.join(', ') : 'none'}`,
    `Goals: ${req.goals?.length ? req.goals.join(', ') : 'general health'}`,
    `Activity: ${req.activity || 'not specified'}`,
    `Age: ${req.age ?? 'not specified'}${req.sex && req.sex !== 'unspecified' ? `, ${req.sex}` : ''}${req.pregnant ? ', pregnant or breastfeeding' : ''}`,
    `Protein still needed today: about ${Math.round(req.remainingGrams)} g`,
    `Already eaten today: ${req.eatenToday?.length ? req.eatenToday.slice(0, 15).join('; ') : 'nothing yet'}`,
    ...(req.remainingKcal != null ? [`Calories left today: about ${Math.round(req.remainingKcal)} kcal`] : []),
    ...(req.meal ? [`This is for: ${req.meal}`] : []),
    ...(req.maxMinutes ? [`Time to cook: at most ${req.maxMinutes} minutes`] : []),
    ...(req.budget === 'low' ? ['Budget: low — affordable options please'] : []),
    ...(req.onHand ? [`Ingredients they have: ${req.onHand}`] : []),
    ...(req.recent?.length ? [`Recently eaten or already suggested (vary from these): ${req.recent.slice(0, 25).join('; ')}`] : []),
  ].join('\n');
  const response = await client.beta.messages.create({
    model: RECOGNITION_MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  });
  if (response.stop_reason === 'refusal') throw new Error('No suggestions available right now.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No suggestions returned.');
  const parsed = JSON.parse(text.text) as { ideas: Idea[] };
  return (parsed.ideas ?? []).slice(0, 6).map((i) => ({
    name: String(i.name).slice(0, 60),
    localName: String(i.localName ?? '').slice(0, 60),
    why: String(i.why ?? '').replace(/\d+(\.\d+)?\s*(g|kcal|%)/gi, '').slice(0, 140),
    searchQueries: (i.searchQueries ?? []).map((q) => String(q).slice(0, 60)).filter(Boolean).slice(0, 3),
    minutes: Number.isFinite(i.minutes) ? Math.max(0, Math.min(240, Math.round(i.minutes))) : 0,
    swap: String(i.swap ?? '').slice(0, 60),
  }));
}
