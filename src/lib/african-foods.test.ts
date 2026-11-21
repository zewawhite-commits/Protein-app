import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { loadFoodDb, searchFoods } from './foods';
import { gramsFor, parseSaid } from './describe';

// The foods Nutivili is built for: searching, amounts and nutrition must be right for them.
beforeAll(async () => {
  (globalThis as unknown as { fetch: unknown }).fetch = async () => new Response(readFileSync('public/data/foods.json', 'utf8'));
  await loadFoodDb();
}, 60000);

describe('African foods', () => {
  it.each([
    ['jollof rice', /^Jollof rice$/], ['jollof rice with chicken', /^Jollof rice$/], ['tuwo shinkafa', /Tuwo shinkafa/], ['miyan kuka', /Miyan kuka/],
    ['egusi soup', /Egusi/], ['pounded yam', /Pounded yam/], ['suya', /Suya/], ['moi moi', /Moi moi/], ['akara', /Akara/], ['masa', /Masa/],
    ['nigerian fried rice', /fried rice/i], ['eba', /Eba/], ['amala', /Amala/], ['fufu', /Fufu/], ['pepper soup', /pepper soup/i], ['boiled rice', /Rice, white/],
    ['ofada rice', /Rice, brown.*cook/], ['efo riro', /Efo riro/], ['ogbono soup', /Ogbono/], ['banga soup', /Banga/], ['puff puff', /Puff puff/],
  ])('"%s" finds the right food', (q, re) => {
    expect(searchFoods(q, {})[0]?.name).toMatch(re);
  });
  it('nutrition is plausible and protein-rich foods rank as such', () => {
    const get = (q: string) => searchFoods(q, {})[0].per100;
    expect(get('suya').protein).toBeGreaterThan(20);
    expect(get('egusi soup').protein).toBeGreaterThan(8);
    expect(get('eba').protein).toBeLessThan(2);
    for (const q of ['jollof rice', 'moi moi', 'akara', 'pounded yam']) { const p = get(q); expect(p.kcal).toBeGreaterThan(50); expect(p.kcal).toBeLessThan(500); }
  });
  it('spoken amounts use the food’s own servings, never a different one', () => {
    const amount = (s: string) => parseSaid(s).map((p) => { const f = searchFoods(p.text, {})[0]; return gramsFor(f, p.qty, p.unit)?.grams ?? null; });
    expect(amount('two plates of jollof rice')).toEqual([700]);
    expect(amount('one wrap of moi moi and 3 akara')).toEqual([150, 90]);
    expect(amount('a stick of suya')).toEqual([100]);
    const plantain = amount('2 slices of plantain')[0];
    expect(plantain === null || plantain < 150).toBe(true); // never "2 wraps of swallow"
  });
});
