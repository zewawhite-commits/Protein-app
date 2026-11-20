/**
 * GET /api/photos?keys=jollof,banana → { photos: { jollof: { url, author, authorUrl, page } | null } }
 * GET /api/photos?all=1 → every photo found so far (for the credits page)
 *
 * Real food photos from Unsplash, shown from Unsplash's own image links with the photographer
 * credited (their API rules). Each food type is searched once, then remembered in Supabase for
 * everyone, so the free 50-searches-an-hour limit is plenty. Needs UNSPLASH_ACCESS_KEY.
 */
import { admin } from './_lib/accounts.js';
import { PHOTO_QUERIES, photoMust } from '../src/data/photoQueries.js';

interface Row { key: string; url: string | null; author: string | null; author_url: string | null; photo_page: string | null; blur_color: string | null; tried_at: string }
const RETRY_MS = 7 * 864e5;
const NEW_PER_REQUEST = 2;
const UTM = 'utm_source=nutivili_ai&utm_medium=referral';

const json = (d: unknown, s = 200, cache = 'public, max-age=300, s-maxage=3600') =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': cache } });

const out = (r: Row) => (r.url ? { url: r.url, author: r.author, authorUrl: r.author_url, page: r.photo_page, color: r.blur_color } : null);

type UnsplashPhoto = { urls: { raw: string }; user: { name: string; links: { html: string } }; links: { html: string; download_location: string }; color?: string; likes?: number; alt_description?: string | null; description?: string | null; tags?: { title?: string }[] };
/** Does the photo's own description mention the food? (Keeps out bread for "peanut butter".) */
export function photoMatches(key: string, text: string): boolean {
  const must = photoMust(key);
  if (!must.length) return true;
  const t = ` ${text.toLowerCase().replace(/[^a-z\s]/g, ' ')} `;
  if (/\b(ants?|insects?|bugs?|shelf|shelves|supermarket|grocery|aisle|store|illustration|drawing|painting|abstract|artwork|art|cartoon|toy|plastic|vector|3d render|logo|sign|menu)\b/.test(t)) return false;
  // A different dish in the photo (pizza for "cheese", toast for "eggs") means it isn't really this food.
  const query = ` ${(PHOTO_QUERIES[key] ?? '').toLowerCase()} `;
  for (const d of OTHER_DISHES) if (new RegExp(`\\b${d}(e?s)?\\b`).test(t) && !query.includes(d)) return false;
  // The food must be the subject, not a side: "hash brown with egg and bacon" isn't a bacon photo.
  const lead = t.split(/\b(with|and|beside|next to|served|alongside|topped|surrounded|near|behind)\b/)[0];
  return must.some((w) => new RegExp(`\\b${w}(e?s)?\\b`).test(lead));
}
// Only the photo's own description (tags are too loose: a painting can be tagged "bacon").
// Unsplash's alt text says what's in the picture; the photographer's caption is the fallback.
const describe = (p: UnsplashPhoto) => p.alt_description || p.description || '';
const OTHER_DISHES = ['pizza', 'burger', 'sandwich', 'pasta', 'spaghetti', 'noodle', 'cake', 'cupcake', 'salad', 'sushi', 'taco', 'pastry', 'bread', 'toast', 'fries', 'onion ring', 'soup', 'cookie', 'donut', 'doughnut', 'pie', 'waffle', 'pancake', 'cereal', 'smoothie', 'coffee', 'cocktail', 'wine', 'beer'];

async function find(q: string, square: boolean) {
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=5${square ? '&orientation=squarish' : ''}&content_filter=high`, {
    headers: { authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, 'accept-version': 'v1' },
  });
  if (!res.ok) throw new Error(`unsplash ${res.status}`);
  const data = (await res.json()) as { results?: UnsplashPhoto[] };
  return data.results ?? [];
}

/** Pexels as a fallback source (free, real photos), used only when PEXELS_API_KEY is set. */
async function fromPexels(key: string, q: string): Promise<Omit<Row, 'tried_at'> | null> {
  if (!process.env.PEXELS_API_KEY) return null;
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=5&orientation=square`, { headers: { authorization: process.env.PEXELS_API_KEY } });
  if (!res.ok) return null;
  const data = (await res.json()) as { photos?: { src: { original: string }; photographer: string; photographer_url: string; url: string; avg_color?: string }[] };
  const best = data.photos?.[0];
  if (!best) return null;
  // Pexels images resize with the same w/h/fit query parameters the app adds.
  return { key, url: `${best.src.original}?auto=compress&cs=tinysrgb`, author: best.photographer, author_url: best.photographer_url, photo_page: best.url, blur_color: best.avg_color ?? null };
}

