/**
 * GET /api/photos?keys=jollof,banana → { photos: { jollof: { url, author, authorUrl, page } | null } }
 * GET /api/photos?all=1 → every photo found so far (for the credits page)
 *
 * Real food photos from Unsplash, shown from Unsplash's own image links with the photographer
 * credited (their API rules). Each food type is searched once, then remembered in Supabase for
 * everyone, so the free 50-searches-an-hour limit is plenty. Needs UNSPLASH_ACCESS_KEY.
 */
import { admin } from './_lib/accounts.js';
import { PHOTO_QUERIES } from '../src/data/photoQueries.js';

interface Row { key: string; url: string | null; author: string | null; author_url: string | null; photo_page: string | null; blur_color: string | null; tried_at: string }
const RETRY_MS = 7 * 864e5;
const NEW_PER_REQUEST = 2;
const UTM = 'utm_source=nutivili_ai&utm_medium=referral';

const json = (d: unknown, s = 200, cache = 'public, max-age=300, s-maxage=3600') =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': cache } });

const out = (r: Row) => (r.url ? { url: r.url, author: r.author, authorUrl: r.author_url, page: r.photo_page, color: r.blur_color } : null);

async function search(key: string): Promise<Omit<Row, 'tried_at'>> {
  const q = PHOTO_QUERIES[key];
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=5&orientation=squarish&content_filter=high`, {
    headers: { authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, 'accept-version': 'v1' },
  });
  if (!res.ok) throw new Error(`unsplash ${res.status}`);
  const data = (await res.json()) as { results?: { urls: { raw: string }; user: { name: string; links: { html: string } }; links: { html: string; download_location: string }; color?: string; likes?: number }[] };
  // The most liked of the top results tends to be the best-looking photo.
  const best = [...(data.results ?? [])].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))[0];
  if (!best) return { key, url: null, author: null, author_url: null, photo_page: null, blur_color: null };
  // Unsplash asks apps to report when a photo is used.
  void fetch(best.links.download_location, { headers: { authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }).catch(() => undefined);
  return { key, url: best.urls.raw, author: best.user.name, author_url: `${best.user.links.html}?${UTM}`, photo_page: `${best.links.html}?${UTM}`, blur_color: best.color ?? null };
}

export async function GET(request: Request): Promise<Response> {
  const db = admin();
  if (!db) return json({ photos: {} });
  const params = new URL(request.url).searchParams;
  if (params.get('all')) {
    const { data } = await db.from('food_photos').select('*').not('url', 'is', null).order('key');
    return json({ photos: Object.fromEntries(((data ?? []) as Row[]).map((r) => [r.key, out(r)])) });
  }
  const keys = [...new Set((params.get('keys') ?? '').split(',').map((k) => k.trim()).filter((k) => PHOTO_QUERIES[k]))].slice(0, 40);
  if (!keys.length) return json({ photos: {} });
  const { data } = await db.from('food_photos').select('*').in('key', keys);
  const have = new Map(((data ?? []) as Row[]).map((r) => [r.key, r]));
  const photos: Record<string, ReturnType<typeof out>> = {};
  for (const k of keys) { const r = have.get(k); if (r) photos[k] = out(r); }
  // Find a few missing ones per request (or retry old misses), within Unsplash's hourly limit.
  const missing = keys.filter((k) => { const r = have.get(k); return !r || (!r.url && Date.now() - Date.parse(r.tried_at) > RETRY_MS); }).slice(0, NEW_PER_REQUEST);
  let pending = keys.filter((k) => !have.get(k)).length > missing.length;
  if (process.env.UNSPLASH_ACCESS_KEY) {
    for (const k of missing) {
      try {
        const row = await search(k);
        await db.from('food_photos').upsert({ ...row, tried_at: new Date().toISOString() });
        photos[k] = row.url ? out({ ...row, tried_at: '' }) : null;
      } catch { pending = true; break; /* rate limit or network: try again later */ }
    }
  }
  // Still finding some: don't let browsers keep this answer for long.
  return json({ photos, pending }, 200, pending ? 'no-store' : 'public, max-age=300, s-maxage=600');
}
