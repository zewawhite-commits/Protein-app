import { useEffect, useState } from 'react';
import { Timer, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { FAST_PRESETS, type Fast } from '@/lib/activity';
import { haptic, toast } from './fx';
import { Sheet, cx } from './ui';

const NO_FASTS: Fast[] = [];
const hm = (ms: number) => { const m = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const toLocalInput = (ms: number) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

/** Fasting timer on Home: start, see time fasted against your goal, end it. Past fasts are kept. */
export function FastingCard() {
  const fasts = useStore((s) => s.fasts) ?? NO_FASTS;
  const start = useStore((s) => s.startFast);
  const end = useStore((s) => s.endFast);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const running = fasts.find((f) => !f.end);
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, [running]);
  const done = running ? now - running.start : 0;
  const pct = running ? Math.min(1, done / (running.goalH * 3600e3)) : 0;
  return (
    <section className="card mt-4 p-5" aria-label="Fasting">
      <button onClick={() => { haptic(); setOpen(true); }} className="block w-full text-left">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F5A623]/15 text-[#B7791F]"><Timer size={19} /></span>
            <p className="font-semibold">Fasting</p>
          </div>
          {running && <span className="num text-[17px] font-bold">{hm(done)} <span className="text-[14px] font-medium text-silver">/ {running.goalH}h</span></span>}
        </div>
        {running ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-[#F5A623] transition-all" style={{ width: `${pct * 100}%` }} /></div>
            <p className="mt-2 text-[13px] text-silver">{pct >= 1 ? 'Goal reached. End it whenever you eat.' : `Ends at ${new Date(running.start + running.goalH * 3600e3).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}</p>
          </>
        ) : <p className="mt-2 text-[14px] text-silver">Not fasting. Tap to start a fast or see past ones.</p>}
      </button>
      <div className="mt-3 flex justify-end">
        {running
          ? <button onClick={() => { haptic(15); end(); toast(`Fast ended: ${hm(Date.now() - running.start)}`); }} className="chip !h-9 !px-3.5 text-[14px]">End fast</button>
          : <button onClick={() => { haptic(); setOpen(true); }} className="chip !h-9 !px-3.5 text-[14px]">Start fast</button>}
      </div>
      <FastSheet open={open} onClose={() => setOpen(false)} running={running} onStart={start} />
    </section>
  );
}

function FastSheet({ open, onClose, running, onStart }: { open: boolean; onClose: () => void; running?: Fast; onStart: (goal: number, start?: number) => void }) {
  const fasts = useStore((s) => s.fasts) ?? NO_FASTS;
  const remove = useStore((s) => s.removeFast);
  const [goal, setGoal] = useState(16);
  const [from, setFrom] = useState(() => toLocalInput(Date.now()));
  useEffect(() => { if (open) setFrom(toLocalInput(Date.now())); }, [open]);
  const past = fasts.filter((f) => f.end).sort((a, b) => b.start - a.start).slice(0, 10);
  return (
    <Sheet open={open} onClose={onClose} title="Fasting">
      {!running && (
        <>
          <p className="text-[14px] text-silver">Goal</p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {FAST_PRESETS.map((h) => <button key={h} onClick={() => setGoal(h)} aria-pressed={goal === h} className={cx('chip !h-10 justify-center !px-1', goal === h && 'chip-on')}>{h}h</button>)}
          </div>
          <label className="mt-4 block"><span className="text-[14px] text-silver">Started (your last meal)</span><input type="datetime-local" className="field mt-1" value={from} max={toLocalInput(Date.now())} onChange={(e) => setFrom(e.target.value)} /></label>
          <button onClick={() => { const t = new Date(from).getTime(); onStart(goal, Number.isFinite(t) && t <= Date.now() ? t : Date.now()); haptic(15); toast(`${goal}-hour fast started`); onClose(); }} className="btn-primary mt-4 w-full">Start {goal}-hour fast</button>
          <p className="mt-2 text-[12px] leading-relaxed text-dim">Fasting isn’t right for everyone. Skip it if you’re pregnant, breastfeeding, under 18, diabetic or have a history of disordered eating, and check with a doctor if unsure.</p>
        </>
      )}
      <p className="mt-5 text-[15px] font-bold">Past fasts</p>
      {past.length === 0 ? <p className="mt-1 text-[14px] text-silver">None yet.</p> : (
        <ul className="mt-1 divide-y divide-line">
          {past.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-2.5 text-[14px]">
              <span><span className="num font-semibold">{hm(f.end! - f.start)}</span> <span className="text-silver">of {f.goalH}h · {new Date(f.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}{f.end! - f.start >= f.goalH * 3600e3 ? ' · goal met' : ''}</span></span>
              <button onClick={() => { remove(f.id); toast('Removed'); }} className="grid h-9 w-9 place-items-center text-silver" aria-label="Delete fast"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
