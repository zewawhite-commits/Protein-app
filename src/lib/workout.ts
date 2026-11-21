/**
 * AI workout guide (shared by api/workout.ts). Claude writes a weekly training plan for
 * the person's goal, experience, kit and time. The guide is general fitness guidance,
 * not medical advice; the app shows that line with it.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { CHAT_MODEL } from './coach.js';
import type { CoachContext } from './coach.js';
import { CATEGORY_NAMES, EQUIP_NAMES, LIBRARY } from '../data/exerciseLibrary.js';

export interface WorkoutExercise { name: string; sets: number; reps: string; restSeconds: number; how: string }
export interface WorkoutDay { name: string; weekday?: string; focus: string; minutes: number; warmup: string; exercises: WorkoutExercise[] }
export interface WorkoutPlan { title: string; daysPerWeek: number; days: WorkoutDay[]; tips: string[] }
export type Goal = 'muscle' | 'strength' | 'fat_loss' | 'endurance' | 'general' | 'flexibility';
export interface WorkoutRequest {
  daysPerWeek: number; minutes: number; place: 'gym' | 'home' | 'outdoors'; level: 'beginner' | 'intermediate' | 'advanced'; focus: string;
  goal?: Goal; equipment?: string[]; weekdays?: string[]; likes?: string; dislikes?: string; limits?: string;
  /** What they actually did recently (filled in by the app): "Mon 17 Nov: Push day (chest, shoulders) — felt hard". */
  recent?: string[];
}

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    daysPerWeek: { type: 'integer' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, weekday: { type: 'string' }, focus: { type: 'string' }, minutes: { type: 'integer' }, warmup: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, sets: { type: 'integer' }, reps: { type: 'string' }, restSeconds: { type: 'integer' }, how: { type: 'string' } },
              required: ['name', 'sets', 'reps', 'restSeconds', 'how'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'weekday', 'focus', 'minutes', 'warmup', 'exercises'],
        additionalProperties: false,
      },
    },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'daysPerWeek', 'days', 'tips'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are a qualified personal trainer writing a weekly workout guide inside Nutivili AI, a nutrition and fitness app.

Write a safe, sensible plan for this person, following these rules:
- Exercises: use ONLY names from the exercise library list you're given (exactly as written), and only ones their equipment allows. Every library exercise has a written guide in the app.
- Goal, level, days, time and place: match them exactly. Exactly the number of training days asked; if training weekdays are given, put one session on each of those days ("weekday" = that day's name), otherwise spread the days out with rest days between (e.g. Mon/Wed/Fri) and give each a weekday.
- Recovery: never train the same major muscle group hard on consecutive days. With 4+ days use a split (upper/lower or push/pull/legs); with 2–3 days use full-body sessions on non-consecutive days.
- Time: each session must fit the minutes asked, counting warm-up, sets and rest (roughly 1 minute per set plus the rest). Fewer exercises rather than rushing.
- Variety and history: look at what they did recently. Don't repeat the exact same session on back-to-back days, avoid muscles they trained hard in the last 48 hours on the first day, and vary exercises from last week where it doesn't hurt progress (keep main lifts for progression).
- Feedback: if recent sessions felt "too hard", lower volume or pick easier variations; if "too easy", progress a little (one more set, harder variation, or small weight increases).
- Level: beginners get simple, stable movements (machines, goblet squat, push-up variations), 2–3 sets, moderate reps; no advanced lifts unless asked.
- Likes/dislikes: include liked exercises where they fit; never include disliked ones.
- Injuries or limits: leave out movements that load the affected area and choose gentle alternatives. Don't diagnose or prescribe rehab; in tips, tell them to stop anything painful and get it assessed by a doctor or physiotherapist.
- Pregnant, older or very new people: low-impact options and say to check with a doctor if unsure.
- "reps": a range ("8–12"), a time ("30 s") or a distance ("2 km"). "how" = one short cue on form or effort. "warmup": one line.
- "tips": 2–4 short tips on progression (e.g. add a little weight once all sets reach the top of the rep range), rest, consistency and food around training (enough protein for their goal).
No medical claims. Plain English.`;

export async function workoutWithClient(client: Anthropic, context: CoachContext, req: WorkoutRequest, contextText: (c: CoachContext) => string): Promise<WorkoutPlan> {
  const response = await client.beta.messages.create({
    // The faster model keeps a whole week inside the server's time limit.
    model: CHAT_MODEL,
    max_tokens: 12000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    system: [
      { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: contextText(context) },
    ],
    messages: [{ role: 'user', content: workoutPrompt(req) }],
  });
  if (response.stop_reason === 'refusal') throw new Error('No workout guide available for that request.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No workout guide returned.');
  return sanitizeWorkout(JSON.parse(text.text));
}

const GOALS: Record<Goal, string> = { muscle: 'build muscle', strength: 'get stronger', fat_loss: 'lose fat', endurance: 'improve endurance', general: 'general fitness and health', flexibility: 'flexibility and mobility' };

/** The request as text for the model, with the library exercises their equipment allows. */
export function workoutPrompt(req: WorkoutRequest): string {
  const have = new Set(req.equipment?.length ? req.equipment : req.place === 'gym' ? Object.keys(EQUIP_NAMES) : ['none', 'mat']);
  ['none', 'mat'].forEach((e) => have.add(e));
  if (req.place === 'outdoors') ['shoes', 'rope'].forEach((e) => have.add(e));
  const maxLevel = req.level === 'beginner' ? 2 : 3;
  const allowed = LIBRARY.filter((e) => e.level <= maxLevel && e.equipment.every((q) => have.has(q)));
  const lines = [
    `Make my weekly workout guide: ${req.daysPerWeek} days a week, about ${req.minutes} minutes each, training ${req.place === 'gym' ? 'at a gym' : req.place === 'home' ? 'at home' : 'outdoors'}, ${req.level} level.`,
    req.goal ? `Main goal: ${GOALS[req.goal]}.` : '',
    req.weekdays?.length ? `Days I can train: ${req.weekdays.join(', ')}.` : '',
    `Equipment I have: ${[...have].map((e) => EQUIP_NAMES[e as keyof typeof EQUIP_NAMES] ?? e).join(', ')}.`,
    req.likes ? `Exercises I enjoy: ${req.likes}.` : '',
    req.dislikes ? `Exercises I don't want: ${req.dislikes}.` : '',
    req.limits ? `Injuries or limits: ${req.limits}.` : '',
    req.focus ? `Anything else: ${req.focus}.` : '',
    req.recent?.length ? `What I did in the last two weeks (newest first):\n${req.recent.join('\n')}` : 'No recent workouts recorded.',
    `Exercise library (use only these names):\n${allowed.map((e) => `${e.name} [${CATEGORY_NAMES[e.category]}; ${e.primary.join(', ')}]`).join('\n')}`,
  ];
  return lines.filter(Boolean).join('\n');
}

