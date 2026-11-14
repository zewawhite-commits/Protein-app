import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Globe2, Heart, Loader2, Search, Sparkles, X } from 'lucide-react';
import { haptic, toast } from '@/components/fx';
import { useFoodDb, useFoodLookup, usePhotoUrl } from '@/lib/hooks';
import { SOURCE_SHORT, searchFoods, splitName } from '@/lib/foods';
import { searchProducts } from '@/lib/openFoodFacts';
import { deletePhoto } from '@/lib/photos';
import { fitsDiet } from '@/lib/goals';
import { relativeDay, todayKey } from '@/lib/dates';
import { useStore } from '@/store/useStore';
import type { Food, PrepState } from '@/lib/types';
import { FoodSheet } from '@/components/FoodSheet';
import { FoodVisual } from '@/components/FoodIcon';
import { WorldFoods } from '@/components/WorldFoods';
import { FOOD_PHOTOS } from '@/data/foodPhotos';
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
  const photoId = params.get('photo') ?? undefined;
  const photoUrl = usePhotoUrl(photoId);
  const { db, error } = useFoodDb();
  const lookup = useFoodLookup();
  const custom = useStore((s) => s.customFoods);
  const recentIds = useStore((s) => s.recentFoodIds);
  const favIds = useStore((s) => s.favoriteFoodIds);
  const diet = useStore((s) => s.profile?.diet);

  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDeferredValue(q);
  const [state, setState] = useState<PrepState | 'all'>('all');
  const [tab, setTab] = useState<Tab>(recentIds.length ? 'recent' : 'picks');
  const [selected, setSelected] = useState<Food | null>(null);
  const searching = !!dq.trim();

  // A photo handed over from the camera is discarded if nothing gets logged with it.
  useEffect(() => () => {
    if (photoId && !useStore.getState().entries.some((e) => e.photoId === photoId)) void deletePhoto(photoId);
  }, [photoId]);

  const results = useMemo(() => (db && searching ? searchFoods(dq, { state, custom }) : []), [db, dq, searching, state, custom]);
  const browse = useMemo(() => {
    const ids = tab === 'recent' ? recentIds : tab === 'favs' ? favIds : [];
    const list =
      tab === 'picks' ? (db?.quickPicks ?? []).filter((f) => fitsDiet(f, diet))
      : tab === 'custom' ? custom.filter((c) => !c.archived)
      : (ids.map(lookup).filter(Boolean) as Food[]);
    return state === 'all' ? list : list.filter((f) => f.state === state);
  }, [tab, db, custom, recentIds, favIds, lookup, state, diet]);

  const list = searching ? results : browse;
  const back = () => nav(date === todayKey() ? '/' : `/?date=${date}`);
  const snapUrl = `/snap${date !== todayKey() ? `?date=${date}` : ''}`;

  return (
    <div className="animate-fade-up">
      <header className="pt-safe flex items-center justify-between pb-5">
        <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <span className="text-sm font-semibold text-silver">{relativeDay(date)}</span>
      </header>

      {photoUrl ? (
        <div className="relative mb-1 overflow-hidden rounded-[28px]" style={{ aspectRatio: '16 / 9' }}>
          <img src={photoUrl} alt="Your meal" className="h-full w-full object-cover" />
          <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">Photo attached · pick the food</span>
        </div>
      ) : (
        <h1 className="text-[30px] font-semibold leading-[1.08] tracking-tight">What did<br />you eat?</h1>
      )}

      <div className="sticky top-0 z-20 -mx-5 mt-4 bg-bg/90 px-5 pb-3 pt-2 backdrop-blur-xl">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={19} strokeWidth={2.2} className="absolute left-5 top-1/2 -translate-y-1/2 text-silver" />
            <input
              autoFocus={!!photoId || !!params.get('q')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search any food or dish"
              className="h-14 w-full rounded-full bg-surface pl-13 pr-12 font-medium outline-none placeholder:text-dim focus:ring-2 focus:ring-ink/70"
              style={{ boxShadow: 'var(--shadow)', paddingLeft: '3.25rem' }}
              enterKeyHint="search"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-raised" aria-label="Clear search">
                <X size={15} strokeWidth={2.4} />
              </button>
            )}
          </div>
          {!photoId && (
            <Link to={snapUrl} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-on-primary" aria-label="Snap a photo">
              <Camera size={22} />
            </Link>
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

      {!searching && !photoId && (
        <Link to={snapUrl} className="relative mb-4 mt-1 block overflow-hidden rounded-[28px] bg-primary p-5 text-on-primary transition active:scale-[.99]">
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-accent/50 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-on-primary/10"><Camera size={26} /></span>
            <div>
              <p className="flex items-center gap-1.5 text-[17px] font-semibold">Snap your food <Sparkles size={15} className="text-accent" /></p>
              <p className="mt-0.5 text-[14px] opacity-70">Any dish, any cuisine. AI identifies it — you confirm and weigh.</p>
            </div>
          </div>
        </Link>
      )}

      {!searching && !photoId && <WorldFoods onSearch={(v) => { setQ(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}

      {error && <p className="card p-4 text-sm font-medium text-danger">{error}</p>}
      {!db && !error && (
        <p className="flex items-center justify-center gap-2 py-12 font-medium text-silver"><Loader2 className="animate-spin" size={18} /> Loading foods…</p>
      )}

      {db && !searching && tab === 'picks' && <PhotoCards foods={list} onPick={setSelected} />}

      {db && list.length > 0 && (
        <div className="card mt-1 p-1.5">
          {list.map((f) => <FoodRow key={f.id} food={f} onClick={() => setSelected(f)} />)}
        </div>
      )}
      {db && list.length === 0 && !searching && (
        <p className="py-12 text-center text-sm font-medium text-silver">
          {tab === 'recent' ? 'Foods you log show up here.' : tab === 'favs' ? 'Tap ♥ on any food to keep it here for quick logging.' : tab === 'custom' ? 'No custom foods yet.' : 'Nothing here.'}
        </p>
      )}

      {searching && <WorldProducts query={dq} onPick={setSelected} localCount={results.length} />}

      {db && (
        <p className="mt-6 text-center text-[12px] font-medium leading-relaxed text-dim">
          {db.foods.length.toLocaleString()} foods from USDA FoodData Central and FAO/INFOODS · packaged products from Open Food Facts
        </p>
      )}

      <FoodSheet food={selected} date={date} preset={photoId ? { photoId } : undefined} onClose={() => setSelected(null)} onSaved={back} onSwitchFood={setSelected} />
    </div>
  );
}

/** Live search of Open Food Facts (packaged products worldwide). Runs automatically when local results are thin. */
function WorldProducts({ query, onPick, localCount }: { query: string; onPick: (f: Food) => void; localCount: number }) {
  const [requested, setRequested] = useState(false);
  const [state, setState] = useState<{ q: string; foods: Food[]; error?: string; loading: boolean } | null>(null);
  const auto = localCount < 6;
  const active = requested || auto;

  useEffect(() => setRequested(false), [query]);
  useEffect(() => {
    if (!active || query.trim().length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setState({ q: query, foods: [], loading: true });
      searchProducts(query, ctrl.signal)
        .then((foods) => setState({ q: query, foods, loading: false }))
        .catch((e: Error) => e.name !== 'AbortError' && setState({ q: query, foods: [], loading: false, error: e.message }));
    }, 650);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, active]);

  if (query.trim().length < 3) return null;
  if (!active)
    return (
      <button onClick={() => setRequested(true)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface text-sm font-semibold" style={{ boxShadow: 'var(--shadow)' }}>
        <Globe2 size={16} /> Search packaged products worldwide
      </button>
    );

  return (
    <section className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-silver"><Globe2 size={15} /> Packaged products worldwide</p>
      {!state || state.loading ? (
        <p className="flex items-center gap-2 px-1 py-4 text-sm text-silver"><Loader2 size={15} className="animate-spin" /> Searching Open Food Facts…</p>
      ) : state.error ? (
        <p className="px-1 py-3 text-sm text-silver">{state.error}</p>
      ) : state.foods.length === 0 ? (
        <p className="px-1 py-3 text-sm text-silver">No products with protein data found.</p>
      ) : (
        <div className="card p-1.5">{state.foods.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)}</div>
      )}
    </section>
  );
}

function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  const { title, detail } = food.source === 'off' ? { title: food.name, detail: '' } : splitName(food.name);
  const isFav = useStore((s) => s.favoriteFoodIds.includes(food.id));
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const rememberFood = useStore((s) => s.rememberFood);
  return (
    <div className="flex items-center rounded-[22px] transition active:bg-raised/60">
    <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3.5 p-3 pr-1 text-left transition active:scale-[.99]">
      <FoodVisual name={food.name} category={food.category} fdcId={food.fdcId} size={50} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold leading-snug">{title}</p>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <StateBadge state={food.state} className="shrink-0" />
          {food.source !== 'usda-sr' && <span className="shrink-0 rounded-full bg-raised px-2 text-[12px] font-semibold uppercase leading-5 tracking-wide text-silver">{SOURCE_SHORT[food.source]}</span>}
          {detail && <span className="truncate text-xs text-silver">{detail}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-lg font-bold leading-none">{fmt(food.per100.protein, 1)}<span className="text-xs font-medium text-silver">g</span></p>
        <p className="mt-1 text-[12px] font-medium text-dim">per 100g</p>
      </div>
    </button>
    <button
      onClick={() => { haptic(); rememberFood(food); toggleFavorite(food.id); toast(isFav ? 'Removed from favourites' : 'Saved to favourites ♥'); }}
      className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-90', isFav ? 'text-accent' : 'text-dim')}
      aria-label={isFav ? 'Remove from favourites' : 'Save to favourites'}
      aria-pressed={isFav}
    >
      <Heart size={19} fill={isFav ? 'currentColor' : 'none'} />
    </button>
    </div>
  );
}

/** Big photo cards for popular foods (only those with a photo). */
function PhotoCards({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  const withPhoto = foods.filter((f) => f.fdcId && FOOD_PHOTOS[f.fdcId]);
  if (!withPhoto.length) return null;
  return (
    <div className="-mx-5 mb-4 flex snap-x gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
      {withPhoto.map((f) => {
        const photo = FOOD_PHOTOS[f.fdcId!];
        const { title } = splitName(f.name);
        return (
          <button key={f.id} onClick={() => { haptic(); onPick(f); }} className="relative h-52 w-40 shrink-0 snap-start overflow-hidden rounded-[24px] bg-raised text-left transition active:scale-[.97]" style={{ boxShadow: 'var(--shadow)' }}>
            <img src={`${import.meta.env.BASE_URL}photos/${photo.file}`} alt={title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute inset-x-3 bottom-3 text-white">
              <p className="line-clamp-2 text-[15px] font-semibold leading-tight">{title}</p>
              <p className="num mt-1 text-xs opacity-80">{fmt(f.per100.protein, 1)} g protein / 100 g</p>
            </div>
            {f.state !== 'na' && <StateBadge state={f.state} className="absolute left-3 top-3 !bg-white/90 !text-black" />}
          </button>
        );
      })}
    </div>
  );
}
