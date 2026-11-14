import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadFoodDb, searchFoods, splitName } from './foods';
import { matchItems } from './recognize-client';
import { sanitize, type RecognitionResult } from './recognition';
import { offToFood } from './openFoodFacts';

beforeAll(async () => {
  const json = JSON.parse(readFileSync('public/data/foods.json', 'utf8'));
  (globalThis as { fetch: unknown }).fetch = async () => ({ ok: true, json: async () => json });
  await loadFoodDb();
});

const item = (over: Partial<RecognitionResult['items'][number]>) => ({
  name: '', localName: '', cuisine: '', searchQueries: [], state: 'cooked' as const, estimatedGrams: 0, confidence: 'high' as const, ...over,
});

describe('international database coverage', () => {
  it.each([
    ['jollof', 'Jollof'], // WAFCT has jollof fonio/macaroni/spaghetti (no jollof rice record)
    ['biryani chicken', 'Biryani'],
    ['pad thai', 'Pad Thai'],
    ['falafel', 'Falafel'],
    ['sushi', 'Sushi'],
    ['fufu', 'fufu'],
    ['bambara groundnut', 'Bambara'],
  ])('finds %s', (q, expected) => {
    expect(searchFoods(q, { limit: 5 }).some((f) => f.name.toLowerCase().includes(expected.toLowerCase()))).toBe(true);
  });
});

describe('matching AI suggestions to records', () => {
  it('matches each recognised item to database candidates, preferring the same state', () => {
    const result = sanitize({
      isFood: true,
      note: '',
      items: [
        item({ name: 'Spicy rice', localName: 'Jollof rice', cuisine: 'West African', searchQueries: ['jollof rice', 'rice tomato sauce'], estimatedGrams: 250 }),
        item({ name: 'Grilled chicken thigh', searchQueries: ['chicken thigh roasted', 'chicken roasted'], estimatedGrams: 140 }),
      ],
    });
    const [rice, chicken] = matchItems(result, []);
    // No jollof-rice record exists, so the generic fallback queries must still produce rice candidates.
    expect(rice.candidates.length).toBeGreaterThan(0);
    expect(rice.candidates.some((f) => /rice/i.test(f.name))).toBe(true);
    expect(chicken.candidates[0].state).toBe('cooked');
    expect(splitName(chicken.candidates[0].name).title.toLowerCase()).toContain('chicken');
  });

  it('never carries nutrient numbers from the AI: candidates are database records', () => {
    const [m] = matchItems(sanitize({ isFood: true, note: '', items: [item({ name: 'Egg', searchQueries: ['egg whole cooked'] })] }), []);
    for (const f of m.candidates) expect(['usda-sr', 'usda-fndds', 'fao-wafct', 'custom']).toContain(f.source);
  });

  it('sanitizes model output', () => {
    const r = sanitize({ isFood: true, note: 'x'.repeat(500), items: [item({ name: 'A', estimatedGrams: 99999, searchQueries: ['a', 'b', 'c', 'd', 'e'] })] });
    expect(r.items[0].estimatedGrams).toBe(2000);
    expect(r.items[0].searchQueries).toHaveLength(4);
    expect(r.note.length).toBe(200);
  });
});

describe('Open Food Facts mapping', () => {
  it('maps label values per 100 g and skips products without protein', () => {
    const f = offToFood({ code: '123', product_name: 'Skyr', brands: 'Isey', serving_quantity: 170, serving_size: '170 g', nutriments: { proteins_100g: 11, 'energy-kcal_100g': 63, fat_100g: 0.2, carbohydrates_100g: 4 } });
    expect(f).toMatchObject({ id: 'off:123', name: 'Skyr, Isey', source: 'off', per100: { protein: 11, kcal: 63, fiber: null } });
    expect(f!.portions[0].grams).toBe(170);
    expect(offToFood({ code: '1', product_name: 'Water', nutriments: {} })).toBeNull();
  });
});
