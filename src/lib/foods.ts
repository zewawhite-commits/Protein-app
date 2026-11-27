import { EXTRA_KEYS, knownAddedSugar } from './nutrients';
import { isAlcoholic } from './alcohol';
/**
 * Food database: loads public/data/foods.json (USDA SR Legacy + USDA FNDDS +
 * FAO/INFOODS West Africa, built by scripts/build-foods.mjs) and merges custom
 * records. Search is local and offline.
 */
import type { CustomFood, Food, FoodSource, PrepState } from './types';

type SourceCode = 's' | 'f' | 'w' | 'u' | 'a' | 'r';
interface SourceInfo { name: string; release: string; citation: string }

interface FoodsFile {
  version: number;
  /** Reviewed notes on foods whose published values need a caveat (scripts/corrections.json). */
  checkNotes?: Record<string, string>;
  sources: Record<SourceCode, SourceInfo>;
  basis: string;
  generatedAt: string;
  categories: Record<string, string>;
  quickPicks: number[];
  /** Merged twins: "s:123" → "f:456" (source letter : key). */
  redirects?: Record<string, string>;
  foods: [number | string, string, number, PrepState, number, number | null, number | null, number | null, number | null, [string, number][], SourceCode, (number | null)[]?, string?][];
}

export interface FoodDb {
  foods: Food[];
  byId: Map<string, Food>;
  quickPicks: Food[];
  sources: SourceInfo[];
  categories: string[];
}

const SOURCE_OF: Record<SourceCode, FoodSource> = { s: 'usda-sr', f: 'usda-fndds', w: 'fao-wafct', u: 'uk-cofid', a: 'au-afcd', r: 'recipe' };
const ID_PREFIX: Record<SourceCode, string> = { s: 'usda', f: 'usda', w: 'wafct', u: 'cofid', a: 'afcd', r: 'recipe' };

/** Human-readable source line and link for a record. */
/** How trustworthy a food's numbers are, in plain words, plus how many nutrients the source doesn't list. */
export function dataQuality(food: Pick<Food, 'source' | 'per100'>): { level: 'measured' | 'calculated' | 'label' | 'yours'; text: string; missing: number } {
  const keys = ['kcal', 'carbs', 'fat', 'fiber', 'sugar', 'satFat', 'sodium', 'potassium', 'calcium', 'iron', 'magnesium', 'zinc', 'vitA', 'vitC', 'vitD', 'vitB12', 'folate'] as const;
  const missing = keys.filter((k) => (food.per100 as unknown as Record<string, number | null | undefined>)[k] == null).length;
  switch (food.source) {
    case 'recipe': return { level: 'calculated', text: 'Calculated from a standard recipe — home versions vary, especially oil', missing };
    case 'off': return { level: 'label', text: 'From the pack label (Open Food Facts) — check it matches yours', missing };
    case 'custom': return { level: 'yours', text: 'Your own numbers', missing };
    default: return { level: 'measured', text: 'From an official food composition table', missing };
  }
}

