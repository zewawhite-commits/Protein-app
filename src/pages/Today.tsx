import { InstallBanner } from '@/components/InstallApp';
import { PhotoDiary } from '@/components/PhotoDiary';
import { WaterCard } from '@/components/Water';
import { Logo } from '@/components/Logo';
import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, Copy, Droplet, Drumstick, Flame, Plus, Wheat } from 'lucide-react';
import { useStore, goalOn } from '@/store/useStore';
import { useDay, useFoodLookup } from '@/lib/hooks';
import { addDays, fromKey, relativeDay, todayKey, weekOf } from '@/lib/dates';
import { sumEntries, type Totals } from '@/lib/nutrition';
import { dailyTargets, type Targets } from '@/lib/energy';
import { DV_NOTE, MacroBar, NutrientList } from '@/components/Nutrients';
import type { Food, LogEntry } from '@/lib/types';
import { SleepCard } from '@/components/Sleep';
import { Pill, Ring, Sheet, cx, fmt } from '@/components/ui';
import { BrandName, CountUp, haptic, toast } from '@/components/fx';
import { EntryRow } from '@/components/EntryRow';
import { Suggestions } from '@/components/Suggestions';
import { QuickActions } from '@/components/QuickActions';
import { FoodSheet } from '@/components/FoodSheet';
import { NotificationBell } from '@/components/Notifications';
import { SaveMealButton } from '@/components/SavedMeals';
import { ExerciseList } from '@/components/LogMenu';


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
  const { streak } = useGoalStats(date);
  const gentle = useStore((s) => !!s.settings.gentle);
  const simple = useStore((s) => s.settings.tracking === 'simple');
  const photoDiary = useStore((s) => s.settings.tracking === 'photo');
  const quietAi = useStore((s) => !!s.settings.quietAi);

  const isToday = date === today;

  return (
    <div className="animate-fade-up">
      <header className="pt-safe pb-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 lg:invisible">
            <Logo size={30} />
            <BrandName className="text-[22px]" />
          </span>
          <span className="flex items-center gap-2">
            {!gentle && (
              <Link to="/insights" aria-label={`${streak}-day streak — see your progress`} className="transition active:scale-95">
                <Pill>
                  <Flame size={15} className="text-accent" fill="currentColor" fillOpacity={0.2} />
                  <span className="num">{streak}</span>
                </Pill>
              </Link>
            )}
            <NotificationBell />
          </span>
        </div>
      </header>

      {(goal > 400 || (profileWeight ?? 0) > 300) && (
        <Link to="/profile?edit=1" className="mb-4 flex items-center gap-3 rounded-[22px] bg-danger/10 p-4 text-danger">
          <span className="flex-1 text-sm font-medium">Your daily target ({fmt(goal)} g) looks too high — your body weight may be mistyped. Tap to fix it.</span>
          <span className="rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white">Fix</span>
        </Link>
      )}

      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[14px] font-semibold text-silver">{fromKey(date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        <Link to="/history?view=calendar" className="text-[14px] font-semibold text-accent">View all</Link>
      </div>
      <WeekStrip date={date} onSelect={setDate} />
      {!isToday && (
        <div className="mt-4 flex items-center gap-3 rounded-[22px] bg-accent/10 px-4 py-3">
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-accent">{date > today ? 'Planning' : 'Viewing'} {fromKey(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <Link to={`/add?date=${date}`} className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-sm font-bold text-white">{date > today ? '+ Plan food' : '+ Add food'}</Link>
          <button onClick={() => setDate(today)} className="shrink-0 text-sm font-semibold text-accent">Today</button>
        </div>
      )}
      {date <= today && <div className="mt-4"><QuickActions dateQuery={isToday ? "" : `?date=${date}`} /></div>}
      {isToday && <Restored />}
      {isToday && <WelcomeBack />}
      {isToday && <InstallBanner className="mt-4" />}

      <div className="lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-8">
      <div>
      {photoDiary ? <PhotoDiary entries={entries} date={date} /> : (
        <>
          <HeroCard totals={totals} goal={goal} targets={targets} entries={entries} burned={burned} addBurned={addBurned} />
          <MacroCards totals={totals} goal={goal} targets={targets} simple={simple} />
          <div className="mt-2 flex justify-end px-1"><Link to="/settings?edit=1" className="text-sm font-semibold text-accent">Edit targets</Link></div>
        </>
      )}
      </div>

      <section className="mt-8 lg:mt-5">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-[20px] font-bold tracking-tight">{isToday ? 'Recently eaten' : `${relativeDay(date)}`}</h2>
          {entries.length > 0 && (
            <span className="flex items-center gap-4">
              <SaveMealButton entries={entries} />
              <Link to={`/history?date=${date}`} className="text-sm font-semibold text-accent">Diary</Link>
            </span>
          )}
        </div>
        {entries.length === 0 ? (
          <>
          <Link to={`/add${!isToday ? `?date=${date}` : ''}`} className="card flex items-center gap-4 p-4 transition active:scale-[.99]">
            <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-primary text-on-primary"><Plus size={24} strokeWidth={2.6} /></span>
            <span>
              <span className="block font-semibold">You haven’t logged anything yet</span>
              <span className="block text-sm font-medium text-silver">Tap + to scan, search or describe a meal.</span>
            </span>
          </Link>
          {isToday && <CopyYesterday />}
          </>
        ) : (
          <div className="card p-2">
            {[...entries].reverse().map((e) => <EntryRow key={e.id} entry={e} onClick={() => setEditing(e)} />)}
          </div>
        )}
      </section>
      </div>

      <ExerciseList date={date} />
      {isToday && !quietAi && <div className="mt-2"><Suggestions remaining={Math.max(0, goal - totals.protein)} kcalLeft={targets ? targets.kcal - totals.kcal : undefined} /></div>}
      <WaterCard date={date} />
      <SleepCard date={date} />

      <FoodSheet food={editing ? entryAsFood(editing, lookup) : null} entry={editing ?? undefined} date={date} onClose={() => setEditing(null)} />
    </div>
  );
}

