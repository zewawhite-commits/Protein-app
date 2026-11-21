/**
 * Deterministic nutrition maths. Everything here is a pure function of
 * source data (per-100 g values) and the weight the user entered.
 * No estimation, no AI — keep suggestions elsewhere.
 */
import type { LogEntry, Per100, Profile } from './types';
import { EXTRA_KEYS, type ExtraKey } from './nutrients';

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Scale a per-100 g value to a weight in grams. null stays null. */
export function scale(per100: number | null, grams: number): number | null {
  if (per100 == null || !Number.isFinite(grams) || grams <= 0) return per100 == null ? null : 0;
  return (per100 * grams) / 100;
}

type Summed = 'kcal' | 'fat' | 'carbs' | 'fiber' | ExtraKey;
const SUMMED: Summed[] = ['kcal', 'fat', 'carbs', 'fiber', ...EXTRA_KEYS];

export type Totals = { protein: number } & Record<Summed, number> & {
  /** True when at least one entry lacked a value for that nutrient, so the total is a lower bound. */
  incomplete: Record<Summed, boolean>;
};

export function nutrientsFor(per100: Per100, grams: number) {
  return {
    protein: scale(per100.protein, grams) ?? 0,
    kcal: scale(per100.kcal, grams),
    fat: scale(per100.fat, grams),
    carbs: scale(per100.carbs, grams),
    fiber: scale(per100.fiber, grams),
  };
}

export function sumEntries(entries: LogEntry[]): Totals {
  const t = { protein: 0, incomplete: {} } as Totals;
  for (const k of SUMMED) { t[k] = 0; t.incomplete[k] = false; }
  for (const e of entries) {
    if (e.planned || e.foodId === 'photo-only') continue; // planned for later, or a photo-diary entry with no numbers
    t.protein += scale(e.food.per100.protein, e.grams) ?? 0;
    for (const k of SUMMED) {
      const v = scale(e.food.per100[k] ?? null, e.grams);
      if (v == null) t.incomplete[k] = true;
      // Calories are rounded per food, exactly as each row shows them, so the day total always equals the sum of the rows.
      else t[k] += k === 'kcal' ? Math.round(v) : v;
    }
  }
  return t;
}

/** One nutrient for a weight, or null when the source has no value. */
export const amountOf = (per100: Per100, key: keyof Per100, grams: number) => scale(per100[key] ?? null, grams);

/** Daily protein goal in grams for a profile. */
export function dailyGoal(p: Pick<Profile, 'goalMode' | 'goalGrams' | 'gramsPerKg' | 'bodyWeightKg'>): number {
  if (p.goalMode === 'perKg' && p.bodyWeightKg && p.gramsPerKg > 0) {
    return Math.round(p.bodyWeightKg * p.gramsPerKg);
  }
  return Math.max(0, Math.round(p.goalGrams));
}

/** Grams of a food needed to supply `proteinG` grams of protein. */
export function gramsForProtein(per100Protein: number, proteinG: number): number | null {
  if (per100Protein <= 0 || proteinG <= 0) return null;
  return Math.ceil((proteinG / per100Protein) * 100);
}

export const KG_PER_LB = 0.45359237;
export const toKg = (v: number, unit: 'kg' | 'lb') => (unit === 'kg' ? v : v * KG_PER_LB);
export const fromKg = (kg: number, unit: 'kg' | 'lb') => (unit === 'kg' ? kg : kg / KG_PER_LB);

const ALCOHOLIC = /\b(beer|lager|stout|ale|cider|wine|champagne|prosecco|vodka|gin|rum|whisk(?:e)?y|scotch|brandy|cognac|tequila|liqueur|spirits?|alcoholic|martini|cocktail|sherry|port|sake|palm wine|ogogoro|burukutu|pito|schnapps|margarita|mojito|daiquiri|liqueurs?|malt liquor|black russian|bloody mary|irish coffee|mirin|vanilla (bean )?extract|sangria|cosmopolitan|manhattan|screwdriver|gimlet|mai tai|tom collins|whiskey sour|mudslide|kahlua|amaretto|eggnog with alcohol|creme de menthe|grasshopper|white russian|long island|tom and jerry|hot toddy|mint julep|piña colada|pina colada|sake|soju|shochu|ouzo|absinthe|cognac|armagnac|pimms|alcopop|hard lemonade|hard seltzer|wine cooler|cape cod|coffee, irish)\b/i;

/**
 * Alcohol per 100 g for alcoholic drinks, worked out from the calories the table gives
 * (7 kcal per gram of alcohol after protein, carbs and fat). The tables don't list it, so the
 * calories from alcohol would otherwise look unexplained. Null for anything else.
 */
export function alcoholPer100(name: string, per100: Per100, category?: string): number | null {
  const drink = ALCOHOLIC.test(name) || /^(Beer|Wine|Liquor and cocktails|Alcoholic beverages)/.test(category ?? '');
  if (!drink || /\b(non-?alcoholic|alcohol[- ]free|0\.0%?|dealcoholi[sz]ed|vinegar|cooking wine|sauce|cake|chocolate)\b/i.test(name) || per100.kcal == null) return null;
  const rest = (per100.kcal - 4 * per100.protein - 4 * (per100.carbs ?? 0) - 9 * (per100.fat ?? 0)) / 7;
  return rest > 0.5 ? Math.round(rest * 10) / 10 : null;
}
