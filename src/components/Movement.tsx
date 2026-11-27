import { useEffect, useMemo, useState } from 'react';
import { Flame, Footprints, Route, Target, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { DEFAULT_MOVE_GOAL, DEFAULT_STEP_GOAL, dayActivity, kmFromSteps } from '@/lib/activity';
import { activityName } from '@/lib/exercise';
import { addDays, fromKey } from '@/lib/dates';
import { ExerciseSheet } from './LogMenu';
import { haptic, toast } from './fx';
import { Sheet, cx, fmt } from './ui';

const NO_STEPS = {} as Record<string, never>;
const useKg = () => useStore((s) => (s.weights.length ? s.weights[s.weights.length - 1].kg : s.profile?.bodyWeightKg ?? 70));

/** Activity & Movement on Home: steps, distance, active calories and the movement goal. Food stays separate. */
export function MovementCard({ date }: { date: string }) {
  const day = useStore((s) => s.steps?.[date]);
  const exercises = useStore((s) => s.exercises);
  const stepGoal = useStore((s) => s.settings.stepGoal) ?? DEFAULT_STEP_GOAL;
  const moveGoal = useStore((s) => s.settings.moveGoalKcal) ?? DEFAULT_MOVE_GOAL;
  const miles = useStore((s) => s.settings.bodyUnit === 'lb');
  const kg = useKg();
  const a = useMemo(() => dayActivity(date, day, exercises, kg), [date, day, exercises, kg]);
  const [steps, setStepsOpen] = useState(false);
  const [ex, setEx] = useState(false);
  const dist = miles ? `${fmt(a.km / 1.609344, 2)} mi` : `${fmt(a.km, 2)} km`;
  const tiles = [
    { icon: Footprints, value: a.steps != null ? fmt(a.steps) : '—', label: 'Steps', pct: a.steps != null ? a.steps / stepGoal : 0, onClick: () => setStepsOpen(true) },
    { icon: Route, value: a.km ? dist : '—', label: 'Distance', onClick: () => setStepsOpen(true) },
    { icon: Flame, value: a.activeKcal ? `${a.estimated ? '~' : ''}${fmt(a.activeKcal)} kcal` : '—', label: a.estimated && a.activeKcal ? 'Active calories (est.)' : 'Active calories', pct: a.activeKcal / moveGoal, onClick: () => setEx(true) },
    { icon: Target, value: `${fmt(moveGoal)} kcal`, label: a.activeKcal >= moveGoal ? 'Movement goal met' : 'Daily movement goal', onClick: () => setStepsOpen(true) },
  ];
  return (
    <section className="card mt-4 p-5" aria-label="Activity and movement">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Activity & movement</p>
        <button onClick={() => { haptic(); setEx(true); }} className="chip !h-9 !px-3.5 text-[14px]">+ Activity</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <button key={t.label} onClick={() => { haptic(); t.onClick(); }} className="rounded-2xl bg-raised p-3.5 text-left transition active:scale-[.98]">
            <t.icon size={18} className="text-silver" />
            <p className="num mt-2 text-[20px] font-extrabold leading-tight">{t.value}</p>
            <p className="text-[12px] text-silver">{t.label}</p>
            {t.pct != null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, t.pct * 100)}%` }} /></div>}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-dim">Active calories are movement only, not everything you burn in a day. They’re not taken off your food budget unless you turn that on.</p>
      <StepsSheet date={date} open={steps} onClose={() => setStepsOpen(false)} />
      <ExerciseSheet open={ex} onClose={() => setEx(false)} date={date} />
    </section>
  );
}

export function StepsSheet({ date, open, onClose }: { date: string; open: boolean; onClose: () => void }) {
  const day = useStore((s) => s.steps?.[date]);
  const save = useStore((s) => s.setSteps);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const miles = settings.bodyUnit === 'lb';
  const [steps, setSteps] = useState('');
  const [dist, setDist] = useState('');
  const [kcal, setKcal] = useState('');
  const [goal, setGoal] = useState('');
  const [move, setMove] = useState('');
  useEffect(() => {
    if (!open) return;
    setSteps(day ? String(day.steps) : ''); setKcal(day?.activeKcal != null ? String(day.activeKcal) : '');
    setDist(day?.km != null ? String(miles ? +(day.km / 1.609344).toFixed(2) : day.km) : '');
    setGoal(String(settings.stepGoal ?? DEFAULT_STEP_GOAL)); setMove(String(settings.moveGoalKcal ?? DEFAULT_MOVE_GOAL));
  }, [open, day, miles, settings.stepGoal, settings.moveGoalKcal]);
  const n = Number(steps);
  const d = Number(dist.replace(',', '.'));
  const submit = () => {
    if (!(n >= 0) || n > 150000) { toast('Enter a step count up to 150,000'); return; }
    const km = d > 0 ? Math.round((miles ? d * 1.609344 : d) * 100) / 100 : undefined;
    const k = Number(kcal);
    save(date, { steps: Math.round(n), ...(km ? { km } : {}), ...(kcal && k >= 0 ? { activeKcal: Math.round(k) } : {}), source: 'manual' });
    const g = Number(goal), m = Number(move);
    if (g > 0 && g !== settings.stepGoal) update({ stepGoal: Math.round(g) });
    if (m > 0 && m !== settings.moveGoalKcal) update({ moveGoalKcal: Math.round(m) });
    haptic(15); toast(`Saved ${fmt(n)} steps`); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Steps & movement">
      <label className="block"><span className="label">Steps</span><input autoFocus inputMode="numeric" className="field text-xl font-bold" value={steps} onChange={(e) => setSteps(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 8500" /></label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block"><span className="label">Distance ({miles ? 'mi' : 'km'})</span><input inputMode="decimal" className="field" value={dist} onChange={(e) => setDist(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} placeholder={n ? String(miles ? +(kmFromSteps(n) / 1.609344).toFixed(2) : kmFromSteps(n)) : 'optional'} /></label>
        <label className="block"><span className="label">Active kcal</span><input inputMode="numeric" className="field" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="from your watch" /></label>
      </div>
      <p className="mt-2 text-xs text-dim">Leave distance and active calories empty and we’ll estimate them from your steps and weight, marked as estimates.</p>
      <p className="label mt-5">Daily goals</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-xs text-silver">Steps goal</span><input inputMode="numeric" className="field mt-1" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        <label className="block"><span className="text-xs text-silver">Movement goal (kcal)</span><input inputMode="numeric" className="field mt-1" value={move} onChange={(e) => setMove(e.target.value.replace(/\D/g, '').slice(0, 5))} /></label>
      </div>
      <button onClick={submit} disabled={!steps} className="btn-primary mt-5 w-full">Save</button>
      {day && <button onClick={() => { save(date, null); toast('Steps removed'); onClose(); }} className="btn-ghost mt-2 w-full"><Trash2 size={15} /> Remove this day’s steps</button>}
      <p className="mt-4 rounded-2xl bg-raised px-4 py-3 text-[13px] leading-relaxed text-silver">Automatic syncing with Apple Health and Google Health Connect comes with the Nutivili phone apps. A web browser can’t read those, so on the web you enter steps here.</p>
    </Sheet>
  );
}

/** Seven days of movement for Progress: steps bars, plus the week's sessions. */
export function MovementWeek({ end }: { end: string }) {
  const stepsAll = useStore((s) => s.steps) ?? NO_STEPS;
  const exercises = useStore((s) => s.exercises);
  const remove = useStore((s) => s.removeExercise);
  const goal = useStore((s) => s.settings.stepGoal) ?? DEFAULT_STEP_GOAL;
  const kg = useKg();
  const days = Array.from({ length: 7 }, (_, i) => addDays(end, i - 6));
  const rows = days.map((d) => ({ d, a: dayActivity(d, stepsAll[d], exercises, kg) }));
  const max = Math.max(goal, ...rows.map((r) => r.a.steps ?? 0));
  const total = rows.reduce((t, r) => ({ steps: t.steps + (r.a.steps ?? 0), kcal: t.kcal + r.a.activeKcal, min: t.min + r.a.minutes }), { steps: 0, kcal: 0, min: 0 });
  const week = exercises.filter((e) => e.date >= days[0] && e.date <= end).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="card mt-4 p-5" aria-label="Movement this week">
      <p className="text-lg font-bold">Movement · last 7 days</p>
      <div className="mt-4 flex h-32 items-end gap-2">
        {rows.map(({ d, a }) => (
          <div key={d} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="relative w-full flex-1 rounded-xl bg-raised">
              <div className={cx('absolute inset-x-0 bottom-0 rounded-xl', (a.steps ?? 0) >= goal ? 'bg-primary' : 'bg-primary/55')} style={{ height: `${((a.steps ?? 0) / max) * 100}%` }} title={`${fmt(a.steps ?? 0)} steps`} />
            </div>
            <span className="text-[11px] text-silver">{fromKey(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-raised py-2.5"><p className="num text-[17px] font-extrabold">{fmt(total.steps)}</p><p className="text-[11px] text-silver">steps</p></div>
        <div className="rounded-2xl bg-raised py-2.5"><p className="num text-[17px] font-extrabold">{fmt(total.min)}</p><p className="text-[11px] text-silver">active minutes</p></div>
        <div className="rounded-2xl bg-raised py-2.5"><p className="num text-[17px] font-extrabold">~{fmt(total.kcal)}</p><p className="text-[11px] text-silver">active kcal</p></div>
      </div>
      {week.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {week.slice(0, 8).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2.5 text-[14px]">
              <span className="min-w-0 truncate"><span className="font-semibold">{activityName(e)}</span> <span className="text-silver">· {fromKey(e.date).toLocaleDateString(undefined, { weekday: 'short' })} · {e.minutes} min{e.km ? ` · ${fmt(e.km, 1)} km` : ''}</span></span>
              <button onClick={() => { remove(e.id); toast('Activity removed'); }} className="grid h-8 w-8 shrink-0 place-items-center text-silver" aria-label={`Delete ${activityName(e)}`}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
