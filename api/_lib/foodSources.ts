/**
 * External food sources for the unified search (GET /api/foods, routed to api/photos.ts because the
 * Vercel plan allows 12 functions). Results are normalised to the app's Food shape, labelled with
 * their source and how trustworthy they are, de-duplicated, and cached.
 *
 * Sources and their terms (see docs/food-database-architecture.md):
 *  - USDA FoodData Central: public domain (CC0). Needs a free api.data.gov key in USDA_API_KEY
 *    (1,000 requests/hour per key). Without one, DEMO_KEY is used, which is only good for testing.
 *  - Open Food Facts: Open Database Licence. Credit "Open Food Facts" wherever the data shows, send a
 *    User-Agent naming the app, stay under their rate limits (100 product reads/min). Products are
 *    kept in their own cache table, never merged into the curated database (share-alike).
 *  - FatSecret: not used. Its terms forbid keeping most data longer than 24 hours and require a paid
 *    plan for barcode lookups; see the evaluation in the docs before any contract.
 */

export type PrepState = 'raw' | 'cooked' | 'dry' | 'na';
export type ExtSource = 'usda-branded' | 'usda-foundation' | 'usda-sr' | 'usda-fndds' | 'off';
export type Kind = 'generic' | 'branded' | 'restaurant' | 'meal';

export interface ExtFood {
  id: string;
  fdcId?: number;
  ref?: string;
  name: string;
  brand?: string;
  barcode?: string;
  category: string;
  state: PrepState;
  /** How it was cooked, when the name says so (fried, grilled…). */
  method?: string;
  kind: Kind;
  per100: Record<string, number | null>;
  portions: { label: string; grams: number }[];
  source: ExtSource;
  sourceNote?: string;
}

export const USER_AGENT = 'NutiviliAI/1.0 (nutrition tracker; https://nutivili.ai)';

const r2 = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : null;
};

// ---------- preparation ----------
const METHODS: [RegExp, string, PrepState][] = [
  [/\b(deep[- ]?fried|pan[- ]?fried|stir[- ]?fried|fried|fritters?|battered)\b/i, 'fried', 'cooked'],
  [/\b(grilled|broiled|barbecued|bbq|char[- ]?grilled)\b/i, 'grilled', 'cooked'],
  [/\b(roasted|roast)\b/i, 'roasted', 'cooked'],
  [/\b(baked)\b/i, 'baked', 'cooked'],
  [/\b(boiled|simmered|poached)\b/i, 'boiled', 'cooked'],
  [/\b(steamed)\b/i, 'steamed', 'cooked'],
  [/\b(braised|stewed)\b/i, 'stewed', 'cooked'],
  [/\b(smoked)\b/i, 'smoked', 'cooked'],
  [/\b(sauteed|sautéed)\b/i, 'sautéed', 'cooked'],
  [/\b(microwaved)\b/i, 'microwaved', 'cooked'],
  [/\b(cooked|prepared|heated)\b/i, 'cooked', 'cooked'],
  [/\b(raw|uncooked|fresh)\b/i, 'raw', 'raw'],
  [/\b(dry|dried|dehydrated|powder(ed)?|flour|unprepared)\b/i, 'dry', 'dry'],
];
/** Raw / cooked / dry from the words in a name, plus the cooking method if one is named. */
export function preparation(name: string): { state: PrepState; method?: string } {
  for (const [re, method, state] of METHODS) if (re.test(name)) return { state, method: method === 'cooked' || method === 'raw' || method === 'dry' ? undefined : method };
  return { state: 'na' };
}

const RESTAURANT = /\b(mcdonald'?s|burger king|kfc|wendy'?s|subway|taco bell|pizza hut|domino'?s|starbucks|chick-fil-a|popeyes|chipotle|nando'?s|dunkin|tim hortons|arby'?s|sonic|panera|five guys|jollibee|chicken republic|mr bigg'?s|restaurant|fast foods?)\b/i;

