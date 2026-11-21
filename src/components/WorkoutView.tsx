import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Dumbbell, Lightbulb, Loader2, RotateCcw, Timer } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { aiHeaders } from '@/lib/premium';
import { todayKey } from '@/lib/dates';
import { burnedKcal } from '@/lib/exercise';
import type { Goal, WorkoutDay, WorkoutPlan, WorkoutRequest } from '@/lib/workout';
import { findExercise, CATEGORY_NAMES } from '@/data/exerciseLibrary';
import { useCoachContext } from '@/pages/Coach';
import { SignInButtons } from './SignIn';
import { GuideSheet } from './ExerciseGuide';
import { PlanBadge } from './PlanBadge';
import { cx } from './ui';
import { haptic, toast } from './fx';

const DAYS_FOR: Record<string, number> = { sedentary: 2, light: 3, active: 4, athlete: 5 };
const PLACES: [WorkoutRequest['place'], string][] = [['gym', 'Gym'], ['home', 'Home'], ['outdoors', 'Outdoors']];
const ADJUST: [string, Partial<WorkoutRequest>][] = [
  ['Missed a session', { focus: 'I missed a session this week — rebuild the remaining days so nothing important is lost, without cramming' }],
  ['Travelling, no equipment', { place: 'home', focus: 'travelling this week with no equipment, hotel-room friendly' }],
  ['Only 20 minutes', { minutes: 20, focus: 'very short on time, keep the most effective moves' }],
  ['Lighter week', { focus: 'tired or sore — make this a lighter recovery week with lower volume and intensity' }],
];
const GOALS: [Goal, string][] = [['muscle', 'Build muscle'], ['strength', 'Get stronger'], ['fat_loss', 'Lose fat'], ['endurance', 'Endurance'], ['general', 'General fitness'], ['flexibility', 'Flexibility']];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KIT: [string, string][] = [['dumbbells', 'Dumbbells'], ['barbell', 'Barbell'], ['bench', 'Bench'], ['kettlebell', 'Kettlebell'], ['band', 'Bands'], ['bar', 'Pull-up bar'], ['cable', 'Cable machine'], ['machine', 'Gym machines'], ['bike', 'Bike'], ['rower', 'Rower'], ['rope', 'Skipping rope']];
const LEVELS: [WorkoutRequest['level'], string][] = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];

