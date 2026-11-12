import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { PrepState } from '@/lib/types';
import { STATE_LABEL } from '@/lib/foods';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/** Circular progress ring. `value` 0..1+ (overshoot shown as a full ring). */
export function Ring({ value, size = 120, stroke = 10, children, className }: { value: number; size?: number; stroke?: number; children?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cx('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`rg-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--accent))" stopOpacity="0.75" />
            <stop offset="1" stopColor="rgb(var(--accent))" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#rg-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
        />
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
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fade-up_.2s_both]" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto no-scrollbar bg-surface border-t border-x border-line rounded-t-4xl animate-sheet-up" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur px-5 pt-3 pb-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-line" />
          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-raised text-silver" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="px-5 pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function StateBadge({ state, className }: { state: PrepState; className?: string }) {
  const tone =
    state === 'cooked' ? 'bg-accent/15 text-accent border-accent/30'
    : state === 'raw' ? 'bg-ink/10 text-ink border-ink/20'
    : state === 'dry' ? 'bg-warn/15 text-warn border-warn/30'
    : 'bg-raised text-silver border-line';
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', tone, className)}>
      {STATE_LABEL[state]}
    </span>
  );
}

export function PageHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <header className="pt-safe flex items-end justify-between gap-4 pb-5">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full bg-raised p-1 border border-line/60">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('h-8 px-3.5 rounded-full text-sm font-medium transition', value === o.value ? 'bg-ink text-bg' : 'text-silver')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center text-center px-6 py-10">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-raised text-silver">{icon}</div>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 text-sm text-silver max-w-xs">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
