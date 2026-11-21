import { Minus, Moon, Plus } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { haptic } from './fx';
import { cx } from './ui';
import type { SleepEntry } from '@/lib/types';

export const fmtSleep = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`; };

/** Average hours over the last 7 nights that were logged before (and including) `date`. */
export function sleepAverage(sleep: Record<string, SleepEntry>, date: string, days = 7): { avg: number; nights: number } | null {
  const d0 = new Date(`${date}T12:00:00`);
  const hs: number[] = [];
  for (let i = 0; i < days; i++) { const k = new Date(d0.getTime() - i * 864e5).toISOString().slice(0, 10); if (sleep[k]) hs.push(sleep[k].hours); }
  return hs.length ? { avg: hs.reduce((a, b) => a + b, 0) / hs.length, nights: hs.length } : null;
}

const QUALITY: { v: NonNullable<SleepEntry['quality']>; label: string }[] = [{ v: 'poor', label: 'Poor' }, { v: 'ok', label: 'OK' }, { v: 'good', label: 'Good' }];

/** Last night's sleep: hours in half-hour steps and how it felt. Logged for the day you woke up. */
export function SleepCard({ date }: { date: string }) {
  const entry = useStore((s) => s.sleep?.[date]);
  const all = useStore((s) => s.sleep ?? {});
  const goal = useStore((s) => s.settings.sleepGoalH) ?? 8;
  const log = useStore((s) => s.logSleep);
  const hours = entry?.hours;
  const week = sleepAverage(all, date);
  const set = (h: number | null, q?: SleepEntry['quality']) => { haptic(); log(date, h, q); };
  return (
    <section className="card mt-4 p-5" aria-label="Sleep">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#7C6BD6]/15 text-[#6A58C9]"><Moon size={19} /></span>
          <div>
            <p className="font-semibold">Sleep</p>
            <p className="num text-[14px] text-silver">{hours != null ? `${fmtSleep(hours)} of ${goal}h` : 'How long did you sleep?'}</p>
          </div>
        </div>
        {hours != null ? (
          <div className="flex items-center gap-1.5">
            <button onClick={() => set(Math.max(0, hours - 0.5))} className="grid h-10 w-10 place-items-center rounded-full bg-raised" aria-label="Half an hour less sleep"><Minus size={17} /></button>
            <button onClick={() => set(Math.min(16, hours + 0.5))} className="grid h-10 w-10 place-items-center rounded-full bg-raised" aria-label="Half an hour more sleep"><Plus size={17} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {[6, 7, 8].map((h) => <button key={h} onClick={() => set(h)} className="chip !h-10 !px-3" aria-label={`Slept ${h} hours`}>{h}h</button>)}
          </div>
        )}
      </div>
      {hours != null && (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full bg-[#7C6BD6] transition-all" style={{ width: `${Math.min(100, (hours / goal) * 100)}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-silver">It felt</span>
            {QUALITY.map((q) => <button key={q.v} onClick={() => set(hours, q.v)} aria-pressed={entry?.quality === q.v} className={cx('chip !h-8 !px-3 text-[13px]', entry?.quality === q.v && 'chip-on')}>{q.label}</button>)}
            {week && week.nights > 1 && <span className="ml-auto text-[13px] text-silver">7-night average {fmtSleep(week.avg)}</span>}
          </div>
        </>
      )}
    </section>
  );
}
