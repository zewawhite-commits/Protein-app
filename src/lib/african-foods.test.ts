import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { loadFoodDb, searchFoods } from './foods';
import { gramsFor, parseAmount, parseSaid, questionFor } from './describe';

// The foods Nutivili is built for: searching, amounts and nutrition must be right for them.
beforeAll(async () => {
  (globalThis as unknown as { fetch: unknown }).fetch = async () => new Response(readFileSync('public/data/foods.json', 'utf8'));
  await loadFoodDb();
}, 60000);

describe('African foods', () => {
  it.each([
    ['jollof rice', /^Jollof rice$/], ['jollof rice with chicken', /^Jollof rice with chicken$/], ['tuwo shinkafa', /Tuwo shinkafa/], ['miyan kuka', /Miyan kuka/],
    ['egusi soup', /Egusi/], ['pounded yam', /Pounded yam/], ['suya', /Suya/], ['moi moi', /Moi moi/], ['akara', /Akara/], ['masa', /Masa/],
    ['nigerian fried rice', /fried rice/i], ['eba', /Eba/], ['amala', /Amala/], ['fufu', /Fufu/], ['pepper soup', /pepper soup/i], ['boiled rice', /Rice, white/],
    ['ofada rice', /Rice, brown.*cook/], ['efo riro', /Efo riro/], ['ogbono soup', /Ogbono/], ['banga soup', /Banga/], ['puff puff', /Puff puff/],
    ['beans porridge', /beans/i], ['fried plantain', /plantain/i], ['waakye', /Waakye/i], ['kelewele', /Kelewele/i],
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
    const amount = (s: string) => parseSaid(s).map((p) => { const f = searchFoods(p.text, {})[0]; return gramsFor(f, p.qty, p.unit, p.size)?.grams ?? null; });
    expect(amount('two plates of jollof rice')).toEqual([600]);
    expect(amount('a small plate of jollof rice')).toEqual([200]);
    expect(amount('3 cooking spoons of jollof rice')).toEqual([300]);
    expect(amount('two big wraps of eba')).toEqual([700]);
    expect(amount('one wrap of moi moi and 3 akara')).toEqual([196, 90]);
    expect(amount('a stick of suya')).toEqual([80]);
    expect(amount('2 ladles of egusi soup')).toEqual([300]);
    const plantain = amount('2 slices of plantain')[0];
    expect(plantain === null || plantain < 150).toBe(true); // never "2 wraps of swallow"
  });

  // Asked the way these foods are really served (docs/portions.md) — never "how many bowls" of soup.
  const food = (q: string) => searchFoods(q, {})[0];
  const ask = (q: string) => questionFor(food(q), q).q;
  it('asks in real West African measures', () => {
    expect(ask('egusi soup')).toMatch(/small, medium or large portion.*ladles/);
    expect(ask('egusi soup')).not.toMatch(/bowl|ball/);
    for (const s of ['ogbono soup', 'efo riro', 'okra soup', 'banga soup', 'afang soup']) expect(ask(s)).toMatch(/portion/);
    expect(ask('eba')).toMatch(/How many wraps of eba/);
    expect(ask('pounded yam')).toMatch(/wraps/);
    expect(ask('jollof rice')).toMatch(/small, medium or large plate.*cooking spoons/);
    expect(ask('moi moi')).toBe('How many moi moi?');
    expect(ask('akara')).toBe('How many akara?');
    expect(ask('suya')).toMatch(/sticks of suya/);
    expect(ask('pepper soup')).toMatch(/bowl/);
  });
  it('understands the answers', () => {
    const answer = (q: string, said: string) => { const f = food(q); const { unit } = questionFor(f, q); const a = parseAmount(said); return a.qty == null ? null : gramsFor(f, a.qty, a.unit ?? (a.size ? null : unit), a.size)?.grams ?? null; };
    expect(answer('egusi soup', 'medium')).toBe(250);
    expect(answer('egusi soup', 'a big one')).toBe(350);
    expect(answer('egusi soup', 'small portion')).toBe(150);
    expect(answer('egusi soup', 'two')).toBe(300); // two ladles
    expect(answer('egusi soup', '2 cooking spoons')).toBe(150);
    expect(answer('eba', 'two')).toBe(500);
    expect(answer('eba', 'one small')).toBe(150);
    expect(answer('jollof rice', 'large plate')).toBe(400);
    expect(answer('jollof rice', '3 cooking spoons')).toBe(300);
    expect(answer('moi moi', '2')).toBe(392);
    expect(answer('akara', 'five')).toBe(150);
    expect(answer('egusi soup', 'I don\'t know')).toBe(null); // asks again, never guesses
  });
});
