import { describe, expect, it } from 'vitest';
import { gramsFor, parseSaid } from './describe';

describe('reading what people say', () => {
  it('splits foods and reads amounts', () => {
    expect(parseSaid('I had 2 boiled eggs and a cup of rice, 3 chicken wings')).toEqual([
      { text: 'boiled eggs', qty: 2, unit: null },
      { text: 'rice', qty: 1, unit: 'cup' },
      { text: 'chicken wings', qty: 3, unit: null },
    ]);
    expect(parseSaid('200g jollof rice with 150 grams of chicken')).toEqual([
      { text: 'jollof rice', qty: 200, unit: 'g' },
      { text: 'chicken', qty: 150, unit: 'gram' },
    ]);
    expect(parseSaid('banana')).toEqual([{ text: 'banana', qty: null, unit: null }]);
  });
  it('uses the food’s own servings, never a guess', () => {
    const wing = { name: 'Chicken wing, fried', portions: [{ label: '1 wing', grams: 32 }, { label: '1 cup', grams: 140 }] };
    expect(gramsFor(wing, 3, null)).toEqual({ grams: 96, how: '3 × 1 wing' });
    expect(gramsFor(wing, 1, 'cup')).toEqual({ grams: 140, how: '1 × 1 cup' });
    expect(gramsFor(wing, 200, 'g')).toEqual({ grams: 200, how: '200 g' });
    expect(gramsFor({ name: 'Mystery', portions: [] }, 3, 'piece')).toBeNull();
  });
});
import { parseAmount } from './describe';
describe('answers to “how many?”', () => {
  it('reads numbers and units', () => {
    expect(parseAmount('three')).toEqual({ qty: 3, unit: null });
    expect(parseAmount('about 2 pieces')).toEqual({ qty: 2, unit: 'piece' });
    expect(parseAmount('150 grams')).toEqual({ qty: 150, unit: 'gram' });
    expect(parseAmount('a cup')).toEqual({ qty: 1, unit: 'cup' });
  });
});
describe('units are read whole', () => {
  it('lbs is pounds, not litres', () => {
    expect(parseAmount('2 lbs')).toEqual({ qty: 2, unit: 'lb' });
  });
});
