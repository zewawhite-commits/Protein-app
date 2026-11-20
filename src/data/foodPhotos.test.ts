import { describe, expect, it } from 'vitest';
import { photoKeyFor } from './foodPhotos';

describe('photoKeyFor only shows a photo that plainly is the food', () => {
  it('gives plain foods their photo', () => {
    expect(photoKeyFor('Egg, whole, boiled', 'Eggs')).toBe('egg');
    expect(photoKeyFor('Bread, wheat', 'Baked goods')).toBe('bread');
    expect(photoKeyFor('Chicken, breast, grilled with skin, meat only', 'Poultry')).toBe('chicken_breast');
    expect(photoKeyFor('Banana, raw', 'Fruits')).toBe('banana');
    expect(photoKeyFor('Jollof rice (party jollof)', 'Nigerian')).toBe('jollof');
  });
  it('gives mixed, branded and look-alike foods a plain tile', () => {
    for (const n of ['Quiche, cheese and egg, homemade', 'Quarter Pounder with cheese (McDonalds)', 'Crackers, cheese, low sodium', 'Chicken, liver, cooked', 'Pie, chicken, baked',
      'Bamboo caterpillar, deep fried', 'Plantains, yellow, raw', 'Snacks, rice cakes', 'Frog legs, raw', 'Fish fingers, frozen', 'Lemon sole, raw', 'Fast Foods, Fried Chicken, Breast',
      'Banana split', 'Almond butter', 'Jollof spaghetti (Burkina Faso)*: spaghetti in vegetable sauce', 'Fufu of ripe plantain with red palm oil (Burkina Faso)*', 'Sea snail/whelk, raw'])
      expect(photoKeyFor(n), n).toBeUndefined();
  });
});