export function sourceInfo(food: Pick<Food, 'source' | 'fdcId' | 'ref' | 'sourceNote'>): { label: string; url?: string } {
  switch (food.source) {
    case 'usda-sr': return { label: `USDA SR Legacy · FDC ${food.fdcId}`, url: fdcUrl(food.fdcId!) };
    case 'usda-fndds': return { label: `USDA FNDDS · FDC ${food.fdcId}`, url: fdcUrl(food.fdcId!) };
    case 'fao-wafct': return { label: `FAO/INFOODS West Africa 2019 · ${food.ref}`, url: 'https://www.fao.org/infoods/infoods/tables-and-databases/faoinfoods-databases/en/' };
    case 'uk-cofid': return { label: `UK CoFID 2021 (McCance & Widdowson) · ${food.ref}`, url: 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid' };
    case 'au-afcd': return { label: `Australian Food Composition Database · ${food.ref}`, url: 'https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd' };
    case 'recipe': return { label: `Standard recipe from USDA/FAO ingredients · ${food.sourceNote ?? ''}` };
    case 'off': return { label: `Open Food Facts · ${food.ref} (product label)`, url: `https://world.openfoodfacts.org/product/${food.ref}` };
    default: return { label: `Custom · ${food.sourceNote ?? ''}` };
  }
}

export const SOURCE_SHORT: Record<FoodSource, string> = {
  'usda-sr': 'US', 'usda-fndds': 'US', 'fao-wafct': 'West Africa', 'uk-cofid': 'UK', 'au-afcd': 'Australia', recipe: 'Standard recipe', off: 'Product', custom: 'Mine',
};

interface Indexed {
  food: Food;
  lower: string;
  words: string[];
  /** How many of `words` come from the name itself (the rest are other names / spellings). */
  nameWords: number;
}

let dbPromise: Promise<FoodDb> | null = null;
let index: Indexed[] = [];
let quickPickIds = new Set<string>();

/** Processed / prepared categories rank below whole foods for the same words. */
const PROCESSED_CATEGORIES = new Set([
  'Sausages and Luncheon Meats', 'Fast Foods', 'Restaurant Foods', 'Meals, Entrees, and Side Dishes', 'Snacks', 'Sweets', 'Baked Products',
]);
const GROUP_WORDS = new Set(['fish', 'crustaceans', 'mollusks', 'cereals', 'beverages', 'nuts', 'seeds', 'game', 'spices', 'snacks']);
const PROCESSED_WORDS = /\b(breaded|battered|tenders|nuggets|patties|roll|deli|luncheon|canned|frozen|sliced|nugget|salad|includes foods for usda)\b/;

let loadedById: Map<string, Food> | undefined;
/** A database food by id, once the database has loaded. */
/** Records merged into an identical twin keep working through this (old id → kept id). */
let redirectIds: Map<string, string> | null = null;
/** Every database food (after load). */
export const allFoods = (): Food[] => (loadedById ? [...loadedById.values()] : []);
export const foodById = (id: string): Food | undefined => loadedById?.get(id) ?? (redirectIds?.get(id) ? loadedById?.get(redirectIds.get(id)!) : undefined);

export function loadFoodDb(): Promise<FoodDb> {
  if (!dbPromise) {
    dbPromise = fetch(`${import.meta.env.BASE_URL}data/foods.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load food database (${r.status})`);
        return r.json() as Promise<FoodsFile>;
      })
      .then((file) => {
        const foods: Food[] = file.foods.filter((r) => !isAlcoholic(r[1], file.categories[r[2]])).map(([key, name, cat, state, protein, kcal, fat, carbs, fiber, portions, src, extra, note]) => {
          const usda = src === 's' || src === 'f';
          // Recipe rows carry their other names in brackets: "Egusi soup (egushi, melon seed soup)".
          const m = src === 'r' ? /^(.*?) \((.*)\)$/.exec(name) : null;
          const category = file.categories[cat] ?? 'Other';
          const extras: Record<string, number | null> = extra ? Object.fromEntries(EXTRA_KEYS.map((k, i) => [k, extra[i] ?? null])) : {};
          const added = knownAddedSugar(name, category, extras.sugar, extras.addedSugar);
          return {
            id: `${ID_PREFIX[src]}:${key}`,
            fdcId: usda ? Number(key) : undefined,
            ref: usda ? undefined : String(key),
            name: m ? m[1] : name,
            ...(m && { aliases: m[2].split(', ') }),
            ...(note && { sourceNote: note }),
            category,
            state,
            per100: { protein, kcal, fat, carbs, fiber, ...extras, addedSugar: added },
            portions: portions.map(([label, grams]) => ({ label, grams })),
            source: SOURCE_OF[src],
            ...(file.checkNotes?.[`${src}:${key}`] && { checkNote: file.checkNotes[`${src}:${key}`] }),
          };
        });
        const byId = new Map(foods.map((f) => [f.id, f]));
        loadedById = byId;
        redirectIds = new Map(Object.entries(file.redirects ?? {}).map(([from, to]) => { const [fs, fk] = from.split(':'); const [ts, tk] = to.split(':'); return [`${ID_PREFIX[fs as SourceCode]}:${fk}`, `${ID_PREFIX[ts as SourceCode]}:${tk}`]; }));
        index = foods.map(toIndexed);
        quickPickIds = new Set(file.quickPicks.map((id) => `usda:${id}`));
        return {
          foods,
          byId,
          quickPicks: file.quickPicks.map((id) => byId.get(`usda:${id}`)!).filter(Boolean),
          sources: Object.values(file.sources),
          categories: [...new Set(Object.values(file.categories))],
        };
      })
      .catch((e) => {
        dbPromise = null;
        throw e;
      });
  }
  return dbPromise;
}

const tokenize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}%]+/gu, ' ').trim().split(/\s+/).filter(Boolean);

function toIndexed(food: Food): Indexed {
  const text = food.aliases?.length ? `${food.name} ${food.aliases.join(' ')}` : food.name;
  return { food, lower: food.name.toLowerCase(), words: tokenize(text), nameWords: tokenize(food.name).length };
}

/** Everyday words → the vocabulary USDA uses. */
const SYNONYMS: Record<string, string> = {
  chickpea: 'chickpeas', mince: 'ground', egushi: 'egusi', agushi: 'egusi', jolof: 'jollof', moin: 'moi', garri: 'gari', minced: 'ground', prawn: 'shrimp', prawns: 'shrimp',
  yoghurt: 'yogurt', courgette: 'squash', aubergine: 'eggplant', eggs: 'egg', oat: 'oats',
};

