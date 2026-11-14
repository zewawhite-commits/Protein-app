/**
 * AI nutrition coach (shared by api/chat.ts). The coach talks with the user and can
 * point to foods; it never supplies nutrient values for foods — the app matches each
 * suggested food to a database record and calculates the numbers itself.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { RECOGNITION_MODEL } from './recognition';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
export interface ChatImage { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }

/** What the app tells the coach about the person and their day (all optional). */
export interface CoachContext {
  name?: string;
  goals?: string[];
  activity?: string;
  diet?: string;
  country?: string;
  cuisines?: string[];
  avoid?: string[];
  age?: number;
  sex?: string;
  pregnant?: boolean;
  /** Daily targets the app calculated. */
  targets?: { kcal?: number; protein?: number; carbs?: number; fat?: number; fiber?: number };
  /** Totals so far today, from the app's database calculations. */
  today?: { kcal?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; sugar?: number; sodiumMg?: number };
  eatenToday?: string[];
  localTime?: string;
}

export interface CoachFood { name: string; localName: string; searchQueries: string[]; portionGrams: number }
export interface CoachReply { reply: string; foods: CoachFood[] }

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    foods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          localName: { type: 'string' },
          searchQueries: { type: 'array', items: { type: 'string' } },
          portionGrams: { type: 'number' },
        },
        required: ['name', 'localName', 'searchQueries', 'portionGrams'],
        additionalProperties: false,
      },
    },
  },
  required: ['reply', 'foods'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are the friendly nutrition coach inside Provora, a food-tracking app. You help people eat well for their goals using foods they actually eat where they live.

How to answer:
- Be accurate. If you're not sure about something (a dish, an ingredient, whether a food suits a condition), say so plainly instead of guessing. Base advice on mainstream nutrition guidance (WHO, national dietary guidelines, sports nutrition position stands).
- Be warm, practical and brief: usually 2–5 short sentences or a short list; longer only when asked. Plain language, no jargon. Use the person's name occasionally if known.
- Use the profile and today's numbers you are given (targets and totals were calculated by the app from food-composition databases). You may refer to those numbers. Do not invent other numbers.
- NEVER state nutrient values for specific foods (no "an egg has 6 g protein", no calories per food). The app shows verified numbers for any food you put in "foods". Say things like "eggs are a great protein source" instead.
- When suggesting what to eat, put each concrete food or simple dish in "foods" (max 5): "name" in English, "localName" if there is a common local name (else ""), "searchQueries" = 2–3 short queries phrased like food-composition database entries, most specific first, naming the main ingredient and its form (e.g. ["chicken tikka masala", "chicken curry", "chicken breast cooked"] or ["moi moi", "cowpeas mature seeds cooked"]), "portionGrams" = a typical single portion in grams as eaten (0 if not applicable). Leave "foods" empty when no food suggestion fits.
- Photos: the person may attach a photo of a meal or food label. Say briefly what you see (names of foods, cooking style), then answer their question. Put each food you can see in "foods" with "portionGrams" as your rough visual estimate (the app labels it as an estimate and asks them to weigh). If you can't tell what something is, say so and ask. If the photo isn't food, say so kindly.
- Mix cuisines: combine foods available in their country with the cuisines they enjoy, and vary them — don't default to one region's food unless they ask. Respect their diet strictly and never suggest anything they avoid or are allergic to (check ingredients, e.g. peanut sauces, fish sauce, egg in batter).
- Safety: you are not a doctor. For medical conditions, medicines, allergies, pregnancy complications, or symptoms, give general information only and suggest a doctor or registered dietitian. Never recommend eating below about 1,200 kcal a day, fasting for many days, or extreme restriction. If someone mentions disordered eating, self-harm or feeling unsafe, respond with care, don't give weight-loss advice, and encourage them to reach out to a professional or local helpline.
- Stay on food, nutrition, eating habits, training nutrition, hydration and using the app. Politely steer other topics back.
- Format "reply" as plain text; you may use short "- " bullet lines. No markdown headings, no tables.`;

export function contextText(c: CoachContext): string {
  const t = c.targets ?? {};
  const d = c.today ?? {};
  const fmt = (v?: number, u = 'g') => (v == null ? 'unknown' : `${Math.round(v)} ${u}`);
  return [
    'About the person (from their profile):',
    `- Name: ${c.name || 'not given'}`,
    `- Goals: ${c.goals?.length ? c.goals.join(', ') : 'not given'}; activity: ${c.activity || 'not given'}; diet: ${c.diet || 'eats everything'}`,
    `- Cuisines they enjoy: ${c.cuisines?.length ? c.cuisines.join(', ') : 'not given (offer a varied mix)'}`,
    `- Allergies / avoids (never suggest these): ${c.avoid?.length ? c.avoid.join(', ') : 'none given'}`,
    `- Country: ${c.country || 'not given'}; age: ${c.age ?? 'not given'}; sex: ${c.sex || 'not given'}${c.pregnant ? '; pregnant or breastfeeding' : ''}`,
    `Daily targets: ${fmt(t.kcal, 'kcal')}, protein ${fmt(t.protein)}, carbs ${fmt(t.carbs)}, fat ${fmt(t.fat)}, fibre ${fmt(t.fiber)}`,
    `Eaten so far today: ${fmt(d.kcal, 'kcal')}, protein ${fmt(d.protein)}, carbs ${fmt(d.carbs)}, fat ${fmt(d.fat)}, fibre ${fmt(d.fiber)}, sugars ${fmt(d.sugar)}, sodium ${fmt(d.sodiumMg, 'mg')}`,
    `Foods logged today: ${c.eatenToday?.length ? c.eatenToday.join('; ') : 'nothing yet'}`,
    `Local time: ${c.localTime || 'unknown'}`,
  ].join('\n');
}

export async function coachWithClient(client: Anthropic, turns: ChatTurn[], context: CoachContext, image?: ChatImage): Promise<CoachReply> {
  const response = await client.beta.messages.create({
    model: RECOGNITION_MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    // Stable instructions first (cacheable), then this person's context.
    system: [
      { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: contextText(context) },
    ],
    // A photo goes with the latest user message only (earlier photos are not re-sent).
    messages: turns.map((t, i) =>
      image && i === turns.length - 1
        ? { role: t.role, content: [{ type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.data } }, { type: 'text' as const, text: t.content }] }
        : { role: t.role, content: t.content },
    ),
  });
  if (response.stop_reason === 'refusal') return { reply: 'Sorry — I can’t help with that one. Ask me anything about food and your goals.', foods: [] };
  if (response.stop_reason === 'max_tokens') throw new Error('The answer was too long — try a narrower question.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No reply returned.');
  return sanitizeReply(JSON.parse(text.text));
}

/** Keep the shape tight and strip any per-food numbers that slipped into names. */
export function sanitizeReply(raw: unknown): CoachReply {
  const r = (raw ?? {}) as Partial<CoachReply>;
  return {
    reply: String(r.reply ?? '').slice(0, 4000),
    foods: (Array.isArray(r.foods) ? r.foods : []).slice(0, 5).map((f) => ({
      name: String(f?.name ?? '').slice(0, 60),
      localName: String(f?.localName ?? '').slice(0, 60),
      searchQueries: (Array.isArray(f?.searchQueries) ? f.searchQueries : []).map((q) => String(q).slice(0, 60)).filter(Boolean).slice(0, 3),
      portionGrams: Number.isFinite(f?.portionGrams) && f.portionGrams > 0 && f.portionGrams <= 1500 ? Math.round(f.portionGrams) : 0,
    })).filter((f) => f.name),
  };
}

/** Validate turns from the client: alternating, starting and ending with the user, bounded. */
export function cleanTurns(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const turns = raw.slice(-20).map((t) => ({ role: t?.role, content: typeof t?.content === 'string' ? t.content.trim().slice(0, 2000) : '' }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null;
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].role !== (i % 2 === 0 ? 'user' : 'assistant') || !turns[i].content) return null;
  }
  return turns as ChatTurn[];
}
