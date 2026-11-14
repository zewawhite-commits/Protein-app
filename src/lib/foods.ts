/**
 * Food database: loads public/data/foods.json (USDA SR Legacy + USDA FNDDS +
 * FAO/INFOODS West Africa, built by scripts/build-foods.mjs) and merges custom
 * records. Search is local and offline.
 */
import type { CustomFood, Food, FoodSource, PrepState } from './types';

type SourceCode = 's' | 'f' | 'w';
interface SourceInfo { name: string; release: string; citation: string }

interface FoodsFile {
  version: number;
  sources: Record<SourceCode, SourceInfo>;
  basis: string;
  generatedAt: string;
  categories: Record<string, string>;
  quickPicks: number[];
  foods: [number | string, string, number, PrepState, number, number | null, number | null, number | null, number | null, [string, number][], SourceCode][];
}

export interface FoodDb {
  foods: Food[];
  byId: Map<string, Food>;
  quickPicks: Food[];
  sources: SourceInfo[];
  categories: string[];
}

const SOURCE_OF: Record<SourceCode, FoodSource> = { s: 'usda-sr', f: 'usda-fndds', w: 'fao-wafct' };

/** Human-readable source line and link for a record. */
export function sourceInfo(food: Pick<Food, 'source' | 'fdcId' | 'ref' | 'sourceNote'>): { label: string; url?: string } {
  switch (food.source) {
    case 'usda-sr': return { label: `USDA SR Legacy · FDC ${food.fdcId}`, url: fdcUrl(food.fdcId!) };
    case 'usda-fndds': return { label: `USDA FNDDS · FDC ${food.fdcId}`, url: fdcUrl(food.fdcId!) };
    case 'fao-wafct': return { label: `FAO/INFOODS West Africa 2019 · ${food.ref}`, url: 'https://www.fao.org/infoods/infoods/tables-and-databases/faoinfoods-databases/en/' };
    case 'off': return { label: `Open Food Facts · ${food.ref} (product label)`, url: `https://world.openfoodfacts.org/product/${food.ref}` };
    default: return { label: `Custom · ${food.sourceNote ?? ''}` };
  }
}

export const SOURCE_SHORT: Record<FoodSource, string> = {
  'usda-sr': 'USDA', 'usda-fndds': 'USDA dish', 'fao-wafct': 'FAO W. Africa', off: 'Product', custom: 'Mine',
};

interface Indexed {
  food: Food;
  lower: string;
  words: string[];
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

export function loadFoodDb(): Promise<FoodDb> {
  if (!dbPromise) {
    dbPromise = fetch('/data/foods.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load food database (${r.status})`);
        return r.json() as Promise<FoodsFile>;
      })
      .then((file) => {
        const foods: Food[] = file.foods.map(([key, name, cat, state, protein, kcal, fat, carbs, fiber, portions, src]) => {
          const usda = src !== 'w';
          return {
            id: usda ? `usda:${key}` : `wafct:${key}`,
            fdcId: usda ? Number(key) : undefined,
            ref: usda ? undefined : String(key),
            name,
            category: file.categories[cat] ?? 'Other',
            state,
            per100: { protein, kcal, fat, carbs, fiber },
            portions: portions.map(([label, grams]) => ({ label, grams })),
            source: SOURCE_OF[src],
          };
        });
        const byId = new Map(foods.map((f) => [f.id, f]));
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
  return { food, lower: food.name.toLowerCase(), words: tokenize(food.name) };
}

/** Everyday words → the vocabulary USDA uses. */
const SYNONYMS: Record<string, string> = {
  chickpea: 'chickpeas', mince: 'ground', minced: 'ground', prawn: 'shrimp', prawns: 'shrimp',
  yoghurt: 'yogurt', porridge: 'oats', courgette: 'squash', aubergine: 'eggplant', eggs: 'egg', oat: 'oats',
};

export interface SearchOptions {
  state?: PrepState | 'all';
  limit?: number;
  custom?: CustomFood[];
}

/** Word-prefix search; every query word must match the start of some word in the name. */
export function searchFoods(query: string, opts: SearchOptions = {}): Food[] {
  const { state = 'all', limit = 60, custom = [] } = opts;
  const terms = tokenize(query).map((t) => SYNONYMS[t] ?? t);
  if (!terms.length) return [];
  const pool: Indexed[] = [...custom.filter((c) => !c.archived).map(toIndexed), ...index];
  const scored: { f: Food; s: number }[] = [];
  for (const it of pool) {
    if (state !== 'all' && it.food.state !== state) continue;
    let score = 0;
    let ok = true;
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i];
      const pos = it.words.findIndex((w) => w.startsWith(t) || (t.length > 3 && w.startsWith(t.replace(/s$/, ''))));
      if (pos === -1) { ok = false; break; }
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
    if (PROCESSED_CATEGORIES.has(it.food.category)) score -= 10;
    if (PROCESSED_WORDS.test(it.lower)) score -= 5;
    if (/\b(meat only|skinless|boneless|lean)\b/.test(it.lower)) score += 3;
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
  const clean = name.replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/i, '');
  let parts = clean.split(/,\s*/).filter((p) => p && !FILLER.test(p));
  if (parts.length > 1 && GROUP_PREFIX.test(parts[0])) parts = parts.slice(1);
  const core = parts.filter((p) => !PREP.test(p));
  const prep = parts.filter((p) => PREP.test(p) && !/^(raw|cooked|dry|uncooked)$/i.test(p));
  if (!core.length) return { title: cap(clean), detail: '' };
  // "Chicken" + "breast" reads better as "Chicken breast".
  let title = core[0];
  let rest = core.slice(1);
  if (rest.length && rest[0].split(' ').length <= 2 && title.split(' ').length <= 2 && !/\d|%|\(/.test(rest[0])) {
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