/**
 * The day's calorie gauge: a clean, flat arc on the green card — a soft track, a solid white
 * fill with round ends (amber when over). Without a calorie goal the track is dotted.
 */
function Gauge({ pct, over, hasGoal }: { pct: number; over: boolean; hasGoal: boolean }) {
  const R = 84, C = Math.PI * R; // half-circle arc length
  const arc = `M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`;
  return (
    <svg viewBox="0 0 200 112" className="w-full" aria-hidden>
      <path d={arc} fill="none" stroke="rgb(255 255 255 / 0.24)" strokeWidth="14" strokeLinecap="round" strokeDasharray={hasGoal ? undefined : '0.1 14.5'} />
      {hasGoal && pct > 0 && (
        <path d={arc} fill="none" stroke={over ? 'rgb(255 214 120)' : '#fff'} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} style={{ transition: 'stroke-dasharray .6s ease' }} />
      )}
    </svg>
  );
}

function HeroCard({ totals, goal, targets, entries, burned = 0, addBurned }: { totals: Totals; goal: number; targets: Targets | null; entries: LogEntry[]; burned?: number; addBurned?: boolean }) {
  const [allNutrients, setAllNutrients] = useState(false);
  void entries;
  // Show what's left (default) or what's been eaten; remembered.
  const view = useStore((s) => s.settings.dashView) ?? 'left';
  const updateSettings = useStore((s) => s.updateSettings);
  const showLeft = !!targets && view === 'left';
  const kcalLeft = targets ? targets.kcal - totals.kcal : 0;
  const kcalPct = targets ? totals.kcal / targets.kcal : 0;
  const over = targets && kcalLeft < 0;

  // Nutivili AI's signature: an evergreen "fuel gauge" for the day.
  const pct = Math.max(0, Math.min(1, kcalPct));
  return (
    <section className="mt-4 overflow-hidden rounded-[28px] px-5 pb-4 pt-4 text-white" style={{ background: 'linear-gradient(140deg, rgb(var(--hero-a)) 0%, rgb(var(--hero-b)) 60%, rgb(var(--hero-c)) 100%)', boxShadow: '0 14px 30px -14px rgb(var(--hero-b) / 0.55)' }}>
      <div className="relative mx-auto w-[200px]">
        <Gauge pct={pct} over={!!over} hasGoal={!!targets} />
        <div className="absolute inset-x-0 bottom-0 text-center">
          <CountUp value={showLeft ? Math.abs(Math.round(kcalLeft)) : Math.round(totals.kcal)} className={cx('num font-extrabold leading-none', Math.abs(kcalLeft) >= 10000 ? 'text-[30px]' : 'text-[36px]')} />
          <p className="mt-0.5 text-[12px] font-semibold opacity-90">{showLeft ? (over ? 'kcal over' : 'kcal left') : 'kcal eaten'}</p>
        </div>
      </div>
      {targets ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {showLeft
            ? <div><p className="num text-[15px] font-bold leading-tight">{fmt(totals.kcal)}{totals.incomplete.kcal && '*'}</p><p className="text-xs opacity-85">Eaten</p></div>
            : <div><p className="num text-[15px] font-bold leading-tight">{fmt(Math.abs(kcalLeft))}</p><p className="text-xs opacity-85">{over ? 'Over' : 'Left'}</p></div>}
          <div className="border-x border-white/25"><p className="num text-[15px] font-bold leading-tight">{fmt(targets.kcal)}</p><p className="text-xs opacity-85">Goal</p></div>
          <div><p className="num text-[15px] font-bold leading-tight">{burned > 0 ? `${addBurned ? '+' : ''}${fmt(burned)}` : '0'}</p><p className="text-xs opacity-85">Burned</p></div>
        </div>
      ) : (
        <Link to="/profile?edit=1" className="mt-3 block text-center text-sm font-semibold underline">Add height & age for a calorie goal</Link>
      )}
      {targets && (
        <div className="mx-auto mt-3 flex w-fit rounded-full bg-white/15 p-1" role="group" aria-label="Show calories">
          {(['eaten', 'left'] as const).map((v) => (
            <button key={v} onClick={() => updateSettings({ dashView: v })} aria-pressed={view === v} className={cx('h-8 rounded-full px-4 text-[13px] font-semibold transition', view === v ? 'bg-white text-[rgb(var(--hero-b))]' : 'text-white/90')}>{v === 'eaten' ? 'Consumed' : 'Remaining'}</button>
          ))}
        </div>
      )}
      {totals.incomplete.kcal && (
        <p className="mt-2 text-center text-[12px] leading-snug opacity-90">* Some food you logged has no calorie value in its source data, so this total may be low. Tap the food to check or add values.</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        {totals.protein >= goal && goal > 0 ? (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/20 px-2.5 text-xs font-semibold text-white"><Check size={13} strokeWidth={3} /> Protein goal hit</span>
        ) : <span />}
        <button onClick={() => setAllNutrients(true)} className="flex h-8 items-center gap-1 rounded-full bg-white/20 px-3 text-[13px] font-semibold text-white">Vitamins, minerals & more <ChevronRight size={15} /></button>
      </div>

      <Sheet open={allNutrients} onClose={() => setAllNutrients(false)} title="All nutrients">
        <div className="space-y-3">
          <MacroBar label="Protein" value={totals.protein} target={goal} color="protein" />
          <MacroBar label="Carbs" value={totals.carbs} target={targets?.carbs} color="carbs" incomplete={totals.incomplete.carbs} />
          <MacroBar label="Fat" value={totals.fat} target={targets?.fat} color="fat" incomplete={totals.incomplete.fat} />
          <MacroBar label="Fibre" value={totals.fiber} target={targets?.fiber} color="fiber" incomplete={totals.incomplete.fiber} />
        </div>
        <div className="mt-4"><NutrientList values={totals} incomplete={totals.incomplete} /></div>
        {Object.values(totals.incomplete).some(Boolean) && <p className="mt-3 text-[12px] leading-snug text-silver">* Some foods you logged have no value for this nutrient in their source data, so the total may be lower than what you really ate.</p>}
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
    // Up to four weeks ahead, for planning meals.
    const next = addDays(date, dir * 7);
    const limit = addDays(today, 28);
    onSelect(next > limit ? limit : next);
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
        const isToday = d === today;
        const planned = future && entries.some((e) => e.date === d && e.planned);
        return (
          <button key={d} onClick={() => { haptic(); onSelect(d); }} aria-label={`${fromKey(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${isToday ? ' (today)' : future ? ' (plan meals)' : ''}`} className="relative flex flex-col items-center gap-2">
            <span className={cx('text-[12px] font-semibold', isToday ? 'text-accent' : sel ? 'text-ink' : 'text-dim')}>
              {isToday ? 'Today' : fromKey(d).toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <Ring value={future ? 0 : v} size={40} stroke={3} dashed={future || v === 0} color={hit ? 'accent' : 'ink'} track="line">
              <span
                className={cx(
                  'num grid h-[30px] w-[30px] place-items-center rounded-full text-[14px] font-bold',
                  sel ? 'bg-primary text-on-primary' : isToday ? 'bg-accent/15 text-accent' : future ? 'text-dim' : 'text-ink',
                )}
              >
                {fromKey(d).getDate()}
              </span>
            </Ring>
            {planned && <span className="absolute -bottom-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
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
    for (const e of entries) if (!e.planned) totals.set(e.date, (totals.get(e.date) ?? 0) + (e.food.per100.protein * e.grams) / 100);
    const hit = (d: string) => {
      const g = goalOn(d, goalHistory, profile);
      return g > 0 && (totals.get(d) ?? 0) >= g;
    };
    let d = todayKey();
    if (!hit(d)) d = addDays(d, -1);
    let streak = 0;
    // Flexible streaks: one missed day in any 7 doesn't reset it, as long as the day before was hit.
    let lastFreeze = -99;
    for (let i = 0; i < 3650; i++) {
      if (hit(d)) { streak++; d = addDays(d, -1); continue; }
      const before = addDays(d, -1);
      if (streak > 0 && i - lastFreeze >= 7 && hit(before)) { lastFreeze = i; d = before; continue; }
      break;
    }
    const weekHits = weekOf(date).filter(hit).length;
    return { streak, weekHits };
  }, [entries, goalHistory, profile, date]);
}

export const useStreak = () => useGoalStats().streak;


/** Protein, carbs and fat as three bars in one card (grams left). */
function MacroCards({ totals, goal, targets, simple }: { totals: Totals; goal: number; targets: Targets | null; simple?: boolean }) {
  const eatenView = useStore((s) => s.settings.dashView) === 'eaten';
  const all = [
    { label: 'Protein', eaten: totals.protein, target: goal, color: 'rgb(var(--accent))', icon: Drumstick },
    { label: 'Carbs', eaten: totals.carbs, target: targets?.carbs ?? 0, color: 'rgb(var(--carbs))', icon: Wheat },
    { label: 'Fat', eaten: totals.fat, target: targets?.fat ?? 0, color: 'rgb(var(--fat))', icon: Droplet },
  ];
  const items = simple ? all.slice(0, 1) : all;
  return (
    <div className="card mt-3 space-y-4 p-5">
      {items.map((m) => {
        const left = m.target - m.eaten;
        return (
          <div key={m.label}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color }}><m.icon size={16} /></span>
              <p className="flex-1 text-[15px] font-semibold">{m.label}</p>
              {m.target && eatenView
                ? <p className="num text-[15px] font-bold">{fmt(m.eaten)}<span className="text-[13px] font-medium text-silver"> / {fmt(m.target)}g</span></p>
                : <p className="num text-[15px] font-bold">{m.target ? `${fmt(Math.abs(left))}g` : `${fmt(m.eaten)}g`}<span className="ml-1 text-[13px] font-medium text-silver">{m.target ? (left < 0 ? 'over' : 'left') : 'eaten'}</span></p>}
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, m.target ? (m.eaten / m.target) * 100 : 0)}%`, backgroundColor: m.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** After a few days away: a friendly restart, never a broken-streak scolding or a demand to backfill. */
function WelcomeBack() {
  const entries = useStore((s) => s.entries);
  const name = useStore((s) => s.profile?.name);
  const [hidden, setHidden] = useState(false);
  const last = useMemo(() => entries.reduce((m, e) => (e.date > m ? e.date : m), ''), [entries]);
  const today = todayKey();
  if (hidden || !last || last >= addDays(today, -2)) return null;
  return (
    <div className="card mt-4 p-5">
      <p className="text-[17px] font-bold">Welcome back{name ? `, ${name}` : ''}</p>
      <p className="mt-1 text-sm leading-relaxed text-silver">Good to see you. No need to fill in the days you missed — just pick up with your next meal. Your progress and history are all still here.</p>
      <div className="mt-4 flex gap-2">
        <Link to="/add" className="btn-primary !h-12 flex-1 text-sm">Log a meal</Link>
        <button onClick={() => setHidden(true)} className="btn-ghost !h-12 !px-5 text-sm">Not now</button>
      </div>
    </div>
  );
}

/** Same breakfast as yesterday? One tap copies yesterday's foods (same meals and weights) to today. */
function CopyYesterday() {
  const entries = useStore((s) => s.entries);
  const addEntry = useStore((s) => s.addEntry);
  const y = addDays(todayKey(), -1);
  const list = useMemo(() => entries.filter((e) => e.date === y), [entries, y]);
  if (!list.length) return null;
  const kcal = sumEntries(list).kcal;
  return (
    <button
      onClick={() => {
        haptic([10, 30, 10]);
        list.forEach((e) => addEntry({ date: todayKey(), meal: e.meal, food: { ...e.food, id: e.foodId, category: '', portions: [] } as Food, grams: e.grams }));
        toast(`Copied ${list.length} food${list.length > 1 ? 's' : ''} from yesterday — edit anything that changed`);
      }}
      className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface text-sm font-semibold"
      style={{ boxShadow: 'var(--shadow)' }}
    >
      <Copy size={16} /> Copy yesterday’s meals · {fmt(kcal)} kcal
    </button>
  );
}

/** After signing in to an account that already has answers: explain why setup was skipped, and offer to redo it. */
function Restored() {
  const [show, setShow] = useState(() => { try { return sessionStorage.getItem('provora-restored') === '1'; } catch { return false; } });
  if (!show) return null;
  const close = () => { try { sessionStorage.removeItem('provora-restored'); } catch { /* ignore */ } setShow(false); };
  return (
    <div className="card mt-4 p-5">
      <p className="text-[17px] font-bold">Welcome back</p>
      <p className="mt-1 text-sm leading-relaxed text-silver">This account already had your goals and history, so we restored them instead of asking the setup questions again.</p>
      <div className="mt-4 flex gap-2">
        <button onClick={close} className="btn-primary !h-12 flex-1 text-sm">Looks right</button>
        <button
          onClick={() => {
            if (!confirm('Answer the setup questions again? Your food log and history stay.')) return;
            close();
            useStore.setState({ profile: null });
          }}
          className="btn-ghost !h-12 !px-4 text-sm"
        >
          Redo setup
        </button>
      </div>
    </div>
  );
}
