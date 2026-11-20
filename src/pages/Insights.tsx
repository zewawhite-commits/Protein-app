import { EverythingElse } from './History';
import { MEAL_LABELS, MEAL_ORDER } from '@/lib/meals';
import { Link } from 'react-router-dom';
import { ActivitySummary } from '@/components/ActivitySummary';
import { WeightHistory } from '@/components/WeightHistory';
import { Measurements } from '@/components/Measurements';
import { ProOnly } from '@/components/ProOnly';
import { EatingPatterns, NutrientGaps, TargetCheck } from '@/components/NutritionInsights';
import { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useStore, goalOn } from '@/store/useStore';
import { lastNDays, todayKey, fromKey, formatDay } from '@/lib/dates';
import { nutrientsFor } from '@/lib/nutrition';
import { dailyTargets } from '@/lib/energy';
import { splitName } from '@/lib/foods';
import type { Meal } from '@/lib/types';
import { PageHeader, Segmented, cx, fmt } from '@/components/ui';
import { FoodVisual } from '@/components/FoodIcon';
import { useStreak } from './Today';
import { AverageCalories, WeightAndStreak, WeightChart, BeyondTheScale, SmartTarget } from '@/components/ProgressTop';
import { ProgressPhotos } from '@/components/ProgressPhotos';

type Range = '7' | '30' | '90';
type Metric = 'kcal' | 'protein' | 'carbs' | 'fat';
const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: 'kcal', label: 'Calories', unit: 'kcal' },
  { value: 'protein', label: 'Protein', unit: 'g' },
  { value: 'carbs', label: 'Carbs', unit: 'g' },
  { value: 'fat', label: 'Fat', unit: 'g' },
];

