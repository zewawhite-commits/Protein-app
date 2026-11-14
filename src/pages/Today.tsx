import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, Check, Flame, Plus, Search } from 'lucide-react';
import { useStore, goalOn } from '@/store/useStore';
import { useDay, useFoodLookup } from '@/lib/hooks';
import { addDays, fromKey, relativeDay, todayKey, weekOf } from '@/lib/dates';
import { sumEntries, type Totals } from '@/lib/nutrition';
import { dailyTargets, type Targets } from '@/lib/energy';
import { DV_NOTE, MacroBar, NutrientList } from '@/components/Nutrients';
import type { Food, LogEntry, Meal } from '@/lib/types';
import { Pill, Ring, Sheet, cx, fmt } from '@/components/ui';
import { APP_NAME, CountUp } from '@/components/fx';
import { EntryRow } from '@/components/EntryRow';
import { Suggestions } from '@/components/Suggestions';
import { FoodSheet } from '@/components/FoodSheet';
import { NotificationBell } from '@/components/Notifications';
import { SaveMealButton } from '@/components/SavedMeals';
import { QuickActions } from '@/components/QuickActions';
import { ExerciseList } from '@/components/LogMenu';

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
  const profile = useStore((s) => s.profile);
  const profileWeight = profile?.bodyWeightKg;
  const burned = useStore((s) => s.exercises.filter((e) => e.date === date).reduce((a, e) => a + e.kcal, 0));
  const addBurned = useStore((s) => s.settings.addBurned ?? false);
  const targets = useMemo(() => {
    const t = profile ? dailyTargets(profile, goal) : null;
    return t && addBurned && burned ? { ...t, kcal: t.kcal + burned } : t;
  }, [profile, goal, addBurned, burned]);
  const lookup = useFoodLookup();
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const { streak, weekHits } = useGoalStats(date);

  const isToday = date === today;

  return (
    <div className="animate-fade-up">
      <header className="pt-safe pb-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 lg:invisible">
            <Ring value={0.72} size={26} stroke={4} color="accent" track="line" />
            <span className="text-[19px] font-bold tracking-tight">{APP_NAME}</span>
          </span>
          <span className="flex items-center gap-2">
            <Pill>
              <Flame size={15} className="text-accent" fill="currentColor" fillOpacity={0.2} />
              <span className="num">{streak}</span>
            </Pill>
            <NotificationBell />
          </span>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-silver">
          <span className="h-2 w-2 rounded-full bg-accent" /> {weekHits} of 7 days on goal this week
        </p>
      </header>

      {(goal > 400 || (profileWeight ?? 0) > 300) && (
        <Link to="/profile?edit=1" className="mb-4 flex items-center gap-3 rounded-[22px] bg-danger/10 p-4 text-danger">
          <span className="flex-1 text-sm font-medium">Your daily target ({fmt(goal)} g) looks too high — your body weight may be mistyped. Tap to fix it.</span>
          <span className="rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white">Fix</span>
        </Link>
      )}

      <div className="mb-5 flex gap-2">
        <Link to={`/add${!isToday ? `?date=${date}` : ''}`} className="flex h-12 flex-1 items-center gap-3 rounded-full bg-surface px-4 text-[15px] text-dim" style={{ boxShadow: 'var(--shadow)' }}>
          <Search size={18} className="text-silver" /> Search any food in the world
        </Link>
        <Link to={`/snap${!isToday ? `?date=${date}` : ''}`} className="grid h-12 w-12 place-items-center rounded-full bg-primary text-on-primary" aria-label="Snap a photo">
          <Camera size={20} />
        </Link>
      </div>

      <QuickActions dateQuery={!isToday ? `?date=${date}` : ''} />

      <WeekStrip date={date} onSelect={setDate} />

      <div className="lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-8">
      <div>
      <HeroCard totals={totals} goal={goal} targets={targets} entries={entries} burned={burned} addBurned={addBurned} />
      {isToday && <Suggestions remaining={Math.max(0, goal - totals.protein)} />}
      </div>

      <section className="mt-8 lg:mt-5">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-xl font-semibold tracking-tight">{isToday ? "Today's meals" : `${relativeDay(date)}'s meals`}</h2>
          {entries.length > 0 && (
            <span className="flex items-center gap-4">
              <SaveMealButton entries={entries} />
              <Link to="/history" className="text-sm font-semibold text-accent">View all</Link>
            </span>
          )}
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
          <div className="card p-2">
            {[...entries].reverse().map((e) => <EntryRow key={e.id} entry={e} onClick={() => setEditing(e)} />)}
          </div>
        )}
      </section>
      </div>

      <ExerciseList date={date} />

      <FoodSheet food={editing ? entryAsFood(editing, lookup) : null} entry={editing ?? undefined} date={date} onClose={() => setEditing(null)} />
    </div>
  );
}

function HeroCard({ totals, goal, targets, entries, burned = 0, addBurned }: { totals: Totals; goal: number; targets: Targets | null; entries: LogEntry[]; burned?: number; addBurned?: boolean }) {
  const [page, setPage] = useState(0);
  const [allNutrients, setAllNutrients] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const perMeal = useMemo(
    () => MEALS.map((m) => ({ ...m, ...sumEntries(entries.filter((e) => e.meal === m.key)) })),
    [entries],
  );
  const kcalLeft = targets ? targets.kcal - totals.kcal : 0;
  const kcalPct = targets ? totals.kcal / targets.kcal : 0;
  const over = targets && kcalLeft < 0;
  const pages = 3;

  return (
    <section className="card mt-5 pb-4 pt-6">
      <div
        ref={scroller}
        onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
      >
        {/* Page 1: calories + macros */}
        <div className="w-full shrink-0 snap-center px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {targets ? (
                <>
                  <p className="flex items-baseline">
                    <CountUp value={Math.abs(Math.round(kcalLeft))} className={cx('num font-extrabold leading-[0.9]', Math.abs(kcalLeft) >= 10000 ? 'text-[44px]' : 'text-[56px]')} />
                  </p>
                  <p className="mt-2 text-[15px] font-semibold">{over ? 'Calories over' : 'Calories left'}</p>
                  <p className="num mt-1 text-xs text-silver">{fmt(totals.kcal)}{totals.incomplete.kcal && '*'} eaten of {fmt(targets.kcal)} kcal</p>
                  {burned > 0 && <p className="num mt-0.5 text-xs font-semibold text-accent">{addBurned ? `incl. +${fmt(burned)} from exercise` : `${fmt(burned)} kcal burned`}</p>}
                </>
              ) : (
                <>
                  <p className="flex items-baseline">
                    <CountUp value={Math.round(totals.kcal)} className="num text-[56px] font-extrabold leading-[0.9]" />
                    <span className="num ml-1 text-lg font-bold text-silver">kcal</span>
                  </p>
                  <p className="mt-2 text-[15px] font-semibold">Calories eaten</p>
                  <Link to="/profile?edit=1" className="mt-1 inline-block text-xs font-semibold text-accent">Add height & age for a calorie goal</Link>
                </>
              )}
            </div>
            <Ring value={targets ? kcalPct : 0} size={112} stroke={11} color={over ? 'warn' : 'ink'} track="raised" dashed={!targets}>
              <div className="grid h-14 w-14 place-items-center rounded-full bg-raised">
                <Flame size={24} strokeWidth={2.2} className={over ? 'text-warn' : ''} />
              </div>
            </Ring>
          </div>
          <div className="mt-5 space-y-3">
            <MacroBar label="Protein" value={totals.protein} target={goal} color="protein" />
            <MacroBar label="Carbs" value={totals.carbs} target={targets?.carbs} color="carbs" incomplete={totals.incomplete.carbs} />
            <MacroBar label="Fat" value={totals.fat} target={targets?.fat} color="fat" incomplete={totals.incomplete.fat} />
          </div>
          {totals.protein >= goal && goal > 0 && (
            <span className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-accent/10 px-2.5 text-xs font-semibold text-accent">
              <Check size={13} strokeWidth={3} /> Protein goal hit
            </span>
          )}
        </div>

        {/* Page 2: nutrients */}
        <div className="w-full shrink-0 snap-center px-6">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-semibold">Nutrients</p>
            <button onClick={() => setAllNutrients(true)} className="text-sm font-semibold text-accent">See all</button>
          </div>
          <div className="mt-2">
            <MacroBar label="Fibre" value={totals.fiber} target={targets?.fiber} color="fiber" incomplete={totals.incomplete.fiber} />
          </div>
          <NutrientList compact values={totals} incomplete={totals.incomplete} keys={['sugar', 'satFat', 'sodium', 'iron', 'calcium']} />
        </div>

        {/* Page 3: by meal */}
        <div className="w-full shrink-0 snap-center px-6">
          <p className="text-[15px] font-semibold">By meal</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {perMeal.map((m) => (
              <div key={m.key} className="tile p-3">
                <p className="truncate text-[12px] font-semibold text-silver">{m.label}</p>
                <p className="num mt-1 text-lg font-bold leading-none">{fmt(m.kcal)}<span className="text-xs text-silver"> kcal</span></p>
                <p className="num mt-1.5 text-[12px] text-silver">
                  <span className="text-accent">P {fmt(m.protein)}</span> · C {fmt(m.carbs)} · F {fmt(m.fat)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[12px] font-medium text-dim">Protein · carbs · fat in grams</p>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i}
            aria-label={`Page ${i + 1}`}
            onClick={() => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' })}
            className={cx('h-1.5 rounded-full transition-all', page === i ? 'w-5 bg-ink' : 'w-1.5 bg-line')}
          />
        ))}
      </div>

      <Sheet open={allNutrients} onClose={() => setAllNutrients(false)} title="All nutrients">
        <div className="space-y-3">
          <MacroBar label="Protein" value={totals.protein} target={goal} color="protein" />
          <MacroBar label="Carbs" value={totals.carbs} target={targets?.carbs} color="carbs" incomplete={totals.incomplete.carbs} />
          <MacroBar label="Fat" value={totals.fat} target={targets?.fat} color="fat" incomplete={totals.incomplete.fat} />
          <MacroBar label="Fibre" value={totals.fiber} target={targets?.fiber} color="fiber" incomplete={totals.incomplete.fiber} />
        </div>
        <div className="mt-4"><NutrientList values={totals} incomplete={totals.incomplete} /></div>
        <p className="mt-3 text-[12px] leading-snug text-dim">{DV_NOTE}</p>
      </Sheet>
    </section>
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
            <span className={cx('text-[12px] font-semibold', sel ? 'text-ink' : 'text-dim')}>
              {fromKey(d).toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <Ring value={future ? 0 : v} size={40} stroke={3} dashed={future || v === 0} color={hit ? 'accent' : 'ink'} track="line">
              <span
                className={cx(
                  'num grid h-[30px] w-[30px] place-items-center rounded-full text-[14px] font-bold',
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

