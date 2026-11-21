import { CATEGORY_NAMES, LIBRARY } from '@/data/exerciseLibrary';
/**
 * Calories burned by exercise — an estimate: MET × body weight (kg) × hours.
 * MET values approximate the Compendium of Physical Activities (Ainsworth et al., 2011).
 * Shown labelled as an estimate; the user can type their own number (e.g. from a watch).
 */
export type ExerciseType = 'run' | 'walk' | 'cycle' | 'weights' | 'hiit' | 'swim' | 'sport' | 'yoga';
export type Intensity = 'low' | 'medium' | 'high';

export const EXERCISES: Record<ExerciseType, { label: string; met: Record<Intensity, number> }> = {
  run: { label: 'Run', met: { low: 6.0, medium: 9.8, high: 11.5 } },
  walk: { label: 'Walk', met: { low: 2.8, medium: 3.5, high: 5.0 } },
  cycle: { label: 'Cycling', met: { low: 4.0, medium: 6.8, high: 10.0 } },
  weights: { label: 'Weight lifting', met: { low: 3.5, medium: 5.0, high: 6.0 } },
  hiit: { label: 'HIIT / circuits', met: { low: 6.0, medium: 8.0, high: 10.0 } },
  swim: { label: 'Swimming', met: { low: 5.8, medium: 8.3, high: 10.0 } },
  sport: { label: 'Sport (football, etc.)', met: { low: 5.0, medium: 7.0, high: 9.0 } },
  yoga: { label: 'Yoga / pilates', met: { low: 2.5, medium: 3.0, high: 4.0 } },
};

export interface ExerciseEntry {
  id: string;
  date: string;
  type: ExerciseType;
  intensity: Intensity;
  minutes: number;
  kcal: number;
  /** True when the user typed the calories themselves. */
  manual?: boolean;
  /** Set when corrected, so the newest edit wins across devices. */
  updatedAt?: number;
  /** Optional detail for strength or timed work: any exercise, with sets, reps, weight and/or hold time. */
  detail?: { name: string; sets?: number; reps?: number; weightKg?: number; seconds?: number };
  /** Distance in km (runs, walks, rides, swims). */
  km?: number;
  note?: string;
}

export function burnedKcal(type: ExerciseType, intensity: Intensity, minutes: number, kg: number): number {
  if (!kg || minutes <= 0) return 0;
  return Math.round(EXERCISES[type].met[intensity] * kg * (minutes / 60));
}

/** A saved workout routine: exercises with planned sets, reps and weight (no videos needed). */
export interface RoutineExercise { name: string; sets: number; reps: string; weightKg?: number; muscle?: string }
export interface Routine { id: string; name: string; exercises: RoutineExercise[]; createdAt: number; updatedAt?: number }

/** Common exercises to pick from (any other name can be typed): the strength moves in the library. */
export const EXERCISE_LIBRARY: { name: string; muscle: string }[] = LIBRARY.filter((e) => e.kind === 'strength').map((e) => ({ name: e.name, muscle: CATEGORY_NAMES[e.category] }));

/** One activity read from what someone said or typed. Minutes are never guessed: null when not said. */
export interface SaidExercise { text: string; type: ExerciseType | null; intensity: Intensity; minutes: number | null; km?: number }

const KINDS: [RegExp, ExerciseType][] = [
  [/\b(ran|run|runs|running|jog|jogged|jogging|sprint|sprints|sprinted)\b/, 'run'],
  [/\b(walk|walked|walking|stroll|hike|hiked|hiking|steps)\b/, 'walk'],
  [/\b(cycl\w*|bike|biked|biking|rode|ride|spin|spinning)\b/, 'cycle'],
  [/\b(swim|swam|swimming)\b/, 'swim'],
  [/\b(hiit|circuits?|crossfit|bootcamp|burpees|skipping|jump rope|tabata)\b/, 'hiit'],
  [/\b(yoga|pilates|stretch\w*|mobility)\b/, 'yoga'],
  [/\b(gym|weights?|lift\w*|strength|squats?|bench|deadlifts?|push ?ups?|press ?ups?|pull ?ups?|dumbbells?|kettlebells?|resistance)\b/, 'weights'],
  [/\b(football|soccer|basketball|tennis|badminton|volleyball|netball|squash|boxing|martial|karate|taekwondo|danc\w*|zumba|aerobics|rugby|cricket|table tennis|ping pong)\b/, 'sport'],
];
const NUMS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty five': 45, fifty: 50, sixty: 60, ninety: 90 };
const NUM = `(\\d+(?:[.,]\\d+)?|${Object.keys(NUMS).sort((a, b) => b.length - a.length).join('|')})`;
const num = (s: string) => NUMS[s] ?? Number(s.replace(',', '.'));

function minutesIn(t: string): number | null {
  if (/\b(an|one) hour and a half\b|\bhour and a half\b/.test(t)) return 90;
  if (/\bhalf an? hour\b/.test(t)) return 30;
  if (/\bquarter of an hour\b/.test(t)) return 15;
  let m = new RegExp(`\\b(\\d+)\\s*h(?:ours?|rs?)?\\s*(?:and\\s*)?(\\d+)\\s*m(?:in(?:ute)?s?)?\\b`).exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = new RegExp(`\\b${NUM}\\s*(?:hours?|hrs?|h)\\b`).exec(t);
  const h = m ? num(m[1]) * 60 : 0;
  const mm = new RegExp(`\\b${NUM}\\s*(?:minutes?|mins?|m)\\b`).exec(t);
  const total = h + (mm ? num(mm[1]) : 0);
  return total > 0 && total <= 600 ? Math.round(total) : null;
}

/** "walked 30 minutes and did 45 min of weights", "ran 5k in 28 mins", "football for an hour". */
export function parseExercise(text: string): SaidExercise[] {
  return text.toLowerCase().replace(/[.!?]/g, ' ')
    // Spoken times first, so their "and" doesn't split them: "an hour and a half" → 90 minutes.
    .replace(/\b(?:an |one )?hour and a half\b/g, '90 minutes').replace(/\bhalf an? hour\b/g, '30 minutes').replace(/\bquarter of an hour\b/g, '15 minutes')
    .split(/,|;|\band then\b|\bthen\b|\balso\b|\band\b(?=\s+(?:i\s+)?(?:did|went|played|ran|walked|swam|cycled|lifted|a\s|an\s|some\s|\d))/)
    .map((p) => p.trim()).filter((p) => p.length > 2)
    .map((t) => {
      const type = KINDS.find(([re]) => re.test(t))?.[1] ?? null;
      const intensity: Intensity = /\b(easy|light|slow|gentle|chill|relaxed)\b/.test(t) ? 'low' : /\b(hard|intense|fast|sprints?|heavy|tough|max)\b/.test(t) ? 'high' : 'medium';
      const d = new RegExp(`\\b${NUM}\\s*(k|km|kms|kilomet(?:er|re)s?|miles?|mi)\\b`).exec(t);
      const km = d ? Math.round(num(d[1]) * (/^mi/.test(d[2]) ? 1.609344 : 1) * 100) / 100 : undefined;
      return { text: t, type, intensity, minutes: minutesIn(t.replace(d?.[0] ?? '\u0000', ' ')), ...(km && { km }) };
    })
    .filter((s) => s.type || s.minutes);
}
