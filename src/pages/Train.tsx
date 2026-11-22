import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Dumbbell, Droplet, Moon, Play, Plus, Scale, Search, Utensils } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { CATEGORY_NAMES, EQUIP_NAMES, type Category } from '@/data/exerciseLibrary';
import { DURATIONS, FOCI, KIT_NAMES, WORKOUTS, type Focus, type Kit, type Workout } from '@/data/workouts';
import { SAFETY, levelName, loadExercises, suggested, type Exercise } from '@/lib/exerciseDb';
import { newExercise } from './LiveWorkout';
import type { LiveExercise } from '@/lib/liveWorkout';
import { MEAL_LABELS, MEAL_ORDER } from '@/lib/meals';
import { nutrientsFor } from '@/lib/nutrition';
import { todayKey } from '@/lib/dates';
import { Segmented, Sheet, cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';

type Tab = 'workouts' | 'exercises' | 'history';
const LEVELS: [0 | 1 | 2 | 3, string][] = [[0, 'Any level'], [1, 'Beginner'], [2, 'Intermediate'], [3, 'Advanced']];

function useExercises() {
  const [all, setAll] = useState<Exercise[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { loadExercises().then(setAll, () => setErr(true)); }, []);
  return { all, err };
}
const findIn = (all: Exercise[] | null, name: string) => all?.find((e) => e.name.toLowerCase() === name.toLowerCase());

/** A move from a ready-made workout as a live exercise: sets × reps, timed seconds, or cardio minutes. */
function toLive(all: Exercise[] | null, [name, sets, amount]: [string, number, string]): LiveExercise {
  const ex = findIn(all, name);
  const muscle = ex ? CATEGORY_NAMES[ex.category] : '';
  const min = /(\d+)\s*min/.exec(amount);
  if (min || ex?.kind === 'cardio') return { ...newExercise(name, muscle, 'cardio'), minutes: min ? Number(min[1]) : undefined };
  const secs = /(\d+)\s*s\b/.exec(amount);
  if (secs) { const e = newExercise(name, muscle, 'time', sets); return { ...e, sets: e.sets.map((s) => ({ ...s, seconds: Number(secs[1]) })) }; }
  return newExercise(name, muscle, ex?.kind ?? 'strength', sets, parseInt(amount, 10) || undefined);
}

/** Workouts: ready-made routines, the full exercise library and your history — free, no AI needed. */
export default function Train() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'workouts';
  const { all, err } = useExercises();
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-24">
      <header className="pt-safe flex items-center gap-3 pb-3">
        <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-[26px] font-extrabold tracking-tight">Workouts</h1>
      </header>
      <Segmented<Tab> full value={tab} onChange={(v) => { haptic(); setParams({ tab: v }, { replace: true }); }} options={[{ value: 'workouts', label: 'Workouts' }, { value: 'exercises', label: 'Exercises' }, { value: 'history', label: 'History' }]} />
      {err && <p className="mt-4 text-sm text-silver">Couldn’t load exercises. Check your connection and try again.</p>}
      <div className="mt-4">
        {tab === 'workouts' ? <WorkoutsTab all={all} /> : tab === 'exercises' ? <ExercisesTab all={all} /> : <HistoryTab />}
      </div>
    </div>
  );
}

function Chips<T extends string | number>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 no-scrollbar" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={String(v)} onClick={() => { haptic(); onChange(v); }} aria-pressed={value === v} className={cx('chip !h-9 shrink-0 text-[14px]', value === v && 'chip-on')}>{l}</button>)}
    </div>
  );
}

function Thumb({ ex, size = 64 }: { ex?: Exercise; size?: number }) {
  const [bad, setBad] = useState(false);
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-raised" style={{ width: size, height: size }}>
      {ex?.images[0] && !bad ? <img src={ex.images[0]} alt="" loading="lazy" onError={() => setBad(true)} className="h-full w-full object-cover" /> : <Dumbbell size={size * 0.34} className="text-dim" />}
    </div>
  );
}

