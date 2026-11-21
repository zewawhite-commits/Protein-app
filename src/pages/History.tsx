import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Copy, Plus, Dumbbell, FileText, Images, MessageCircle, Scale, Search, UtensilsCrossed } from 'lucide-react';
import { pastChats } from '@/lib/chats';
import { useStore, goalOn } from '@/store/useStore';
import { useFoodLookup, usePhotoUrl } from '@/lib/hooks';
import { sumEntries, nutrientsFor } from '@/lib/nutrition';
import { addDays, formatDay, fromKey, relativeDay, toKey, todayKey } from '@/lib/dates';
import { splitName } from '@/lib/foods';
import type { LogEntry } from '@/lib/types';
import { Empty, PageHeader, Ring, Segmented, cx, fmt } from '@/components/ui';
import { FoodSheet } from '@/components/FoodSheet';
import { EntryRow } from '@/components/EntryRow';
import { dailyTargets } from '@/lib/energy';
import { mealLabel, useMealOptions } from '@/lib/meals';
import { entryAsFood } from './Today';
import { toast } from '@/components/fx';
import type { Meal } from '@/lib/types';

/** Log a whole meal from another day again today, with an undo. */
function copyMeal(list: LogEntry[], meal: Meal, label: string) {
  const { addEntry, removeEntry } = useStore.getState();
  const today = todayKey();
  const made = list.map((e) => addEntry({ date: today, meal, food: { ...e.food, id: e.foodId } as never, grams: e.grams }));
  toast(`${label} copied to today · ${made.length} item${made.length === 1 ? '' : 's'}`, { action: { label: 'Undo', run: () => made.forEach((x) => removeEntry(x.id)) } });
}

export default function History() {
  const [params] = useSearchParams();
  const v = params.get('view');
  const [view, setView] = useState<'day' | 'calendar' | 'days' | 'photos'>(v === 'calendar' || v === 'days' || v === 'photos' ? v : 'day');
  const [q, setQ] = useState('');
  return (
    <div className="animate-fade-up">
      <PageHeader title="Diary" />
      <div className="mb-4"><Segmented full value={view} onChange={setView} options={[{ value: 'day', label: 'Day' }, { value: 'calendar', label: 'Calendar' }, { value: 'days', label: 'All days' }, { value: 'photos', label: 'Photos' }]} /></div>
      {view === 'days' && (
        <div className="relative mb-5">
          <Search size={18} strokeWidth={2.4} className="absolute left-5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a food"
            className="h-12 w-full rounded-full bg-surface pl-12 pr-4 font-semibold outline-none placeholder:font-medium placeholder:text-dim focus:ring-2 focus:ring-ink/80"
            style={{ boxShadow: 'var(--shadow)' }}
          />
        </div>
      )}
      {view === 'day' ? <DayDiary initial={params.get('date') ?? todayKey()} /> : view === 'calendar' ? <><MonthCalendar /><EverythingElse /></> : view === 'days' ? <Days query={q} /> : <Photos />}
    </div>
  );
}

/**
 * One day of eating, meal by meal: what was eaten, how much, its calories and protein (carbs
 * and fat too in Detailed mode), the day's totals against targets, and + to add to any meal
 * on any day. Every entry can be opened to edit or deleted straight from the list.
 */
