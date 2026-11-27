import { useEffect, useState } from 'react';
import { Moon, Pencil, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { hoursBetween } from '@/lib/water';
import { haptic, toast } from './fx';
import { Sheet, Segmented, cx } from './ui';
import type { SleepEntry } from '@/lib/types';

export const fmtSleep = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`; };

/** Average hours over the last 7 nights that were logged before (and including) `date`. */
export function sleepAverage(sleep: Record<string, SleepEntry>, date: string, days = 7): { avg: number; nights: number } | null {
  const d0 = new Date(`${date}T12:00:00`);
  const hs: number[] = [];
  for (let i = 0; i < days; i++) { const k = new Date(d0.getTime() - i * 864e5).toISOString().slice(0, 10); if (sleep[k]) hs.push(sleep[k].hours); }
  return hs.length ? { avg: hs.reduce((a, b) => a + b, 0) / hs.length, nights: hs.length } : null;
}

const QUALITY: { v: NonNullable<SleepEntry['quality']>; label: string }[] = [{ v: 'poor', label: 'Poor' }, { v: 'ok', label: 'Okay' }, { v: 'good', label: 'Good' }];
const QTONE = { poor: 'bg-[#E5484D]/12 text-[#C93A3F]', ok: 'bg-[#F5A623]/15 text-[#B7791F]', good: 'bg-primary/15 text-primary' } as const;

/** Last night's sleep on Home. Tap to enter or edit it; it's saved for the day you woke up. */
export function SleepCard({ date }: { date: string }) {
  const entry = useStore((s) => s.sleep?.[date]);
  const all = useStore((s) => s.sleep ?? {});
  const goal = useStore((s) => s.settings.sleepGoalH) ?? 8;
  const [open, setOpen] = useState(false);
  const week = sleepAverage(all, date);
  return (
    <section className="card mt-4 p-5" aria-label="Sleep">
      <button onClick={() => { haptic(); setOpen(true); }} className="block w-full text-left" aria-label={entry ? 'Edit sleep' : 'Log sleep'}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#7C6BD6]/15 text-[#6A58C9]"><Moon size={19} /></span>
            <p className="font-semibold">Sleep</p>
          </div>
          {entry?.quality && <span className={cx('rounded-full px-3 py-1 text-[13px] font-semibold', QTONE[entry.quality])}>{QUALITY.find((q) => q.v === entry.quality)?.label}</span>}
        </div>
        {entry ? (
          <>
            <p className="num mt-3 text-[28px] font-extrabold leading-none">{fmtSleep(entry.hours)} <span className="text-[15px] font-medium text-silver">/ {goal}h goal</span></p>
            {entry.bed && entry.wake && <p className="mt-1 text-[13px] text-silver">{entry.bed} to {entry.wake}</p>}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-[#7C6BD6] transition-all" style={{ width: `${Math.min(100, (entry.hours / goal) * 100)}%` }} />
            </div>
          </>
        ) : <p className="mt-2 text-[14px] text-silver">How did you sleep last night? Tap to log it.</p>}
      </button>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[13px] text-silver">{week && week.nights > 1 ? `7-night average ${fmtSleep(week.avg)}` : ''}</span>
        <button onClick={() => { haptic(); setOpen(true); }} className="chip !h-9 !px-3.5 text-[14px]"><Pencil size={14} /> {entry ? 'Edit sleep' : 'Log sleep'}</button>
      </div>
      <SleepSheet date={date} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

function SleepSheet({ date, open, onClose }: { date: string; open: boolean; onClose: () => void }) {
  const entry = useStore((s) => s.sleep?.[date]);
  const log = useStore((s) => s.logSleep);
  const [mode, setMode] = useState<'times' | 'total'>('times');
  const [bed, setBed] = useState('23:00');
  const [wake, setWake] = useState('07:00');
  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const [q, setQ] = useState<SleepEntry['quality']>();
  useEffect(() => {
    if (!open) return;
    setQ(entry?.quality);
    if (entry?.bed && entry.wake) { setMode('times'); setBed(entry.bed); setWake(entry.wake); }
    else if (entry) { setMode('total'); setH(String(Math.floor(entry.hours))); setM(String(Math.round((entry.hours % 1) * 60))); }
  }, [open, entry]);
  const hours = mode === 'times' ? hoursBetween(bed, wake) : (Number(h || 0) + Number(m || 0) / 60) || null;
  const valid = hours != null && hours > 0 && hours <= 16;
  const save = () => {
    if (!valid) { toast('Enter between a few minutes and 16 hours'); return; }
    haptic(15);
    log(date, hours, q, mode === 'times' ? { bed, wake } : undefined);
    toast(`Sleep saved: ${fmtSleep(hours)}`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Edit sleep' : 'Log sleep'}>
      <Segmented full value={mode} onChange={setMode} options={[{ value: 'times', label: 'Bed and wake time' }, { value: 'total', label: 'Total hours' }]} />
      {mode === 'times' ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[13px] text-silver">Went to sleep</span><input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className="field mt-1" /></label>
          <label className="block"><span className="text-[13px] text-silver">Woke up</span><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className="field mt-1" /></label>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[13px] text-silver">Hours</span><input inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="7" className="field mt-1" /></label>
          <label className="block"><span className="text-[13px] text-silver">Minutes</span><input inputMode="numeric" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="30" className="field mt-1" /></label>
        </div>
      )}
      <p className="num mt-3 text-center text-[15px] font-semibold">{valid ? `Total: ${fmtSleep(hours!)}` : ' '}</p>
      <p className="mt-4 text-[15px] font-bold">How did you sleep?</p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Sleep quality">
        {QUALITY.map((x) => <button key={x.v} onClick={() => setQ(q === x.v ? undefined : x.v)} aria-pressed={q === x.v} className={cx('chip !h-11 justify-center', q === x.v && 'chip-on')}>{x.label}</button>)}
      </div>
      <button onClick={save} disabled={!valid} className="btn-primary mt-5 w-full">Save sleep</button>
      {entry && <button onClick={() => { haptic(); log(date, null); toast('Sleep removed'); onClose(); }} className="btn-ghost mt-2 w-full text-[#C93A3F]"><Trash2 size={15} /> Remove this night</button>}
    </Sheet>
  );
}
