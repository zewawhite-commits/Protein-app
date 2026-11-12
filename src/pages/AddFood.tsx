import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { useFoodDb, useFoodLookup } from '@/lib/hooks';
import { searchFoods, splitName } from '@/lib/foods';
import { relativeDay, todayKey } from '@/lib/dates';
import { useStore } from '@/store/useStore';
import type { Food, PrepState } from '@/lib/types';
import { FoodSheet } from '@/components/FoodSheet';
import { StateBadge, cx, fmt } from '@/components/ui';

const STATES: { value: PrepState | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'raw', label: 'Raw' },
  { value: 'cooked', label: 'Cooked' },
  { value: 'dry', label: 'Dry' },
  { value: 'na', label: 'As sold' },
];

type Tab = 'picks' | 'recent' | 'favs' | 'custom';

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

  const results = useMemo(() => (db && dq.trim() ? searchFoods(dq, { state, custom }) : []), [db, dq, state, custom]);
  const browse = useMemo(() => {
    const ids = tab === 'recent' ? recentIds : tab === 'favs' ? favIds : [];
    const list =
      tab === 'picks' ? db?.quickPicks ?? []
      : tab === 'custom' ? custom.filter((c) => !c.archived)
      : (ids.map(lookup).filter(Boolean) as Food[]);
    return state === 'all' ? list : list.filter((f) => f.state === state);
  }, [tab, db, custom, recentIds, favIds, lookup, state]);

  const list = dq.trim() ? results : browse;
  const back = () => nav(date === todayKey() ? '/' : `/?date=${date}`);

  return (
    <div className="animate-fade-up">
      <header className="pt-safe pb-4">
        <div className="flex items-center gap-3">
          <button onClick={back} className="grid h-10 w-10 place-items-center rounded-full bg-surface border border-line" aria-label="Back"><ArrowLeft size={18} /></button>
          <div>
            <p className="eyebrow">Log food · {relativeDay(date)}</p>
            <h1 className="text-[22px] font-semibold tracking-tight">What did you eat?</h1>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 pb-3 pt-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 7,000+ foods — e.g. chicken breast"
            className="field !h-14 !rounded-full pl-11 pr-11"
            enterKeyHint="search"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-line/70 text-silver" aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {STATES.map((s) => (
            <button key={s.value} onClick={() => setState(s.value)} className={cx('chip', state === s.value && 'chip-on')}>{s.label}</button>
          ))}
        </div>
      </div>

      {!dq.trim() && (
        <div className="mb-3 mt-1 flex gap-5 border-b border-line text-sm">
          {([['recent', 'Recent'], ['favs', 'Favourites'], ['picks', 'High protein'], ['custom', 'Custom']] as [Tab, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={cx('-mb-px border-b-2 pb-2.5 font-medium transition', tab === v ? 'border-accent text-ink' : 'border-transparent text-dim')}>{l}</button>
          ))}
        </div>
      )}

      {error && <p className="card p-4 text-sm text-danger">{error}</p>}
      {!db && !error && (
        <p className="flex items-center gap-2 py-10 justify-center text-silver"><Loader2 className="animate-spin" size={18} /> Loading food database…</p>
      )}

      {db && (
        <ul className="space-y-1">
          {list.map((f) => (
            <li key={f.id}><FoodRow food={f} onClick={() => setSelected(f)} /></li>
          ))}
          {list.length === 0 && (
            <li className="py-12 text-center text-sm text-silver">
              {dq.trim() ? <>No matches for “{dq}”{state !== 'all' && ' with this filter'}.<br /><span className="text-dim">Try fewer or more general words.</span></>
                : tab === 'recent' ? 'Foods you log will appear here.'
                : tab === 'favs' ? 'Tap the star on any food to keep it here.'
                : tab === 'custom' ? 'No custom records yet. Admins can add them in Profile → Admin.'
                : 'Nothing here.'}
            </li>
          )}
        </ul>
      )}

      {db && (
        <p className="mt-8 text-center text-[11px] leading-relaxed text-dim">
          Nutrition data: {db.source.name} ({db.source.release}), {db.source.basis}.
        </p>
      )}

      <FoodSheet food={selected} date={date} onClose={() => setSelected(null)} onSaved={back} onSwitchFood={setSelected} />
    </div>
  );
}

function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  const { title, detail } = splitName(food.name);
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 -mx-3 text-left transition hover:bg-surface active:bg-raised">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <div className="mt-1 flex items-center gap-2 min-w-0">
          <StateBadge state={food.state} className="shrink-0" />
          {food.source === 'custom' && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-silver">Custom</span>}
          {detail && <span className="truncate text-xs text-silver">{detail}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">{fmt(food.per100.protein, 1)} g</p>
        <p className="text-[10px] text-dim">per 100 g</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-dim" />
    </button>
  );
}
