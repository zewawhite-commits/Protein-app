import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, TriangleAlert } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { todayKey } from '@/lib/dates';
import { dailyGoal } from '@/lib/nutrition';
import { dailyTargets, targetWarnings } from '@/lib/energy';
import { eatingPatterns, foodsRichIn, nutrientGaps } from '@/lib/insights';
import { fitsDiet } from '@/lib/goals';
import { foodAllergens } from '@/lib/allergens';
import { splitName } from '@/lib/foods';
import { useAvoid } from './Allergy';
import { fmt } from './ui';

/** Nutrients you're often short on this week, with everyday foods that help. */
export function NutrientGaps() {
  const entries = useStore((s) => s.entries);
  const diet = useStore((s) => s.profile?.diet ?? 'all');
  const avoid = useAvoid();
  const { db } = useFoodDb();
  const { gaps, loggedDays } = useMemo(() => nutrientGaps(entries, todayKey()), [entries]);
  const pool = useMemo(() => (db ? [...db.quickPicks, ...db.foods.filter((f) => f.source === 'recipe')].filter((f) => fitsDiet(f, diet) && !foodAllergens(f, avoid).length) : []), [db, diet, avoid]);
  if (loggedDays < 3) return null;
  return (
    <section className="card mt-4 p-5" aria-label="Nutrient gaps">
      <p className="text-[17px] font-bold">Nutrients to watch</p>
      {gaps.length === 0 ? (
        <p className="mt-1 text-[14px] text-silver">Over your last {loggedDays} logged days you averaged at least 70% of the daily value for fibre, vitamins and minerals. Nice balance.</p>
      ) : (
        <>
          <p className="mt-1 text-[14px] text-silver">Average over your last {loggedDays} logged days, compared with the daily value.</p>
          <ul className="mt-3 space-y-3">
            {gaps.map((g) => {
              const foods = foodsRichIn(g.key, pool);
              return (
                <li key={g.key} className="rounded-2xl bg-raised p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold">{g.label}</p>
                    <p className="num text-[14px] text-silver">{fmt(g.avg, g.avg < 10 ? 1 : 0)} of {fmt(g.dv)} {g.unit} · {g.pct}%</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, g.pct)}%` }} /></div>
                  {foods.length > 0 && (
                    <p className="mt-2 text-[13px] text-silver">Good sources you could add: {foods.map((f, i) => <span key={f.id}>{i > 0 && ', '}<Link to={`/add?q=${encodeURIComponent(splitName(f.name).title)}`} className="font-semibold text-accent">{splitName(f.name).title.split(',')[0]}</Link></span>)}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-dim">Some foods don’t list every nutrient, so real intake can be higher. General information, not medical advice — if you think you’re deficient, talk to a doctor before taking supplements.</p>
    </section>
  );
}

/** Habits from the last two weeks, in plain words. */
export function EatingPatterns() {
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const goal = profile ? dailyGoal(profile) : 0;
  const items = useMemo(() => eatingPatterns(entries, todayKey(), goal, profile), [entries, goal, profile]);
  if (!items.length) return null;
  return (
    <section className="card mt-4 p-5" aria-label="Your patterns">
      <p className="text-[17px] font-bold">Your patterns</p>
      <p className="mt-1 text-[14px] text-silver">From your last two weeks of logging.</p>
      <ul className="mt-3 space-y-3">
        {items.map((p) => (
          <li key={p.title} className="flex gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Lightbulb size={16} /></span>
            <div><p className="font-semibold leading-snug">{p.title}</p><p className="text-[14px] leading-relaxed text-silver">{p.body}</p></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Flags a target that looks unusual for this person, and explains why. */
export function TargetCheck() {
  const profile = useStore((s) => s.profile);
  const warnings = useMemo(() => {
    if (!profile) return [];
    const goal = dailyGoal(profile);
    return targetWarnings(profile, goal, dailyTargets(profile, goal)?.kcal);
  }, [profile]);
  if (!warnings.length) return null;
  return (
    <section role="note" className="mt-4 rounded-[22px] bg-warn/10 p-4 text-ink">
      <p className="flex items-center gap-2 font-semibold text-warn"><TriangleAlert size={17} /> Check your targets</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[14px] leading-relaxed">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      <Link to="/profile?edit=1" className="mt-2 inline-block text-[14px] font-semibold text-accent">Edit targets</Link>
    </section>
  );
}
