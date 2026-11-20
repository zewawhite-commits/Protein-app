/**
 * GET /api/photos?keys=jollof,banana → { photos: { jollof: { url, author, authorUrl, page } | null } }
 * GET /api/photos?all=1 → every photo found so far (for the credits page)
 *
 * Real food photos from Unsplash, shown from Unsplash's own image links with the photographer
 * credited (their API rules). Every photo is picked by a person who checked it shows exactly that
 * food (see review below); nothing is chosen automatically. Needs UNSPLASH_ACCESS_KEY.
 */
import { admin } from './_lib/accounts.js';
import { PHOTO_QUERIES } from '../src/data/photoQueries.js';

interface Row { key: string; url: string | null; author: string | null; author_url: string | null; photo_page: string | null; blur_color: string | null; tried_at: string }
const UTM = 'utm_source=nutivili_ai&utm_medium=referral';

const json = (d: unknown, s = 200, cache = 'public, max-age=300, s-maxage=3600') =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': cache } });

const out = (r: Row) => (r.url ? { url: r.url, author: r.author, authorUrl: r.author_url, page: r.photo_page, color: r.blur_color } : null);

type UnsplashPhoto = { urls: { raw: string }; user: { name: string; links: { html: string } }; links: { html: string; download_location: string }; color?: string; alt_description?: string | null };

/**
 * Photo review (owner only, with the review token saved in Supabase app_config):
 *   ?review=candidates&key=egg[&q=…]  → Unsplash results to look at
 *   ?review=pick&key=egg&id=<photo id> → use that photo (marked verified)
 *   ?review=clear&key=egg              → no photo for this food
 * Only photos a person has looked at and approved are ever shown in the app.
 */
async function review(request: Request, db: NonNullable<ReturnType<typeof admin>>, params: URLSearchParams): Promise<Response> {
  const token = request.headers.get('x-review-token') ?? '';
  const { data: cfg } = await db.from('app_config').select('value').eq('key', 'photo_review_token').maybeSingle();
  if (!cfg?.value || token.length < 20 || token !== cfg.value) return json({ error: 'forbidden' }, 403, 'no-store');
  const key = params.get('key') ?? '';
  if (!PHOTO_QUERIES[key]) return json({ error: 'unknown key' }, 400, 'no-store');
  const headers = { authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, 'accept-version': 'v1' };
  const mode = params.get('review');
  if (mode === 'candidates') {
    const q = params.get('q') || PHOTO_QUERIES[key];
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=20&page=${Number(params.get('page')) || 1}&content_filter=high`, { headers });
    if (!res.ok) return json({ error: `unsplash ${res.status}` }, 502, 'no-store');
    const data = (await res.json()) as { results?: (UnsplashPhoto & { id: string })[] };
    return json({ results: (data.results ?? []).map((p) => ({ id: p.id, thumb: `${p.urls.raw}&w=300&h=300&fit=crop`, alt: p.alt_description, author: p.user.name })) }, 200, 'no-store');
  }
  if (mode === 'pick') {
    const res = await fetch(`https://api.unsplash.com/photos/${encodeURIComponent(params.get('id') ?? '')}`, { headers });
    if (!res.ok) return json({ error: `unsplash ${res.status}` }, 502, 'no-store');
    const p = (await res.json()) as UnsplashPhoto;
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
