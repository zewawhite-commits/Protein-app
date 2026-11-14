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
  });
});
