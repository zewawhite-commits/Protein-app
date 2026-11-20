import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { EXERCISE_LIBRARY, burnedKcal, type Routine, type RoutineExercise } from '@/lib/exercise';
import { todayKey } from '@/lib/dates';
import { cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';

const LB = 2.20462;

/** Build workout routines (exercises × sets × reps × weight), reuse them, and log a session in one tap. */
export default function Routines() {
  const nav = useNavigate();
  const routines = useStore((s) => s.routines);
  const remove = useStore((s) => s.removeRoutine);
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);
  const [logging, setLogging] = useState<Routine | null>(null);

  if (editing) return <Editor initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  if (logging) return <LogSession routine={logging} onDone={() => setLogging(null)} />;

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16 md:max-w-2xl">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-[26px] font-extrabold tracking-tight">My routines</h1>
      </header>
      <button onClick={() => setEditing('new')} className="btn-primary w-full"><Plus size={18} /> New routine</button>
      {routines.length === 0 && <p className="card mt-4 p-5 text-sm text-silver">Save the workouts you repeat (e.g. “Push day”, “Legs”) with sets, reps and weights. Then log a whole session in one tap.</p>}
      <div className="mt-4 space-y-3">
        {routines.map((r) => (
          <section key={r.id} className="card p-5">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-lg font-bold">{r.name}</p>
              <button onClick={() => setEditing(r)} className="grid h-9 w-9 place-items-center rounded-full text-silver" aria-label={`Edit ${r.name}`}><Pencil size={16} /></button>
              <button onClick={() => share(r)} className="grid h-9 w-9 place-items-center rounded-full text-silver" aria-label={`Share ${r.name}`}><Share2 size={16} /></button>
              <button onClick={() => { if (confirm(`Delete ${r.name}?`)) { remove(r.id); toast('Routine deleted'); } }} className="grid h-9 w-9 place-items-center rounded-full text-dim" aria-label={`Delete ${r.name}`}><Trash2 size={16} /></button>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-silver">
              {r.exercises.map((e, i) => <li key={i}>{e.name} · {e.sets} × {e.reps}{e.weightKg ? ` · ${fmt(e.weightKg, 1)} kg` : ''}</li>)}
            </ul>
            <button onClick={() => setLogging(r)} className="btn mt-3 w-full bg-accent/10 text-accent">Log this workout</button>
          </section>
        ))}
      </div>
    </div>
  );
}

function share(r: Routine) {
  const text = `${r.name} (Nutivili AI routine)\n${r.exercises.map((e) => `- ${e.name}: ${e.sets} × ${e.reps}${e.weightKg ? ` @ ${fmt(e.weightKg, 1)} kg` : ''}`).join('\n')}`;
  if (navigator.share) void navigator.share({ title: r.name, text }).catch(() => undefined);
  else void navigator.clipboard.writeText(text).then(() => toast('Routine copied'), () => toast('Couldn’t copy on this device'));
}

