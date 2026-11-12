import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Images, Search } from 'lucide-react';
import { useStore, goalOn } from '@/store/useStore';
import { useFoodLookup, usePhotoUrl } from '@/lib/hooks';
import { sumEntries, nutrientsFor } from '@/lib/nutrition';
import { formatDay, relativeDay, todayKey } from '@/lib/dates';
import { splitName } from '@/lib/foods';
import type { LogEntry } from '@/lib/types';
import { Empty, PageHeader, Segmented, cx, fmt } from '@/components/ui';
import { Thumb } from '@/components/EntryRow';
import { FoodSheet } from '@/components/FoodSheet';
import { entryAsFood } from './Today';

export default function History() {
  const [view, setView] = useState<'days' | 'photos'>('days');
  const [q, setQ] = useState('');
  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Your log" title="History" right={<Segmented value={view} onChange={setView} options={[{ value: 'days', label: 'Days' }, { value: 'photos', label: 'Photos' }]} />} />
      {view === 'days' && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a food in your history" className="field !rounded-full pl-10" />
        </div>
      )}
      {view === 'days' ? <Days query={q} /> : <Photos />}
    </div>
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
    return <Empty icon={<CalendarDays size={22} />} title={query ? 'No matching entries' : 'No history yet'} body={query ? undefined : 'Every day you log food shows up here.'} />;

  // Group by month
  const months = new Map<string, typeof days>();
  for (const d of days) {
    const k = formatDay(d.date, { month: 'long', year: 'numeric' });
    months.set(k, [...(months.get(k) ?? []), d]);
  }

  return (
    <div className="space-y-6">
      {[...months.entries()].map(([month, list]) => (
        <section key={month}>
          <p className="eyebrow mb-2">{month}</p>
          <div className="card divide-y divide-line/50 overflow-hidden">
            {list.map(({ date, list: es, protein, goal }) => {
              const v = goal ? Math.min(1, protein / goal) : 0;
              const hit = goal > 0 && protein >= goal;
              const names = [...new Set(es.map((e) => splitName(e.food.name).title.split(',')[0]))].slice(0, 3).join(' · ');
              return (
                <Link key={date} to={date === todayKey() ? '/' : `/?date=${date}`} className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-raised/50">
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-xl font-semibold leading-none tabular-nums">{Number(date.slice(8))}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-dim">{formatDay(date, { weekday: 'short' })}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{relativeDay(date)}</p>
                      <p className="text-sm tabular-nums"><span className={cx('font-semibold', hit && 'text-accent')}>{fmt(protein)}</span><span className="text-dim"> / {fmt(goal)} g</span></p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${v * 100}%` }} />
                    </div>
                    <p className="mt-1.5 truncate text-xs text-silver">{es.length} items · {names}</p>
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
  if (!withPhotos.length)
    return <Empty icon={<Images size={22} />} title="No photos yet" body="Add a photo when you log food — take one with the camera or pick from your gallery." />;
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
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
    <button onClick={onClick} className="group relative aspect-square overflow-hidden rounded-2xl bg-raised">
      {url ? <img src={url} alt={entry.food.name} className="h-full w-full object-cover transition group-hover:scale-105" /> : <Thumb />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-left text-white">
        <p className="text-xs font-semibold tabular-nums">{fmt(p, 1)} g</p>
        <p className="truncate text-[10px] opacity-75">{relativeDay(entry.date)}</p>
      </div>
    </button>
  );
}
