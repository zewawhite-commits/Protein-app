import { mealLabel } from '@/lib/meals';
import { CreateFood } from '@/components/CreateFood';
import { sendMessage } from '@/lib/feedback';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AllergyTag } from '@/components/Allergy';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronRight, Download, Globe2, Heart, Loader2, Mic, Search, Share2, X, ChefHat, Plus } from 'lucide-react';
import { ShareRecipeSheet } from '@/components/ShareRecipe';
import { haptic, toast } from '@/components/fx';
import { useFoodDb, useFoodLookup, usePhotoUrl } from '@/lib/hooks';
import { SOURCE_SHORT, searchFoods, splitName, groupDuplicates, hasCoreNutrition } from '@/lib/foods';
import { searchProducts } from '@/lib/openFoodFacts';
import { plateParts } from '@/lib/plate';
import { varietiesFor } from '@/lib/varieties';
import { deletePhoto } from '@/lib/photos';
import { fitsDiet } from '@/lib/goals';
import { addDays, mealForNow, relativeDay, todayKey } from '@/lib/dates';
import { useStore } from '@/store/useStore';
import type { CustomFood, Food, PrepState, Meal } from '@/lib/types';
import { FoodSheet } from '@/components/FoodSheet';
import { FoodVisual } from '@/components/FoodIcon';
import { WorldFoods } from '@/components/WorldFoods';
import { VoiceSheet, canUseVoice } from '@/components/VoiceSheet';
import { SavedMealsList } from '@/components/SavedMeals';
import { StateBadge, cx, fmt } from '@/components/ui';

const STATES: { value: PrepState | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'raw', label: 'Raw' },
  { value: 'cooked', label: 'Cooked' },
  { value: 'dry', label: 'Dry' },
];

/** Cooking methods people filter by; matched on the food's name. */
const METHODS: { value: string; label: string; re: RegExp }[] = [
  { value: 'boiled', label: 'Boiled', re: /\bboil|\bpoach|\bsimmer/i },
  { value: 'fried', label: 'Fried', re: /\bfried\b|\bfry\b|\bsaut[ée]/i },
  { value: 'grilled', label: 'Grilled', re: /^(?!.*\bfried\b).*(\bgrill|\bbroiled\b|\bbarbecue|\bbbq\b|\broast)/i },
  { value: 'steamed', label: 'Steamed', re: /\bsteam/i },
  { value: 'baked', label: 'Baked', re: /\bbake/i },
];
type Sort = 'recent' | 'az' | 'used';

type Tab = 'picks' | 'recent' | 'favs' | 'saved' | 'custom';
const TABS: [Tab, string][] = [['recent', 'Recent'], ['picks', 'Popular'], ['favs', 'Favourites'], ['saved', 'Saved meals'], ['custom', 'My recipes']];

