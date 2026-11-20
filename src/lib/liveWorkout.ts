/**
 * Live workouts: start blank, from a routine or from the AI guide; tick sets, rest timer,
 * add / replace / skip / reorder exercises; finish to save a session to history.
 * Exercise guides are written instructions (no videos, no AI-generated images).
 */

export type ExerciseKind = 'strength' | 'cardio' | 'time';
export interface CustomExercise { id: string; name: string; muscle: string; category: ExerciseKind; equipment: string; createdAt: number; updatedAt?: number }
export interface LiveSet { weightKg?: number; reps?: number; seconds?: number; done: boolean }
export interface LiveExercise { key: string; name: string; muscle: string; kind: ExerciseKind; sets: LiveSet[]; minutes?: number; km?: number; note?: string; skipped?: boolean }
export interface ActiveWorkout { name: string; startedAt: number; pausedAt?: number; pausedMs: number; rest: number; exercises: LiveExercise[]; note?: string }
export interface WorkoutLog { id: string; date: string; name: string; startedAt: number; minutes: number; exercises: LiveExercise[]; note?: string; createdAt: number }

/** Seconds the workout has been running (pauses don't count). */
export function elapsed(w: ActiveWorkout, now = Date.now()): number {
  const end = w.pausedAt ?? now;
  return Math.max(0, Math.round((end - w.startedAt - w.pausedMs) / 1000));
}
export const clock = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Estimated one-rep max (Epley), for spotting personal records. An estimate, labelled as such. */
export const est1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

export interface Guide { kind: ExerciseKind; muscles: string; equipment: string; start: string; steps: string[]; mistakes: string[]; alternatives: string[] }

