import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, ExternalLink, ImagePlus, Minus, Plus, Star, Trash2, ArrowLeftRight, Scale } from 'lucide-react';
import type { Food, LogEntry, Meal } from '@/lib/types';
import { nutrientsFor, round1 } from '@/lib/nutrition';
import { counterparts, sourceInfo, splitName } from '@/lib/foods';
import { deletePhoto, savePhoto } from '@/lib/photos';
import { useFoodDb, usePhotoUrl, useDay } from '@/lib/hooks';
import { useStore } from '@/store/useStore';
import { mealForNow } from '@/lib/dates';
import { Ring, Segmented, Sheet, StateBadge, cx, fmt } from './ui';
import { FoodVisual } from './FoodIcon';

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
  preset?: { photoId?: string; grams?: number; aiLabel?: string };
}

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
  const favs = useStore((s) => s.favoriteFoodIds);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const rememberFood = useStore((s) => s.rememberFood);
  const { db } = useFoodDb();
  const day = useDay(date);

  const [grams, setGrams] = useState(entry ? String(entry.grams) : preset?.grams ? String(preset.grams) : '100');
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? mealForNow());
  const [photoId, setPhotoId] = useState<string | undefined>(entry?.photoId ?? preset?.photoId);
  const [busy, setBusy] = useState(false);
  const [showSource, setShowSource] = useState(false);
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
  const g = Math.max(0, Number(grams.replace(',', '.')) || 0);
  const n = nutrientsFor(per100, g);
  const { title, detail } = splitName(food.name);
  const alt = useMemo(() => (db ? counterparts(food, db.foods) : []), [db, food]);
  const isFav = favs.includes(food.id);
  const before = day.totals.protein - (entry ? nutrientsFor(entry.food.per100, entry.grams).protein : 0);
  const after = before + n.protein;

  const bump = (d: number) => setGrams(String(Math.max(0, Math.round(g + d))));

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

  function save() {
    if (g <= 0) { inputRef.current?.focus(); return; }
    savedRef.current = true;
    if (entry) updateEntry(entry.id, { grams: round1(g), meal, photoId });
    else addEntry({ date, meal, food, grams: round1(g), photoId });
    onSaved?.();
    onClose();
  }

  const weighHint = food.state === 'cooked' ? 'Weigh after cooking' : food.state === 'dry' ? 'Weigh dry, before cooking' : food.state === 'raw' ? 'Weigh raw, before cooking' : null;

  return (
    <div className="space-y-4">
      {/* Food */}
      <div className="flex items-center gap-3.5">
        <FoodVisual name={food.name} category={food.category} size={60} className="!bg-surface" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight tracking-tight">{title}</p>
          {detail && <p className="mt-0.5 line-clamp-2 text-[13px] font-medium text-silver">{detail}</p>}
        </div>
        <button
          onClick={() => { rememberFood(food); toggleFavorite(food.id); }}
          aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
          className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full', isFav ? 'bg-primary text-on-primary' : 'bg-surface text-ink')}
        >
          <Star size={18} strokeWidth={2.2} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Weight */}
      <div className="card p-5">
        {preset?.aiLabel && !entry && (
          <p className="mb-3 rounded-2xl bg-accent/10 px-3 py-2 text-center text-xs font-semibold text-accent">
            {preset.aiLabel}
          </p>
        )}
        {weighHint && !entry && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <StateBadge state={food.state} />
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-silver"><Scale size={14} /> {weighHint}</span>
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
              aria-label="Weight in grams"
              className="num min-w-0 bg-transparent text-center text-[56px] font-extrabold leading-none outline-none"
              style={{ width: `${Math.max(2, grams.length) + 0.5}ch` }}
            />
            <span className="text-2xl font-semibold text-silver">g</span>
          </label>
          <button onClick={() => bump(5)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised" aria-label="Plus 5 grams"><Plus size={20} strokeWidth={2.6} /></button>
        </div>
        <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          {[50, 100, 150, 200].map((v) => (
            <button key={v} onClick={() => setGrams(String(v))} className={cx('chip shrink-0', g === v && 'chip-on')}>{v}g</button>
          ))}
          {food.portions.map((p) => (
            <button key={p.label} onClick={() => setGrams(String(p.grams))} className={cx('chip shrink-0', g === p.grams && 'chip-on')}>
              {p.label} <span className="opacity-60">{fmt(p.grams)}g</span>
            </button>
          ))}
        </div>
      </div>

      {/* Switch raw/cooked */}
      {alt.length > 0 && onSwitchFood && !entry && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          {alt.slice(0, 4).map((a) => (
            <button key={a.id} onClick={() => onSwitchFood(a)} className="chip shrink-0 !bg-surface !text-ink">
              <ArrowLeftRight size={14} className="shrink-0" />
              <span className="max-w-[14rem] truncate">Use {diffLabel(food.name, a.name)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Result */}
      <div className="card flex items-center gap-4 p-5">
        <Ring value={day.goal ? after / day.goal : 0} size={64} stroke={7} color={after >= day.goal ? 'accent' : 'ink'} track="raised">
          <span className="num text-xs font-bold">{day.goal ? fmt(Math.min(999, (after / day.goal) * 100)) : 0}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="num text-[34px] font-bold leading-none">{fmt(n.protein, 1)}<span className="text-lg text-silver">g</span></p>
          <p className="mt-1 text-[13px] font-semibold">protein</p>
        </div>
        <div className="num space-y-0.5 text-right text-[13px] font-semibold text-silver">
          <p><span className="font-semibold text-ink">{fmt(n.kcal)}</span> kcal</p>
          <p><span className="font-semibold text-ink">{fmt(n.carbs, 1)}</span>g carbs</p>
          <p><span className="font-semibold text-ink">{fmt(n.fat, 1)}</span>g fat</p>
        </div>
      </div>

      {/* Meal */}
      <Segmented full value={meal} onChange={setMeal} options={MEALS} />

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
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        {entry && (
          <button onClick={() => { removeEntry(entry.id); onClose(); }} className="btn-ghost !px-5 text-danger" aria-label="Delete entry">
            <Trash2 size={20} />
          </button>
        )}
        <button onClick={save} disabled={g <= 0 || busy} className="btn-primary flex-1">
          {entry ? 'Save changes' : 'Add to log'}
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