export interface SearchOptions {
  state?: PrepState | 'all';
  limit?: number;
  custom?: CustomFood[];
}

/** Word-prefix search; every query word must match the start of some word in the name. */
/** Local dish names → the name the food tables use (when the dish is already there under another name). */
const PHRASES: [RegExp, string][] = [
  [/\bbiltong\b/, 'beef jerky'], [/\bboerewors\b/, 'sausage pork and beef'], [/\bnyama choma\b/, 'goat roasted'],
  [/\blechon\b/, 'pork roasted'], [/\blumpia\b/, 'spring roll'], [/\bdim sum\b/, 'dumpling'], [/\bfried noodles\b/, 'chow mein'],
  [/\b(dodo|alloco|maduros|platanos)\b/, 'plantain cooked with oil'], [/\bofada rice\b/, 'rice brown'],
  [/\bchips\b(?! and)/, 'french fries'], [/\bcrisps\b/, 'potato chips'], [/\baubergine\b/, 'eggplant'], [/\bcoriander\b/, 'cilantro'],
  [/\b(agbalumo|udara|alasa)\b/, 'african star apple'], [/\bgarden eggs?\b/, 'eggplant fruit raw'], [/\bkilishi\b/, 'beef jerky'],
  [/\bsmall chops\b/, 'puff puff'], [/\bpawpaw\b/, 'papaya'], [/\bgroundnuts?\b(?! (soup|flour|oil))/, 'peanuts'], [/\bbambara nuts?\b/, 'bambara groundnut'],
  [/\b(red |green |yellow |orange )?bell peppers?\b/, 'pepper sweet $1'], [/\bcapsicums?\b/, 'pepper sweet'], [/\bswede\b/, 'rutabaga'], [/\bgarbanzo\b/, 'chickpeas'], [/\brocket\b/, 'arugula'], [/\bspring onions?\b/, 'scallions'],
];

/** One-word everyday names that mean a specific food. */
const EXACT: Record<string, string> = { dodo: 'plantain cooked with oil', 'garden egg': 'eggplant fruit raw', 'garden eggs': 'eggplant fruit raw', toast: 'bread white toasted', steak: 'beef steak lean', mash: 'potato mashed', chips: 'french fries', eggs: 'egg whole cooked', rice: 'rice white cooked', pasta: 'pasta cooked', chicken: 'chicken breast', 'pepper soup': 'goat pepper soup', 'boiled rice': 'rice white cooked', 'white rice': 'rice white cooked', 'plain rice': 'rice white cooked', 'ofada rice': 'rice brown cooked', 'ofada': 'rice brown cooked', 'plantain': 'plantain cooked', 'boiled plantain': 'plantain boiled', 'fried plantain': 'plantain cooked with oil' };

/**
 * How it was cooked changes the numbers, so these phrases go straight to the matching record
 * (found in the audit: "fried egg" used to find fried eggplant, "porridge" dry oats, "uncooked pasta" fresh pasta).
 */
