import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { PrepState } from '@/lib/types';
import { STATE_LABEL } from '@/lib/foods';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/** Circular progress ring. `value` 0..1 (overshoot is clamped). */
export function Ring({
  value,
  size = 120,
  stroke = 10,
  color = 'accent',
  track = 'line',
  dashed,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: 'accent' | 'ink' | 'silver' | 'carbs' | 'fat' | 'warn';
  track?: 'line' | 'raised';
  dashed?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cx('relative grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`rgb(var(--${track}))`}
          strokeWidth={dashed ? Math.max(1.5, stroke / 2.5) : stroke}
          strokeDasharray={dashed ? '2 4' : undefined}
        />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`rgb(var(--${color}))`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)' }}
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 animate-fade bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative max-h-[94dvh] w-full max-w-lg animate-sheet-up overflow-y-auto rounded-t-[32px] bg-bg no-scrollbar md:max-h-[88dvh] md:max-w-xl md:rounded-[32px] md:animate-fade-up"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        <div className="sticky top-0 z-10 bg-bg/90 px-5 pb-3 pt-2.5 backdrop-blur-xl">
          <div className="mx-auto h-1 w-9 rounded-full bg-line" />
          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-raised text-ink" aria-label="Close">
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        <div className="px-5 pb-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function StateBadge({ state, className }: { state: PrepState; className?: string }) {
  if (state === 'na') return null;
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center rounded-full px-2 text-[12px] font-semibold uppercase tracking-wide',
        state === 'cooked' ? 'bg-ink text-bg' : state === 'raw' ? 'bg-accent/10 text-accent' : 'bg-raised text-silver',
        className,
      )}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

export function PageHeader({ title, right, sub }: { title: string; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="pt-safe pb-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[30px] font-bold leading-none tracking-tight">{title}</h1>
        {right}
      </div>
      {sub && <div className="mt-2 text-sm font-medium text-silver">{sub}</div>}
    </header>
  );
}

export function Segmented<T extends string>({ value, options, onChange, full }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; full?: boolean }) {
  return (
    <div className={cx('inline-flex rounded-full bg-raised p-1', full && 'flex w-full')}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 rounded-full px-4 text-sm font-semibold transition',
            full && 'flex-1',
            value === o.value ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]' : 'text-silver',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-raised text-ink">{icon}</div>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-[16rem] text-sm text-silver">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[14px] font-semibold', className)} style={{ boxShadow: 'var(--shadow)' }}>
      {children}
    </span>
  );
}

export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
