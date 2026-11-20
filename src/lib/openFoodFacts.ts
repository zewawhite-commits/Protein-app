/**
 * Open Food Facts — open, worldwide database of packaged products (label data,
 * community-contributed, ODbL licence). Used live for branded products not in the
 * bundled databases. Products without a protein-per-100 g value are skipped.
 */
import type { Food } from './types';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,generic_name,brands,quantity,serving_size,serving_quantity,categories_tags,nutriments';

interface OffProduct {
  code: string;
  product_name?: string;
  generic_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  categories_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
}

const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : null;
};

const mg = (v: unknown) => { const x = n(v); return x == null ? null : Math.round(Number(v) * 1e5) / 100; };
const ug = (v: unknown) => { const x = n(v); return x == null ? null : Math.round(Number(v) * 1e8) / 100; };

export function offToFood(p: OffProduct): Food | null {
  const nu = p.nutriments ?? {};
  const protein = n(nu.proteins_100g);
  const name = (p.product_name || p.generic_name || '').trim();
  if (protein == null || protein > 100 || !name) return null;
  const brand = (p.brands ?? '').split(',')[0].trim();
  const serving = n(p.serving_quantity);
  return {
    id: `off:${p.code}`,
    ref: p.code,
    name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name}, ${brand}` : name,
    category: 'Packaged product',
    state: 'na',
    per100: {
      protein, kcal: n(nu['energy-kcal_100g']), fat: n(nu.fat_100g), carbs: n(nu.carbohydrates_100g), fiber: n(nu.fiber_100g),
      // Label values: grams in Open Food Facts; minerals/vitamins converted to mg / µg.
      sugar: n(nu.sugars_100g), addedSugar: n(nu['added-sugars_100g']), satFat: n(nu['saturated-fat_100g']),
      cholesterol: mg(nu.cholesterol_100g), sodium: mg(nu.sodium_100g), potassium: mg(nu.potassium_100g),
      calcium: mg(nu.calcium_100g), iron: mg(nu.iron_100g), magnesium: mg(nu.magnesium_100g), zinc: mg(nu.zinc_100g),
      vitA: ug(nu['vitamin-a_100g']), vitC: mg(nu['vitamin-c_100g']), vitD: ug(nu['vitamin-d_100g']), vitB12: ug(nu['vitamin-b12_100g']), folate: ug(nu.folates_100g),
    },
    portions: serving ? [{ label: p.serving_size ? `1 serving (${p.serving_size})` : '1 serving', grams: serving }] : [],
    source: 'off',
  };
}

export async function searchProducts(query: string, signal?: AbortSignal): Promise<Food[]> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24&fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(res.status === 503 ? 'Product search is busy — try again shortly.' : `Product search failed (${res.status}).`);
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? []).map(offToFood).filter((f): f is Food => !!f);
}

export async function productByBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { product?: OffProduct };
  return data.product ? offToFood({ ...data.product, code }) : null;
}