// ---------- USDA FoodData Central ----------
// Nutrient numbers used by FoodData Central (per 100 g in search results).
const USDA_NUM: Record<string, string> = {
  '203': 'protein', '204': 'fat', '205': 'carbs', '208': 'kcal', '291': 'fiber', '269': 'sugar', '539': 'addedSugar', '606': 'satFat',
  '601': 'cholesterol', '307': 'sodium', '306': 'potassium', '301': 'calcium', '303': 'iron', '304': 'magnesium', '309': 'zinc',
  '320': 'vitA', '401': 'vitC', '328': 'vitD', '418': 'vitB12', '435': 'folate',
};
interface UsdaFood {
  fdcId: number; description: string; dataType: string; brandOwner?: string; brandName?: string; gtinUpc?: string;
  foodCategory?: string; servingSize?: number; servingSizeUnit?: string; householdServingFullText?: string;
  publishedDate?: string; foodNutrients?: { nutrientNumber?: string; value?: number; unitName?: string }[];
}
const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);

export function usdaToFood(u: UsdaFood): ExtFood | null {
  const per100: Record<string, number | null> = {};
  for (const n of u.foodNutrients ?? []) {
    const key = n.nutrientNumber && USDA_NUM[n.nutrientNumber];
    // Energy also appears in kJ under 268; only take kcal.
    if (key && !(key === 'kcal' && n.unitName && n.unitName.toLowerCase() !== 'kcal')) per100[key] = r2(n.value);
  }
  if (per100.protein == null || per100.protein > 100 || !u.description) return null;
  const source: ExtSource = u.dataType === 'Branded' ? 'usda-branded' : u.dataType === 'Foundation' ? 'usda-foundation' : u.dataType === 'SR Legacy' ? 'usda-sr' : 'usda-fndds';
  const brand = titleCase((u.brandName || u.brandOwner || '').trim());
  const name = titleCase(u.description.trim());
  const shown = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name}, ${brand}` : name;
  const portions: { label: string; grams: number }[] = [];
  if (u.servingSize && (u.servingSizeUnit ?? '').toLowerCase() === 'g') portions.push({ label: u.householdServingFullText ? `1 serving (${u.householdServingFullText})` : '1 serving', grams: r2(u.servingSize)! });
  const kind: Kind = RESTAURANT.test(`${brand} ${u.foodCategory ?? ''} ${name}`) ? 'restaurant' : source === 'usda-branded' ? 'branded' : source === 'usda-fndds' ? 'meal' : 'generic';
  return {
    id: `usda:${u.fdcId}`, fdcId: u.fdcId, name: shown, ...(brand && { brand }), ...(u.gtinUpc && { barcode: u.gtinUpc.replace(/^0+(?=\d{8})/, '') }),
    category: u.foodCategory || (source === 'usda-branded' ? 'Packaged product' : 'Food'), ...preparation(name), kind, per100, portions, source,
    ...(u.publishedDate && { sourceNote: `published ${u.publishedDate.slice(0, 7)}` }),
  };
}

/** The key as configured, without spaces, line breaks or quote marks that copying from an email can add. */
export const usdaKeyRaw = () => process.env.USDA_API_KEY ?? '';
const usdaKey = () => usdaKeyRaw().replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').replace(/\s+/g, '') || 'DEMO_KEY';
/** Setup check without revealing the key: is it set, how long, does it have stray characters. */
export function usdaKeyCheck(): string {
  const raw = usdaKeyRaw();
  if (!raw) return 'missing (using shared demo key)';
  const clean = usdaKey();
  return `set, ${clean.length} characters${clean.length !== raw.length ? ` (removed ${raw.length - clean.length} stray spaces/quotes)` : ''}${clean.length !== 40 ? ' — a USDA key is 40 characters' : ''}`;
}

export async function usdaSearch(query: string, page: number, pageSize: number, f: typeof fetch = fetch): Promise<{ foods: ExtFood[]; total: number }> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.search = new URLSearchParams({ api_key: usdaKey(), query, pageNumber: String(page), pageSize: String(pageSize), dataType: 'Branded,Foundation,Survey (FNDDS),SR Legacy' }).toString();
  const res = await f(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const d = (await res.json()) as { foods?: UsdaFood[]; totalHits?: number };
  return { foods: (d.foods ?? []).map(usdaToFood).filter((x): x is ExtFood => !!x), total: d.totalHits ?? 0 };
}

export async function usdaByBarcode(code: string, f: typeof fetch = fetch): Promise<ExtFood | null> {
  const { foods } = await usdaSearch(code, 1, 10, f).catch(() => ({ foods: [] as ExtFood[] }));
  const want = code.replace(/^0+/, '');
  return foods.find((x) => x.barcode && x.barcode.replace(/^0+/, '') === want) ?? null;
}

// ---------- Open Food Facts ----------
const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,generic_name,brands,serving_size,serving_quantity,categories_tags,nutriments,last_modified_t';
interface OffProduct { code: string; last_modified_t?: number; product_name?: string; generic_name?: string; brands?: string; serving_size?: string; serving_quantity?: number | string; categories_tags?: string[]; nutriments?: Record<string, number | string | undefined> }
const ALCOHOL_TAG = /alcoholic-beverages|beers|wines|spirits|ciders|liqueurs/;

export function offToFood(p: OffProduct): ExtFood | null {
  const nu = p.nutriments ?? {};
  const protein = r2(nu.proteins_100g);
  const name = (p.product_name || p.generic_name || '').trim();
  if (protein == null || protein > 100 || !name) return null;
  if ((p.categories_tags ?? []).some((t) => ALCOHOL_TAG.test(t) && !/non-alcoholic|alcohol-free/.test(t))) return null;
  const mg = (v: unknown) => { const x = r2(v); return x == null ? null : Math.round(Number(v) * 1e5) / 100; };
  const ug = (v: unknown) => { const x = r2(v); return x == null ? null : Math.round(Number(v) * 1e8) / 100; };
  const brand = (p.brands ?? '').split(',')[0].trim();
  const serving = r2(p.serving_quantity);
  return {
    id: `off:${p.code}`, ref: p.code, barcode: p.code, name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name}, ${brand}` : name, ...(brand && { brand }),
    category: 'Packaged product', ...preparation(name), kind: RESTAURANT.test(`${brand} ${name}`) ? 'restaurant' : 'branded',
    per100: {
      protein, kcal: r2(nu['energy-kcal_100g']), fat: r2(nu.fat_100g), carbs: r2(nu.carbohydrates_100g), fiber: r2(nu.fiber_100g),
      sugar: r2(nu.sugars_100g), addedSugar: r2(nu['added-sugars_100g']), satFat: r2(nu['saturated-fat_100g']),
      cholesterol: mg(nu.cholesterol_100g), sodium: mg(nu.sodium_100g), potassium: mg(nu.potassium_100g), calcium: mg(nu.calcium_100g), iron: mg(nu.iron_100g),
      magnesium: mg(nu.magnesium_100g), zinc: mg(nu.zinc_100g), vitA: ug(nu['vitamin-a_100g']), vitC: mg(nu['vitamin-c_100g']), vitD: ug(nu['vitamin-d_100g']),
      vitB12: ug(nu['vitamin-b12_100g']), folate: ug(nu.folates_100g),
    },
    portions: serving ? [{ label: p.serving_size ? `1 serving (${p.serving_size})` : '1 serving', grams: serving }] : [],
    source: 'off',
    ...(p.last_modified_t ? { sourceNote: `label data ${new Date(p.last_modified_t * 1000).toISOString().slice(0, 7)}` } : {}),
  };
}

