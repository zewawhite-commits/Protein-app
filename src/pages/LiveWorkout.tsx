import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, Dumbbell, History, Pause, Play, Plus, RefreshCw, Search, SkipForward, Timer, Trash2, Trophy } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { CATEGORY_NAMES, LIBRARY, findExercise } from '@/data/exerciseLibrary';
import { GuideBrowser, GuideSheet } from '@/components/ExerciseGuide';
import { CATEGORY_LABEL, clock, elapsed, est1rm, type ActiveWorkout, type ExerciseKind, type LiveExercise, type WorkoutLog } from '@/lib/liveWorkout';
import { fromKey } from '@/lib/dates';
import { Segmented, Sheet, cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';
import { seconds as timedSeconds } from '@/lib/exerciseDb';

const RESTS = [30, 45, 60, 90, 120];
const key = () => crypto.randomUUID().slice(0, 8);

/** Every exercise people can pick: built-in guides, the routine library and their own. */
function useCatalogue() {
  const custom = useStore((s) => s.customExercises);
  return useMemo(() => {
    const m = new Map<string, { name: string; muscle: string; kind: ExerciseKind; custom?: boolean; equipment?: string }>();
    for (const e of LIBRARY) m.set(e.name.toLowerCase(), { name: e.name, muscle: CATEGORY_NAMES[e.category], kind: e.kind });
    for (const c of custom) m.set(c.name.toLowerCase(), { name: c.name, muscle: c.muscle, kind: c.category, custom: true, equipment: c.equipment });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [custom]);
}

export function newExercise(name: string, muscle = '', kind: ExerciseKind = 'strength', sets = 3, reps?: number, weightKg?: number): LiveExercise {
  return { key: key(), name, muscle, kind, sets: kind === 'cardio' ? [] : Array.from({ length: sets }, () => ({ done: false, ...(reps ? { reps } : {}), ...(weightKg ? { weightKg } : {}) })) };
}

/**
 * A gentle next-step suggestion from last time (simple double progression): if every set reached
 * the top of the rep range, try a little more weight; if sets fell short, stay at that weight.
 */
function progression(e: LiveExercise, prev: LiveExercise | null): string | null {
  if (e.kind !== 'strength' || !prev) return null;
  const done = prev.sets.filter((s) => s.done && s.reps);
  if (!done.length) return null;
  const kg = Math.max(...done.map((s) => s.weightKg ?? 0));
  const lib = findExercise(e.name);
  const top = Number(lib?.rx.reps.match(/(\d+)\D*$/)?.[1] ?? lib?.rx.reps.match(/(\d+)/)?.[1] ?? 12);
  const allTop = done.length >= Math.min(prev.sets.length, 3) && done.every((s) => (s.reps ?? 0) >= top);
  const fell = done.some((s) => (s.reps ?? 0) < Math.max(1, top - 4));
  if (kg > 0 && allTop) return `Last time you did all sets at ${kg} kg × ${top}+. If it felt comfortable, try ${Math.round((kg + (kg >= 40 ? 2.5 : 1)) * 2) / 2} kg today.`;
  if (kg === 0 && allTop) return `Last time you hit ${top}+ reps on every set — try a harder version or slower reps.`;
  if (fell) return `Last time some sets fell short${kg ? ` at ${kg} kg` : ''} — stay there today and aim for clean reps.`;
  return kg ? `Last time: ${kg} kg. Aim to match or beat your reps.` : null;
}

/** Live workout: start, track, finish — plus history and personal records. */
export default function LiveWorkout() {
  const active = useStore((s) => s.activeWorkout);
  return active ? <Active w={active} /> : <Start />;
}

function Start() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const setActive = useStore((s) => s.setActiveWorkout);
  const routines = useStore((s) => s.routines);
  const guide = useStore((s) => s.workoutPlan);
  const logs = useStore((s) => s.workoutLogs);
  const [browse, setBrowse] = useState(false);
  const start = (name: string, exercises: LiveExercise[]) => { haptic(); setActive({ name, startedAt: Date.now(), pausedMs: 0, rest: 90, exercises }); };
  // Started from somewhere else (a routine or the AI guide): ?routine=<id> or ?guideDay=<n>.
  useEffect(() => {
    const r = routines.find((x) => x.id === params.get('routine'));
    if (r) start(r.name, r.exercises.map((e) => newExercise(e.name, e.muscle ?? '', 'strength', e.sets || 3, parseInt(e.reps, 10) || undefined, e.weightKg)));
    const d = params.get('guideDay') != null ? guide?.plan.days[Number(params.get('guideDay'))] : undefined;
    if (d) start(d.name, d.exercises.map((e) => newExercise(e.name, '', findExercise(e.name)?.kind ?? 'strength', e.sets || 3, parseInt(String(e.reps), 10) || undefined)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const week = logs.filter((l) => Date.now() - l.startedAt < 7 * 864e5);
  const prs = usePRs();
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-[26px] font-extrabold tracking-tight">Workout</h1>
        <Link to="/train" className="chip !h-10"><BookOpen size={15} /> Workouts & exercises</Link>
      </header>

      <button onClick={() => start('Workout', [])} className="btn-primary w-full !h-14 text-[17px]"><Play size={20} /> Start an empty workout</button>
      <p className="mt-2 text-center text-sm text-silver">Add exercises as you go — anything you do, gym, home or outdoors.</p>

      {routines.length > 0 && (
        <section className="mt-6">
          <p className="mb-2 px-1 font-semibold">From my routines</p>
          <div className="card divide-y divide-line p-1">
            {routines.map((r) => (
              <button key={r.id} onClick={() => start(r.name, r.exercises.map((e) => newExercise(e.name, e.muscle ?? '', 'strength', e.sets || 3, parseInt(e.reps, 10) || undefined, e.weightKg)))} className="flex w-full items-center gap-3 p-3 text-left">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent"><Dumbbell size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{r.name}</span><span className="text-sm text-silver">{r.exercises.length} exercises</span></span>
                <Play size={18} className="text-accent" />
              </button>
            ))}
          </div>
        </section>
      )}
      {guide && (
        <section className="mt-6">
          <p className="mb-2 px-1 font-semibold">From your AI guide</p>
          <div className="card divide-y divide-line p-1">
            {guide.plan.days.map((d, i) => (
              <button key={i} onClick={() => start(d.name, d.exercises.map((e) => newExercise(e.name, '', findExercise(e.name)?.kind ?? 'strength', e.sets || 3, parseInt(String(e.reps), 10) || undefined)))} className="flex w-full items-center gap-3 p-3 text-left">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent"><Timer size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{d.name}</span><span className="text-sm text-silver">{d.minutes} min · {d.exercises.length} exercises — change anything as you go</span></span>
                <Play size={18} className="text-accent" />
              </button>
            ))}
          </div>
        </section>
      )}
      <Link to="/routines" className="mt-3 block text-center text-sm font-semibold text-accent">Build a routine to reuse →</Link>

      <section className="mt-7">
        <p className="mb-2 flex items-center gap-2 px-1 font-semibold"><History size={17} /> History</p>
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="card py-3"><p className="num text-xl font-extrabold">{logs.length}</p><p className="text-xs text-silver">workouts</p></div>
          <div className="card py-3"><p className="num text-xl font-extrabold">{week.length}</p><p className="text-xs text-silver">this week</p></div>
          <div className="card py-3"><p className="num text-xl font-extrabold">{fmt(logs.reduce((a, l) => a + l.minutes, 0) / 60, 1)}</p><p className="text-xs text-silver">hours trained</p></div>
        </div>
        {prs.length > 0 && (
          <div className="card mb-3 p-4">
            <p className="flex items-center gap-2 font-semibold"><Trophy size={16} className="text-accent" /> Personal records</p>
            <ul className="mt-2 space-y-1 text-sm">{prs.slice(0, 8).map((p) => <li key={p.name} className="flex justify-between gap-2"><span>{p.name}</span><span className="num text-silver">{fmt(p.kg, 1)} kg × {p.reps} <span className="text-dim">(~{fmt(p.e1rm)} kg 1RM est.)</span></span></li>)}</ul>
          </div>
        )}
        {logs.length === 0 ? <p className="card p-5 text-sm text-silver">Finished workouts show here, with every set, so you can see your progress.</p> : (
          <div className="space-y-2">{[...logs].reverse().slice(0, 30).map((l) => <LogCard key={l.id} log={l} />)}</div>
        )}
      </section>
      <GuideBrowser open={browse} onClose={() => setBrowse(false)} />
    </div>
  );
}

function usePRs() {
  const logs = useStore((s) => s.workoutLogs);
  return useMemo(() => {
    const best = new Map<string, { name: string; kg: number; reps: number; e1rm: number }>();
    for (const l of logs) for (const e of l.exercises) for (const s of e.sets) {
      if (!s.done || !s.weightKg || !s.reps) continue;
      const v = est1rm(s.weightKg, s.reps);
      const cur = best.get(e.name.toLowerCase());
      if (!cur || v > cur.e1rm) best.set(e.name.toLowerCase(), { name: e.name, kg: s.weightKg, reps: s.reps, e1rm: v });
    }
    return [...best.values()].sort((a, b) => b.e1rm - a.e1rm);
  }, [logs]);
}

function LogCard({ log }: { log: WorkoutLog }) {
  const [open, setOpen] = useState(false);
  const remove = useStore((s) => s.removeWorkoutLog);
  const sets = log.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const volume = log.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.done ? (s.weightKg ?? 0) * (s.reps ?? 0) : 0), 0), 0);
  return (
    <div className="card p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-2 text-left">
        <span><span className="block font-semibold">{log.name}</span><span className="num text-sm text-silver">{fromKey(log.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {log.minutes} min · {log.exercises.length} exercises · {sets} sets{volume ? ` · ${fmt(volume)} kg lifted` : ''}</span></span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 text-sm">
          {log.exercises.map((e) => (
            <p key={e.key}><b>{e.name}</b> <span className="num text-silver">{e.kind === 'cardio' ? `${e.minutes ?? '–'} min${e.km ? ` · ${e.km} km` : ''}` : e.sets.filter((s) => s.done).map((s) => (s.seconds ? `${s.seconds}s` : `${s.weightKg ? `${s.weightKg}kg×` : ''}${s.reps ?? ''}`)).join(', ')}</span></p>
          ))}
          {log.note && <p className="text-silver">“{log.note}”</p>}
          <button onClick={() => { if (confirm('Delete this workout from history?')) remove(log.id); }} className="mt-1 text-xs font-semibold text-danger">Delete</button>
        </div>
      )}
    </div>
  );
}

function Active({ w }: { w: ActiveWorkout }) {
  const nav = useNavigate();
  const set = useStore((s) => s.setActiveWorkout);
  const finish = useStore((s) => s.finishWorkout);
  const logs = useStore((s) => s.workoutLogs);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const [adding, setAdding] = useState<{ replace?: string } | null>(null);
  const [guideFor, setGuideFor] = useState<{ name: string; key: string } | null>(null);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  // List of all exercises, or one at a time — the person chooses; remembered for next time.
  const [view, setViewState] = useState<'list' | 'focus'>(() => { try { return localStorage.getItem('nutivili-workout-view') === 'focus' ? 'focus' : 'list'; } catch { return 'list'; } });
  const setView = (v: 'list' | 'focus') => { setViewState(v); try { localStorage.setItem('nutivili-workout-view', v); } catch { /* storage blocked */ } };
  const [focusIdx, setFocusIdx] = useState(0);
  const [hurt, setHurt] = useState<{ name: string; key: string } | null>(null);
  const update = (k: string, f: (e: LiveExercise) => LiveExercise) => set((cur) => ({ ...cur, exercises: cur.exercises.map((e) => (e.key === k ? f(e) : e)) }));
  const move = (i: number, d: number) => set((cur) => { const ex = [...cur.exercises]; const j = i + d; if (j < 0 || j >= ex.length) return cur; [ex[i], ex[j]] = [ex[j], ex[i]]; return { ...cur, exercises: ex }; });
  const previous = (name: string) => { for (let i = logs.length - 1; i >= 0; i--) { const e = logs[i].exercises.find((x) => x.name.toLowerCase() === name.toLowerCase()); if (e) return e; } return null; };
  const paused = !!w.pausedAt;
  const doneSets = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);

  function tickSet(e: LiveExercise, i: number) {
    const was = e.sets[i].done;
    update(e.key, (x) => ({ ...x, sets: x.sets.map((s, j) => (j === i ? { ...s, done: !s.done } : s)) }));
    if (!was) { haptic(); setRest({ until: Date.now() + w.rest * 1000, total: w.rest }); }
  }
  function end() {
    if (!doneSets && !w.exercises.some((e) => e.minutes || e.km)) { if (confirm('Nothing recorded yet. Discard this workout?')) set(null); return; }
    const log = finish();
    if (log) { toast(`Workout saved · ${log.minutes} min`, { tone: 'celebrate' }); nav('/workout'); }
  }

  // One exercise's card (used in both views).
  function card(e: LiveExercise, i: number) {
    const prev = previous(e.name);
    const lib = findExercise(e.name);
    const hint = progression(e, prev);
    return (
            <section key={e.key} className={cx('card p-4', e.skipped && 'opacity-50')}>
              <div className="flex items-start gap-2">
                <button onClick={() => setGuideFor({ name: e.name, key: e.key })} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[16px] font-bold text-accent">{e.name}</p>
                  <p className="text-xs text-silver">{[e.muscle, CATEGORY_LABEL[e.kind]].filter(Boolean).join(' · ')} · tap for how-to</p>
                </button>
                <ExerciseTimer k={e.key} seconds={e.kind === 'time' ? (e.sets.find((x) => !x.done)?.seconds ?? e.sets[0]?.seconds ?? (lib ? timedSeconds({ kind: lib.kind, level: lib.level, guide: lib }) : null) ?? 30) : null} />
                <button onClick={() => move(i, -1)} disabled={i === 0} className="grid h-8 w-8 place-items-center rounded-full bg-raised disabled:opacity-30" aria-label={`Move ${e.name} up`}><ArrowUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === w.exercises.length - 1} className="grid h-8 w-8 place-items-center rounded-full bg-raised disabled:opacity-30" aria-label={`Move ${e.name} down`}><ArrowDown size={14} /></button>
              </div>
              {lib && (
                <p className="mt-2 text-[13px] text-silver">Suggested: {lib.rx.sets > 1 ? `${lib.rx.sets} × ` : ''}{lib.rx.reps}{lib.rx.rest ? ` · rest ${lib.rx.rest >= 60 ? `${lib.rx.rest / 60} min` : `${lib.rx.rest} s`}` : ''}</p>
              )}
              {hint && <p className="mt-1.5 rounded-xl bg-accent/10 px-3 py-2 text-[13px] font-medium text-accent">{hint}</p>}
              {view === 'focus' && lib && (
                <details className="mt-2 rounded-2xl bg-raised px-3 py-2 text-[14px]" open>
                  <summary className="cursor-pointer font-semibold">How to do it</summary>
                  <p className="mt-1.5 text-silver">{lib.start}</p>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-5">{lib.steps.map((x) => <li key={x}>{x}</li>)}</ol>
                  <p className="mt-1.5 text-[13px] text-silver"><span className="font-semibold text-ink">Breathing:</span> {lib.breathing}</p>
                  <button onClick={() => setGuideFor({ name: e.name, key: e.key })} className="mt-1.5 text-[13px] font-semibold text-accent">Full guide, mistakes & alternatives →</button>
                </details>
              )}
              {e.kind === 'cardio' ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="rounded-2xl bg-raised px-3 py-2"><span className="block text-xs font-semibold text-silver">Minutes</span><input inputMode="decimal" aria-label={`${e.name} minutes`} value={e.minutes ?? ''} onChange={(x) => update(e.key, (y) => ({ ...y, minutes: Number(x.target.value) || undefined }))} className="num w-full bg-transparent text-lg font-bold outline-none" /></label>
                  <label className="rounded-2xl bg-raised px-3 py-2"><span className="block text-xs font-semibold text-silver">Distance (km)</span><input inputMode="decimal" aria-label={`${e.name} distance`} value={e.km ?? ''} onChange={(x) => update(e.key, (y) => ({ ...y, km: Number(x.target.value.replace(',', '.')) || undefined }))} className="num w-full bg-transparent text-lg font-bold outline-none" /></label>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="grid grid-cols-[1.5rem_1fr_4.2rem_4.2rem_2.5rem] gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-dim">
                    <span>Set</span><span>Previous</span><span>{e.kind === 'time' ? 'Kg' : 'Kg'}</span><span>{e.kind === 'time' ? 'Secs' : 'Reps'}</span><span />
                  </div>
                  {e.sets.map((s, j) => {
                    const p = prev?.sets[j];
                    return (
                      <div key={j} className={cx('mt-1.5 grid grid-cols-[1.5rem_1fr_4.2rem_4.2rem_2.5rem] items-center gap-2 rounded-xl px-1 py-1', s.done && 'bg-accent/10')}>
                        <span className="num text-sm font-bold">{j + 1}</span>
                        <span className="num truncate text-xs text-silver">{p ? (p.seconds ? `${p.seconds}s` : `${p.weightKg ? `${p.weightKg}×` : ''}${p.reps ?? '–'}`) : '—'}</span>
                        <input inputMode="decimal" aria-label={`Set ${j + 1} kg`} value={s.weightKg ?? ''} placeholder={p?.weightKg ? String(p.weightKg) : '–'} onChange={(x) => update(e.key, (y) => ({ ...y, sets: y.sets.map((z, k) => (k === j ? { ...z, weightKg: Number(x.target.value.replace(',', '.')) || undefined } : z)) }))} className="field !h-9 !px-2 text-center" />
                        {e.kind === 'time'
                          ? <input inputMode="numeric" aria-label={`Set ${j + 1} seconds`} value={s.seconds ?? ''} placeholder={p?.seconds ? String(p.seconds) : '–'} onChange={(x) => update(e.key, (y) => ({ ...y, sets: y.sets.map((z, k) => (k === j ? { ...z, seconds: Number(x.target.value) || undefined } : z)) }))} className="field !h-9 !px-2 text-center" />
                          : <input inputMode="numeric" aria-label={`Set ${j + 1} reps`} value={s.reps ?? ''} placeholder={p?.reps ? String(p.reps) : '–'} onChange={(x) => update(e.key, (y) => ({ ...y, sets: y.sets.map((z, k) => (k === j ? { ...z, reps: Number(x.target.value) || undefined } : z)) }))} className="field !h-9 !px-2 text-center" />}
                        <button onClick={() => tickSet(e, j)} className={cx('grid h-9 w-9 place-items-center rounded-xl', s.done ? 'bg-accent text-white' : 'bg-raised text-dim')} aria-label={`Set ${j + 1} done`} aria-pressed={s.done}><Check size={17} strokeWidth={3} /></button>
                      </div>
                    );
                  })}
                  <button onClick={() => update(e.key, (y) => ({ ...y, sets: [...y.sets, { done: false, ...(y.sets.at(-1)?.weightKg ? { weightKg: y.sets.at(-1)!.weightKg } : {}), ...(y.sets.at(-1)?.reps ? { reps: y.sets.at(-1)!.reps } : {}) }] }))} className="mt-2 w-full rounded-xl bg-raised py-2 text-sm font-semibold">+ Add set</button>
                </div>
              )}
              <input value={e.note ?? ''} onChange={(x) => update(e.key, (y) => ({ ...y, note: x.target.value.slice(0, 200) }))} placeholder="Note (optional)" aria-label={`${e.name} note`} className="mt-2 w-full bg-transparent text-sm text-silver outline-none" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => setAdding({ replace: e.key })} className="chip !h-8 !px-3 text-[13px]"><RefreshCw size={13} /> Replace</button>
                <button onClick={() => update(e.key, (y) => ({ ...y, skipped: !y.skipped }))} className="chip !h-8 !px-3 text-[13px]"><SkipForward size={13} /> {e.skipped ? 'Unskip' : 'Skip'}</button>
                <button onClick={() => set((c) => ({ ...c, exercises: c.exercises.filter((x) => x.key !== e.key) }))} className="chip !h-8 !px-3 text-[13px]"><Trash2 size={13} /> Remove</button>
                <button onClick={() => setHurt({ name: e.name, key: e.key })} className="chip !h-8 !px-3 text-[13px] !text-danger">This hurts</button>
              </div>
            </section>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 pb-40">
      <header className="pt-safe sticky top-0 z-10 -mx-5 bg-bg/95 px-5 pb-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <input value={w.name} onChange={(e) => set((c) => ({ ...c, name: e.target.value.slice(0, 50) }))} aria-label="Workout name" className="min-w-0 flex-1 bg-transparent text-[22px] font-extrabold outline-none" />
          <button onClick={end} className="btn-primary !h-10 !px-4 text-sm">Finish</button>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className={cx('num text-[28px] font-extrabold tabular-nums', paused && 'text-silver')} aria-label="Workout time">{clock(elapsed(w))}</span>
          <button onClick={() => set((c) => (c.pausedAt ? { ...c, pausedMs: c.pausedMs + (Date.now() - c.pausedAt), pausedAt: undefined } : { ...c, pausedAt: Date.now() }))} className="chip !h-9">{paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}</button>
          <span className="num ml-auto text-sm text-silver">{doneSets} set{doneSets === 1 ? '' : 's'} done</span>
        </div>
        {w.exercises.length > 1 && (
          <div className="mt-2"><Segmented<'list' | 'focus'> full value={view} onChange={(v) => { haptic(); setView(v); }} options={[{ value: 'list', label: 'All exercises' }, { value: 'focus', label: 'One at a time' }]} /></div>
        )}
      </header>

      {w.exercises.length === 0 && <p className="card mt-2 p-5 text-sm text-silver">Add your first exercise — pick one or create your own.</p>}
      <div className="mt-2 space-y-3">
        {(view === 'list' ? w.exercises : w.exercises.slice(Math.max(0, Math.min(focusIdx, w.exercises.length - 1)), Math.max(0, Math.min(focusIdx, w.exercises.length - 1)) + 1)).map((e) => card(e, w.exercises.indexOf(e)))}
      </div>
      {view === 'focus' && w.exercises.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <button disabled={focusIdx === 0} onClick={() => setFocusIdx((x) => Math.max(0, x - 1))} className="btn-ghost flex-1 disabled:opacity-40">Previous</button>
          <span className="num text-sm text-silver">{Math.min(focusIdx, w.exercises.length - 1) + 1} / {w.exercises.length}</span>
          <button disabled={focusIdx >= w.exercises.length - 1} onClick={() => { haptic(); setFocusIdx((x) => Math.min(w.exercises.length - 1, x + 1)); }} className="btn-primary flex-1 disabled:opacity-40">Next exercise</button>
        </div>
      )}
      <button onClick={() => setAdding({})} className="btn-ghost mt-4 w-full"><Plus size={18} /> Add exercise</button>
      <div className="mt-4"><p className="mb-1.5 px-1 text-sm font-semibold">How did it feel? <span className="font-normal text-silver">(optional — helps your next plan)</span></p>
        <Segmented<string> full value={w.feel ?? ''} onChange={(v) => set((c) => ({ ...c, feel: (v || undefined) as ActiveWorkout['feel'] }))} options={[{ value: 'easy', label: 'Too easy' }, { value: 'right', label: 'About right' }, { value: 'hard', label: 'Too hard' }]} />
      </div>
      <textarea value={w.note ?? ''} onChange={(e) => set((c) => ({ ...c, note: e.target.value.slice(0, 500) }))} rows={2} placeholder="How did it feel? (optional)" className="field mt-3 !h-auto py-3" aria-label="Workout note" />
      <button onClick={() => { if (confirm('Discard this workout? Nothing will be saved.')) set(null); }} className="mt-3 w-full text-sm font-semibold text-danger">Discard workout</button>

      <RestBar rest={rest} restLength={w.rest} onLength={(v) => set((c) => ({ ...c, rest: v }))} onAdjust={(d) => setRest((r) => (r ? { until: r.until + d * 1000, total: r.total + d } : r))} onSkip={() => setRest(null)} />
      <AddExercise open={!!adding} onClose={() => setAdding(null)} onPick={(x) => {
        const ex = newExercise(x.name, x.muscle, x.kind);
        set((c) => ({ ...c, exercises: adding?.replace ? c.exercises.map((e) => (e.key === adding.replace ? ex : e)) : [...c.exercises, ex] }));
        setAdding(null);
      }} />
      <Sheet open={!!hurt} onClose={() => setHurt(null)} title="Stop this exercise">
        <div className="space-y-3 pb-2 text-[15px]">
          <p>Pain is a signal to stop — don’t push through it. We can’t tell what’s causing it, so if it’s sharp, doesn’t ease with rest, or you notice swelling, numbness or dizziness, get it checked by a doctor or physiotherapist before training it again.</p>
          <button onClick={() => { if (hurt) { update(hurt.key, (y) => ({ ...y, skipped: true, note: [y.note, 'Stopped: hurt'].filter(Boolean).join(' · ') })); setGuideFor(hurt); } setHurt(null); }} className="btn-primary w-full">Skip it and see gentler alternatives</button>
          <button onClick={() => { if (hurt) update(hurt.key, (y) => ({ ...y, skipped: true, note: [y.note, 'Stopped: hurt'].filter(Boolean).join(' · ') })); setHurt(null); }} className="btn-ghost w-full">Just skip it</button>
        </div>
      </Sheet>
      <GuideSheet name={guideFor?.name ?? null} onClose={() => setGuideFor(null)} onUse={guideFor ? (alt) => { const k = guideFor.key; set((c) => ({ ...c, exercises: c.exercises.map((x) => (x.key === k ? { ...newExercise(alt.name, CATEGORY_NAMES[alt.category], alt.kind, x.sets.length || alt.rx.sets), key: x.key } : x)) })); setGuideFor(null); toast(`Swapped for ${alt.name}`); } : undefined} />
    </div>
  );
}

