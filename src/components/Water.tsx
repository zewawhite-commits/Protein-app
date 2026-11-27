import { useState } from 'react';
import { Droplet, GlassWater, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { BOTTLES, DAY_PARTS, dayPartNow, fmtMl, type DayPart } from '@/lib/water';
import { formatTime } from '@/lib/dates';
import { haptic, toast } from './fx';
import { Sheet, cx, fmt } from './ui';

const NO_DRINKS: never[] = [];

/** Daily water target: about 35 ml per kg of body weight, kept between 1.5 and 4 litres (a common rule of thumb). */
export function waterGoal(kg?: number | null, chosen?: number): number {
  if (chosen) return chosen;
  return kg ? Math.round(Math.min(4000, Math.max(1500, kg * 35)) / 250) * 250 : 2000;
}

/** Water on Home: a clean card. Tapping it (or + Add water) opens the bottle sizes. */
export function WaterCard({ date }: { date: string }) {
  const ml = useStore((s) => s.water?.[date] ?? 0);
  const goal = waterGoal(useStore((s) => s.profile?.bodyWeightKg), useStore((s) => s.settings.waterGoalMl));
  const [open, setOpen] = useState(false);
  const pct = Math.min(1, ml / goal);
  return (
    <section className="card mt-4 p-5" aria-label="Water">
      <button onClick={() => { haptic(); setOpen(true); }} className="block w-full text-left" aria-label="Open water log">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#4AA3DF]/15 text-[#2F86C4]"><Droplet size={19} /></span>
            <p className="font-semibold">Water</p>
          </div>
          <p className="num text-[17px] font-bold">{fmt(ml / 1000, 2)} <span className="text-[14px] font-medium text-silver">/ {fmt(goal / 1000, 1)} L</span></p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
          <div className="h-full rounded-full bg-[#4AA3DF] transition-all" style={{ width: `${pct * 100}%` }} />
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[13px] text-silver">{ml >= goal ? 'Daily goal reached' : 'Tap to log water'}</span>
        <button onClick={() => { haptic(); setOpen(true); }} className="chip !h-9 !px-3.5 text-[14px]"><Plus size={15} /> Add water</button>
      </div>
      <WaterSheet date={date} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

export function WaterSheet({ date, open, onClose }: { date: string; open: boolean; onClose: () => void }) {
  const add = useStore((s) => s.addWater);
  const remove = useStore((s) => s.removeDrink);
  const drinks = useStore((s) => s.waterLog?.[date]) ?? NO_DRINKS;
  const total = useStore((s) => s.water?.[date] ?? 0);
  const [part, setPart] = useState<DayPart>(dayPartNow());
  const [count, setCount] = useState(1);
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const log = (ml: number) => {
    if (!(ml > 0) || ml > 5000) { toast('Enter an amount between 1 and 5000 ml'); return; }
    haptic(15);
    for (let i = 0; i < count; i++) add(date, ml, part);
    toast(`Saved ${count > 1 ? `${count} × ` : ''}${fmtMl(ml)} of water`);
    setCount(1); setCustom(''); setShowCustom(false);
    onClose();
  };
  const loggedBefore = drinks.reduce((a, d) => a + d.ml, 0);
  const untracked = Math.max(0, total - loggedBefore);
  return (
    <Sheet open={open} onClose={onClose} title="Add water">
      <p className="text-[14px] text-silver">When did you drink it?</p>
      <div className="mt-2 grid grid-cols-4 gap-1.5" role="group" aria-label="Time of day">
        {DAY_PARTS.map((p) => <button key={p.v} onClick={() => setPart(p.v)} aria-pressed={part === p.v} className={cx('chip !h-9 justify-center !px-1 text-[13px]', part === p.v && 'chip-on')}>{p.label}</button>)}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[14px] text-silver">How many bottles or glasses?</p>
        <div className="flex items-center rounded-full border-2 border-line" role="group" aria-label="How many">
          <button onClick={() => setCount((c) => Math.max(1, c - 1))} className="grid h-9 w-9 place-items-center text-lg" aria-label="Fewer">−</button>
          <span className="num min-w-[2rem] text-center font-bold" aria-live="polite">{count}</span>
          <button onClick={() => setCount((c) => Math.min(10, c + 1))} className="grid h-9 w-9 place-items-center text-lg" aria-label="More">+</button>
        </div>
      </div>
      <p className="mt-4 text-[14px] text-silver">Choose your bottle or glass size</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {BOTTLES.map((b) => (
          <button key={b} onClick={() => log(b)} className="flex flex-col items-center gap-1 rounded-2xl bg-raised py-3.5 transition active:scale-95" aria-label={`Add ${count > 1 ? `${count} × ` : ''}${fmtMl(b)}`}>
            <GlassWater size={20} className="text-[#2F86C4]" />
            <span className="num text-[15px] font-bold">{fmtMl(b)}</span>
          </button>
        ))}
      </div>
      {showCustom ? (
        <div className="mt-3 flex gap-2">
          <input autoFocus inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))} placeholder="Amount in ml" className="field flex-1" aria-label="Custom amount in ml" />
          <button onClick={() => log(Number(custom))} disabled={!custom} className="btn-primary !h-12 !px-5">Save</button>
        </div>
      ) : (
        <button onClick={() => setShowCustom(true)} className="btn-ghost mt-3 w-full">Enter custom amount</button>
      )}
      {(drinks.length > 0 || untracked > 0) && (
        <>
          <p className="mt-6 text-[15px] font-bold">Logged today · {fmt(total / 1000, 2)} L</p>
          <ul className="mt-1 divide-y divide-line">
            {untracked > 0 && <li className="py-2.5 text-[14px] text-silver">{fmtMl(untracked)} added earlier</li>}
            {drinks.slice().reverse().map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2.5 text-[14px]">
                <span><span className="num font-semibold">{fmtMl(d.ml)}</span> <span className="text-silver">· {DAY_PARTS.find((p) => p.v === d.part)?.label} · {formatTime(d.at)}</span></span>
                <button onClick={() => { haptic(); remove(date, d.id); toast('Removed'); }} className="grid h-9 w-9 place-items-center rounded-full text-silver" aria-label={`Remove ${fmtMl(d.ml)}`}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
