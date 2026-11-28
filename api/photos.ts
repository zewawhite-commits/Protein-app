/**
 * GET /api/photos?keys=jollof,banana → { photos: { jollof: { url, author, authorUrl, page } | null } }
 * GET /api/photos?all=1 → every photo found so far (for the credits page)
 *
 * Real food photos from Unsplash, shown from Unsplash's own image links with the photographer
 * credited (their API rules). Every photo is picked by a person who checked it shows exactly that
 * food (see review below); nothing is chosen automatically. Needs UNSPLASH_ACCESS_KEY.
 */
import { admin, userFromToken } from './_lib/accounts.js';
import { isAdmin } from './_lib/quota.js';
import { PHOTO_QUERIES } from '../src/data/photoQueries.js';
import { foodsHandler } from './_lib/foodSearch.js';

interface Row { key: string; url: string | null; author: string | null; author_url: string | null; photo_page: string | null; blur_color: string | null; tried_at: string }
const UTM = 'utm_source=nutivili_ai&utm_medium=referral';

const json = (d: unknown, s = 200, cache = 'public, max-age=300, s-maxage=3600') =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': cache } });

const out = (r: Row) => (r.url ? { url: r.url, author: r.author, authorUrl: r.author_url, page: r.photo_page, color: r.blur_color } : null);

type UnsplashPhoto = { urls: { raw: string }; user: { name: string; links: { html: string } }; links: { html: string; download_location: string }; color?: string; alt_description?: string | null };

/**
 * Photo review (owner only: signed in with an email in ADMIN_EMAILS; Profile → Owner dashboard → Food photos):
 *   ?review=candidates&key=egg[&q=…]  → Unsplash results to look at
 *   ?review=pick&key=egg&id=<photo id> → use that photo (marked verified)
 *   ?review=clear&key=egg              → no photo for this food
 * Only photos a person has looked at and approved are ever shown in the app.
 */
async function review(request: Request, db: NonNullable<ReturnType<typeof admin>>, params: URLSearchParams): Promise<Response> {
  const user = await userFromToken(request.headers.get('x-user-token'));
  if (!user || !isAdmin(user.email)) return json({ error: 'forbidden' }, 403, 'no-store');
  const key = params.get('key') ?? '';
  if (!PHOTO_QUERIES[key]) return json({ error: 'unknown key' }, 400, 'no-store');
  const headers = { authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, 'accept-version': 'v1' };
  const mode = params.get('review');
  if (mode === 'candidates') {
    const q = params.get('q') || PHOTO_QUERIES[key];
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=20&page=${Number(params.get('page')) || 1}&content_filter=high`, { headers });
    if (!res.ok) return json({ error: `unsplash ${res.status}` }, 502, 'no-store');
    const data = (await res.json()) as { results?: (UnsplashPhoto & { id: string })[] };
    return json({ results: (data.results ?? []).map((p) => ({ id: p.id, thumb: `${p.urls.raw}&w=300&h=300&fit=crop`, alt: p.alt_description, author: p.user.name, photo: p })) }, 200, 'no-store');
  }
  if (mode === 'pick') {
    // The photo's details from the candidates list (saves an Unsplash request), or looked up by id.
    let p: UnsplashPhoto | null = null;
    try { const x = JSON.parse(params.get('photo') ?? 'null') as UnsplashPhoto | null; if (x && /^https:\/\/images\.unsplash\.com\//.test(x.urls.raw) && /^https:\/\/api\.unsplash\.com\//.test(x.links.download_location) && /^https:\/\/unsplash\.com\//.test(x.links.html) && /^https:\/\/unsplash\.com\//.test(x.user.links.html)) p = x; } catch { /* use the id */ }
    if (!p) {
      const res = await fetch(`https://api.unsplash.com/photos/${encodeURIComponent(params.get('id') ?? '')}`, { headers });
      if (!res.ok) return json({ error: `unsplash ${res.status}` }, 502, 'no-store');
      p = (await res.json()) as UnsplashPhoto;
    }
    void fetch(p.links.download_location, { headers }).catch(() => undefined);
    const row = { key, url: p.urls.raw, author: p.user.name, author_url: `${p.user.links.html}?${UTM}`, photo_page: `${p.links.html}?${UTM}`, blur_color: p.color ?? null, tried_at: new Date().toISOString(), verified: true };
    const { error } = await db.from('food_photos').upsert(row);
    return json(error ? { error: error.message } : { ok: true, key }, error ? 500 : 200, 'no-store');
  }
  if (mode === 'clear') {
    await db.from('food_photos').delete().eq('key', key);
    return json({ ok: true }, 200, 'no-store');
  }
  return json({ error: 'unknown mode' }, 400, 'no-store');
}

export async function GET(request: Request): Promise<Response> {
  // /api/foods is served here (vercel.json rewrite): the plan allows 12 functions.
  if (new URL(request.url).searchParams.get('route') === 'foods') return foodsHandler(request);
  const db = admin();
  if (!db) return json({ photos: {} });
  const params = new URL(request.url).searchParams;
  if (params.get('review')) return review(request, db, params);
  // Only photos a person has checked show the right food. Everything else gets a plain tile.
  if (params.get('all')) {
    const { data } = await db.from('food_photos').select('*').eq('verified', true).not('url', 'is', null).order('key');
    return json({ photos: Object.fromEntries(((data ?? []) as Row[]).map((r) => [r.key, out(r)])) });
  }
  const keys = [...new Set((params.get('keys') ?? '').split(',').map((k) => k.trim()).filter((k) => PHOTO_QUERIES[k]))].slice(0, 40);
  if (!keys.length) return json({ photos: {} });
  const { data } = await db.from('food_photos').select('*').in('key', keys).eq('verified', true);
  const have = new Map(((data ?? []) as Row[]).map((r) => [r.key, r]));
  const photos: Record<string, ReturnType<typeof out>> = {};
  for (const k of keys) { const r = have.get(k); photos[k] = r ? out(r) : null; }
  return json({ photos }, 200, 'public, max-age=300, s-maxage=600');
}
