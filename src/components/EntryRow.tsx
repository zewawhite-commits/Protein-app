import { UtensilsCrossed } from 'lucide-react';
import type { LogEntry } from '@/lib/types';
import { nutrientsFor } from '@/lib/nutrition';
import { splitName } from '@/lib/foods';
import { usePhotoUrl } from '@/lib/hooks';
import { formatTime } from '@/lib/dates';
import { StateBadge, fmt } from './ui';

export function Thumb({ photoId, size = 48 }: { photoId?: string; size?: number }) {
  const url = usePhotoUrl(photoId);
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-raised text-dim border border-line/60" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed size={size * 0.38} />}
    </div>
  );
}

export function EntryRow({ entry, onClick, showTime = true }: { entry: LogEntry; onClick?: () => void; showTime?: boolean }) {
  const p = nutrientsFor(entry.food.per100, entry.grams).protein;
  const { title } = splitName(entry.food.name);
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl p-2 -mx-2 text-left transition hover:bg-raised/60 active:bg-raised">
      <Thumb photoId={entry.photoId} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-silver">
          <span className="tabular-nums">{fmt(entry.grams, 1)} g</span>
          {entry.food.state !== 'na' && <StateBadge state={entry.food.state} className="!py-0 !text-[9px]" />}
          {showTime && <span className="text-dim">{formatTime(entry.loggedAt)}</span>}
        </div>
      </div>
      <p className="text-right">
        <span className="text-lg font-semibold tabular-nums">{fmt(p, 1)}</span>
        <span className="text-xs text-silver"> g</span>
      </p>
    </button>
  );
}
