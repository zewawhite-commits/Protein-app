import { densityOf, measuresFor } from '@/lib/units';
import { CreateFood } from './CreateFood';
import { useMealOptions } from '@/lib/meals';
import { MealPicker } from './MealPicker';
import { defaultMeal, rememberMeal } from '@/lib/meals';
import { aiHeaders } from '@/lib/premium';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, ExternalLink, Heart, ImagePlus, Minus, Plus, Trash2, Copy, ArrowLeftRight, Scale, Mic } from 'lucide-react';
import type { Food, LogEntry, Meal } from '@/lib/types';
import { alcoholPer100, nutrientsFor, round1, scale } from '@/lib/nutrition';
import { EXTRA_KEYS } from '@/lib/nutrients';
import { MACRO_COLOR, NutrientList } from './Nutrients';
import { boneInFood, counterparts, dataQuality, similarFoods, sourceInfo, splitName } from '@/lib/foods';
import { fitsDiet } from '@/lib/goals';
import { foodAllergens } from '@/lib/allergens';
import { useAvoid } from './Allergy';
import { deletePhoto, savePhoto } from '@/lib/photos';
import { useFoodDb, usePhotoUrl, useDay } from '@/lib/hooks';
import { dailyTargets } from '@/lib/energy';
import { useStore } from '@/store/useStore';
import { boneInQuery, gramsFor, lastAmount, parseAmount } from '@/lib/describe';
import { poultryVariants, weighGuide } from '@/lib/variants';
import { allFoods } from '@/lib/foods';
import { standardRecipe } from '@/lib/recipe';
import { AllergyBanner } from './Allergy';
import { fromKey, mealForNow, todayKey } from '@/lib/dates';
import { Ring, Segmented, Sheet, StateBadge, cx, fmt } from './ui';
import { FoodVisual } from './FoodIcon';
import { CountUp, haptic, toast } from './fx';


interface Props {
  food: Food | null;
  date: string;
  entry?: LogEntry;
  onClose: () => void;
  onSaved?: (meal?: Meal) => void;
  onSwitchFood?: (f: Food) => void;
  /** Starting values from the photo flow: the meal photo and an AI portion estimate (a suggestion only). */
  /** From the photo flow: the meal photo and the AI's rough portion guess (never pre-filled as the weight). */
  preset?: { photoId?: string; aiEstimate?: number; meal?: Meal; plan?: boolean };
}

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'oz' | 'lb';
const UNIT_G: Record<Unit, number> = { g: 1, kg: 1000, ml: 1, L: 1000, oz: 28.3495, lb: 453.592 };
const UNIT_NAME: Record<Unit, string> = { g: 'grams', kg: 'kilograms', ml: 'millilitres', L: 'litres', oz: 'ounces', lb: 'pounds' };
const UNIT_DP: Record<Unit, number> = { g: 1, kg: 1000, ml: 1, L: 1000, oz: 10, lb: 100 };
/** Grams in one of a unit. Volume uses the food's own density (oil is lighter than water, syrup heavier). */
let DENSITY_NOW = 1;
const gPer = (u: Unit) => (u === 'ml' || u === 'L' ? UNIT_G[u] * DENSITY_NOW : UNIT_G[u]);
const toUnit = (grams: number, u: Unit) => String(Math.round((grams / gPer(u)) * UNIT_DP[u]) / UNIT_DP[u]);
/** Drinks, soups and other foods people measure by volume. */
export const isLiquid = (food: { name: string; category?: string }) =>
  /beverage|drink/i.test(food.category ?? '') || /\b(milk|juice|water|soda|cola|tea|coffee|latte|drink|smoothie|shake|beer|wine|kefir|broth|soup|yogh?urt drink|zobo|kunu)\b/i.test(food.name);

export function FoodSheet({ food, date, entry, onClose, onSaved, onSwitchFood, preset }: Props) {
  return (
    <Sheet open={!!food} onClose={onClose} title={entry ? 'Edit entry' : 'Add food'}>
      {food && <Body key={food.id + (entry?.id ?? '')} food={food} date={date} entry={entry} onClose={onClose} onSaved={onSaved} onSwitchFood={onSwitchFood} preset={preset} />}
    </Sheet>
  );
}