function Editor({ initial, onDone }: { initial: Routine | null; onDone: () => void }) {
  const save = useStore((s) => s.saveRoutine);
  const lb = useStore((s) => s.settings.bodyUnit === 'lb');
  const [name, setName] = useState(initial?.name ?? '');
  const [list, setList] = useState<(RoutineExercise & { w: string })[]>((initial?.exercises ?? []).map((e) => ({ ...e, w: e.weightKg ? fmt(lb ? e.weightKg * LB : e.weightKg, 1) : '' })));
  const [custom, setCustom] = useState('');
  const add = (n: string, muscle?: string) => { if (!n.trim()) return; haptic(); setList((l) => [...l, { name: n.trim().slice(0, 40), muscle, sets: 3, reps: '10', w: '' }]); setCustom(''); };
  const set = (i: number, patch: Partial<RoutineExercise & { w: string }>) => setList((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const ok = name.trim().length >= 2 && list.length > 0;
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16 md:max-w-2xl">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <button onClick={onDone} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-[26px] font-extrabold tracking-tight">{initial ? 'Edit routine' : 'New routine'}</h1>
      </header>
      <label className="label" htmlFor="rt-name">Name</label>
      <input id="rt-name" className="field" maxLength={40} placeholder="e.g. Push day" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="mt-4 space-y-2">
        {list.map((e, i) => (
          <div key={i} className="card p-3">
            <div className="flex items-center gap-2">
              <p className="flex-1 font-semibold">{e.name}</p>
              <button onClick={() => setList((l) => l.filter((_, k) => k !== i))} className="grid h-8 w-8 place-items-center rounded-full text-dim" aria-label={`Remove ${e.name}`}><Trash2 size={15} /></button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-silver">
              <label>Sets<input inputMode="numeric" aria-label={`${e.name} sets`} className="field mt-1 !h-11 text-center text-base font-bold" value={e.sets || ''} onChange={(ev) => set(i, { sets: Math.min(20, Number(ev.target.value.replace(/\D/g, '')) || 0) })} /></label>
              <label>Reps or time<input aria-label={`${e.name} reps`} maxLength={8} className="field mt-1 !h-11 text-center text-base font-bold" value={e.reps} onChange={(ev) => set(i, { reps: ev.target.value })} /></label>
              <label>Weight ({lb ? 'lb' : 'kg'})<input inputMode="decimal" aria-label={`${e.name} weight`} className="field mt-1 !h-11 text-center text-base font-bold" value={e.w} onChange={(ev) => set(i, { w: ev.target.value.replace(/[^\d.,]/g, '') })} placeholder="–" /></label>
            </div>
          </div>
        ))}
      </div>
      <p className="label mt-5">Add exercises</p>
      <div className="flex gap-2">
        <input className="field flex-1" maxLength={40} placeholder="Type any exercise" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(custom)} aria-label="Exercise name" />
        <button disabled={!custom.trim()} onClick={() => add(custom)} className="btn-primary !px-5">Add</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXERCISE_LIBRARY.map((x) => <button key={x.name} onClick={() => add(x.name, x.muscle)} className="chip !h-9">{x.name}</button>)}
      </div>
      <button disabled={!ok} onClick={() => {
        save({ id: initial?.id, name: name.trim(), exercises: list.filter((e) => e.sets > 0).map(({ w, ...e }) => { const n = Number(w.replace(',', '.')); return { ...e, ...(n > 0 ? { weightKg: Math.round((lb ? n / LB : n) * 10) / 10 } : {}) }; }) });
        toast('Routine saved'); onDone();
      }} className="btn-primary mt-6 w-full">Save routine</button>
    </div>
  );
}

/** Tick off what you did (adjust any numbers), then log it as today's workout. */
function LogSession({ routine, onDone }: { routine: Routine; onDone: () => void }) {
  const addExercise = useStore((s) => s.addExercise);
  const kg = useStore((s) => s.profile?.bodyWeightKg ?? 0);
  const [done, setDone] = useState(routine.exercises.map(() => true));
  const [minutes, setMinutes] = useState(String(Math.max(15, routine.exercises.length * 8)));
  const mins = Number(minutes) || 0;
  const picked = routine.exercises.filter((_, i) => done[i]);
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16 md:max-w-2xl">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <button onClick={onDone} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-[24px] font-extrabold tracking-tight">{routine.name}</h1>
      </header>
      <div className="card divide-y divide-line p-1.5">
        {routine.exercises.map((e, i) => (
          <button key={i} onClick={() => setDone((d) => d.map((x, k) => (k === i ? !x : x)))} className="flex w-full items-center gap-3 px-3 py-3 text-left">
            <span className={cx('grid h-7 w-7 place-items-center rounded-full border-2', done[i] ? 'border-accent bg-accent text-white' : 'border-line')}>{done[i] && <Check size={15} strokeWidth={3} />}</span>
            <span className="flex-1 font-semibold">{e.name}</span>
            <span className="num text-sm text-silver">{e.sets} × {e.reps}{e.weightKg ? ` · ${fmt(e.weightKg, 1)} kg` : ''}</span>
          </button>
        ))}
      </div>
      <label className="label mt-5" htmlFor="rt-min">How long (minutes)</label>
      <input id="rt-min" inputMode="numeric" className="field text-xl font-bold" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} />
      <p className="mt-2 text-xs text-dim">Calories burned are an estimate from your weight and the time. They don’t change your food targets.</p>
      <button disabled={!picked.length || mins <= 0} onClick={() => {
        const per = Math.max(1, Math.round(mins / picked.length));
        for (const e of picked) {
          const reps = Number(e.reps);
          addExercise({ date: todayKey(), type: 'weights', intensity: 'medium', minutes: per, kcal: burnedKcal('weights', 'medium', per, kg), detail: { name: e.name, sets: e.sets, ...(Number.isFinite(reps) && reps > 0 ? { reps } : {}), ...(e.weightKg ? { weightKg: e.weightKg } : {}) }, note: routine.name });
        }
        haptic([10, 30, 10]); toast(`${routine.name} logged`); onDone();
      }} className="btn-ghost mt-6 w-full">Already done it? Log {picked.length} exercise{picked.length === 1 ? '' : 's'}</button>
      <Link to={`/workout?routine=${routine.id}`} className="btn-primary mt-2 w-full">Start it live — timer, sets &amp; rest</Link>
    </div>
  );
}