export async function offSearch(query: string, page: number, pageSize: number, f: typeof fetch = fetch): Promise<{ foods: ExtFood[]; total: number }> {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=${pageSize}&fields=${OFF_FIELDS}`;
  const res = await f(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
  const d = (await res.json()) as { products?: OffProduct[]; count?: number };
  return { foods: (d.products ?? []).map(offToFood).filter((x): x is ExtFood => !!x), total: d.count ?? 0 };
}

export async function offByBarcode(code: string, f: typeof fetch = fetch): Promise<ExtFood | null> {
  const res = await f(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) return null;
  const d = (await res.json()) as { product?: OffProduct };
  return d.product ? offToFood({ ...d.product, code }) : null;
}

// ---------- merging ----------
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/**
 * One entry per real food: the same barcode from two sources, or the same name + brand with the
 * same energy (within 5 kcal), is one product. Raw, fried, grilled… stay separate (they're in the name).
 * USDA comes first when both have it (public-domain, lab or label values).
 */
export function dedupe(foods: ExtFood[]): ExtFood[] {
  const seen = new Set<string>();
  const out: ExtFood[] = [];
  for (const x of foods) {
    const keys = [x.barcode && `b:${x.barcode.replace(/^0+/, '')}`, `n:${norm(x.name)}|${x.per100.kcal == null ? '?' : Math.round(x.per100.kcal / 5)}`].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(x);
  }
  return out;
}

/** Interleave sources so the first page isn't all one database. */
export function interleave(a: ExtFood[], b: ExtFood[]): ExtFood[] {
  const out: ExtFood[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
  return out;
}
