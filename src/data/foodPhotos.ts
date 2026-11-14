/**
 * Photos for popular foods. Files live in public/photos/. Each is free to use; the
 * licence and credit are kept with the photo (shown in Profile → About).
 * Keys are USDA FDC ids from the quick picks.
 */
export interface FoodPhoto { file: string; credit: string; license: string; source: string }

export const FOOD_PHOTOS: Record<number, FoodPhoto> = {};
