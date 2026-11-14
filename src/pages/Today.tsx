import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Drumstick, Droplet, Flame, Plus, Target, Wheat } from 'lucide-react';
import { useStore, goalOn } from '@/store/useStore';
import { useDay, useFoodLookup } from '@/lib/hooks';
import { addDays, fromKey, relativeDay, todayKey, weekOf } from '@/lib/dates';
import { sumEntries } from '@/lib/nutrition';
import type { Food, LogEntry, Meal } from '@/lib/types';
import { Pill, Ring, cx, fmt } from '@/components/ui';
import { EntryRow } from '@/components/EntryRow';
import { FoodSheet } from '@/components/FoodSheet';

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export function entryAsFood(e: LogEntry, lookup: (id: string) => Food | undefined): Food {
  const live = lookup(e.foodId);
  return {
    id: e.foodId,
    fdcId: e.food.fdcId,
    ref: e.food.ref,
    name: e.food.name,
    state: e.food.state,
    per100: e.food.per100,
    source: e.food.source,
    sourceNote: e.food.sourceNote,
    category: live?.category ?? '',
    portions: live?.portions ?? [],
  };
}

export default function Today() {
  const [params, setParams] = useSearchParams();
  const today = todayKey();
  const date = params.get('date') ?? today;
  const setDate = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });
  const { entries, totals, goal } = useDay(date);
  const lookup = useFoodLookup();
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const { streak, weekHits } = useGoalStats(date);

  const pct = goal ? totals.protein / goal : 0;
  const isToday = date === today;

  return (
    <div className="animate-fade-up">
      <header className="pt-safe flex items-center justify-between pb-5">
        <Pill>
          <span className="h-2 w-2 rounded-full bg-accent" />
          {weekHits} of 7 days on goal
        </Pill>
        <Pill>
          <Flame size={15} className="text-accent" fill="currentColor" fillOpacity={0.2} />
          <span className="num">{streak}</span>
        </Pill>
      </header>

      <WeekStrip date={date} onSelect={setDate} />

      <HeroCard
        protein={totals.protein}
        goal={goal}
        pct={pct}
        kcal={totals.kcal}
        carbs={totals.carbs}
        fat={totals.fat}
        incomplete={totals.incomplete}
        entries={entries}
      />

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-xl font-semibold tracking-tight">{isToday ? "Today's meals" : `${relativeDay(date)}'s meals`}</h2>
          {entries.length > 0 && <Link to="/history" className="text-sm font-semibold text-accent">View all</Link>}
        </div>
        {entries.length === 0 ? (
          <Link to={`/add${!isToday ? `?date=${date}` : ''}`} className="card flex items-center gap-4 p-4 transition active:scale-[.99]">
            <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-primary text-on-primary"><Plus size={24} strokeWidth={2.6} /></span>
            <span>
              <span className="block font-semibold">Log your first meal</span>
              <span className="block text-sm font-medium text-silver">Weigh it, find it, done.</span>
            </span>
          </Link>
        ) : (
          <div className="card p-1.5">
            {[...entries].reverse().map((e) => <EntryRow key={e.id} entry={e} onClick={() => setEditing(e)} />)}
          </div>
        )}
      </section>

      <FoodSheet food={editing ? entryAsFood(editing, lookup) : null} entry={editing ?? undefined} date={date} onClose={() => setEditing(null)} />
    </div>
  );
}

function HeroCard(props: {
  protein: number; goal: number; pct: number;
  kcal: number; carbs: number; fat: number; incomplete: { kcal: boolean; carbs: boolean; fat: boolean };
  entries: LogEntry[];
}) {
  const { protein, goal, pct } = props;
  const [page, setPage] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const perMeal = useMemo(
    () => MEALS.map((m) => ({ ...m, protein: sumEntries(props.entries.filter((e) => e.meal === m.key)).protein })),
    [props.entries],
  );

  return (
    <section className="card mt-5 pb-4 pt-6">
      <div
        ref={scroller}
        onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
      >
        {/* Page 1: protein */}
        <div className="w-full shrink-0 snap-center px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-baseline">
                <span className="num text-[64px] font-extrabold leading-[0.9]">{fmt(protein)}</span>
                <span className="num ml-1 text-lg font-bold text-silver">/{fmt(goal)}g</span>
              </p>
              <p className="mt-2 text-[15px] font-semibold">Protein eaten</p>
              <span className={cx('mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold', pct >= 1 ? 'bg-accent/10 text-accent' : 'bg-raised text-silver')}>
                {pct >= 1 ? <Check size={13} strokeWidth={3} /> : <Target size={13} strokeWidth={2.5} />}
                <span className="num">{pct >= 1 ? `Goal hit · +${fmt(protein - goal)}g` : `${fmt(goal - protein)}g to go`}</span>
              </span>
            </div>
            <Ring value={pct} size={118} stroke={12} color={pct >= 1 ? 'accent' : 'ink'} track="raised">
              <div className={cx('grid h-14 w-14 place-items-center rounded-full', pct >= 1 ? 'bg-accent text-white' : 'bg-raised')}>
                <Drumstick size={24} strokeWidth={2.2} />
              </div>
            </Ring>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            <MacroTile icon={<Flame size={16} />} value={props.kcal} unit="" label="kcal" incomplete={props.incomplete.kcal} />
            <MacroTile icon={<Wheat size={16} />} value={props.carbs} unit="g" label="carbs" incomplete={props.incomplete.carbs} />
            <MacroTile icon={<Droplet size={16} />} value={props.fat} unit="g" label="fat" incomplete={props.incomplete.fat} />
          </div>
        </div>

        {/* Page 2: protein by meal */}
        <div className="w-full shrink-0 snap-center px-6">
          <p className="text-[15px] font-semibold">Protein by meal</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {perMeal.map((m) => (
              <div key={m.key} className="tile flex items-center gap-3 p-3">
                <Ring value={goal ? m.protein / goal : 0} size={40} stroke={5} track="line" color="accent">
                  <span className="num text-[10px] font-bold">{goal ? fmt((m.protein / goal) * 100) : 0}%</span>
                </Ring>
                <div className="min-w-0">
                  <p className="num text-lg font-bold leading-none">{fmt(m.protein)}<span className="text-xs text-silver">g</span></p>
                  <p className="mt-1 truncate text-[11px] font-semibold text-silver">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] font-medium text-dim">% of your daily goal</p>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        {[0, 1].map((i) => (
          <button
            key={i}
            aria-label={`Page ${i + 1}`}
            onClick={() => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' })}
            className={cx('h-1.5 rounded-full transition-all', page === i ? 'w-5 bg-ink' : 'w-1.5 bg-line')}
          />
        ))}
      </div>
    </section>
  );
}

function MacroTile({ icon, value, unit, label, incomplete }: { icon: React.ReactNode; value: number; unit: string; label: string; incomplete: boolean }) {
  return (
    <div className="tile px-3 pb-3 pt-3.5">
      <p className="num text-[17px] font-bold leading-none">
        {fmt(value)}<span className="text-xs font-semibold text-silver">{unit}</span>
        {incomplete && <span className="text-warn" title="Some foods have no value for this in the source data">*</span>}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-silver">{label}</p>
      <div className="mt-3 grid h-8 w-8 place-items-center rounded-full bg-surface text-ink">{icon}</div>
    </div>
  );
}

function WeekStrip({ date, onSelect }: { date: string; onSelect: (d: string) => void }) {
  const entries = useStore((s) => s.entries);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  const days = weekOf(date);
  const today = todayKey();
  const touch = useRef<number | null>(null);

  const go = (dir: 1 | -1) => {
    const next = addDays(date, dir * 7);
    onSelect(next > today ? today : next);
  };

  return (
    <div
      className="grid grid-cols-7 gap-1 select-none"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      {days.map((d) => {
        const p = sumEntries(entries.filter((e) => e.date === d)).protein;
        const g = goalOn(d, goalHistory, profile);
        const v = g ? p / g : 0;
        const hit = v >= 1;
        const sel = d === date;
        const future = d > today;
        return (
          <button key={d} onClick={() => !future && onSelect(d)} disabled={future} className="flex flex-col items-center gap-2">
            <span className={cx('text-[11px] font-semibold', sel ? 'text-ink' : 'text-dim')}>
              {fromKey(d).toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <Ring value={future ? 0 : v} size={40} stroke={3} dashed={future || v === 0} color={hit ? 'accent' : 'ink'} track="line">
              <span
                className={cx(
                  'num grid h-[30px] w-[30px] place-items-center rounded-full text-[13px] font-bold',
                  sel ? 'bg-primary text-on-primary' : future ? 'text-dim' : 'text-ink',
                )}
              >
                {fromKey(d).getDate()}
              </span>
            </Ring>
          </button>
        );
      })}
    </div>
  );
}

/** Streak (consecutive days at goal ending today/yesterday) and goal days in the week of `date`. */
export function useGoalStats(date = todayKey()) {
  const entries = useStore((s) => s.entries);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  return useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of entries) totals.set(e.date, (totals.get(e.date) ?? 0) + (e.food.per100.protein * e.grams) / 100);
    const hit = (d: string) => {
      const g = goalOn(d, goalHistory, profile);
      return g > 0 && (totals.get(d) ?? 0) >= g;
    };
    let d = todayKey();
    if (!hit(d)) d = addDays(d, -1);
    let streak = 0;
    while (hit(d) && streak < 3650) { streak++; d = addDays(d, -1); }
    const weekHits = weekOf(date).filter(hit).length;
    return { streak, weekHits };
  }, [entries, goalHistory, profile, date]);
}

export const useStreak = () => useGoalStats().streak;
