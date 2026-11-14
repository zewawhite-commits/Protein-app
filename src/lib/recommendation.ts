/**
 * AI meal ideas (shared by api/recommend.ts). Claude suggests *food names* people
 * actually eat in the user's country that would help close today's protein gap.
 * It never supplies nutrient values: the app matches each idea to a database record
 * and calculates protein and grams itself.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { RECOGNITION_MODEL } from './recognition';

export interface IdeaRequest {
  country?: string;
  diet?: string;
  remainingGrams: number;
  /** Foods already eaten today, to avoid repeats. */
  eatenToday?: string[];
}

export interface Idea {
  name: string;
  localName: string;
  why: string;
  searchQueries: string[];
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
        },
        required: ['name', 'localName', 'why', 'searchQueries'],
        additionalProperties: false,
      },
    },
  },
  required: ['ideas'],
  additionalProperties: false,
} as const;

const SYSTEM = `You suggest everyday foods that help someone reach their daily protein goal.

Suggest 5 foods or simple dishes that people commonly eat in the user's country (use local, affordable, culturally familiar options first; include at least one quick snack). Respect the diet strictly. Avoid repeating foods already eaten today.

For each idea:
- "name": short English name.
- "localName": the local name if there is one, else "".
- "why": one short, friendly sentence (max 15 words) on why it's a good protein choice. Do NOT state any numbers (no grams, calories or percentages).
- "searchQueries": 2–3 short queries phrased like food-composition database entries, most specific first, then generic (e.g. ["moi moi", "cowpeas cooked", "beans cooked"]).

Never give nutrient values. Never give medical advice.`;

export async function ideasWithClient(client: Anthropic, req: IdeaRequest): Promise<Idea[]> {
  const user = [
    `Country: ${req.country || 'not specified (suggest widely available foods)'}`,
    `Diet: ${req.diet || 'eats everything'}`,
    `Protein still needed today: about ${Math.round(req.remainingGrams)} g`,
    `Already eaten today: ${req.eatenToday?.length ? req.eatenToday.slice(0, 15).join('; ') : 'nothing yet'}`,
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
  }));
}
