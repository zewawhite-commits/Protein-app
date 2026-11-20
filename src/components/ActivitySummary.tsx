import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Dumbbell, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { addDays, todayKey } from '@/lib/dates';
import { sumEntries } from '@/lib/nutrition';
import { EXERCISES } from '@/lib/exercise';
import { cx, fmt } from './ui';
import { toast } from './fx';

/**
 * Workouts in one place: this week at a glance, recent sessions, and how eating differs on
 * workout days vs rest days (last 4 weeks, only days with food logged).
 */
export function ActivitySummary() {
  const exercises = useStore((s) => s.exercises);
  const entries = useStore((s) => s.entries);
  const remove = useStore((s) => s.removeExercise);
  const miles = useStore((s) => s.settings.bodyUnit === 'lb');
  const [all, setAll] = useState(false);
  const today = todayKey();

  const s = useMemo(() => {
    const weekFrom = addDays(today, -6);
    const week = exercises.filter((e) => e.date >= weekFrom && e.date <= today);
    const from = addDays(today, -27);
    const trainDays = new Set(exercises.filter((e) => e.date >= from).map((e) => e.date));
    const byDay = new Map<string, typeof entries>();
    for (const e of entries) if (e.date >= from && e.date <= today && !e.planned) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    const avg = (days: string[]) => {
      if (!days.length) return null;
      const t = days.map((d) => sumEntries(byDay.get(d)!));
      return { days: days.length, kcal: t.reduce((a, x) => a + x.kcal, 0) / days.length, protein: t.reduce((a, x) => a + x.protein, 0) / days.length, carbs: t.reduce((a, x) => a + x.carbs, 0) / days.length };
    };
    const logged = [...byDay.keys()];
    return {
      count: week.length,
      minutes: week.reduce((a, e) => a + e.minutes, 0),
      km: week.reduce((a, e) => a + (e.km ?? 0), 0),
      kcal: week.reduce((a, e) => a + e.kcal, 0),
      active: avg(logged.filter((d) => trainDays.has(d))),
      rest: avg(logged.filter((d) => !trainDays.has(d))),
    };
  }, [exercises, entries, today]);

  const recent = [...exercises].sort((a, b) => b.date.localeCompare(a.date)).slice(0, all ? 50 : 5);
  const dist = (km: number) => (miles ? `${fmt(km / 1.609344, 1)} mi` : `${fmt(km, 1)} km`);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Dumbbell size={18} className="text-accent" /> Activity</h2>
        <Link to="/routines" className="chip !h-9">My routines</Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-raised py-3"><p className="num text-[20px] font-extrabold">{s.count}</p><p className="text-xs text-silver">workouts this week</p></div>
        <div className="rounded-2xl bg-raised py-3"><p className="num text-[20px] font-extrabold">{s.minutes}</p><p className="text-xs text-silver">minutes</p></div>
        <div className="rounded-2xl bg-raised py-3"><p className="num text-[20px] font-extrabold">{s.km ? dist(s.km) : `~${fmt(s.kcal)}`}</p><p className="text-xs text-silver">{s.km ? 'distance' : 'kcal (estimate)'}</p></div>
      </div>

      {s.active && s.rest && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Workout days vs rest days <span className="font-normal text-silver">(4 weeks, average)</span></p>
          <div className="mt-2 overflow-hidden rounded-2xl border border-line text-sm">
            {[['', 'Workout days', 'Rest days'], ['Calories', `${fmt(s.active.kcal)}`, `${fmt(s.rest.kcal)}`], ['Protein', `${fmt(s.active.protein)} g`, `${fmt(s.rest.protein)} g`], ['Carbs', `${fmt(s.active.carbs)} g`, `${fmt(s.rest.carbs)} g`], ['Days', `${s.active.days}`, `${s.rest.days}`]].map((r, i) => (
              <div key={i} className={cx('grid grid-cols-3 px-3 py-2', i === 0 ? 'bg-raised text-xs font-semibold text-silver' : 'border-t border-line')}>
                <span className={i ? 'text-silver' : ''}>{r[0]}</span><span className="num text-right font-semibold">{r[1]}</span><span className="num text-right font-semibold">{r[2]}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-dim">Only days with food logged are counted, so missing days don’t look like zero.</p>
        </div>
      )}

      {recent.length > 0 ? (
        <ul className="mt-4 divide-y divide-line">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{e.detail?.name ?? EXERCISES[e.type].label}</span>
                <span className="block text-xs text-silver">{new Date(`${e.date}T12:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {e.minutes} min{e.km ? ` · ${dist(e.km)}` : ''}{e.note ? ` · ${e.note}` : ''}</span>
              </span>
              <button onClick={() => { if (confirm('Delete this workout?')) { remove(e.id); toast('Workout deleted'); } }} className="grid h-9 w-9 place-items-center rounded-full text-dim" aria-label="Delete workout"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-dim">No workouts yet. Log one from the + button.</p>}
      {exercises.length > 5 && <button onClick={() => setAll((v) => !v)} className="mt-2 text-sm font-semibold text-accent">{all ? 'Show less' : 'Show all'}</button>}
    </section>
  );
}
