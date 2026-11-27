import { describe, expect, it } from 'vitest';
import { densityOf, measuresFor, suggestedUnits } from './units';
import type { Food } from './types';

const food = (name: string, portions: [string, number][], source: Food['source'] = 'usda-sr', category = ''): Food =>
  ({ id: name, name, category, state: 'na', per100: { protein: 1, kcal: 100, carbs: 0, fat: 0 }, portions: portions.map(([label, grams]) => ({ label, grams })), source } as unknown as Food);

describe('food-specific measurements', () => {
  it('keeps the record’s own measures as verified, typical ones as estimated', () => {
    const m = measuresFor(food('Rice, white, cooked', [['1 cup', 158], ['1 medium plate (typical)', 300]]));
    expect(m.find((x) => x.label === '1 cup')).toMatchObject({ grams: 158, verified: true });
    expect(m.find((x) => x.label === '1 medium plate')).toMatchObject({ grams: 300, verified: false });
  });
  it('never gives solid food volume units it has no data for', () => {
    const m = measuresFor(food('Chicken breast, roasted', [['1 breast', 140]]));
    expect(m.some((x) => x.volume)).toBe(false);
    expect(densityOf({ name: 'Chicken breast, roasted', category: '' })).toBeNull();
  });
  it('oil gets tsp/tbsp with oil density, not water', () => {
    const m = measuresFor(food('Olive oil', []));
    expect(m.find((x) => x.label === '1 tbsp')!.grams).toBeCloseTo(13.8, 1);
    expect(m.some((x) => /bottle|glass/.test(x.label))).toBe(false);
  });
  it('drinks get glass, can, bottle and litre; the record’s own cup wins', () => {
    const m = measuresFor(food('Orange juice', [['1 cup', 248]]));
    expect(m.filter((x) => /cup/.test(x.label))).toHaveLength(1);
    expect(m.some((x) => x.label === '1 bottle (500 ml)')).toBe(true);
  });
  it('drops confusing source labels', () => {
    const m = measuresFor(food('Cheese, cheddar', [['1 cubic inch', 17], ['1 slice', 28]]));
    expect(m.map((x) => x.label)).toEqual(['1 slice']);
  });
  it('milk powder is not a liquid', () => expect(densityOf({ name: 'Milk, dry, powdered', category: '' })).toBeNull());
  it('suggests units by food type for custom foods', () => {
    expect(suggestedUnits('Zobo drink')).toContain('bottle');
    expect(suggestedUnits('Grilled tilapia')).toContain('fillet');
    expect(suggestedUnits('Coconut rice')).toContain('cup');
    expect(suggestedUnits('Palm oil')).toContain('tbsp');
  });
});
