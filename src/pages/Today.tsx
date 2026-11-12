import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Flame, Plus, Scale } from 'lucide-react';
import { useStore, goalOn } from '@/store/useStore';
import { useDay, useFoodLookup } from '@/lib/hooks';
import { addDays, formatDay, fromKey, greeting, relativeDay, todayKey, weekOf } from '@/lib/dates';
import { sumEntries } from '@/lib/nutrition';
import type { Food, LogEntry, Meal } from '@/lib/types';
import { Empty, Ring, cx, fmt } from '@/components/ui';
import { EntryRow } from '@/components/EntryRow';
import { FoodSheet } from '@/components/FoodSheet';

const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export function entryAsFood(e: LogEntry, lookup: (id: string) => Food | undefined): Food {
  const live = lookup(e.foodId);
  return {
    id: e.foodId,
    fdcId: e.food.fdcId,
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
  const profile = useStore((s) => s.profile);
  const { entries, totals, goal } = useDay(date);
  const lookup = useFoodLookup();
  const [editing, setEditing] = useState<LogEntry | null>(null);

  const pct = goal ? totals.protein / goal : 0;
  const remaining = Math.max(0, goal - totals.protein);
  const streak = useStreak();

  const byMeal = useMemo(() => {
    const m = new Map<Meal, LogEntry[]>();
    for (const e of entries) m.set(e.meal, [...(m.get(e.meal) ?? []), e]);
    return MEAL_ORDER.filter((k) => m.has(k)).map((k) => ({ meal: k, list: m.get(k)!, protein: sumEntries(m.get(k)!).protein }));
  }, [entries]);

  return (
    <div className="animate-fade-up">
      <header className="pt-safe flex items-center justify-between pb-4">
        <div>
          <p className="eyebrow mb-1">{date === today ? greeting() : formatDay(date, { weekday: 'long' })}</p>
          <h1 className="text-[26px] font-semibold tracking-tight">
            {date === today ? (profile?.name ? `${profile.name.split(' ')[0]}` : 'Today') : relativeDay(date)}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span className="flex h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 text-sm font-semibold" title="Days in a row at goal">
              <Flame size={15} className="text-accent" /> {streak}
            </span>
          )}
        </div>
      </header>

      <WeekStrip date={date} onSelect={setDate} />

      {/* Hero */}
      <section className="card relative mt-4 overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Protein</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-6xl font-semibold tracking-tighter tabular-nums">{fmt(totals.protein)}</span>
              <span className="text-lg text-silver tabular-nums">/ {fmt(goal)} g</span>
            </p>
            <p className={cx('mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium', pct >= 1 ? 'bg-accent text-white' : 'bg-raised text-silver')}>
              {pct >= 1 ? `Goal reached · +${fmt(totals.protein - goal)} g` : `${fmt(remaining)} g to go`}
            </p>
          </div>
          <Ring value={pct} size={116} stroke={11}>
            <div className="text-center">
              <p className="text-xl font-semibold tabular-nums">{fmt(Math.min(pct, 9.99) * 100)}%</p>
              <p className="text-[10px] uppercase tracking-wider text-dim">of goal</p>
            </div>
          </Ring>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <Stat label="Energy" value={totals.kcal} unit="kcal" incomplete={totals.incomplete.kcal} />
          <Stat label="Carbs" value={totals.carbs} unit="g" incomplete={totals.incomplete.carbs} />
          <Stat label="Fat" value={totals.fat} unit="g" incomplete={totals.incomplete.fat} />
        </div>
      </section>

      {/* Meals */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{date === today ? "Today's food" : 'Food log'}</h2>
          <span className="text-sm text-silver">{entries.length} {entries.length === 1 ? 'item' : 'items'}</span>
        </div>
        {byMeal.length === 0 ? (
          <Empty
            icon={<Scale size={22} />}
            title="Nothing logged yet"
            body="Weigh your food, pick it from the USDA database and the protein is calculated for you."
            action={<Link to={`/add${date !== today ? `?date=${date}` : ''}`} className="btn-primary"><Plus size={18} /> Log food</Link>}
          />
        ) : (
          <div className="space-y-3">
            {byMeal.map(({ meal, list, protein }) => (
              <div key={meal} className="card px-4 pb-2 pt-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="eyebrow">{MEAL_LABEL[meal]}</p>
                  <p className="text-xs text-silver tabular-nums">{fmt(protein, 1)} g</p>
                </div>
                <div className="divide-y divide-line/50">
                  {list.map((e) => <EntryRow key={e.id} entry={e} onClick={() => setEditing(e)} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <FoodSheet
        food={editing ? entryAsFood(editing, lookup) : null}
        entry={editing ?? undefined}
        date={date}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function Stat({ label, value, unit, incomplete }: { label: string; value: number; unit: string; incomplete: boolean }) {
  return (
    <div className="rounded-2xl border border-line/60 bg-raised/50 px-3 py-2.5">
      <p className="text-[11px] text-dim">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">
        {fmt(value)}
        <span className="text-xs font-normal text-silver"> {unit}</span>
        {incomplete && <span className="text-warn" title="Some foods have no value for this nutrient in the source data"> *</span>}
      </p>
    </div>
  );
}

function WeekStrip({ date, onSelect }: { date: string; onSelect: (d: string) => void }) {
  const entries = useStore((s) => s.entries);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  const days = weekOf(date);
  const today = todayKey();
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onSelect(addDays(date, -7))} className="grid h-8 w-6 place-items-center text-dim" aria-label="Previous week"><ChevronLeft size={18} /></button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((d) => {
          const p = sumEntries(entries.filter((e) => e.date === d)).protein;
          const g = goalOn(d, goalHistory, profile);
          const v = g ? p / g : 0;
          const sel = d === date;
          const future = d > today;
          return (
            <button key={d} onClick={() => !future && onSelect(d)} disabled={future} className={cx('flex flex-col items-center gap-1.5 rounded-2xl py-2 transition', sel && 'bg-surface border border-line/70')}>
              <span className={cx('text-[10px] font-medium uppercase', d === today ? 'text-accent' : 'text-dim')}>
                {fromKey(d).toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
              <Ring value={v} size={34} stroke={3.5}>
                <span className={cx('text-xs font-semibold tabular-nums', future ? 'text-dim' : v >= 1 ? 'text-accent' : 'text-ink')}>{fromKey(d).getDate()}</span>
              </Ring>
            </button>
          );
        })}
      </div>
      <button onClick={() => onSelect(addDays(date, 7) > today ? today : addDays(date, 7))} disabled={date >= today} className="grid h-8 w-6 place-items-center text-dim disabled:opacity-30" aria-label="Next week"><ChevronRight size={18} /></button>
    </div>
  );
}

/** Consecutive days at goal, ending today (or yesterday if today isn't done yet). */
export function useStreak() {
  const entries = useStore((s) => s.entries);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  return useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of entries) totals.set(e.date, (totals.get(e.date) ?? 0) + (e.food.per100.protein * e.grams) / 100);
    const hit = (d: string) => { const g = goalOn(d, goalHistory, profile); return g > 0 && (totals.get(d) ?? 0) >= g; };
    let d = todayKey();
    if (!hit(d)) d = addDays(d, -1);
    let n = 0;
    while (hit(d) && n < 3650) { n++; d = addDays(d, -1); }
    return n;
  }, [entries, goalHistory, profile]);
}
