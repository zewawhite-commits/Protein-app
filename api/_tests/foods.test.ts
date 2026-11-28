import { describe, expect, it, vi } from 'vitest';
import { dedupe, interleave, offToFood, preparation, usdaToFood, type ExtFood } from '../_lib/foodSources';
import { foodsHandler } from '../_lib/foodSearch';

const usdaBranded = {
  fdcId: 2345678, description: 'GREEK YOGURT, PLAIN', dataType: 'Branded', brandOwner: 'Chobani, LLC', brandName: 'CHOBANI', gtinUpc: '00818290012345',
  foodCategory: 'Yogurt', servingSize: 170, servingSizeUnit: 'g', householdServingFullText: '1 container', publishedDate: '2025-04-01',
  foodNutrients: [
    { nutrientNumber: '203', value: 10, unitName: 'G' }, { nutrientNumber: '204', value: 0, unitName: 'G' }, { nutrientNumber: '205', value: 3.5, unitName: 'G' },
    { nutrientNumber: '208', value: 59, unitName: 'KCAL' }, { nutrientNumber: '268', value: 247, unitName: 'kJ' }, { nutrientNumber: '307', value: 36, unitName: 'MG' },
  ],
};
const offProduct = { code: '5000159407236', product_name: 'Greek style yogurt', brands: 'Brand X', serving_size: '150 g', serving_quantity: 150, nutriments: { proteins_100g: 9.8, 'energy-kcal_100g': 60, fat_100g: 0.2, carbohydrates_100g: 3.6, sodium_100g: 0.04 } };

describe('normalising external sources', () => {
  it('maps a USDA Branded food: per-100 g values, kcal not kJ, serving, barcode, brand, kind', () => {
    const f = usdaToFood(usdaBranded)!;
    expect(f).toMatchObject({ id: 'usda:2345678', name: 'Greek Yogurt, Plain, Chobani', brand: 'Chobani', barcode: '818290012345', source: 'usda-branded', kind: 'branded' });
    expect(f.per100).toMatchObject({ protein: 10, kcal: 59, carbs: 3.5, sodium: 36 });
    expect(f.portions[0]).toEqual({ label: '1 serving (1 container)', grams: 170 });
  });

  it('maps an Open Food Facts product and converts sodium g → mg', () => {
    const f = offToFood(offProduct)!;
    expect(f).toMatchObject({ id: 'off:5000159407236', barcode: '5000159407236', name: 'Greek style yogurt, Brand X', source: 'off' });
    expect(f.per100.sodium).toBe(40);
  });

  it('skips records with no protein value and alcoholic drinks', () => {
    expect(usdaToFood({ ...usdaBranded, foodNutrients: [] })).toBeNull();
    expect(offToFood({ ...offProduct, categories_tags: ['en:beers'] })).toBeNull();
  });

  it('marks restaurant foods', () => {
    expect(usdaToFood({ ...usdaBranded, description: 'Chicken sandwich', brandOwner: "McDonald's", brandName: '' })!.kind).toBe('restaurant');
  });

  it('reads raw / cooked and the cooking method from the name', () => {
    expect(preparation('Chicken breast, raw')).toEqual({ state: 'raw' });
    expect(preparation('Chicken, fried, battered')).toEqual({ state: 'cooked', method: 'fried' });
    expect(preparation('Salmon fillet, grilled')).toEqual({ state: 'cooked', method: 'grilled' });
    expect(preparation('Oats, dry')).toEqual({ state: 'dry' });
    expect(preparation('Greek yogurt')).toEqual({ state: 'na' });
  });
});

describe('merging', () => {
  const a = { id: 'usda:1', name: 'Chicken breast, grilled', barcode: '0123456789012', per100: { kcal: 165 } } as unknown as ExtFood;
  it('keeps one entry per barcode and per same name + energy, but keeps fried and grilled apart', () => {
    const sameBarcode = { ...a, id: 'off:123456789012', name: 'Grilled chicken', barcode: '123456789012' } as ExtFood;
    const sameName = { ...a, id: 'off:999', barcode: undefined, per100: { kcal: 166 } } as unknown as ExtFood;
    const fried = { ...a, id: 'off:777', barcode: undefined, name: 'Chicken breast, fried', per100: { kcal: 220 } } as unknown as ExtFood;
    expect(dedupe([a, sameBarcode, sameName, fried]).map((x) => x.id)).toEqual(['usda:1', 'off:777']);
  });
  it('interleaves the two sources', () => {
    const x = (id: string) => ({ id }) as ExtFood;
    expect(interleave([x('u1'), x('u2'), x('u3')], [x('o1')]).map((f) => f.id)).toEqual(['u1', 'o1', 'u2', 'u3']);
  });
});

