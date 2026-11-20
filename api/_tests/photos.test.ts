import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory stand-in for the food_photos table.
const rows = new Map<string, Record<string, unknown>>();
vi.mock('../_lib/accounts.js', () => ({
  admin: () => ({
    from: () => {
      const q = {
        _in: [] as string[], _all: false,
        select() { return q; }, not() { q._all = true; return q; }, order() { return Promise.resolve({ data: [...rows.values()].filter((r) => r.url) }); },
        in(_c: string, keys: string[]) { q._in = keys; return Promise.resolve({ data: keys.map((k) => rows.get(k)).filter(Boolean) }); },
        upsert(r: Record<string, unknown>) { rows.set(String(r.key), r); return Promise.resolve({ error: null }); },
      };
      return q;
    },
  }),
}));

const unsplash = vi.fn();
beforeEach(() => {
  rows.clear(); unsplash.mockReset();
  process.env.UNSPLASH_ACCESS_KEY = 'test-key';
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    unsplash(url, init?.headers?.authorization);
    const q = new URL(String(url), 'https://x').searchParams.get('query') ?? '';
    if (String(url).includes('/search/photos')) return new Response(JSON.stringify({ results: [
      { urls: { raw: 'https://images.unsplash.com/a' }, user: { name: 'Low Likes', links: { html: 'https://unsplash.com/@low' } }, links: { html: 'https://unsplash.com/photos/a', download_location: 'https://api.unsplash.com/photos/a/download' }, likes: 3, alt_description: q },
      { urls: { raw: 'https://images.unsplash.com/b' }, user: { name: 'Best Photo', links: { html: 'https://unsplash.com/@best' } }, links: { html: 'https://unsplash.com/photos/b', download_location: 'https://api.unsplash.com/photos/b/download' }, likes: 90, color: '#a63', alt_description: q },
    ] }), { status: 200 });
    return new Response('{}', { status: 200 });
  }));
});

describe('food photos API', () => {
  it('searches Unsplash once, keeps the best photo with credit, and reports the download', async () => {
    const { GET } = await import('../photos.js');
    const d = await (await GET(new Request('https://x/api/photos?keys=jollof,banana,nonsense'))).json();
    expect(d.photos.jollof).toMatchObject({ url: 'https://images.unsplash.com/b', author: 'Best Photo' });
    expect(d.photos.jollof.authorUrl).toContain('utm_source=nutivili_ai');
    expect(unsplash.mock.calls.some(([u, auth]) => /download/.test(u) && auth === 'Client-ID test-key')).toBe(true);
    expect('nonsense' in d.photos).toBe(false);
    const searches = unsplash.mock.calls.filter(([u]) => /search/.test(u)).length;
    // Second time: served from the database, no new search for jollof.
    await GET(new Request('https://x/api/photos?keys=jollof'));
    expect(unsplash.mock.calls.filter(([u]) => /search/.test(u)).length).toBe(searches);
  });
  it('finds at most 2 new photos per request (stays inside the hourly limit)', async () => {
    const { GET } = await import('../photos.js');
    const d = await (await GET(new Request('https://x/api/photos?keys=jollof,banana,egusi,fufu,suya'))).json();
    expect(unsplash.mock.calls.filter(([u]) => /search/.test(u)).length).toBe(2);
    expect(d.pending).toBe(true);
  });
  it('without a key, never calls Unsplash', async () => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    const { GET } = await import('../photos.js');
    await GET(new Request('https://x/api/photos?keys=jollof'));
    expect(unsplash.mock.calls.filter(([u]) => /unsplash/.test(u))).toHaveLength(0);
  });
  it('falls back to a large, freely licensed Wikimedia photo', async () => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('commons.wikimedia.org')) return new Response(JSON.stringify({ query: { pages: {
        1: { index: 1, imageinfo: [{ url: 'u', thumburl: 'https://upload.wikimedia.org/small.jpg', width: 800, height: 800, mime: 'image/jpeg', descriptionurl: 'd1', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } } }] },
        2: { index: 2, imageinfo: [{ url: 'u', thumburl: 'https://upload.wikimedia.org/nc.jpg', width: 3000, height: 2000, mime: 'image/jpeg', descriptionurl: 'd2', extmetadata: { LicenseShortName: { value: 'CC BY-NC 2.0' } } }] },
        3: { index: 3, title: 'File:Egusi soup.jpg', imageinfo: [{ url: 'u', thumburl: 'https://upload.wikimedia.org/good.jpg', width: 3000, height: 2400, mime: 'image/jpeg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Egusi.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Ada</a>' } } }] },
      } } }), { status: 200 });
      return new Response('{}', { status: 404 });
    }));
    const { GET } = await import('../photos.js');
    const d = await (await GET(new Request('https://x/api/photos?keys=egusi'))).json();
    // Too small and non-commercial licences are skipped.
    expect(d.photos.egusi.url).toBe('https://upload.wikimedia.org/good.jpg');
    expect(d.photos.egusi.author).toBe('Ada (CC BY-SA 4.0)');
  });
  it('never uses a photo whose description is about something else', async () => {
    const { photoMatches } = await import('../photos.js');
    expect(photoMatches('peanut_butter', 'sliced bread on a white table')).toBe(false);
    expect(photoMatches('peanut_butter', 'jar of creamy peanut butter')).toBe(true);
    expect(photoMatches('chicken_wings', 'a whole roast chicken')).toBe(false);
    expect(photoMatches('chicken_wings', 'spicy buffalo chicken wings')).toBe(true);
    expect(photoMatches('egg', 'ants carrying white eggs in a basket')).toBe(false);
    expect(photoMatches('cottage_cheese', 'cheese on supermarket shelves')).toBe(false);
    expect(photoMatches('egg', 'two boiled eggs on a plate')).toBe(true);
    expect(photoMatches('egg', 'boiled eggs and toast on a plate')).toBe(false);
    expect(photoMatches('cheese_wedge', 'a pizza with cheese and toppings')).toBe(false);
    expect(photoMatches('bacon', 'brown and white abstract painting')).toBe(false);
    expect(photoMatches('bacon', 'crispy bacon strips in a pan')).toBe(true);
  });
});
