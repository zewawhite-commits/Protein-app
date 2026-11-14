/**
 * Protein target suggestion from onboarding answers. A starting point the user can
 * change — not medical advice. Reference points:
 *  - 0.8 g/kg: adult RDA (US National Academies, Dietary Reference Intakes 2005)
 *  - 1.4–2.0 g/kg: International Society of Sports Nutrition position stand for
 *    exercising individuals (Jäger et al., 2017)
 *  - ~1.6 g/kg: intake above which added protein stopped improving resistance-training
 *    gains in a meta-analysis (Morton et al., Br J Sports Med 2018)
 *  - 1.0–1.2 g/kg: recommended for healthy adults aged 65+ (PROT-AGE study group,
 *    Bauer et al., J Am Med Dir Assoc 2013)
 *  - 1.1 g/kg: RDA during pregnancy and breastfeeding (US National Academies, DRI 2005)
 */
import type { ActivityLevel, Diet, FitnessGoal, Food } from './types';

const BY_ACTIVITY: Record<ActivityLevel, number> = { sedentary: 0.8, light: 1.2, active: 1.6, athlete: 1.8 };
const GOAL_FLOOR: Record<FitnessGoal, number> = { muscle: 1.6, fatloss: 1.8, performance: 1.6, maintain: 0, health: 0 };

export interface PersonFactors { age?: number; pregnant?: boolean }

export function suggestGramsPerKg(goal: FitnessGoal, activity: ActivityLevel, person: PersonFactors = {}): number {
  // Higher targets assume training; without it, stay at the general-population levels.
  let floor = activity === 'sedentary' ? Math.min(GOAL_FLOOR[goal], 1.2) : GOAL_FLOOR[goal];
  if ((person.age ?? 0) >= 65) floor = Math.max(floor, 1.0);
  if (person.pregnant) floor = Math.max(floor, 1.1);
  return Math.min(2.0, Math.max(BY_ACTIVITY[activity], floor));
}

/** With several goals, use the one that asks for the most protein. */
export function primaryGoal(goals: FitnessGoal[], activity: ActivityLevel): FitnessGoal {
  return goals.reduce((best, g) => (suggestGramsPerKg(g, activity) > suggestGramsPerKg(best, activity) ? g : best), goals[0] ?? 'health');
}

export function suggestionReason(goal: FitnessGoal, activity: ActivityLevel, gPerKg: number, person: PersonFactors = {}): string {
  if (person.pregnant && gPerKg <= 1.1) return 'During pregnancy and breastfeeding the recommended intake rises to about 1.1 g/kg.';
  if ((person.age ?? 0) >= 65 && gPerKg <= 1.2) return 'From age 65, experts recommend about 1.0–1.2 g/kg to help keep muscle and strength.';
  if (gPerKg <= 0.8) return 'The adult Recommended Dietary Allowance (0.8 g/kg) covers the needs of most people who don’t train.';
  if (goal === 'muscle') return 'Around 1.6 g/kg is where extra protein stopped adding muscle gains in a large study of people who lift.';
  if (goal === 'fatloss' && activity !== 'sedentary') return 'Eating toward the top of the 1.4–2.0 g/kg sports range helps keep muscle while losing fat.';
  return 'Within the 1.4–2.0 g/kg range recommended for people who exercise regularly.';
}

const MEAT = /\b(chicken|beef|pork|lamb|turkey|veal|ham|bacon|sausage|duck)\b/i;
const FISH = /\b(fish|salmon|tuna|shrimp|crustaceans|mollusks|cod|sardine)\b/i;
const ANIMAL = /\b(egg|milk|cheese|yogurt|whey|cream|butter|honey)\b/i;

/** Whether a food fits a diet, judged from its name (used to tailor suggestions, never to hide search results). */
export function fitsDiet(food: Pick<Food, 'name'>, diet: Diet | undefined): boolean {
  if (!diet || diet === 'all') return true;
  if (MEAT.test(food.name)) return false;
  if (diet === 'pescatarian') return true;
  if (FISH.test(food.name)) return false;
  if (diet === 'vegetarian') return true;
  return !ANIMAL.test(food.name);
}
