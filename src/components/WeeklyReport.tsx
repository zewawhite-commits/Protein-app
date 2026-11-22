import { useMemo } from 'react';
import { useStore, goalOn } from '@/store/useStore';
import { todayKey, formatDay } from '@/lib/dates';
import { dailyTargets } from '@/lib/energy';
import { weeklyReport } from '@/lib/weekly';
import { splitName } from '@/lib/foods';
import { fmt } from './ui';

/** Plus: last week (Monday–Sunday) in one card, from the person's own log. */
export function WeeklyReport() {
  const entries = useStore((s) => s.entries);
  const weights = useStore((s) => s.weights);
  const exercises = useStore((s) => s.exercises);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  const unit = useStore((s) => s.settings.bodyUnit);
  const r = useMemo(() => {
    const today = todayKey();
    const pg = goalOn(today, goalHistory, profile);
    return weeklyReport({ entries, weights, workoutDates: exercises.map((e) => e.date), today, proteinGoal: (d) => goalOn(d, goalHistory, profile), kcalTarget: profile ? dailyTargets(profile, pg)?.kcal ?? null : null });
  }, [entries, weights, exercises, goalHistory, profile]);
  const range = `${formatDay(r.from)} – ${formatDay(r.to)}`;
  const kg = (v: number) => (unit === 'lb' ? v * 2.20462 : v);
  const delta = (now: number, before?: number) => (before == null ? null : Math.round(now - before));
  if (r.daysLogged === 0) {
    return (
      <section className="card p-5" aria-label="Weekly report">
        <p className="text-[17px] font-bold">Your weekly report</p>
        <p className="mt-1 text-sm text-silver">Nothing was logged last week ({range}). Log a few days this week and your report will be here next Monday.</p>
      </section>
    );
  }
  const dp = delta(r.protein, r.previous?.protein);
  const dk = delta(r.kcal, r.previous?.kcal);
  return (
    <section className="card p-5" aria-label="Weekly report">
      <div className="flex items-baseline justify-between gap-2"><p className="text-[17px] font-bold">Your weekly report</p><p className="text-xs text-silver">{range}</p></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-raised py-3"><p className="num text-[19px] font-extrabold">{r.daysLogged}/7</p><p className="text-xs text-silver">days logged</p></div>
        <div className="rounded-2xl bg-raised py-3"><p className="num text-[19px] font-extrabold">{fmt(r.kcal)}</p><p className="text-xs text-silver">avg kcal{r.kcalTarget ? ` · target ${fmt(r.kcalTarget)}` : ''}</p></div>
        <div className="rounded-2xl bg-raised py-3"><p className="num text-[19px] font-extrabold">{fmt(r.protein)}g</p><p className="text-xs text-silver">avg protein · target {fmt(r.proteinTarget)}g</p></div>
      </div>
      <ul className="mt-3 space-y-1.5 text-[14px]">
        <li>Protein target met on <b>{r.proteinDaysHit}</b> of {r.daysLogged} logged day{r.daysLogged === 1 ? '' : 's'}.</li>
        {r.previous && <li>Compared with the week before: protein {dp! >= 0 ? '+' : ''}{dp} g, calories {dk! >= 0 ? '+' : ''}{dk} kcal a day.</li>}
        {r.weight && <li>Weight {fmt(kg(r.weight.start), 1)} → {fmt(kg(r.weight.end), 1)} {unit} ({r.weight.end - r.weight.start >= 0 ? '+' : ''}{fmt(kg(r.weight.end - r.weight.start), 1)}).</li>}
        <li>{r.workouts ? `Workouts on ${r.workouts} day${r.workouts === 1 ? '' : 's'}.` : 'No workouts logged.'}</li>
        {r.topProtein.length > 0 && <li>Most protein from: {r.topProtein.map((f) => splitName(f.name).title.toLowerCase()).join(', ')}.</li>}
        {r.gaps.length > 0 && <li>Often short of: {r.gaps.map((g) => `${g.label.toLowerCase()} (${g.pct}% of daily value)`).join(', ')}.</li>}
      </ul>
      <p className="mt-3 text-xs text-dim">Averages use only the days you logged food. General wellness information, not medical advice.</p>
    </section>
  );
}