const COOKED: [RegExp, string][] = [
  [/^(fried eggs?|eggs? fried)$/, 'egg whole cooked fried'],
  [/^(scrambled eggs?|eggs? scrambled)$/, 'egg whole cooked scrambled'],
  [/^(poached eggs?|eggs? poached)$/, 'egg whole cooked poached'],
  [/^(boiled|stewed) chicken$|^chicken (boiled|stewed)$/, 'chicken breast meat only cooked stewed'],
  // Plain cooked pieces first; coated, fast-food and frozen-meal versions come after.
  [/^(chicken )?drumsticks?( chicken)?$/, 'chicken drumstick baked broiled or roasted skin eaten from raw'],
  [/^(chicken )?thighs?( chicken)?$/, 'chicken thigh baked broiled or roasted skin eaten from raw'],
  [/^(fried chicken|chicken fried|deep fried chicken|fried drumsticks?|fried chicken drumsticks?)$/, 'chicken drumstick fried coated skin coating eaten from raw'],
  [/^(fried chicken thighs?|fried thighs?)$/, 'chicken thigh fried coated skin coating eaten from raw'],
  [/^(fried chicken wings?|fried wings?)$/, 'chicken wing fried coated from raw'],
  [/^(grilled|roast(ed)?|baked) (chicken )?drumsticks?$/, 'chicken drumstick baked broiled or roasted skin eaten from raw'],
  [/^(chicken )?legs?( chicken)?$|^chicken leg quarters?$/, 'chicken leg drumstick and thigh baked or broiled skin eaten'],
  [/^(chicken )?wings?( chicken)?$/, 'chicken wing baked broiled or roasted from raw'],
  [/^(grilled|roast|roasted|baked) chicken( breast)?$|^chicken (breast )?(grilled|roasted|baked)$/, 'chicken broilers or fryers breast meat only cooked roasted'],
  [/^(porridge|oat porridge|porridge oats|oatmeal|cooked oats|oats cooked|cooked oatmeal|oatmeal cooked|quaker oats)$/, 'oats cooked with water'],
  [/^(fried potato(es)?|potato(es)? fried|fried irish potato(es)?|chips)$/, 'french fries'],
  [/^(uncooked|raw|dry|dried) (pasta|spaghetti|macaroni|noodles)$|^(pasta|spaghetti|macaroni) (uncooked|raw|dry)$/, 'pasta dry enriched'],
  [/^(uncooked|raw|dry) (white )?rice$|^rice (uncooked|raw|dry)$/, 'rice white long grain raw'],
  [/^(uncooked|raw|dry) brown rice$/, 'rice brown long grain raw'],
  [/^(uncooked|raw|dry) (rolled )?oats$|^oats (uncooked|raw|dry)$/, 'oats raw'],
  [/^(uncooked|raw|dry|dried) (beans|cowpeas|black[- ]eyed (beans|peas))$/, 'cowpeas common mature seeds raw'],
  [/^(beans|cooked beans|boiled beans|brown beans|black[- ]eyed (beans|peas)|ewa)$/, 'cowpeas common mature seeds cooked boiled'],
  [/^(pap|akamu|ogi|koko)$/, 'ogi'],
  [/^stockfish$|^panla$/, 'fish cod dried salted'],
  [/^titus( fish)?$/, 'mackerel'],
  // Everyday Nigerian names that otherwise land on a different food.
  [/^(stew|tomato stew|red stew|obe ata|nigerian stew)$/, 'nigerian stew'],
  [/^(yam|boiled yam)$/, 'yam boiled'],
  [/^(bread|agege bread|agege|sliced bread)$/, 'bread white'],
  [/^(spaghetti|macaroni|boiled spaghetti|cooked spaghetti)$/, 'pasta cooked'],
  [/^(coke|coca[- ]cola|pepsi|cola)$/, 'soft drink cola'],
  [/^(sprite|7 ?up|seven up|lemon lime soda)$/, 'lemon lime soda'],
  [/^(fanta|orange soda|orange fizzy drink)$/, 'beverages carbonated orange'],
  [/^(pizza )?margherita( pizza)?$/, 'pizza cheese tomato'],
  [/^(malt|maltina|malta|amstel malta|malt drink)$/, 'malt beverage non alcoholic'],
  [/^gala( sausage roll)?$/, 'sausage roll'],
  [/^(shaki|tripe|assorted|assorted meat|roundabout)$/, 'beef tripe cooked'],
  [/^chicken suya$/, 'chicken thigh grilled without sauce skin eaten'],
  [/^peppered chicken$/, 'chicken thigh stewed skin eaten'],
  [/^(fish|catfish) pepper ?soup$/, 'ofe nsala'],
  [/^goat( meat)? pepper ?soup$/, 'goat pepper soup'],
  // Everyday words the voice sweep found landing on an odd record (docs/voice-sweep.md).
  [/^(burgers?|hamburgers?|beef burgers?)$/, 'hamburger nfs'],
  [/^(crisps|potato crisps|potato chips|packet of crisps)$/, 'potato chips nfs'],
  [/^cheese$/, 'cheese nfs'],
  [/^(chicken wings?|wings)$/, 'chicken wing baked broiled roasted from raw'],
  [/^(chocolate|chocolate bar|milk chocolate|bar of chocolate)$/, 'candies milk chocolate'],
  [/^(tuna|canned tuna|tinned tuna|tuna in water)$/, 'tuna light canned water drained solids'],
  [/^(salad|green salad|side salad|garden salad)$/, 'lettuce salad assorted vegetables including tomatoes carrots no dressing'],
  [/^(omelett?e|omelet|plain omelett?e)$/, 'egg omelet scrambled egg made with butter'],
  [/^(pancakes?)$/, 'pancakes plain'],
  [/^(bacon|bacon rashers?|streaky bacon)$/, 'pork cured bacon cooked baked'],
  [/^(chicken noodle soup)$/, 'soup chicken noodle'],
  [/^(french fries|fries)$/, 'potato french fries nfs'],
  [/^(cereal|breakfast cereal|cornflakes|corn flakes)$/, 'cereal corn flakes plain'],
  [/^(dumplings?)$/, 'wonton dumpling pot sticker fried'],
];

