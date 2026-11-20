/**
 * Recipe import: turn a pasted recipe, a web page's text or a photo of a recipe into
 * ingredients with grams. The AI only reads the recipe; nutrition is calculated by the app
 * from its food database, and the person checks every line before saving.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { RECOGNITION_MODEL } from './recognition.js';

export interface ImportedIngredient {
  /** As written, e.g. "2 tbsp palm oil". */
  original: string;
  /** Plain English food name for searching, e.g. "palm oil". */
  name: string;
  /** Database-style queries, most specific first. */
  searchQueries: string[];
  /** Estimated grams for the amount written; 0 when there's no amount. */
  grams: number;
  /** raw / cooked / dry: the form the amount refers to. */
  form: 'raw' | 'cooked' | 'dry' | 'na';
  /** True when the recipe gives no quantity and the grams are a guess. */
  guessed: boolean;
}
export interface ImportedRecipe { isRecipe: boolean; title: string; servings: number; ingredients: ImportedIngredient[]; steps: string[]; note: string }

const SCHEMA = {
  type: 'object',
  properties: {
    isRecipe: { type: 'boolean' },
    title: { type: 'string' },
    servings: { type: 'number' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          name: { type: 'string' },
          searchQueries: { type: 'array', items: { type: 'string' } },
          grams: { type: 'number' },
          form: { type: 'string', enum: ['raw', 'cooked', 'dry', 'na'] },
          guessed: { type: 'boolean' },
        },
        required: ['original', 'name', 'searchQueries', 'grams', 'form', 'guessed'],
        additionalProperties: false,
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
  required: ['isRecipe', 'title', 'servings', 'ingredients', 'steps', 'note'],
  additionalProperties: false,
} as const;

const SYSTEM = `You read recipes for a nutrition app. Extract the ingredient list exactly as written, then convert every amount to grams.
- One entry per ingredient line. Keep "original" as written (amount + unit + food).
- "grams": convert units carefully (1 cup cooked rice ≈ 160 g, 1 cup flour ≈ 125 g, 1 tbsp oil ≈ 13.5 g, 1 tsp salt ≈ 6 g, 1 medium onion ≈ 110 g, 1 large egg ≈ 50 g, 1 Maggi/stock cube ≈ 10 g, 1 lb = 454 g, 1 oz = 28 g, 1 ml water = 1 g). Ignore invisible or odd characters in the text. If no quantity is given ("salt to taste", "oil for frying"), do NOT estimate: set "grams" to 0 and "guessed" to true, so the person fills it in.
- "form": whether the amount is raw, cooked or dry (dry rice, dry beans), or "na".
- "searchQueries": 2–3 short queries phrased like food-composition database entries, most specific first (e.g. ["palm oil", "oil palm"], ["beef stewing raw", "beef raw"], ["rice white long-grain raw"]).
- "servings": the number of servings stated, else a sensible estimate (at least 1).
- If the text or photo is not a recipe, set isRecipe false, leave ingredients empty and explain in "note". Otherwise "note" is "" or one short sentence about anything unclear.
- "steps": the method/instructions as written, one step per entry, in order (empty if the recipe has none). Copy them; don't rewrite or add steps.
- Never invent ingredients or amounts that aren't in the recipe.`;

export async function importRecipeWithClient(client: Anthropic, input: { text?: string; image?: { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' } }): Promise<ImportedRecipe> {
  const content = input.image
    ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: input.image.mediaType, data: input.image.data } }, { type: 'text' as const, text: 'Extract this recipe.' }]
    : `Extract this recipe:\n\n${(input.text ?? '').slice(0, 15000)}`;
  const res = await client.beta.messages.create({
    model: RECOGNITION_MODEL,
    max_tokens: 6000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  } as never) as Anthropic.Beta.BetaMessage;
  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Couldn’t read that recipe.');
  return cleanImported(JSON.parse(block.text));
}

/** Keep the output tidy and bounded. */
export function cleanImported(raw: unknown): ImportedRecipe {
  const r = (raw ?? {}) as Partial<ImportedRecipe>;
  const s = (v: unknown, n: number) => String(v ?? '').replace(/[​-‍﻿­]/g, '').trim().slice(0, n);
  return {
    isRecipe: r.isRecipe === true,
    title: s(r.title, 80),
    servings: Math.min(50, Math.max(1, Math.round(Number(r.servings) || 1))),
    note: s(r.note, 200),
    steps: (Array.isArray(r.steps) ? r.steps : []).map((x) => s(x, 400)).filter(Boolean).slice(0, 40),
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).slice(0, 40).map((i) => ({
      original: s(i?.original, 100),
      name: s(i?.name, 60),
      searchQueries: (Array.isArray(i?.searchQueries) ? i.searchQueries : []).map((q) => s(q, 60)).filter(Boolean).slice(0, 3),
      grams: Number.isFinite(i?.grams) && i.grams > 0 ? Math.min(Math.round(i.grams), 20000) : 0,
      form: (['raw', 'cooked', 'dry', 'na'] as const).includes(i?.form as never) ? i.form : 'na',
      guessed: i?.guessed === true,
    })).filter((i) => i.name),
  };
}

/** Readable text from a recipe web page (scripts, styles and tags removed; JSON-LD recipe kept). */
export function pageText(html: string): string {
  // Many recipe sites include a structured Recipe block: use it when present.
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).find((j) => /"recipeIngredient"/.test(j));
  const body = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return (ld ? `Structured recipe data:\n${ld.slice(0, 8000)}\n\nPage text:\n` : '') + body.slice(0, ld ? 6000 : 14000);
}

/** Only fetch ordinary public https pages (no local addresses, no odd ports). */
export function safeRecipeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
    const h = u.hostname.toLowerCase();
    if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return null;
    return u;
  } catch { return null; }
}
