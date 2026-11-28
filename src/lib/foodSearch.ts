/**
 * Unified food search, outside the curated database on the phone.
 *
 *  curated database (foods.json + foods-more.json)  → searched on the phone, offline, first
 *  /api/foods                                        → USDA FoodData Central + Open Food Facts, through our
 *                                                      server: edge-cached, Supabase-cached, de-duplicated, paged
 *  Open Food Facts directly                          → only if our server can't be reached
 *
 * Recent result pages are also kept on the phone (memory + localStorage), so going back to a search
 * or scrolling the same results costs no network at all.
 */
import { foodById } from './foods';
import { productByBarcode, searchProducts } from './openFoodFacts';
import { isAlcoholic } from './alcohol';
import type { Food, FoodSource, PrepState } from './types';

interface ExtFood {
  id: string; fdcId?: number; ref?: string; name: string; brand?: string; barcode?: string; category: string;
  state: PrepState; method?: string; kind: 'generic' | 'branded' | 'restaurant' | 'meal';
  per100: Food['per100']; portions: Food['portions']; source: FoodSource; sourceNote?: string;
}
export interface ExternalPage { foods: Food[]; page: number; hasMore: boolean; unavailable: string[]; via: 'server' | 'direct' }

export const KIND_LABEL: Record<ExtFood['kind'], string> = { generic: 'Ingredient', branded: 'Product', restaurant: 'Restaurant', meal: 'Meal' };

const toFood = (x: ExtFood): Food => ({
  id: x.id, ...(x.fdcId && { fdcId: x.fdcId }), ...((x.ref ?? x.barcode) && { ref: x.ref ?? x.barcode }), name: x.name,
  category: x.kind === 'restaurant' ? 'Restaurant food' : x.category, state: x.state, per100: x.per100, portions: x.portions, source: x.source,
  ...(x.sourceNote && { sourceNote: x.sourceNote }),
});

// ---------- small on-phone cache ----------
const LS_KEY = 'nutivili-ext-search';
const TTL = 3 * 24 * 3600 * 1000;
const MAX = 40;
const mem = new Map<string, { at: number; page: ExternalPage }>();
function readLs(): Record<string, { at: number; page: ExternalPage }> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
}
function getCached(key: string): ExternalPage | null {
  const hit = mem.get(key) ?? readLs()[key];
  return hit && Date.now() - hit.at < TTL ? hit.page : null;
}
function putCached(key: string, page: ExternalPage) {
  const v = { at: Date.now(), page };
  mem.set(key, v);
  try {
    const all = readLs();
    all[key] = v;
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
    for (const k of keys.slice(MAX)) delete all[k];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch { /* storage full or blocked: memory cache still works */ }
}

/** External foods the curated database already has (same USDA record) are left out. */
const notLocal = (f: Food) => !foodById(f.id) && !isAlcoholic(f.name);

async function viaServer(path: string, signal?: AbortSignal): Promise<unknown | null> {
  const res = await fetch(path, { signal });
  // Local preview / no server: the SPA answers with HTML.
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;
  return res.json();
}

/** One page of external results for a query. Page 1 is cached on the phone for 3 days. */
export async function searchExternal(query: string, page = 1, signal?: AbortSignal): Promise<ExternalPage> {
  const q = query.trim().replace(/\s+/g, ' ');
  const key = `${q.toLowerCase()}|${page}`;
  const hit = getCached(key);
  if (hit) return hit;
  let out: ExternalPage | null = null;
  try {
    const d = (await viaServer(`/api/foods?q=${encodeURIComponent(q)}&page=${page}&size=20`, signal)) as { foods: ExtFood[]; hasMore: boolean; unavailable?: string[] } | null;
    if (d?.foods) out = { foods: d.foods.map(toFood).filter(notLocal), page, hasMore: d.hasMore, unavailable: d.unavailable ?? [], via: 'server' };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
  }
  if (!out) {
    // Server not reachable: ask Open Food Facts directly (first page only, products only).
    const foods = page === 1 ? await searchProducts(q, signal) : [];
    out = { foods: foods.filter(notLocal), page, hasMore: false, unavailable: ['USDA'], via: 'direct' };
  }
  if (out.foods.length) putCached(key, out);
  return out;
}

/** A packaged product by barcode: our server (Open Food Facts, then USDA Branded), else Open Food Facts directly. */
export async function lookupBarcode(code: string): Promise<Food | null> {
  const c = code.replace(/\D/g, '');
  try {
    const d = (await viaServer(`/api/foods?barcode=${c}`)) as { food: ExtFood | null } | null;
    if (d) return d.food ? toFood(d.food) : null;
  } catch { /* fall back below */ }
  return productByBarcode(c);
}

/** Plain-words source line used under external results (and its licence, for attribution). */
export function externalCredit(f: Pick<Food, 'source'>): string {
  return f.source === 'off' ? 'Open Food Facts · ODbL' : f.source.startsWith('usda') ? 'USDA FoodData Central · public domain' : '';
}