export function searchFoods(query: string, opts: SearchOptions = {}): Food[] {
  const q0 = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const cooked = COOKED.find(([re]) => re.test(q0))?.[1];
  // Alternatives from the words as said, but only real ones ("fanta" must not offer fufu via a typo fix).
  if (cooked) { const hit = searchWith(cooked, opts); if (hit.length) return [...hit, ...searchWith(query, opts).filter((f) => !hit.some((h) => h.id === f.id) && matchIsConfident(query, f, true))].slice(0, opts.limit ?? 60); }
  const exact = EXACT[query.trim().toLowerCase()];
  if (exact) { const hit = searchWith(exact, opts); if (hit.length) return [...hit, ...searchWith(query, opts).filter((f) => !hit.some((h) => h.id === f.id))].slice(0, opts.limit ?? 60); }
  const direct = searchWith(query, opts);
  if (direct.length) return direct;
  let alt = query.toLowerCase();
  for (const [re, to] of PHRASES) alt = alt.replace(re, to);
  if (alt !== query.toLowerCase()) { const hit = searchWith(alt, opts); if (hit.length) return hit; }
  // "jollof rice with chicken": find the main food, then the rest can be added separately.
  const main = query.toLowerCase().split(/\s+(?:with|and|plus|\+|&)\s+/)[0];
  // Nothing found stays nothing: dropping words guessed wrong foods ("butter tart" → butter).
  return main !== query.toLowerCase() ? searchFoods(main, opts) : [];
}

function searchWith(query: string, opts: SearchOptions): Food[] {
  // "gooseberry" should find "Gooseberries": search the shared stem.
  const terms = tokenize(query).map((t) => SYNONYMS[t] ?? (/berry$/.test(t) ? t.slice(0, -1) : t));
  if (!terms.length) return [];
  const found = searchTerms(terms, opts);
  if (found.length) return found;
  // Nothing matched: allow for spelling slips ("egushi", "chiken", "brocoli").
  const fixed = terms.map(closestWord);
  return fixed.some((t, i) => t !== terms[i]) ? searchTerms(fixed, opts) : [];
}

let vocab: string[] | null = null;
function closestWord(t: string): string {
  if (t.length < 4) return t;
  vocab ??= [...new Set(index.flatMap((it) => it.words))].filter((w) => w.length >= 3);
  const max = t.length >= 7 ? 2 : 1;
  let best = t;
  let bestD = max + 1;
  for (const w of vocab) {
    if (Math.abs(w.length - t.length) > max) continue;
    const d = editDistance(t, w, bestD);
    if (d < bestD || (d === bestD && best !== t && w.length < best.length)) { best = w; bestD = d; }
  }
  return bestD <= max ? best : t;
}

/** Levenshtein distance, giving up early once it can't beat `cap`. */
export function editDistance(a: string, b: string, cap = Infinity): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > cap) return rowMin;
    prev = cur;
  }
  return prev[b.length];
}

const EATEN_COOKED = /\b(chicken|beef|goat|lamb|mutton|pork|turkey|veal|fish|tilapia|catfish|mackerel|salmon|cod|tuna|shrimp|prawns?|meat|liver|gizzard|kidney beans|cowpeas|lentils|chickpeas|rice|pasta|spaghetti|macaroni|noodles|yam|cassava|cocoyam)\b/;

