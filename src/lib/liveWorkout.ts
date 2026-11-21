/**
 * Live workouts: start blank, from a routine or from the AI guide; tick sets, rest timer,
 * add / replace / skip / reorder exercises; finish to save a session to history.
 * Exercise guides are written instructions (no videos, no AI-generated images).
 */

export type ExerciseKind = 'strength' | 'cardio' | 'time';
export interface CustomExercise { id: string; name: string; muscle: string; category: ExerciseKind; equipment: string; createdAt: number; updatedAt?: number }
export interface LiveSet { weightKg?: number; reps?: number; seconds?: number; done: boolean }
export interface LiveExercise { key: string; name: string; muscle: string; kind: ExerciseKind; sets: LiveSet[]; minutes?: number; km?: number; note?: string; skipped?: boolean }
export type Feel = 'easy' | 'right' | 'hard';
export interface ActiveWorkout { name: string; startedAt: number; pausedAt?: number; pausedMs: number; rest: number; exercises: LiveExercise[]; note?: string; feel?: Feel }
export interface WorkoutLog { id: string; date: string; name: string; startedAt: number; minutes: number; exercises: LiveExercise[]; note?: string; feel?: Feel; createdAt: number }

/** Seconds the workout has been running (pauses don't count). */
export function elapsed(w: ActiveWorkout, now = Date.now()): number {
  const end = w.pausedAt ?? now;
  return Math.max(0, Math.round((end - w.startedAt - w.pausedMs) / 1000));
}
export const clock = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Estimated one-rep max (Epley), for spotting personal records. An estimate, labelled as such. */
export const est1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

export const CATEGORY_LABEL: Record<ExerciseKind, string> = { strength: 'Sets & reps', cardio: 'Time & distance', time: 'Timed' };

/**
 * Read a pasted workout plan ("Squat 3x8 60kg", "Bench press – 4 sets of 10 @ 50 kg",
 * "Plank 3 x 45s") into routine exercises. Lines that don't look like exercises are skipped.
 */
export function parseRoutineText(text: string): { name: string; sets: number; reps: string; weightKg?: number }[] {
  return text.split(/\n|;/).map((l) => l.replace(/^[\s\-•*\d.)]+(?=[a-z])/i, '').trim()).filter((l) => l.length > 2).map((l) => {
    const sxr = /(\d+)\s*(?:x|×|sets? of)\s*(\d+(?:\s*-\s*\d+)?)\s*(s|sec|secs|seconds|reps?)?/i.exec(l);
    const kg = /(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)\b/i.exec(l);
    const name = l.split(/\s+[-–]\s+|\s*[–:@(]\s*|\s+\d/)[0].trim();
    if (!name || !sxr) return null;
    const w = kg ? Number(kg[1].replace(',', '.')) * (/lb/i.test(kg[2]) ? 0.4536 : 1) : undefined;
    return { name: name.slice(0, 40), sets: Math.min(20, Number(sxr[1])), reps: `${sxr[2].replace(/\s/g, '')}${sxr[3] && /^s/i.test(sxr[3]) ? 's' : ''}`, ...(w ? { weightKg: Math.round(w * 10) / 10 } : {}) };
  }).filter((x): x is NonNullable<typeof x> => !!x);
}