/** Written guides for the built-in exercises. */
export const GUIDES: Record<string, Guide> = {
  Squat: { kind: 'strength', muscles: 'Quads, glutes, core', equipment: 'Bodyweight, barbell or dumbbells', start: 'Feet shoulder-width, toes slightly out, chest up.', steps: ['Brace your core and breathe in.', 'Sit hips back and down until thighs are about parallel.', 'Keep knees tracking over your toes.', 'Push through the whole foot to stand.'], mistakes: ['Knees caving in', 'Heels lifting', 'Rounding the lower back'], alternatives: ['Goblet squat', 'Box squat', 'Leg press'] },
  Deadlift: { kind: 'strength', muscles: 'Hamstrings, glutes, back', equipment: 'Barbell or dumbbells', start: 'Bar over mid-foot, shins close, hands just outside legs.', steps: ['Flatten your back and brace.', 'Push the floor away, keeping the bar close.', 'Stand tall, squeezing glutes.', 'Lower by pushing hips back.'], mistakes: ['Rounded back', 'Bar drifting forward', 'Jerking the bar'], alternatives: ['Romanian deadlift', 'Kettlebell deadlift', 'Hip thrust'] },
  'Bench press': { kind: 'strength', muscles: 'Chest, shoulders, triceps', equipment: 'Barbell or dumbbells and a bench', start: 'Lie with eyes under the bar, feet flat, shoulder blades pinched.', steps: ['Lower the bar to mid-chest with control.', 'Elbows about 45° from your body.', 'Press up and slightly back.'], mistakes: ['Bouncing off the chest', 'Flared elbows', 'Lifting hips'], alternatives: ['Push-up', 'Dumbbell press', 'Machine chest press'] },
  'Overhead press': { kind: 'strength', muscles: 'Shoulders, triceps, core', equipment: 'Barbell or dumbbells', start: 'Stand tall, weight at shoulders, core tight.', steps: ['Press straight up, moving your head back slightly.', 'Lock out overhead with biceps by ears.', 'Lower with control.'], mistakes: ['Arching the lower back', 'Pressing forward'], alternatives: ['Seated dumbbell press', 'Pike push-up'] },
  'Barbell row': { kind: 'strength', muscles: 'Upper back, lats, biceps', equipment: 'Barbell or dumbbells', start: 'Hinge forward ~45°, back flat, bar hanging.', steps: ['Pull the bar to your lower ribs.', 'Squeeze shoulder blades together.', 'Lower with control.'], mistakes: ['Using momentum', 'Rounded back'], alternatives: ['Dumbbell row', 'Seated cable row', 'Inverted row'] },
  'Pull-up': { kind: 'strength', muscles: 'Lats, biceps, upper back', equipment: 'Pull-up bar', start: 'Hang with hands just wider than shoulders.', steps: ['Pull shoulders down and back.', 'Pull until chin passes the bar.', 'Lower all the way with control.'], mistakes: ['Half reps', 'Swinging'], alternatives: ['Lat pulldown', 'Band-assisted pull-up', 'Inverted row'] },
  'Push-up': { kind: 'strength', muscles: 'Chest, shoulders, triceps, core', equipment: 'None', start: 'Hands under shoulders, body in a straight line.', steps: ['Lower your chest towards the floor.', 'Keep elbows about 45° from your body.', 'Push back up, keeping hips in line.'], mistakes: ['Sagging hips', 'Head dropping'], alternatives: ['Knee push-up', 'Incline push-up'] },
  Lunge: { kind: 'strength', muscles: 'Quads, glutes', equipment: 'Bodyweight or dumbbells', start: 'Stand tall, feet hip-width.', steps: ['Step forward and lower both knees to about 90°.', 'Keep your front knee over the ankle.', 'Push back to standing.'], mistakes: ['Front knee collapsing in', 'Leaning too far forward'], alternatives: ['Split squat', 'Step-up'] },
  'Romanian deadlift': { kind: 'strength', muscles: 'Hamstrings, glutes', equipment: 'Barbell or dumbbells', start: 'Stand with weight at your thighs, soft knees.', steps: ['Push hips back, sliding the weight down your legs.', 'Stop when you feel a hamstring stretch.', 'Drive hips forward to stand.'], mistakes: ['Rounding the back', 'Bending knees too much'], alternatives: ['Good morning', 'Glute bridge'] },
  'Hip thrust': { kind: 'strength', muscles: 'Glutes, hamstrings', equipment: 'Bench, barbell or dumbbell', start: 'Upper back on a bench, weight on hips, feet flat.', steps: ['Drive hips up until body is straight from knees to shoulders.', 'Squeeze glutes at the top.', 'Lower with control.'], mistakes: ['Over-arching the back', 'Feet too far away'], alternatives: ['Glute bridge'] },
  'Leg press': { kind: 'strength', muscles: 'Quads, glutes', equipment: 'Leg press machine', start: 'Back flat on the pad, feet shoulder-width on the plate.', steps: ['Lower until knees are about 90°.', 'Press back without locking your knees.'], mistakes: ['Lower back lifting off the pad', 'Locking knees'], alternatives: ['Squat', 'Goblet squat'] },
  'Lat pulldown': { kind: 'strength', muscles: 'Lats, biceps', equipment: 'Cable machine', start: 'Sit tall, hands wider than shoulders.', steps: ['Pull the bar to your upper chest.', 'Lead with your elbows.', 'Return with control.'], mistakes: ['Leaning far back', 'Pulling behind the neck'], alternatives: ['Pull-up', 'Band pulldown'] },
  'Dumbbell curl': { kind: 'strength', muscles: 'Biceps', equipment: 'Dumbbells', start: 'Stand tall, arms by your sides, palms forward.', steps: ['Curl the weights up, elbows still.', 'Lower slowly.'], mistakes: ['Swinging', 'Elbows drifting forward'], alternatives: ['Hammer curl', 'Band curl'] },
  'Triceps dip': { kind: 'strength', muscles: 'Triceps, chest', equipment: 'Bench or dip bars', start: 'Hands on the edge behind you, legs out.', steps: ['Bend elbows to about 90°.', 'Press back up.'], mistakes: ['Shoulders rolling forward', 'Going too deep'], alternatives: ['Close-grip push-up', 'Triceps pushdown'] },
  Plank: { kind: 'time', muscles: 'Core, shoulders', equipment: 'None', start: 'Forearms under shoulders, body straight.', steps: ['Squeeze glutes and brace your stomach.', 'Hold, breathing steadily.'], mistakes: ['Hips sagging', 'Hips too high'], alternatives: ['Knee plank', 'Dead bug'] },
  Crunch: { kind: 'strength', muscles: 'Abs', equipment: 'None', start: 'Lie on your back, knees bent.', steps: ['Curl shoulders off the floor.', 'Lower slowly.'], mistakes: ['Pulling on your neck'], alternatives: ['Dead bug', 'Reverse crunch'] },
  'Calf raise': { kind: 'strength', muscles: 'Calves', equipment: 'Bodyweight or dumbbells', start: 'Stand on the edge of a step.', steps: ['Rise onto your toes.', 'Lower your heels below the step.'], mistakes: ['Bouncing'], alternatives: ['Seated calf raise'] },
  'Lateral raise': { kind: 'strength', muscles: 'Side shoulders', equipment: 'Dumbbells', start: 'Stand tall, weights by your sides.', steps: ['Raise arms out to shoulder height, slight bend in elbows.', 'Lower slowly.'], mistakes: ['Shrugging', 'Swinging'], alternatives: ['Band lateral raise'] },
  'Glute bridge': { kind: 'strength', muscles: 'Glutes, hamstrings', equipment: 'None', start: 'Lie on your back, knees bent, feet flat.', steps: ['Push hips up, squeezing glutes.', 'Lower slowly.'], mistakes: ['Arching the lower back'], alternatives: ['Hip thrust', 'Single-leg bridge'] },
  Burpee: { kind: 'strength', muscles: 'Full body', equipment: 'None', start: 'Stand tall.', steps: ['Squat and place hands down.', 'Jump feet back to a plank.', 'Jump feet in and jump up.'], mistakes: ['Sagging hips in the plank'], alternatives: ['Step-back burpee', 'Squat thrust'] },
  'Mountain climber': { kind: 'time', muscles: 'Core, shoulders', equipment: 'None', start: 'High plank.', steps: ['Drive knees towards your chest one at a time, quickly.'], mistakes: ['Hips bouncing high'], alternatives: ['Slow mountain climber'] },
  'Jump squat': { kind: 'strength', muscles: 'Legs', equipment: 'None', start: 'Feet shoulder-width.', steps: ['Squat down.', 'Jump up explosively.', 'Land softly and go again.'], mistakes: ['Landing stiff-legged'], alternatives: ['Squat'] },
  'Kettlebell swing': { kind: 'strength', muscles: 'Glutes, hamstrings, back', equipment: 'Kettlebell', start: 'Feet wider than hips, bell in front.', steps: ['Hike the bell back between your legs.', 'Snap hips forward to swing it to chest height.', 'Let it fall back and repeat.'], mistakes: ['Squatting instead of hinging', 'Lifting with arms'], alternatives: ['Romanian deadlift', 'Hip thrust'] },
  'Bicycle crunch': { kind: 'strength', muscles: 'Abs, obliques', equipment: 'None', start: 'Lie on your back, hands by your head.', steps: ['Bring opposite elbow and knee together, alternating.'], mistakes: ['Pulling the neck'], alternatives: ['Dead bug'] },
  Running: { kind: 'cardio', muscles: 'Legs, heart and lungs', equipment: 'Running shoes', start: 'Warm up with 5 minutes of brisk walking.', steps: ['Run at a pace where you can still talk.', 'Cool down by walking.'], mistakes: ['Starting too fast'], alternatives: ['Brisk walk', 'Cycling'] },
  Walking: { kind: 'cardio', muscles: 'Legs, heart', equipment: 'None', start: 'Stand tall, relaxed shoulders.', steps: ['Walk briskly, swinging your arms.'], mistakes: [], alternatives: ['Cycling'] },
  Cycling: { kind: 'cardio', muscles: 'Legs, heart and lungs', equipment: 'Bike', start: 'Seat at hip height.', steps: ['Pedal at a steady effort.'], mistakes: ['Seat too low'], alternatives: ['Walking'] },
  Swimming: { kind: 'cardio', muscles: 'Full body, heart and lungs', equipment: 'Pool', start: 'Warm up with easy lengths.', steps: ['Swim at a steady effort, resting as needed.'], mistakes: [], alternatives: ['Cycling'] },
  'Rowing machine': { kind: 'cardio', muscles: 'Back, legs, heart', equipment: 'Rowing machine', start: 'Feet strapped, arms straight.', steps: ['Push with legs, then lean back, then pull arms.', 'Reverse the order to return.'], mistakes: ['Pulling with arms first'], alternatives: ['Cycling'] },
  'Jump rope': { kind: 'time', muscles: 'Calves, heart and lungs', equipment: 'Skipping rope', start: 'Rope behind you, elbows close.', steps: ['Turn the rope with your wrists, small jumps.'], mistakes: ['Jumping too high'], alternatives: ['Jumping jacks'] },
  Yoga: { kind: 'time', muscles: 'Full body, mobility', equipment: 'Mat', start: 'Find a quiet space.', steps: ['Move through poses slowly with steady breathing.'], mistakes: ['Forcing a stretch'], alternatives: ['Stretching'] },
  Stretching: { kind: 'time', muscles: 'Mobility', equipment: 'None', start: 'Warm up a little first.', steps: ['Hold each stretch 20–30 seconds, breathing calmly.'], mistakes: ['Bouncing'], alternatives: ['Yoga'] },
};

export const CATEGORY_LABEL: Record<ExerciseKind, string> = { strength: 'Sets & reps', cardio: 'Time & distance', time: 'Timed' };