function searchTerms(terms: string[], opts: SearchOptions): Food[] {
  const { state = 'all', limit = 60, custom = [] } = opts;
  const pool: Indexed[] = [...custom.filter((c) => !c.archived).map(toIndexed), ...index];
  const phrase = terms.join(' ');
  const wantsRaw = terms.some((t) => /^(raw|uncooked|dry|dried|fresh|uncook)/.test(t));
  const scored: { f: Food; s: number }[] = [];
  for (const it of pool) {
    if (state !== 'all' && it.food.state !== state) continue;
    let score = 0;
    let ok = true;
    let firstPos = -1;
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i];
      const pos = it.words.findIndex((w) => w.startsWith(t) || (t.length > 3 && w.startsWith(t.replace(/s$/, ''))));
      if (pos === -1) { ok = false; break; }
      if (i === 0) firstPos = pos;
      // Earlier matches are more relevant; the first word is the food's main name in USDA naming.
      // USDA prefixes many foods with a group word ("Fish, salmon…"); treat the word after it as the main name.
      const lead = pos === 0 || (pos === 1 && GROUP_WORDS.has(it.words[0]));
      score += lead ? 30 : Math.max(0, 12 - pos);
      if (it.words[pos] === t) score += 6;
    }
    if (!ok) continue;
    score -= it.words.length * 0.4; // prefer plainer descriptions
    if (it.food.source === 'custom') score += 8;
    if (quickPickIds.has(it.food.id)) score += 14;
    // A dish people ask for by name ("jollof rice", "moin moin") — not when the word is incidental ("toast" in beans on toast).
    if (it.food.source === 'recipe' && (firstPos === 0 || firstPos >= it.nameWords)) score += 12;
    // The exact phrase appears in the name ("sesame seeds" → "Seeds, sesame seeds, whole", not sesame paste).
    if (terms.length > 1 && it.lower.includes(phrase)) score += 10;
    // Food tables name things the other way round: "brown rice" is "Rice, brown", "whole milk" is "Milk, whole".
    // The food's name is exactly what was typed: best of all.
    if (it.lower === phrase || (it.food.source === 'recipe' && it.lower.startsWith(`${phrase} (`))) score += 20;
    // Equally good matches: prefer the one people can measure in servings (spoons, cups, slices).
    if (it.food.portions.length) score += 2;
    if (terms.length === 2 && new RegExp(`^${terms[1]}s?, ${terms[0]}\\b`).test(it.lower)) score += 16;
    // One plain word ("carrot", "tomato", "onion"): the ingredient itself before juices, dips and sauces made from it.
    if (terms.length === 1) {
      const t = terms[0].replace(/(es|s)$/, '');
      if (new RegExp(`^${t}(es|s)?(,|$)`).test(it.lower)) {
        score += 8;
        // The everyday form: fresh/raw produce, or the generic record; not dried, pickled or powdered.
        if (/\b(dried|dehydrated|pickled|powder|sundried|sun-dried|canned|frozen|freeze-dried|flakes|concentrate|green)\b/.test(it.lower)) score -= 5;
        else if (!EATEN_COOKED.test(it.lower) && (/, (raw|fresh|nfs)\b/.test(it.lower) || /\b(raw|nfs)$/.test(it.lower))) score += 3;
      }
      if (new RegExp(`^${t}(es|s)? (juice|dip|sauce|soup|chips|flour|powder|paste|rings|cake|pie|bread|oil|salad|casserole|pudding|patty|ketchup|puree|drink|flavou?red)\\b`).test(it.lower)) score -= 6;
    }
    // Meat-free versions only when asked for ("bacon" is bacon).
    if (/\b(meatless|imitation|substitute|meat-free|soy-based)\b/.test(it.lower) && !terms.some((t) => /^(meatless|imitation|substitute|vegetarian|vegan|soy|plant)/.test(t))) score -= 12;
    if (PROCESSED_CATEGORIES.has(it.food.category)) score -= 10;
    if (PROCESSED_WORDS.test(it.lower)) score -= 5;
    // Ready meals ("…with potatoes, vegetable, frozen meal") only when asked for.
    if (/\b(frozen meal|tv dinner|frozen dinner|frozen entree|meals, entrees)\b/.test(it.lower) && !terms.some((t) => /^(frozen|meal|dinner|entree|tv)/.test(t))) score -= 15;
    if (/\b(meat only|skinless|boneless|lean)\b/.test(it.lower)) score += 3;
    // Meat, fish, grains and beans are eaten cooked: a raw record would understate a cooked portion.
    if (!wantsRaw && (it.food.state === 'raw' || it.food.state === 'dry') && EATEN_COOKED.test(it.lower)) score -= 8;
    scored.push({ f: it.food, s: score });
  }
  scored.sort((a, b) => b.s - a.s || a.f.name.length - b.f.name.length);
  return scored.slice(0, limit).map((x) => x.f);
}

/**
 * For a raw/dry record, find the matching cooked records (and vice versa) so the user
 * can log the state they actually weighed. Matches on the description up to the state word.
 */
export function counterparts(food: Food, all: Food[]): Food[] {
  if (food.state === 'na') return [];
  const m = food.name.match(/^(.*?),\s*(raw|cooked|dry|uncooked|unprepared)\b/i);
  const base = (m ? m[1] : food.name.split(',').slice(0, 2).join(',')).toLowerCase();
  const want: PrepState[] = food.state === 'cooked' ? ['raw', 'dry'] : ['cooked'];
  return all
    .filter((f) => f.id !== food.id && want.includes(f.state) && f.name.toLowerCase().startsWith(base))
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, 6);
}

/**
 * Swaps for a food you don't have: everyday foods (the quick picks and world dishes) with
 * a similar amount of protein and calories per 100 g, in the same state (cooked/raw).
 * The caller filters by diet and avoid list.
 */
