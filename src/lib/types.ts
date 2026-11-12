/** Preparation state of a food record, as described by its source. */
export type PrepState = 'raw' | 'cooked' | 'dry' | 'na';

/** Nutrient values per 100 g edible portion. null = the source has no value. */
export interface Per100 {
  protein: number;
  kcal: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
}

export interface Portion {
  label: string;
  grams: number;
}

export type FoodSource = 'usda-sr' | 'custom';

export interface Food {
  /** "usda:<fdcId>" or "custom:<uuid>" */
  id: string;
  fdcId?: number;
  name: string;
  category: string;
  state: PrepState;
  per100: Per100;
  portions: Portion[];
  source: FoodSource;
  /** For custom records: where the numbers came from (label, database, lab report…). */
  sourceNote?: string;
}

export interface CustomFood extends Food {
  source: 'custom';
  sourceNote: string;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface LogEntry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  /** Epoch ms when the entry was created. */
  loggedAt: number;
  meal: Meal;
  foodId: string;
  /**
   * Snapshot of the food at log time, so later edits to a custom record
   * never rewrite history.
   */
  food: Pick<Food, 'name' | 'state' | 'per100' | 'source' | 'fdcId' | 'sourceNote'>;
  grams: number;
  photoId?: string;
  note?: string;
}

export type BodyUnit = 'kg' | 'lb';
export type Theme = 'dark' | 'light' | 'system';

export interface Profile {
  name: string;
  /** Always stored in kg. */
  bodyWeightKg: number | null;
  goalMode: 'fixed' | 'perKg';
  /** Grams of protein per day when goalMode = fixed. */
  goalGrams: number;
  /** g/kg body weight when goalMode = perKg. */
  gramsPerKg: number;
  createdAt: number;
}

export interface Settings {
  theme: Theme;
  bodyUnit: BodyUnit;
  adminMode: boolean;
}
