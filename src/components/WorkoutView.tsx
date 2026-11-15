import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Dumbbell, Lightbulb, Loader2, RotateCcw, Timer } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { aiHeaders } from '@/lib/premium';
import { todayKey } from '@/lib/dates';
import { burnedKcal } from '@/lib/exercise';
import type { WorkoutDay, WorkoutPlan, WorkoutRequest } from '@/lib/workout';
import { useCoachContext } from '@/pages/Coach';
import { SignInButtons } from './SignIn';
import { cx } from './ui';
import { haptic, toast } from './fx';

const DAYS_FOR: Record<string, number> = { sedentary: 2, light: 3, active: 4, athlete: 5 };
const PLACES: [WorkoutRequest['place'], string][] = [['gym', 'Gym'], ['home', 'Home'], ['outdoors', 'Outdoors']];
const LEVELS: [WorkoutRequest['level'], string][] = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];

/** AI workout guide for the week (Plus and Pro). */
export function WorkoutView() {
  const context = useCoachContext();
  const profile = useStore((s) => s.profile);
  const saved = useStore((s) => s.workoutPlan);
  const setWorkoutPlan = useStore((s) => s.setWorkoutPlan);
  const [req, setReq] = useState<WorkoutRequest>(() => ({
    daysPerWeek: DAYS_FOR[profile?.activity ?? ''] ?? 3,
    minutes: 45,
    place: profile?.training?.some((t) => /home/i.test(t)) && !profile.training.some((t) => /gym/i.test(t)) ? 'home' : 'gym',
    level: profile?.activity === 'athlete' ? 'advanced' : profile?.activity === 'active' ? 'intermediate' : 'beginner',
    focus: '',
  }));
  const [editing, setEditing] = useState(!saved);
  const [state, setState] = useState<{ busy: boolean; error?: string; premium?: boolean; signIn?: boolean }>({ busy: false });

  async function make() {
    haptic();
    setState({ busy: true });
    try {
      const res = await fetch('/api/workout', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ context, request: req }) });
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
          <input value={req.focus} onChange={(e) => setReq({ ...req, focus: e.target.value })} maxLength={200} placeholder="Anything else? e.g. ‘bad knee’, ‘glutes’, ‘5k run’" className="field mt-4" />

          <button onClick={make} disabled={state.busy} className="btn-primary mt-4 w-full">
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
          {saved.plan.days.map((d, i) => <DayCard key={i} day={d} defaultOpen={i === 0} />)}
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

function DayCard({ day, defaultOpen }: { day: WorkoutDay; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const addExercise = useStore((s) => s.addExercise);
  const kg = useStore((s) => s.profile?.bodyWeightKg ?? 0);
  const [done, setDone] = useState(false);

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
          <p className="truncate text-[16px] font-bold">{day.name}</p>
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
                  <p className="text-[15px] font-semibold">{e.name}</p>
                  <p className="num text-sm text-silver">{e.sets} × {e.reps}{e.restSeconds ? ` · rest ${e.restSeconds >= 60 ? `${Math.round(e.restSeconds / 6) / 10} min` : `${e.restSeconds} s`}` : ''}</p>
                  {e.how && <p className="text-sm text-dim">{e.how}</p>}
                </div>
              </li>
            ))}
          </ol>
          <button onClick={logDone} disabled={done} className="btn-primary mt-5 w-full">
            {done ? <><Check size={18} /> Logged for today</> : 'I did this workout'}
          </button>
        </div>
      )}
    </section>
  );
}
