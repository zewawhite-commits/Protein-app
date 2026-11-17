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
}, 30_000); // parsing the 13k-food database can be slow on a busy machine

const item = (over: Partial<RecognitionResult['items'][number]>) => ({
  name: '', localName: '', cuisine: '', searchQueries: [], state: 'cooked' as const, estimatedGrams: 0, confidence: 'high' as const, ingredients: [], ...over,
});

describe('standard-recipe dishes', () => {
  it('are built only from listed official records and show them', async () => {
    const db = await loadFoodDb();
    const egusi = db.foods.find((f) => f.name === 'Egusi soup')!;
    expect(egusi.source).toBe('recipe');
    expect(egusi.aliases).toContain('egushi');
    expect(egusi.sourceNote).toMatch(/Melon seed.*\[FAO 06_013\]/);
    expect(egusi.per100.protein).toBeGreaterThan(5);
    expect(egusi.per100.kcal).toBeGreaterThan(100);
  });
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
    ['egusi', 'Egusi soup'],
    ['egushi', 'Egusi soup'], // spelling slip
    ['jollof rice', 'Jollof rice'],
    ['moin moin', 'Moi moi'],
    ['ackee', 'Ackee and saltfish'],
    ['fish and chips', 'Fish and chips'],
    ['chiken breast', 'Chicken'], // typo
    ['doro wat', 'Doro wat'],
    ['bulgogi', 'Bulgogi'],
    ['feijoada', 'Feijoada'],
    ['biltong', 'jerky'], // local name → table name
    ['jacket potato', 'Jacket potato'],
    ['haggis', 'Haggis'], // UK table
    ['lamington', 'lamington'], // Australian table
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
    for (const f of m.candidates) expect(['usda-sr', 'usda-fndds', 'fao-wafct', 'uk-cofid', 'au-afcd', 'recipe', 'custom']).toContain(f.source);
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

import { confidentMatch } from './foods';
describe('confident matching for AI-suggested foods', () => {
  it('never matches word fragments, but finds real records', async () => {
    await loadFoodDb();
    expect(confidentMatch(['ogbono soup'])?.name).toBe('Ogbono soup'); // standard recipe now
    expect(confidentMatch(['kpekere chips'])?.name ?? null).toBeNull(); // no record — never a lookalike
    expect(confidentMatch(['kpekere chips', 'cowpeas boiled'])?.name).toMatch(/cowpea/i);
    expect(confidentMatch(['moi moi'])?.name).toBe('Moi moi'); // standard recipe
    expect(confidentMatch(['chicken breast roasted'])?.name).toMatch(/chicken.*breast/i);
    expect(confidentMatch(['egg whole hard-boiled'])?.name).toMatch(/egg/i);
  });
});

import { itemQueries } from './recognize-client';
describe('cooking method and portion range', () => {
  it('adds the cooking method to the most specific search and keeps a sane range', () => {
    const r = sanitize({ isFood: true, note: '', photoQuality: 'poor', items: [item({ name: 'Plantain', searchQueries: ['plantain'], estimatedGrams: 120, method: 'fried', gramsLow: 300, gramsHigh: 50 })] });
    expect(itemQueries(r.items[0])[0]).toBe('plantain fried');
    expect(r.items[0].gramsLow).toBeLessThanOrEqual(120);
    expect(r.items[0].gramsHigh).toBeGreaterThanOrEqual(120);
    expect(r.photoQuality).toBe('poor');
    const old = sanitize({ isFood: true, note: '', items: [item({ name: 'Rice', estimatedGrams: 200 })] });
    expect(old.items[0].method).toBe('none');
    expect(old.photoQuality).toBe('fair');
  });
});

describe('hidden extras', () => {
  it('keeps a little ≤ usual ≤ a lot and drops empty ones', () => {
    const r = sanitize({ isFood: true, note: '', items: [item({ name: 'Fried rice', estimatedGrams: 300, hidden: [
      { name: 'Cooking oil', searchQueries: ['oil vegetable'], little: 20, usual: 10, lot: 5 },
      { name: 'Nothing', searchQueries: [], little: 0, usual: 0, lot: 0 },
    ] })] });
    expect(r.items[0].hidden).toEqual([{ name: 'Cooking oil', searchQueries: ['oil vegetable'], little: 20, usual: 20, lot: 20 }]);
    expect(sanitize({ isFood: true, note: '', items: [item({ name: 'Apple' })] }).items[0].hidden).toEqual([]);
  });
});
