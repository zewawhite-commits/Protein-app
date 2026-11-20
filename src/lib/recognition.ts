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
  /** How it was cooked, as far as the photo shows ('none' = not applicable, e.g. fruit, bread, drinks). */
  method: CookingMethod;
  /** Portion size compared with a typical adult serving of this food. */
  size: 'small' | 'medium' | 'large';
  /** Likely range for the weight (grams). 0/0 when estimatedGrams is 0. */
  gramsLow: number;
  gramsHigh: number;
  /** Extras the photo can't show (oil, butter, sugar, dressing, sauce), with grams for a little / usual / a lot. */
  hidden: HiddenExtra[];
  /** For combined dishes: the likely ingredients, so the user can log them one by one. Empty for single foods. */
  ingredients: RecognizedIngredient[];
}

export interface HiddenExtra {
  name: string;
  searchQueries: string[];
  little: number;
  usual: number;
  lot: number;
}

export interface RecognizedIngredient {
  name: string;
  searchQueries: string[];
  state: 'raw' | 'cooked' | 'dry' | 'na';
  /** false for things you usually can't see in the photo (cooking oil, stock, ground seeds). */
  visible: boolean;
}

export const COOKING_METHODS = ['fried', 'deep-fried', 'grilled', 'roasted', 'baked', 'boiled', 'steamed', 'stewed', 'stir-fried', 'smoked', 'raw', 'none'] as const;
export type CookingMethod = (typeof COOKING_METHODS)[number];

/** Words to add to a database search for each method (the tables name methods this way). */
export const METHOD_WORDS: Record<CookingMethod, string> = {
  fried: 'fried', 'deep-fried': 'fried', grilled: 'grilled', roasted: 'roasted', baked: 'baked', boiled: 'boiled',
  steamed: 'steamed', stewed: 'stewed', 'stir-fried': 'stir-fried', smoked: 'smoked', raw: 'raw', none: '',
};

/** Same key the app and server use for "what the AI called it". */
export const pickKey = (aiName: string) => aiName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export interface RecognitionResult {
  isFood: boolean;
  /** Whether the photo is good enough to estimate portions: poor = too dark, blurred, cropped, or at an angle that hides depth. */
  photoQuality: 'good' | 'fair' | 'poor';
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
          method: { type: 'string', enum: [...COOKING_METHODS] },
          size: { type: 'string', enum: ['small', 'medium', 'large'] },
          gramsLow: { type: 'number' },
          gramsHigh: { type: 'number' },
          hidden: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                searchQueries: { type: 'array', items: { type: 'string' } },
                little: { type: 'number' },
                usual: { type: 'number' },
                lot: { type: 'number' },
              },
              required: ['name', 'searchQueries', 'little', 'usual', 'lot'],
              additionalProperties: false,
            },
          },
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
        required: ['name', 'localName', 'cuisine', 'searchQueries', 'state', 'estimatedGrams', 'confidence', 'method', 'size', 'gramsLow', 'gramsHigh', 'hidden', 'ingredients'],
        additionalProperties: false,
      },
    },
    photoQuality: { type: 'string', enum: ['good', 'fair', 'poor'] },
    note: { type: 'string' },
  },
  required: ['isFood', 'photoQuality', 'items', 'note'],
  additionalProperties: false,
} as const;

