import { expect, it } from 'vitest';
import { parseQty } from './FoodSheet';
it('reads fractions', () => {
  expect(parseQty('½')).toBe(0.5); expect(parseQty('1½')).toBe(1.5); expect(parseQty('1 1/2')).toBe(1.5);
  expect(parseQty('3/4')).toBe(0.75); expect(parseQty('¼')).toBe(0.25); expect(parseQty('2,5')).toBe(2.5); expect(parseQty('2')).toBe(2);
  expect(parseQty('abc')).toBeNaN(); expect(parseQty('')).toBeNaN();
});
