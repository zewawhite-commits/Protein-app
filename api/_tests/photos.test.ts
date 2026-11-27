import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory stand-in for the food_photos and app_config tables.
const rows = new Map<string, Record<string, unknown>>();
const TOKEN = 'review-token-0123456789abcdef';
vi.mock('../_lib/accounts.js', () => ({
  userFromToken: async (t: string | null) => (t === TOKEN ? { id: 'o', email: 'owner@example.com' } : t ? { id: 'u', email: 'someone@example.com' } : null),
  admin: () => ({
    from: (table: string) => {
      const f: Record<string, unknown> = {};
      const list = () => [...rows.values()].filter((r) => Object.entries(f).every(([k, v]) => (k === '_in' ? (v as string[]).includes(String(r.key)) : r[k] === v)));
      const q = {
        select() { return q; }, not() { return q; }, eq(c: string, v: unknown) { f[c] = v; return q; },
        in(_c: string, keys: string[]) { f._in = keys; return q; },
        order() { return Promise.resolve({ data: list().filter((r) => r.url) }); },
        maybeSingle() { return Promise.resolve({ data: table === 'app_config' ? { value: TOKEN } : null }); },
        then(res: (x: unknown) => unknown) { return Promise.resolve({ data: list() }).then(res); },
        upsert(r: Record<string, unknown>) { rows.set(String(r.key), r); return Promise.resolve({ error: null }); },
        delete() { return { eq: (_c: string, k: string) => { rows.delete(k); return Promise.resolve({ error: null }); } }; },
      };
      return q;
    },
  }),
}));

const calls = vi.fn();
beforeEach(() => {
  rows.clear(); calls.mockReset();
  process.env.UNSPLASH_ACCESS_KEY = 'test-key';
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls(url);
    if (String(url).includes('/search/photos')) return new Response(JSON.stringify({ results: [{ id: 'b', urls: { raw: 'https://images.unsplash.com/b?ixid=1' }, user: { name: 'Best Photo', links: { html: 'https://unsplash.com/@best' } }, links: { html: 'https://unsplash.com/photos/b', download_location: 'https://api.unsplash.com/photos/b/download' }, alt_description: 'boiled eggs' }] }), { status: 200 });
    if (String(url).includes('/photos/b')) return new Response(JSON.stringify({ urls: { raw: 'https://images.unsplash.com/b' }, user: { name: 'Best Photo', links: { html: 'https://unsplash.com/@best' } }, links: { html: 'https://unsplash.com/photos/b', download_location: 'https://api.unsplash.com/photos/b/download' }, color: '#a63' }), { status: 200 });
    return new Response('{}', { status: 200 });
  }));
});

describe('food photos API', () => {
  it('only shows photos a person has approved, and never searches on its own', async () => {
    const { GET } = await import('../photos.js');
    rows.set('egg', { key: 'egg', url: 'https://images.unsplash.com/unchecked', verified: false });
    rows.set('banana', { key: 'banana', url: 'https://images.unsplash.com/ok', author: 'A', verified: true });
    const d = await (await GET(new Request('https://x/api/photos?keys=egg,banana,nonsense'))).json();
    expect(d.photos.egg).toBeNull();
    expect(d.photos.banana).toMatchObject({ url: 'https://images.unsplash.com/ok' });
    expect('nonsense' in d.photos).toBe(false);
    expect(calls).not.toHaveBeenCalled();
  });
  it('review is for the owner account only', async () => {
    const { GET } = await import('../photos.js');
    expect((await GET(new Request('https://x/api/photos?review=candidates&key=egg'))).status).toBe(403);
    expect((await GET(new Request('https://x/api/photos?review=candidates&key=egg', { headers: { 'x-user-token': 'not-the-owner' } }))).status).toBe(403);
  });
  it('picking a reviewed photo saves it with credit, marks it verified and reports the download', async () => {
    const { GET } = await import('../photos.js');
    process.env.ADMIN_EMAILS = 'owner@example.com';
    const h = { headers: { 'x-user-token': TOKEN } };
    const c = await (await GET(new Request('https://x/api/photos?review=candidates&key=egg', h))).json();
    expect(c.results[0]).toMatchObject({ id: 'b', alt: 'boiled eggs' });
    await GET(new Request('https://x/api/photos?review=pick&key=egg&id=b', h));
    expect(rows.get('egg')).toMatchObject({ url: 'https://images.unsplash.com/b', verified: true, author: 'Best Photo' });
    expect(String(rows.get('egg')?.author_url)).toContain('utm_source=nutivili_ai');
    expect(calls.mock.calls.some(([u]) => /download/.test(u))).toBe(true);
  });
});
