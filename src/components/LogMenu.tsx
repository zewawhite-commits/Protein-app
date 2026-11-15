import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Camera, Dumbbell, PenLine, ScanBarcode, Search, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { todayKey } from '@/lib/dates';
import { EXERCISES, burnedKcal, type ExerciseType, type Intensity } from '@/lib/exercise';
import { Segmented, Sheet, cx, fmt } from './ui';
import { haptic, toast } from './fx';

/** The "+" button's menu: every way to log, in one place. */
export function LogMenu({ open, onClose, date }: { open: boolean; onClose: () => void; date?: string }) {
  const nav = useNavigate();
  const [exercise, setExercise] = useState(false);
  const q = date && date !== todayKey() ? `?date=${date}` : '';
  const go = (to: string) => { haptic(); onClose(); nav(to); };
  const items = [
    { icon: Camera, label: 'Scan food', sub: 'Photo of your meal', to: `/snap${q}` },
    { icon: ScanBarcode, label: 'Barcode', sub: 'Packaged foods', to: `/barcode${q}` },
    { icon: PenLine, label: 'Describe', sub: 'Type what you ate', to: `/snap${q ? `${q}&` : '?'}mode=describe` },
    { icon: Search, label: 'Food database', sub: '18,000+ foods', to: `/add${q}` },
    { icon: Bookmark, label: 'Saved meals', sub: 'Log in one tap', to: `/add?tab=saved${q ? `&${q.slice(1)}` : ''}` },
  ];
  return (
    <>
      <Sheet open={open} onClose={onClose} title="Log">
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((i) => (
            <button key={i.label} onClick={() => go(i.to)} className="flex flex-col items-start rounded-[22px] bg-surface p-4 text-left transition active:scale-[.97]" style={{ boxShadow: 'var(--shadow)' }}>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary"><i.icon size={20} /></span>
              <span className="mt-3 font-bold">{i.label}</span>
              <span className="text-sm text-silver">{i.sub}</span>
            </button>
          ))}
          <button onClick={() => { haptic(); onClose(); setExercise(true); }} className="flex flex-col items-start rounded-[22px] bg-surface p-4 text-left transition active:scale-[.97]" style={{ boxShadow: 'var(--shadow)' }}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary"><Dumbbell size={20} /></span>
            <span className="mt-3 font-bold">Exercise</span>
            <span className="text-sm text-silver">Log a workout</span>
          </button>
        </div>
      </Sheet>
      <ExerciseSheet open={exercise} onClose={() => setExercise(false)} date={date ?? todayKey()} />
    </>
  );
}

export function ExerciseSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const kg = useStore((s) => (s.weights.length ? s.weights[s.weights.length - 1].kg : s.profile?.bodyWeightKg ?? 0));
  const add = useStore((s) => s.addExercise);
  const addBurned = useStore((s) => s.settings.addBurned ?? false);
  const updateSettings = useStore((s) => s.updateSettings);
  const [type, setType] = useState<ExerciseType>('run');
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [minutes, setMinutes] = useState('30');
  const [own, setOwn] = useState('');
  const mins = Number(minutes) || 0;
  const estimate = burnedKcal(type, intensity, mins, kg);
  const kcal = own ? Number(own) : estimate;

  function save() {
    add({ date, type, intensity, minutes: mins, kcal, manual: !!own });
    haptic([10, 30, 10]);
    toast(`${EXERCISES[type].label} logged · ${fmt(kcal)} kcal`);
    setOwn('');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log exercise">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(EXERCISES) as ExerciseType[]).map((t) => (
          <button key={t} onClick={() => setType(t)} className={cx('chip !h-10', type === t && 'chip-on')}>{EXERCISES[t].label}</button>
        ))}
      </div>
      <p className="label mt-5">Intensity</p>
      <Segmented full value={intensity} onChange={setIntensity} options={[{ value: 'low', label: 'Light' }, { value: 'medium', label: 'Moderate' }, { value: 'high', label: 'Hard' }]} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="ex-min">Minutes</label>
          <input id="ex-min" inputMode="numeric" className="field text-xl font-bold" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </div>
        <div>
          <label className="label" htmlFor="ex-kcal">Calories</label>
          <input id="ex-kcal" inputMode="numeric" className="field text-xl font-bold" value={own} onChange={(e) => setOwn(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder={String(estimate)} />
        </div>
      </div>
      <p className="mt-2 text-xs text-dim">{own ? 'Using your number (e.g. from your watch).' : kg ? `Estimated from your weight and the activity. Type your own if your watch shows a number.` : 'Add your weight in Profile for an estimate.'}</p>
      <label className="mt-4 flex items-center justify-between rounded-2xl bg-raised px-4 py-3">
        <span><span className="block font-semibold">Add burned calories to my budget</span><span className="text-xs text-silver">Your daily calories go up on workout days</span></span>
        <input type="checkbox" checked={addBurned} onChange={(e) => updateSettings({ addBurned: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--accent))]" />
      </label>
      <button onClick={save} disabled={!mins || !kcal} className="btn-primary mt-5 w-full">Log {fmt(kcal)} kcal</button>
    </Sheet>
  );
}

/** Today's workouts, for the Home screen. */
export function ExerciseList({ date }: { date: string }) {
  const all = useStore((s) => s.exercises);
  const list = useMemo(() => all.filter((e) => e.date === date), [all, date]);
  const remove = useStore((s) => s.removeExercise);
  if (!list.length) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-3 px-1 text-xl font-semibold tracking-tight">Exercise</h2>
      <div className="card p-2">
        {list.map((e) => (
          <div key={e.id} className="flex items-center gap-4 p-3">
            <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-raised"><Dumbbell size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{EXERCISES[e.type].label}</p>
              <p className="text-sm text-silver">{e.minutes} min · {e.intensity === 'low' ? 'light' : e.intensity === 'medium' ? 'moderate' : 'hard'}{e.manual ? '' : ' · estimate'}</p>
            </div>
            <p className="num text-right"><span className="block text-lg font-bold text-accent">+{fmt(e.kcal)}</span><span className="text-xs text-silver">kcal</span></p>
            <button onClick={() => remove(e.id)} className="grid h-9 w-9 place-items-center rounded-full text-dim" aria-label="Delete workout"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
