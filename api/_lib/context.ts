/** Validates the profile/day context the app sends to the AI endpoints. */
import type { CoachContext } from '../../src/lib/coach.js';

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined);
const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined);

export function cleanContext(raw: unknown): CoachContext {
  const c = (raw ?? {}) as Record<string, any>;
  const nums = (o: any, keys: string[], max: number) => Object.fromEntries(keys.map((k) => [k, num(o?.[k], max)]));
  return {
    name: str(c.name, 40),
    goals: Array.isArray(c.goals) ? c.goals.map((g: unknown) => String(g).slice(0, 20)).slice(0, 5) : undefined,
    activity: str(c.activity, 20),
    diet: str(c.diet, 200),
    country: str(c.country, 60),
    aim: str(c.aim, 60),
    obstacles: Array.isArray(c.obstacles) ? c.obstacles.map((g: unknown) => String(g).slice(0, 40)).slice(0, 10) : undefined,
    training: Array.isArray(c.training) ? c.training.map((g: unknown) => String(g).slice(0, 30)).slice(0, 12) : undefined,
    weightKg: num(c.weightKg, 400),
    goalWeightKg: num(c.goalWeightKg, 400),
    cuisines: Array.isArray(c.cuisines) ? c.cuisines.map((g: unknown) => String(g).slice(0, 30)).slice(0, 26) : undefined,
    avoid: Array.isArray(c.avoid) ? c.avoid.map((g: unknown) => String(g).slice(0, 30)).slice(0, 20) : undefined,
    age: num(c.age, 120),
    sex: str(c.sex, 15),
    pregnant: c.pregnant === true,
    targets: nums(c.targets, ['kcal', 'protein', 'carbs', 'fat', 'fiber'], 20000),
    today: nums(c.today, ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodiumMg'], 50000),
    eatenToday: Array.isArray(c.eatenToday) ? c.eatenToday.map((s: unknown) => String(s).slice(0, 60)).slice(0, 20) : [],
    recentFoods: Array.isArray(c.recentFoods) ? c.recentFoods.map((s: unknown) => String(s).slice(0, 50)).slice(0, 25) : [],
    progress: Array.isArray(c.progress) ? c.progress.map((s: unknown) => String(s).slice(0, 400)).slice(0, 32) : [],
    localTime: str(c.localTime, 40),
  };
}
