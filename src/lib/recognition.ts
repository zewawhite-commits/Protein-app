/**
 * AI food recognition with Claude vision.
 *
 * Claude only *identifies* what is in the photo (names, cuisine, raw/cooked, a rough
 * portion guess) and suggests database search terms. It never supplies nutrient values:
 * every number the app shows comes from a database record the user confirms
 * (see nutrition.ts). This module is shared by the browser and api/recognize.ts.
 */
import type Anthropic from '@anthropic-ai/sdk';

export const RECOGNITION_MODEL = 'claude-opus-5-5';

export interface RecognizedItem {
  /** Specific English name, e.g. "Chicken jollof rice". */
  name: string;
  /** Name in the dish's own language/region, or "" if same as name. */
  localName: string;
  /** Cuisine or region, e.g. "Nigerian", "Japanese", "" if generic. */
  cuisine: string;
  /** 1–4 queries phrased like food-composition database entries, most specific first. */
  searchQueries: string[];
  state: 'raw' | 'cooked' | 'dry' | 'na';
  /** Rough visual portion estimate in grams (0 = cannot tell). An AI guess — never used without the user confirming. */
  estimatedGrams: number;
  confidence: 'high' | 'medium' | 'low';
  /** For combined dishes: the likely ingredients, so the user can log them one by one. Empty for single foods. */
  ingredients: RecognizedIngredient[];
}

export interface RecognizedIngredient {
  name: string;
  searchQueries: string[];
  state: 'raw' | 'cooked' | 'dry' | 'na';
  /** false for things you usually can't see in the photo (cooking oil, stock, ground seeds). */
  visible: boolean;
}

export interface RecognitionResult {
  isFood: boolean;
  items: RecognizedItem[];
  /** Short note for the user, e.g. "Sauce may hide extra oil". */
  note: string;
}

const SCHEMA = {
  type: 'object',
  properties: {
    isFood: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          localName: { type: 'string' },
          cuisine: { type: 'string' },
          searchQueries: { type: 'array', items: { type: 'string' } },
          state: { type: 'string', enum: ['raw', 'cooked', 'dry', 'na'] },
          estimatedGrams: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                searchQueries: { type: 'array', items: { type: 'string' } },
                state: { type: 'string', enum: ['raw', 'cooked', 'dry', 'na'] },
                visible: { type: 'boolean' },
              },
              required: ['name', 'searchQueries', 'state', 'visible'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'localName', 'cuisine', 'searchQueries', 'state', 'estimatedGrams', 'confidence', 'ingredients'],
        additionalProperties: false,
      },
    },
    note: { type: 'string' },
  },
  required: ['isFood', 'items', 'note'],
  additionalProperties: false,
} as const;

const SYSTEM = `You identify foods in photos for a protein-tracking app used worldwide.

For each distinct food you can see, return one item. If a plate has separable parts (e.g. rice, grilled chicken, fried plantain), list them separately. If the food is a combined dish whose parts can't be weighed apart (a curry, soup, stew, sandwich, sushi roll), return the dish as one item.

Recognise dishes from any cuisine. Use the specific dish name in English in "name" and the local name in "localName" (e.g. name "Spicy rice with tomato and chicken", localName "Jollof rice").

"searchQueries" are used to look the food up in food-composition databases (USDA, FAO/INFOODS) and a packaged-product database. Give 2–4 short queries, most specific first, then more generic fallbacks that such databases are likely to contain, e.g. ["jollof rice", "rice tomato sauce", "rice white cooked"] or ["chicken thigh roasted", "chicken roasted"]. For a branded packaged product, include the brand and product name.

"state": cooked if visibly cooked, raw if raw, dry for dry uncooked grains/pasta, na otherwise.
"estimatedGrams": your best visual estimate of the edible weight shown, or 0 if you cannot judge. The user will weigh the food; this is only a starting point.

For a combined dish (soup, stew, curry, rice dish, salad, sandwich…), also list its likely main ingredients in "ingredients" (3–8 items), each with database-style "searchQueries" and its state as it is in the dish. Include ingredients that are usually present but hard to see, such as cooking oil, palm oil, stock fish, crayfish or ground melon seeds, and mark those "visible": false. For single foods, return "ingredients": [].

Do not provide any nutrient values. If the photo contains no food, set isFood to false and items to [].`;

/** Run recognition with an Anthropic client (server-side key, or the user's own key in the browser). */
export async function recognizeWithClient(client: Anthropic, imageBase64: string, mediaType: string): Promise<RecognitionResult> {
  const response = await client.beta.messages.create({
    model: RECOGNITION_MODEL,
    max_tokens: 16000,
    // If the model declines, the API retries on a fallback model it picks for the refusal category.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> },
    },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: 'Identify the foods in this photo.' },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('The photo could not be analysed. Try another photo or search manually.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No result from the recognition service.');
  return sanitize(JSON.parse(text.text));
}

/** Defensive cleanup of the model output before it reaches the UI. */
export function sanitize(raw: RecognitionResult): RecognitionResult {
  const items = (raw.items ?? []).slice(0, 8).map((i) => ({
    ...i,
    name: String(i.name ?? '').slice(0, 80),
    localName: String(i.localName ?? '').slice(0, 80),
    cuisine: String(i.cuisine ?? '').slice(0, 40),
    searchQueries: (i.searchQueries ?? []).map((q) => String(q).slice(0, 60)).filter(Boolean).slice(0, 4),
    estimatedGrams: Number.isFinite(i.estimatedGrams) ? Math.max(0, Math.min(2000, Math.round(i.estimatedGrams))) : 0,
    ingredients: (i.ingredients ?? []).slice(0, 10).map((g) => ({
      name: String(g.name ?? '').slice(0, 60),
      searchQueries: (g.searchQueries ?? []).map((q) => String(q).slice(0, 60)).filter(Boolean).slice(0, 3),
      state: (['raw', 'cooked', 'dry', 'na'] as const).includes(g.state) ? g.state : 'na',
      visible: g.visible !== false,
    })).filter((g) => g.name),
  }));
  return { isFood: !!raw.isFood, items, note: String(raw.note ?? '').slice(0, 200) };
}
