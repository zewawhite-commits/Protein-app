/**
 * Ready-made workouts anyone can start (no AI). Every exercise is in the library, so each has
 * written steps and, where available, photos. Times include rests and are estimates.
 * [exercise name, sets, reps — or seconds for timed moves (e.g. "30s"), or minutes for cardio ("10 min")]
 */
export type Focus = 'Full body' | 'Upper body' | 'Lower body' | 'Glutes' | 'Core' | 'Cardio' | 'Stretching' | 'Mobility';
export type Kit = 'none' | 'dumbbells' | 'bands' | 'kettlebell' | 'gym';
export interface Workout { id: string; name: string; focus: Focus; level: 1 | 2 | 3; minutes: number; kit: Kit; place: 'home' | 'gym' | 'anywhere'; about: string; moves: [string, number, string][] }

export const WORKOUTS: Workout[] = [
  // ---- No equipment
  { id: 'starter_full', name: 'First full-body workout', focus: 'Full body', level: 1, minutes: 15, kit: 'none', place: 'anywhere', about: 'Six simple moves for every major muscle. A good first session.',
    moves: [['Squat', 2, '10'], ['Incline push-up', 2, '8'], ['Glute bridge', 2, '12'], ['Bird dog', 2, '8 each side'], ['Plank', 2, '20s'], ['Calf raise', 2, '15']] },
  { id: 'home_full_20', name: 'Full body at home', focus: 'Full body', level: 2, minutes: 25, kit: 'none', place: 'home', about: 'Strength and a little cardio, no kit needed.',
    moves: [['Squat', 3, '15'], ['Push-up', 3, '10'], ['Reverse lunge', 3, '10 each leg'], ['Inverted row', 3, '8'], ['Mountain climber', 3, '30s'], ['Plank', 3, '30s']] },
  { id: 'lower_body_25', name: 'Lower body strength', focus: 'Lower body', level: 1, minutes: 25, kit: 'none', place: 'anywhere', about: 'Legs and glutes with your body weight.',
    moves: [['Squat', 3, '12'], ['Reverse lunge', 3, '10 each leg'], ['Glute bridge', 3, '15'], ['Step-up', 3, '10 each leg'], ['Wall sit', 2, '30s'], ['Calf raise', 3, '15']] },
  { id: 'glutes_home', name: 'Glutes at home', focus: 'Glutes', level: 1, minutes: 20, kit: 'none', place: 'home', about: 'Bridges, lunges and side work for stronger glutes.',
    moves: [['Glute bridge', 3, '15'], ['Single-leg glute bridge', 3, '10 each leg'], ['Clamshell', 3, '15 each side'], ['Side-lying leg raise', 2, '15 each side'], ['Reverse lunge', 3, '10 each leg']] },
  { id: 'core_15', name: 'Core workout', focus: 'Core', level: 1, minutes: 15, kit: 'none', place: 'anywhere', about: 'A steady core routine that’s kind to your back.',
    moves: [['Dead bug', 3, '8 each side'], ['Bird dog', 3, '8 each side'], ['Plank', 3, '30s'], ['Side plank', 2, '20s each side'], ['Reverse crunch', 2, '12']] },
  { id: 'core_10_hard', name: 'Ten-minute abs', focus: 'Core', level: 2, minutes: 10, kit: 'none', place: 'anywhere', about: 'Short and hard. Rest only as long as you need.',
    moves: [['Crunch', 2, '15'], ['Bicycle crunch', 2, '20'], ['Russian twist', 2, '20'], ['Mountain climber', 2, '30s'], ['Plank', 2, '45s']] },
  { id: 'upper_home', name: 'Upper body, no equipment', focus: 'Upper body', level: 2, minutes: 20, kit: 'none', place: 'home', about: 'Chest, shoulders, back and arms with your body weight.',
    moves: [['Push-up', 3, '10'], ['Pike push-up', 3, '8'], ['Inverted row', 3, '8'], ['Triceps dip', 3, '10'], ['Close-grip push-up', 2, '8']] },
  { id: 'cardio_hiit_15', name: 'Cardio blast', focus: 'Cardio', level: 2, minutes: 15, kit: 'none', place: 'anywhere', about: 'Intervals: 30 seconds on, 30 seconds easy.',
    moves: [['Jumping jack', 3, '30s'], ['High knees', 3, '30s'], ['Mountain climber', 3, '30s'], ['Jump squat', 3, '30s'], ['Burpee', 2, '30s']] },
  { id: 'cardio_easy_10', name: 'Easy cardio', focus: 'Cardio', level: 1, minutes: 10, kit: 'none', place: 'anywhere', about: 'Low-impact moves to raise your heart rate gently.',
    moves: [['Walking', 1, '5 min'], ['Jumping jack', 2, '20s'], ['High knees', 2, '20s'], ['Arm circles', 1, '30s']] },
  { id: 'walk_30', name: 'Brisk walk', focus: 'Cardio', level: 1, minutes: 30, kit: 'none', place: 'anywhere', about: 'Thirty minutes at a pace where you can talk but not sing.',
    moves: [['Walking', 1, '30 min']] },
  { id: 'run_20', name: 'Easy run', focus: 'Cardio', level: 2, minutes: 25, kit: 'none', place: 'anywhere', about: 'Five minutes’ walk, fifteen minutes’ easy run, five minutes’ walk.',
    moves: [['Walking', 1, '5 min'], ['Running', 1, '15 min'], ['Walking', 1, '5 min']] },
  { id: 'stretch_10', name: 'Full body stretch', focus: 'Stretching', level: 1, minutes: 10, kit: 'none', place: 'anywhere', about: 'Hold each stretch, breathe slowly.',
    moves: [['Hamstring stretch', 2, '30s'], ['Quad stretch', 2, '30s each side'], ['Kneeling hip flexor stretch', 2, '30s each side'], ['Child’s pose', 1, '45s'], ['Doorway chest stretch', 2, '30s'], ['Calf stretch', 2, '30s each side']] },
  { id: 'mobility_morning', name: 'Morning mobility', focus: 'Mobility', level: 1, minutes: 8, kit: 'none', place: 'anywhere', about: 'Wake up your hips, back and shoulders.',
    moves: [['Cat–cow', 1, '10'], ['Hip circles', 1, '10 each way'], ['Open book', 1, '8 each side'], ['World’s greatest stretch', 1, '5 each side'], ['Arm circles', 1, '30s']] },
  { id: 'desk_reset_5', name: 'Five-minute desk reset', focus: 'Mobility', level: 1, minutes: 5, kit: 'none', place: 'anywhere', about: 'For when you’ve been sitting too long.',
    moves: [['Doorway chest stretch', 1, '30s'], ['Open book', 1, '6 each side'], ['Standing forward fold', 1, '30s'], ['Kneeling hip flexor stretch', 1, '30s each side']] },
  // ---- Dumbbells
  { id: 'db_full_30', name: 'Dumbbell full body', focus: 'Full body', level: 2, minutes: 35, kit: 'dumbbells', place: 'home', about: 'A complete strength session with one pair of dumbbells.',
    moves: [['Goblet squat', 3, '10'], ['Dumbbell bench press', 3, '10'], ['Single-arm dumbbell row', 3, '10 each arm'], ['Romanian deadlift', 3, '10'], ['Dumbbell shoulder press', 3, '10'], ['Plank', 3, '30s']] },
  { id: 'db_upper_30', name: 'Upper body', focus: 'Upper body', level: 2, minutes: 30, kit: 'dumbbells', place: 'home', about: 'Push, pull and arms.',
    moves: [['Dumbbell bench press', 3, '10'], ['Single-arm dumbbell row', 3, '10 each arm'], ['Dumbbell shoulder press', 3, '10'], ['Lateral raise', 3, '12'], ['Dumbbell curl', 3, '12'], ['Overhead triceps extension', 3, '12']] },
  { id: 'db_lower_30', name: 'Legs and glutes', focus: 'Lower body', level: 2, minutes: 30, kit: 'dumbbells', place: 'home', about: 'Squat, hinge and lunge patterns with dumbbells.',
    moves: [['Goblet squat', 4, '10'], ['Romanian deadlift', 3, '10'], ['Reverse lunge', 3, '10 each leg'], ['Step-up', 3, '10 each leg'], ['Calf raise', 3, '15']] },
  { id: 'arms_20', name: 'Arms', focus: 'Upper body', level: 1, minutes: 20, kit: 'dumbbells', place: 'home', about: 'Biceps and triceps.',
    moves: [['Dumbbell curl', 3, '12'], ['Hammer curl', 3, '12'], ['Overhead triceps extension', 3, '12'], ['Triceps dip', 3, '10'], ['Close-grip push-up', 2, '8']] },
  // ---- Bands / kettlebell
  { id: 'band_full_20', name: 'Resistance band workout', focus: 'Full body', level: 1, minutes: 20, kit: 'bands', place: 'anywhere', about: 'One band, whole body. Great for travel.',
    moves: [['Squat', 3, '12'], ['Resistance band row', 3, '12'], ['Band shoulder press', 3, '12'], ['Band pull-apart', 3, '15'], ['Band biceps curl', 3, '12'], ['Glute bridge', 3, '15']] },
  { id: 'kb_20', name: 'Kettlebell basics', focus: 'Full body', level: 2, minutes: 20, kit: 'kettlebell', place: 'home', about: 'Hinge, squat and swing with one kettlebell.',
    moves: [['Kettlebell deadlift', 3, '10'], ['Goblet squat', 3, '10'], ['Kettlebell swing', 4, '15'], ['Plank', 3, '30s']] },
  // ---- Gym
  { id: 'gym_full_45', name: 'Gym full body', focus: 'Full body', level: 2, minutes: 45, kit: 'gym', place: 'gym', about: 'The big lifts plus accessories, twice or three times a week.',
    moves: [['Barbell back squat', 4, '8'], ['Bench press', 4, '8'], ['Lat pulldown', 3, '10'], ['Romanian deadlift', 3, '10'], ['Seated cable row', 3, '10'], ['Plank', 3, '45s']] },
  { id: 'gym_push_45', name: 'Push day', focus: 'Upper body', level: 2, minutes: 45, kit: 'gym', place: 'gym', about: 'Chest, shoulders and triceps.',
    moves: [['Bench press', 4, '8'], ['Incline dumbbell press', 3, '10'], ['Overhead press', 3, '8'], ['Lateral raise', 3, '12'], ['Triceps pushdown', 3, '12'], ['Dumbbell chest fly', 2, '12']] },
  { id: 'gym_pull_45', name: 'Pull day', focus: 'Upper body', level: 2, minutes: 45, kit: 'gym', place: 'gym', about: 'Back and biceps.',
    moves: [['Deadlift', 3, '5'], ['Pull-up', 3, '6'], ['Barbell row', 3, '8'], ['Seated cable row', 3, '10'], ['Face pull', 3, '15'], ['Hammer curl', 3, '12']] },
  { id: 'gym_legs_50', name: 'Leg day', focus: 'Lower body', level: 2, minutes: 50, kit: 'gym', place: 'gym', about: 'Quads, hamstrings, glutes and calves.',
    moves: [['Barbell back squat', 4, '8'], ['Leg press', 3, '12'], ['Romanian deadlift', 3, '10'], ['Leg curl', 3, '12'], ['Leg extension', 3, '12'], ['Calf raise', 4, '15']] },
  { id: 'gym_glutes_40', name: 'Glute builder', focus: 'Glutes', level: 2, minutes: 40, kit: 'gym', place: 'gym', about: 'Heavy hip thrusts and hinges.',
    moves: [['Hip thrust', 4, '10'], ['Romanian deadlift', 3, '10'], ['Bulgarian split squat', 3, '10 each leg'], ['Leg press', 3, '12'], ['Back extension', 2, '15']] },
  { id: 'gym_machines_30', name: 'Machines for beginners', focus: 'Full body', level: 1, minutes: 30, kit: 'gym', place: 'gym', about: 'Guided machines: easy to learn, easy to load.',
    moves: [['Leg press', 3, '12'], ['Chest press machine', 3, '12'], ['Lat pulldown', 3, '12'], ['Seated cable row', 3, '12'], ['Leg curl', 3, '12'], ['Leg extension', 2, '12']] },
  { id: 'gym_strength_60', name: 'Strength: heavy day', focus: 'Full body', level: 3, minutes: 60, kit: 'gym', place: 'gym', about: 'Low reps, long rests. Warm up well first.',
    moves: [['Barbell back squat', 5, '5'], ['Bench press', 5, '5'], ['Deadlift', 3, '5'], ['Overhead press', 3, '6'], ['Pull-up', 3, '6']] },
  { id: 'rower_20', name: 'Rowing intervals', focus: 'Cardio', level: 2, minutes: 20, kit: 'gym', place: 'gym', about: 'Steady rowing with a few harder pushes.',
    moves: [['Rowing machine', 1, '20 min']] },
  { id: 'bike_30', name: 'Bike session', focus: 'Cardio', level: 1, minutes: 30, kit: 'gym', place: 'gym', about: 'Thirty steady minutes on the bike.',
    moves: [['Cycling', 1, '30 min']] },
];

export const FOCI: Focus[] = ['Full body', 'Upper body', 'Lower body', 'Glutes', 'Core', 'Cardio', 'Stretching', 'Mobility'];
export const KIT_NAMES: Record<Kit, string> = { none: 'No equipment', dumbbells: 'Dumbbells', bands: 'Bands', kettlebell: 'Kettlebell', gym: 'Gym' };
export const DURATIONS = [5, 10, 15, 20, 30, 45, 60];
