import { describe, expect, it } from 'vitest';
import { cleanWorkoutRequest, sanitizeWorkout } from './workout';
import { sanitizeRecipe } from './recipe';

describe('workout guide', () => {
  it('cleans requests and plans', () => {
    expect(cleanWorkoutRequest({ daysPerWeek: 99, minutes: 2, place: 'moon', level: 'pro' })).toMatchObject({ daysPerWeek: 7, minutes: 10, place: 'gym', level: 'beginner', focus: '', goal: 'general' });
    const p = sanitizeWorkout({ title: 'Week', days: [{ name: 'Day 1', focus: 'Upper', minutes: 40, warmup: '5 min row', exercises: [{ name: 'Push-up', sets: 3, reps: '10', restSeconds: 60, how: 'Brace' }, { name: '' }] }, { name: 'Empty', exercises: [] }], tips: ['Sleep'] });
    expect(p.days).toHaveLength(1);
    expect(p.days[0].exercises).toHaveLength(1);
    expect(p.daysPerWeek).toBe(1);
  });
});

describe('recipes', () => {
  it('keeps ingredients with weights and strips any nutrient numbers from the tip', () => {
    const r = sanitizeRecipe({ title: 'Egusi', servings: 4, minutes: 60, ingredients: [{ name: 'Melon seed', localName: 'egusi', searchQueries: ['melon seed'], grams: 150, note: 'ground' }, { name: 'Salt', grams: 0 }], steps: ['Fry'], tip: 'Packs 30 g protein a bowl' });
    expect(r.ingredients).toHaveLength(1);
    expect(r.tip).not.toMatch(/30 g/);
    expect(r.servings).toBe(4);
  });
});

import { recipePer100 } from '@/pages/RecipeBuilder';
import { computeNudges, dueExtra } from './nudges';

describe('homemade recipe calculator', () => {
  const p = (protein: number, kcal: number | null) => ({ protein, kcal, fat: 0, carbs: 0, fiber: 0 });
  it('divides ingredient totals by the cooked weight', () => {
    // 200 g chicken (31 g protein, 165 kcal /100 g) + 100 g rice (2.7 g, 130 kcal) cooked down to 250 g
    const r = recipePer100([{ foodId: 'a', name: 'Chicken', grams: 200, per100: p(31, 165) }, { foodId: 'b', name: 'Rice', grams: 100, per100: p(2.7, 130) }], 250);
    expect(r.protein).toBeCloseTo((62 + 2.7) / 2.5, 1);
    expect(r.kcal).toBeCloseTo((330 + 130) / 2.5, 0);
  });
  it('leaves a nutrient unknown when too much of the recipe has no value for it', () => {
    const r = recipePer100([{ foodId: 'a', name: 'A', grams: 100, per100: p(10, null) }, { foodId: 'b', name: 'B', grams: 100, per100: p(10, 100) }], 200);
    expect(r.kcal).toBeNull();
    expect(r.protein).toBe(10);
  });
});

describe('workout and weigh-in reminders', () => {
  const at = (h: number) => new Date(2026, 10, 16, h, 5);
  it('fires once in its window and never after the thing is done', () => {
    const r = { workoutOn: true, workout: '18:00', weighOn: true, weigh: '07:30' };
    expect(dueExtra(at(18), r, { workedOut: false, weighed: true }, [])).toBe('workout');
    expect(dueExtra(at(18), r, { workedOut: true, weighed: true }, [])).toBeNull();
    expect(dueExtra(at(18), r, { workedOut: false, weighed: true }, ['workout'])).toBeNull();
    expect(dueExtra(at(8), r, { workedOut: false, weighed: false }, [])).toBe('weigh');
    expect(dueExtra(at(23), r, { workedOut: false, weighed: false }, [])).toBeNull();
  });
  it('uses kind wording when over calories', () => {
    const n = computeNudges({ date: '2026-11-16', now: at(21), entries: [], totals: { kcal: 2600, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 } as never, proteinGoal: 0, targets: { kcal: 2000, fiber: 28 } as never, streak: 0 });
    const over = n.find((x) => x.id.endsWith('warn:kcal'))!;
    expect(over.body).toMatch(/week that counts/);
    expect(over.title + over.body).not.toMatch(/fail|bad|guilt/i);
  });
});

