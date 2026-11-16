/**
 * Photo diary: for people who'd rather not count. A meal photo is saved to the day without
 * numbers, and can be analysed later if they want. These entries never count towards totals.
 */
import type { Food } from './types';

export const PHOTO_ONLY_ID = 'photo-only';

export const PHOTO_ONLY: Food = {
  id: PHOTO_ONLY_ID,
  name: 'Meal photo',
  category: 'Photo diary',
  state: 'na',
  per100: { protein: 0, kcal: null, carbs: null, fat: null, fiber: null },
  portions: [],
  source: 'custom',
} as unknown as Food;
