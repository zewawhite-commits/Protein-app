import { aiHeaders } from '@/lib/premium';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, ExternalLink, Heart, ImagePlus, Minus, Plus, Trash2, Copy, ArrowLeftRight, Scale } from 'lucide-react';
import type { Food, LogEntry, Meal } from '@/lib/types';
import { nutrientsFor, round1, scale } from '@/lib/nutrition';
import { EXTRA_KEYS } from '@/lib/nutrients';
import { MACRO_COLOR, NutrientList } from './Nutrients';
import { counterparts, dataQuality, similarFoods, sourceInfo, splitName } from '@/lib/foods';
import { fitsDiet } from '@/lib/goals';
import { foodAllergens } from '@/lib/allergens';
import { useAvoid } from './Allergy';
import { deletePhoto, savePhoto } from '@/lib/photos';
import { useFoodDb, usePhotoUrl, useDay } from '@/lib/hooks';
import { useStore } from '@/store/useStore';
import { AllergyBanner } from './Allergy';
import { mealForNow, todayKey } from '@/lib/dates';
import { Ring, Segmented, Sheet, StateBadge, cx, fmt } from './ui';
import { FoodVisual } from './FoodIcon';
import { CountUp, haptic, toast } from './fx';

const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

interface Props {
  food: Food | null;
  date: string;
  entry?: LogEntry;
  onClose: () => void;
  onSaved?: () => void;
  onSwitchFood?: (f: Food) => void;
  /** Starting values from the photo flow: the meal photo and an AI portion estimate (a suggestion only). */
  /** From the photo flow: the meal photo and the AI's rough portion guess (never pre-filled as the weight). */
  preset?: { photoId?: string; aiEstimate?: number };
}

