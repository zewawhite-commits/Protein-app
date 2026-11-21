/**
 * Personal goals: several at once, each with its own measure, period, optional deadline and
 * status. Targets that already exist in the app (protein, calories, goal weight, water,
 * workouts a week) stay where they are — a goal here just switches tracking on, so there is
 * one place each number lives. New kinds (distance, strength sessions) keep their target here.
 */
import { useStore } from '@/store/useStore';
import { addDays, todayKey } from './dates';
import { calorieGoal } from './energy';
import { sumEntries } from './nutrition';
import { goalOn } from '@/store/useStore';

import type { GoalKind, GoalSetting, GoalSettings } from './types';
export type { GoalKind, GoalSetting, GoalSettings };

export const GOAL_INFO: Record<GoalKind, { title: string; what: string; unit: string; period: 'day' | 'week' | 'total' }> = {
  weight: { title: 'Reach a weight', what: 'Lose, gain or keep your weight', unit: 'kg', period: 'total' },
  protein: { title: 'Protein every day', what: 'Grams of protein a day', unit: 'g', period: 'day' },
  calories: { title: 'Calories', what: 'Your daily calorie target', unit: 'kcal', period: 'day' },
  water: { title: 'Drink water', what: 'Water a day', unit: 'L', period: 'day' },
  workouts: { title: 'Work out regularly', what: 'Workouts a week', unit: 'workouts', period: 'week' },
  distance: { title: 'Run, walk or cycle', what: 'Distance a week', unit: 'km', period: 'week' },
  strength: { title: 'Strength training', what: 'Strength sessions a week', unit: 'sessions', period: 'week' },
};
export const GOAL_KINDS = Object.keys(GOAL_INFO) as GoalKind[];

export interface GoalProgress { kind: GoalKind; target: number | null; current: number | null; left: number | null; onTrack: boolean | null; note: string }

const weekStart = (today: string) => { const d = new Date(`${today}T12:00:00`); const back = (d.getDay() + 6) % 7; return addDays(today, -back); };

/** Where each switched-on goal stands right now. */
export function goalProgress(kind: GoalKind): GoalProgress {
  const s = useStore.getState();
  const p = s.profile;
  const g = s.settings.goals?.[kind];
  const today = todayKey();
  const monday = weekStart(today);
  const thisWeek = (d: string) => d >= monday && d <= today;
  const res = (target: number | null, current: number | null, note = '', lowerIsBetter = false): GoalProgress => {
    const left = target != null && current != null ? Math.round((lowerIsBetter ? current - target : target - current) * 10) / 10 : null;
    return { kind, target, current, left, onTrack: left == null ? null : left <= 0, note };
  };
  switch (kind) {
    case 'weight': {
      const target = p?.goalWeightKg ?? null;
      const latest = s.weights.length ? s.weights[s.weights.length - 1].kg : p?.bodyWeightKg ?? null;
      if (target == null || latest == null) return res(target, latest, 'Set a goal weight to track this.');
      const first = s.weights[0]?.kg ?? latest;
      const losing = target < first;
      const left = Math.round(Math.abs(latest - target) * 10) / 10;
      const towards = losing ? latest <= first : latest >= first;
      let note = left <= 0.2 ? 'You’re there.' : `${left} kg to go`;
      if (g?.deadline && left > 0.2) {
        const weeks = Math.max(0.1, (Date.parse(g.deadline) - Date.now()) / (7 * 864e5));
        const perWeek = left / weeks;
        note += weeks > 0 ? ` · about ${Math.round(perWeek * 10) / 10} kg a week to hit your date${perWeek > 1 ? ' (faster than the usual safe pace of 0.5–1 kg)' : ''}` : ' · the date has passed';
      }
      return { kind, target, current: latest, left, onTrack: left <= 0.2 ? true : towards, note };
    }
    case 'protein': {
      const goal = goalOn(today, s.goalHistory, p);
      const eaten = sumEntries(s.entries.filter((e) => e.date === today && !e.planned)).protein;
      return res(goal || null, Math.round(eaten), 'Today');
    }
    case 'calories': {
      const t = p ? calorieGoal(p)?.kcal ?? null : null;
      const eaten = sumEntries(s.entries.filter((e) => e.date === today && !e.planned)).kcal;
      const r = res(t, Math.round(eaten), 'Today');
      return { ...r, onTrack: t == null ? null : eaten <= t * 1.05 };
    }
    case 'water': {
      const t = s.settings.waterGoalMl ?? (p?.bodyWeightKg ? Math.round(p.bodyWeightKg * 35 / 250) * 250 : null);
      const ml = s.water?.[today] ?? 0;
      return res(t ? t / 1000 : null, Math.round(ml / 100) / 10, 'Today');
    }
    case 'workouts': {
      const days = new Set([...s.workoutLogs.filter((w) => thisWeek(w.date)).map((w) => w.date), ...s.exercises.filter((e) => thisWeek(e.date)).map((e) => e.date)]);
      return res(s.settings.workoutsPerWeek ?? null, days.size, 'This week (Mon–Sun)');
    }
    case 'distance': {
      const km = s.exercises.filter((e) => thisWeek(e.date) && e.km).reduce((a, e) => a + (e.km ?? 0), 0) + s.workoutLogs.filter((w) => thisWeek(w.date)).reduce((a, w) => a + w.exercises.reduce((b, x) => b + (x.km ?? 0), 0), 0);
      return res(g?.target ?? null, Math.round(km * 10) / 10, 'This week (Mon–Sun)');
    }
    case 'strength': {
      const days = new Set([...s.workoutLogs.filter((w) => thisWeek(w.date) && w.exercises.some((e) => e.kind === 'strength' && e.sets.some((x) => x.done))).map((w) => w.date), ...s.exercises.filter((e) => thisWeek(e.date) && e.type === 'weights').map((e) => e.date)]);
      return res(g?.target ?? null, days.size, 'This week (Mon–Sun)');
    }
  }
}

/** Switched-on goals that aren't paused or finished. */
export function activeGoals(goals: GoalSettings | undefined): GoalKind[] {
  return GOAL_KINDS.filter((k) => goals?.[k]?.on && !goals[k]!.paused && !goals[k]!.done);
}

/** A short summary for the coach, so its advice fits what the person is working towards. */
export function goalsForCoach(): string[] {
  const goals = useStore.getState().settings.goals;
  return activeGoals(goals).map((k) => {
    const p = goalProgress(k);
    const i = GOAL_INFO[k];
    return `${i.title}: target ${p.target ?? 'not set'} ${i.unit}${i.period === 'day' ? ' a day' : i.period === 'week' ? ' a week' : ''}; now ${p.current ?? '?'}${goals?.[k]?.deadline ? `; by ${goals[k]!.deadline}` : ''}`;
  });
}

/** Sensible bounds, so a typo can't set an unsafe target. */
export const GOAL_LIMITS: Partial<Record<GoalKind, [number, number]>> = { distance: [1, 300], strength: [1, 7] };