function DayDiary({ initial }: { initial: string }) {
  const [date, setDate] = useState(initial);
  const today = todayKey();
  const all = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const goalHistory = useStore((s) => s.goalHistory);
  const tracking = useStore((s) => s.settings.tracking ?? 'detailed');
  const meals = useMealOptions();
  const lookup = useFoodLookup();
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const entries = useMemo(() => all.filter((e) => e.date === date), [all, date]);
  const eaten = entries.filter((e) => !e.planned);
  const totals = sumEntries(eaten);
  const goal = goalOn(date, goalHistory, profile);
  const targets = profile ? dailyTargets(profile, goal) : null;
  const detailed = tracking === 'detailed';
  const shown = meals.filter((m) => m.value === 'breakfast' || m.value === 'lunch' || m.value === 'dinner' || entries.some((e) => e.meal === m.value) || m.value.startsWith('snack'));
  const extra = [...new Set(entries.map((e) => e.meal))].filter((m) => !shown.some((x) => x.value === m));
  const stat = (label: string, v: number, t?: number, unit = 'g') => (
    <div className="rounded-2xl bg-raised px-3 py-2">
      <p className="text-[12px] font-semibold text-silver">{label}</p>
      <p className="num text-[17px] font-bold leading-tight">{fmt(v)}<span className="text-[12px] font-semibold text-silver">{t ? ` / ${fmt(t)}` : ''} {unit}</span></p>
    </div>
  );
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => setDate(addDays(date, -1))} className="grid h-10 w-10 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Previous day"><ChevronLeft size={18} /></button>
        <label className="relative flex-1 text-center">
          <span className="block text-[17px] font-bold">{relativeDay(date)}</span>
          <span className="block text-xs text-silver">{fromKey(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <input type="date" value={date} max={addDays(today, 28)} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Pick a date" />
        </label>
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= addDays(today, 28)} className="grid h-10 w-10 place-items-center rounded-full bg-surface disabled:opacity-40" style={{ boxShadow: 'var(--shadow)' }} aria-label="Next day"><ChevronRight size={18} /></button>
      </div>
      {date !== today && <button onClick={() => setDate(today)} className="mb-3 w-full text-sm font-semibold text-accent">Back to today</button>}

      <div className={cx('card grid gap-2 p-3', detailed ? 'grid-cols-2' : 'grid-cols-2')}>
        {stat('Calories', totals.kcal, targets?.kcal, 'kcal')}
        {stat('Protein', totals.protein, goal)}
        {detailed && stat('Carbs', totals.carbs, targets?.carbs)}
        {detailed && stat('Fat', totals.fat, targets?.fat)}
      </div>

      <div className="mt-4 space-y-3">
        {[...shown, ...extra.map((m) => ({ value: m, label: mealLabel(m) }))].map((m) => {
          const list = entries.filter((e) => e.meal === m.value);
          const t = sumEntries(list.filter((e) => !e.planned));
          return (
            <section key={m.value} className="card p-2">
              <div className="flex items-center justify-between px-3 pt-2">
                <div>
                  <p className="text-[16px] font-bold">{m.label}</p>
                  {list.length > 0 && <p className="num text-xs text-silver">{fmt(t.kcal)} kcal · {fmt(t.protein)} g protein{detailed ? ` · C ${fmt(t.carbs)} · F ${fmt(t.fat)}` : ''}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  {date !== todayKey() && list.some((e) => !e.planned) && (
                    <button onClick={() => copyMeal(list.filter((e) => !e.planned), m.value, m.label)} className="chip !h-9 !px-3 text-[13px]" aria-label={`Copy ${m.label} to today`}><Copy size={14} /> Copy to today</button>
                  )}
                  <Link to={`/add?date=${date}&meal=${m.value}`} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-on-primary" aria-label={`Add to ${m.label}`}><Plus size={18} /></Link>
                </div>
              </div>
              {list.length === 0 ? <p className="px-3 pb-3 pt-1 text-sm text-dim">Nothing logged</p> : list.map((e) => <EntryRow key={e.id} entry={e} onClick={() => setEditing(e)} />)}
            </section>
          );
        })}
      </div>
      <FoodSheet food={editing ? entryAsFood(editing, lookup) : null} entry={editing ?? undefined} date={date} onClose={() => setEditing(null)} />
    </div>
  );
}

/**
 * The whole month at a glance: each day shows how close protein came to the goal; days ahead
 * show a dot when meals are planned. Tap any day (up to four weeks ahead) to open it.
 */
function MonthCalendar() {
  const entries = useStore((s) => s.entries);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  const nav = useNavigate();
  const today = todayKey();
  const limit = addDays(today, 28);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const byDay = useMemo(() => {
    const m = new Map<string, LogEntry[]>();
    for (const e of entries) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [entries]);
  const first = toKey(month);
  const lead = (month.getDay() + 6) % 7; // Monday first
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => addDays(first, i))];
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const canNext = toKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)) <= limit;
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-raised" aria-label="Previous month"><ChevronLeft size={18} /></button>
        <p className="text-[17px] font-bold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        <button onClick={() => canNext && shift(1)} disabled={!canNext} className="grid h-10 w-10 place-items-center rounded-full bg-raised disabled:opacity-30" aria-label="Next month"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-y-2 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="text-[12px] font-semibold text-dim">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const list = byDay.get(d) ?? [];
          const eaten = list.filter((e) => !e.planned);
          const g = goalOn(d, goalHistory, profile);
          const v = g ? sumEntries(eaten).protein / g : 0;
          const future = d > today;
          const planned = list.some((e) => e.planned);
          const isToday = d === today;
          const tooFar = d > limit;
          return (
            <button key={d} disabled={tooFar} onClick={() => nav(d === today ? '/' : `/?date=${d}`)} className="relative mx-auto grid place-items-center disabled:opacity-30" aria-label={`${formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}${isToday ? ' (today)' : ''}`}>
              <Ring value={future ? 0 : v} size={40} stroke={3} dashed={future || !eaten.length} color={v >= 1 ? 'accent' : 'ink'} track="line">
                <span className={cx('num grid h-[30px] w-[30px] place-items-center rounded-full text-[14px] font-bold', isToday ? 'bg-primary text-on-primary' : future ? 'text-silver' : 'text-ink')}>{fromKey(d).getDate()}</span>
              </Ring>
              {planned && <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-[13px] text-silver">Tap a day to see it. Days ahead let you plan meals; a dot means meals are planned.</p>
    </section>
  );
}

