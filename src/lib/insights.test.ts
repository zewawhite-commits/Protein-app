import { describe, expect, it } from 'vitest';
import { eatingPatterns, nutrientGaps } from './insights';
import { targetWarnings } from './energy';

const e = (date: string, meal: string, protein: number, kcal: number, grams = 100, extra: Record<string, number> = {}) =>
  ({ id: Math.random().toString(), date, loggedAt: 0, meal, foodId: 'x', grams, food: { name: meal === 'breakfast' ? 'Toast' : 'Chicken', state: 'cooked', source: 'usda-sr', per100: { protein, kcal, carbs: 10, fat: 5, fiber: 1, ...extra } } }) as never;

describe('nutrition insights', () => {
  const days = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  const log = days.flatMap((d) => [e(d, 'breakfast', 3, 250), e(d, 'dinner', 30, 600, 300)]);

  it('finds nutrients under 70% of the daily value, needing 3+ logged days', () => {
    const { gaps, loggedDays } = nutrientGaps(log, '2026-11-15');
    expect(loggedDays).toBe(6);
    expect(gaps[0].pct).toBeLessThan(70);
    expect(gaps).toHaveLength(3);
    expect(gaps.every((g) => g.pct < 70)).toBe(true);
    expect(nutrientGaps(log.slice(0, 4), '2026-11-15').gaps).toEqual([]);
  });

  it('describes patterns only when the data shows them', () => {
    const p = eatingPatterns(log, '2026-11-16', 120);
    expect(p.find((x) => x.title.startsWith('Protein goal'))?.title).toBe('Protein goal: 0 of 6 days');
    expect(p.some((x) => x.title === 'Light on protein at breakfast')).toBe(true);
    expect(eatingPatterns(log.slice(0, 4), '2026-11-16', 120)).toEqual([]);
  });

  it('flags unusual targets', () => {
    expect(targetWarnings({ bodyWeightKg: 60, sex: 'female' } as never, 200, 1100).length).toBe(2);
    expect(targetWarnings({ bodyWeightKg: 80, sex: 'male', age: 30, heightCm: 180, activity: 'active' } as never, 140, 2400)).toEqual([]);
  });
});

import { labelHighlights } from './label';
describe('label highlights', () => {
  it('uses UK thresholds per 100 g and halves them for drinks', () => {
    const t = (x: { text: string }[]) => x.map((h) => h.text);
    expect(t(labelHighlights({ kcal: 500, protein: 6, sugar: 30, fat: 25, satFat: 10, sodium: 400, fiber: 1 }, 'g'))).toEqual(['High in sugar', 'High in fat', 'High in saturated fat']);
    expect(t(labelHighlights({ kcal: 60, protein: 10, sugar: 4, fat: 0.2, satFat: 0.1, sodium: 40, fiber: 0 }, 'g'))).toEqual(['Low in sugar', 'Low in fat', 'Low in saturated fat', 'Low in salt', 'High in protein']);
    expect(t(labelHighlights({ kcal: 42, protein: 0, sugar: 12, fat: 0, satFat: 0, sodium: 10 }, 'ml'))).toContain('High in sugar');
  });
});

import { groupDuplicates } from './foods';
describe('duplicate foods in search', () => {
  const f = (id: string, name: string, kcal: number, source = 'usda-sr') => ({ id, name, state: 'raw', source, per100: { protein: 1, kcal } }) as never;
  it('groups the same food from different tables and flags conflicting calories', () => {
    const g = groupDuplicates([f('a', 'Onions, raw', 40), f('b', 'Onions, raw', 41, 'uk-cofid'), f('c', 'Garlic, raw', 149), f('d', 'Onions, raw*', 60, 'au-afcd')]);
    expect(g.map((x) => x.food.id)).toEqual(['a', 'c']);
    expect(g[0].others.map((x) => x.id)).toEqual(['b', 'd']);
    expect(g[0].conflict).toBe(true);
    expect(groupDuplicates([f('a', 'Onions, raw', 40), f('b', 'Onions, raw', 41)])[0].conflict).toBe(false);
  });
});
