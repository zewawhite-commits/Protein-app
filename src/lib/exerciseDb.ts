/**
 * The full exercise library: Free Exercise DB (public domain; start and end photos, written steps)
 * merged with Nutivili's own written guides (which add breathing, common mistakes, safety, easier and
 * harder versions). Our guide keeps its text and gains the photos only when both show the same movement.
 */
import { CATEGORY_NAMES, LEVEL_NAMES, LIBRARY, type Category, type LibExercise } from '@/data/exerciseLibrary';
import type { ExerciseKind } from './liveWorkout';

export interface Exercise {
  id: string; name: string; category: Category; kind: ExerciseKind; level: 1 | 2 | 3;
  equipment: string[]; primary: string[]; secondary: string[]; steps: string[]; images: string[];
  guide?: LibExercise;
}

/** Our guide id → the photographed exercise that is the same movement. */
const SAME: Record<string, string> = {
  push_up: 'Pushups', incline_push_up: 'Incline Push-Up', bench_press: 'Barbell Bench Press - Medium Grip', db_bench_press: 'Dumbbell Bench Press',
  incline_db_press: 'Incline Dumbbell Press', chest_press_machine: 'Machine Bench Press', chest_fly: 'Dumbbell Flyes', pull_up: 'Pullups',
  lat_pulldown: 'Wide-Grip Lat Pulldown', barbell_row: 'Bent Over Barbell Row', db_row: 'One-Arm Dumbbell Row', seated_cable_row: 'Seated Cable Rows',
  inverted_row: 'Inverted Row', band_pull_apart: 'Band Pull Apart', deadlift: 'Barbell Deadlift', back_extension: 'Hyperextensions (Back Extensions)',
  overhead_press: 'Standing Military Press', db_shoulder_press: 'Dumbbell Shoulder Press', lateral_raise: 'Side Lateral Raise', band_lateral_raise: 'Lateral Raise - With Bands',
  face_pull: 'Face Pull', db_curl: 'Dumbbell Bicep Curl', hammer_curl: 'Hammer Curls', triceps_dip: 'Bench Dips', overhead_triceps: 'Standing Dumbbell Triceps Extension',
  triceps_pushdown: 'Triceps Pushdown', close_push_up: 'Push-Ups - Close Triceps Position', squat: 'Bodyweight Squat', goblet_squat: 'Goblet Squat', back_squat: 'Barbell Squat',
  leg_press: 'Leg Press', lunge: 'Bodyweight Walking Lunge', reverse_lunge: 'Dumbbell Rear Lunge', split_squat: 'Split Squats', step_up: 'Dumbbell Step Ups',
  leg_extension: 'Leg Extensions', leg_curl: 'Lying Leg Curls', calf_raise: 'Standing Calf Raises', glute_bridge: 'Butt Lift (Bridge)', single_leg_bridge: 'Single Leg Glute Bridge',
  hip_thrust: 'Barbell Hip Thrust', romanian_deadlift: 'Romanian Deadlift', plank: 'Plank', dead_bug: 'Dead Bug', crunch: 'Crunches', reverse_crunch: 'Reverse Crunch',
  mountain_climber: 'Mountain Climbers', russian_twist: 'Russian Twist', running: 'Jogging, Treadmill', cycling: 'Bicycling, Stationary', rowing: 'Rowing, Stationary',
  jump_rope: 'Rope Jumping', squat_jump: 'Freehand Jump Squat', cat_cow: 'Cat Stretch', hamstring_stretch: 'Hamstring Stretch', quad_stretch: 'Quad Stretch',
  hip_flexor_stretch: 'Kneeling Hip Flexor', childs_pose: "Child's Pose", forward_fold: 'Standing Toe Touches', calf_stretch: 'Calf Stretch Hands Against Wall', arm_circle: 'Arm Circles',
};

