import type { LogEntry } from '@/lib/types';
import { nutrientsFor } from '@/lib/nutrition';
import { splitName } from '@/lib/foods';
import { useFoodLookup } from '@/lib/hooks';
import { FoodVisual } from './FoodIcon';
import { StateBadge, fmt } from './ui';

export function EntryRow({ entry, onClick }: { entry: LogEntry; onClick?: () => void }) {
  const lookup = useFoodLookup();
  const n = nutrientsFor(entry.food.per100, entry.grams);
  const { title } = splitName(entry.food.name);
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3.5 rounded-[22px] p-3 text-left transition active:scale-[.99] active:bg-raised/60">
      <FoodVisual name={entry.food.name} category={lookup(entry.foodId)?.category} photoId={entry.photoId} size={56} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold leading-snug">{title}</p>
        <p className="num mt-1 flex items-center gap-1.5 text-xs font-medium text-silver">
          <StateBadge state={entry.food.state} className="shrink-0" />
          {fmt(entry.grams)} g{n.kcal != null && <> · {fmt(n.kcal)} kcal</>}
        </p>
      </div>
      <div className="text-right">
        <p className="num text-lg font-bold leading-none">{fmt(n.protein, 1)}<span className="text-xs font-bold text-silver">g</span></p>
        <p className="mt-1 text-[10px] font-semibold text-dim">protein</p>
      </div>
    </button>
  );
}