export default function AddFood() {
  const [creating, setCreating] = useState(() => new URLSearchParams(location.search).get('create') === '1');
  const nav = useNavigate();
  const [params] = useSearchParams();
  const date = params.get('date') ?? todayKey();
  const [voice, setVoice] = useState(() => params.get('voice') === '1');
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
  const [method, setMethod] = useState<string>('');
  const [sort, setSort] = useState<Sort>('recent');
  const entries = useStore((s) => s.entries);
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab | null) ?? (recentIds.length ? 'recent' : 'picks'));
  const [selected, setSelected] = useState<Food | null>(null);
  // Several foods for one meal: stay here after adding, with a Done bar, instead of jumping back each time.
  const [added, setAdded] = useState<{ count: number; meal?: Meal }>({ count: 0 });
  const searching = !!dq.trim();

  // A photo handed over from the camera is discarded if nothing gets logged with it.
  useEffect(() => () => {
    if (photoId && !useStore.getState().entries.some((e) => e.photoId === photoId)) void deletePhoto(photoId);
  }, [photoId]);

  // Foods you've starred or logged before come first among the matches (never a food that doesn't match the words).
  const results = useMemo(() => {
    if (!db || !searching) return [];
    const r = searchFoods(dq, { state, custom });
    const terms = dq.toLowerCase().split(/[^a-z0-9\u00c0-\u024f]+/).filter((t) => t.length > 1);
    const words = (n: string) => n.toLowerCase().split(/[^a-z0-9\u00c0-\u024f]+/);
    const mine = [...new Set([...favIds, ...recentIds])].map((id) => lookup(id)).filter((f): f is Food => !!f && (state === 'all' || f.state === state) && terms.length > 0 && terms.every((t) => words(f.name).some((w) => w.startsWith(t))));
    const ids = new Set(mine.map((f) => f.id));
    return [...mine, ...r.filter((f) => !ids.has(f.id))];
  }, [db, dq, searching, state, custom, favIds, recentIds, lookup]);
  const browse = useMemo(() => {
    const ids = tab === 'recent' ? recentIds : tab === 'favs' ? favIds : [];
    const list =
      tab === 'picks' ? (db?.quickPicks ?? []).filter((f) => fitsDiet(f, diet))
      : tab === 'custom' ? sortCustom(custom.filter((c) => !c.archived), sort, entries)
      : (ids.map(lookup).filter(Boolean) as Food[]);
    return state === 'all' ? list : list.filter((f) => f.state === state);
  }, [tab, db, custom, recentIds, favIds, lookup, state, diet, sort, entries]);

  // Optional: hide foods whose source doesn't list all the core numbers.
  const [completeOnly, setCompleteOnly] = useState(() => { try { return localStorage.getItem('provora-complete-only') === '1'; } catch { return false; } });
  const methodRe = METHODS.find((m) => m.value === method)?.re;
  const list = (searching ? results : browse).filter((f) => (!completeOnly || hasCoreNutrition(f)) && (!methodRe || methodRe.test(f.name)));
  const groups = useMemo(() => (searching ? groupDuplicates(list) : list.map((food) => ({ food, others: [] as Food[], conflict: false }))), [list, searching]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const back = () => nav(date === todayKey() ? '/' : `/?date=${date}`);
  const snapUrl = `/snap${date !== todayKey() ? `?date=${date}` : ''}`;

  return (
    <div className="animate-fade-up">
      {voice && <VoiceSheet date={date} onClose={() => setVoice(false)} onSearch={(t) => setQ(t)} />}
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
        <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-tight">What did you eat?</h1>
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
          {canUseVoice && !photoId && (
            <button onClick={() => { haptic(); setVoice(true); }} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }} aria-label="Say what you ate"><Mic size={21} /></button>
          )}
          {!photoId && (
            <Link to={snapUrl} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-on-primary" aria-label="Snap a photo">
              <Camera size={22} />
            </Link>
          )}
        </div>
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          {searching
            ? [...STATES.map((s) => (
                <button key={s.value} onClick={() => setState(s.value)} className={cx('chip', state === s.value && 'chip-on')}>{s.label}</button>
              )), ...METHODS.map((m) => (
                <button key={m.value} onClick={() => setMethod((v) => (v === m.value ? '' : m.value))} className={cx('chip shrink-0', method === m.value && 'chip-on')} aria-pressed={method === m.value}>{m.label}</button>
              )), (
                <button key="complete" onClick={() => setCompleteOnly((v) => { try { localStorage.setItem('provora-complete-only', v ? '0' : '1'); } catch { /* ignore */ } return !v; })} className={cx('chip shrink-0', completeOnly && 'chip-on')} aria-pressed={completeOnly}>Complete nutrition only</button>
              )]
            : TABS.map(([v, l]) => (
                <button key={v} onClick={() => setTab(v)} className={cx('chip', tab === v && 'chip-on')}>{l}</button>
              ))}
        </div>
      </div>

      {!searching && !photoId && (
        <Link to={snapUrl} className="card mb-6 mt-2 flex items-center gap-4 p-4 transition active:scale-[.99]">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-accent text-white"><Camera size={26} strokeWidth={2.2} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold">Scan a meal</p>
            <p className="mt-0.5 text-sm text-silver">Take a photo — we find the foods, you check and weigh.</p>
          </div>
          <ChevronRight size={20} className="shrink-0 text-dim" />
        </Link>
      )}

      {!searching && !photoId && (tab === 'recent' || tab === 'picks') && <Usuals date={date} onDone={back} />}

      {!searching && !photoId && (tab === 'recent' || tab === 'picks') && <WorldFoods onSearch={(v) => { setQ(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}

      {error && <p className="card p-4 text-sm font-medium text-danger">{error}</p>}
      {!db && !error && (
        <p className="flex items-center justify-center gap-2 py-12 font-medium text-silver"><Loader2 className="animate-spin" size={18} /> Loading foods…</p>
      )}

      {/* (The same picks are listed below with + buttons; the extra card row only repeated them.) */}

      {!searching && tab === 'saved' && <SavedMealsList date={date} />}
 {!searching && tab === 'custom' && custom.filter((c) => !c.archived).length > 1 && (
        <div className="mb-3 mt-1 flex gap-2" role="radiogroup" aria-label="Sort">
          {([['recent', 'Newest'], ['az', 'A–Z'], ['used', 'Most used']] as [Sort, string][]).map(([v, l]) => <button key={v} role="radio" aria-checked={sort === v} onClick={() => setSort(v)} className={cx('chip !h-9', sort === v && 'chip-on')}>{l}</button>)}
        </div>
      )}
      {!searching && tab === 'custom' && (
        <Link to="/recipe" className="card mb-3 mt-1 flex items-center gap-4 p-4 transition active:scale-[.99]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-accent text-white"><ChefHat size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold">Create a recipe</span>
            <span className="block text-sm text-silver">Add ingredients and the cooked weight — we work out the nutrition.</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-dim" />
        </Link>
      )}
      {!searching && tab === 'custom' && (
        <Link to="/recipe?import=1" className="card mb-3 flex items-center gap-4 p-4 transition active:scale-[.99]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-accent text-white"><Download size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold">Import a recipe</span>
            <span className="block text-sm text-silver">From a website link, pasted ingredients, or a photo or screenshot — check and edit before saving.</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-dim" />
        </Link>
      )}
      {searching && varietiesFor(dq) && (
        <div className="mb-2 mt-1" role="group" aria-label={`Types of ${varietiesFor(dq)!.group}`}>
          <p className="mb-1.5 px-1 text-[13px] font-semibold text-silver">Which {varietiesFor(dq)!.group}? Tap the one you had</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
            {varietiesFor(dq)!.options.map((v) => <button key={v.label} title={v.note} onClick={() => { haptic(); setQ(v.q); }} className="chip !h-10 shrink-0 text-[14px]">{v.label}</button>)}
          </div>
        </div>
      )}
      {db && list.length > 0 && !(tab === 'saved' && !searching) && (
        <div className="card mt-1 p-2">
          {groups.map((g) => (
            <div key={g.food.id}>
              <FoodRow food={g.food} onClick={() => setSelected(g.food)} />
              {g.others.length > 0 && (
                <button onClick={() => setOpenGroup((o) => (o === g.food.id ? null : g.food.id))} className={cx('mb-1 ml-[86px] mr-3 block text-left text-[12px] font-semibold', g.conflict ? 'text-warn' : 'text-silver')}>
                  {openGroup === g.food.id ? 'Hide' : 'Also in'} {g.others.length} other table{g.others.length > 1 ? 's' : ''}{g.conflict ? ` · calories differ (${Math.round(Math.min(...[g.food, ...g.others].map((x) => x.per100.kcal ?? 0)))}–${Math.round(Math.max(...[g.food, ...g.others].map((x) => x.per100.kcal ?? 0)))} per 100 g) — compare before choosing` : ' · values agree'}
                </button>
              )}
              {openGroup === g.food.id && <div className="ml-6 border-l-2 border-line pl-1">{g.others.map((o) => <FoodRow key={o.id} food={o} onClick={() => setSelected(o)} />)}</div>}
            </div>
          ))}
        </div>
      )}
      {db && list.length === 0 && !searching && tab !== 'saved' && (
        <p className="py-12 text-center text-sm font-medium text-silver">
          {tab === 'recent' ? 'Foods you log show up here.' : tab === 'favs' ? 'Tap the heart on any food to keep it here for quick logging.' : tab === 'custom' ? 'Your recipes will appear here.' : 'Nothing here.'}
        </p>
      )}

      {searching && plateParts(dq).length > 1 && (
        <Link to={`/recipe?plate=${encodeURIComponent(dq)}`} className="card mt-4 flex items-center gap-3 p-4 transition active:scale-[.99]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary"><Plus size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold">Build this plate</span><span className="block truncate text-sm text-silver">{plateParts(dq).join(' + ')}: each item with its own amount, then the total</span></span>
        </Link>
      )}
      {searching && <WorldProducts query={dq} onPick={setSelected} localCount={results.length} />}
      {searching && (
        <div className="card mt-6 p-5">
          <p className="text-[17px] font-bold">Can’t find it?</p>
          <p className="mt-1 text-sm text-silver">Describe the dish and AI breaks it into foods from the database, or scan the barcode on the pack.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to={`/snap?mode=describe&q=${encodeURIComponent(dq)}`} className="btn-primary !h-12 text-sm">Describe it</Link>
            <Link to="/barcode" className="btn-ghost !h-12 text-sm">Scan barcode</Link>
          </div>
          <button onClick={() => setCreating(true)} className="btn-ghost mt-2 w-full !h-12 text-sm">Create it yourself — enter the numbers</button>
          <RequestFood query={dq} />
        </div>
      )}
      <CreateFood open={creating} onClose={() => setCreating(false)} onSaved={(f) => setSelected(f)} />

      {db && (
        <p className="mt-6 text-center text-[12px] font-medium leading-relaxed text-dim">
          {db.foods.length.toLocaleString()} foods from USDA, UK (McCance &amp; Widdowson), Australia (FSANZ) and FAO/INFOODS tables · millions of packaged products from Open Food Facts
        </p>
      )}

      {added.count > 0 && !selected && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-5 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="flex items-center gap-3 rounded-[22px] bg-surface p-3 pl-4" style={{ boxShadow: 'var(--shadow)' }}>
            <p className="min-w-0 flex-1 text-[14px] font-semibold">{added.count} food{added.count > 1 ? 's' : ''} added{added.meal ? ` to ${mealLabel(added.meal)}` : ''}<span className="block text-[12px] font-normal text-silver">Search for the next one, or finish.</span></p>
            <button onClick={back} className="btn-primary !h-11 !px-5">Done</button>
          </div>
        </div>
      )}
      <FoodSheet food={selected} date={date} preset={photoId || params.get('meal') || params.get('plan') ? { ...(photoId ? { photoId } : {}), ...(params.get('meal') ? { meal: params.get('meal') as Meal } : {}), ...(params.get('plan') === '1' ? { plan: true } : {}) } : undefined} onClose={() => setSelected(null)} onSaved={(m) => { setAdded((a) => ({ count: a.count + 1, meal: m ?? a.meal })); setQ(''); }} onSwitchFood={setSelected} />
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
        <div className="card p-2">{state.foods.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)}</div>
      )}
    </section>
  );
}