const SYSTEM = `You identify foods in photos for a nutrition-tracking app used worldwide.

For each distinct food you can see, return one item. If a plate has separable parts (e.g. rice, grilled chicken, fried plantain), list them separately. If the food is a combined dish whose parts can't be weighed apart (a curry, soup, stew, sandwich, sushi roll), return the dish as one item.

Recognise dishes from any cuisine in the world — African, Asian, European, the Americas, Middle Eastern, Pacific — as well as packaged products, drinks, snacks, fruit and street food. Be complete: before answering, scan the whole photo and list EVERYTHING that will be eaten or drunk, not only the main protein — the carbohydrate (rice, bread, pasta, potatoes, swallow), vegetables and salad, sauces, dips, dressings and gravy, toppings (cheese, nuts, seeds, avocado), visible oil or butter, side dishes, fruit, desserts and drinks. Small items count. Then prefer the most specific dish name you are confident in, and lower "confidence" when unsure rather than guessing. Use the specific dish name in English in "name" and the local name in "localName" (e.g. name "Spicy rice with tomato and chicken", localName "Jollof rice").

"searchQueries" are used to look the food up in food-composition databases (USDA, FAO/INFOODS) and a packaged-product database. Give 2–4 short queries, most specific first, then more generic fallbacks that such databases are likely to contain, e.g. ["jollof rice", "rice tomato sauce", "rice white cooked"] or ["chicken thigh roasted", "chicken roasted"]. For a branded packaged product, include the brand and product name. When a dish has regional versions and you can tell which one it is (e.g. Nigerian vs Ghanaian jollof, Senegalese thieboudienne, Nigerian fried rice, palm-oil "native" jollof), put that version first, e.g. ["jollof rice ghanaian", "jollof rice", …].

"state": cooked if visibly cooked, raw if raw, dry for dry uncooked grains/pasta, na otherwise.
"method": how it was cooked — fried (shallow/pan), deep-fried, grilled, roasted, baked, boiled, steamed, stewed (in sauce/soup), stir-fried, smoked, raw — or none when it doesn't apply (bread, fruit, drinks, packaged foods). Look for the visual cues: browning and oil sheen (fried), char lines (grilled), a dry browned surface (roasted/baked), a pale moist surface (boiled/steamed), sitting in sauce (stewed). Fried and grilled versions of the same food differ a lot in calories, so put the method in the most specific searchQuery too (e.g. "plantain fried", "chicken thigh grilled").

Portions — estimate carefully, step by step, before giving numbers:
1. Find a scale reference: a standard dinner plate is about 26 cm across, a side plate 20 cm, a cereal bowl 15–16 cm; also cutlery, hands, cups, cans and packaging.
2. Judge how much of the plate or bowl each food covers, and its height or depth. A top-down photo hides depth: assume typical heaping for that food and widen the range.
3. Convert the volume to weight using the food's typical density (cooked rice ~0.8–0.9 g/ml, stews and soups ~1 g/ml, leafy salad much lighter).
"estimatedGrams": your best estimate of the edible weight shown (0 if you cannot judge). "gramsLow"/"gramsHigh": a realistic range around it — narrow when there's a clear scale reference, wider when there isn't. "size": small, medium or large compared with a typical adult serving of that food. The user can weigh the food; this is a starting point.
"hidden": for every item, 0–3 extras that change calories a lot but a photo can't show reliably and that are NOT already counted in the item itself: cooking oil or palm oil (for fried, stewed, stir-fried or sautéed food), butter or ghee, sugar or syrup in drinks, coffee and tea, dressing on salads, mayonnaise or sauce in sandwiches and wraps. Give grams for a little / usual / a lot for this portion (e.g. oil for a plate of fried rice: 5 / 15 / 30). Use [] when nothing hidden is likely (plain fruit, water, grilled meat with no sauce, packaged products whose label covers it). Don't repeat something already listed as its own item.
"photoQuality": good when the food is clear and a scale reference is visible; fair when estimates are rough (no reference, partial view); poor when it's too dark, blurred, cropped, or the angle hides the food — then say in "note" how to retake it (e.g. "Take it from a 45° angle with the whole plate in view").

For a combined dish (soup, stew, curry, rice dish, salad, sandwich…), also list its likely main ingredients in "ingredients" (3–8 items), each with database-style "searchQueries" and its state as it is in the dish. Include ingredients that are usually present but hard to see, such as cooking oil, palm oil, stock fish, crayfish or ground melon seeds, and mark those "visible": false. For single foods, return "ingredients": [].

Do not provide any nutrient values. If the photo contains no food (or only a menu, a person, etc.), set isFood to false and items to [] and explain briefly in "note".`;

/** Run recognition with an Anthropic client (server-side key, or the user's own key in the browser). */
export async function recognizeWithClient(client: Anthropic, imageBase64: string | null, mediaType: string, description?: string, opts: { menu?: boolean; leftovers?: string[] } = {}): Promise<RecognitionResult> {
  const response = await client.beta.messages.create({
    model: RECOGNITION_MODEL,
    max_tokens: 8000,
    // If the model declines, the API retries on a fallback model it picks for the refusal category.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      // Medium effort: a careful look at the plate in a few seconds. ('high' was noticeably slower
      // for little gain; nutrition numbers always come from the food database either way.)
      effort: 'medium',
      format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> },
    },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: imageBase64
          ? [
              mediaType === 'application/pdf'
                ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
                : { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: opts.leftovers?.length
                ? `This is a photo taken AFTER eating: it shows what is LEFT on the plate. Before eating the plate had:\n${opts.leftovers.map((l, i) => `${i + 1}. ${l}`).join('\n')}\nReturn exactly one item per food above, in the same order and with the same name, where estimatedGrams (with a range) is how much of it is LEFT in this photo — 0 if it is all gone. Do not add new foods. If the photo doesn't show a plate or leftovers, set isFood to false and explain in "note".`
                : opts.menu
                ? 'This is a photo of a restaurant, café or takeaway menu, not a plate. List up to 12 main dishes from it as items, as each would be served: use the dish name as written (English in "name", the menu’s own wording in "localName" if different), a typical restaurant portion in estimatedGrams with a range, the cooking method, ingredients for combined dishes, and hidden extras at restaurant levels (restaurants usually use more oil, butter and salt than home cooking). Skip drinks and sides unless the menu is only drinks. photoQuality = how readable the menu is. If it isn’t a menu or food, set isFood to false and explain in "note".'
                : 'Identify every food and drink in this photo — the whole plate, not just the main item.' },
            ]
          : opts.menu
            ? [{ type: 'text', text: `This is the text of a restaurant, café or takeaway menu (opened from its QR code or link). List up to 12 main dishes from it as items, as each would be served: use the dish name as written (English in "name", the menu’s own wording in "localName" if different), a typical restaurant portion in estimatedGrams with a range, the cooking method, ingredients for combined dishes, and hidden extras at restaurant levels (restaurants usually use more oil, butter and salt than home cooking). Skip drinks and sides unless the menu is only drinks. Use photoQuality "good" if the menu text is clear, else "fair". If it isn’t a menu, set isFood to false and explain in "note".\n\nMenu:\n${(description ?? '').slice(0, 14000)}` }]
          : [{ type: 'text', text: `There is no photo. The person described what they ate: "${description ?? ''}". Identify each food from the description (treat it as if you had seen it). Use any amounts they give for estimatedGrams (convert cups, pieces, slices to grams); otherwise estimate a typical portion. Use photoQuality "fair" (there is no photo) and give a range.` }],
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('The photo could not be analysed. Try another photo or search manually.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No result from the recognition service.');
  return sanitize(JSON.parse(text.text) as RawResult);
}

