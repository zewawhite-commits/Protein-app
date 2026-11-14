/**
 * Daily calorie and macro targets — an estimate the user can override, not medical advice.
 *  - Resting energy: Mifflin–St Jeor equation (Mifflin et al., Am J Clin Nutr 1990)
 *  - Activity factors 1.2 / 1.375 / 1.55 / 1.725 (standard multipliers used with it)
 *  - Fat loss: ~20% below maintenance; muscle gain: ~10% above (common practice)
 *  - Fat 30% of energy (within the 20–35% adult range, US Dietary Reference Intakes)
 *  - Fibre 14 g per 1,000 kcal (Dietary Guidelines for Americans 2020–2025)
 *  - Carbohydrate: the energy left after protein and fat
 */
import type { ActivityLevel, FitnessGoal, Profile } from './types';

const ACTIVITY: Record<ActivityLevel, number> = { sedentary: 1.2, light: 1.375, active: 1.55, athlete: 1.725 };

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** True when kcal comes from the estimate (vs a number the user typed). */
  estimated: boolean;
}

export function restingKcal(p: { bodyWeightKg: number; heightCm: number; age: number; sex?: Profile['sex'] }): number {
  const base = 10 * p.bodyWeightKg + 6.25 * p.heightCm - 5 * p.age;
  return base + (p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78);
}

/** Calorie direction from the goals: fat loss wins over muscle gain when both are picked. */
export function calorieAdjust(goals: FitnessGoal[], pregnant?: boolean): number {
  if (pregnant) return 1; // no deficit in pregnancy / breastfeeding
  if (goals.includes('fatloss')) return 0.8;
  if (goals.includes('muscle')) return 1.1;
  return 1;
}

/** Estimated daily calories, or null when weight, height or age is missing. */
export function estimateKcal(p: Profile): number | null {
  if (!p.bodyWeightKg || !p.heightCm || !p.age) return null;
  const goals = p.goals?.length ? p.goals : p.goal ? [p.goal] : [];
  const tdee = restingKcal({ bodyWeightKg: p.bodyWeightKg, heightCm: p.heightCm, age: p.age, sex: p.sex }) * ACTIVITY[p.activity ?? 'light'];
  const floor = p.sex === 'male' ? 1500 : 1200;
  return Math.round(Math.max(floor, tdee * calorieAdjust(goals, p.pregnant)) / 10) * 10;
}

export function calorieGoal(p: Profile): { kcal: number; estimated: boolean } | null {
  if (p.calorieMode === 'fixed' && p.calorieGoal && p.calorieGoal > 0) return { kcal: Math.round(p.calorieGoal), estimated: false };
  const kcal = estimateKcal(p);
  return kcal ? { kcal, estimated: true } : null;
}

/** Full targets for a protein goal (g) and profile; null without a calorie goal. */
export function dailyTargets(p: Profile, proteinGoal: number): Targets | null {
  const c = calorieGoal(p);
  if (!c) return null;
  const fat = Math.round((c.kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((c.kcal - proteinGoal * 4 - fat * 9) / 4));
  return { kcal: c.kcal, protein: proteinGoal, carbs, fat, fiber: Math.round((c.kcal / 1000) * 14), estimated: c.estimated };
}