describe('GET /api/foods', () => {
  const fakeFetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('api.nal.usda.gov')) return new Response(JSON.stringify({ foods: [usdaBranded], totalHits: 45 }), { status: 200 });
    if (u.includes('/cgi/search.pl')) return new Response(JSON.stringify({ products: [offProduct], count: 30 }), { status: 200 });
    if (u.includes('/api/v2/product/')) return new Response(JSON.stringify({}), { status: 404 });
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;

  it('searches both sources, pages, caches at the edge and credits the sources', async () => {
    const res = await foodsHandler(new Request('https://x.test/api/foods?q=greek%20yogurt&page=1&size=20'), fakeFetch);
    const d = await res.json();
    expect(d.foods.map((f: ExtFood) => f.source)).toEqual(['usda-branded', 'off']);
    expect(d.hasMore).toBe(true);
    expect(d.attribution.map((a: { source: string }) => a.source)).toEqual(['USDA FoodData Central', 'Open Food Facts']);
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=86400/);
    // USDA called with a page number and page size.
    expect(String((fakeFetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0])).toMatch(/pageNumber=1&pageSize=10/);
  });

  it('still answers when one source is down, and does not cache that answer for long', async () => {
    const half = vi.fn(async (url: string | URL) => (String(url).includes('nal.usda.gov') ? new Response('no', { status: 503 }) : new Response(JSON.stringify({ products: [offProduct], count: 1 }), { status: 200 }))) as unknown as typeof fetch;
    const res = await foodsHandler(new Request('https://x.test/api/foods?q=yogurt'), half);
    const d = await res.json();
    expect(d.unavailable).toEqual(['USDA']);
    expect(d.foods).toHaveLength(1);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=300');
  });

  it('looks a barcode up in Open Food Facts, then USDA Branded', async () => {
    const res = await foodsHandler(new Request('https://x.test/api/foods?barcode=00818290012345'), fakeFetch);
    expect((await res.json()).food).toMatchObject({ id: 'usda:2345678', source: 'usda-branded' });
  });

  it('rejects bad input', async () => {
    expect((await foodsHandler(new Request('https://x.test/api/foods?q=a'), fakeFetch)).status).toBe(400);
    expect((await foodsHandler(new Request('https://x.test/api/foods?barcode=12'), fakeFetch)).status).toBe(400);
  });
});

describe('diet labels on packaged products', () => {
  it('are only shown when the maker says so (no ingredient list to check)', async () => {
    const { dietLabel } = await import('../../src/lib/goals');
    expect(dietLabel({ name: 'Zorblax snack', source: 'off' })).toBeNull();
    expect(dietLabel({ name: 'Vegan protein bar, Brand', source: 'usda-branded' })).toBe('Vegan');
    expect(dietLabel({ name: 'Veggie burger, Brand', source: 'off' })).toBe('Vegetarian');
    expect(dietLabel({ name: 'Apples, raw', source: 'usda-sr' })).toBe('Vegan');
  });
});

describe('USDA key setup', () => {
  it('ignores stray spaces, line breaks and quotes and reports only the length', async () => {
    const { usdaKeyCheck } = await import('../_lib/foodSources');
    process.env.USDA_API_KEY = ' "abcdefghijabcdefghijabcdefghijabcdefghij"\n';
    expect(usdaKeyCheck()).toBe('set, 40 characters (removed 4 stray spaces/quotes)');
    process.env.USDA_API_KEY = '28c37a41-27ab-4aa2-8636-84ea7deded1d';
    expect(usdaKeyCheck()).toMatch(/36 characters — a USDA key is 40 characters/);
    delete process.env.USDA_API_KEY;
    expect(usdaKeyCheck()).toMatch(/missing/);
  });
});