const int = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v as number))) : d);

export function sanitizeWorkout(raw: unknown): WorkoutPlan {
  const r = (raw ?? {}) as Partial<WorkoutPlan>;
  const days = (Array.isArray(r.days) ? r.days : []).slice(0, 7).map((d) => ({
    name: String(d?.name ?? '').slice(0, 60),
    weekday: String(d?.weekday ?? '').slice(0, 12),
    focus: String(d?.focus ?? '').slice(0, 80),
    minutes: int(d?.minutes, 5, 180, 45),
    warmup: String(d?.warmup ?? '').slice(0, 200),
    exercises: (Array.isArray(d?.exercises) ? d.exercises : []).slice(0, 10).map((e) => ({
      name: String(e?.name ?? '').slice(0, 60),
      sets: int(e?.sets, 1, 10, 3),
      reps: String(e?.reps ?? '').slice(0, 20),
      restSeconds: int(e?.restSeconds, 0, 600, 60),
      how: String(e?.how ?? '').slice(0, 160),
    })).filter((e) => e.name),
  })).filter((d) => d.name && d.exercises.length);
  return {
    title: String(r.title ?? 'Your week').slice(0, 80),
    daysPerWeek: days.length,
    days,
    tips: (Array.isArray(r.tips) ? r.tips : []).map((t) => String(t).slice(0, 200)).slice(0, 4),
  };
}

const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);

export function cleanWorkoutRequest(raw: unknown): WorkoutRequest {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
  return {
    daysPerWeek: int(r.daysPerWeek, 1, 7, 3),
    minutes: int(r.minutes, 10, 120, 45),
    place: pick(r.place, ['gym', 'home', 'outdoors'] as const, 'gym'),
    level: pick(r.level, ['beginner', 'intermediate', 'advanced'] as const, 'beginner'),
    focus: typeof r.focus === 'string' ? r.focus.slice(0, 200) : '',
    goal: pick(r.goal, ['muscle', 'strength', 'fat_loss', 'endurance', 'general', 'flexibility'] as const, 'general'),
    equipment: Array.isArray(r.equipment) ? r.equipment.filter((e): e is string => typeof e === 'string' && e in EQUIP_NAMES).slice(0, 20) : undefined,
    weekdays: Array.isArray(r.weekdays) ? r.weekdays.filter((d): d is string => typeof d === 'string' && /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(d)).slice(0, 7) : undefined,
    likes: str(r.likes, 200), dislikes: str(r.dislikes, 200), limits: str(r.limits, 300),
    recent: Array.isArray(r.recent) ? r.recent.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 200)).slice(0, 14) : undefined,
  };
}
