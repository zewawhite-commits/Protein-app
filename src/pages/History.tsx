import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Images, Search } from 'lucide-react';
import { useStore, goalOn } from '@/store/useStore';
import { useFoodLookup, usePhotoUrl } from '@/lib/hooks';
import { sumEntries, nutrientsFor } from '@/lib/nutrition';
import { formatDay, relativeDay, todayKey } from '@/lib/dates';
import { splitName } from '@/lib/foods';
import type { LogEntry } from '@/lib/types';
import { Empty, PageHeader, Ring, Segmented, cx, fmt } from '@/components/ui';
import { FoodSheet } from '@/components/FoodSheet';
import { entryAsFood } from './Today';

export default function History() {
  const [view, setView] = useState<'days' | 'photos'>('days');
  const [q, setQ] = useState('');
  return (
    <div className="animate-fade-up">
      <PageHeader title="History" right={<Segmented value={view} onChange={setView} options={[{ value: 'days', label: 'Days' }, { value: 'photos', label: 'Photos' }]} />} />
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