function Days({ query }: { query: string }) {
  const entries = useStore((s) => s.entries);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  const days = useMemo(() => {
    const ql = query.trim().toLowerCase();
    const map = new Map<string, LogEntry[]>();
    for (const e of entries) {
      if (ql && !e.food.name.toLowerCase().includes(ql)) continue;
      map.set(e.date, [...(map.get(e.date) ?? []), e]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => ({ date, list, protein: sumEntries(list).protein, goal: goalOn(date, goalHistory, profile) }));
  }, [entries, goalHistory, profile, query]);

  if (!days.length)
    return <Empty icon={<CalendarDays size={22} />} title={query ? 'No matches' : 'No history yet'} body={query ? undefined : 'Days you log show up here.'} />;

  const months = new Map<string, typeof days>();
  for (const d of days) {
    const k = formatDay(d.date, { month: 'long', year: 'numeric' });
    months.set(k, [...(months.get(k) ?? []), d]);
  }

  return (
    <div className="space-y-6">
      {[...months.entries()].map(([month, list]) => (
        <section key={month}>
          <p className="mb-3 px-1 text-sm font-semibold text-silver">{month}</p>
          <div className="card p-2">
            {list.map(({ date, list: es, protein, goal }) => {
              const v = goal ? protein / goal : 0;
              const hit = v >= 1;
              const names = [...new Set(es.map((e) => splitName(e.food.name).title.split(',')[0]))].slice(0, 3).join(', ');
              return (
                <Link key={date} to={date === todayKey() ? '/' : `/?date=${date}`} className="flex items-center gap-3.5 rounded-[22px] p-3 transition active:bg-raised/60">
                  <Ring value={v} size={52} stroke={4.5} color={hit ? 'accent' : 'ink'} track="raised">
                    <span className="num text-base font-bold">{Number(date.slice(8))}</span>
                  </Ring>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{relativeDay(date)}</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-silver">{names}</p>
                  </div>
                  <div className="text-right">
                    <p className="num text-lg font-bold leading-none">{fmt(sumEntries(es).kcal)}<span className="text-xs text-silver"> kcal</span></p>
                    <p className={cx('num mt-1 text-[12px] font-semibold', hit ? 'text-accent' : 'text-dim')}>{fmt(protein)}/{fmt(goal)} g protein</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-dim" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Photos() {
  const entries = useStore((s) => s.entries);
  const lookup = useFoodLookup();
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const withPhotos = useMemo(() => entries.filter((e) => e.photoId).sort((a, b) => b.loggedAt - a.loggedAt), [entries]);
  if (!withPhotos.length) return <Empty icon={<Images size={22} />} title="No photos yet" body="Add a photo when you log food." />;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {withPhotos.map((e) => <PhotoTile key={e.id} entry={e} onClick={() => setEditing(e)} />)}
      </div>
      <FoodSheet food={editing ? entryAsFood(editing, lookup) : null} entry={editing ?? undefined} date={editing?.date ?? todayKey()} onClose={() => setEditing(null)} />
    </>
  );
}

function PhotoTile({ entry, onClick }: { entry: LogEntry; onClick: () => void }) {
  const url = usePhotoUrl(entry.photoId);
  const p = nutrientsFor(entry.food.per100, entry.grams).protein;
  return (
    <button onClick={onClick} className="group relative aspect-[4/5] overflow-hidden rounded-[24px] bg-raised">
      {url && <img src={url} alt={entry.food.name} className="h-full w-full object-cover transition group-hover:scale-105" />}
      <div className="absolute inset-x-2 bottom-2 rounded-[18px] bg-black/45 p-2.5 text-left text-white backdrop-blur-md">
        <p className="truncate text-xs font-semibold">{splitName(entry.food.name).title}</p>
        <p className="num mt-0.5 text-[12px] font-semibold opacity-80">{fmt(p, 1)}g protein · {relativeDay(entry.date)}</p>
      </div>
    </button>
  );
}

/** Everything else they've done, in one place: meal preps, workouts, weigh-ins, charts, plans, recipes, chats. */
export function EverythingElse({ title = "Everything else", onProgress = false }: { title?: string; onProgress?: boolean }) {
  const s = useStore();
  const chats = pastChats();
  const workouts = s.workoutLogs.length + s.exercises.filter((e) => !s.workoutLogs.some((w) => w.date === e.date)).length;
  const rows: { to: string; icon: typeof Scale; title: string; note: string; recent?: { to: string; label: string }[] }[] = [
    { to: '/add?tab=saved', icon: UtensilsCrossed, title: 'Saved meals & meal preps', note: count(s.savedMeals.length, 'saved meal'), recent: s.savedMeals.slice(0, 3).map((m) => ({ to: '/add?tab=saved', label: m.name })) },
    { to: '/workout', icon: Dumbbell, title: 'Workouts', note: count(workouts, 'workout'), recent: [...s.workoutLogs].sort((a, b) => b.startedAt - a.startedAt).slice(0, 3).map((w) => ({ to: '/workout', label: `${w.name} · ${relativeDay(w.date)}` })) },
    { to: '/insights', icon: Scale, title: 'Weight & body', note: s.weights.length ? `${count(s.weights.length, 'weigh-in')}${s.measurements.length ? ` · ${count(s.measurements.length, 'measurement')}` : ''}${s.progressPhotos.length ? ` · ${count(s.progressPhotos.length, 'progress photo')}` : ''}` : 'No weigh-ins yet' },
    { to: '/insights', icon: BarChart3, title: 'Charts & trends', note: 'Calories, macros, protein and weight over time' },
    { to: '/coach?view=plan', icon: ClipboardList, title: 'Meal plans', note: count(s.savedPlans.length, 'saved plan'), recent: s.savedPlans.slice(0, 3).map((p) => ({ to: `/coach?view=plan&open=${p.id}`, label: p.title })) },
    { to: '/coach?view=recipe', icon: BookOpen, title: 'Recipes', note: count(s.savedRecipes.length, 'saved recipe'), recent: s.savedRecipes.slice(0, 3).map((r) => ({ to: `/coach?view=recipe&open=${r.id}`, label: r.recipe.title })) },
    { to: '/coach', icon: MessageCircle, title: 'Coach chats', note: count(chats.length, 'chat'), recent: chats.slice(0, 3).map((c) => ({ to: `/coach?chat=${c.id}`, label: c.title })) },
    { to: '/reports', icon: FileText, title: 'Reports', note: 'Any dates, to share or print' },
  ];
  // On the Progress page the graphs and weight are already above, so the food diary takes their place.
  const days = new Set(s.entries.map((e) => e.date)).size;
  const list = onProgress ? [{ to: '/history', icon: CalendarDays, title: 'Food diary', note: days ? `${days} day${days === 1 ? '' : 's'} logged — every meal, by date` : 'Every meal, by date' }, ...rows.filter((r) => r.to !== '/insights')] : rows;
  return (
    <section className="mt-6">
      <p className="mb-2 px-1 text-[15px] font-semibold">{title}</p>
      <div className="card divide-y divide-line">
        {list.map((r) => (
          <div key={r.title} className="px-4 py-3">
            <Link to={r.to} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised"><r.icon size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{r.title}</span><span className="block truncate text-[13px] text-silver">{r.note}</span></span>
              <ChevronRight size={16} className="shrink-0 text-dim" />
            </Link>
            {!!r.recent?.length && (
              <div className="ml-[52px] mt-2 flex flex-wrap gap-1.5">
                {r.recent.map((x, i) => <Link key={i} to={x.to} className="chip !h-8 max-w-full !px-3 text-[13px]"><span className="truncate">{x.label}</span></Link>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const count = (n: number, word: string) => (n === 0 ? `No ${word}s yet` : `${n} ${word}${n === 1 ? '' : 's'}`);
