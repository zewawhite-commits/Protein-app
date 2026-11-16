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

/** ~7,700 kcal per kg of body weight change (common approximation). */
export const KCAL_PER_KG = 7700;

/** Maintenance calories (resting × activity), or null without weight, height and age. */
export function maintenanceKcal(p: Profile): number | null {
  if (!p.bodyWeightKg || !p.heightCm || !p.age) return null;
  return restingKcal({ bodyWeightKg: p.bodyWeightKg, heightCm: p.heightCm, age: p.age, sex: p.sex }) * ACTIVITY[p.activity ?? 'light'];
}

/** Estimated daily calories, or null when weight, height or age is missing. */
export function estimateKcal(p: Profile): number | null {
  const tdee = maintenanceKcal(p);
  if (!tdee || !p.bodyWeightKg) return null;
  const goals = p.goals?.length ? p.goals : p.goal ? [p.goal] : [];
  const floor = p.sex === 'male' ? 1500 : 1200;
  let kcal = tdee * calorieAdjust(goals, p.pregnant);
  // With a goal weight and pace, the daily change follows the chosen pace instead.
  if (p.goalWeightKg && p.paceKgPerWeek && !p.pregnant && Math.abs(p.goalWeightKg - p.bodyWeightKg) >= 0.5) {
    const dir = p.goalWeightKg < p.bodyWeightKg ? -1 : 1;
    kcal = tdee + (dir * p.paceKgPerWeek * KCAL_PER_KG) / 7;
  }
  return Math.round(Math.max(floor, kcal) / 10) * 10;
}

/** Weeks to reach the goal weight at the chosen pace (null if not applicable). */
export function weeksToGoal(p: Pick<Profile, 'bodyWeightKg' | 'goalWeightKg' | 'paceKgPerWeek'>): number | null {
  if (!p.bodyWeightKg || !p.goalWeightKg || !p.paceKgPerWeek) return null;
  const diff = Math.abs(p.goalWeightKg - p.bodyWeightKg);
  return diff < 0.5 ? null : Math.ceil(diff / p.paceKgPerWeek);
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

/**
 * What the person actually burns, worked out from their own data rather than a formula:
 *   burn ≈ average calories eaten − (weight change × 7,700 kcal/kg ÷ days)
 * Weight change is the slope of a straight line through their weigh-ins, so one odd
 * weigh-in doesn't swing it. Needs enough data to mean something, and is kept within
 * ±25% of the formula estimate so a few unlogged meals can't produce a silly number.
 */
export function measuredBurn(
  entries: { date: string; grams: number; food: { per100: { kcal: number | null } } }[],
  weights: { date: string; kg: number }[],
  today: string,
  formulaKcal: number | null,
  windowDays = 28,
): { kcal: number; loggedDays: number; weighIns: number; days: number; kgPerWeek: number; avgEaten: number } | null {
  const from = new Date(`${today}T00:00:00`);
  from.setDate(from.getDate() - windowDays);
  const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  const w = weights.filter((x) => x.date > fromKey && x.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  if (w.length < 4) return null;
  const day = (d: string) => new Date(`${d}T00:00:00`).getTime() / 864e5;
  const span = day(w[w.length - 1].date) - day(w[0].date);
  if (span < 13) return null;
  // Days with a believable full log (at least 800 kcal) between the first and last weigh-in.
  const perDay = new Map<string, number>();
  for (const e of entries) {
    if (e.date < w[0].date || e.date > w[w.length - 1].date) continue;
    if (!(e as { planned?: boolean }).planned) perDay.set(e.date, (perDay.get(e.date) ?? 0) + ((e.food.per100.kcal ?? 0) * e.grams) / 100);
  }
  const full = [...perDay.values()].filter((v) => v >= 800);
  if (full.length < 10 || full.length < span * 0.6) return null;
  const avgEaten = full.reduce((s, v) => s + v, 0) / full.length;
  // Least-squares slope of weight over time (kg per day).
  const xs = w.map((x) => day(x.date)), ys = w.map((x) => x.kg);
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  let kcal = avgEaten - slope * KCAL_PER_KG;
  if (formulaKcal) kcal = Math.min(formulaKcal * 1.25, Math.max(formulaKcal * 0.75, kcal));
  return { kcal: Math.round(kcal / 10) * 10, loggedDays: full.length, weighIns: w.length, days: Math.round(span), kgPerWeek: slope * 7, avgEaten: Math.round(avgEaten) };
}

/** Daily target from a measured burn, at the person's chosen pace, never below the safe floor. */
export function targetFromBurn(p: Profile, burn: number): number {
  const floor = p.sex === 'male' ? 1500 : 1200;
  const goals = p.goals?.length ? p.goals : p.goal ? [p.goal] : [];
  let kcal = burn * calorieAdjust(goals, p.pregnant);
  if (p.goalWeightKg && p.bodyWeightKg && p.paceKgPerWeek && !p.pregnant && Math.abs(p.goalWeightKg - p.bodyWeightKg) >= 0.5) {
    kcal = burn + ((p.goalWeightKg < p.bodyWeightKg ? -1 : 1) * p.paceKgPerWeek * KCAL_PER_KG) / 7;
  }
  return Math.round(Math.max(floor, kcal) / 10) * 10;
}