describe('gentle mode', () => {
  it('drops streak and over-target notices', () => {
    const base = { date: '2026-11-16', now: new Date(2026, 10, 16, 21, 0), entries: [], totals: { kcal: 2600, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 } as never, proteinGoal: 0, targets: { kcal: 2000, fiber: 28 } as never, streak: 5 };
    expect(computeNudges(base).some((n) => /warn:kcal|win:streak/.test(n.id))).toBe(true);
    expect(computeNudges({ ...base, gentle: true }).some((n) => /warn:kcal|win:streak/.test(n.id))).toBe(false);
  });
});

import { measuredBurn, targetFromBurn } from './energy';

describe('smart calorie target', () => {
  const key = (n: number) => { const d = new Date('2026-11-01T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const eat = (n: number, kcal: number) => ({ date: key(n), grams: 100, food: { per100: { kcal } } });
  it('works out real burn from intake and weight trend', () => {
    // 2,000 kcal a day for 21 days while losing 0.5 kg a week → burning about 2,550
    const entries = Array.from({ length: 21 }, (_, i) => eat(i, 2000));
    const weights = [0, 5, 10, 15, 20].map((n) => ({ date: key(n), kg: 80 - (0.5 / 7) * n }));
    const m = measuredBurn(entries, weights, key(20), 2500)!;
    expect(m.kcal).toBeGreaterThan(2500);
    expect(m.kcal).toBeLessThan(2600);
    expect(m.kgPerWeek).toBeCloseTo(-0.5, 1);
  });
  it('waits for enough data and ignores implausible results', () => {
    expect(measuredBurn([eat(0, 2000)], [{ date: key(0), kg: 80 }], key(20), 2500)).toBeNull();
    // Barely-logged days (under 800 kcal) don't count as full days.
    const thin = Array.from({ length: 21 }, (_, i) => eat(i, 300));
    const weights = [0, 5, 10, 15, 20].map((n) => ({ date: key(n), kg: 80 }));
    expect(measuredBurn(thin, weights, key(20), 2500)).toBeNull();
    // Clamped to within 25% of the formula.
    const wild = Array.from({ length: 21 }, (_, i) => eat(i, 6000));
    expect(measuredBurn(wild, weights, key(20), 2400)!.kcal).toBeLessThanOrEqual(3000);
  });
  it('never suggests a target below the safe floor', () => {
    expect(targetFromBurn({ sex: 'female', bodyWeightKg: 60, goalWeightKg: 50, paceKgPerWeek: 1, goals: ['fatloss'] } as never, 1600)).toBe(1200);
  });
});

import { labelPer100, sanitizeLabel } from './label';

describe('food label reading', () => {
  const base = { isLabel: true, name: 'Skyr', basis: 'per100g' as const, servingGrams: 150, kcal: 63, protein: 10.6, carbs: 4, fat: 0.2, fiber: null, sugar: 4, satFat: 0.1, sodiumMg: null, saltG: 0.1, note: '' };
  it('keeps printed values, converts salt to sodium and leaves missing ones unknown', () => {
    const p = labelPer100(sanitizeLabel(base))!;
    expect(p).toMatchObject({ kcal: 63, protein: 10.6, carbs: 4, fat: 0.2, sodium: 40 });
    expect(p.fiber).toBeNull();
  });
  it('scales per-serving labels by the printed serving size, or refuses without one', () => {
    const perServing = { ...base, basis: 'perServing' as const, servingGrams: 30, kcal: 120, protein: 6, carbs: 15, fat: 4 };
    expect(labelPer100(sanitizeLabel(perServing))).toMatchObject({ kcal: 400, protein: 20, carbs: 50 });
    expect(labelPer100(sanitizeLabel({ ...perServing, servingGrams: 0 }))).toBeNull();
  });
  it('rejects non-labels and impossible readings', () => {
    expect(labelPer100(sanitizeLabel({ ...base, isLabel: false }))).toBeNull();
    expect(labelPer100(sanitizeLabel({ ...base, protein: 60, carbs: 50, fat: 20 }))).toBeNull(); // 130 g of macros in 100 g
    expect(labelPer100(sanitizeLabel({ ...base, kcal: null, protein: null }))).toBeNull();
  });
});