function WorkoutsTab({ all }: { all: Exercise[] | null }) {
  const [time, setTime] = useState(0);
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const [kit, setKit] = useState<'' | Kit>('');
  const [focus, setFocus] = useState<'' | Focus>('');
  const [open, setOpen] = useState<Workout | null>(null);
  const list = WORKOUTS.filter((w) => (!time || w.minutes <= time) && (!level || w.level === level) && (!kit || w.kit === kit) && (!focus || w.focus === focus));
  return (
    <section aria-label="Ready-made workouts" className="space-y-3">
      <Chips label="Time" value={time} onChange={setTime} options={[[0, 'Any time'], ...DURATIONS.map((d) => [d, `${d} min`] as [number, string])]} />
      <Chips label="Focus" value={focus} onChange={setFocus} options={[['', 'All'], ...FOCI.map((f) => [f, f] as ['' | Focus, string])]} />
      <Chips label="Equipment" value={kit} onChange={setKit} options={[['', 'Any equipment'], ...(Object.entries(KIT_NAMES) as ['' | Kit, string][])]} />
      <Chips label="Level" value={level} onChange={setLevel} options={LEVELS} />
      <p className="px-1 text-xs text-silver">{list.length} workout{list.length === 1 ? '' : 's'} · free · no AI needed</p>
      <ul className="grid gap-2.5">
        {list.map((w) => (
          <li key={w.id}>
            <button onClick={() => { haptic(); setOpen(w); }} className="card flex w-full items-center gap-3 p-3 text-left transition active:scale-[.99]">
              <Thumb ex={w.moves.map(([n]) => findIn(all, n)).find((e) => e?.images.length)} size={72} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">{w.name}</span>
                <span className="block text-[13px] text-silver">{w.minutes} min · {levelName(w.level)} · {KIT_NAMES[w.kit]}</span>
                <span className="block text-[13px] text-silver">{w.focus} · {w.moves.length} exercise{w.moves.length === 1 ? '' : 's'}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-dim" />
            </button>
          </li>
        ))}
      </ul>
      {!list.length && <p className="text-sm text-silver">No workouts match. Try a longer time or fewer filters.</p>}
      <WorkoutSheet w={open} all={all} onClose={() => setOpen(null)} />
    </section>
  );
}

