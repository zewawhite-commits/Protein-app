import { describe, expect, it } from 'vitest';
import { cleanWorkoutRequest, sanitizeWorkout } from './workout';
import { sanitizeRecipe } from './recipe';

describe('workout guide', () => {
  it('cleans requests and plans', () => {
    expect(cleanWorkoutRequest({ daysPerWeek: 99, minutes: 2, place: 'moon', level: 'pro' })).toEqual({ daysPerWeek: 7, minutes: 10, place: 'gym', level: 'beginner', focus: '' });
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
