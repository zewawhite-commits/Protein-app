import { useMemo, useState } from 'react';
import { ArrowRight, Flag, Flame, Minus, Plus } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { addDays, formatDay, fromKey, lastNDays, todayKey, weekOf } from '@/lib/dates';
import { fromKg, round1, sumEntries, toKg } from '@/lib/nutrition';
import { Segmented, Sheet, cx, fmt } from './ui';
import { CountUp, haptic, toast } from './fx';

/** Consecutive days (ending today or yesterday) with at least one food logged. */
export function useLogStreak() {
  const entries = useStore((s) => s.entries);
  return useMemo(() => {
    const days = new Set(entries.map((e) => e.date));
    let d = todayKey();
    if (!days.has(d)) d = addDays(d, -1);
    let n = 0;
    while (days.has(d) && n < 3650) { n++; d = addDays(d, -1); }
    return { streak: n, days };
  }, [entries]);
}

export function WeightAndStreak() {
  const unit = useStore((s) => s.settings.bodyUnit);
  const profile = useStore((s) => s.profile);
  const weights = useStore((s) => s.weights);
  const [open, setOpen] = useState(false);
  const current = weights.length ? weights[weights.length - 1].kg : profile?.bodyWeightKg ?? null;
  const start = weights.length ? weights[0].kg : current;
  const goal = profile?.goalWeightKg;
  const pct = current && start && goal && start !== goal ? Math.max(0, Math.min(1, (start - current) / (start - goal))) : 0;
  const { streak, days } = useLogStreak();
  const gentle = useStore((s) => !!s.settings.gentle);
  const week = weekOf(todayKey());

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col overflow-hidden">
          <div className="flex-1 p-4 text-center">
            <p className="text-sm font-semibold text-silver">Your weight</p>
            <p className="num mt-1 text-[26px] font-extrabold leading-tight">{current ? <><CountUp value={fromKg(current, unit)} digits={1} /> <span className="text-base text-silver">{unit}</span></> : '—'}</p>
            {goal ? (
              <>
                <div className="mx-2 mt-2 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-ink" style={{ width: `${pct * 100}%` }} /></div>
                <p className="num mt-1.5 text-sm text-silver">Goal {fmt(fromKg(goal, unit), 1)} {unit}</p>
              </>
            ) : <p className="mt-2 text-sm text-silver">Set a goal in Profile</p>}
          </div>
          <button onClick={() => { haptic(); setOpen(true); }} className="flex h-12 items-center justify-between bg-primary px-4 text-sm font-bold text-on-primary transition active:opacity-90">
            Log weight <ArrowRight size={17} />
          </button>
        </div>
        <div className="card flex flex-col items-center justify-center p-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[rgb(var(--carbs))]/12 text-[rgb(var(--carbs))]"><Flame size={28} fill="currentColor" fillOpacity={0.25} strokeWidth={2.2} /></span>
          <p className="num -mt-1 text-[22px] font-extrabold text-[rgb(var(--carbs))]">{week.filter((d) => days.has(d)).length}<span className="text-base"> of 7</span></p>
          <p className="text-sm font-bold text-[rgb(var(--carbs))]">days this week</p>
          <p className="num mt-0.5 text-xs font-semibold text-dim">{!gentle && streak > 1 ? `${streak}-day streak` : 'Every logged day counts'}</p>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {week.map((d) => (
              <div key={d} className="flex flex-col items-center gap-1">
                <span className="text-[11px] font-semibold text-dim">{fromKey(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                <span className={cx('h-3.5 w-3.5 rounded-full', days.has(d) ? 'bg-[rgb(var(--carbs))]' : 'bg-raised')} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <LogWeightSheet open={open} onClose={() => setOpen(false)} current={current} />
    </>
  );
}

function LogWeightSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: number | null }) {
  const unit = useStore((s) => s.settings.bodyUnit);
  const logWeight = useStore((s) => s.logWeight);
  const [value, setValue] = useState('');
  const v = Number((value || (current ? String(round1(fromKg(current, unit))) : '')).replace(',', '.'));
  const [min, max] = unit === 'kg' ? [25, 300] : [55, 660];
  const ok = v >= min && v <= max;
  const step = (d: number) => { haptic(5); setValue(String(round1((ok ? v : current ? fromKg(current, unit) : 70) + d))); };
  return (
    <Sheet open={open} onClose={() => { setValue(''); onClose(); }} title="Log your weight">
      <p className="text-sm text-silver">{formatDay(todayKey(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => step(-0.1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-raised" aria-label="Less"><Minus size={20} /></button>
        <div className="relative flex-1">
          <input autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={current ? String(round1(fromKg(current, unit))) : '70'} className="field !h-20 text-center text-[36px] font-extrabold" />
          <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-lg font-semibold text-silver">{unit}</span>
        </div>
        <button onClick={() => step(0.1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-raised" aria-label="More"><Plus size={20} /></button>
      </div>
      <button disabled={!ok} onClick={() => { logWeight(toKg(v, unit)); haptic([10, 30, 10]); toast('Weight logged'); setValue(''); onClose(); }} className="btn-primary mt-5 w-full">Save</button>
      <p className="mt-2 text-xs text-dim">Weigh at the same time each day (e.g. morning, before eating) for the clearest trend.</p>
    </Sheet>
  );
}

type WRange = '90' | '182' | '365' | 'all';

export function WeightChart() {
  const unit = useStore((s) => s.settings.bodyUnit);
  const weights = useStore((s) => s.weights);
  const goalKg = useStore((s) => s.profile?.goalWeightKg);
  const [range, setRange] = useState<WRange>('90');
  const [active, setActive] = useState<number | null>(null);
  const pts = useMemo(() => {
    if (range === 'all') return weights;
    const from = addDays(todayKey(), -Number(range));
    return weights.filter((w) => w.date >= from);
  }, [weights, range]);

  const W = 320, H = 150, P = 8;
  const vals = pts.map((p) => fromKg(p.kg, unit));
  const goal = goalKg ? fromKg(goalKg, unit) : undefined;
  const lo = Math.floor(Math.min(...vals, goal ?? Infinity) - 1);
  const hi = Math.ceil(Math.max(...vals, goal ?? -Infinity) + 1);
  const t0 = pts.length ? fromKey(pts[0].date).getTime() : 0;
  const t1 = pts.length ? fromKey(pts[pts.length - 1].date).getTime() : 1;
  const x = (d: string) => P + (pts.length < 2 ? (W - 2 * P) / 2 : ((fromKey(d).getTime() - t0) / (t1 - t0 || 1)) * (W - 2 * P));
  const y = (v: number) => P + (1 - (v - lo) / (hi - lo || 1)) * (H - 2 * P);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(vals[i]).toFixed(1)}`).join(' ');
  const first = weights[0]?.kg, last = weights[weights.length - 1]?.kg;
  const pct = goalKg && first != null && last != null && first !== goalKg ? Math.round(Math.max(0, Math.min(1, (first - last) / (first - goalKg))) * 100) : null;
  const a = active != null ? pts[active] : null;
  // Rolling averages smooth out day-to-day swings.
  const avg = useMemo(() => {
    const mean = (from: string, to: string) => { const v = weights.filter((w) => w.date > from && w.date <= to).map((w) => w.kg); return v.length ? v.reduce((s, n) => s + n, 0) / v.length : null; };
    const today = todayKey();
    const now = mean(addDays(today, -7), today);
    return now == null ? null : { now, prev: mean(addDays(today, -14), addDays(today, -7)) };
  }, [weights]);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Weight progress</h2>
        {pct != null && <span className="flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs font-bold"><Flag size={12} /> {pct}% of goal</span>}
      </div>
      {pts.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-raised p-4 text-sm text-silver">Log your weight to see your trend here.</p>
      ) : (
        <div className="relative mt-3">
          {a && (
            <div className="num pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl bg-primary px-2.5 py-1.5 text-center text-xs font-bold text-on-primary" style={{ left: `${(x(a.date) / W) * 100}%`, top: 0 }}>
              {fmt(fromKg(a.kg, unit), 1)} {unit}<span className="block text-[11px] font-medium opacity-70">{formatDay(a.date, { day: 'numeric', month: 'short' })}</span>
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setActive(null)}>
            <defs><linearGradient id="wg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent))" stopOpacity="0.22" /><stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" /></linearGradient></defs>
            {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="rgb(var(--line))" strokeDasharray="3 4" />)}
            {goal != null && <line x1={P} x2={W - P} y1={y(goal)} y2={y(goal)} stroke="rgb(var(--silver))" strokeDasharray="5 5" />}
            {pts.length > 1 && <path d={`${line} L${x(pts[pts.length - 1].date)},${H - P} L${x(pts[0].date)},${H - P} Z`} fill="url(#wg)" />}
            <path d={line} fill="none" stroke="rgb(var(--accent))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <g key={p.date} onClick={() => { haptic(); setActive(i); }} onMouseEnter={() => setActive(i)} className="cursor-pointer">
                <circle cx={x(p.date)} cy={y(vals[i])} r={14} fill="transparent" />
                <circle cx={x(p.date)} cy={y(vals[i])} r={active === i ? 5 : 3} fill="rgb(var(--surface))" stroke="rgb(var(--accent))" strokeWidth="2" />
              </g>
            ))}
          </svg>
          <div className="num flex justify-between text-xs font-semibold text-silver"><span>{fmt(lo)} {unit}</span><span>{goal != null ? `Goal ${fmt(goal, 1)}` : ''}</span><span>{fmt(hi)} {unit}</span></div>
        </div>
      )}
      {avg && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-raised py-3">
            <p className="num text-[18px] font-extrabold">{fmt(fromKg(avg.now, unit), 1)} {unit}</p>
            <p className="text-xs text-silver">7-day average</p>
          </div>
          <div className="rounded-2xl bg-raised py-3">
            <p className="num text-[18px] font-extrabold">{avg.prev == null ? '—' : `${avg.now - avg.prev > 0 ? '+' : ''}${fmt(fromKg(avg.now - avg.prev, unit), 1)} ${unit}`}</p>
            <p className="text-xs text-silver">vs the week before</p>
          </div>
        </div>
      )}
      {weights.length >= 2 && <p className="mt-2 text-xs leading-relaxed text-dim">Weight naturally moves 1–2 kg day to day with water, salt and meals. The average is your real trend — one higher day isn’t a setback.</p>}
      <div className="mt-3"><Segmented full value={range} onChange={setRange} options={[{ value: '90', label: '90D' }, { value: '182', label: '6M' }, { value: '365', label: '1Y' }, { value: 'all', label: 'All' }]} /></div>
      {weights.length >= 2 && (
        <p className="mt-3 rounded-2xl bg-accent/10 px-3 py-2 text-center text-sm font-semibold text-accent">
          {Math.abs((last ?? 0) - (first ?? 0)) < 0.2 ? 'Steady — consistency is key.' : `${(last ?? 0) < (first ?? 0) ? 'Down' : 'Up'} ${fmt(Math.abs(fromKg((last ?? 0) - (first ?? 0), unit)), 1)} ${unit} since ${formatDay(weights[0].date, { day: 'numeric', month: 'short' })}. Keep going!`}
        </p>
      )}
    </section>
  );
}

/** Average daily calories this week vs last week. */
export function AverageCalories() {
  const entries = useStore((s) => s.entries);
  const { avg, change } = useMemo(() => {
    const avgOf = (days: string[]) => {
      const logged = days.map((d) => entries.filter((e) => e.date === d)).filter((l) => l.length);
      return logged.length ? logged.reduce((a, l) => a + sumEntries(l).kcal, 0) / logged.length : 0;
    };
    const now = avgOf(lastNDays(todayKey(), 7));
    const before = avgOf(lastNDays(addDays(todayKey(), -7), 7));
    return { avg: now, change: before ? (now - before) / before : null };
  }, [entries]);
  return (
    <section className="card p-5">
      <p className="text-lg font-bold">Daily average calories</p>
      <p className="num mt-1 text-[30px] font-extrabold">{fmt(avg)} <span className="text-base font-semibold text-silver">kcal</span>
        {change != null && <span className={cx('ml-2 text-sm font-bold', change <= 0 ? 'text-accent' : 'text-warn')}>{change > 0 ? '↑' : '↓'} {fmt(Math.abs(change) * 100)}%</span>}
      </p>
      <p className="text-sm text-silver">Last 7 days{change != null ? ', vs the week before' : ''}</p>
    </section>
  );
}

/** Progress that isn't a number on the scale: training, consistency and protein. */
export function BeyondTheScale() {
  const entries = useStore((s) => s.entries);
  const exercises = useStore((s) => s.exercises);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  const stats = useMemo(() => {
    const today = todayKey();
    const from30 = addDays(today, -30), from7 = addDays(today, -7);
    const month = entries.filter((e) => e.date > from30);
    const days = new Set(month.map((e) => e.date));
    const protein = new Map<string, number>();
    for (const e of month) protein.set(e.date, (protein.get(e.date) ?? 0) + (e.food.per100.protein * e.grams) / 100);
    const goal = profile ? (Object.values(goalHistory).pop() ?? profile.goalGrams ?? 0) : 0;
    const proteinDays = goal > 0 ? [...protein.values()].filter((v) => v >= goal).length : 0;
    const week = exercises.filter((x) => x.date > from7);
    const mon = exercises.filter((x) => x.date > from30);
    return { daysLogged: days.size, proteinDays, workoutsWeek: week.length, minutesMonth: mon.reduce((s, x) => s + x.minutes, 0), workoutsMonth: mon.length };
  }, [entries, exercises, goalHistory, profile]);
  const tiles: [string, string, string][] = [
    [String(stats.workoutsWeek), 'workouts', 'this week'],
    [String(stats.minutesMonth), 'minutes trained', 'last 30 days'],
    [String(stats.daysLogged), 'days logged', 'last 30 days'],
    [String(stats.proteinDays), 'protein-goal days', 'last 30 days'],
  ];
  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold">Beyond the scale</h2>
      <p className="mt-0.5 text-sm text-silver">Progress is more than your weight.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {tiles.map(([v, l, sub]) => (
          <div key={l} className="rounded-2xl bg-raised p-3.5">
            <p className="num text-[24px] font-extrabold leading-none">{v}</p>
            <p className="mt-1 text-[14px] font-semibold">{l}</p>
            <p className="text-xs text-silver">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