export default function Insights() {
  const [range, setRange] = useState<Range>('7');
  const [metric, setMetric] = useState<Metric>('kcal');
  const unit = METRICS.find((m) => m.value === metric)!.unit;
  const label = METRICS.find((m) => m.value === metric)!.label;
  const entries = useStore((s) => s.entries);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  const streak = useStreak();

  const data = useMemo(() => {
    const days = lastNDays(todayKey(), Number(range));
    const set = new Set(days);
    const inRange = entries.filter((e) => set.has(e.date));
    const perDay = new Map<string, number>();
    const perFood = new Map<string, { name: string; protein: number; count: number }>();
    const perMeal = Object.fromEntries(MEAL_ORDER.map((m) => [m, 0])) as Record<Meal, number>;
    for (const e of inRange) {
      const p = e.planned ? 0 : nutrientsFor(e.food.per100, e.grams)[metric] ?? 0;
      perDay.set(e.date, (perDay.get(e.date) ?? 0) + p);
      perMeal[e.meal] += p;
      const f = perFood.get(e.foodId) ?? { name: e.food.name, protein: 0, count: 0 };
      f.protein += p;
      f.count++;
      perFood.set(e.foodId, f);
    }
    const goalFor = (d: string) => {
      const pg = goalOn(d, goalHistory, profile);
      if (metric === 'protein') return pg;
      const t = profile ? dailyTargets(profile, pg) : null;
      return t ? t[metric] : 0;
    };
    const loggedDates = new Set(inRange.map((e) => e.date));
    const series = days.map((d) => ({ date: d, protein: perDay.get(d) ?? 0, goal: goalFor(d) }));
    const logged = series.filter((s) => loggedDates.has(s.date));
    const total = logged.reduce((a, s) => a + s.protein, 0);
    return {
      series,
      loggedDays: logged.length,
      avg: logged.length ? total / logged.length : 0,
      hit: logged.filter((s) => s.goal > 0 && s.protein >= s.goal).length,
      within: logged.filter((s) => s.goal > 0 && Math.abs(s.protein - s.goal) <= s.goal * 0.1).length,
      best: logged.reduce<(typeof series)[number] | null>((b, s) => (!b || s.protein > b.protein ? s : b), null),
      top: [...perFood.values()].sort((a, b) => b.protein - a.protein).slice(0, 5),
      perMeal,
      total,
    };
  }, [entries, goalHistory, profile, range, metric]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Progress" right={<Link to="/reports" className="chip !h-10">Reports</Link>} />

      <div className="mb-6 space-y-4">
        <WeightAndStreak />
        <WeightChart />
        <WeightHistory />
        <ProOnly what="Targets that adjust automatically to your progress"><SmartTarget /></ProOnly>
        <BeyondTheScale />
        <Measurements />
        <ActivitySummary />
        <TargetCheck />
        <ProOnly what="Advanced micronutrient analysis"><NutrientGaps /></ProOnly>
        <ProOnly what="Detailed eating-pattern reports"><EatingPatterns /></ProOnly>
        <ProgressPhotos />
        <AverageCalories />
      </div>

      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xl font-bold">Nutrition trends</h2>
        <Segmented value={range} onChange={setRange} options={[{ value: '7', label: '7D' }, { value: '30', label: '30D' }, { value: '90', label: '90D' }]} />
      </div>
      {/* Calories and macros are separate: one switch for which, then which macro. */}
      <div className="mb-2"><Segmented full value={metric === 'kcal' ? 'kcal' : 'macros'} onChange={(v) => setMetric(v === 'kcal' ? 'kcal' : 'protein')} options={[{ value: 'kcal', label: 'Calories' }, { value: 'macros', label: 'Macros' }]} /></div>
      {metric !== 'kcal' && <div className="mb-4 flex justify-center"><Segmented value={metric} onChange={setMetric} options={METRICS.filter((m) => m.value !== 'kcal').map(({ value, label }) => ({ value, label }))} /></div>}
      {metric === 'kcal' && <div className="mb-4" />}

      {data.loggedDays === 0 ? (
        <section className="card p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Daily {label.toLowerCase()}</h2>
            <span className="text-xs font-semibold text-silver">no food logged yet</span>
          </div>
          <BarChart series={data.series} unit={unit} highlight={false} />
          <p className="mt-3 text-sm text-silver">Your chart fills in as you log food. Days you don’t log stay empty — they’re not counted as zero.</p>
        </section>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Kpi label={`Average ${label.toLowerCase()}`} value={fmt(data.avg)} unit={unit} sub={`over ${data.loggedDays} logged ${data.loggedDays === 1 ? 'day' : 'days'}`} />
            {metric === 'protein' ? (
              <Kpi label="Goal hit" value={`${data.hit}`} unit={`/ ${data.loggedDays}`} sub="logged days at goal" />
            ) : (
              <Kpi label="Within target" value={`${data.within}`} unit={`/ ${data.loggedDays}`} sub={data.series.some((s) => s.goal) ? 'days within ±10%' : 'set a calorie goal in Profile'} />
            )}
            <Kpi label="Protein streak" value={`${streak}`} unit={streak === 1 ? 'day' : 'days'} sub="in a row at goal" />
            <Kpi label="Highest day" value={fmt(data.best?.protein)} unit={unit} sub={data.best ? formatDay(data.best.date, { day: 'numeric', month: 'short' }) : ''} />
          </div>

          <section className="card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Daily {label.toLowerCase()}</h2>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-silver"><span className="inline-block h-0 w-4 border-t-2 border-dashed border-silver" /> goal</span>
            </div>
            <BarChart series={data.series} unit={unit} highlight={metric === 'protein'} />
            <Link to={`/coach?ask=${encodeURIComponent(`My ${label.toLowerCase()} over the last ${range} days: average ${fmt(data.avg)} ${unit} on ${data.loggedDays} logged days${metric === 'protein' ? `, goal hit on ${data.hit}` : `, within target on ${data.within}`}. What does this chart say about me, and what should I change?`)}`} className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent/10 py-3 text-sm font-semibold text-accent"><MessageCircle size={16} /> Ask the coach about this chart</Link>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">By meal</h2>
            <div className="space-y-3">
              {(Object.entries(data.perMeal) as [Meal, number][]).filter(([m, p]) => p > 0 || ['breakfast', 'lunch', 'dinner', 'snack'].includes(m)).map(([meal, p]) => {
                const share = data.total ? p / data.total : 0;
                return (
                  <div key={meal}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-semibold">{MEAL_LABELS[meal]}</span>
                      <span className="tabular-nums">{fmt(share * 100)}% <span className="text-dim">· {fmt(p)} {unit}</span></span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-raised">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">Top sources of {label.toLowerCase()}</h2>
            <ol>
              {data.top.map((f, i) => (
                <li key={f.name + i} className="flex items-center gap-3 py-2.5">
                  <FoodVisual name={f.name} size={40} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{splitName(f.name).title}</span>
                  <span className="text-xs text-dim">{f.count}×</span>
                  <span className="num w-20 text-right font-bold">{fmt(f.protein)} {unit}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
      {/* Everything they've ever logged or saved, kept for every plan — one tap from the graphs. */}
      <EverythingElse title="Your history" onProgress />
    </div>
  );
}

function Kpi({ label, value, unit, sub }: { label: string; value: string; unit: string; sub: string }) {
  return (
    <div className="card p-5">
      <p className="num text-[34px] font-bold leading-none">{value}<span className="ml-0.5 text-sm font-bold text-silver">{unit}</span></p>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="mt-0.5 truncate text-xs font-medium text-silver">{sub}</p>
    </div>
  );
}

function BarChart({ series, unit, highlight }: { series: { date: string; protein: number; goal: number }[]; unit: string; highlight: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((s) => Math.max(s.protein, s.goal))) * 1.1;
  const H = 160;
  const n = series.length;
  const showLabel = (i: number) => n <= 7 || i === 0 || i === n - 1 || (n <= 30 ? i % 7 === 0 : i % 15 === 0);
  const a = active != null ? series[active] : null;
  return (
    <div>
      <p className="num mb-3 h-5 text-sm font-semibold text-silver">
        {a ? <>{formatDay(a.date, { weekday: 'short', day: 'numeric', month: 'short' })} · <span className="font-semibold text-ink">{fmt(a.protein)} {unit}</span>{a.goal ? <> of {fmt(a.goal)} {unit}</> : null}</> : 'Tap a bar for details'}
      </p>
      <div className="relative" style={{ height: H }} onMouseLeave={() => setActive(null)}>
        {/* goal line (stepped per day so goal changes show) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${n} ${H}`}>
          <polyline
            fill="none"
            stroke="rgb(var(--silver))"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            points={series.flatMap((s, i) => [`${i},${H - (s.goal / max) * H}`, `${i + 1},${H - (s.goal / max) * H}`]).join(' ')}
          />
        </svg>
        <div className="absolute inset-0 flex items-end" style={{ gap: n > 30 ? 1 : n > 7 ? 3 : 14 }}>
          {series.map((s, i) => {
            const hit = highlight && s.goal > 0 && s.protein >= s.goal;
            return (
              <button
                key={s.date}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-label={`${s.date}: ${Math.round(s.protein)} ${unit}`}
              >
                <div
                  className={cx('w-full transition-all', hit ? 'bg-accent' : 'bg-ink', active != null && active !== i && 'opacity-30')}
                  style={{ height: `${Math.max(s.protein > 0 ? 2 : 0, (s.protein / max) * 100)}%`, borderRadius: n > 30 ? 3 : n > 7 ? 6 : 12 }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex text-[12px] font-semibold text-dim" style={{ gap: n > 30 ? 1 : n > 7 ? 3 : 14 }}>
        {series.map((s, i) => (
          <span key={s.date} className="flex-1 text-center">
            {showLabel(i) ? (n <= 7 ? fromKey(s.date).toLocaleDateString(undefined, { weekday: 'narrow' }) : fromKey(s.date).getDate()) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
