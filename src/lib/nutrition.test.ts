import { describe, expect, it } from 'vitest';
import { dailyGoal, gramsForProtein, nutrientsFor, scale, sumEntries, toKg } from './nutrition';
import { counterparts, searchFoods } from './foods';
import { addDays, weekOf } from './dates';
import type { Food, LogEntry } from './types';

const chicken = { protein: 31.02, kcal: 165, fat: 3.57, carbs: 0, fiber: 0 };

describe('nutrition', () => {
  it('scales per-100 g values by weight', () => {
    expect(scale(31.02, 150)).toBeCloseTo(46.53, 5);
    expect(scale(null, 150)).toBeNull();
    expect(scale(31.02, 0)).toBe(0);
  });

  it('computes all nutrients for a weight', () => {
    const n = nutrientsFor(chicken, 200);
    expect(n.protein).toBeCloseTo(62.04);
    expect(n.kcal).toBeCloseTo(330);
  });

  it('flags totals that are missing source values', () => {
    const e = (per100: LogEntry['food']['per100'], grams: number) => ({ food: { per100 }, grams }) as LogEntry;
    const t = sumEntries([e(chicken, 100), e({ ...chicken, kcal: null }, 100)]);
    expect(t.protein).toBeCloseTo(62.04);
    expect(t.kcal).toBe(165);
    expect(t.incomplete.kcal).toBe(true);
    expect(t.incomplete.fat).toBe(false);
  });

  it('derives the daily goal', () => {
    expect(dailyGoal({ goalMode: 'perKg', gramsPerKg: 1.6, bodyWeightKg: 80, goalGrams: 0 })).toBe(128);
    expect(dailyGoal({ goalMode: 'perKg', gramsPerKg: 1.6, bodyWeightKg: null, goalGrams: 120 })).toBe(120);
    expect(dailyGoal({ goalMode: 'fixed', gramsPerKg: 1.6, bodyWeightKg: 80, goalGrams: 150 })).toBe(150);
  });

  it('works out grams needed for a protein target', () => {
    expect(gramsForProtein(31.02, 31.02)).toBe(100);
    expect(gramsForProtein(0, 10)).toBeNull();
  });

  it('converts pounds', () => {
    expect(toKg(220.462, 'lb')).toBeCloseTo(100, 2);
  });
});

describe('dates', () => {
  it('builds a Monday-first week', () => {
    const w = weekOf('2026-11-12'); // Thursday
    expect(w[0]).toBe('2026-11-09');
    expect(w[6]).toBe('2026-11-15');
  });
  it('crosses month boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('foods', () => {
  const mk = (id: string, name: string, state: Food['state']): Food => ({ id, name, state, category: '', per100: chicken, portions: [], source: 'usda-sr' });
  const raw = mk('a', 'Chicken, broilers or fryers, breast, meat only, raw', 'raw');
  const cooked = mk('b', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', 'cooked');
  const other = mk('c', 'Chicken, broilers or fryers, thigh, meat only, cooked, roasted', 'cooked');

  it('finds the cooked counterpart of a raw food', () => {
    expect(counterparts(raw, [raw, cooked, other]).map((f) => f.id)).toEqual(['b']);
    expect(counterparts(cooked, [raw, cooked, other]).map((f) => f.id)).toEqual(['a']);
  });

  it('searches custom records with word-prefix matching', () => {
    const custom = [{ ...mk('custom:1', 'Skyr, plain, 0% fat', 'na'), source: 'custom' as const, sourceNote: 'label', createdAt: 0, updatedAt: 0 }];
    expect(searchFoods('sky pla', { custom }).map((f) => f.id)).toEqual(['custom:1']);
    expect(searchFoods('yogurt', { custom })).toEqual([]);
  });
});

import { fitsDiet, suggestGramsPerKg } from './goals';
describe('goal suggestions', () => {
  it('suggests evidence-based targets', () => {
    expect(suggestGramsPerKg('health', 'sedentary')).toBe(0.8);
    expect(suggestGramsPerKg('muscle', 'active')).toBe(1.6);
    expect(suggestGramsPerKg('fatloss', 'active')).toBe(1.8);
    expect(suggestGramsPerKg('muscle', 'sedentary')).toBe(1.2);
    expect(suggestGramsPerKg('performance', 'athlete')).toBe(1.8);
    for (const g of ['muscle', 'fatloss', 'maintain', 'performance', 'health'] as const)
      for (const a of ['sedentary', 'light', 'active', 'athlete'] as const) expect(suggestGramsPerKg(g, a)).toBeLessThanOrEqual(2.0);
  });
  it('filters suggestions by diet', () => {
    expect(fitsDiet({ name: 'Chicken breast' }, 'vegetarian')).toBe(false);
    expect(fitsDiet({ name: 'Fish, salmon' }, 'pescatarian')).toBe(true);
    expect(fitsDiet({ name: 'Egg, whole' }, 'vegetarian')).toBe(true);
    expect(fitsDiet({ name: 'Egg, whole' }, 'vegan')).toBe(false);
    expect(fitsDiet({ name: 'Tofu, firm' }, 'vegan')).toBe(true);
  });
});

import { primaryGoal } from './goals';
describe('multiple goals', () => {
  it('uses the goal that needs the most protein', () => {
    expect(primaryGoal(['maintain', 'fatloss'], 'active')).toBe('fatloss');
    expect(primaryGoal(['health', 'muscle'], 'light')).toBe('muscle');
  });
});