function WorkoutSheet({ w, all, onClose }: { w: Workout | null; all: Exercise[] | null; onClose: () => void }) {
  const nav = useNavigate();
  const setActive = useStore((s) => s.setActiveWorkout);
  const active = useStore((s) => s.activeWorkout);
  const [ex, setEx] = useState<Exercise | null>(null);
  if (!w) return null;
  const start = () => {
    if (active && !confirm('You have a workout in progress. Replace it with this one?')) return;
    haptic([10, 30, 10]);
    setActive({ name: w.name, startedAt: Date.now(), pausedMs: 0, rest: w.level === 3 ? 120 : w.focus === 'Cardio' ? 30 : 60, exercises: w.moves.map((m) => toLive(all, m)) });
    onClose(); nav('/workout');
  };
  return (
    <>
      <Sheet open onClose={onClose} title={w.name}>
        <p className="text-[15px] text-silver">{w.about}</p>
        <p className="mt-2 flex flex-wrap gap-x-3 text-[14px] font-semibold"><span className="flex items-center gap-1"><Clock size={14} /> about {w.minutes} min</span><span>{levelName(w.level)}</span><span>{KIT_NAMES[w.kit]}</span></p>
        <button onClick={start} className="btn-primary mt-4 w-full"><Play size={18} /> Start workout</button>
        <ol className="mt-4 divide-y divide-line">
          {w.moves.map(([n, sets, amount], i) => {
            const e = findIn(all, n);
            return (
              <li key={i}>
                <button onClick={() => e && setEx(e)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <span className="num w-5 text-center text-[13px] font-bold text-silver">{i + 1}</span>
                  <Thumb ex={e} size={52} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{n}</span><span className="block text-[13px] text-silver">{sets > 1 ? `${sets} × ` : ''}{amount}{e ? ` · ${CATEGORY_NAMES[e.category]}` : ''}</span></span>
                  <ChevronRight size={16} className="shrink-0 text-dim" />
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-dim">Warm up first. Stop if you feel pain, dizziness or numbness. General fitness information, not medical advice.</p>
      </Sheet>
      <ExerciseSheet ex={ex} onClose={() => setEx(null)} />
    </>
  );
}

function ExercisesTab({ all }: { all: Exercise[] | null }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'' | Category>('');
  const [eq, setEq] = useState('');
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const [kind, setKind] = useState('');
  const [shown, setShown] = useState(40);
  const [open, setOpen] = useState<Exercise | null>(null);
  useEffect(() => setShown(40), [q, cat, eq, level, kind]);
  const equipment = useMemo(() => [...new Set((all ?? []).flatMap((e) => e.equipment))].sort(), [all]);
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (all ?? []).filter((e) => (!cat || e.category === cat) && (!eq || e.equipment.includes(eq)) && (!level || e.level === level) && (!kind || e.kind === kind)
      && words.every((w) => `${e.name} ${e.primary.join(' ')} ${e.secondary.join(' ')} ${CATEGORY_NAMES[e.category]} ${e.equipment.join(' ')}`.toLowerCase().includes(w)));
  }, [all, q, cat, eq, level, kind]);
  const eqName = (k: string) => (EQUIP_NAMES as Record<string, string>)[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
  return (
    <section aria-label="Exercise library" className="space-y-3">
      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-silver" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises, e.g. squat, triceps" className="field !pl-11" aria-label="Search exercises" />
      </label>
      <Chips label="Body area" value={cat} onChange={setCat} options={[['', 'All'], ...(Object.entries(CATEGORY_NAMES) as ['' | Category, string][])]} />
      <Chips label="Equipment" value={eq} onChange={setEq} options={[['', 'Any equipment'], ...equipment.map((k) => [k, eqName(k)] as [string, string])]} />
      <Chips label="Level" value={level} onChange={setLevel} options={LEVELS} />
      <Chips label="Type" value={kind} onChange={setKind} options={[['', 'Any type'], ['strength', 'Strength'], ['time', 'Timed & stretches'], ['cardio', 'Cardio']]} />
      <p className="px-1 text-xs text-silver">{all ? `${list.length} of ${all.length} exercises` : 'Loading exercises…'}</p>
      <ul className="divide-y divide-line">
        {list.slice(0, shown).map((e) => (
          <li key={e.id}>
            <button onClick={() => { haptic(); setOpen(e); }} className="flex w-full items-center gap-3 py-2.5 text-left">
              <Thumb ex={e} size={60} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.name}</span>
                <span className="block truncate text-[13px] text-silver">{e.primary.join(', ') || CATEGORY_NAMES[e.category]} · {e.equipment.map(eqName).join(', ')} · {levelName(e.level)}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-dim" />
            </button>
          </li>
        ))}
      </ul>
      {list.length > shown && <button onClick={() => setShown((n) => n + 60)} className="btn-ghost w-full">Show more ({list.length - shown} more)</button>}
      <p className="text-xs text-dim">Exercise photos and steps: Free Exercise DB (public domain), plus Nutivili’s own guides.</p>
      <ExerciseSheet ex={open} onClose={() => setOpen(null)} />
    </section>
  );
}

/** One exercise: photos (start and end), muscles, equipment, steps, sets and safety. */
export function ExerciseSheet({ ex, onClose }: { ex: Exercise | null; onClose: () => void }) {
  const nav = useNavigate();
  const active = useStore((s) => s.activeWorkout);
  const setActive = useStore((s) => s.setActiveWorkout);
  const [img, setImg] = useState(0);
  useEffect(() => setImg(0), [ex]);
  if (!ex) return null;
  const g = ex.guide;
  const add = () => {
    haptic();
    const live = toLive([ex], [ex.name, g?.rx.sets ?? 3, ex.kind === 'time' ? '30s' : ex.kind === 'cardio' ? '10 min' : String(parseInt(g?.rx.reps ?? '10', 10) || 10)]);
    if (active) { setActive((c) => ({ ...c, exercises: [...c.exercises, live] })); toast(`Added to ${active.name}`); }
    else setActive({ name: ex.name, startedAt: Date.now(), pausedMs: 0, rest: 60, exercises: [live] });
    onClose(); nav('/workout');
  };
  return (
    <Sheet open onClose={onClose} title={ex.name}>
      {ex.images.length > 0 ? (
        <div>
          <div className="relative overflow-hidden rounded-[22px] bg-raised" style={{ aspectRatio: '3 / 2' }}>
            <img src={ex.images[img]} alt={`${ex.name}: ${img === 0 ? 'start' : 'end'} position`} className="h-full w-full object-cover" />
            <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">{img === 0 ? 'Start' : 'End'} position</span>
          </div>
          {ex.images.length > 1 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ex.images.map((src, i) => <button key={src} onClick={() => setImg(i)} aria-pressed={img === i} className={cx('overflow-hidden rounded-xl border-2', img === i ? 'border-accent' : 'border-transparent')}><img src={src} alt="" className="h-20 w-full object-cover" /></button>)}
            </div>
          )}
        </div>
      ) : <p className="rounded-2xl bg-raised p-4 text-sm text-silver">No photo for this one yet. Follow the written steps below.</p>}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[13px]">
        <span className="rounded-full bg-raised px-2.5 py-1 font-semibold">{levelName(ex.level)}</span>
        <span className="rounded-full bg-raised px-2.5 py-1 font-semibold">{CATEGORY_NAMES[ex.category]}</span>
        {ex.equipment.map((e) => <span key={e} className="rounded-full bg-raised px-2.5 py-1 font-semibold">{(EQUIP_NAMES as Record<string, string>)[e] ?? e}</span>)}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[14px]">
        <div className="rounded-2xl bg-raised p-3"><dt className="text-xs font-semibold text-silver">Main muscles</dt><dd className="font-semibold">{ex.primary.join(', ') || '—'}</dd></div>
        <div className="rounded-2xl bg-raised p-3"><dt className="text-xs font-semibold text-silver">Also works</dt><dd className="font-semibold">{ex.secondary.join(', ') || '—'}</dd></div>
      </dl>
      <p className="mt-3 text-[14px]"><span className="font-semibold">Suggested:</span> {suggested(ex)}</p>
      <button onClick={add} className="btn-primary mt-3 w-full">{active ? <><Plus size={18} /> Add to my workout</> : <><Play size={18} /> Start a workout with this</>}</button>
      <p className="mt-5 text-[17px] font-bold">How to do it</p>
      <ol className="mt-2 space-y-2.5">{ex.steps.map((s, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised text-[13px] font-bold">{i + 1}</span><span>{s}</span></li>)}</ol>
      {g?.breathing && <p className="mt-3 text-[14px]"><span className="font-semibold">Breathing:</span> {g.breathing}</p>}
      {g?.mistakes?.length ? <><p className="mt-5 text-[17px] font-bold">Common mistakes</p><ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">{g.mistakes.map((m) => <li key={m}>{m}</li>)}</ul></> : null}
      <p className="mt-5 text-[17px] font-bold">Safety and form</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">{[...(g?.safety ?? []), ...SAFETY[ex.category]].filter((x, i, a) => a.indexOf(x) === i).map((m) => <li key={m}>{m}</li>)}</ul>
      {(g?.easier || g?.harder) && <p className="mt-3 text-[14px] text-silver">{g.easier && <>Easier: {g.easier}. </>}{g.harder && <>Harder: {g.harder}.</>}</p>}
      <p className="mt-4 text-xs text-dim">General fitness information, not medical advice. Stop if you feel sharp pain.</p>
    </Sheet>
  );
}

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A month calendar of workouts, and one day's full activity: meals, workouts, weight, water and sleep. */
function HistoryTab() {
  const logs = useStore((s) => s.workoutLogs);
  const exercises = useStore((s) => s.exercises);
  const entries = useStore((s) => s.entries);
  const weights = useStore((s) => s.weights);
  const water = useStore((s) => s.water);
  const sleep = useStore((s) => s.sleep);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [day, setDay] = useState(todayKey());
  const trained = useMemo(() => new Set([...logs.map((l) => l.date), ...exercises.map((e) => e.date)]), [logs, exercises]);
  const ate = useMemo(() => new Set(entries.filter((e) => !e.planned).map((e) => e.date)), [entries]);
  const first = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const inMonth = [...trained].filter((d) => d.startsWith(key(month).slice(0, 7))).length;
  const weekAgo = key(new Date(Date.now() - 6 * 864e5));
  const week = logs.filter((l) => l.date >= weekAgo);
  const dayLogs = logs.filter((l) => l.date === day);
  const dayEx = exercises.filter((e) => e.date === day);
  const meals = MEAL_ORDER.map((m) => ({ m, items: entries.filter((e) => e.date === day && e.meal === m && !e.planned) })).filter((x) => x.items.length);
  const w = weights.find((x) => x.date === day);
  const sleepH = sleep?.[day]?.hours ?? 0;
  return (
    <section aria-label="Workout history" className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card py-3"><p className="num text-[22px] font-extrabold">{week.length}</p><p className="text-xs text-silver">workouts this week</p></div>
        <div className="card py-3"><p className="num text-[22px] font-extrabold">{week.reduce((a, l) => a + l.minutes, 0)}</p><p className="text-xs text-silver">minutes this week</p></div>
        <div className="card py-3"><p className="num text-[22px] font-extrabold">{inMonth}</p><p className="text-xs text-silver">active days this month</p></div>
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-full bg-raised" aria-label="Previous month"><ChevronLeft size={18} /></button>
          <p className="flex items-center gap-2 font-bold"><CalendarDays size={16} /> {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
          <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-full bg-raised" aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[12px] font-semibold text-dim">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const k = key(d);
            return (
              <button key={k} onClick={() => setDay(k)} aria-label={`${d.toDateString()}${trained.has(k) ? ', workout' : ''}`} aria-pressed={day === k} className={cx('relative grid aspect-square place-items-center rounded-full text-[14px] font-semibold', day === k ? 'bg-ink text-bg' : trained.has(k) ? 'bg-accent/15 text-accent' : ate.has(k) ? 'bg-raised' : '')}>
                {d.getDate()}
                {trained.has(k) && <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-accent text-white"><Check size={10} strokeWidth={3.5} /></span>}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-silver"><span className="font-semibold text-accent">Green</span> = workout · grey = food logged</p>
      </div>
      <div className="card p-4">
        <p className="text-[17px] font-bold">{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <ul className="mt-2 space-y-3 text-[14px]">
          {dayLogs.map((l) => (
            <li key={l.id} className="flex gap-3"><Dumbbell size={18} className="mt-0.5 shrink-0 text-accent" /><span><b>{l.name}</b> · {l.minutes} min{l.startedAt ? ` · ${new Date(l.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}<span className="block text-silver">{l.exercises.filter((e) => !e.skipped).map((e) => { const done = e.sets.filter((s) => s.done); return `${e.name}${done.length ? ` ${done.length}×${done.map((s) => (s.seconds ? `${s.seconds}s` : `${s.weightKg ? `${s.weightKg}kg×` : ''}${s.reps ?? ''}`)).join(', ')}` : e.minutes ? ` ${e.minutes} min` : ''}`; }).join(' · ')}{l.exercises.some((e) => e.skipped) ? ` · skipped: ${l.exercises.filter((e) => e.skipped).map((e) => e.name).join(', ')}` : ''}</span>{l.note && <span className="block text-silver">“{l.note}”</span>}</span></li>
          ))}
          {dayEx.map((e) => <li key={e.id} className="flex gap-3"><Dumbbell size={18} className="mt-0.5 shrink-0 text-accent" /><span><b>{e.detail?.name ?? (e.type.charAt(0).toUpperCase() + e.type.slice(1))}</b> · {e.minutes} min{e.kcal ? ` · ${fmt(e.kcal)} kcal` : ''}</span></li>)}
          {meals.map(({ m, items }) => {
            const t = items.reduce((a, x) => { const n = nutrientsFor(x.food.per100, x.grams); return { kcal: a.kcal + (n.kcal ?? 0), protein: a.protein + (n.protein ?? 0) }; }, { kcal: 0, protein: 0 });
            return <li key={m} className="flex gap-3"><Utensils size={18} className="mt-0.5 shrink-0 text-silver" /><span><b>{MEAL_LABELS[m]}</b> · {fmt(t.kcal)} kcal · {fmt(t.protein)} g protein<span className="block text-silver">{items.map((x) => x.food.name.split(',')[0]).join(', ')}</span></span></li>;
          })}
          {w && <li className="flex gap-3"><Scale size={18} className="mt-0.5 shrink-0 text-silver" /><span><b>Weight</b> · {w.kg} kg</span></li>}
          {!!water?.[day] && <li className="flex gap-3"><Droplet size={18} className="mt-0.5 shrink-0 text-silver" /><span><b>Water</b> · {fmt(water[day] / 1000, 2)} L</span></li>}
          {sleepH > 0 && <li className="flex gap-3"><Moon size={18} className="mt-0.5 shrink-0 text-silver" /><span><b>Sleep</b> · {fmt(sleepH, 1)} h</span></li>}
          {!dayLogs.length && !dayEx.length && !meals.length && !w && !water?.[day] && !sleepH && <li className="text-silver">Nothing logged this day.</li>}
        </ul>
      </div>
    </section>
  );
}
