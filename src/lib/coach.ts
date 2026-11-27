/**
 * AI nutrition coach (shared by api/chat.ts). The coach talks with the user and can
 * point to foods; it never supplies nutrient values for foods — the app matches each
 * suggested food to a database record and calculates the numbers itself.
 */
import type Anthropic from '@anthropic-ai/sdk';

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
  obstacles?: string[];
  aim?: string;
  training?: string[];
  weightKg?: number;
  goalWeightKg?: number;
  age?: number;
  sex?: string;
  pregnant?: boolean;
  /** Daily targets the app calculated. */
  targets?: { kcal?: number; protein?: number; carbs?: number; fat?: number; fiber?: number };
  /** Totals so far today, from the app's database calculations. */
  today?: { kcal?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; sugar?: number; sodiumMg?: number };
  eatenToday?: string[];
  /** Foods logged over the last week (so suggestions can vary and fit their habits). */
  recentFoods?: string[];
  /** Plain-language progress facts worked out by the app (weight trend, consistency). */
  progress?: string[];
  localTime?: string;
}

export interface CoachFood { name: string; localName: string; searchQueries: string[]; portionGrams: number }
/** Changes the person agreed to in the chat; the app asks them to confirm before saving. */
export interface ProfileUpdate { field: 'calorieGoal' | 'proteinGoal' | 'goalWeightKg' | 'avoidAdd' | 'cuisinesAdd' | 'dietPrefsAdd' | 'obstaclesAdd' | 'trainingAdd'; value: string; label: string }
export interface CoachReply { reply: string; foods: CoachFood[]; profileUpdates?: ProfileUpdate[] }

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
    profileUpdates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', enum: ['calorieGoal', 'proteinGoal', 'goalWeightKg', 'avoidAdd', 'cuisinesAdd', 'dietPrefsAdd', 'obstaclesAdd', 'trainingAdd'] },
          value: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['field', 'value', 'label'],
        additionalProperties: false,
      },
    },
  },
  required: ['reply', 'foods', 'profileUpdates'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are the friendly nutrition coach inside Nutivili AI, a food-tracking app. You help people eat well for their goals using foods they actually eat where they live.
- Nutivili has no alcohol: never suggest, recommend or include alcoholic drinks or alcohol as an ingredient (no wine, beer or spirits in recipes or plans). If asked about alcohol, answer briefly and neutrally and move on to food.

How to answer:
- Be accurate. If you're not sure about something (a dish, an ingredient, whether a food suits a condition), say so plainly instead of guessing. Base advice on mainstream nutrition guidance (WHO, national dietary guidelines, sports nutrition position stands).
- Explain your reasoning in a few words, using their own data ("you’re 40 g short on protein and it’s evening, so…"), so advice never feels like a mystery score. Point out what’s going well, not only what’s missing.
- Be warm, practical and brief: usually 2–5 short sentences or a short list; longer only when asked. Plain language, no jargon. Use the person's name occasionally if known.
- Use the profile and today's numbers you are given (targets and totals were calculated by the app from food-composition databases). You may refer to those numbers. Do not invent other numbers.
- NEVER state nutrient values for specific foods (no "an egg has 6 g protein", no calories per food). The app shows verified numbers for any food you put in "foods". Say things like "eggs are a great protein source" instead.
- When suggesting what to eat, put each concrete food or simple dish in "foods" (max 5): "name" in English, "localName" if there is a common local name (else ""), "searchQueries" = 2–3 short queries phrased like food-composition database entries, most specific first, naming the main ingredient and its form (e.g. ["chicken tikka masala", "chicken curry", "chicken breast cooked"] or ["moi moi", "cowpeas mature seeds cooked"]), "portionGrams" = a typical single portion in grams as eaten (0 if not applicable). Leave "foods" empty when no food suggestion fits.
- Photos: the person may attach a photo of a meal, a nutrition label, an ingredient list, food packaging, or something fitness-related. For a meal: name each visible food and the cooking style, give a rough portion and estimated calories, protein, carbs and fat, point out the protein-rich items, and say plainly what you can't tell (hidden oil, sauce, what's under something, portion depth); ask one short follow-up if it matters. Put each food you can see in "foods" with "portionGrams" as your rough visual estimate (the app labels it as an estimate and lets them edit it). For a label or ingredient list: read only what's printed; if it's blurry or cut off, say which part you can't read rather than guessing. For a workout or gym photo: comment only on what's actually visible, never diagnose injuries. If the image isn't related to food, nutrition or fitness, or you can't make it out, say so politely and don't pretend to analyse it.
- Mix cuisines: combine foods available in their country with the cuisines they enjoy, and vary them — don't default to one region's food unless they ask. Respect their diet strictly and never suggest anything they avoid or are allergic to (check ingredients, e.g. peanut sauces, fish sauce, egg in batter).
- Vegetarian / vegan: if they say they're vegetarian or vegan (or want to change it), tell them: "You can change your dietary preference anytime in Settings." Vegan means no meat, fish, dairy, eggs, honey, gelatin, fish sauce, shrimp paste or meat stock; vegetarian allows dairy and eggs. Suggest plenty of varied, high-protein plant meals from many cuisines.
- Safety: you are not a doctor. For medical conditions, medicines, allergies, pregnancy complications, or symptoms, give general information only and suggest a doctor or registered dietitian. Never recommend eating below about 1,200 kcal a day, fasting for many days, or extreme restriction. If someone mentions disordered eating, self-harm or feeling unsafe, respond with care, don't give weight-loss advice, and encourage them to reach out to a professional or local helpline.
- Stay on food, nutrition, eating habits, training nutrition, hydration and using the app. Politely steer other topics back.
- Profile updates: only when the person clearly agrees to or asks for a change to their own settings (e.g. "yes, set my calories to 1,900", "add shellfish to my allergies", "I also like Thai food"), put it in "profileUpdates": field = calorieGoal (kcal) | proteinGoal (g a day) | goalWeightKg (kg) | avoidAdd (a food or allergy to avoid) | cuisinesAdd | dietPrefsAdd (e.g. halal, low-sugar) | obstaclesAdd | trainingAdd; "value" = the number or word; "label" = a short sentence describing the change. The app asks them to confirm before saving, so say "tap Save to update your profile". Never add updates they didn't agree to; otherwise leave it empty. Keep targets safe (calories at least 1,200).
- Respect their goal: if they're trying to gain weight or build muscle, eating above maintenance is the plan — never scold them for going over a calorie number.
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
    `- What they most want: ${c.aim || 'not given'}`,
    `- What gets in their way: ${c.obstacles?.length ? c.obstacles.join(', ') : 'not given'}`,
    `- Exercise they do or want to try: ${c.training?.length ? c.training.join(', ') : 'not given'}`,
    `- Weight: ${c.weightKg ? `${Math.round(c.weightKg)} kg` : 'not given'}${c.goalWeightKg ? `; goal weight ${Math.round(c.goalWeightKg)} kg` : ''}`,
    `- Country: ${c.country || 'not given'}; age: ${c.age ?? 'not given'}; sex: ${c.sex || 'not given'}${c.pregnant ? '; pregnant or breastfeeding' : ''}`,
    `Daily targets: ${fmt(t.kcal, 'kcal')}, protein ${fmt(t.protein)}, carbs ${fmt(t.carbs)}, fat ${fmt(t.fat)}, fibre ${fmt(t.fiber)}`,
    `Eaten so far today: ${fmt(d.kcal, 'kcal')}, protein ${fmt(d.protein)}, carbs ${fmt(d.carbs)}, fat ${fmt(d.fat)}, fibre ${fmt(d.fiber)}, sugars ${fmt(d.sugar)}, sodium ${fmt(d.sodiumMg, 'mg')}`,
    `Foods logged today: ${c.eatenToday?.length ? c.eatenToday.join('; ') : 'nothing yet'}`,
    `Foods they logged in the last 7 days: ${c.recentFoods?.length ? c.recentFoods.join('; ') : 'none yet'} — build on what they like, but vary your suggestions and don’t keep recommending the same meals.`,
    `Progress (calculated by the app): ${c.progress?.length ? c.progress.join(' ') : 'not enough data yet'}`,
    'Tone: supportive and practical. Never shame food choices or call foods good or bad; a missed day or a higher weigh-in is normal.',
    `Local time: ${c.localTime || 'unknown'}`,
  ].join('\n');
}