/** A normal serving to show and quick-log: "1 medium", "1 cup", "1 serving" — not "1 linear inch" or a pinch. */
function typicalPortion(food: Food): { label: string; grams: number } {
  const ok = (food.portions ?? []).filter((p) => p.grams >= 25 && p.grams <= 500 && !/inch|tbsp|tsp|tablespoon|teaspoon|\boz\b|fl oz|nlea|pat\b|\bdash|pinch/i.test(p.label));
  const score = (l: string) => (/medium|serving|regular|whole|piece|\bportion|bowl|plate/i.test(l) ? 0 : /cup|large|small|slice|1 \w+$/i.test(l) ? 1 : 2);
  return ok.sort((a, b) => score(a.label) - score(b.label))[0] ?? { label: '100 g', grams: 100 };
}

function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  const { title, detail } = food.source === 'off' ? { title: food.name, detail: '' } : splitName(food.name);
  const isFav = useStore((s) => s.favoriteFoodIds.includes(food.id));
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const rememberFood = useStore((s) => s.rememberFood);
  const addEntry = useStore((s) => s.addEntry);
  const [params] = useSearchParams();
  const [share, setShare] = useState(false);
  // Calories for a normal serving ("105 kcal, 1 medium"), like a food diary shows them; 100 g when there is none.
  const portion = typicalPortion(food);
  const kcal = food.per100.kcal != null ? (food.per100.kcal * portion.grams) / 100 : null;
  const protein = (food.per100.protein * portion.grams) / 100;
  const quickAdd = () => {
    haptic();
    rememberFood(food);
    const added = addEntry({ date: params.get('date') ?? todayKey(), meal: mealForNow(), food, grams: portion.grams });
    toast(`Logged ${title.split(',')[0]} · ${portion.label}`, { action: { label: 'Undo', run: () => useStore.getState().removeEntry(added.id) } });
  };
  return (
    <div className="flex items-center rounded-[22px] transition active:bg-raised/60">
    <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-4 p-3.5 pr-1 text-left transition active:scale-[.99]">
      <FoodVisual name={food.name} category={food.category} fdcId={food.fdcId} size={54} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[16px] font-bold leading-snug">{title}</p>
        {detail && <p className="mt-0.5 truncate text-[13px] text-silver">{detail}</p>}
        <p className="num mt-0.5 text-[14px] text-silver">
          {kcal != null ? `${fmt(kcal)} kcal` : '– kcal'}, {portion.label}{portion.label.includes(' g') ? '' : ` (${fmt(portion.grams)} g)`} · <span className="font-semibold text-accent">{fmt(protein, protein < 10 ? 1 : 0)} g protein</span>
        </p>
        {/* Labels wrap onto a second line rather than spill into the buttons. */}
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
          <StateBadge state={food.state} className="shrink-0" />
          <AllergyTag food={food} />
          {food.source !== 'usda-sr' && <span className="shrink-0 rounded-full bg-raised px-2 text-[12px] font-semibold uppercase leading-5 tracking-wide text-silver">{SOURCE_SHORT[food.source]}</span>}
        </div>
      </div>
    </button>
      {'recipe' in food && (food as CustomFood).recipe && (
        <>
          <button onClick={() => setShare(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-accent" aria-label={`Share ${title}`}><Share2 size={16} /></button>
          <Link to={`/recipe?id=${encodeURIComponent(food.id)}`} className="ml-1 grid h-10 shrink-0 place-items-center rounded-full bg-raised px-3 text-xs font-bold text-accent">Edit</Link>
          <ShareRecipeSheet food={food as CustomFood} open={share} onClose={() => setShare(false)} />
        </>
      )}
    <button
      onClick={() => { haptic(); rememberFood(food); toggleFavorite(food.id); toast(isFav ? 'Removed from favourites' : 'Saved to favourites'); }}
      className={cx('grid h-11 w-9 shrink-0 place-items-center rounded-full transition active:scale-90', isFav ? 'text-accent' : 'text-dim')}
      aria-label={isFav ? 'Remove from favourites' : 'Save to favourites'}
      aria-pressed={isFav}
    >
      <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
    </button>
    <button onClick={quickAdd} className="mr-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raised text-accent transition active:scale-90" aria-label={`Log ${portion.label} of ${title}`}>
      <Plus size={22} strokeWidth={2.5} />
    </button>
    </div>
  );
}


/**
 * Meal memory: what this person usually eats at this time of day (from the last 30 days),
 * with their usual amount. One tap logs it; they can still change the weight afterwards.
 */
function Usuals({ date, onDone }: { date: string; onDone: () => void }) {
  const entries = useStore((s) => s.entries);
  const addEntry = useStore((s) => s.addEntry);
  const meal = mealForNow();
  const usual = useMemo(() => {
    const from = addDays(todayKey(), -30);
    const by = new Map<string, { e: (typeof entries)[number]; grams: number[] }>();
    for (const e of entries) {
      if (e.date <= from || e.meal !== meal) continue;
      const cur = by.get(e.foodId) ?? { e, grams: [] };
      cur.grams.push(e.grams);
      by.set(e.foodId, cur);
    }
    const today = new Set(entries.filter((e) => e.date === date).map((e) => e.foodId));
    return [...by.values()]
      .filter((x) => x.grams.length >= 2 && !today.has(x.e.foodId))
      .sort((a, b) => b.grams.length - a.grams.length)
      .slice(0, 4)
      .map((x) => ({ e: x.e, times: x.grams.length, grams: [...x.grams].sort((a, b) => a - b)[Math.floor(x.grams.length / 2)] }));
  }, [entries, meal, date]);
  if (!usual.length) return null;
  const log = (u: (typeof usual)[number]) => {
    haptic();
    const added = addEntry({ date, meal, food: { ...u.e.food, id: u.e.foodId, category: '', portions: [] } as Food, grams: u.grams });
    toast(`Logged ${splitName(u.e.food.name).title.split(',')[0]} · ${fmt(u.grams)} g`, { action: { label: 'Undo', run: () => useStore.getState().removeEntry(added.id) } });
  };
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[15px] font-semibold">Your usual {meal}</p>
        {usual.length > 1 && <button onClick={() => { usual.forEach(log); onDone(); }} className="text-sm font-semibold text-accent">Log all</button>}
      </div>
      <div className="card p-1.5">
        {usual.map((u) => (
          <button key={u.e.foodId} onClick={() => log(u)} className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition active:bg-raised">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Plus size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{splitName(u.e.food.name).title.split(',')[0]}</span>
              <span className="num block text-xs text-silver">{fmt(u.grams)} g · {u.e.food.per100.kcal != null ? `${fmt((u.e.food.per100.kcal * u.grams) / 100)} kcal · ` : ''}logged {u.times}× this month</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Ask the team to add a food that isn't in the database. */
function RequestFood({ query }: { query: string }) {
  const [sent, setSent] = useState<string | null>(null);
  if (!query.trim()) return null;
  if (sent === query) return <p className="mt-3 text-center text-[13px] font-semibold text-accent">Thanks — we’ll look at adding “{query}”.</p>;
  return (
    <button
      onClick={async () => { try { await sendMessage('food-request', query.trim()); setSent(query); haptic(); } catch (e) { toast((e as Error).message); } }}
      className="mt-3 w-full text-center text-[14px] font-semibold text-silver underline"
    >
      Request “{query.trim().slice(0, 40)}” to be added
    </button>
  );
}

/** My recipes and foods: newest first, A–Z, or the ones you log most. */
function sortCustom<T extends { id: string; name: string; createdAt?: number; updatedAt?: number }>(list: T[], sort: Sort, entries: { foodId: string }[]): T[] {
  if (sort === 'az') return [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'used') {
    const n = new Map<string, number>();
    for (const e of entries) n.set(e.foodId, (n.get(e.foodId) ?? 0) + 1);
    return [...list].sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }
  return [...list].sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));
}
