/**
 * Plain-language insights from the person's own log: which nutrients are often short,
 * and habits that are easy to act on. Pure functions so they can be tested.
 * Everything here is general information from US FDA daily values, not medical advice.
 */
import { EXTRA_KEYS, NUTRIENTS, type ExtraKey } from './nutrients';
import type { Food, LogEntry, Profile } from './types';

const DAY = 864e5;
const keyOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const back = (today: string, n: number) => keyOf(new Date(`${today}T12:00:00`).getTime() - n * DAY);

type GapKey = ExtraKey | 'fiber';
export interface Gap { key: GapKey; label: string; unit: string; avg: number; dv: number; pct: number }

/** Nutrients that average under 70% of the daily value over the last week's logged days (needs 3+ days). */
export function nutrientGaps(entries: LogEntry[], today: string, days = 7): { gaps: Gap[]; loggedDays: number } {
  const from = back(today, days - 1);
  const eaten = entries.filter((e) => !e.planned && e.date >= from && e.date <= today);
  const dates = new Set(eaten.map((e) => e.date));
  if (dates.size < 3) return { gaps: [], loggedDays: dates.size };
  const keys: GapKey[] = ['fiber', ...EXTRA_KEYS.filter((k) => NUTRIENTS[k].dv && !NUTRIENTS[k].limit)];
  const gaps: Gap[] = [];
  for (const k of keys) {
    const total = eaten.reduce((a, e) => a + (((k === 'fiber' ? e.food.per100.fiber : e.food.per100[k]) ?? 0) * e.grams) / 100, 0);
    const avg = total / dates.size;
    const dv = k === 'fiber' ? 28 : NUTRIENTS[k].dv!;
    const pct = Math.round((avg / dv) * 100);
    if (pct < 70) gaps.push({ key: k, label: k === 'fiber' ? 'Fibre' : NUTRIENTS[k].label, unit: k === 'fiber' ? 'g' : NUTRIENTS[k].unit, avg, dv, pct });
  }
  return { gaps: gaps.sort((a, b) => a.pct - b.pct).slice(0, 3), loggedDays: dates.size };
}

/** Everyday foods richest in a nutrient per 100 g (the caller filters diet and allergies). */
export function foodsRichIn(key: GapKey, pool: Food[], n = 3): Food[] {
  const v = (f: Food) => (key === 'fiber' ? f.per100.fiber : f.per100[key]) ?? 0;
  const seen = new Set<string>();
  return pool
    .filter((f) => v(f) > 0 && !/supplement|fortified cereal|powder|dry mix|isolate/i.test(f.name))
    .sort((a, b) => v(b) - v(a))
    .filter((f) => { const b = f.name.split(',')[0].toLowerCase(); if (seen.has(b)) return false; seen.add(b); return true; })
    .slice(0, n);
}

export interface Pattern { title: string; body: string }

/** Habits from the last two weeks that are worth knowing, only when the data clearly shows them. */
export function eatingPatterns(entries: LogEntry[], today: string, proteinGoal: number, profile?: Pick<Profile, 'name'> | null): Pattern[] {
  void profile;
  const from = back(today, 13);
  const eaten = entries.filter((e) => !e.planned && e.date >= from && e.date <= today);
  const byDay = new Map<string, LogEntry[]>();
  for (const e of eaten) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const days = [...byDay.keys()].filter((d) => d !== today); // today isn't finished yet
  if (days.length < 4) return [];
  const prot = (l: LogEntry[]) => l.reduce((a, e) => a + (e.food.per100.protein * e.grams) / 100, 0);
  const kcal = (l: LogEntry[]) => l.reduce((a, e) => a + ((e.food.per100.kcal ?? 0) * e.grams) / 100, 0);
  const out: Pattern[] = [];

  // Protein goal hit rate.
  if (proteinGoal > 0) {
    const hit = days.filter((d) => prot(byDay.get(d)!) >= proteinGoal).length;
    out.push({ title: `Protein goal: ${hit} of ${days.length} days`, body: hit / days.length >= 0.7 ? 'You’re reaching it most days. Keep doing what’s working.' : `On the other days you averaged ${Math.round(days.filter((d) => prot(byDay.get(d)!) < proteinGoal).reduce((a, d) => a + prot(byDay.get(d)!), 0) / Math.max(1, days.length - hit))} g. One protein-rich snack would usually close the gap.` });
  }

  // When protein is eaten.
  const all = days.flatMap((d) => byDay.get(d)!);
  const total = prot(all);
  const breakfast = prot(all.filter((e) => e.meal === 'breakfast'));
  if (total > 0 && all.some((e) => e.meal === 'breakfast') && breakfast / total < 0.15 && proteinGoal > 0) {
    out.push({ title: 'Light on protein at breakfast', body: `Only ${Math.round((breakfast / total) * 100)}% of your protein comes at breakfast. Adding some in the morning (eggs, yogurt, beans, leftovers) makes the daily goal easier and keeps you fuller.` });
  }

  // Weekends vs weekdays.
  const weekend = days.filter((d) => [0, 6].includes(new Date(`${d}T12:00:00`).getDay()));
  const weekday = days.filter((d) => !weekend.includes(d));
  if (weekend.length >= 2 && weekday.length >= 3) {
    const we = weekend.reduce((a, d) => a + kcal(byDay.get(d)!), 0) / weekend.length;
    const wd = weekday.reduce((a, d) => a + kcal(byDay.get(d)!), 0) / weekday.length;
    if (Math.abs(we - wd) >= 300) {
      out.push({ title: we > wd ? 'Weekends run higher' : 'Weekdays run higher', body: `You eat about ${Math.round(Math.abs(we - wd) / 50) * 50} kcal more on ${we > wd ? 'weekends' : 'weekdays'}. That’s normal — just worth knowing if your progress stalls.` });
    }
  }

  // Main protein sources.
  const bySource = new Map<string, number>();
  for (const e of all) { const n = e.food.name.split(',')[0].split(' (')[0]; bySource.set(n, (bySource.get(n) ?? 0) + (e.food.per100.protein * e.grams) / 100); }
  const top = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, g]) => g > 0);
  if (top.length >= 2) out.push({ title: 'Where your protein comes from', body: `${top.map(([n]) => n).join(', ')} give you ${Math.round((top.reduce((a, [, g]) => a + g, 0) / total) * 100)}% of your protein.` });

  return out.slice(0, 4);
}
