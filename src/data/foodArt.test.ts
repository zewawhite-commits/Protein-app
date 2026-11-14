import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { artFor } from './foodArt';

describe('food illustrations', () => {
  it('picks a fitting illustration and the file exists', () => {
    const cases: [string, string?, string?][] = [
      ['Chicken, broilers or fryers, breast, meat only, cooked, roasted', undefined, 'poultry_leg'],
      ['Spaghetti with meat sauce', undefined, 'spaghetti'],
      ['Sushi roll, avocado', undefined, 'sushi'],
      ['Beef curry', undefined, 'curry_rice'],
      ['Jollof rice with chicken', undefined, 'shallow_pan_of_food'],
      ['Egg, whole, cooked, hard-boiled', undefined, 'egg'],
      ['Eggplant, raw', 'Vegetables and Vegetable Products', 'carrot'],
      ['Plantain, cooked', undefined, 'banana'],
      ['Pineapple, raw', undefined, 'pineapple'],
      ['Egusi soup', undefined, 'pot_of_food'],
      ['Something unusual', undefined, 'fork_and_knife_with_plate'],
    ];
    for (const [name, cat, want] of cases) {
      const got = artFor(name, cat);
      expect(got, name).toBe(want);
      expect(existsSync(`public/food3d/${got}.webp`)).toBe(true);
    }
  });
});
