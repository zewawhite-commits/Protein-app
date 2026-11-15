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

describe('age and pregnancy', () => {
  it('raises the floor for older adults and pregnancy', () => {
    expect(suggestGramsPerKg('health', 'sedentary', { age: 70 })).toBe(1.0);
    expect(suggestGramsPerKg('health', 'sedentary', { pregnant: true })).toBe(1.1);
    expect(suggestGramsPerKg('muscle', 'active', { age: 70 })).toBe(1.6);
  });
});

import { toE164 } from './dialCodes';
describe('phone numbers', () => {
  it('formats international numbers', () => {
    expect(toE164('+234', '0801 234 5678')).toBe('+2348012345678');
    expect(toE164('+44', '07700 900123')).toBe('+447700900123');
    expect(toE164('+234', '+1 (415) 555-0100')).toBe('+14155550100');
  });
});

import { dailyTargets, estimateKcal, restingKcal } from './energy';
describe('calorie targets', () => {
  const base = { name: '', goalMode: 'perKg' as const, goalGrams: 0, gramsPerKg: 1.6, createdAt: 0 };
  it('uses Mifflin–St Jeor', () => {
    // 10*70 + 6.25*175 - 5*30 + 5 = 1648.75
    expect(restingKcal({ bodyWeightKg: 70, heightCm: 175, age: 30, sex: 'male' })).toBeCloseTo(1648.75);
    expect(restingKcal({ bodyWeightKg: 60, heightCm: 165, age: 30, sex: 'female' })).toBeCloseTo(1320.25);
  });
  it('adjusts for goals and activity, with a safety floor', () => {
    const p = { ...base, bodyWeightKg: 70, heightCm: 175, age: 30, sex: 'male' as const, activity: 'active' as const };
    expect(estimateKcal({ ...p, goals: ['maintain'] })).toBe(2560); // 1648.75 * 1.55 = 2555.6
    expect(estimateKcal({ ...p, goals: ['fatloss', 'muscle'] })).toBe(2040);
    expect(estimateKcal({ ...p, goals: ['muscle'] })).toBe(2810);
    expect(estimateKcal({ ...p, bodyWeightKg: 40, heightCm: 150, age: 70, sex: 'female', activity: 'sedentary', goals: ['fatloss'] })).toBe(1200);
    expect(estimateKcal({ ...p, heightCm: undefined })).toBeNull();
  });
  it('splits calories into macros', () => {
    const t = dailyTargets({ ...base, calorieMode: 'fixed', calorieGoal: 2000, bodyWeightKg: 70 }, 120)!;
    expect(t).toMatchObject({ kcal: 2000, protein: 120, fat: 67, carbs: 229, fiber: 28, estimated: false });
  });
});

import { computeNudges, dueReminder } from './nudges';
import { sumEntries as sumE } from './nutrition';
describe('notifications', () => {
  const at = (h: number, m = 0) => { const d = new Date(2026, 10, 14, h, m); return d; };
  it('nudges for unlogged meals after their time and celebrates goals', () => {
    // No nagging by default: meal notices only when the person switched meal reminders on.
    const quiet = computeNudges({ date: 'd', now: at(15), entries: [], totals: sumE([]), proteinGoal: 120, targets: null, streak: 0 });
    expect(quiet.map((n) => n.id)).toEqual([]);
    const none = computeNudges({ date: 'd', now: at(15), entries: [], totals: sumE([]), proteinGoal: 120, targets: null, streak: 0, times: { enabled: true } });
    expect(none.map((n) => n.id)).toEqual(['d:meal:breakfast', 'd:meal:lunch']);
    const e = { id: '1', date: 'd', loggedAt: 0, meal: 'breakfast' as const, foodId: 'x', grams: 500, food: { name: 'Chicken', state: 'cooked' as const, source: 'usda-sr' as const, per100: { protein: 30, kcal: 165, fat: 4, carbs: 0, fiber: 0 } } };
    const won = computeNudges({ date: 'd', now: at(10), entries: [e], totals: sumE([e]), proteinGoal: 120, targets: null, streak: 4 });
    expect(won.map((n) => n.id)).toEqual(['d:win:protein', 'd:win:streak']);
  });
  it('sends each meal reminder once, within two hours', () => {
    const times = { breakfast: '09:00', lunch: '13:00', dinner: '19:00' };
    expect(dueReminder(at(9, 5), [], times, [])).toBe('breakfast');
    expect(dueReminder(at(9, 5), [], times, ['breakfast'])).toBeNull();
    expect(dueReminder(at(12), [], times, [])).toBeNull();
    expect(dueReminder(at(19, 30), [], times, [])).toBe('dinner');
  });
});

import { estimateKcal as est, weeksToGoal } from './energy';
describe('goal weight and pace', () => {
  const base = { name: '', goalMode: 'perKg' as const, goalGrams: 0, gramsPerKg: 1.6, createdAt: 0, bodyWeightKg: 80, heightCm: 180, age: 30, sex: 'male' as const, activity: 'active' as const, goals: ['fatloss' as const] };
  it('sets the deficit from the chosen pace', () => {
    // maintenance = (800+1125-150+5)*1.55 = 2759; 0.5 kg/week → -550/day
    expect(est({ ...base, goalWeightKg: 72, paceKgPerWeek: 0.5 })).toBe(2210);
    expect(weeksToGoal({ bodyWeightKg: 80, goalWeightKg: 72, paceKgPerWeek: 0.5 })).toBe(16);
    expect(est({ ...base, goalWeightKg: 85, paceKgPerWeek: 0.25, goals: ['muscle'] })).toBe(3030);
  });
});

import { burnedKcal } from './exercise';
describe('exercise', () => {
  it('estimates calories from MET × kg × hours', () => {
    expect(burnedKcal('run', 'medium', 30, 80)).toBe(392); // 9.8 × 80 × 0.5
    expect(burnedKcal('walk', 'low', 60, 70)).toBe(196);
    expect(burnedKcal('run', 'high', 0, 80)).toBe(0);
  });
});
