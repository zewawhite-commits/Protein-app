import { Droplet, Minus, Plus } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { haptic } from './fx';
import { fmt } from './ui';

/** Daily water target: about 35 ml per kg of body weight, kept between 1.5 and 4 litres (a common rule of thumb). */
export function waterGoal(kg?: number | null, chosen?: number): number {
  if (chosen) return chosen;
  return kg ? Math.round(Math.min(4000, Math.max(1500, kg * 35)) / 250) * 250 : 2000;
}

/** Quick water tracking: a glass (250 ml) or a bottle (500 ml) at a time. */
export function WaterCard({ date }: { date: string }) {
  const ml = useStore((s) => s.water?.[date] ?? 0);
  const goal = waterGoal(useStore((s) => s.profile?.bodyWeightKg), useStore((s) => s.settings.waterGoalMl));
  const add = useStore((s) => s.addWater);
  const pct = Math.min(1, ml / goal);
  return (
    <section className="card mt-4 p-5" aria-label="Water">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#4AA3DF]/15 text-[#2F86C4]"><Droplet size={19} /></span>
          <div>
            <p className="font-semibold">Water</p>
            <p className="num text-[14px] text-silver">{fmt(ml / 1000, 2)} of {fmt(goal / 1000, 1)} L</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { haptic(); add(date, -250); }} disabled={ml <= 0} className="grid h-10 w-10 place-items-center rounded-full bg-raised disabled:opacity-40" aria-label="Remove a glass"><Minus size={17} /></button>
          <button onClick={() => { haptic(); add(date, 250); }} className="chip !h-10 !px-3" aria-label="Add a glass, 250 ml"><Plus size={15} /> 250 ml</button>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full bg-[#4AA3DF] transition-all" style={{ width: `${pct * 100}%` }} />
      </div>

    </section>
  );
}
