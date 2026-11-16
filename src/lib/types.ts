/** Preparation state of a food record, as described by its source. */
export type PrepState = 'raw' | 'cooked' | 'dry' | 'na';

/** Nutrient values per 100 g edible portion. null = the source has no value. */
export interface Per100 {
  protein: number;
  kcal: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  /** Extra nutrients (see lib/nutrients.ts). Optional: entries logged before v3 lack them. */
  sugar?: number | null;
  satFat?: number | null;
  cholesterol?: number | null;
  sodium?: number | null;
  potassium?: number | null;
  calcium?: number | null;
  iron?: number | null;
  magnesium?: number | null;
  zinc?: number | null;
  vitA?: number | null;
  vitC?: number | null;
  vitD?: number | null;
  vitB12?: number | null;
  folate?: number | null;
}

export interface Portion {
  label: string;
  grams: number;
}

/**
 * Where a record's nutrient values come from. Values are always copied from the source,
 * never estimated: usda-sr / usda-fndds (USDA FoodData Central), fao-wafct (FAO/INFOODS
 * West African table), off (Open Food Facts product label data), custom (entered with a cited source).
 */
export type FoodSource = 'usda-sr' | 'usda-fndds' | 'fao-wafct' | 'uk-cofid' | 'au-afcd' | 'recipe' | 'off' | 'custom';

export interface Food {
  /** "usda:<fdcId>" or "custom:<uuid>" */
  id: string;
  fdcId?: number;
  /** Source-specific reference: WAFCT food code, Open Food Facts barcode. */
  ref?: string;
  name: string;
  category: string;
  state: PrepState;
  per100: Per100;
  portions: Portion[];
  source: FoodSource;
  /** For custom records: where the numbers came from (label, database, lab report…). For recipes: the ingredient list. */
  sourceNote?: string;
  /** Other names and spellings (searchable, e.g. "egushi" for egusi soup). */
  aliases?: string[];
}

/** A homemade recipe's ingredients (snapshots, so it still works offline and can be edited later). */
export interface RecipeDef {
  ingredients: { foodId: string; name: string; grams: number; per100: Per100 }[];
  cookedGrams: number;
  servings: number;
}

export interface CustomFood extends Food {
  source: 'custom';
  sourceNote: string;
  /** Set when this food is a recipe the person built from ingredients. */
  recipe?: RecipeDef;
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
  food: Pick<Food, 'name' | 'state' | 'per100' | 'source' | 'fdcId' | 'ref' | 'sourceNote'>;
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
  /** Answers from onboarding (optional for profiles created before it existed). */
  goal?: FitnessGoal;
  /** All goals the user picked (goal = the one that sets the target). */
  goals?: FitnessGoal[];
  age?: number;
  sex?: 'female' | 'male' | 'unspecified';
  /** Pregnant or breastfeeding — raises the minimum target. */
  pregnant?: boolean;
  /** Country the user lives in / cooks from; used to tailor food suggestions. */
  country?: string;
  activity?: ActivityLevel;
  diet?: Diet;
  /** Extra eating preferences, as many as they like (Halal, Gluten-free, Keto…). */
  dietPrefs?: string[];
  /** Cuisines the person enjoys (any from around the world); used to mix suggestions. */
  cuisines?: string[];
  /** Allergies and foods they avoid; AI suggestions must leave these out. */
  avoid?: string[];
  /** Weight the person wants to reach (kg), and how fast (kg per week). */
  goalWeightKg?: number;
  paceKgPerWeek?: number;
  /** What gets in the way (from onboarding); shared with the AI coach. */
  obstacles?: string[];
  /** Kinds of exercise they do or want to try (onboarding); used for the workout guide. */
  training?: string[];
  /** Works with a trainer or dietitian. */
  hasCoach?: boolean;
  /** Profile picture kept on this device (IndexedDB photo id). */
  photoId?: string;
  /** Height in cm (for the calorie estimate). */
  heightCm?: number;
  /** 'auto' (default) = estimated from body data; 'fixed' = calorieGoal. */
  calorieMode?: 'auto' | 'fixed';
  calorieGoal?: number;
}

export type FitnessGoal = 'muscle' | 'fatloss' | 'maintain' | 'performance' | 'health';
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'athlete';
export type Diet = 'all' | 'pescatarian' | 'vegetarian' | 'vegan';

export interface Reminders {
  enabled: boolean;
  /** Local times, HH:MM. */
  breakfast: string;
  lunch: string;
  dinner: string;
  /** Optional daily workout reminder (HH:MM) — skipped on days a workout is already logged. */
  workoutOn?: boolean;
  workout?: string;
  /** Optional weigh-in reminder (HH:MM) — skipped once today's weight is logged. */
  weighOn?: boolean;
  weigh?: string;
}

export interface Settings {
  theme: Theme;
  bodyUnit: BodyUnit;
  adminMode: boolean;
  reminders?: Reminders;
  /** Add calories burned by logged exercise to the day's calorie budget. */
  addBurned?: boolean;
  /** Gentle mode: no streaks and no over-target notices — for people who find them stressful. */
  gentle?: boolean;
  /** 'simple' shows calories and protein only; 'detailed' (default) shows every macro and nutrient. */
  tracking?: 'simple' | 'detailed';
  /** Hide the "What to eat next" suggestions on Home (AI only speaks when asked). */
  quietAi?: boolean;
}

/** A meal the user saved to log again in one tap (food snapshots + the grams they weighed). */
export interface SavedMeal {
  id: string;
  name: string;
  items: { foodId: string; food: LogEntry['food']; grams: number }[];
  createdAt: number;
}

/** An AI eating plan the user saved. Item weights are suggestions, never logged automatically. */
export interface SavedPlan {
  id: string;
  title: string;
  createdAt: number;
  plan: import('./plan.js').DayPlan;
}

/** A body-weight log entry (kg), one per day. */
export interface WeightEntry { date: string; kg: number }

/** A progress photo (image kept on this device in IndexedDB). */
export interface ProgressPhoto { id: string; photoId: string; date: string; kg?: number }
