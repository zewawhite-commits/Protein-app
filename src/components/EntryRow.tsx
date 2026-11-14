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
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-[22px] p-3.5 text-left transition active:scale-[.99] active:bg-raised/60">
      <FoodVisual name={entry.food.name} category={lookup(entry.foodId)?.category} photoId={entry.photoId} fdcId={entry.food.fdcId} size={56} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[16px] font-bold leading-snug">{title}</p>
        <p className="num mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-silver">
          <StateBadge state={entry.food.state} className="shrink-0" />
          <span className="whitespace-nowrap">{fmt(entry.grams)} g</span>
          <span className="whitespace-nowrap"><span className="text-accent">P {fmt(n.protein, n.protein < 10 ? 1 : 0)}</span>{n.carbs != null && <> · C {fmt(n.carbs)}</>}{n.fat != null && <> · F {fmt(n.fat)}</>}</span>
        </p>
      </div>
      <div className="text-right">
        <p className="num text-lg font-bold leading-none">{n.kcal == null ? '—' : fmt(n.kcal)}</p>
        <p className="mt-1 text-[12px] font-semibold text-dim">kcal</p>
      </div>
    </button>
  );
}
