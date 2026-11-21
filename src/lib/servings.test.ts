import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { loadFoodDb, searchFoods } from './foods';
import { gramsFor, naturalServings, parseAmount, questionFor } from './describe';

// Every kind of food is asked about, and understood, in the way it's really measured.
beforeAll(async () => {
  (globalThis as unknown as { fetch: unknown }).fetch = async () => new Response(readFileSync('public/data/foods.json', 'utf8'));
  await loadFoodDb();
}, 60000);

const food = (q: string) => searchFoods(q, {})[0];
const ask = (q: string) => questionFor(food(q), q).q;
const answer = (q: string, said: string) => {
  const f = food(q); const { unit } = questionFor(f, q); const a = parseAmount(said);
  return a.qty == null ? null : gramsFor(f, a.qty, a.unit ?? (a.size ? null : unit), a.size)?.grams ?? null;
};

describe('questions fit the food', () => {
  it.each([
    ['chocolate cake', /How many slices of chocolate cake/],
    ['white bread', /How many slices of white bread/],
    ['orange juice', /drink: a glass, a cup, or how many ml/],
    ['milk', /drink: a glass, a cup/],
    ['coca cola', /drink/],
    ['peanut butter', /How many spoons of peanut butter: teaspoons or tablespoons/],
    ['olive oil', /spoons/],
    ['apple', /How many apple\? You can say small, medium or large/],
    ['egg', /How many egg/],
    ['yogurt', /How many pots of yogurt/],
    ['indomie', /How many packs of indomie/],
    ['jollof rice', /plate.*cooking spoons/],
    ['rice', /small, medium or large plate.*cooking spoons/],
    ['egusi soup', /portion.*ladles/],
  ])('%s', (q, re) => expect(ask(q)).toMatch(re));
  it('never asks a cake question like a jollof one, or a soup like a drink', () => {
    expect(ask('chocolate cake')).not.toMatch(/plate|ladle|cooking spoon/);
    expect(ask('egusi soup')).not.toMatch(/glass|slice|bowl/);
    expect(ask('orange juice')).not.toMatch(/slice|plate/);
  });
  it('a food with no natural serving gets its own examples, never made-up ones', () => {
    const q = ask('chicken breast');
    expect(q).toMatch(/For example .*or grams/);
  });
});

describe('answers are understood in those measures', () => {
  it.each([
    ['chocolate cake', 'two slices', 114],
    ['orange juice', 'a glass', 248],
    ['orange juice', '300 ml', 300],
    ['peanut butter', 'one tablespoon', 16], // the record says "2 tbsp = 32 g"
    ['indomie', 'one', 70],
    ['rice', 'medium', 300],
    ['rice', '3 cooking spoons', 300],
    ['egg', 'two', 100],
    ['apple', 'one small', 165],
    ['yogurt', 'one', 170],
  ])('%s: "%s" → %d g', (q, said, g) => expect(answer(q, said)).toBe(g));
});

describe('serving buttons for fixing an amount', () => {
  const names = (q: string) => naturalServings(food(q)).map((s) => s.name);
  it('shows each food its own natural servings first', () => {
    expect(names('egusi soup').slice(0, 3)).toEqual(['medium portion', 'small portion', 'large portion']);
    expect(names('eba')[0]).toBe('medium wrap');
    expect(names('chocolate cake')[0]).toBe('slice');
    expect(names('orange juice')[0]).toBe('glass');
    expect(names('apple')[0]).toBe('medium');
  });
  it('gives the weight of one', () => {
    const pb = naturalServings(food('peanut butter')).find((s) => s.name === 'tbsp');
    expect(pb?.per).toBe(16);
  });
});