/** Safety notes by type, shown on every exercise (our own guides add exercise-specific ones). */
export const SAFETY: Record<Category, string[]> = {
  chest: ['Keep your shoulder blades back and down; stop if you feel pinching in the shoulder.', 'Use a weight you can control; ask for a spotter on heavy presses.'],
  back: ['Keep a neutral spine; if your lower back rounds or hurts, lighten the weight.', 'Pull with your back, not by jerking your body.'],
  shoulders: ['Move in a comfortable range; stop if you feel pinching.', 'Avoid arching your lower back when pressing overhead.'],
  arms: ['Keep your elbows steady and the movement controlled; don’t swing the weight.'],
  legs: ['Knees track in line with your toes.', 'Keep your heels down and your chest up; stop if you feel knee pain.'],
  glutes: ['Keep your ribs down and squeeze your glutes at the top rather than arching your back.'],
  core: ['Keep your lower back supported; stop if you feel back pain.', 'Breathe out as you tighten your core; don’t hold your breath.'],
  cardio: ['Warm up for a few minutes first and build the pace gradually.', 'Ease off if you can’t speak a short sentence.'],
  mobility: ['Move slowly and only as far as is comfortable.'],
  flexibility: ['Stretch to mild tension, never pain; don’t bounce.', 'Breathe slowly and hold each stretch for 20–30 seconds.'],
};

/** Suggested sets, reps or time, by type and level. */
export function suggested(e: Pick<Exercise, 'kind' | 'level' | 'guide'>): string {
  if (e.guide) return `${e.guide.rx.sets > 1 ? `${e.guide.rx.sets} × ` : ''}${e.guide.rx.reps}${e.guide.rx.rest ? ` · rest ${e.guide.rx.rest >= 60 ? `${e.guide.rx.rest / 60} min` : `${e.guide.rx.rest} s`}` : ''}`;
  if (e.kind === 'cardio') return '10–20 minutes at a steady pace';
  if (e.kind === 'time') return e.level === 1 ? '2–3 × 20–30 seconds' : '3 × 30–45 seconds';
  return e.level === 1 ? '2–3 × 10–12 reps · rest 60–90 s' : e.level === 2 ? '3 × 8–12 reps · rest 90 s' : '3–5 × 5–8 reps · rest 2 min';
}

/** Seconds for a timed exercise (planks, stretches), for its timer. */
export function seconds(e: Pick<Exercise, 'kind' | 'level' | 'guide'> | null | undefined): number | null {
  if (!e || e.kind !== 'time') return null;
  const m = /(\d+)\s*(?:–|-|to)?\s*(\d+)?\s*(s|sec|second|min)/i.exec(e.guide?.rx.reps ?? '');
  if (m) return Number(m[2] ?? m[1]) * (/^min/i.test(m[3]) ? 60 : 1);
  return e.level === 1 ? 30 : 45;
}

let cache: Promise<Exercise[]> | null = null;
export function loadExercises(): Promise<Exercise[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/exercises.json`).then((r) => r.json()).then((d: { imageBase: string; exercises: [string, string, Category, ExerciseKind, 1 | 2 | 3, string, string[], string[], string[], string[], string][] }) => {
    const byName = new Map<string, Exercise>();
    for (const [id, name, category, kind, level, eq, primary, secondary, steps, images] of d.exercises) {
      byName.set(name, { id, name, category, kind, level, equipment: [eq], primary, secondary, steps, images: images.map((i) => d.imageBase + i) });
    }
    const out: Exercise[] = [];
    const used = new Set<string>();
    for (const g of LIBRARY) {
      const match = SAME[g.id] ? byName.get(SAME[g.id]) : undefined;
      if (match) used.add(match.name);
      out.push({ id: g.id, name: g.name, category: g.category, kind: g.kind, level: g.level, equipment: g.equipment.map(String), primary: g.primary, secondary: g.secondary, steps: [g.start, ...g.steps], images: match?.images ?? [], guide: g });
    }
    for (const [name, e] of byName) if (!used.has(name)) out.push(e);
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }).catch((e) => { cache = null; throw e; });
  return cache;
}

export const levelName = (l: 1 | 2 | 3) => LEVEL_NAMES[l];
export const categoryName = (c: Category) => CATEGORY_NAMES[c];