/** Model for the coach chat: quick replies matter more here than in photo recognition. */
export const CHAT_MODEL = 'claude-sonnet-5-5';

const PRO_NOTE = 'This person is on Plus: give deeper, more personalised coaching — connect advice to their logged foods, trends and goal, and explain the why in a sentence.';

/** The request for one coach reply (shared by the normal and the streaming path). */
function coachParams(turns: ChatTurn[], context: CoachContext, image?: ChatImage, opts: { pro?: boolean } = {}) {
  return {
    // Chat favours speed: everyone gets the fast model with low effort, so replies start in a few seconds.
    // Plus gets deeper, more personal coaching through its instructions (PRO_NOTE), not a slower model.
    model: CHAT_MODEL,
    max_tokens: 3000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    output_config: { effort: 'low' as const, format: { type: 'json_schema' as const, schema: SCHEMA as unknown as Record<string, unknown> } },
    // Stable instructions first (cacheable), then this person's context.
    system: [
      { type: 'text' as const, text: SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: opts.pro ? `${contextText(context)}\n${PRO_NOTE}` : contextText(context) },
    ],
    // A photo goes with the latest user message only (earlier photos are not re-sent).
    messages: turns.map((t, i) =>
      image && i === turns.length - 1
        ? { role: t.role, content: [{ type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.data } }, { type: 'text' as const, text: t.content }] }
        : { role: t.role, content: t.content },
    ),
  };
}

