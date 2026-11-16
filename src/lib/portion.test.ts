import { describe, expect, it } from 'vitest';
import { portionKind, suggestPortions } from './portion';

const rice = { index: 0, name: 'Rice', grams: 250, per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } };
const chicken = { index: 1, name: 'Chicken breast', grams: 120, per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 } };
const greens = { index: 2, name: 'Spinach', grams: 50, per100: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 } };
const targets = { kcal: 1800, protein: 130 };

describe('portion coach', () => {
  it('classifies foods', () => {
    expect(portionKind(rice.per100)).toBe('dense');
    expect(portionKind(chicken.per100)).toBe('protein');
    expect(portionKind(greens.per100)).toBe('veg');
  });

  it('suggests less starch, keeps protein, adds veg when the plate is over budget', () => {
    const big = { ...rice, grams: 450 };
    const p = suggestPortions({ items: [big, chicken, greens], targets, eaten: { kcal: 1300, protein: 80 }, hour: 19 })!;
    expect(p.direction).toBe('less');
    const r = p.rows.find((x) => x.index === 0)!;
    expect(r.to).toBeLessThan(r.from);
    expect(r.to).toBeGreaterThanOrEqual(r.from * 0.4);
    expect(p.rows.find((x) => x.index === 1)!.to).toBe(120);
    expect(p.rows.find((x) => x.index === 2)!.to).toBeGreaterThan(50);
    expect(p.message).toMatch(/Your rice is about 450 g/);
  });

  it('suggests more when someone is under-eating for their day', () => {
    const p = suggestPortions({ items: [{ ...rice, grams: 100 }, { ...chicken, grams: 60 }], targets: { kcal: 3000, protein: 160 }, eaten: { kcal: 600, protein: 30 }, hour: 13, goals: ['muscle'] })!;
    expect(['more', 'protein']).toContain(p.direction);
    expect(p.after.kcal).toBeGreaterThan(p.before.kcal);
    expect(p.rows.every((r) => r.to >= r.from)).toBe(true);
  });

  it('asks for more protein without raising calories much', () => {
    const p = suggestPortions({ items: [{ ...rice, grams: 300 }, { ...chicken, grams: 60 }], targets: { kcal: 2000, protein: 150 }, eaten: { kcal: 400, protein: 20 }, hour: 13 })!;
    expect(p.rows.find((x) => x.index === 1)!.to).toBeGreaterThan(60);
    expect(p.after.protein).toBeGreaterThan(p.before.protein);
  });

  it('says keep when the plate already fits', () => {
    const p = suggestPortions({ items: [{ ...rice, grams: 200 }, { ...chicken, grams: 140 }, greens], targets, eaten: { kcal: 700, protein: 50 }, hour: 13 })!;
    expect(p.direction).toBe('keep');
    expect(p.rows.every((r) => r.to === r.from)).toBe(true);
  });

  it('never suggests less in pregnancy', () => {
    const p = suggestPortions({ items: [{ ...rice, grams: 600 }, chicken], targets, eaten: { kcal: 1500, protein: 100 }, hour: 19, pregnant: true })!;
    expect(p.rows.every((r) => r.to >= r.from)).toBe(true);
  });

  it('flags a plate with no protein food', () => {
    const p = suggestPortions({ items: [{ ...rice, grams: 200 }], targets, eaten: { kcal: 0, protein: 0 }, hour: 13 })!;
    expect(p.addProtein).toBe(true);
    expect(p.message).toMatch(/no clear protein/);
  });
});