/** Defensive cleanup of the model output before it reaches the UI. */
type RawItem = Omit<RecognizedItem, 'method' | 'size' | 'gramsLow' | 'gramsHigh' | 'hidden'> & Partial<Pick<RecognizedItem, 'method' | 'size' | 'gramsLow' | 'gramsHigh' | 'hidden'>>;
type RawResult = Omit<RecognitionResult, 'photoQuality' | 'items'> & { photoQuality?: string; items: RawItem[] };

export function sanitize(raw: RawResult): RecognitionResult {
  const items = (raw.items ?? []).slice(0, 14).map((i) => ({
    ...i,
    name: String(i.name ?? '').slice(0, 80),
    localName: String(i.localName ?? '').slice(0, 80),
    cuisine: String(i.cuisine ?? '').slice(0, 40),
    searchQueries: (i.searchQueries ?? []).map((q) => String(q).slice(0, 60)).filter(Boolean).slice(0, 4),
    estimatedGrams: Number.isFinite(i.estimatedGrams) ? Math.max(0, Math.min(2000, Math.round(i.estimatedGrams))) : 0,
    method: i.method && (COOKING_METHODS as readonly string[]).includes(i.method) ? i.method : ('none' as CookingMethod),
    size: i.size && (['small', 'medium', 'large'] as const).includes(i.size) ? i.size : ('medium' as const),
    ...range(i),
    hidden: (Array.isArray(i.hidden) ? i.hidden : []).slice(0, 3).map((h) => {
      const g = (v: unknown) => (Number.isFinite(v) ? Math.max(0, Math.min(200, Math.round(v as number))) : 0);
      const little = g(h?.little), usual = Math.max(little, g(h?.usual)), lot = Math.max(usual, g(h?.lot));
      return { name: String(h?.name ?? '').slice(0, 40), searchQueries: (h?.searchQueries ?? []).map((q) => String(q).slice(0, 60)).filter(Boolean).slice(0, 3), little, usual, lot };
    }).filter((h) => h.name && h.usual > 0),
    ingredients: (i.ingredients ?? []).slice(0, 10).map((g) => ({
      name: String(g.name ?? '').slice(0, 60),
      searchQueries: (g.searchQueries ?? []).map((q) => String(q).slice(0, 60)).filter(Boolean).slice(0, 3),
      state: (['raw', 'cooked', 'dry', 'na'] as const).includes(g.state) ? g.state : 'na',
      visible: g.visible !== false,
    })).filter((g) => g.name),
  }));
  const photoQuality: RecognitionResult['photoQuality'] = raw.photoQuality === 'good' || raw.photoQuality === 'poor' ? raw.photoQuality : 'fair';
  return { isFood: !!raw.isFood, photoQuality, items, note: String(raw.note ?? '').slice(0, 200) };
}

/** A sane weight range around the estimate (low ≤ estimate ≤ high). */
function range(i: Partial<RawItem>): { gramsLow: number; gramsHigh: number } {
  const g = Number.isFinite(i.estimatedGrams) ? Math.max(0, Math.min(2000, Math.round(i.estimatedGrams!))) : 0;
  if (!g) return { gramsLow: 0, gramsHigh: 0 };
  const lo = Number.isFinite(i.gramsLow) ? Math.round(i.gramsLow!) : Math.round(g * 0.75);
  const hi = Number.isFinite(i.gramsHigh) ? Math.round(i.gramsHigh!) : Math.round(g * 1.3);
  return { gramsLow: Math.max(1, Math.min(lo, g)), gramsHigh: Math.min(3000, Math.max(hi, g)) };
}
