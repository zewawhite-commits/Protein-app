import { useEffect, useState } from 'react';
import { fetchUsage, type Usage } from '@/lib/premium';
import { fmt } from './ui';

const NAMES: [string, string][] = [['scan', 'Food photo scan'], ['coach', 'Coach message'], ['recipe', 'AI recipe'], ['import', 'Recipe import'], ['plan', 'Meal plan'], ['workout', 'Workout guide'], ['ideas', 'Meal ideas']];

/** Plus members' AI credits, shown here only (no counters elsewhere in the app). */
export function CreditsCard() {
  const [c, setC] = useState<Usage['credits'] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { void fetchUsage().then((u) => setC(u?.credits ?? null)).catch(() => undefined); }, []);
  if (!c) return null;
  const pct = c.total ? Math.min(1, c.left / c.total) : 0;
  return (
    <section className="card mt-5 p-5" aria-label="AI credits">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[17px] font-bold">AI credits</p>
        <p className="num text-[15px] font-bold">{fmt(c.left)} <span className="text-[13px] font-medium text-silver">of {fmt(c.total)} left</span></p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} /></div>
      <p className="mt-2 text-[13px] text-silver">Refreshes on {new Date(c.resetsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}. Up to {c.scansPerDay} photo scans a day. Logging, search, barcode, voice and saved meals never use credits.</p>
      <button onClick={() => setOpen(!open)} className="mt-2 text-[13px] font-semibold text-accent">{open ? 'Hide' : 'What uses credits?'}</button>
      {open && (
        <ul className="mt-2 divide-y divide-line text-[14px]">
          {NAMES.map(([k, n]) => c.costs[k] != null && <li key={k} className="flex justify-between py-1.5"><span>{n}</span><span className="num font-semibold">{c.costs[k]} credit{c.costs[k] === 1 ? '' : 's'}</span></li>)}
        </ul>
      )}
    </section>
  );
}