function Body({ food, date, entry, onClose, onSaved, onSwitchFood, preset }: Props & { food: Food }) {
  const [fixing, setFixing] = useState(false);
  const addEntry = useStore((s) => s.addEntry);
  const updateEntry = useStore((s) => s.updateEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const [reported, setReported] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const favs = useStore((s) => s.favoriteFoodIds);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const rememberFood = useStore((s) => s.rememberFood);
  const { db } = useFoodDb();
  const day = useDay(date);
  // A day still to come: food is planned, not logged (it counts once marked eaten).
  const isFuture = date > todayKey() || !!preset?.plan;

  // The weight is always what the user enters; nothing is pre-filled for a new entry.
  // The amount typed, in the chosen unit; nutrition always uses grams.
  const dens = densityOf(food);
  DENSITY_NOW = dens?.gPerMl ?? 1;
  const liquid = !!dens || isLiquid(food);
  const [unit, setUnitState] = useState<Unit>(() => { try { const u = localStorage.getItem('provora-unit') as Unit | null; return u === 'oz' || ((u === 'kg' || u === 'lb') && !liquid) || ((u === 'ml' || u === 'L') && liquid) ? u : 'g'; } catch { return 'g'; } });
  // What they had last time is their own number, so a new entry starts there (they can change it).
  const [usual] = useState(() => (entry ? null : lastAmount(useStore.getState().entries, food)));
  // A new entry starts empty: "Last time" is a shortcut to tap, never assumed as today's portion.
  const [grams, setGrams] = useState(entry ? toUnit(entry.grams, unit) : '');
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? preset?.meal ?? defaultMeal(mealForNow()));
  const MEALS = useMealOptions(meal);
  const [photoId, setPhotoId] = useState<string | undefined>(entry?.photoId ?? preset?.photoId);
  const [busy, setBusy] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const photoUrl = usePhotoUrl(photoId);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);
  const newPhotoRef = useRef<string | undefined>(undefined);

  // Discard a photo that was taken but never saved.
  useEffect(() => () => {
    if (!savedRef.current && newPhotoRef.current) void deletePhoto(newPhotoRef.current);
  }, []);

  // In edit mode, use the snapshot stored with the entry (what was logged), not today's record.
  const per100 = entry ? entry.food.per100 : food.per100;
  const g = Math.max(0, (Number(grams.replace(',', '.')) || 0) * gPer(unit));
  /** Set the amount from a weight in grams, shown in the current unit. */
  const setG = (v: number) => setGrams(toUnit(v, unit));
  const setUnit = (u: Unit) => { setGrams(g ? toUnit(g, u) : ''); setUnitState(u); try { localStorage.setItem('provora-unit', u); } catch { /* ignore */ } };
  const n = nutrientsFor(per100, g);
  // Share of calories from carbs, fat and protein (4 / 9 / 4 kcal per gram), like a food label pie.
  const split = (() => { const c = (per100.carbs ?? 0) * 4, f = (per100.fat ?? 0) * 9, p = per100.protein * 4, t = c + f + p; return t > 0 && per100.carbs != null && per100.fat != null ? { carbs: c / t, fat: f / t, protein: p / t } : null; })();
  const { title, detail } = splitName(food.name);
  const alt = useMemo(() => (db ? counterparts(food, db.foods) : []), [db, food]);
  const alcohol = alcoholPer100(food.name, food.per100, food.category);
  // Measured "weighed with bone" record for meat and fish, so a bone-in weight isn't counted as all meat.
  const boneIn = useMemo(() => (db ? boneInFood(food, boneInQuery(food.name)) : null), [db, food]);
  const avoid = useAvoid();
  const diet = useStore((s) => s.profile?.diet ?? 'all');
  // "Don't have it?" swaps from everyday foods and world dishes that fit the person's diet and avoid list.
  const similar = useMemo(() => {
    if (!db) return [];
    const pool = [...db.quickPicks, ...db.foods.filter((f) => f.source === 'recipe')].filter((f) => fitsDiet(f, diet) && !foodAllergens(f, avoid).length);
    return similarFoods(food, pool);
  }, [db, food, diet, avoid]);
  const isFav = favs.includes(food.id);
  const before = day.totals.protein - (entry ? nutrientsFor(entry.food.per100, entry.grams).protein : 0);
  const after = before + n.protein;

  // Foods eaten in pieces (wings, eggs, slices, cups…): count them instead of weighing.
  const measures = measuresFor(food);
  // Whole items first (1 egg, 1 wing, 1 slice, 1 fillet), then servings (plate, bowl, cup), then the rest.
  const rank = (label: string) => (/\b(plate|bowl|cup|ladle|glass|bottle|can|tbsp|tsp|spoon|litre|portion|serving|chopped|diced|sliced|mashed)\b/i.test(label) ? 1
    : /\b(piece|wing|drumstick|thigh|leg|egg|slice|fillet|ball|whole|large|medium|small|extra large|jumbo|breast|steak|chop|link|patty|roll|bun|muffin|bar|biscuit|cookie|wrap)\b/i.test(label) ? 2 : 0);
  const countable = measures.filter((p) => p.grams > 0).sort((a, b) => rank(b.label) - rank(a.label));
  const pieceFirst = !!countable[0] && rank(countable[0].label) === 2;
  const usualCount = usual && countable[0] ? Math.round((usual / countable[0].grams) * 2) / 2 : null;
  const usualFits = !!usualCount && Math.abs(usualCount * countable[0].grams - usual!) < 1;
  const [byCount, setByCount] = useState(() => !entry && pieceFirst && (!usual || usualFits));
  const [portionIdx, setPortionIdx] = useState(0);
  const [count, setCount] = useState(entry ? '' : pieceFirst ? (usual && usualFits ? String(usualCount) : usual ? '' : '1') : '');
  // Your own serving size (e.g. the bowl you always use), for any food.
  const [ownSize, setOwnSize] = useState('');
  const own = Number(ownSize.replace(',', '.'));
  const ownPortion = own > 0 && own <= 3000 ? { label: '1 serving', grams: own, verified: false } : undefined;
  const portion = (portionIdx === -1 ? ownPortion : undefined) ?? countable[portionIdx] ?? countable[0] ?? ownPortion;
  const applyCount = (c: string, p = portion) => { setCount(c); const n = Number(c.replace(',', '.')); if (p && n >= 0) setGrams(toUnit(n * p.grams, unit)); };
  useEffect(() => { if (byCount && count && portion) applyCount(count); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const bump = (d: number) => setG(Math.max(0, g + Math.sign(d) * ({ g: 5, ml: 5 * DENSITY_NOW, L: 50 * DENSITY_NOW, oz: 14.17, kg: 50, lb: 45.36 } as const)[unit]));

  async function onPhoto(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const id = await savePhoto(file);
      if (newPhotoRef.current) void deletePhoto(newPhotoRef.current);
      newPhotoRef.current = id;
      setPhotoId(id);
    } finally {
      setBusy(false);
    }
  }

  function removePhoto() {
    if (newPhotoRef.current) { void deletePhoto(newPhotoRef.current); newPhotoRef.current = undefined; }
    setPhotoId(undefined);
  }

  /** Add without counting it yet ("I'll have this later"). */
  function planForLater() {
    if (g <= 0) { inputRef.current?.focus(); return; }
    savedRef.current = true;
    addEntry({ date, meal, food, grams: round1(g), photoId, planned: true });
    haptic(12);
    toast(isFuture ? `Planned for ${fromKey(date).toLocaleDateString(undefined, { weekday: 'long' })} — mark it eaten on the day` : 'Planned — it counts once you mark it eaten');
    onSaved?.(meal);
    onClose();
  }

  function save() {
    if (g <= 0) { inputRef.current?.focus(); return; }
    if (!entry && isFuture) { planForLater(); return; }
    savedRef.current = true;
    const crossesGoal = day.goal > 0 && before + (entry ? nutrientsFor(entry.food.per100, entry.grams).protein : 0) < day.goal && after >= day.goal;
    if (entry) {
      // Edits can be undone too: put back exactly what was there.
      const was = { grams: entry.grams, meal: entry.meal, photoId: entry.photoId, date: entry.date, planned: entry.planned, note: entry.note };
      toast('Changes saved', { action: { label: 'Undo', run: () => useStore.getState().updateEntry(entry.id, was) } });
    }
    if (entry) updateEntry(entry.id, { grams: round1(g), meal, photoId, ...(entry.planned && !isFuture ? { planned: false } : {}), ...(moveTo && moveTo !== entry.date ? { date: moveTo } : {}), ...(entry.note?.startsWith('Portion estimated') && round1(g) !== entry.grams ? { note: 'Weight set by you' } : {}) });
    else {
      // Same food on the same day in the last 2 minutes: probably a double tap, so say so and offer undo.
      const dup = useStore.getState().entries.some((e) => e.date === date && e.foodId === food.id && Date.now() - e.loggedAt < 120_000);
      const added = addEntry({ date, meal, food, grams: round1(g), photoId });
      rememberMeal(meal);
      haptic(12);
      if (dup) toast('You logged this a moment ago too — tap Undo if it was a mistake', { action: { label: 'Undo', run: () => useStore.getState().removeEntry(added.id) }, ms: 6000 });
      else if (!crossesGoal)
        toast(n.kcal != null ? `Added ${fmt(n.kcal)} kcal · ${fmt(n.protein)} g protein` : `Added ${fmt(n.protein, 1)} g protein`, { action: { label: 'Undo', run: () => useStore.getState().removeEntry(added.id) } });
    }
    if (crossesGoal) {
      haptic([20, 60, 20]);
      toast(`Goal hit! ${fmt(after)} g of protein${date === todayKey() ? ' today' : ''}`, { tone: 'celebrate', ms: 4500 });
    }
    onSaved?.(meal);
    onClose();
  }

  const variants = useMemo(() => poultryVariants(food, allFoods()), [food, db]); // eslint-disable-line react-hooks/exhaustive-deps
  const weighHint = food.state === 'cooked' ? 'Weigh after cooking' : food.state === 'dry' ? 'Weigh dry, before cooking' : food.state === 'raw' ? 'Weigh raw, before cooking' : null;

  return (
    <div className="space-y-4">
      {/* Food */}
      <div className="flex items-center gap-3.5">
        <FoodVisual name={food.name} category={food.category} fdcId={food.fdcId} size={60} className="!bg-surface" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight tracking-tight">{title}</p>
          {detail && <p className="mt-0.5 line-clamp-2 text-[14px] font-medium text-silver">{detail}</p>}
        </div>
        <button
          onClick={() => { haptic(); rememberFood(food); toggleFavorite(food.id); }}
          aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
          className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full', isFav ? 'bg-primary text-on-primary' : 'bg-surface text-ink')}
        >
          <Heart size={18} strokeWidth={2.2} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Weight */}
      <div className="card p-5">
        {!entry && variants && onSwitchFood && (
          <div className="mb-4 space-y-2">
            {variants.skin.meatOnly && variants.skin.withSkin && (
              <div role="group" aria-label="Skin" className="grid grid-cols-2 gap-1.5 rounded-full bg-raised p-1">
                {([['Meat only', variants.skin.meatOnly, false], ['Meat and skin', variants.skin.withSkin, true]] as const).map(([l, f, sk]) => (
                  <button key={l} aria-pressed={variants.current.skin === sk} onClick={() => { haptic(); if (f.id !== food.id) onSwitchFood(f); }} className={cx('h-10 rounded-full text-[14px] font-semibold', variants.current.skin === sk ? 'bg-surface text-ink shadow' : 'text-silver')}>{l}</button>
                ))}
              </div>
            )}
            {variants.methods.length > 1 && (
              <div role="group" aria-label="Raw or cooked" className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {variants.methods.map(({ method, food: f }) => (
                  <button key={method} aria-pressed={variants.current.method === method} onClick={() => { haptic(); if (f.id !== food.id) onSwitchFood(f); }} className={cx('chip !h-9 shrink-0', variants.current.method === method && 'chip-on')}>{method === 'raw' ? 'Raw (weighed before cooking)' : method.charAt(0).toUpperCase() + method.slice(1)}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {!entry && (
          <p className="mb-3 text-center text-[14px] font-medium text-silver">{weighGuide(food.name)}</p>
        )}
        {!entry && onSwitchFood && boneIn && (
          <button onClick={() => { haptic(); onSwitchFood(boneIn); }} className="mx-auto -mt-1 mb-3 block text-center text-[13px] font-semibold text-accent">Weighed it with the bones? Use the bone-in values</button>
        )}
        {weighHint && !entry && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <StateBadge state={food.state} />
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-silver"><Scale size={14} /> {weighHint}</span>
          </div>
        )}
        {(
          <div className="mb-4 flex justify-center">
            <Segmented<'count' | 'weight'> value={byCount ? 'count' : 'weight'} onChange={(v) => { haptic(); setByCount(v === 'count'); if (v === 'count') applyCount(count || '1'); }} options={[{ value: 'count', label: pieceFirst ? 'How many' : 'Servings' }, { value: 'weight', label: 'Weight' }]} />
          </div>
        )}
        {byCount && !portion && (
          <div className="mx-auto max-w-[260px] text-center">
            <p className="text-sm text-silver">How much is one of your servings?</p>
            <label className="mt-2 flex items-center justify-center gap-2"><span className="text-sm font-semibold">1 serving =</span><input inputMode="decimal" autoFocus value={ownSize} onChange={(e) => { setOwnSize(e.target.value.replace(/[^\d.,]/g, '')); setPortionIdx(-1); const n2 = Number(e.target.value.replace(',', '.')); if (n2 > 0) setGrams(toUnit((Number(count.replace(',', '.')) || 1) * n2, unit)); }} className="field !h-11 !w-24 text-center" aria-label="Grams in one serving" placeholder="g" /><span className="text-sm text-silver">g</span></label>
          </div>
        )}
        {byCount && portion ? (
          <>
            <div className="flex items-center gap-3">
              <button onClick={() => applyCount(String(Math.max(0, (Number(count.replace(',', '.')) || 0) - (Number(count) > 1 ? 1 : 0.5))))} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised" aria-label="One less"><Minus size={20} strokeWidth={2.6} /></button>
              <label className="flex flex-1 items-baseline justify-center gap-2">
                <input inputMode="decimal" value={count} onChange={(e) => applyCount(e.target.value.replace(/[^\d.,]/g, ''))} onFocus={(e) => e.target.select()} placeholder="0" aria-label="How many" className="num min-w-0 bg-transparent text-center text-[56px] font-extrabold leading-none outline-none" style={{ width: `${Math.max(1, count.length) + 0.5}ch` }} />
                <span className="text-xl font-semibold text-silver">× {portion.label.replace(/^1\s+/, '')}</span>
              </label>
              <button onClick={() => applyCount(String((Number(count.replace(',', '.')) || 0) + 1))} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised" aria-label="One more"><Plus size={20} strokeWidth={2.6} /></button>
            </div>
            <p className="num mt-2 text-center text-[13px] text-silver">= {fmt(g)} g{portion.grams ? ` (${fmt(portion.grams)} g each)` : ''}</p>
            <p className={cx('mx-auto mt-1 w-fit rounded-full px-2.5 py-0.5 text-center text-[12px] font-semibold', portion === ownPortion ? 'bg-raised text-silver' : portion.verified ? 'bg-accent/10 text-accent' : 'bg-warn/15 text-warn')}>
              {portion === ownPortion ? 'Your own size' : portion.verified ? 'Verified size from the food record' : 'Estimated size: change it or weigh for accuracy'}
            </p>
            <label className="mx-auto mt-2 flex w-fit items-center gap-2 text-[13px] text-silver">Your serving size<input inputMode="decimal" value={ownSize} onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, ''); setOwnSize(v); const n2 = Number(v.replace(',', '.')); if (n2 > 0) { setPortionIdx(-1); setGrams(toUnit((Number(count.replace(',', '.')) || 1) * n2, unit)); } else setPortionIdx(0); }} className="field !h-9 !w-20 !px-2 text-center" aria-label="Your serving size in grams" placeholder="g" />g</label>
            {countable.length > 1 && (
              <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 no-scrollbar">
                {countable.map((p, i) => <button key={p.label} onClick={() => { setPortionIdx(i); setOwnSize(''); applyCount(count || '1', p); }} className={cx('chip shrink-0', i === portionIdx && 'chip-on')}>{p.label} <span className="opacity-60">{fmt(p.grams)}g{p.verified ? '' : ' · est.'}</span></button>)}
              </div>
            )}
          </>
        ) : (<>
        <div className="flex items-center gap-3">
          <button onClick={() => bump(-5)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised" aria-label="Less"><Minus size={20} strokeWidth={2.6} /></button>
          <label className="flex flex-1 items-baseline justify-center">
            <input
              id="grams"
              ref={inputRef}
              inputMode="decimal"
              value={grams}
              onChange={(e) => setGrams(e.target.value.replace(/[^\d.,]/g, ''))}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              autoFocus={!entry}
              aria-label={`Amount in ${UNIT_NAME[unit]}`}
              className="num min-w-0 bg-transparent text-center text-[56px] font-extrabold leading-none outline-none"
              style={{ width: `${Math.max(2, grams.length) + 0.5}ch` }}
            />
            <span className="text-2xl font-semibold text-silver">{unit}</span>
          </label>
          <button onClick={() => bump(5)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised" aria-label="More"><Plus size={20} strokeWidth={2.6} /></button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <Segmented<Unit> value={unit} onChange={(u) => { haptic(); setUnit(u); }} options={(liquid ? ['g', 'ml', 'L', 'oz'] as Unit[] : ['g', 'kg', 'oz', 'lb'] as Unit[]).map((u) => ({ value: u, label: u }))} />
          {unit !== 'g' && g > 0 && <span className="num text-[13px] text-silver">= {fmt(g)} g{unit === 'ml' || unit === 'L' ? ` (1 ml ≈ ${DENSITY_NOW} g)` : ''}</span>}
        </div>
        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          {!!preset?.aiEstimate && !entry && (
            <button onClick={() => { haptic(); setG(preset.aiEstimate!); }} className="chip shrink-0 border border-dashed border-accent !bg-accent/10 !text-accent" title="A rough guess from your photo — weigh for accuracy">
              AI estimate ~{preset.aiEstimate}g
            </button>
          )}
          <SayAmount food={food} onGrams={(v) => { setByCount(false); setG(v); }} />
          {!!usual && (
            <button onClick={() => { haptic(); setG(usual); }} className={cx('chip shrink-0', Math.round(g) === Math.round(usual) && 'chip-on')} title="The amount you logged last time">
              Last time {fmt(usual)}g
            </button>
          )}
          {[50, 100, 150, 200].map((v) => (
            <button key={v} onClick={() => setG(v)} className={cx('chip shrink-0', Math.round(g) === v && 'chip-on')}>{v}g</button>
          ))}
          {measures.map((p) => (
            <button key={p.label} onClick={() => setG(p.grams)} className={cx('chip shrink-0', Math.round(g) === Math.round(p.grams) && 'chip-on')} title={p.verified ? 'Verified measure from the food record' : 'Estimated size'}>
              {p.label} <span className="opacity-60">{fmt(p.grams)}g{p.verified ? '' : ' · est.'}</span>
            </button>
          ))}
        </div>
        </>)}
      </div>

      {similar.length > 0 && onSwitchFood && !entry && (
        <div>
          <p className="mb-2 px-1 text-[14px] font-medium text-silver">Other high-protein options (nutrition differs — check each):</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
            {similar.map((a) => (
              <button key={a.id} onClick={() => { haptic(); onSwitchFood(a); }} className="chip shrink-0 !bg-surface !text-ink" style={{ boxShadow: 'var(--shadow)' }}>
                <span className="max-w-[12rem] truncate">{splitName(a.name).title}</span>
                <span className="num text-[12px] text-silver">{fmt(a.per100.protein, 0)} g P · {a.per100.kcal != null ? `${fmt(a.per100.kcal)} kcal` : '– kcal'} /100 g</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Switch raw/cooked */}
      {alt.length > 0 && onSwitchFood && !entry && (
        <div>
          {(food.state === 'raw' || food.state === 'cooked' || food.state === 'dry') && (
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <span className="text-[14px] font-semibold">Preparation</span>
              <Segmented<string> value={food.state} onChange={(v) => { const a = alt.find((x) => x.state === v); if (a) { haptic(); onSwitchFood(a); } }} options={[...new Set([food.state, ...alt.map((a) => a.state)])].filter((st) => st === 'raw' || st === 'cooked' || st === 'dry').map((st) => ({ value: st, label: st === 'raw' ? 'Raw' : st === 'cooked' ? 'Cooked' : 'Dry' }))} />
            </div>
          )}
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[14px] font-medium text-silver">
            <ArrowLeftRight size={14} /> Weighed it {food.state === 'cooked' ? 'before cooking' : 'after cooking'}? Pick the matching record:
          </p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
            {alt.slice(0, 4).map((a) => (
              <button key={a.id} onClick={() => { haptic(); onSwitchFood(a); }} className="chip shrink-0 !bg-surface !text-ink" style={{ boxShadow: 'var(--shadow)' }}>
                <StateBadge state={a.state} />
                <span className="max-w-[12rem] truncate">{prettyDiff(food.name, a.name)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <AllergyBanner food={food} className="mb-3" />
      {/* Result */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="num text-[34px] font-bold leading-none">{n.kcal == null ? '—' : <CountUp value={n.kcal} duration={300} />}<span className="text-lg text-silver"> kcal</span></p>
            <p className="mt-1 text-[14px] font-medium text-silver">in {fmt(g)} g</p>
            {split && (
              <div className="mt-2 flex h-2 w-full max-w-[180px] overflow-hidden rounded-full bg-raised" aria-label="Where the calories come from">
                {(['carbs', 'fat', 'protein'] as const).map((k) => <span key={k} className={MACRO_COLOR[k]} style={{ width: `${split[k] * 100}%` }} />)}
              </div>
            )}
          </div>
          <div className="flex flex-col items-center">
            <Ring value={day.goal ? after / day.goal : 0} size={58} stroke={6} color="accent" track="raised">
              <span className="num text-[12px] font-bold">{day.goal ? fmt(Math.min(999, (after / day.goal) * 100)) : 0}%</span>
            </Ring>
            <span className="mt-1 text-center text-[12px] font-medium leading-tight text-silver">today’s protein{g > 0 ? ' with this' : ' so far'}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {([['Protein', n.protein, 'protein'], ['Carbs', n.carbs, 'carbs'], ['Fat', n.fat, 'fat'], ['Fibre', n.fiber, 'fiber']] as const).map(([l, v, c]) => (
            <div key={l} className="rounded-2xl bg-raised px-1 py-2">
              <span className={cx('mx-auto mb-1 block h-1.5 w-5 rounded-full', MACRO_COLOR[c])} />
              {c !== 'fiber' && split && <p className="num text-[12px] font-semibold text-silver" title="Share of this food’s calories">{Math.round(split[c] * 100)}% kcal</p>}
              <p className="num text-[15px] font-bold">{v == null ? '—' : fmt(v, v < 10 ? 1 : 0)}<span className="text-[12px] text-silver">g</span></p>
              <p className="text-[12px] text-silver">{l}</p>
            </div>
          ))}
        </div>
        {split && <p className="mt-2 text-center text-[12px] text-dim">“% kcal” is how much of this food’s calories come from each — not your daily goal.</p>}
        {alcohol != null && <p className="mt-2 rounded-2xl bg-raised px-3 py-2 text-center text-[13px] text-silver"><b className="num text-ink">{fmt((alcohol * g) / 100, 1)} g alcohol</b> · about {fmt((alcohol * 7 * g) / 100)} kcal of this. Worked out from the calories (7 kcal per gram); the food tables don’t list it.</p>}
        <DayWithThis add={n} date={date} entry={entry} />
        <button onClick={() => setShowMore((s) => !s)} className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-semibold text-accent">
          {showMore ? 'Hide' : 'Show'} vitamins, minerals & sugar <ChevronDown size={14} className={cx('transition', showMore && 'rotate-180')} />
        </button>
        {food.source === 'custom' && !entry && !(food as { recipe?: unknown }).recipe && (
          <button onClick={() => setFixing(true)} className="mt-1 flex w-full items-center justify-center gap-1 text-xs font-semibold text-silver">Your food · <span className="text-accent underline">Edit its numbers</span></button>
        )}
        {food.source !== 'custom' && !entry && (
          <button onClick={() => setFixing(true)} className="mt-1 flex w-full items-center justify-center gap-1 text-xs font-semibold text-silver">Numbers don’t match your pack? <span className="text-accent underline">Fix them</span></button>
        )}
        <CreateFood open={fixing} onClose={() => setFixing(false)} from={food} onSaved={(f) => onSwitchFood?.(f)} />
        {showMore && (
          <div className="mt-1 animate-fade">
            <NutrientList compact values={Object.fromEntries(EXTRA_KEYS.map((k) => [k, scale(per100[k] ?? null, g)]))} />
            <p className="mt-2 text-[12px] text-dim">% of the daily value (US FDA reference for adults).</p>
          </div>
        )}
      </div>

      {/* Meal */}
      <MealPicker value={meal} onChange={setMeal} options={MEALS} />
      {entry && (
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-2.5 text-sm">
          <span className="font-semibold">Day</span>
          <input type="date" max={todayKey()} value={moveTo || entry.date} onChange={(e) => setMoveTo(e.target.value)} className="bg-transparent text-right font-semibold outline-none" aria-label="Day this food was eaten" />
        </label>
      )}

      {/* Photo */}
      {photoUrl ? (
        <div className="relative overflow-hidden rounded-[28px]">
          <img src={photoUrl} alt="Food" className="h-44 w-full object-cover" />
          <button onClick={removePhoto} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur" aria-label="Remove photo">
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => camRef.current?.click()} disabled={busy} className="chip h-12 justify-center !bg-surface !text-ink"><Camera size={18} /> Camera</button>
          <button onClick={() => galRef.current?.click()} disabled={busy} className="chip h-12 justify-center !bg-surface !text-ink"><ImagePlus size={18} /> Gallery</button>
        </div>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />

      {/* World dishes are worked out from one standard recipe: say so, and let people use their own. */}
      {food.source === 'recipe' && standardRecipe(food.sourceNote) && (
        <div className="rounded-2xl bg-raised px-4 py-3 text-[14px] leading-relaxed">
          <p><b>Estimate from a standard recipe.</b> <span className="text-silver">Home cooking varies, especially oil and meat. If yours is different, make it your way and log your own version.</span></p>
          <Link to={`/recipe?from=${encodeURIComponent(food.id)}`} onClick={onClose} className="mt-1 inline-block font-semibold text-accent">Make it your way →</Link>
        </div>
      )}

      {/* Source */}
      <div>
        {(() => { const q = dataQuality(food); return (
          <p className={cx('mb-1 flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold', q.level === 'measured' ? 'text-accent' : 'text-silver')}>
            <span className={cx('h-2 w-2 rounded-full', q.level === 'measured' ? 'bg-accent' : q.level === 'calculated' ? 'bg-[#E9B949]' : 'bg-silver')} />
            {q.text}{q.missing > 0 ? ` · ${q.missing} nutrient${q.missing > 1 ? 's' : ''} not listed` : ''}
          </p>
        ); })()}
        {food.checkNote && (
          <p className="mb-2 rounded-xl bg-[#B7791F]/10 px-3 py-2 text-xs leading-snug text-[#8a5a12] dark:text-[#E9B44C]">{food.checkNote}</p>
        )}
        {food.source === 'off' && labelAge(food.sourceNote) && (
          <p className="mb-2 rounded-xl bg-[#B7791F]/10 px-3 py-2 text-xs leading-snug text-[#8a5a12] dark:text-[#E9B44C]">This product’s label data was last updated {labelAge(food.sourceNote)}. Recipes and packs change, so check the numbers against your pack.</p>
        )}
        <button onClick={() => setShowSource((s) => !s)} className="flex w-full items-center justify-center gap-1 py-1 text-xs font-semibold text-silver">
          {sourceInfo(food).label.split(' · ')[0]} · per 100g
          <ChevronDown size={14} className={cx('transition', showSource && 'rotate-180')} />
        </button>
        {showSource && (
          <div className="card mt-2 animate-fade p-4 text-sm">
            <dl className="num grid grid-cols-2 gap-y-1.5 font-medium">
              <dt className="text-silver">Protein</dt><dd className="text-right font-semibold">{fmt(per100.protein, 2)} g</dd>
              <dt className="text-silver">Energy</dt><dd className="text-right font-semibold">{fmt(per100.kcal)} kcal</dd>
              <dt className="text-silver">Carbohydrate</dt><dd className="text-right font-semibold">{fmt(per100.carbs, 2)} g</dd>
              <dt className="text-silver">Fat</dt><dd className="text-right font-semibold">{fmt(per100.fat, 2)} g</dd>
              <dt className="text-silver">Fibre</dt><dd className="text-right font-semibold">{fmt(per100.fiber, 2)} g</dd>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-silver">
              {sourceInfo(food).url ? (
                <a className="inline-flex items-center gap-1 font-semibold text-accent" href={sourceInfo(food).url} target="_blank" rel="noreferrer">
                  {sourceInfo(food).label} <ExternalLink size={11} />
                </a>
              ) : (
                <>{sourceInfo(food).label}</>
              )}
              {entry && ' · values as logged'}
            </p>
            {reported ? (
              <p className="mt-2 text-xs font-semibold text-accent">Thanks — we’ll check this food.</p>
            ) : (
              <button
                onClick={() => {
                  const why = prompt('What looks wrong with this food? (e.g. calories too high, wrong serving size)');
                  if (!why?.trim()) return;
                  void aiHeaders().then((headers) => fetch('/api/feedback', { method: 'POST', headers, body: JSON.stringify({ items: [{ aiName: `REPORT: ${why.trim()}`.slice(0, 80), chosenFoodId: food.id, chosenName: food.name, rank: -1, kind: 'item' }] }) })).catch(() => undefined);
                  setReported(true);
                }}
                className="mt-2 text-xs font-semibold text-silver underline"
              >
                Something wrong with these numbers? Report it
              </button>
            )}

            {food.source === 'off' && (
              <Link to="/snap?mode=label" onClick={onClose} className="mt-2 block text-xs font-semibold text-accent">Numbers don’t match your pack? Scan its nutrition label to save the right ones</Link>
            )}
          </div>
        )}
      </div>

      {!entry && g > 0 && !isFuture && (
        <button onClick={planForLater} className="w-full text-center text-[14px] font-semibold text-silver">Plan for later — don’t count it yet</button>
      )}
      <div className="flex gap-2 pt-1">
        {entry && (
          <button
            onClick={() => {
              const gone = entry;
              removeEntry(entry.id, { keepPhoto: true });
              toast(`Deleted ${splitName(entry.food.name).title.toLowerCase()}`, { action: { label: 'Undo', run: () => useStore.getState().restoreEntry(gone) }, ms: 6000 });
              // The photo is only removed once undo is no longer possible and nothing else uses it.
              if (gone.photoId) setTimeout(() => { if (!useStore.getState().entries.some((x) => x.photoId === gone.photoId)) void deletePhoto(gone.photoId!); }, 8000);
              onClose();
            }}
            className="btn-ghost !px-5 text-danger"
            aria-label="Delete entry"
          >
            <Trash2 size={20} />
          </button>
        )}
        {entry && (
          <button
            onClick={() => { haptic(); addEntry({ date: todayKey(), meal: mealForNow(), food, grams: round1(g > 0 ? g : entry.grams) }); toast('Logged again for today'); onClose(); }}
            className="btn-ghost !px-4 text-sm"
          >
            <Copy size={18} /> Log again
          </button>
        )}
        {!entry && (
          <button
            onClick={() => { haptic(); rememberFood(food); toggleFavorite(food.id); toast(isFav ? 'Removed from favourites' : 'Saved to favourites'); }}
            className={cx('btn !h-14 !w-14 !px-0', isFav ? 'bg-accent/10 text-accent' : 'bg-surface text-ink')}
            style={{ boxShadow: 'var(--shadow)' }}
            aria-label={isFav ? 'Remove from favourites' : 'Save to favourites'}
          >
            <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        )}
        <button onClick={save} disabled={g <= 0 || busy} className="btn-primary flex-1">
          {entry ? (entry.planned ? (isFuture ? 'Save plan' : 'Mark as eaten') : 'Save changes') : isFuture ? (g > 0 ? `Plan for ${fromKey(date).toLocaleDateString(undefined, { weekday: 'long' })}` : 'Enter the weight first') : g > 0 ? `Add to ${MEALS.find((m) => m.value === meal)?.label ?? 'log'}${n.kcal != null ? ` · ${fmt(n.kcal)} kcal` : ''}` : 'Enter the weight first'}
        </button>
      </div>
    </div>
  );
}

/** The parts of `other`'s description that differ from `base` (e.g. "cooked, braised"). */
function diffLabel(base: string, other: string): string {
  const have = new Set(base.split(', '));
  const diff = other.split(', ').filter((p) => !have.has(p));
  return diff.join(', ') || other;
}

/** Short label for what differs besides the raw/cooked badge, e.g. "Fresh", "Roasted", or "Plain". */
function prettyDiff(base: string, other: string): string {
  const parts = diffLabel(base, other).split(/,\s*/).filter((p) => !/^(raw|cooked|uncooked|dry)$/i.test(p.trim()));
  let label = parts.join(', ').trim() || 'Plain';
  if (label.length > 28) label = label.slice(0, 28).replace(/[ ,]+\S*$/, '') + '…';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void };
const SpeechRec = typeof window !== 'undefined' ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Rec) | undefined : undefined;

/** Say the amount ("150 grams", "two pieces", "a cup"); only uses this food's own serving sizes. */
function SayAmount({ food, onGrams }: { food: Food; onGrams: (g: number, how: string) => void }) {
  const [on, setOn] = useState(false);
  const recRef = useRef<Rec | null>(null);
  useEffect(() => () => recRef.current?.stop(), []);
  if (!SpeechRec) return null;
  function start() {
    if (on) { recRef.current?.stop(); return; }
    const r = new SpeechRec!();
    r.lang = navigator.language || 'en-GB'; r.interimResults = false; r.continuous = false;
    let said = '';
    r.onresult = (e) => { said = Array.from(e.results).map((x) => x[0].transcript).join(' '); };
    r.onend = () => {
      setOn(false); recRef.current = null;
      if (!said) return;
      const a = parseAmount(said);
      const g = a.qty != null ? gramsFor(food, a.qty, a.unit, a.size) : null;
      if (g) { onGrams(g.grams, g.how); haptic(); toast(`Set to ${g.how} = ${fmt(g.grams)} g`); }
      else toast(`Heard “${said}” — say grams, or a serving this food has (e.g. ${food.portions[0]?.label ?? '150 grams'})`);
    };
    r.onerror = () => setOn(false);
    recRef.current = r; setOn(true); haptic();
    try { r.start(); } catch { setOn(false); }
  }
  return (
    <button type="button" onClick={start} className={cx('chip shrink-0', on && 'chip-on')} aria-label="Say the amount"><Mic size={15} /> {on ? 'Listening…' : 'Say it'}</button>
  );
}

/** Today's totals with this food added: eaten so far + this, against each daily target. */
function DayWithThis({ add, date, entry }: { add: { kcal: number | null; protein: number; carbs: number | null; fat: number | null }; date: string; entry?: LogEntry }) {
  const day = useDay(date);
  const profile = useStore((s) => s.profile);
  const t = profile ? dailyTargets(profile, day.goal) : null;
  if (!t) return null;
  const minus = entry ? nutrientsFor(entry.food.per100, entry.grams) : null;
  const rows: [string, number, number | undefined, string][] = [
    ['Calories', day.totals.kcal - (minus?.kcal ?? 0) + (add.kcal ?? 0), t.kcal, 'kcal'],
    ['Protein', day.totals.protein - (minus?.protein ?? 0) + add.protein, t.protein, 'g'],
    ['Carbs', day.totals.carbs - (minus?.carbs ?? 0) + (add.carbs ?? 0), t.carbs, 'g'],
    ['Fat', day.totals.fat - (minus?.fat ?? 0) + (add.fat ?? 0), t.fat, 'g'],
  ];
  return (
    <div className="mt-4 rounded-2xl bg-raised px-4 py-3">
      <p className="mb-2 text-[12px] font-semibold text-silver">{date === todayKey() ? 'Today' : 'This day'} with this food · eaten / daily target</p>
      <div className="space-y-1.5">
        {rows.filter(([, , target]) => target).map(([l, v, target, u]) => {
          const pct = Math.min(1, v / target!); const left = target! - v;
          return (
            <div key={l} className="grid grid-cols-[4.2rem_1fr_auto] items-center gap-2 text-[13px]">
              <span className="font-semibold">{l}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-line"><span className={cx('block h-full rounded-full', left < 0 ? 'bg-warn' : 'bg-accent')} style={{ width: `${pct * 100}%` }} /></span>
              <span className="num text-silver">{fmt(v)} / {fmt(target!)} {u} · {left >= 0 ? `${fmt(left)} left` : `${fmt(-left)} over`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "in March 2021 (over 3 years ago)" when an Open Food Facts label record is old, else null. */
function labelAge(note?: string): string | null {
  const m = /label data (\d{4})-(\d{2})/.exec(note ?? '');
  if (!m) return null;
  const at = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const years = (Date.now() - at.getTime()) / (365.25 * 864e5);
  if (years < 3) return null;
  return `in ${at.toLocaleDateString([], { month: 'long', year: 'numeric' })} (over ${Math.floor(years)} years ago)`;
}
