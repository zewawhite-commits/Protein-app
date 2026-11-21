import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { boneInFood, loadFoodDb, searchFoods } from './foods';
import { alcoholPer100 } from './nutrition';
import { boneInQuery, detailQuery, detailQuestion, gramsFor, naturalServings, parseAmount, parseSaid, questionFor, soupProteinQuestion } from './describe';

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

describe('how it was cooked picks the right food (audit fixes)', () => {
  it.each([
    ['fried egg', /^Egg, whole, cooked, fried/],
    ['scrambled eggs', /scrambled/],
    ['boiled chicken', /^Chicken.*breast.*stewed/],
    ['porridge', /oats.*cooked with water/],
    ['oats cooked', /oats.*cooked with water/],
    ['fried potatoes', /french fries/i],
    ['uncooked pasta', /^Pasta, dry/],
    ['raw rice', /^Rice, white, long.?grain.*raw/],
    ['beans', /^Cowpeas.*cooked, boiled/],
    ['pap', /ogi/],
    ['goat meat', /^Goat meat.*(boiled|grilled|stewed)/],
    ['turkey', /roasted|grilled|cooked/],
    ['chicken breast raw', /raw/],
    ['apple', /^Apple, raw/],
  ])('"%s"', (q, re) => expect(food(q).name).toMatch(re));
});

describe('smoothies are logged as what is in them', () => {
  it('splits the ingredients and drops the generic drink', () => {
    const said = parseSaid('smoothie with banana milk and peanut butter');
    expect(said.map((s) => [s.text, s.partOf])).toEqual([['banana', 'smoothie'], ['milk', 'smoothie'], ['peanut butter', 'smoothie']]);
  });
  it('keeps amounts and two-word ingredients', () => {
    const said = parseSaid('a protein shake made with 300ml almond milk, one banana and 2 tbsp peanut butter');
    expect(said.map((s) => [s.text, s.qty, s.unit])).toEqual([['almond milk', 300, 'ml'], ['banana', 1, null], ['peanut butter', 2, 'tbsp']]);
  });
  it('finds the right foods', () => {
    expect(food('milk').name).toMatch(/^Milk/);
    expect(food('banana').name).toMatch(/^Banana/);
  });
});

describe('asking how meat and fish were cooked (audit fixes)', () => {
  const first = (qs: string[]) => { for (const q of qs) { const f = searchFoods(q, {})[0]; if (f) return f.name; } return null; };
  it('asks only when it matters', () => {
    expect(detailQuestion('chicken')?.q).toMatch(/which part.*how it was cooked.*skin/);
    expect(detailQuestion('fried chicken')?.q).toMatch(/which part/);
    expect(detailQuestion('fried chicken thigh with skin')).toBeNull();
    expect(detailQuestion('chicken suya')).toBeNull();
    expect(detailQuestion('chicken stew')).toBeNull();
    expect(detailQuestion('fish')?.q).toMatch(/which fish.*fried, grilled, smoked or boiled/);
    expect(detailQuestion('fried tilapia')).toBeNull();
    expect(detailQuestion('jollof rice')).toBeNull();
  });
  it('the answer picks the matching record', () => {
    expect(first(detailQuery('chicken', 'chicken', 'fried thigh with skin'))).toMatch(/^Chicken thigh, fried, coated, skin \/ coating eaten/);
    expect(first(detailQuery('chicken', 'chicken', 'breast, grilled, no skin'))).toMatch(/^Chicken breast, grilled without sauce, skin not eaten/);
    expect(first(detailQuery('chicken', 'chicken', 'boiled drumstick'))).toMatch(/drumstick.*stewed/i);
    expect(first(detailQuery('fish', 'fish', 'tilapia, fried'))).toMatch(/tilapia, fried/i);
    expect(first(detailQuery('fish', 'fish', 'smoked mackerel'))).toMatch(/mackerel.*smoked/i);
    expect(first(detailQuery('fish', 'fried fish', 'catfish'))).toMatch(/catfish.*fried/i);
  });
  it('weighed with bones uses a measured bone-in record', () => {
    const bone = (n: string) => boneInFood(food(n), boneInQuery(n))?.name;
    expect(boneInFood(food('chicken'), boneInQuery('Chicken thigh, fried, coated, skin / coating eaten, from raw'))?.name).toMatch(/Chicken.*(deep-fried|leg quarter).*weighed with bone/);
    expect(boneInFood(food('cod'), boneInQuery('Fish, cod, grilled'))?.name).toMatch(/Cod.*weighed with bones/);
    expect(bone('Fish, tilapia, fried') ?? 'none').toMatch(/with bones|none/);
    expect(boneInQuery('Jollof rice')).toBeNull();
  });
  it('soups ask about meat or fish; "a bowl" of soup is a medium portion', () => {
    expect(soupProteinQuestion(food('egusi soup'), 'egusi soup')).toMatch(/meat or fish/);
    expect(soupProteinQuestion(food('jollof rice'), 'jollof rice')).toBeNull();
    expect(gramsFor(food('egusi soup'), 1, 'bowl')?.grams).toBe(250);
  });
});

describe('counted foods', () => {
  it('"one" banana is a whole banana, not an inch of one', () => {
    expect(answer('banana', 'one')).toBe(126);
    expect(questionFor(food('banana'), 'banana').q).toMatch(/How many bananas/);
  });
});

describe('alcohol', () => {
  it('is worked out for drinks and nothing else', () => {
    expect(alcoholPer100('Beer', { kcal: 43, protein: 0.5, carbs: 3.6, fat: 0, fiber: 0 } as never)).toBeCloseTo(3.6, 0);
    expect(alcoholPer100('Rum', { kcal: 231, protein: 0, carbs: 0, fat: 0, fiber: 0 } as never)).toBeCloseTo(33, 0);
    expect(alcoholPer100('Beer, non-alcoholic', { kcal: 37, protein: 0.2, carbs: 8, fat: 0, fiber: 0 } as never)).toBeNull();
    expect(alcoholPer100('Rum cake', { kcal: 380, protein: 4, carbs: 50, fat: 15, fiber: 0 } as never)).toBeNull();
  });
});