type Unit = 'g' | 'ml' | 'oz';
const UNIT_G: Record<Unit, number> = { g: 1, ml: 1, oz: 28.3495 };
const UNIT_NAME: Record<Unit, string> = { g: 'grams', ml: 'millilitres', oz: 'ounces' };
const toUnit = (grams: number, u: Unit) => String(Math.round((grams / UNIT_G[u]) * (u === 'oz' ? 10 : 1)) / (u === 'oz' ? 10 : 1));
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

  // The weight is always what the user enters; nothing is pre-filled for a new entry.
  // The amount typed, in the chosen unit; nutrition always uses grams.
  const liquid = isLiquid(food);
  const [unit, setUnitState] = useState<Unit>(() => { try { const u = localStorage.getItem('provora-unit') as Unit | null; return u === 'oz' || (u === 'ml' && liquid) ? u : 'g'; } catch { return 'g'; } });
  const [grams, setGrams] = useState(entry ? toUnit(entry.grams, unit) : '');
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? mealForNow());
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
  const g = Math.max(0, (Number(grams.replace(',', '.')) || 0) * UNIT_G[unit]);
  /** Set the amount from a weight in grams, shown in the current unit. */
  const setG = (v: number) => setGrams(toUnit(v, unit));
  const setUnit = (u: Unit) => { setGrams(g ? toUnit(g, u) : ''); setUnitState(u); try { localStorage.setItem('provora-unit', u); } catch { /* ignore */ } };
  const n = nutrientsFor(per100, g);
  const { title, detail } = splitName(food.name);
  const alt = useMemo(() => (db ? counterparts(food, db.foods) : []), [db, food]);
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

  const bump = (d: number) => setG(Math.max(0, g + (unit === 'oz' ? Math.sign(d) * 14.17 : d)));

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
    toast('Planned — it counts once you mark it eaten');
    onSaved?.();
    onClose();
  }

  function save() {
    if (g <= 0) { inputRef.current?.focus(); return; }
    savedRef.current = true;
    const crossesGoal = day.goal > 0 && before + (entry ? nutrientsFor(entry.food.per100, entry.grams).protein : 0) < day.goal && after >= day.goal;
    if (entry) updateEntry(entry.id, { grams: round1(g), meal, photoId, ...(entry.planned ? { planned: false } : {}), ...(moveTo && moveTo !== entry.date ? { date: moveTo } : {}), ...(entry.note?.startsWith('Portion estimated') && round1(g) !== entry.grams ? { note: 'Weight set by you' } : {}) });
    else {
      // Same food on the same day in the last 2 minutes: probably a double tap, so say so and offer undo.
      const dup = useStore.getState().entries.some((e) => e.date === date && e.foodId === food.id && Date.now() - e.loggedAt < 120_000);
      const added = addEntry({ date, meal, food, grams: round1(g), photoId });
      haptic(12);
      if (dup) toast('You logged this a moment ago too — tap Undo if it was a mistake', { action: { label: 'Undo', run: () => useStore.getState().removeEntry(added.id) }, ms: 6000 });
      else if (!crossesGoal)
        toast(n.kcal != null ? `Added ${fmt(n.kcal)} kcal · ${fmt(n.protein)} g protein` : `Added ${fmt(n.protein, 1)} g protein`, { action: { label: 'Undo', run: () => useStore.getState().removeEntry(added.id) } });
    }
    if (crossesGoal) {
      haptic([20, 60, 20]);
      toast(`Goal hit! ${fmt(after)} g of protein${date === todayKey() ? ' today' : ''}`, { tone: 'celebrate', ms: 4500 });
    }
    onSaved?.();
    onClose();
  }

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
        {!entry && (
          <p className="mb-3 text-center text-[14px] font-medium text-silver">
            Weigh the <span className="font-semibold text-ink">edible part</span> — no bones, shells, skins or packaging.
          </p>
        )}
        {weighHint && !entry && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <StateBadge state={food.state} />
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-silver"><Scale size={14} /> {weighHint}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={() => bump(-5)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised" aria-label="Minus 5 grams"><Minus size={20} strokeWidth={2.6} /></button>
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
          <button onClick={() => bump(5)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised" aria-label="Plus 5 grams"><Plus size={20} strokeWidth={2.6} /></button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <Segmented<Unit> value={unit} onChange={(u) => { haptic(); setUnit(u); }} options={(liquid ? ['g', 'ml', 'oz'] as Unit[] : ['g', 'oz'] as Unit[]).map((u) => ({ value: u, label: u }))} />
          {unit !== 'g' && g > 0 && <span className="num text-[13px] text-silver">= {fmt(g)} g{unit === 'ml' ? ' (1 ml ≈ 1 g)' : ''}</span>}
        </div>
        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          {!!preset?.aiEstimate && !entry && (
            <button onClick={() => { haptic(); setG(preset.aiEstimate!); }} className="chip shrink-0 border border-dashed border-accent !bg-accent/10 !text-accent" title="A rough guess from your photo — weigh for accuracy">
              AI estimate ~{preset.aiEstimate}g
            </button>
          )}
          {[50, 100, 150, 200].map((v) => (
            <button key={v} onClick={() => setG(v)} className={cx('chip shrink-0', Math.round(g) === v && 'chip-on')}>{v}g</button>
          ))}
          {food.portions.map((p) => (
            <button key={p.label} onClick={() => setG(p.grams)} className={cx('chip shrink-0', Math.round(g) === Math.round(p.grams) && 'chip-on')}>
              {p.label} <span className="opacity-60">{fmt(p.grams)}g</span>
            </button>
          ))}
        </div>
      </div>

      {similar.length > 0 && onSwitchFood && !entry && (
        <div>
          <p className="mb-2 px-1 text-[14px] font-medium text-silver">Don’t have it? Similar protein and calories:</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
            {similar.map((a) => (
              <button key={a.id} onClick={() => { haptic(); onSwitchFood(a); }} className="chip shrink-0 !bg-surface !text-ink" style={{ boxShadow: 'var(--shadow)' }}>
                <span className="max-w-[12rem] truncate">{splitName(a.name).title}</span>
                <span className="num text-[12px] text-silver">{fmt(a.per100.protein, 0)} g P</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Switch raw/cooked */}
      {alt.length > 0 && onSwitchFood && !entry && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[14px] font-medium text-silver">
            <ArrowLeftRight size={14} /> Weighed it {food.state === 'cooked' ? 'before cooking' : 'after cooking'}? Switch to:
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
          </div>
          <div className="flex flex-col items-center">
            <Ring value={day.goal ? after / day.goal : 0} size={58} stroke={6} color="accent" track="raised">
              <span className="num text-[12px] font-bold">{day.goal ? fmt(Math.min(999, (after / day.goal) * 100)) : 0}%</span>
            </Ring>
            <span className="mt-1 text-[12px] font-medium text-silver">protein goal</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {([['Protein', n.protein, 'protein'], ['Carbs', n.carbs, 'carbs'], ['Fat', n.fat, 'fat'], ['Fibre', n.fiber, 'fiber']] as const).map(([l, v, c]) => (
            <div key={l} className="rounded-2xl bg-raised px-1 py-2">
              <span className={cx('mx-auto mb-1 block h-1.5 w-5 rounded-full', MACRO_COLOR[c])} />
              <p className="num text-[15px] font-bold">{v == null ? '—' : fmt(v, v < 10 ? 1 : 0)}<span className="text-[12px] text-silver">g</span></p>
              <p className="text-[12px] text-silver">{l}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setShowMore((s) => !s)} className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-semibold text-accent">
          {showMore ? 'Hide' : 'Show'} vitamins, minerals & sugar <ChevronDown size={14} className={cx('transition', showMore && 'rotate-180')} />
        </button>
        {showMore && (
          <div className="mt-1 animate-fade">
            <NutrientList compact values={Object.fromEntries(EXTRA_KEYS.map((k) => [k, scale(per100[k] ?? null, g)]))} />
            <p className="mt-2 text-[12px] text-dim">% of the daily value (US FDA reference for adults).</p>
          </div>
        )}
      </div>

      {/* Meal */}
      <Segmented full value={meal} onChange={setMeal} options={MEALS} />
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

      {/* Source */}
      <div>
        {(() => { const q = dataQuality(food); return (
          <p className={cx('mb-1 flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold', q.level === 'measured' ? 'text-accent' : 'text-silver')}>
            <span className={cx('h-2 w-2 rounded-full', q.level === 'measured' ? 'bg-accent' : q.level === 'calculated' ? 'bg-[#E9B949]' : 'bg-silver')} />
            {q.text}{q.missing > 0 ? ` · ${q.missing} nutrient${q.missing > 1 ? 's' : ''} not listed` : ''}
          </p>
        ); })()}
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

      {!entry && g > 0 && (
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
          {entry ? (entry.planned ? 'Mark as eaten' : 'Save changes') : g > 0 ? `Add to ${MEALS.find((m) => m.value === meal)?.label ?? 'log'}${n.kcal != null ? ` · ${fmt(n.kcal)} kcal` : ''}` : 'Enter the weight first'}
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
