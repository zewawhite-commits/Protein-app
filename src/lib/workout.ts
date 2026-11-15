/**
 * AI workout guide (shared by api/workout.ts). Claude writes a weekly training plan for
 * the person's goal, experience, kit and time. The guide is general fitness guidance,
 * not medical advice; the app shows that line with it.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { RECOGNITION_MODEL } from './recognition';
import type { CoachContext } from './coach';

export interface WorkoutExercise { name: string; sets: number; reps: string; restSeconds: number; how: string }
export interface WorkoutDay { name: string; focus: string; minutes: number; warmup: string; exercises: WorkoutExercise[] }
export interface WorkoutPlan { title: string; daysPerWeek: number; days: WorkoutDay[]; tips: string[] }
export interface WorkoutRequest { daysPerWeek: number; minutes: number; place: 'gym' | 'home' | 'outdoors'; level: 'beginner' | 'intermediate' | 'advanced'; focus: string }

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
          name: { type: 'string' }, focus: { type: 'string' }, minutes: { type: 'integer' }, warmup: { type: 'string' },
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
        required: ['name', 'focus', 'minutes', 'warmup', 'exercises'],
        additionalProperties: false,
      },
    },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'daysPerWeek', 'days', 'tips'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are a qualified personal trainer writing a weekly workout guide inside Provora, a nutrition and fitness app.

Write a safe, effective plan for this person:
- Match their goals (fat loss, muscle, performance, health), level, days per week, minutes per session, and where they train (gym equipment, home with little or no kit, or outdoors).
- One entry in "days" per training day (exactly the days per week asked), e.g. "Day 1 — Upper body". Balance muscle groups across the week and leave recovery between hard sessions on the same muscles.
- 4–7 exercises per day that fit the time. "reps" can be a range ("8–12"), a time ("30 s") or a distance ("2 km"). "how" = one short cue on form or effort.
- Beginners: simple movements, moderate volume. Use progressive overload advice in tips.
- Pregnant, older or very new people: low-impact options and say to check with a doctor if unsure.
- "warmup": one line. "tips": 2–4 short practical tips (rest, progression, consistency, food around training).
No medical claims. Keep names plain English.`;

export async function workoutWithClient(client: Anthropic, context: CoachContext, req: WorkoutRequest, contextText: (c: CoachContext) => string): Promise<WorkoutPlan> {
  const response = await client.beta.messages.create({
    model: RECOGNITION_MODEL,
    max_tokens: 10000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    system: [
      { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: contextText(context) },
    ],
    messages: [{ role: 'user', content: `Make my weekly workout guide: ${req.daysPerWeek} days a week, about ${req.minutes} minutes each, training ${req.place === 'gym' ? 'at a gym' : req.place === 'home' ? 'at home with little or no equipment' : 'outdoors'}, ${req.level} level.${req.focus ? ` Focus: ${req.focus}.` : ''}` }],
  });
  if (response.stop_reason === 'refusal') throw new Error('No workout guide available for that request.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No workout guide returned.');
  return sanitizeWorkout(JSON.parse(text.text));
}

const int = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v as number))) : d);

export function sanitizeWorkout(raw: unknown): WorkoutPlan {
  const r = (raw ?? {}) as Partial<WorkoutPlan>;
  const days = (Array.isArray(r.days) ? r.days : []).slice(0, 7).map((d) => ({
    name: String(d?.name ?? '').slice(0, 60),
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

export function cleanWorkoutRequest(raw: unknown): WorkoutRequest {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
  return {
    daysPerWeek: int(r.daysPerWeek, 1, 7, 3),
    minutes: int(r.minutes, 10, 120, 45),
    place: pick(r.place, ['gym', 'home', 'outdoors'] as const, 'gym'),
    level: pick(r.level, ['beginner', 'intermediate', 'advanced'] as const, 'beginner'),
    focus: typeof r.focus === 'string' ? r.focus.slice(0, 200) : '',
  };
}
