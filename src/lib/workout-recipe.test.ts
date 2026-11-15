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
