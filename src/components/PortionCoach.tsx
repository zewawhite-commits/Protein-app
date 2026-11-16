import { useState } from 'react';
import { Check, Scale } from 'lucide-react';
import type { PortionKind, PortionPlan, PortionRow } from '@/lib/portion';
import { cx, fmt } from './ui';

const SHADES: Record<PortionKind, string[]> = {
  protein: ['#E07A5F', '#C9604A', '#EE9C82'],
  dense: ['#E9B949', '#D49A2A', '#F2D27E'],
  veg: ['#4FB477', '#2E9A5C', '#86D3A2'],
};
const KIND_LABEL: Record<PortionKind, string> = { protein: 'Protein', dense: 'Carbs & fats', veg: 'Veg' };

function colors(rows: PortionRow[]) {
  const seen: Record<PortionKind, number> = { protein: 0, dense: 0, veg: 0 };
  return new Map(rows.map((r) => [r.index, SHADES[r.kind][seen[r.kind]++ % 3]]));
}

/** A plate drawn to scale: each food's slice is its share of the weight, plate size follows the total. */
function Plate({ rows, field, scale, color, label, kcal }: { rows: PortionRow[]; field: 'from' | 'to'; scale: number; color: Map<number, string>; label: string; kcal: number }) {
  const total = rows.reduce((a, r) => a + r[field], 0) || 1;
  const R = 46 * scale;
  let a0 = -Math.PI / 2;
  const slices = rows.filter((r) => r[field] > 0).map((r) => {
    const a1 = a0 + (r[field] / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number) => `${60 + R * Math.cos(a)} ${60 + R * Math.sin(a)}`;
    const d = rows.filter((x) => x[field] > 0).length === 1 ? `M ${60 - R} 60 a ${R} ${R} 0 1 0 ${R * 2} 0 a ${R} ${R} 0 1 0 ${-R * 2} 0` : `M60 60 L ${p(a0)} A ${R} ${R} 0 ${large} 1 ${p(a1)} Z`;
    a0 = a1;
    return <path key={r.index} d={d} fill={color.get(r.index)} style={{ stroke: 'rgb(var(--surface))' }} strokeWidth={1.5} />;
  });
  return (
    <figure className="flex flex-1 flex-col items-center">
      <svg viewBox="0 0 120 120" className="h-32 w-32" role="img" aria-label={`${label} plate`}>
        <circle cx="60" cy="60" r="58" style={{ fill: 'rgb(var(--raised))' }} />
        <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={2} />
        {slices}
      </svg>
      <figcaption className="mt-1 text-center">
        <p className="text-[13px] font-semibold text-silver">{label}</p>
        <p className="num text-[16px] font-extrabold">{fmt(kcal)} kcal</p>
      </figcaption>
    </figure>
  );
}

export function PortionCoach({ plan, onApply, applied }: { plan: PortionPlan; onApply: (rows: PortionRow[]) => void; applied: boolean }) {
  const [open, setOpen] = useState(true);
  const color = colors(plan.rows);
  const fromG = plan.rows.reduce((a, r) => a + r.from, 0);
  const toG = plan.rows.reduce((a, r) => a + r.to, 0);
  const big = Math.max(fromG, toG) || 1;
  const keep = plan.direction === 'keep';
  const max = Math.max(...plan.rows.map((r) => Math.max(r.from, r.to)), 1);
  const tone = keep ? 'text-accent' : plan.direction === 'less' ? 'text-[#C9873A]' : 'text-accent';

  return (
    <section className="card mt-4 p-5" aria-label="Visual Portion Coach">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 text-accent"><Scale size={18} /></span>
          <span>
            <span className="block text-[12px] font-semibold uppercase tracking-wide text-silver">Portion coach</span>
            <span className={cx('block text-[16px] font-bold', tone)}>{plan.headline}</span>
          </span>
        </span>
        <span className="text-[13px] font-semibold text-silver">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed">{plan.message}</p>

          {!keep && (
            <div className="mt-4 flex items-end gap-2">
              <Plate rows={plan.rows} field="from" scale={Math.sqrt(fromG / big)} color={color} label="Your plate" kcal={plan.before.kcal} />
              <span className="mb-14 text-xl text-silver" aria-hidden>→</span>
              <Plate rows={plan.rows} field="to" scale={Math.sqrt(toG / big)} color={color} label="Suggested" kcal={plan.after.kcal} />
            </div>
          )}

          <ul className="mt-4 space-y-2.5">
            {plan.rows.map((r) => (
              <li key={r.index}>
                <div className="flex items-center justify-between gap-2 text-[14px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color.get(r.index) }} />
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="shrink-0 text-[12px] text-dim">{KIND_LABEL[r.kind]}</span>
                  </span>
                  <span className="num shrink-0 font-semibold">
                    {r.to === r.from ? `${r.from} g` : <>{r.from} g <span className="text-silver">→</span> <span className={r.to > r.from ? 'text-accent' : 'text-[#C9873A]'}>{r.to} g</span></>}
                  </span>
                </div>
                <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                  <div className="absolute inset-y-0 left-0 rounded-full opacity-35" style={{ width: `${(r.from / max) * 100}%`, background: color.get(r.index) }} />
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.to / max) * 100}%`, background: color.get(r.index) }} />
                </div>
              </li>
            ))}
          </ul>

          {!keep && (
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {([['Calories', 'kcal', ''], ['Protein', 'protein', 'g'], ['Carbs', 'carbs', 'g'], ['Fat', 'fat', 'g']] as const).map(([l, k, u]) => {
                const d = plan.after[k] - plan.before[k];
                return (
                  <div key={l} className="rounded-2xl bg-raised py-2.5">
                    <p className="num text-[16px] font-extrabold">{fmt(plan.after[k])}{u}</p>
                    <p className="text-[11px] text-silver">{l} {Math.abs(d) >= 1 && <span className="num">({d > 0 ? '+' : '−'}{fmt(Math.abs(d))})</span>}</p>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-dim">
            Based on what’s left of your day: about {fmt(plan.budget.kcal)} kcal{plan.budget.protein ? ` and ${fmt(plan.budget.protein)} g protein` : ''} fits this meal. The plates are an illustration drawn to scale by weight, not an edited photo. General guidance, not medical advice.
          </p>

          {!keep && (
            <button onClick={() => onApply(plan.rows)} disabled={applied} className={cx('mt-4 w-full', applied ? 'btn-ghost !text-accent' : 'btn-ghost')}>
              {applied ? <><Check size={16} strokeWidth={3} /> Suggested portions set below</> : 'Use suggested portions'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
