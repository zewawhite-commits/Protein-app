import { EXTRA_KEYS } from './nutrients';
import type { Per100, RecipeDef } from './types';

const KEYS = ['protein', 'kcal', 'fat', 'carbs', 'fiber', ...EXTRA_KEYS] as (keyof Per100)[];

/**
 * Per-100 g values of a cooked recipe: Σ(ingredient value × grams) ÷ cooked weight.
 * A nutrient stays unknown (null) when ingredients without a value make up over 10% of the weight.
 */
export function recipePer100(ingredients: RecipeDef['ingredients'], cookedGrams: number): Per100 {
  const total = ingredients.reduce((s, i) => s + i.grams, 0);
  const out: Record<string, number | null> = {};
  for (const k of KEYS) {
    let sum = 0;
    let missing = 0;
    for (const i of ingredients) {
      const v = i.per100[k];
      if (v == null) missing += i.grams;
      else sum += (v * i.grams) / 100;
    }
    out[k] = !total || !cookedGrams || missing / total > 0.1 ? null : Math.round(((sum * 100) / cookedGrams) * 100) / 100;
  }
  return { ...(out as unknown as Per100), protein: out.protein ?? 0 };
}
