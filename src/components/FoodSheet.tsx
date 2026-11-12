import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ExternalLink, ImagePlus, Minus, Plus, Star, Trash2, ArrowLeftRight, Info } from 'lucide-react';
import type { Food, LogEntry, Meal } from '@/lib/types';
import { nutrientsFor, round1 } from '@/lib/nutrition';
import { counterparts, fdcUrl, splitName } from '@/lib/foods';
import { deletePhoto, savePhoto } from '@/lib/photos';
import { useFoodDb, usePhotoUrl, useDay } from '@/lib/hooks';
import { useStore } from '@/store/useStore';
import { mealForNow } from '@/lib/dates';
import { Sheet, StateBadge, cx, fmt } from './ui';

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
}

export function FoodSheet({ food, date, entry, onClose, onSaved, onSwitchFood }: Props) {
  const open = !!food;
  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Edit entry' : 'Add food'}>
      {food && <Body key={food.id + (entry?.id ?? '')} food={food} date={date} entry={entry} onClose={onClose} onSaved={onSaved} onSwitchFood={onSwitchFood} />}
    </Sheet>
  );
}

function Body({ food, date, entry, onClose, onSaved, onSwitchFood }: Props & { food: Food }) {
  const addEntry = useStore((s) => s.addEntry);
  const updateEntry = useStore((s) => s.updateEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const favs = useStore((s) => s.favoriteFoodIds);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const { db } = useFoodDb();
  const day = useDay(date);

  const [grams, setGrams] = useState(entry ? String(entry.grams) : '100');
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? mealForNow());
  const [photoId, setPhotoId] = useState<string | undefined>(entry?.photoId);
  const [busy, setBusy] = useState(false);
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
  const remainingAfter = Math.max(0, day.goal - day.totals.protein - (entry ? -nutrientsFor(entry.food.per100, entry.grams).protein : 0) - n.protein);

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

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <StateBadge state={food.state} />
            <span className="text-[11px] text-dim">{food.source === 'custom' ? 'Custom record' : food.category}</span>
          </div>
          <p className="text-xl font-semibold leading-snug tracking-tight">{title}</p>
          {detail && <p className="text-sm text-silver mt-0.5">{detail}</p>}
        </div>
        <button
          onClick={() => toggleFavorite(food.id)}
          aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
          className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full border', isFav ? 'bg-accent/15 border-accent/40 text-accent' : 'bg-raised border-line text-silver')}
        >
          <Star size={18} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Raw / cooked guidance */}
      {food.state !== 'na' && !entry && (
        <div className="rounded-2xl border border-line bg-raised/60 p-3.5">
          <p className="flex items-start gap-2 text-sm text-silver">
            <Info size={16} className="mt-0.5 shrink-0 text-accent" />
            {food.state === 'cooked'
              ? 'Values are for the cooked food. Weigh it after cooking.'
              : food.state === 'dry'
                ? 'Values are for the dry product. Weigh it before cooking.'
                : 'Values are for the raw food. Weigh it before cooking.'}
          </p>
          {alt.length > 0 && onSwitchFood && (<>
            <p className="mt-3 text-xs text-dim">Weighed it in a different state? Switch to:</p>
              <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              {alt.slice(0, 4).map((a) => (
                <button key={a.id} onClick={() => onSwitchFood(a)} className="chip shrink-0 !h-8 text-xs">
                  <ArrowLeftRight size={13} className="shrink-0" /> <span className="max-w-[14rem] truncate">{diffLabel(food.name, a.name)}</span>
                </button>
              ))}
            </div>
          </>)}
        </div>
      )}

      {/* Weight */}
      <div>
        <label htmlFor="grams" className="label">Weight</label>
        <div className="flex items-center gap-3">
          <button onClick={() => bump(-5)} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-raised border border-line" aria-label="Minus 5 grams"><Minus size={20} /></button>
          <div className="relative flex-1">
            <input
              id="grams"
              ref={inputRef}
              inputMode="decimal"
              value={grams}
              onChange={(e) => setGrams(e.target.value.replace(/[^\d.,]/g, ''))}
              onFocus={(e) => e.target.select()}
              className="w-full h-14 rounded-2xl bg-raised border border-line text-center text-3xl font-semibold tracking-tight outline-none focus:border-accent pr-8"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-silver">g</span>
          </div>
          <button onClick={() => bump(5)} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-raised border border-line" aria-label="Plus 5 grams"><Plus size={20} /></button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {[50, 100, 150, 200, 250].map((v) => (
            <button key={v} onClick={() => setGrams(String(v))} className={cx('chip shrink-0', g === v && 'chip-on')}>{v} g</button>
          ))}
          {food.portions.map((p) => (
            <button key={p.label} onClick={() => setGrams(String(p.grams))} className={cx('chip shrink-0', g === p.grams && 'chip-on')}>
              {p.label} · {fmt(p.grams, 1)} g
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <div className="rounded-3xl bg-gradient-to-br from-accent/20 via-accent/5 to-transparent border border-accent/25 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow !text-accent">Protein</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
              {fmt(n.protein, 1)}<span className="text-2xl text-silver ml-1">g</span>
            </p>
          </div>
          <p className="text-right text-xs text-silver leading-relaxed">
            {remainingAfter > 0 ? <>{fmt(remainingAfter)} g to go<br />after this</> : <>Goal reached<br />with this</>}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {([['kcal', n.kcal, 0], ['Carbs', n.carbs, 1], ['Fat', n.fat, 1]] as const).map(([l, v, d]) => (
            <div key={l} className="rounded-2xl bg-surface/70 border border-line/60 py-2.5">
              <p className="text-base font-semibold tabular-nums">{fmt(v, d)}{l !== 'kcal' && v != null && <span className="text-xs text-silver"> g</span>}</p>
              <p className="text-[11px] text-dim">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Meal */}
      <div>
        <span className="label">Meal</span>
        <div className="grid grid-cols-4 gap-2">
          {MEALS.map((m) => (
            <button key={m.value} onClick={() => setMeal(m.value)} className={cx('chip justify-center !px-0', meal === m.value && 'chip-on')}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* Photo */}
      <div>
        <span className="label">Photo</span>
        {photoUrl ? (
          <div className="relative overflow-hidden rounded-3xl border border-line">
            <img src={photoUrl} alt="Food" className="h-48 w-full object-cover" />
            <button onClick={removePhoto} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur" aria-label="Remove photo">
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => camRef.current?.click()} disabled={busy} className="btn-ghost !h-12 text-sm"><Camera size={18} /> Take photo</button>
            <button onClick={() => galRef.current?.click()} disabled={busy} className="btn-ghost !h-12 text-sm"><ImagePlus size={18} /> From gallery</button>
          </div>
        )}
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>

      {/* Source */}
      <details className="group rounded-2xl border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-silver">
          <span>Per 100 g · source</span>
          <span className="text-dim group-open:rotate-45 transition text-lg leading-none">+</span>
        </summary>
        <div className="border-t border-line px-4 py-3 text-sm">
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-silver">Protein</dt><dd className="text-right tabular-nums">{fmt(per100.protein, 2)} g</dd>
            <dt className="text-silver">Energy</dt><dd className="text-right tabular-nums">{fmt(per100.kcal)} kcal</dd>
            <dt className="text-silver">Carbohydrate</dt><dd className="text-right tabular-nums">{fmt(per100.carbs, 2)} g</dd>
            <dt className="text-silver">Fat</dt><dd className="text-right tabular-nums">{fmt(per100.fat, 2)} g</dd>
            <dt className="text-silver">Fibre</dt><dd className="text-right tabular-nums">{fmt(per100.fiber, 2)} g</dd>
          </dl>
          <p className="mt-3 text-xs text-dim leading-relaxed">
            {food.source === 'usda-sr' ? (
              <>
                USDA FoodData Central, SR Legacy · FDC ID {food.fdcId}.{' '}
                <a className="inline-flex items-center gap-1 text-accent" href={fdcUrl(food.fdcId!)} target="_blank" rel="noreferrer">
                  View record <ExternalLink size={11} />
                </a>
              </>
            ) : (
              <>Custom record · Source: {food.sourceNote}</>
            )}
            {entry && ' Values shown are as logged.'}
          </p>
        </div>
      </details>

      <div className="flex gap-2 pt-1">
        {entry && (
          <button
            onClick={() => { removeEntry(entry.id); onClose(); }}
            className="btn-ghost !px-4 text-danger"
            aria-label="Delete entry"
          >
            <Trash2 size={18} />
          </button>
        )}
        <button onClick={save} disabled={g <= 0 || busy} className="btn-primary flex-1">
          {entry ? 'Save changes' : `Add ${fmt(n.protein, 1)} g protein`}
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
