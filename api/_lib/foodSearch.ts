/**
 * GET /api/foods?q=…&page=1&size=20      → packaged, branded, restaurant and generic foods from USDA + Open Food Facts
 * GET /api/foods?barcode=5000159407236     → one product by barcode (Open Food Facts, then USDA Branded)
 *
 * The app searches its own curated database on the phone first (offline, instant). This endpoint
 * adds the millions of products held by the external sources, without copying them all:
 *  1. Responses are cached at Vercel's edge for a day (same query = no new external call).
 *  2. If Supabase is set up (supabase/food-cache.sql), each result page is cached for 7 days and every
 *     food returned is kept in an indexed table, so popular foods are found even when a source is down.
 * Pages are 1-based; `hasMore` says whether to offer "Load more".
 */
import { admin } from './accounts.js';
import { dedupe, interleave, offByBarcode, offSearch, usdaByBarcode, usdaKeyCheck, usdaSearch, type ExtFood } from './foodSources.js';

const DAY = 86400;
const reply = (d: unknown, status = 200, cache = `public, max-age=3600, s-maxage=${DAY}, stale-while-revalidate=${7 * DAY}`) =>
  new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } });

export const ATTRIBUTION = [
  { source: 'USDA FoodData Central', licence: 'Public domain (CC0)', url: 'https://fdc.nal.usda.gov/' },
  { source: 'Open Food Facts', licence: 'Open Database Licence (ODbL)', url: 'https://world.openfoodfacts.org/' },
];

type Db = NonNullable<ReturnType<typeof admin>>;

async function cached(db: Db | null, key: string): Promise<unknown | null> {
  if (!db) return null;
  const { data } = await db.from('food_search_cache').select('results, expires_at').eq('key', key).maybeSingle();
  return data && new Date(data.expires_at as string) > new Date() ? data.results : null;
}

async function remember(db: Db | null, key: string, results: unknown, foods: ExtFood[]): Promise<void> {
  if (!db) return;
  const expires = new Date(Date.now() + 7 * DAY * 1000).toISOString();
  await db.from('food_search_cache').upsert({ key, results, expires_at: expires });
  if (foods.length) {
    await db.from('external_foods').upsert(foods.map((f) => ({ id: f.id, source: f.source, name: f.name, brand: f.brand ?? null, barcode: f.barcode ?? null, kind: f.kind, data: f, updated_at: new Date().toISOString() })));
  }
}

/** Indexed search over foods already fetched (Postgres full-text + trigram), used when the sources fail. */
async function fromStore(db: Db | null, q: string, page: number, size: number): Promise<ExtFood[]> {
  if (!db) return [];
  const { data } = await db.from('external_foods').select('data').textSearch('search', q.split(/\s+/).filter(Boolean).join(' & '), { config: 'simple' }).order('hits', { ascending: false }).range((page - 1) * size, page * size - 1);
  return ((data ?? []) as { data: ExtFood }[]).map((r) => r.data);
}

export async function foodsHandler(request: Request, f: typeof fetch = fetch): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const db = admin();

  const barcode = (params.get('barcode') ?? '').replace(/\D/g, '');
  if (params.has('barcode')) {
    if (barcode.length < 8 || barcode.length > 14) return reply({ error: 'A barcode has 8 to 14 digits.' }, 400, 'no-store');
    const key = `barcode:${barcode}`;
    const hit = await cached(db, key).catch(() => null);
    if (hit) return reply(hit);
    const food = (await offByBarcode(barcode, f).catch(() => null)) ?? (await usdaByBarcode(barcode, f).catch(() => null))
      ?? (db ? (((await db.from('external_foods').select('data').eq('barcode', barcode).limit(1)).data ?? [])[0] as { data: ExtFood } | undefined)?.data ?? null : null);
    const body = { food, attribution: ATTRIBUTION };
    if (food) await remember(db, key, body, [food]).catch(() => undefined);
    return reply(body, 200, food ? undefined : 'public, s-maxage=3600');
  }

  const q = (params.get('q') ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (q.length < 2) return reply({ error: 'Type at least 2 letters.' }, 400, 'no-store');
  const page = Math.max(1, Math.min(50, Number(params.get('page')) || 1));
  const size = Math.max(5, Math.min(50, Number(params.get('size')) || 20));
  const want = new Set((params.get('sources') ?? 'usda,off').split(','));
  const key = `q:${q.toLowerCase()}|${page}|${size}|${[...want].sort().join(',')}`;
  const hit = await cached(db, key).catch(() => null);
  if (hit) return reply(hit);

  // Each source gives half a page so both are represented; they run side by side.
  const half = Math.ceil(size / 2);
  const [usda, off] = await Promise.allSettled([
    want.has('usda') ? usdaSearch(q, page, half, f) : Promise.resolve({ foods: [], total: 0 }),
    want.has('off') ? offSearch(q, page, half, f) : Promise.resolve({ foods: [], total: 0 }),
  ]);
  const u = usda.status === 'fulfilled' ? usda.value : null;
  const o = off.status === 'fulfilled' ? off.value : null;
  let foods = dedupe(interleave(u?.foods ?? [], o?.foods ?? []));
  const failed = [!u && want.has('usda') && 'USDA', !o && want.has('off') && 'Open Food Facts'].filter(Boolean) as string[];
  if (!u && !o) foods = await fromStore(db, q, page, size).catch(() => []);
  const total = (u?.total ?? 0) + (o?.total ?? 0);
  // Why a source failed (status only, never the key) and whether a USDA key is configured: lets the owner check setup.
  const why = (x: PromiseSettledResult<unknown>) => (x.status === 'rejected' ? String((x.reason as Error)?.message ?? x.reason).slice(0, 60) : undefined);
  const diagnostics = failed.length ? { usdaKey: usdaKeyCheck(), usda: why(usda), openFoodFacts: why(off) } : undefined;
  const body = { foods, page, size, hasMore: page * half < Math.max(u?.total ?? 0, o?.total ?? 0), total, unavailable: failed, ...(diagnostics && { diagnostics }), attribution: ATTRIBUTION };
  // Don't keep a page cached for long if a source was down: try it again soon.
  if (!failed.length) await remember(db, key, body, foods).catch(() => undefined);
  return reply(body, 200, failed.length ? 'public, s-maxage=300' : undefined);
}
