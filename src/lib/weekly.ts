/**
 * Plus weekly progress report: last full week (Monday to Sunday) from the person's own log.
 * Pure and tested. Nothing is estimated beyond what's logged: days without food don't count.
 */
import { nutrientsFor } from './nutrition';
import { nutrientGaps, type Gap } from './insights';
import type { LogEntry, WeightEntry } from './types';

const DAY = 864e5;
const keyOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const at = (k: string) => new Date(`${k}T12:00:00`).getTime();

/** Monday of the week before the one containing `today`. */
export function lastWeekStart(today: string): string {
  const t = at(today);
  const dow = (new Date(t).getDay() + 6) % 7; // Monday = 0
  return keyOf(t - (dow + 7) * DAY);
}

export interface WeekSummary { from: string; to: string; daysLogged: number; kcal: number; protein: number; proteinDaysHit: number }
export interface WeeklyReport extends WeekSummary {
  previous: WeekSummary | null;
  kcalTarget: number | null;
  proteinTarget: number;
  weight: { start: number; end: number } | null;
  workouts: number;
  topProtein: { name: string; protein: number }[];
  gaps: Gap[];
}

function summary(entries: LogEntry[], from: string, proteinGoal: (d: string) => number): WeekSummary {
  const to = keyOf(at(from) + 6 * DAY);
  const days = new Map<string, { kcal: number; protein: number }>();
  for (const e of entries) {
    if (e.planned || e.date < from || e.date > to) continue;
    const n = nutrientsFor(e.food.per100, e.grams);
    const d = days.get(e.date) ?? { kcal: 0, protein: 0 };
    d.kcal += n.kcal ?? 0; d.protein += n.protein ?? 0;
    days.set(e.date, d);
  }
  const v = [...days.entries()];
  const avg = (f: (x: { kcal: number; protein: number }) => number) => (v.length ? v.reduce((a, [, x]) => a + f(x), 0) / v.length : 0);
  return { from, to, daysLogged: v.length, kcal: avg((x) => x.kcal), protein: avg((x) => x.protein), proteinDaysHit: v.filter(([d, x]) => proteinGoal(d) > 0 && x.protein >= proteinGoal(d) * 0.9).length };
}

export function weeklyReport(o: { entries: LogEntry[]; weights: WeightEntry[]; workoutDates: string[]; today: string; proteinGoal: (d: string) => number; kcalTarget: number | null }): WeeklyReport {
  const from = lastWeekStart(o.today);
  const s = summary(o.entries, from, o.proteinGoal);
  const prevFrom = keyOf(at(from) - 7 * DAY);
  const prev = summary(o.entries, prevFrom, o.proteinGoal);
  const inWeek = o.weights.filter((w) => w.date >= s.from && w.date <= s.to).sort((a, b) => a.date.localeCompare(b.date));
  const foods = new Map<string, { name: string; protein: number }>();
  for (const e of o.entries) {
    if (e.planned || e.date < s.from || e.date > s.to) continue;
    const f = foods.get(e.foodId) ?? { name: e.food.name, protein: 0 };
    f.protein += nutrientsFor(e.food.per100, e.grams).protein ?? 0;
    foods.set(e.foodId, f);
  }
  return {
    ...s,
    previous: prev.daysLogged ? prev : null,
    kcalTarget: o.kcalTarget,
    proteinTarget: o.proteinGoal(s.to),
    weight: inWeek.length >= 2 ? { start: inWeek[0].kg, end: inWeek[inWeek.length - 1].kg } : null,
    workouts: new Set(o.workoutDates.filter((d) => d >= s.from && d <= s.to)).size,
    topProtein: [...foods.values()].sort((a, b) => b.protein - a.protein).slice(0, 3),
    gaps: nutrientGaps(o.entries, s.to, 7).gaps,
  };
}
