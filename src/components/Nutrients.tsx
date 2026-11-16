import { EXTRA_KEYS, NUTRIENTS, type ExtraKey } from '@/lib/nutrients';
import { cx, fmt } from './ui';

export const MACRO_COLOR = { protein: 'bg-accent', carbs: 'bg-[rgb(var(--carbs))]', fat: 'bg-[rgb(var(--fat))]', fiber: 'bg-silver' } as const;

/** One macro with an optional target: "82 / 140 g" and a progress bar. */
export function MacroBar({ label, value, target, color, incomplete }: { label: string; value: number; target?: number; color: keyof typeof MACRO_COLOR; incomplete?: boolean }) {
  const pct = target ? value / target : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold">
          <span className={cx('h-2 w-2 rounded-full', MACRO_COLOR[color])} /> {label}
        </span>
        <span className="num text-[14px]">
          <b>{fmt(value)}{incomplete && <span title="Some foods have no value for this in the source data">*</span>}</b>
          <span className="text-silver">{target ? ` / ${fmt(target)} g` : ' g'}</span>
        </span>
      </div>
      <div className="track-3d mt-1.5 h-2.5 overflow-hidden rounded-full bg-raised">
        <div className={cx('bar-3d h-full rounded-full transition-all duration-700', MACRO_COLOR[color])} style={{ width: `${Math.min(100, (target ? pct : 0) * 100)}%` }} />
      </div>
    </div>
  );
}

const fmtAmount = (v: number, unit: string) => `${v < 10 && v > 0 ? fmt(v, 1) : fmt(v)} ${unit}`;

/**
 * Sugars, fats, minerals and vitamins with % of the FDA daily value.
 * `values` are absolute amounts (already scaled to the portion or the day).
 */
export function NutrientList({ values, incomplete, keys = EXTRA_KEYS as readonly ExtraKey[], compact }: {
  values: Partial<Record<ExtraKey, number | null>>;
  incomplete?: Partial<Record<ExtraKey, boolean>>;
  keys?: readonly ExtraKey[];
  compact?: boolean;
}) {
  return (
    <ul className={cx('divide-y divide-line', compact && 'text-[14px]')}>
      {keys.map((k) => {
        const info = NUTRIENTS[k];
        const v = values[k];
        const pct = v != null && info.dv ? v / info.dv : null;
        const over = info.limit && pct != null && pct > 1;
        return (
          <li key={k} className="py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{info.label}{info.limit && <span className="ml-1 text-[12px] text-dim">limit</span>}</span>
              <span className="num">
                {v == null ? <span className="text-dim">no data</span> : <b>{fmtAmount(v, info.unit)}{incomplete?.[k] && '*'}</b>}
                {pct != null && <span className={cx('ml-2 inline-block w-11 text-right text-xs', over ? 'font-semibold text-warn' : 'text-silver')}>{fmt(pct * 100)}%</span>}
              </span>
            </div>
            {pct != null && (
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-raised">
                <div className={cx('h-full rounded-full', over ? 'bg-warn' : info.limit ? 'bg-silver' : 'bg-accent')} style={{ width: `${Math.min(100, pct * 100)}%` }} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export const DV_NOTE = '% of the daily value (US FDA reference for adults). * Some foods have no value in the source data, so the real total may be higher.';