/** Rest timer: counts down after each set; beeps and vibrates at the end. */
function RestBar({ rest, restLength, onLength, onAdjust, onSkip }: { rest: { until: number; total: number } | null; restLength: number; onLength: (v: number) => void; onAdjust: (d: number) => void; onSkip: () => void }) {
  const [, tick] = useState(0);
  const rang = useRef(false);
  useEffect(() => { rang.current = false; }, [rest?.until]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(t); }, []);
  const left = rest ? Math.max(0, Math.ceil((rest.until - Date.now()) / 1000)) : 0;
  useEffect(() => {
    if (!rest || left > 0 || rang.current) return;
    rang.current = true;
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* none */ }
    try { const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.2, ctx.currentTime); o.start(); o.stop(ctx.currentTime + 0.4); } catch { /* no sound */ }
    toast('Rest over — next set');
    onSkip();
  }, [left, rest, onSkip]);
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg px-5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
      <div className="card p-3">
        {rest ? (
          <div className="flex items-center gap-2">
            <span className="num w-16 text-[24px] font-extrabold tabular-nums" aria-label="Rest left">{clock(left)}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (left / rest.total) * 100)}%` }} /></div>
            <button onClick={() => onAdjust(-15)} className="chip !h-9 !px-2.5 text-xs">−15</button>
            <button onClick={() => onAdjust(15)} className="chip !h-9 !px-2.5 text-xs">+15</button>
            <button onClick={onSkip} className="chip !h-9 !px-3 text-xs" aria-label="Skip rest">Skip</button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold"><Timer size={15} /> Rest</span>
            <Segmented<string> value={String(restLength)} onChange={(v) => onLength(Number(v))} options={RESTS.map((r) => ({ value: String(r), label: r < 60 ? `${r}s` : `${r / 60}m` }))} />
          </div>
        )}
      </div>
    </div>
  );
}

function AddExercise({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (x: { name: string; muscle: string; kind: ExerciseKind }) => void }) {
  const all = useCatalogue();
  const save = useStore((s) => s.saveCustomExercise);
  const [q, setQ] = useState('');
  const [making, setMaking] = useState(false);
  const [form, setForm] = useState({ name: '', muscle: '', category: 'strength' as ExerciseKind, equipment: '' });
  const list = all.filter((x) => !q.trim() || `${x.name} ${x.muscle}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Sheet open={open} onClose={() => { setMaking(false); onClose(); }} title={making ? 'Create an exercise' : 'Add exercise'}>
      {making ? (
        <div className="space-y-2.5">
          <input className="field" placeholder="Name, e.g. Sandbag carry" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Exercise name" maxLength={50} />
          <input className="field" placeholder="Muscles worked, e.g. Legs, core" value={form.muscle} onChange={(e) => setForm({ ...form, muscle: e.target.value })} aria-label="Muscles" maxLength={50} />
          <input className="field" placeholder="Equipment, e.g. Sandbag (optional)" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} aria-label="Equipment" maxLength={50} />
          <Segmented<ExerciseKind> full value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={[{ value: 'strength', label: 'Sets & reps' }, { value: 'time', label: 'Timed' }, { value: 'cardio', label: 'Time & distance' }]} />
          <button disabled={form.name.trim().length < 2} onClick={() => { const c = save(form); toast(`${c.name} saved to your exercises`); onPick({ name: c.name, muscle: c.muscle, kind: c.category }); setMaking(false); setForm({ name: '', muscle: '', category: 'strength', equipment: '' }); }} className="btn-primary w-full">Save and add</button>
        </div>
      ) : (
        <>
          <div className="relative"><Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dim" /><input className="field !pl-11" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" /></div>
          <button onClick={() => { setMaking(true); setForm((f) => ({ ...f, name: q })); }} className="mt-2 w-full rounded-2xl bg-accent/10 py-3 text-sm font-semibold text-accent">+ Create your own exercise{q ? ` “${q}”` : ''}</button>
          <div className="mt-2 max-h-[50dvh] divide-y divide-line overflow-y-auto">
            {list.map((x) => (
              <button key={x.name} onClick={() => onPick(x)} className="flex w-full items-center justify-between gap-2 px-1 py-3 text-left">
                <span><span className="block font-semibold">{x.name}{x.custom && <span className="ml-1.5 text-xs font-normal text-accent">yours</span>}</span><span className="text-xs text-silver">{x.muscle} · {CATEGORY_LABEL[x.kind]}</span></span>
                <Plus size={18} className="text-accent" />
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Per-exercise timers live outside React, so they keep exact time while you move between exercises
 * or the phone sleeps (they're worked out from the clock, not counted tick by tick). */
const timers = new Map<string, { total: number; spent: number; startedAt?: number; rang?: boolean }>();

/** Top-right timer on each exercise: a countdown for timed moves (planks, holds), a stopwatch otherwise. */
function ExerciseTimer({ k, seconds }: { k: string; seconds: number | null }) {
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  const t = timers.get(k) ?? { total: seconds ?? 0, spent: 0 };
  if (!timers.has(k)) timers.set(k, t);
  if (seconds != null && !t.startedAt && t.spent === 0 && t.total !== seconds) t.total = seconds;
  const running = t.startedAt != null;
  useEffect(() => { if (!running) return; const i = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(i); }, [running]);
  const used = t.spent + (t.startedAt ? (Date.now() - t.startedAt) / 1000 : 0);
  const countdown = seconds != null;
  const left = Math.max(0, Math.ceil(t.total - used));
  if (countdown && running && left === 0 && !t.rang) {
    t.rang = true; t.spent = t.total; t.startedAt = undefined;
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* none */ }
    try { const a = new AudioContext(); const o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(); setTimeout(() => { o.stop(); void a.close(); }, 350); } catch { /* none */ }
    toast('Time’s up');
  }
  const shown = countdown ? left : Math.floor(used);
  const toggle = () => { haptic(); if (running) { t.spent = used; t.startedAt = undefined; } else { if (countdown && left === 0) { t.spent = 0; t.rang = false; } t.startedAt = Date.now(); } setOpen(true); tick((n) => n + 1); };
  const adjust = (d: number) => { haptic(); if (countdown) { t.total += d; t.rang = false; } else t.spent = Math.max(0, t.spent - d); tick((n) => n + 1); };
  const reset = () => { haptic(); t.spent = 0; t.startedAt = undefined; t.rang = false; if (seconds != null) t.total = seconds; tick((n) => n + 1); };
  return (
    <div className="relative shrink-0">
      <button onClick={toggle} aria-label={`${countdown ? 'Countdown' : 'Stopwatch'} ${clock(shown)}, ${running ? 'pause' : 'start'}`} className={cx('num flex h-9 items-center gap-1.5 rounded-full px-3 text-[15px] font-bold tabular-nums', running ? 'bg-accent text-white' : countdown && left === 0 ? 'bg-danger/15 text-danger' : 'bg-raised')}>
        {running ? <Pause size={13} /> : <Timer size={14} />} {clock(shown).padStart(5, '0')}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 flex gap-1 rounded-2xl bg-surface p-1.5" style={{ boxShadow: 'var(--shadow)' }}>
          {countdown && <button onClick={() => adjust(15)} className="chip !h-8 !px-2.5 text-[13px]">+15s</button>}
          {countdown && <button onClick={() => adjust(30)} className="chip !h-8 !px-2.5 text-[13px]">+30s</button>}
          <button onClick={reset} className="chip !h-8 !px-2.5 text-[13px]">Reset</button>
          <button onClick={() => setOpen(false)} className="chip !h-8 !px-2.5 text-[13px]" aria-label="Hide timer controls">✕</button>
        </div>
      )}
    </div>
  );
}
