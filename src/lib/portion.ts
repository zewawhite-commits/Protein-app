/**
 * Visual Portion Coach: after a plate scan, suggest portions that fit what is left of
 * the person's day. It works from their own targets, so it can say "eat more" or
 * "add protein" as readily as "eat less". Nutrition always comes from the food
 * database; this only changes grams.
 *
 * Rules (simple on purpose, so the advice is explainable):
 *  - This meal's share of the day = what's left ÷ meals left (by time of day),
 *    kept between 20% and 45% of the daily target so a skipped lunch never means
 *    a huge dinner, and an over-target day never means a tiny meal.
 *  - Protein first: if the meal is short on protein, the protein food goes up.
 *  - Then calories: starchy and fatty foods move first; protein is kept; vegetables
 *    are never cut, and go up when other foods go down so the plate stays full.
 *  - No change is ever more than −60% / +60% of one food.
 *  - Pregnant or breastfeeding: never suggests eating less.
 */
import type { FitnessGoal } from './types';

export type PortionKind = 'protein' | 'veg' | 'dense';
export interface PortionItem { index: number; name: string; grams: number; per100: { kcal: number | null; protein: number; carbs?: number | null; fat?: number | null } }
export interface PortionRow { index: number; name: string; kind: PortionKind; from: number; to: number }
export type PortionDirection = 'less' | 'more' | 'protein' | 'keep';
export interface PortionTotals { kcal: number; protein: number; carbs: number; fat: number }
export interface PortionPlan {
  direction: PortionDirection;
  /** What this meal should roughly come to. */
  budget: { kcal: number; protein: number };
  rows: PortionRow[];
  before: PortionTotals;
  after: PortionTotals;
  headline: string;
  message: string;
  /** No protein food on the plate and it's short on protein. */
  addProtein: boolean;
}

export function portionKind(per100: PortionItem['per100']): PortionKind {
  const kcal = per100.kcal ?? 0;
  const share = kcal > 0 ? (per100.protein * 4) / kcal : 0;
  if (per100.protein >= 8 && share >= 0.3) return 'protein';
  if (kcal < 70) return 'veg';
  return 'dense';
}