/**
 * Wikimedia Commons as a further fallback (no key needed; strong on traditional dishes).
 * Only large photos (JPEG, at least 1200 px) under free licences (CC0, public domain, CC BY,
 * CC BY-SA), credited to the author with the licence. Shown as Wikimedia's own 640 px thumbnail.
 */
const FREE = /^(cc0|public domain|pd|cc by(-sa)? [0-9.]+)/i;
const strip = (h?: string) => (h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;
async function fromWikimedia(key: string, q: string): Promise<Omit<Row, 'tried_at'> | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=640`;
  const res = await fetch(url, { headers: { 'user-agent': 'NutiviliAI/1.0 (food photos; https://nutiviliai.vercel.app)' } });
  if (!res.ok) return null;
  type Info = { url: string; thumburl?: string; width: number; height: number; mime: string; descriptionurl: string; extmetadata?: Record<string, { value?: string }> };
  const data = (await res.json()) as { query?: { pages?: Record<string, { index: number; imageinfo?: Info[] }> } };
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index) as { index: number; title?: string; imageinfo?: Info[] }[];
  for (const pg of pages) {
    const i = pg.imageinfo?.[0];
    if (!i?.thumburl || i.mime !== 'image/jpeg' || Math.min(i.width, i.height) < 1200) continue;
    const ratio = i.width / i.height;
    if (ratio < 0.66 || ratio > 1.6) continue;
    const lic = strip(i.extmetadata?.LicenseShortName?.value) ?? '';
    if (!FREE.test(lic)) continue;
    if (!photoMatches(key, `${pg.title ?? ''} ${strip(i.extmetadata?.ImageDescription?.value) ?? ''}`)) continue;
    return { key, url: i.thumburl, author: `${strip(i.extmetadata?.Artist?.value) ?? 'Unknown'} (${lic})`, author_url: i.descriptionurl, photo_page: i.descriptionurl, blur_color: null };
  }
  return null;
}

async function search(key: string): Promise<Omit<Row, 'tried_at'>> {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    const alt = (await fromPexels(key, PHOTO_QUERIES[key]).catch(() => null)) ?? (await fromWikimedia(key, PHOTO_QUERIES[key]).catch(() => null));
    return alt ?? { key, url: null, author: null, author_url: null, photo_page: null, blur_color: null };
  }
  try { return await searchUnsplash(key); } catch (e) {
    // Unsplash busy (hourly limit): Pexels is as good; otherwise wait and try Unsplash again
    // rather than settle for a lower-quality photo.
    const alt = await fromPexels(key, PHOTO_QUERIES[key]).catch(() => null);
    if (alt) return alt;
    throw e;
  }
}

async function searchUnsplash(key: string): Promise<Omit<Row, 'tried_at'>> {
  const q = PHOTO_QUERIES[key];
  // Square photos fit the food tiles best; many dishes only have a few photos, so widen if none.
  // Only photos whose description mentions the food; square ones first, then any shape.
  let results = (await find(q, true)).filter((p) => photoMatches(key, describe(p)));
  if (!results.length) results = (await find(q, false)).filter((p) => photoMatches(key, describe(p)));
  // The most liked of the top results tends to be the best-looking photo.
  const best = [...results].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))[0];
  if (!best) return (await fromPexels(key, q).catch(() => null)) ?? (await fromWikimedia(key, q).catch(() => null)) ?? { key, url: null, author: null, author_url: null, photo_page: null, blur_color: null };
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
  {
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
