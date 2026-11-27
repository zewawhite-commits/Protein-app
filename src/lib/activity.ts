import type { ExerciseEntry } from './exercise';

/**
 * Steps and movement for one day. Typed in by hand on the web today; the same shape is what a
 * native app will fill from Apple Health (HealthKit) or Android Health Connect, with `source` set.
 */
export interface StepDay {
  steps: number;
  /** Walking/running distance in km, when known. */
  km?: number;
  /** Active calories the person's watch or phone reported. When set, it's used instead of our estimate. */
  activeKcal?: number;
  source: 'manual' | 'healthkit' | 'healthconnect';
  updatedAt: number;
}

export const DEFAULT_STEP_GOAL = 8000;
export const DEFAULT_MOVE_GOAL = 350;

/** Rough walking distance from steps: about 0.75 m a step for adults (varies with height and pace). */
export const kmFromSteps = (steps: number) => Math.round(steps * 0.00075 * 100) / 100;

/**
 * Rough active calories from steps: about 0.04 kcal a step at 70 kg, scaled by body weight.
 * Only used when there's no number from a watch; always shown as an estimate.
 */
export const kcalFromSteps = (steps: number, kg: number) => Math.round(steps * 0.04 * ((kg || 70) / 70));

export interface DayActivity {
  steps: number | null;
  km: number;
  /** Active calories: movement only, never the whole day's energy use. */
  activeKcal: number;
  /** True when any part of activeKcal is our estimate rather than a measured number. */
  estimated: boolean;
  minutes: number;
  sessions: number;
}

/**
 * One day's movement. Exercise sessions that already carry steps (a logged walk) aren't counted
 * again from the day's step total, so a walk logged both ways isn't double counted.
 */
export function dayActivity(date: string, day: StepDay | undefined, exercises: ExerciseEntry[], kg: number): DayActivity {
  const ex = exercises.filter((e) => e.date === date);
  const exKcal = ex.reduce((a, e) => a + (e.kcal || 0), 0);
  const exSteps = ex.reduce((a, e) => a + (e.steps ?? 0), 0);
  const exKm = ex.reduce((a, e) => a + (e.km ?? 0), 0);
  const minutes = ex.reduce((a, e) => a + (e.minutes || 0), 0);
  if (day?.activeKcal != null) {
    // The watch's number already includes workouts it saw.
    return { steps: day.steps, km: day.km ?? kmFromSteps(day.steps), activeKcal: day.activeKcal, estimated: false, minutes, sessions: ex.length };
  }
  const extraSteps = day ? Math.max(0, day.steps - exSteps) : 0;
  const stepKcal = kcalFromSteps(extraSteps, kg);
  const km = day ? (day.km ?? kmFromSteps(day.steps)) : exKm;
  return {
    steps: day ? day.steps : exSteps || null,
    km: Math.max(km, exKm),
    activeKcal: exKcal + stepKcal,
    estimated: stepKcal > 0 || ex.some((e) => !e.manual),
    minutes,
    sessions: ex.length,
  };
}

/**
 * Native health data, for later. A web browser can't read Apple Health or Health Connect, so on
 * the web `available` is false and nothing is pretended. A native build supplies an adapter that
 * asks permission, then returns days and workouts with their own ids (dedupe uses externalId).
 */
export interface HealthAdapter {
  name: 'Apple Health' | 'Health Connect';
  available: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  readDays: (from: string, to: string) => Promise<{ date: string; steps: number; km?: number; activeKcal?: number }[]>;
  readWorkouts: (from: string, to: string) => Promise<Omit<ExerciseEntry, 'id'>[]>;
}

/** Set by a native shell (Capacitor or similar) at start-up; stays null in the browser. */
export let healthAdapter: HealthAdapter | null = null;
export const registerHealthAdapter = (a: HealthAdapter) => { healthAdapter = a; };

/** A fast: from the last meal (start) to the first meal (end). Free for everyone. */
export interface Fast { id: string; start: number; end?: number; goalH: number }
export const FAST_PRESETS = [12, 14, 16, 18, 20] as const;