export function similarFoods(food: Food, pool: Food[], max = 4): Food[] {
  const p = food.per100.protein, k = food.per100.kcal;
  if (k == null || k <= 0) return [];
  const base = food.name.split(',')[0].split(' (')[0].toLowerCase();
  const score = (f: Food) => {
    const fk = f.per100.kcal ?? 0;
    return Math.abs(f.per100.protein - p) / Math.max(p, 5) + Math.abs(fk - k) / k;
  };
  const seen = new Set<string>();
  return pool
    .filter((f) => f.id !== food.id && f.per100.kcal != null && (food.state === 'na' || f.state === food.state || f.state === 'na'))
    .filter((f) => !f.name.toLowerCase().startsWith(base))
    .filter((f) => Math.abs(f.per100.protein - p) <= Math.max(4, p * 0.35) && Math.abs((f.per100.kcal ?? 0) - k) <= Math.max(40, k * 0.35))
    .sort((a, b) => score(a) - score(b))
    .filter((f) => { const b = f.name.split(',')[0].split(' (')[0].toLowerCase(); if (seen.has(b)) return false; seen.add(b); return true; })
    .slice(0, max);
}

/** The same food listed by several national tables ("Onions, raw" in USDA, UK and Australia). */
export interface FoodGroup { food: Food; others: Food[]; conflict: boolean }

const dupKey = (f: Food) => `${f.state}|${f.name.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[*]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()}`;

/**
 * Group search results that are the same food from different sources, keeping the
 * best-ranked one in front. `conflict` = their calories per 100 g differ by more than 15%,
 * which usually means different varieties or methods — worth a look before choosing.
 */
export function groupDuplicates(list: Food[]): FoodGroup[] {
  const groups = new Map<string, FoodGroup>();
  const out: FoodGroup[] = [];
  for (const f of list) {
    const k = f.source === 'custom' || f.source === 'off' ? f.id : dupKey(f);
    const g = groups.get(k);
    if (g) g.others.push(f);
    else { const n = { food: f, others: [], conflict: false }; groups.set(k, n); out.push(n); }
  }
  for (const g of out) {
    const kc = [g.food, ...g.others].map((x) => x.per100.kcal).filter((v): v is number => v != null && v > 0);
    g.conflict = kc.length > 1 && Math.max(...kc) / Math.min(...kc) > 1.15;
  }
  return out;
}

/** Has the core numbers (calories, protein, carbs, fat, fibre). */
export const hasCoreNutrition = (f: Food) => f.per100.kcal != null && f.per100.carbs != null && f.per100.fat != null && f.per100.fiber != null;

export const STATE_LABEL: Record<PrepState, string> = {
  raw: 'Raw',
  cooked: 'Cooked',
  dry: 'Dry / uncooked',
  na: 'As sold',
};

