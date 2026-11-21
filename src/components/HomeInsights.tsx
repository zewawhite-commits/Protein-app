import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { addDays, todayKey } from '@/lib/dates';
import { maintenanceKcal, measuredBurn } from '@/lib/energy';
import { fromKg } from '@/lib/nutrition';
import { fmt } from './ui';

/** A tiny line chart (no axes) for the Home cards. */
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="mt-3 h-8 rounded-full border-t-2 border-dashed border-line" aria-hidden />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [4 + (i * 112) / (values.length - 1), 28 - ((v - min) / span) * 22]);
  return (
    <svg viewBox="0 0 120 32" className="mt-2 h-8 w-full" aria-hidden>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="rgb(var(--surface))" stroke={color} strokeWidth="1.6" />)}
    </svg>
  );
}

/**
 * Two cards under the day's numbers: what you burn (measured from your own food and weight
 * once there's enough data, otherwise the formula estimate, labelled as such) and your weight trend.
 */
export function HomeInsights() {
  const entries = useStore((s) => s.entries);
  const weights = useStore((s) => s.weights);
  const profile = useStore((s) => s.profile);
  const unit = useStore((s) => s.settings.bodyUnit);
  const today = todayKey();
  const burn = useMemo(() => (profile ? measuredBurn(entries, weights, today, maintenanceKcal(profile)) : null), [entries, weights, profile, today]);
  const formula = profile ? maintenanceKcal(profile) : null;
  // Burn measured over a sliding window, a point per week, for the trend line.
  const burnLine = useMemo(() => {
    if (!profile || !burn) return [];
    return [21, 14, 7, 0].map((d) => measuredBurn(entries, weights, addDays(today, -d), maintenanceKcal(profile))?.kcal).filter((v): v is number => v != null);
  }, [entries, weights, profile, today, burn]);
  const recent = useMemo(() => weights.filter((w) => w.date > addDays(today, -30)).sort((a, b) => a.date.localeCompare(b.date)), [weights, today]);
  const change = recent.length >= 2 ? recent[recent.length - 1].kg - recent[0].kg : null;
  if (!profile) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3" aria-label="Insights">
      <Link to="/insights" className="card block p-4">
        <p className="text-[15px] font-bold">Expenditure</p>
        <p className="text-[12px] text-silver">{burn ? `Last ${burn.days} days` : 'Estimate'}</p>
        <p className="num mt-1 text-[20px] font-extrabold leading-tight">{burn ? fmt(burn.kcal) : formula ? fmt(formula) : '–'}<span className="ml-1 text-[12px] font-semibold text-silver">kcal/day</span></p>
        {burn ? <Spark values={burnLine.length >= 2 ? burnLine : [burn.kcal, burn.kcal]} color="rgb(var(--fat))" /> : <p className="mt-1 text-[12px] leading-snug text-dim">From your details. Log food and weigh in for 2 weeks to measure it.</p>}
      </Link>
      <Link to="/insights" className="card block p-4">
        <p className="text-[15px] font-bold">Weight trend</p>
        <p className="text-[12px] text-silver">Last 30 days</p>
        <p className="num mt-1 text-[20px] font-extrabold leading-tight">{recent.length ? fmt(fromKg(recent[recent.length - 1].kg, unit), 1) : '–'}<span className="ml-1 text-[12px] font-semibold text-silver">{unit}</span></p>
        {recent.length >= 2
          ? <><Spark values={recent.map((w) => w.kg)} color="#7C6BD6" /><p className="num text-[12px] text-silver">{change! > 0 ? '+' : ''}{fmt(fromKg(change!, unit), 1)} {unit}</p></>
          : <p className="mt-1 text-[12px] leading-snug text-dim">{recent.length ? 'Weigh in again to see your trend.' : 'Log your weight to see a trend.'}</p>}
      </Link>
    </div>
  );
}
