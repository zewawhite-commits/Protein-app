/**
 * Small interaction helpers: counting numbers, toasts (with an action such as Undo),
 * a confetti burst, and light haptics where the device supports them.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './ui';

export const APP_NAME = 'Nutivili AI';

/** The app name as a heading: "Nutivili" with "AI" beside it in the brand green. */
export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cx('font-bold tracking-tight', className)}>
      Nutivili <span className="text-accent">AI</span>
    </span>
  );
}

/** A tiny vibration on devices that support it (Android). iOS Safari ignores it. */
export function haptic(pattern: number | number[] = 10) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates from the previous value to the new one. */
export function CountUp({ value, digits = 0, duration = 700, className }: { value: number; digits?: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduceMotion()) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, duration]);
  return <span className={className}>{shown.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })}</span>;
}

// ---------- toasts ----------

interface Toast { id: number; text: string; action?: { label: string; run: () => void }; tone?: 'default' | 'celebrate' }
type Listener = (t: Toast[]) => void;
let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let nextId = 1;
const emit = () => listeners.forEach((l) => l(toasts));

export function toast(text: string, opts: { action?: Toast['action']; tone?: Toast['tone']; ms?: number } = {}) {
  const t: Toast = { id: nextId++, text, action: opts.action, tone: opts.tone };
  toasts = [...toasts.slice(-2), t];
  emit();
  setTimeout(() => dismiss(t.id), opts.ms ?? 4000);
  if (opts.tone === 'celebrate') burst();
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex max-w-lg flex-col items-center gap-2 px-5 lg:left-64" style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 1rem) + 88px)' }} aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex w-full animate-[fade-up_.3s_both] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-[0_12px_32px_-8px_rgb(0_0_0/0.4)]',
            t.tone === 'celebrate' ? 'bg-accent text-white' : 'bg-primary text-on-primary',
          )}
        >
          <span className="flex-1">{t.text}</span>
          {t.action && (
            <button onClick={() => { t.action!.run(); dismiss(t.id); haptic(); }} className="rounded-full bg-on-primary/15 px-3 py-1 text-xs font-semibold">
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ---------- confetti ----------

let burstListeners = new Set<() => void>();
export function burst() {
  if (!reduceMotion()) burstListeners.forEach((l) => l());
}

export function Confetti() {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const l = () => setKey((k) => k + 1);
    burstListeners.add(l);
    return () => { burstListeners.delete(l); };
  }, []);
  if (!key) return null;
  const colors = ['rgb(var(--accent))', 'rgb(var(--ink))', 'rgb(var(--silver))', 'rgb(var(--glow))'];
  return createPortal(
    <div key={key} className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {Array.from({ length: 36 }, (_, i) => {
        const left = 50 + (Math.random() - 0.5) * 70;
        const dx = (Math.random() - 0.5) * 240;
        const rot = Math.random() * 720 - 360;
        const delay = Math.random() * 120;
        return (
          <span
            key={i}
            className="absolute top-[38%] block h-2.5 w-1.5 rounded-sm"
            style={{
              left: `${left}%`,
              background: colors[i % colors.length],
              animation: `confetti 1.2s cubic-bezier(.2,.7,.3,1) ${delay}ms both`,
              ['--dx' as string]: `${dx}px`,
              ['--rot' as string]: `${rot}deg`,
            }}
          />
        );
      })}
    </div>,
    document.body,
  );
}

// re-export for tests
export const __test = { reset: () => { toasts = []; burstListeners = new Set(); } };
