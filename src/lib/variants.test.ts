import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePoultry, poultryVariants, weighGuide } from './variants';
import type { Food } from './types';

const file = JSON.parse(readFileSync('public/data/foods.json', 'utf8'));
const all = file.foods.map((r: unknown[]) => ({ id: `usda:${r[0]}`, name: String(r[1]), state: r[3], per100: { kcal: r[5], protein: r[4] } })) as unknown as Food[];
const byName = (n: string) => all.find((f) => f.name === n)!;

describe('chicken variants come from real records', () => {
  it('breast: meat only ↔ meat and skin, raw ↔ roasted ↔ fried ↔ stewed', () => {
    const roast = byName('Chicken, broilers or fryers, breast, meat only, cooked, roasted');
    const v = poultryVariants(roast, all)!;
    expect(v.skin.withSkin?.name).toBe('Chicken, broilers or fryers, breast, meat and skin, cooked, roasted');
    expect(v.skin.withSkin?.per100.kcal).toBe(197);
    expect(roast.per100.kcal).toBe(165);
    expect(v.methods.map((m) => m.method)).toEqual(expect.arrayContaining(['roasted', 'fried', 'stewed']));
  });
  it('wings and thighs, with and without skin, raw and cooked', () => {
    for (const part of ['wing', 'thigh', 'drumstick']) {
      const f = byName(`Chicken, broilers or fryers, ${part}, meat and skin, raw`);
      const v = poultryVariants(f, all)!;
      expect(v.current).toMatchObject({ part, skin: true, method: 'raw' });
      expect(v.methods.find((m) => m.method === 'roasted')?.food.name).toMatch(new RegExp(`${part}, meat and skin, cooked, roasted`));
      expect(v.skin.meatOnly === undefined || /meat only/.test(v.skin.meatOnly.name)).toBe(true);
    }
    expect(parsePoultry('Chicken in white sauce, made with whole milk')).toBeNull();
  });
  it('says what to weigh from the record', () => {
    expect(weighGuide('Chicken, broilers or fryers, breast, meat and skin, cooked, roasted')).toMatch(/meat and skin together/);
    expect(weighGuide('Chicken, broilers or fryers, breast, meat only, cooked, roasted')).toMatch(/meat only/);
    expect(weighGuide('Chicken wing, with bone, roasted')).toMatch(/including the bone/);
    expect(weighGuide('Bananas, raw')).toMatch(/without peel/);
  });
});
