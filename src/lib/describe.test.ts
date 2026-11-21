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
import { parseRoutineText } from './liveWorkout';
describe('importing a workout plan', () => {
  it('reads common formats', () => {
    expect(parseRoutineText('Day 1\n1. Squat 3x8 60kg\n- Bench press – 4 sets of 10 @ 50 kg\nPlank 3 x 45s\nPull-ups 3x8-10')).toEqual([
      { name: 'Squat', sets: 3, reps: '8', weightKg: 60 },
      { name: 'Bench press', sets: 4, reps: '10', weightKg: 50 },
      { name: 'Plank', sets: 3, reps: '45s' },
      { name: 'Pull-ups', sets: 3, reps: '8-10' },
    ]);
  });
});

describe('lastAmount', () => {
  it('uses the most recent amount for the same food, skipping planned ones', async () => {
    const { lastAmount } = await import('./describe');
    const e = (foodId: string, grams: number, loggedAt: number, planned = false) => ({ foodId, food: { name: foodId }, grams, loggedAt, planned });
    expect(lastAmount([e('a', 100, 1), e('a', 150, 2), e('a', 300, 3, true), e('b', 50, 4)], { id: 'a', name: 'a' })).toBe(150);
    expect(lastAmount([e('b', 50, 4)], { id: 'a', name: 'a' })).toBeNull();
  });
});

describe('natural speech', () => {
  it('keeps every food from a conversational sentence without "and"', () => {
    const r = parseSaid('Hey I had two boiled eggs a cup of rice and three chicken wings');
    expect(r.map((x) => [x.text, x.qty, x.unit])).toEqual([['boiled eggs', 2, null], ['rice', 1, 'cup'], ['chicken wings', 3, null]]);
  });
  it('handles fillers, half a cup and plain lists', () => {
    expect(parseSaid('um so for breakfast I just had half a cup of oats, 2 eggs').map((x) => [x.text, x.qty])).toEqual([['oats', 0.5], ['eggs', 2]]);
    expect(parseSaid('jollof rice and chicken').map((x) => x.text)).toEqual(['jollof rice', 'chicken']);
  });
});