/** Segments of USDA descriptions that add no meaning for a person logging food. */
const FILLER = /^(broilers? or fryers|broiler|all classes|mature seeds|regular|enriched|unenriched|without salt|with salt|without added salt|not fortified|year round average|all grades|separable lean and fat|separable lean only|trimmed to 0" fat|trimmed to 1\/8" fat|choice|select|prime|fresh|Includes foods for USDA's Food Distribution Program)$/i;
/** Group words USDA puts first ("Fish, salmon…"); dropped when the next segment names the food. */
const GROUP_PREFIX = /^(fish|crustaceans|mollusks|cereals|beverages|nuts|seeds|spices|snacks|game meat)$/i;
/** Preparation segments — shown next to the raw/cooked badge instead of in the title. */
const PREP = /\b(raw|cooked|uncooked|dry|roasted|boiled|baked|grilled|broiled|fried|pan-fried|pan-browned|braised|stewed|steamed|simmered|microwaved|poached|scrambled|toasted|heated|rotisserie|blanched|dry heat|moist heat|drained|unprepared|prepared)\b/i;

/**
 * Turn a USDA description into a short title and a detail line, e.g.
 * "Chicken, broilers or fryers, breast, meat only, cooked, roasted"
 *   → { title: "Chicken breast, meat only", detail: "roasted", prep: "cooked, roasted" }
 */
export function splitName(name: string): { title: string; detail: string } {
  const clean = name
    .replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/i, '')
    .replace(/\*/g, '') // FAO marks recipe-calculated foods with *
    .replace(/,\s*n=\d+$/i, ''); // FAO sample counts
  let parts = clean.split(/,\s*/).filter((p) => p && !FILLER.test(p));
  if (parts.length > 1 && GROUP_PREFIX.test(parts[0])) parts = parts.slice(1);
  const core = parts.filter((p) => !PREP.test(p));
  const prep = parts.filter((p) => PREP.test(p) && !/^(raw|cooked|dry|uncooked)$/i.test(p));
  if (!core.length) return { title: cap(clean), detail: '' };
  // "Chicken" + "breast" reads better as "Chicken breast".
  let title = core[0];
  let rest = core.slice(1);
  // Only for one-word heads ("Chicken, breast"); multi-word heads are already natural ("Chicken thigh, skin eaten").
  if (rest.length && rest[0].split(' ').length <= 2 && !title.includes(' ') && !/\d|%|\(/.test(rest[0]) && !/^(with|and|in|on|or|without|from)\b/i.test(rest[0])) {
    const word = rest[0];
    const isPart = PART.test(word) || (/^egg$/i.test(title) && /^(white|yolk)$/i.test(word));
    // Cuts/parts follow the food ("Chicken breast"); descriptors lead it ("Greek yogurt", "White rice").
    title = isPart ? `${title} ${word.toLowerCase()}` : `${word} ${title.toLowerCase()}`;
    rest = rest.slice(1);
  }
  const extra = rest.slice(0, 2);
  return {
    title: cap([title, ...extra].join(', ')),
    detail: [...rest.slice(2), ...prep].join(', '),
  };
}

const PART = /^(breast|thigh|leg|wing|drumstick|back|neck|giblets|liver|heart|kidney|tongue|loin|tenderloin|sirloin|ribeye|rib|ribs|chuck|brisket|round|shank|shoulder|fillet|fillets|steak|chop|chops|ham|belly|flank|skirt)$/i;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fdcUrl = (fdcId: number) => `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`;

/**
 * The first search result that really contains every word of one of the queries
 * (whole words, allowing plurals; "cooked" also matches any cooked record). Used for
 * AI-suggested names, where a loose match (e.g. "moi" → "moisture") would be misleading.
 */
const OTHER_FORM = new Set(['bran', 'germ', 'leafy', 'leaves', 'leaf', 'tips', 'shoots', 'sprouted', 'sprouts', 'flour', 'meal', 'roll', 'loaf', 'powder', 'dehydrated', 'dried', 'canned', 'frozen', 'breaded', 'babyfood', 'luncheon', 'sticks']);

export function confidentMatch(queries: string[], opts: SearchOptions = {}): Food | undefined {
  const same = (w: string, t: string) => w === t || w === `${t}s` || w === `${t}es` || t === `${w}s` || SYNONYMS[t] === w || (t.endsWith('y') && w === `${t.slice(0, -1)}ies`);
  for (const q of queries) {
    const terms = tokenize(q).filter((t) => t.length > 1);
    if (!terms.length) continue;
    const hits = searchFoods(q, { ...opts, limit: 8 }).filter((f) => {
      const words = tokenize(f.name);
      return terms.every((t) => words.some((w) => same(w, t)) || (t === 'cooked' && f.state === 'cooked'));
    });
    // Skip records about a different part or product (leaves, flour, rolls…) unless the query asks for it.
    const hit = hits.find((f) => !tokenize(f.name).some((w) => OTHER_FORM.has(w) && !terms.includes(w)));
    if (hit) return hit;
  }
  return undefined;
}

/** The measured "weighed with bone(s)" record for this food, if the tables have one (UK CoFID, AU). */
export function boneInFood(_food: Food, queries: string[] | null): Food | null {
  for (const q of queries ?? []) {
    const hit = searchFoods(q, { limit: 20 }).find((f) => /with bones?\b/i.test(f.name));
    if (hit) return hit;
  }
  return null;
}

const STOP = new Set(['a', 'an', 'the', 'of', 'some', 'my', 'with', 'and', 'plain', 'fresh', 'homemade', 'nigerian', 'style', 'piece', 'pieces', 'plate', 'bowl', 'cup', 'glass']);
/**
 * Is this food really what was said? True when a known everyday name maps to it, or when every
 * word said (allowing plurals and one-letter slips) is in the food's name or other names.
 * False means: show alternatives and ask — never silently log something unrelated ("fanta" → fufu).
 */
export function matchIsConfident(said: string, food: Food, wordsOnly = false): boolean {
  const q = said.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!wordsOnly && (COOKED.some(([re]) => re.test(q)) || EXACT[q] || PHRASES.some(([re]) => re.test(q)))) return true;
  if (food.source === 'custom') return true;
  const words = tokenize(`${food.name} ${food.aliases?.join(' ') ?? ''}`);
  const asked = tokenize(q).map((t) => SYNONYMS[t] ?? t).filter((t) => !STOP.has(t) && !/^\d/.test(t));
  if (!asked.length) return true;
  const hit = (t: string) => words.some((w) => w.startsWith(t) || t.startsWith(w.replace(/s$/, '')) && w.length >= 4 || (t.length >= 5 && editDistance(t, w, 2) <= 1));
  const n = asked.filter(hit).length;
  return n === asked.length || (asked.length >= 3 && n >= asked.length - 1);
}