import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, X } from 'lucide-react';
import { useFoodDb, useFoodLookup } from '@/lib/hooks';
import { searchFoods, splitName } from '@/lib/foods';
import { relativeDay, todayKey } from '@/lib/dates';
import { useStore } from '@/store/useStore';
import type { Food, PrepState } from '@/lib/types';
import { FoodSheet } from '@/components/FoodSheet';
import { FoodVisual } from '@/components/FoodIcon';
import { StateBadge, cx, fmt } from '@/components/ui';

const STATES: { value: PrepState | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'raw', label: 'Raw' },
  { value: 'cooked', label: 'Cooked' },
  { value: 'dry', label: 'Dry' },
];

type Tab = 'picks' | 'recent' | 'favs' | 'custom';
const TABS: [Tab, string][] = [['recent', 'Recent'], ['picks', 'High protein'], ['favs', 'Favourites'], ['custom', 'My foods']];

export default function AddFood() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const date = params.get('date') ?? todayKey();
  const { db, error } = useFoodDb();
  const lookup = useFoodLookup();
  const custom = useStore((s) => s.customFoods);
  const recentIds = useStore((s) => s.recentFoodIds);
  const favIds = useStore((s) => s.favoriteFoodIds);

  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [state, setState] = useState<PrepState | 'all'>('all');
  const [tab, setTab] = useState<Tab>(recentIds.length ? 'recent' : 'picks');
  const [selected, setSelected] = useState<Food | null>(null);
  const searching = !!dq.trim();

  const results = useMemo(() => (db && searching ? searchFoods(dq, { state, custom }) : []), [db, dq, searching, state, custom]);
  const browse = useMemo(() => {
    const ids = tab === 'recent' ? recentIds : tab === 'favs' ? favIds : [];
    const list =
      tab === 'picks' ? db?.quickPicks ?? []
      : tab === 'custom' ? custom.filter((c) => !c.archived)
      : (ids.map(lookup).filter(Boolean) as Food[]);
    return state === 'all' ? list : list.filter((f) => f.state === state);
  }, [tab, db, custom, recentIds, favIds, lookup, state]);

  const list = searching ? results : browse;
  const back = () => nav(date === todayKey() ? '/' : `/?date=${date}`);

  return (
    <div className="animate-fade-up">
      <header className="pt-safe flex items-center justify-between pb-5">
        <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.4} />
        </button>
        <span className="text-sm font-bold text-silver">{relativeDay(date)}</span>
      </header>

      <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-tight">What did<br />you eat?</h1>

      <div className="sticky top-0 z-20 -mx-5 mt-5 bg-bg/90 px-5 pb-3 pt-2 backdrop-blur-xl">
        <div className="relative">
          <Search size={20} strokeWidth={2.4} className="absolute left-5 top-1/2 -translate-y-1/2 text-ink" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search foods"
            className="h-14 w-full rounded-full bg-surface pl-14 pr-12 font-semibold outline-none placeholder:font-medium placeholder:text-dim focus:ring-2 focus:ring-ink/80"
            style={{ boxShadow: 'var(--shadow)' }}
            enterKeyHint="search"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-raised" aria-label="Clear search">
              <X size={15} strokeWidth={2.6} />
            </button>
          )}
        </div>
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          {searching
            ? STATES.map((s) => (
                <button key={s.value} onClick={() => setState(s.value)} className={cx('chip', state === s.value && 'chip-on')}>{s.label}</button>
              ))
            : TABS.map(([v, l]) => (
                <button key={v} onClick={() => setTab(v)} className={cx('chip', tab === v && 'chip-on')}>{l}</button>
              ))}
        </div>
      </div>

      {error && <p className="card p-4 text-sm font-semibold text-danger">{error}</p>}
      {!db && !error && (
        <p className="flex items-center justify-center gap-2 py-12 font-semibold text-silver"><Loader2 className="animate-spin" size={18} /> Loading foods…</p>
      )}

      {db && list.length > 0 && (
        <div className="card mt-1 p-1.5">
          {list.map((f) => <FoodRow key={f.id} food={f} onClick={() => setSelected(f)} />)}
        </div>
      )}
      {db && list.length === 0 && (
        <p className="py-14 text-center text-sm font-semibold text-silver">
          {searching ? `No matches for “${dq}”` : tab === 'recent' ? 'Foods you log show up here.' : tab === 'favs' ? 'Star a food to keep it here.' : tab === 'custom' ? 'No custom foods yet.' : 'Nothing here.'}
        </p>
      )}

      {db && <p className="mt-6 text-center text-[11px] font-medium text-dim">Nutrition data · {db.source.name}</p>}

      <FoodSheet food={selected} date={date} onClose={() => setSelected(null)} onSaved={back} onSwitchFood={setSelected} />
    </div>
  );
}

function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  const { title, detail } = splitName(food.name);
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3.5 rounded-[22px] p-3 text-left transition active:scale-[.99] active:bg-raised/60">
      <FoodVisual name={food.name} category={food.category} size={52} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-bold leading-snug">{title}</p>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <StateBadge state={food.state} className="shrink-0" />
          {food.source === 'custom' && <span className="shrink-0 rounded-full bg-raised px-2 text-[10px] font-bold uppercase leading-5 text-silver">Mine</span>}
          {detail && <span className="truncate text-xs font-medium text-silver">{detail}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-lg font-extrabold leading-none">{fmt(food.per100.protein, 1)}<span className="text-xs text-silver">g</span></p>
        <p className="mt-1 text-[10px] font-semibold text-dim">per 100g</p>
      </div>
    </button>
  );
}
