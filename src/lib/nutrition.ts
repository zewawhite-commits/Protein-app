/**
 * Deterministic nutrition maths. Everything here is a pure function of
 * source data (per-100 g values) and the weight the user entered.
 * No estimation, no AI — keep suggestions elsewhere.
 */
import type { LogEntry, Per100, Profile } from './types';

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Scale a per-100 g value to a weight in grams. null stays null. */
export function scale(per100: number | null, grams: number): number | null {
  if (per100 == null || !Number.isFinite(grams) || grams <= 0) return per100 == null ? null : 0;
  return (per100 * grams) / 100;
}

export interface Totals {
  protein: number;
  kcal: number;
  fat: number;
  carbs: number;
  /** True when at least one entry lacked a value for that nutrient, so the total is a lower bound. */
  incomplete: { kcal: boolean; fat: boolean; carbs: boolean };
}

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
  const t: Totals = { protein: 0, kcal: 0, fat: 0, carbs: 0, incomplete: { kcal: false, fat: false, carbs: false } };
  for (const e of entries) {
    const n = nutrientsFor(e.food.per100, e.grams);
    t.protein += n.protein;
    for (const k of ['kcal', 'fat', 'carbs'] as const) {
      const v = n[k];
      if (v == null) t.incomplete[k] = true;
      else t[k] += v;
    }
  }
  return t;
}

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
