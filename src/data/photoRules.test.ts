import { describe, expect, it } from 'vitest';
import { photoKeyFor } from './photoRules';

describe('photo rules', () => {
  it('matches dishes and foods, not look-alikes', () => {
    expect(photoKeyFor('Jollof rice with chicken')).toBe('jollof');
    expect(photoKeyFor('Moin moin (steamed bean pudding)')).toBe('moimoi');
    expect(photoKeyFor('Egusi soup')).toBe('egusi');
    expect(photoKeyFor('Chicken, broilers or fryers, breast, meat only, cooked, roasted')).toBe('chicken');
    expect(photoKeyFor('Egg, whole, cooked, hard-boiled')).toBe('eggs');
    expect(photoKeyFor('Eggplant, raw')).toBeUndefined();
    expect(photoKeyFor('Soup, chicken broth, canned')).toBeUndefined();
    expect(photoKeyFor('Oil, peanut, salad or cooking')).toBeUndefined();
    expect(photoKeyFor('Plantain, cooked, no added fat')).toBe('plantain');
    expect(photoKeyFor('Pineapple, raw')).toBeUndefined();
    expect(photoKeyFor('Cheeseburger, single patty')).toBe('burger');
    expect(photoKeyFor('Beef curry')).toBeUndefined();
    expect(photoKeyFor('Grilled chicken')).toBe('chicken');
    expect(photoKeyFor('Chicken salad')).toBe('salad');
  });
});