export function totalsOf(items: { grams: number; per100: PortionItem['per100'] }[]): PortionTotals {
  return items.reduce((a, i) => {
    const k = i.grams / 100;
    return { kcal: a.kcal + (i.per100.kcal ?? 0) * k, protein: a.protein + i.per100.protein * k, carbs: a.carbs + (i.per100.carbs ?? 0) * k, fat: a.fat + (i.per100.fat ?? 0) * k };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const roundG = (g: number) => (g >= 100 ? Math.round(g / 10) * 10 : Math.max(5, Math.round(g / 5) * 5));
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function mealsLeft(hour: number): number {
  return hour < 11 ? 3 : hour < 15 ? 2 : 1;
}

export function suggestPortions(o: {
  items: PortionItem[];
  targets: { kcal: number; protein: number };
  /** Already logged today, not counting this plate. */
  eaten: { kcal: number; protein: number };
  hour: number;
  goals?: FitnessGoal[];
  pregnant?: boolean;
}): PortionPlan | null {
  const items = o.items.filter((i) => i.grams > 0 && (i.per100.kcal ?? 0) > 0);
  if (!items.length || !(o.targets.kcal > 0)) return null;
  const n = mealsLeft(o.hour);
  const kcalBudget = Math.round(clamp((o.targets.kcal - o.eaten.kcal) / n, Math.max(300, o.targets.kcal * 0.2), o.targets.kcal * 0.45));
  const P = o.targets.protein > 0 ? o.targets.protein : 0;
  const proteinBudget = P ? Math.round(clamp((P - o.eaten.protein) / n, P * 0.2, P * 0.45)) : 0;

  const kind = new Map(items.map((i) => [i.index, portionKind(i.per100)]));
  const g = new Map(items.map((i) => [i.index, i.grams]));
  const lo = (i: PortionItem) => i.grams * 0.4;
  const hi = (i: PortionItem) => i.grams * 1.6;
  const kcalOf = (i: PortionItem) => ((i.per100.kcal ?? 0) * g.get(i.index)!) / 100;
  const sum = () => totalsOf(items.map((i) => ({ grams: g.get(i.index)!, per100: i.per100 })));
  const before = totalsOf(items);
  const of = (k: PortionKind) => items.filter((i) => kind.get(i.index) === k);

  // 1. Protein first.
  const proteins = of('protein');
  let addProtein = false;
  if (proteinBudget && before.protein < proteinBudget * 0.85) {
    if (proteins.length) {
      const need = proteinBudget - before.protein;
      const per = proteins.reduce((a, i) => a + i.per100.protein / 100 * i.grams, 0);
      const f = clamp(1 + need / Math.max(per, 1), 1, 1.6);
      for (const i of proteins) g.set(i.index, Math.min(hi(i), i.grams * f));
    } else addProtein = true;
  }

  // 2. Calories: starches and fats move first.
  const tol = kcalBudget * 0.12;
  let diff = kcalBudget - sum().kcal;
  const dense = of('dense');
  const veg = of('veg');
  if (diff < -tol && !o.pregnant) {
    const cut = -diff;
    const denseKcal = dense.reduce((a, i) => a + kcalOf(i), 0);
    if (denseKcal > 0) {
      const f = clamp(1 - cut / denseKcal, 0.4, 1);
      for (const i of dense) g.set(i.index, Math.max(lo(i), g.get(i.index)! * f));
    }
    // Still well over and protein is more than enough: trim protein a little, never below the meal's need.
    diff = kcalBudget - sum().kcal;
    if (diff < -tol && proteinBudget && sum().protein > proteinBudget * 1.3) {
      for (const i of proteins) g.set(i.index, Math.max(i.grams * 0.75, g.get(i.index)! * 0.8));
    }
    // Keep the plate full with vegetables.
    if (sum().kcal < before.kcal * 0.95) for (const i of veg) g.set(i.index, Math.min(i.grams + 100, i.grams * 1.5));
  } else if (diff > tol) {
    // Under-eating for the goal: more of the main foods, protein then starch.
    for (const group of [proteins, dense]) {
      diff = kcalBudget - sum().kcal;
      if (diff <= tol) break;
      const k = group.reduce((a, i) => a + kcalOf(i), 0);
      if (k <= 0) continue;
      const f = clamp(1 + diff / k, 1, 1.6);
      for (const i of group) g.set(i.index, Math.min(hi(i), g.get(i.index)! * f));
    }
  }

  // Round, and drop changes too small to matter.
  const rows: PortionRow[] = [];
  for (const i of items) {
    const to = roundG(g.get(i.index)!);
    const changed = Math.abs(to - i.grams) >= Math.max(10, i.grams * 0.08);
    g.set(i.index, changed ? to : i.grams);
    rows.push({ index: i.index, name: i.name, kind: kind.get(i.index)!, from: i.grams, to: changed ? to : i.grams });
  }
  const after = sum();
  const changed = rows.filter((r) => r.to !== r.from);

  let direction: PortionDirection = 'keep';
  if (changed.length) {
    if (after.kcal < before.kcal * 0.95) direction = 'less';
    else if (after.kcal > before.kcal * 1.05 && !(after.protein > before.protein * 1.15 && proteins.some((i) => g.get(i.index)! > i.grams) && dense.every((i) => g.get(i.index)! <= i.grams))) direction = 'more';
    else direction = after.protein > before.protein ? 'protein' : after.kcal < before.kcal ? 'less' : 'more';
  }

  const biggest = [...changed].sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))[0];
  const proteinRow = changed.find((r) => r.kind === 'protein' && r.to > r.from);
  const vegRow = changed.find((r) => r.kind === 'veg' && r.to > r.from);
  let headline: string, message: string;
  if (direction === 'keep') {
    headline = 'This plate fits your goal';
    message = `About ${Math.round(before.kcal)} kcal and ${Math.round(before.protein)} g protein is right for this meal. No changes needed.`;
  } else if (direction === 'less') {
    const r = changed.find((x) => x.kind === 'dense' && x.to < x.from) ?? biggest;
    headline = 'A smaller portion would fit better';
    message = `Your ${lower(r.name)} is about ${r.from} g. For your goal, try about ${r.to} g`
      + (proteins.length ? `, and keep the ${lower(proteins[0].name)}` : '')
      + (vegRow ? ` with more ${lower(vegRow.name)} to keep the plate full` : '') + '.';
  } else if (direction === 'more') {
    const r = changed.find((x) => x.kind === 'dense' && x.to > x.from) ?? biggest;
    headline = 'You could eat more here';
    message = `This plate is light for what you need today. Try about ${r.to} g of ${lower(r.name)} instead of ${r.from} g`
      + (proteinRow && proteinRow !== r ? ` and ${proteinRow.to} g of ${lower(proteinRow.name)}` : '') + '.';
  } else {
    const r = proteinRow ?? biggest;
    const cutRow = changed.find((x) => x.kind === 'dense' && x.to < x.from);
    headline = 'Add a bit more protein';
    message = `Try about ${r.to} g of ${lower(r.name)} instead of ${r.from} g. That brings this meal to about ${Math.round(after.protein)} g protein`
      + (cutRow ? `, with about ${cutRow.to} g of ${lower(cutRow.name)} instead of ${cutRow.from} g so calories stay about the same` : '') + '.';
  }
  if (addProtein) message += ' There’s no clear protein on this plate — adding some (eggs, beans, fish, chicken, tofu) would help.';

  return { direction, budget: { kcal: kcalBudget, protein: proteinBudget }, rows, before, after, headline, message, addProtein };
}