function finish(stop: string | null | undefined, text: string | undefined): CoachReply {
  if (stop === 'refusal') return { reply: 'Sorry, I can’t help with that one. Ask me anything about food and your goals.', foods: [] };
  if (stop === 'max_tokens') throw new Error('The answer was too long. Try a narrower question.');
  if (!text) throw new Error('No reply returned.');
  return sanitizeReply(JSON.parse(text));
}

export async function coachWithClient(client: Anthropic, turns: ChatTurn[], context: CoachContext, image?: ChatImage, opts: { pro?: boolean } = {}): Promise<CoachReply> {
  const response = await client.beta.messages.create(coachParams(turns, context, image, opts) as never) as Anthropic.Beta.BetaMessage;
  const text = response.content.find((b) => b.type === 'text');
  return finish(response.stop_reason, text && text.type === 'text' ? text.text : undefined);
}

/**
 * Same as coachWithClient, but calls onText with each piece of the raw JSON as it is
 * written, so the app can show the reply word by word.
 */
export async function coachStream(client: Anthropic, turns: ChatTurn[], context: CoachContext, image: ChatImage | undefined, opts: { pro?: boolean }, onText: (piece: string) => void): Promise<CoachReply> {
  const stream = client.beta.messages.stream(coachParams(turns, context, image, opts) as never);
  stream.on('text', (piece: string) => onText(piece));
  const msg = await stream.finalMessage();
  const text = msg.content.find((b) => b.type === 'text');
  return finish(msg.stop_reason, text && text.type === 'text' ? text.text : undefined);
}

/** The "reply" text so far, from partial JSON like {"reply":"Hi Ada, try a…  (for live display). */
export function partialReply(raw: string): string {
  const m = /"reply"\s*:\s*"/.exec(raw);
  if (!m) return '';
  let out = '';
  for (let i = m.index + m[0].length; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') return out;
    if (c === '\\') {
      const n = raw[i + 1];
      if (n === undefined) return out;
      if (n === 'u') { const hex = raw.slice(i + 2, i + 6); if (hex.length < 4) return out; out += String.fromCharCode(parseInt(hex, 16)); i += 5; continue; }
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n; i++; continue;
    }
    out += c;
  }
  return out;
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
    profileUpdates: cleanUpdates(r.profileUpdates),
  };
}

const UPDATE_FIELDS = new Set(['calorieGoal', 'proteinGoal', 'goalWeightKg', 'avoidAdd', 'cuisinesAdd', 'dietPrefsAdd', 'obstaclesAdd', 'trainingAdd']);
/** Keep only safe, well-formed profile changes (the person still confirms each one in the app). */
export function cleanUpdates(raw: unknown): ProfileUpdate[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 4).flatMap((u) => {
    const field = String(u?.field ?? ''); const value = String(u?.value ?? '').trim().slice(0, 40); const label = String(u?.label ?? '').trim().slice(0, 120);
    if (!UPDATE_FIELDS.has(field) || !value || !label) return [];
    if (field === 'calorieGoal') { const n = Number(value.replace(/[^\d.]/g, '')); if (!(n >= 1200 && n <= 6000)) return []; }
    if (field === 'proteinGoal') { const n = Number(value.replace(/[^\d.]/g, '')); if (!(n >= 20 && n <= 400)) return []; }
    if (field === 'goalWeightKg') { const n = Number(value.replace(/[^\d.]/g, '')); if (!(n >= 30 && n <= 300)) return []; }
    return [{ field: field as ProfileUpdate['field'], value, label }];
  });
}

/** Validate turns from the client: alternating, starting and ending with the user, bounded. */
export function cleanTurns(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  // Be forgiving: a failed reply or an empty one shouldn't break the whole chat. Drop empty
  // or unknown turns, and merge back-to-back turns from the same side (e.g. two questions in a row).
  const turns: ChatTurn[] = [];
  for (const t of raw.slice(-30)) {
    const role = t?.role === 'assistant' ? 'assistant' : t?.role === 'user' ? 'user' : null;
    const content = typeof t?.content === 'string' ? t.content.trim().slice(0, 2000) : '';
    if (!role || !content) continue;
    const last = turns[turns.length - 1];
    if (last?.role === role) last.content = `${last.content}\n\n${content}`.slice(-4000);
    else turns.push({ role, content });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null;
  return turns.slice(-20);
}
