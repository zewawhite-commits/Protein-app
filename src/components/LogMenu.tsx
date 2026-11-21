import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Camera, Mic, ChefHat, ScanText, Dumbbell, PenLine, ScanBarcode, Search, Trash2, PlusSquare } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { todayKey } from '@/lib/dates';
import { EXERCISES, burnedKcal, parseExercise, type ExerciseType, type Intensity, type SaidExercise } from '@/lib/exercise';
import { SR } from './VoiceSheet';
import { Segmented, Sheet, cx, fmt } from './ui';
import { haptic, toast } from './fx';

/** The "+" button's menu: every way to log, in one place. */
export function LogMenu({ open, onClose, date }: { open: boolean; onClose: () => void; date?: string }) {
  const nav = useNavigate();
  const [exercise, setExercise] = useState(false);
  const q = date && date !== todayKey() ? `?date=${date}` : '';
  const go = (to: string) => { haptic(); onClose(); nav(to); };
  const groups: { title: string; items: { icon: typeof Camera; label: string; sub: string; to?: string; run?: () => void }[] }[] = [
    { title: 'Quick logging', items: [
      { icon: Camera, label: 'Scan food', sub: 'Photo of your meal', to: `/snap${q}` },
      { icon: PenLine, label: 'Describe your food', sub: 'Type or say it', to: `/snap${q ? `${q}&` : '?'}mode=describe` },
      { icon: Search, label: 'Food database', sub: '18,000+ foods', to: `/add${q}` },
      { icon: Bookmark, label: 'Saved meals', sub: 'Log in one tap', to: `/add?tab=saved${q ? `&${q.slice(1)}` : ''}` },
    ] },
    { title: 'Packaged food', items: [
      { icon: ScanBarcode, label: 'Barcode', sub: 'Scan the pack', to: `/barcode${q}` },
      { icon: ScanText, label: 'Nutrition label', sub: 'Photo of the label', to: `/snap${q ? `${q}&` : '?'}mode=label` },
    ] },
    { title: 'Your food', items: [
      { icon: PlusSquare, label: 'Custom food', sub: 'Your own numbers', to: `/add?create=1${q ? `&${q.slice(1)}` : ''}` },
      { icon: ChefHat, label: 'Recipes', sub: 'Make, import & share', to: `/add?tab=custom${q ? `&${q.slice(1)}` : ''}` },
    ] },
    { title: 'Activity', items: [
      { icon: Dumbbell, label: 'Log exercise', sub: 'Add a workout', run: () => { haptic(); onClose(); setExercise(true); } },
    ] },
  ];
  return (
    <>
      <Sheet open={open} onClose={onClose} title="Log">
        <div className="space-y-4 pb-1">
          {groups.map((g) => (
            <section key={g.title}>
              <p className="mb-2 px-1 text-[13px] font-semibold text-silver">{g.title}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {g.items.map((i) => (
                  <button key={i.label} onClick={() => (i.run ? i.run() : go(i.to!))} className="flex flex-col items-start rounded-[22px] bg-surface p-4 text-left transition active:scale-[.97]" style={{ boxShadow: 'var(--shadow)' }}>
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary"><i.icon size={20} /></span>
                    <span className="mt-3 font-bold">{i.label}</span>
                    <span className="text-sm text-silver">{i.sub}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Sheet>
      <ExerciseSheet open={exercise} onClose={() => setExercise(false)} date={date ?? todayKey()} />
    </>
  );
}

export function ExerciseSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const navToRoutines = useNavigate();
  const kg = useStore((s) => (s.weights.length ? s.weights[s.weights.length - 1].kg : s.profile?.bodyWeightKg ?? 0));
  const add = useStore((s) => s.addExercise);
  const addBurned = useStore((s) => s.settings.addBurned ?? false);
  const updateSettings = useStore((s) => s.updateSettings);
  const [type, setType] = useState<ExerciseType>('run');
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [minutes, setMinutes] = useState('30');
  const [own, setOwn] = useState('');
  const [name, setName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [load, setLoad] = useState('');
  const [secs, setSecs] = useState('');
  const [dist, setDist] = useState('');
  const [exNote, setExNote] = useState('');
  const unit = useStore((s) => s.settings.bodyUnit);
  const mins = Number(minutes) || 0;
  const estimate = burnedKcal(type, intensity, mins, kg);
  const kcal = own ? Number(own) : estimate;

  function save() {
    const num = (v: string) => (Number(v) > 0 ? Number(v) : undefined);
    const detail = name.trim() ? { name: name.trim().slice(0, 40), sets: num(sets), reps: num(reps), weightKg: num(load) ? Math.round((unit === 'lb' ? num(load)! / 2.20462 : num(load)!) * 10) / 10 : undefined, seconds: num(secs) } : undefined;
    const d = Number(dist.replace(',', '.'));
    const km = d > 0 ? Math.round((unit === 'lb' ? d * 1.609344 : d) * 100) / 100 : undefined;
    add({ date, type, intensity, minutes: mins, kcal, manual: !!own, ...(detail && { detail }), ...(km && { km }), ...(exNote.trim() && { note: exNote.trim().slice(0, 120) }) });
    setName(''); setSets(''); setReps(''); setLoad(''); setSecs('');
    haptic([10, 30, 10]);
    toast(`${EXERCISES[type].label} logged · ${fmt(kcal)} kcal`);
    setOwn('');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log exercise">
      <SayExercise date={date} kg={kg} onDone={onClose} />
      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-dim">Or fill it in</p>
      <button onClick={() => { onClose(); navToRoutines('/workout'); }} className="btn-primary mb-2 w-full"><Dumbbell size={18} /> Start a live workout (timer, sets, rest)</button>
      <button onClick={() => { onClose(); navToRoutines('/routines'); }} className="mb-4 flex w-full items-center gap-3 rounded-[18px] bg-accent/10 px-4 py-3 text-left font-semibold text-accent"><Dumbbell size={18} /> Use a saved routine (sets, reps, weights)</button>
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
      {['run', 'walk', 'cycle', 'swim'].includes(type) && (
        <div className="mt-4">
          <label className="label" htmlFor="ex-dist">Distance <span className="font-normal text-dim">(optional, {unit === 'lb' ? 'miles' : 'km'})</span></label>
          <input id="ex-dist" inputMode="decimal" className="field" value={dist} onChange={(e) => setDist(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} placeholder="0" />
        </div>
      )}
      <input className="field mt-3" maxLength={120} placeholder="Note (optional), e.g. felt strong" value={exNote} onChange={(e) => setExNote(e.target.value)} aria-label="Workout note" />
      <p className="label mt-5">Exercise detail <span className="font-normal text-dim">(optional)</span></p>
      <input className="field" maxLength={40} placeholder="e.g. Bench press, weighted plank, farmer’s carry" value={name} onChange={(e) => setName(e.target.value)} />
      {name.trim() && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {([['Sets', sets, setSets, 2], ['Reps', reps, setReps, 3], [unit, load, setLoad, 5], ['Secs', secs, setSecs, 4]] as const).map(([l, v, set, max]) => (
            <label key={l} className="rounded-2xl bg-raised p-2 text-center">
              <span className="block text-xs font-semibold text-silver">{l}</span>
              <input inputMode="decimal" value={v} onChange={(e) => set(e.target.value.replace(/[^\d.]/g, '').slice(0, max))} className="num mt-0.5 w-full bg-transparent text-center text-[16px] font-bold outline-none" placeholder="–" aria-label={l} />
            </label>
          ))}
        </div>
      )}
      {name.trim() && <p className="mt-1.5 text-xs text-dim">Fill in what applies: weight and reps for lifts, weight and seconds for holds and carries.</p>}
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
  const update = useStore((s) => s.updateExercise);
  const unit = useStore((s) => s.settings.bodyUnit);
  const [edit, setEdit] = useState<{ id: string; minutes: string; kcal: string } | null>(null);
  if (!list.length) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-3 px-1 text-xl font-semibold tracking-tight">Exercise</h2>
      <div className="card p-2">
        {list.map((e) => (
          <div key={e.id} className="flex items-center gap-4 p-3">
            <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-raised"><Dumbbell size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{e.detail?.name ?? EXERCISES[e.type].label}</p>
              {e.detail && <p className="num text-sm font-semibold">{describeDetail(e.detail, unit)}</p>}
              <p className="text-sm text-silver">{e.minutes} min{e.km ? ` · ${unit === 'lb' ? `${(e.km / 1.609344).toFixed(1)} mi` : `${e.km} km`}` : ''} · {e.intensity === 'low' ? 'light' : e.intensity === 'medium' ? 'moderate' : 'hard'}{e.manual ? '' : ' · estimate'}</p>
              {e.note && <p className="text-xs text-silver">{e.note}</p>}
            </div>
            {edit?.id === e.id ? (
              <div className="flex items-center gap-1.5">
                <input inputMode="numeric" aria-label="Minutes" className="field !h-10 !w-16 !px-2 text-center" value={edit.minutes} onChange={(x) => setEdit({ ...edit, minutes: x.target.value.replace(/\D/g, '').slice(0, 3) })} />
                <input inputMode="numeric" aria-label="Calories burned" className="field !h-10 !w-20 !px-2 text-center" value={edit.kcal} onChange={(x) => setEdit({ ...edit, kcal: x.target.value.replace(/\D/g, '').slice(0, 4) })} />
                <button className="btn-primary !h-10 !px-3 text-sm" disabled={!Number(edit.minutes)} onClick={() => { update(e.id, { minutes: Number(edit.minutes), kcal: Number(edit.kcal) || 0, manual: true }); setEdit(null); }}>Save</button>
              </div>
            ) : (
              <button onClick={() => setEdit({ id: e.id, minutes: String(e.minutes), kcal: String(Math.round(e.kcal)) })} className="num text-right" aria-label="Edit workout"><span className="block text-lg font-bold text-accent">+{fmt(e.kcal)}</span><span className="text-xs text-silver">kcal · edit</span></button>
            )}
            <button onClick={() => remove(e.id)} className="grid h-9 w-9 place-items-center rounded-full text-dim" aria-label="Delete workout"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** "3 × 8 · 60 kg" or "40 kg · 45 s". */
export function describeDetail(d: NonNullable<import('@/lib/exercise').ExerciseEntry['detail']>, unit: 'kg' | 'lb'): string {
  const w = d.weightKg ? `${fmt(unit === 'lb' ? d.weightKg * 2.20462 : d.weightKg, 1)} ${unit}` : '';
  const sr = d.sets && d.reps ? `${d.sets} × ${d.reps}` : d.reps ? `${d.reps} reps` : d.sets ? `${d.sets} sets` : '';
  return [sr, w, d.seconds ? `${d.seconds} s` : ''].filter(Boolean).join(' · ');
}

/** "I walked 30 minutes and did 40 minutes of weights" → logged. Times are never guessed: missing ones are asked for. */
function SayExercise({ date, kg, onDone }: { date: string; kg: number; onDone: () => void }) {
  const add = useStore((s) => s.addExercise);
  const [text, setText] = useState('');
  const [items, setItems] = useState<SaidExercise[] | null>(null);
  const [listening, setListening] = useState(false);
  const read = (t: string) => { const r = parseExercise(t); setItems(r); if (!r.length) toast('Say what you did and for how long — e.g. “walked 30 minutes”.'); };
  function mic() {
    if (!SR) { toast('Voice isn’t available in this browser — type it instead.'); return; }
    const r = new SR(); r.lang = navigator.language || 'en-GB'; r.interimResults = true; r.continuous = false;
    let last = '';
    r.onresult = (e) => { last = Array.from(e.results).map((x) => x[0].transcript).join(' '); setText(last); };
    r.onend = () => { setListening(false); if (last) read(last); };
    r.onerror = () => setListening(false);
    setListening(true); haptic();
    try { r.start(); } catch { setListening(false); }
  }
  const ready = !!items?.length && items.every((i) => i.type && i.minutes);
  function save() {
    for (const i of items!) add({ date, type: i.type!, intensity: i.intensity, minutes: i.minutes!, kcal: burnedKcal(i.type!, i.intensity, i.minutes!, kg), manual: false, note: i.text.slice(0, 120), ...(i.km && { km: i.km }) });
    haptic([10, 30, 10]);
    toast(`${items!.length === 1 ? EXERCISES[items![0].type!].label : `${items!.length} activities`} logged`);
    setItems(null); setText(''); onDone();
  }
  const set = (k: number, patch: Partial<SaidExercise>) => setItems((cur) => cur!.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  return (
    <div>
      <p className="mb-2 text-[15px] font-semibold">Just tell us what you did</p>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) read(text); }} className="flex gap-2">
        <input className="field flex-1" placeholder="e.g. walked 30 min, then 45 min of weights" value={text} onChange={(e) => setText(e.target.value)} aria-label="What exercise did you do?" />
        <button type="button" onClick={mic} className={cx('grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-raised', listening && 'animate-pulse bg-primary text-on-primary')} aria-label="Say what you did"><Mic size={19} /></button>
      </form>
      {items && items.length > 0 && (
        <div className="mt-3 space-y-2">
          {items.map((i, k) => (
            <div key={k} className="rounded-2xl bg-raised p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select value={i.type ?? ''} onChange={(e) => set(k, { type: (e.target.value || null) as ExerciseType | null })} className="rounded-xl bg-surface px-2 py-1.5 text-sm font-semibold" aria-label="Activity">
                  {!i.type && <option value="">Which activity?</option>}
                  {(Object.keys(EXERCISES) as ExerciseType[]).map((t) => <option key={t} value={t}>{EXERCISES[t].label}</option>)}
                </select>
                <label className="flex items-center gap-1 text-sm"><input inputMode="numeric" value={i.minutes ?? ''} placeholder="?" onChange={(e) => set(k, { minutes: Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || null })} className="w-14 rounded-xl bg-surface px-2 py-1.5 text-center font-semibold" aria-label="Minutes" /> min</label>
                <select value={i.intensity} onChange={(e) => set(k, { intensity: e.target.value as Intensity })} className="rounded-xl bg-surface px-2 py-1.5 text-sm" aria-label="How hard"><option value="low">Light</option><option value="medium">Moderate</option><option value="high">Hard</option></select>
              </div>
              <p className="mt-1.5 text-xs text-silver">{!i.minutes ? 'How many minutes? We don’t guess.' : !i.type ? 'Pick the activity.' : kg ? `About ${fmt(burnedKcal(i.type, i.intensity, i.minutes, kg))} kcal (estimate)${i.km ? ` · ${fmt(i.km, 1)} km` : ''}` : 'Add your weight in Profile for a calorie estimate.'}</p>
            </div>
          ))}
          <button onClick={save} disabled={!ready} className="btn-primary w-full">Add {items.length === 1 ? 'it' : `all ${items.length}`}</button>
        </div>
      )}
    </div>
  );
}