/** The last two weeks of training, briefly, so the plan avoids tired muscles and repeats. */
function recentTraining(): string[] {
  const st = useStore.getState();
  const since = Date.now() - 14 * 864e5;
  return st.workoutLogs.filter((w) => w.startedAt >= since).sort((a, b) => b.startedAt - a.startedAt).slice(0, 14).map((w) => {
    const muscles = [...new Set(w.exercises.map((e) => findExercise(e.name)).filter(Boolean).map((e) => CATEGORY_NAMES[e!.category].toLowerCase()))];
    const day = new Date(w.startedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${day}: ${w.name} — ${w.exercises.map((e) => e.name).slice(0, 8).join(', ')}${muscles.length ? ` (${muscles.join(', ')})` : ''}${w.feel ? `; felt ${w.feel === 'right' ? 'about right' : `too ${w.feel}`}` : ''}`;
  });
}

/** AI workout guide for the week (Plus). */
export function WorkoutView() {
  const context = useCoachContext();
  const profile = useStore((s) => s.profile);
  const saved = useStore((s) => s.workoutPlan);
  const setWorkoutPlan = useStore((s) => s.setWorkoutPlan);
  // Your choices are remembered for next time (and used by the coach).
  const [req, setReqState] = useState<WorkoutRequest>(() => { try { const r = JSON.parse(localStorage.getItem('nutivili-workout-prefs') ?? 'null'); if (r?.daysPerWeek) return r as WorkoutRequest; } catch { /* none */ } return ({
    daysPerWeek: DAYS_FOR[profile?.activity ?? ''] ?? 3,
    minutes: 45,
    place: profile?.training?.some((t) => /home/i.test(t)) && !profile.training.some((t) => /gym/i.test(t)) ? 'home' : 'gym',
    level: profile?.activity === 'athlete' ? 'advanced' : profile?.activity === 'active' ? 'intermediate' : 'beginner',
    focus: '',
  }); });
  const setReq = (r: WorkoutRequest) => { setReqState(r); try { localStorage.setItem('nutivili-workout-prefs', JSON.stringify(r)); } catch { /* ignore */ } };
  const [editing, setEditing] = useState(!saved);
  const [state, setState] = useState<{ busy: boolean; error?: string; premium?: boolean; signIn?: boolean }>({ busy: false });

  async function make(r: WorkoutRequest = req) {
    haptic();
    setState({ busy: true });
    try {
      const res = await fetch('/api/workout', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ context, request: { ...r, recent: recentTraining() } }) });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!isJson || res.status === 404 || res.status === 501) throw new Error('Workout guides aren’t switched on yet. They work once the AI key is added on the server.');
      const data = (await res.json()) as WorkoutPlan & { error?: string };
      if (res.status === 401) return setState({ busy: false, error: data.error, signIn: true });
      if (res.status === 402) return setState({ busy: false, error: data.error, premium: true });
      if (!res.ok) throw new Error(data.error || 'Could not make a workout guide.');
      setWorkoutPlan(data);
      setEditing(false);
      setState({ busy: false });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <PlanBadge needs="plus" what="Your AI workout guide" />
      {editing ? (
        <section className="card p-5">
          <p className="flex items-center gap-2 text-[17px] font-bold"><Dumbbell size={18} className="text-accent" /> Your workout guide</p>
          <p className="mt-1 text-sm text-silver">A week of training built around your goals{profile?.training?.length ? ` and ${profile.training.slice(0, 2).join(' & ').toLowerCase()}` : ''}.</p>

          <p className="label mt-5">Days a week</p>
          <div className="flex gap-2">
            {[2, 3, 4, 5, 6].map((d) => <button key={d} onClick={() => setReq({ ...req, daysPerWeek: d })} className={cx('chip !h-11 flex-1 justify-center', req.daysPerWeek === d && 'chip-on')}>{d}</button>)}
          </div>
          <p className="label mt-4">Minutes per session</p>
          <div className="flex gap-2">
            {[20, 30, 45, 60].map((m) => <button key={m} onClick={() => setReq({ ...req, minutes: m })} className={cx('chip !h-11 flex-1 justify-center', req.minutes === m && 'chip-on')}>{m}</button>)}
          </div>
          <p className="label mt-4">Where</p>
          <div className="flex gap-2">
            {PLACES.map(([v, l]) => <button key={v} onClick={() => setReq({ ...req, place: v })} className={cx('chip !h-11 flex-1 justify-center', req.place === v && 'chip-on')}>{l}</button>)}
          </div>
          <p className="label mt-4">Level</p>
          <div className="flex gap-2">
            {LEVELS.map(([v, l]) => <button key={v} onClick={() => setReq({ ...req, level: v })} className={cx('chip !h-11 flex-1 justify-center !px-2 text-[14px]', req.level === v && 'chip-on')}>{l}</button>)}
          </div>
          <p className="label mt-4">Main goal <span className="font-normal text-dim">(optional)</span></p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(([v, l]) => <button key={v} onClick={() => setReq({ ...req, goal: req.goal === v ? undefined : v })} className={cx('chip !h-10', req.goal === v && 'chip-on')}>{l}</button>)}
          </div>
          <p className="label mt-4">Days you can train <span className="font-normal text-dim">(optional)</span></p>
          <div className="flex gap-1.5">
            {WEEKDAYS.map((d) => { const on = req.weekdays?.includes(d); return <button key={d} onClick={() => { const w = on ? (req.weekdays ?? []).filter((x) => x !== d) : [...(req.weekdays ?? []), d].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)); setReq({ ...req, weekdays: w, ...(w.length >= 2 ? { daysPerWeek: w.length } : {}) }); }} className={cx('chip !h-10 flex-1 justify-center !px-0 text-[13px]', on && 'chip-on')}>{d}</button>; })}
          </div>
          <p className="label mt-4">Equipment you have <span className="font-normal text-dim">(optional)</span></p>
          <div className="flex flex-wrap gap-2">
            {KIT.map(([v, l]) => { const on = req.equipment?.includes(v); return <button key={v} onClick={() => setReq({ ...req, equipment: on ? (req.equipment ?? []).filter((x) => x !== v) : [...(req.equipment ?? []), v] })} className={cx('chip !h-10', on && 'chip-on')}>{l}</button>; })}
          </div>
          <input value={req.likes ?? ''} onChange={(e) => setReq({ ...req, likes: e.target.value })} maxLength={200} placeholder="Exercises you enjoy (optional)" className="field mt-4" aria-label="Exercises you enjoy" />
          <input value={req.dislikes ?? ''} onChange={(e) => setReq({ ...req, dislikes: e.target.value })} maxLength={200} placeholder="Exercises to leave out (optional)" className="field mt-2" aria-label="Exercises to leave out" />
          <input value={req.limits ?? ''} onChange={(e) => setReq({ ...req, limits: e.target.value })} maxLength={300} placeholder="Injuries or limits, e.g. ‘bad knee, no jumping’ (optional)" className="field mt-2" aria-label="Injuries or limits" />
          <input value={req.focus} onChange={(e) => setReq({ ...req, focus: e.target.value })} maxLength={200} placeholder="Anything else? (optional)" className="field mt-2" aria-label="Anything else" />

          <button onClick={() => void make()} disabled={state.busy} className="btn-primary mt-4 w-full">
            {state.busy ? <><Loader2 size={18} className="animate-spin" /> Building your week…</> : 'Build my workout guide'}
          </button>
          {saved && !state.busy && <button onClick={() => setEditing(false)} className="mt-2 w-full text-sm font-semibold text-silver">Keep my current guide</button>}
          {state.error && (
            <p className="mt-3 rounded-2xl bg-raised px-3 py-2 text-sm text-silver">
              {state.error} {state.premium && <Link to="/premium" className="font-semibold text-accent">Get Plus</Link>}
            </p>
          )}
          {state.signIn && <div className="mt-3"><SignInButtons /></div>}
        </section>
      ) : saved && (
        <>
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[19px] font-bold leading-snug">{saved.plan.title}</p>
                <p className="mt-0.5 text-sm text-silver">{saved.plan.daysPerWeek} days a week</p>
              </div>
              <button onClick={() => setEditing(true)} className="chip !h-9 shrink-0"><RotateCcw size={15} /> New guide</button>
            </div>
          </section>
          <section className="card p-4">
            <p className="text-[14px] font-semibold">Life changed? Adjust this week</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ADJUST.map(([label, patch]) => (
                <button key={label} disabled={state.busy} onClick={() => { const next = { ...req, ...patch }; setReq(next); void make(next); }} className="chip !h-9 text-[14px]">{label}</button>
              ))}
            </div>
            {state.busy && <p className="mt-2 flex items-center gap-2 text-sm text-silver"><Loader2 size={15} className="animate-spin" /> Rebuilding your week…</p>}
            {state.error && <p className="mt-2 text-sm text-silver">{state.error} {state.premium && <Link to="/premium" className="font-semibold text-accent">Get Plus</Link>}</p>}
          </section>
          {saved.plan.days.map((d, i) => <DayCard key={i} day={d} index={i} defaultOpen={i === 0} />)}
          {saved.plan.tips.length > 0 && (
            <div className="card p-5">
              <p className="flex items-center gap-2 font-semibold"><Lightbulb size={16} className="text-accent" /> Tips</p>
              <ul className="mt-2 space-y-1.5 text-sm text-silver">{saved.plan.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
            </div>
          )}
          <p className="px-1 text-xs text-dim">General fitness guidance, not medical advice. Stop if anything hurts and check with a doctor if you have a health condition or are pregnant.</p>
        </>
      )}
    </div>
  );
}

function DayCard({ day, defaultOpen, index }: { day: WorkoutDay; defaultOpen: boolean; index: number }) {
  const [open, setOpen] = useState(defaultOpen);
  const addExercise = useStore((s) => s.addExercise);
  const kg = useStore((s) => s.profile?.bodyWeightKg ?? 0);
  const [done, setDone] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);

  function logDone() {
    haptic();
    const type = /run|cardio|hiit|interval/i.test(day.focus + day.name) ? 'hiit' : /yoga|mobility|stretch/i.test(day.focus) ? 'yoga' : 'weights';
    addExercise({ date: todayKey(), type, intensity: 'medium', minutes: day.minutes, kcal: burnedKcal(type, 'medium', day.minutes, kg) });
    setDone(true);
    toast('Workout logged');
  }

  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-5 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Dumbbell size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold">{day.weekday ? `${day.weekday} · ` : ''}{day.name}</p>
          <p className="flex items-center gap-1.5 text-sm text-silver"><Timer size={14} /> {day.minutes} min · {day.exercises.length} exercises</p>
        </div>
        <ChevronDown size={18} className={cx('shrink-0 text-dim transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          {day.warmup && <p className="rounded-2xl bg-raised px-4 py-3 text-sm"><b>Warm-up:</b> {day.warmup}</p>}
          <ol className="mt-3 space-y-3">
            {day.exercises.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised text-xs font-bold">{i + 1}</span>
                <div className="min-w-0">
                  <button onClick={() => setGuide(e.name)} className="text-left text-[15px] font-semibold">{e.name}{findExercise(e.name) && <span className="ml-1.5 text-xs font-semibold text-accent">How to</span>}</button>
                  <p className="num text-sm text-silver">{e.sets} × {e.reps}{e.restSeconds ? ` · rest ${e.restSeconds >= 60 ? `${Math.round(e.restSeconds / 6) / 10} min` : `${e.restSeconds} s`}` : ''}</p>
                  {e.how && <p className="text-sm text-dim">{e.how}</p>}
                </div>
              </li>
            ))}
          </ol>
          <GuideSheet name={guide} onClose={() => setGuide(null)} />
          <Link to={`/workout?guideDay=${index}`} className="btn-primary mt-5 w-full">Start it live — change anything as you go</Link>
          <button onClick={logDone} disabled={done} className="btn-ghost mt-2 w-full">
            {done ? <><Check size={18} /> Logged for today</> : 'Already did it? Log it'}
          </button>
        </div>
      )}
    </section>
  );
}
