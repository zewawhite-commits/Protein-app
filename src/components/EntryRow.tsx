import type { LogEntry } from '@/lib/types';
import { nutrientsFor } from '@/lib/nutrition';
import { splitName } from '@/lib/foods';
import { useFoodLookup } from '@/lib/hooks';
import { FoodVisual } from './FoodIcon';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StateBadge, cx, fmt } from './ui';
import { haptic, toast } from './fx';

export function EntryRow({ entry, onClick, deletable = true }: { entry: LogEntry; onClick?: () => void; deletable?: boolean }) {
  const lookup = useFoodLookup();
  const n = nutrientsFor(entry.food.per100, entry.grams);
  const { title } = splitName(entry.food.name);
  // Delete straight from the list (with Undo), so nobody has to open the food to remove it.
  function remove() {
    haptic();
    useStore.getState().removeEntry(entry.id, { keepPhoto: true });
    toast(`Removed ${title}`, { action: { label: 'Undo', run: () => useStore.setState((s) => ({ entries: [...s.entries, entry], deleted: Object.fromEntries(Object.entries(s.deleted).filter(([k]) => k !== entry.id)) })) } });
  }
  return (
    <div className="flex items-center">
    <button onClick={onClick} className={cx('flex min-w-0 flex-1 items-center gap-4 rounded-[22px] p-3.5 text-left transition active:scale-[.99] active:bg-raised/60', entry.planned && 'opacity-60')}>
      <FoodVisual name={entry.food.name} category={lookup(entry.foodId)?.category} photoId={entry.photoId} fdcId={entry.food.fdcId} size={56} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[16px] font-bold leading-snug">{title}</p>
        <p className="num mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-silver">
          <StateBadge state={entry.food.state} className="shrink-0" />
          <span className="whitespace-nowrap">{fmt(entry.grams)} g</span>
          {entry.planned && <span className="whitespace-nowrap rounded-full bg-accent/10 px-1.5 text-[11px] font-semibold leading-4 text-accent" title="Not counted yet — tap to mark as eaten">planned · tap when eaten</span>}
          {entry.note?.startsWith('Portion estimated') && <span className="whitespace-nowrap rounded-full border border-dashed border-silver/60 px-1.5 text-[11px] font-semibold leading-4" title="The AI guessed this weight from the photo. Tap to set the real weight.">estimated</span>}
          <span className="whitespace-nowrap"><span className="text-accent">P {fmt(n.protein, n.protein < 10 ? 1 : 0)}</span>{n.carbs != null && <> · C {fmt(n.carbs)}</>}{n.fat != null && <> · F {fmt(n.fat)}</>}</span>
        </p>
      </div>
      <div className="text-right">
        <p className="num text-lg font-bold leading-none">{n.kcal == null ? '—' : fmt(n.kcal)}</p>
        <p className="mt-1 text-[12px] font-semibold text-dim">kcal</p>
      </div>
    </button>
    {deletable && <button onClick={remove} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-dim transition active:bg-raised active:text-danger" aria-label={`Delete ${title}`}><Trash2 size={17} /></button>}
    </div>
  );
}
