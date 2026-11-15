/**
 * In-app notices for the bell: simple, deterministic rules on today's log (no AI).
 * Each has a stable id per day so it can be marked read.
 */
import type { LogEntry, Meal } from './types';
import type { Totals } from './nutrition';
import type { Targets } from './energy';

export interface Nudge {
  id: string;
  kind: 'meal' | 'win' | 'tip' | 'warn';
  title: string;
  body: string;
  link?: string;
}

export const MEAL_TIMES: Record<'breakfast' | 'lunch' | 'dinner', string> = { breakfast: '09:30', lunch: '14:00', dinner: '20:00' };
export const EXTRA_TIMES = { workout: '18:00', weigh: '07:30' };
const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

export function computeNudges(o: {
  date: string; now: Date; entries: LogEntry[]; totals: Totals; proteinGoal: number; targets: Targets | null; streak: number;
  times?: Partial<Record<'breakfast' | 'lunch' | 'dinner', string>> & { workoutOn?: boolean; workout?: string; weighOn?: boolean; weigh?: string };
  workedOut?: boolean; weighed?: boolean; gentle?: boolean;
}): Nudge[] {
  const out: Nudge[] = [];
  const nowMin = o.now.getHours() * 60 + o.now.getMinutes();
  const logged = (m: Meal) => o.entries.some((e) => e.meal === m);
  const times = { ...MEAL_TIMES, ...o.times };
  for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
    if (nowMin >= minutes(times[meal]) && !logged(meal)) {
      out.push({ id: `${o.date}:meal:${meal}`, kind: 'meal', title: `Log your ${meal}`, body: `Whenever you’re ready — snap it, say it or search. A few seconds is enough.`, link: '/add' });
    }
  }
  if (o.times?.workoutOn && !o.workedOut && nowMin >= minutes(o.times.workout ?? EXTRA_TIMES.workout)) {
    out.push({ id: `${o.date}:move`, kind: 'tip', title: 'Time to move', body: 'Your workout guide is ready when you are. Even 15 minutes counts.', link: '/coach?view=workout' });
  }
  if (o.times?.weighOn && !o.weighed && nowMin >= minutes(o.times.weigh ?? EXTRA_TIMES.weigh)) {
    out.push({ id: `${o.date}:weigh`, kind: 'tip', title: 'Weigh-in', body: 'Log today’s weight to keep your trend line up to date. One number, ten seconds.', link: '/insights' });
  }
  const p = o.totals.protein;
  if (o.proteinGoal > 0 && p >= o.proteinGoal) {
    out.push({ id: `${o.date}:win:protein`, kind: 'win', title: 'Protein goal hit', body: `${Math.round(p)} g of ${o.proteinGoal} g today. Nice work.` });
  } else if (o.proteinGoal > 0 && nowMin >= 17 * 60 && p < o.proteinGoal * 0.75) {
    out.push({ id: `${o.date}:tip:protein`, kind: 'tip', title: `${Math.round(o.proteinGoal - p)} g protein to go`, body: 'A protein-rich dinner or snack can close the gap. Ask the coach for ideas.', link: '/coach' });
  }
  if (!o.gentle && o.targets && o.totals.kcal > o.targets.kcal * 1.1) {
    out.push({ id: `${o.date}:warn:kcal`, kind: 'warn', title: 'A bigger day today', body: `About ${Math.round(o.totals.kcal - o.targets.kcal)} kcal above your target. One day doesn’t change your trend — it’s the week that counts.` });
  }
  if (o.totals.sodium > 2300) {
    out.push({ id: `${o.date}:warn:sodium`, kind: 'warn', title: 'Salt is high today', body: `About ${Math.round(o.totals.sodium)} mg sodium (daily value 2,300 mg). Water and fresh foods help.` });
  }
  if (o.targets && nowMin >= 18 * 60 && o.entries.length >= 2 && o.totals.fiber < o.targets.fiber * 0.5) {
    out.push({ id: `${o.date}:tip:fiber`, kind: 'tip', title: 'Low on fibre', body: 'Beans, lentils, vegetables, fruit or whole grains would help.', link: '/add?q=beans cooked' });
  }
  if (!o.gentle && o.streak >= 3) {
    out.push({ id: `${o.date}:win:streak`, kind: 'win', title: `${o.streak}-day streak`, body: 'You’ve hit your protein goal several days running. Lovely consistency.' });
  }
  return out;
}

/** The next meal reminder that is due now and not yet sent today. */
export function dueReminder(now: Date, entries: LogEntry[], times: Record<'breakfast' | 'lunch' | 'dinner', string>, sent: string[]): 'breakfast' | 'lunch' | 'dinner' | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const meal of ['dinner', 'lunch', 'breakfast'] as const) {
    const t = minutes(times[meal]);
    // Within 2 hours after the reminder time, if that meal isn't logged yet.
    if (nowMin >= t && nowMin < t + 120 && !sent.includes(meal) && !entries.some((e) => e.meal === meal)) return meal;
  }
  return null;
}

/** Workout / weigh-in reminder that is due now (within 2 hours of its time) and not yet sent today. */
export function dueExtra(now: Date, r: { workoutOn?: boolean; workout?: string; weighOn?: boolean; weigh?: string }, done: { workedOut: boolean; weighed: boolean }, sent: string[]): 'workout' | 'weigh' | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const due = (t: string) => nowMin >= minutes(t) && nowMin < minutes(t) + 120;
  if (r.workoutOn && !done.workedOut && !sent.includes('workout') && due(r.workout ?? EXTRA_TIMES.workout)) return 'workout';
  if (r.weighOn && !done.weighed && !sent.includes('weigh') && due(r.weigh ?? EXTRA_TIMES.weigh)) return 'weigh';
  return null;
}
