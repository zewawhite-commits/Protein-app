import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import type { LogEntry } from '@/lib/types';
import { usePhotoUrl } from '@/lib/hooks';
import { todayKey } from '@/lib/dates';
import { splitName } from '@/lib/foods';

function Tile({ entry }: { entry: LogEntry }) {
  const url = usePhotoUrl(entry.photoId);
  return (
    <figure className="overflow-hidden rounded-2xl bg-raised">
      <div className="aspect-square w-full">{url ? <img src={url} alt={entry.food.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-2 text-center text-[13px] font-semibold text-silver">{splitName(entry.food.name).title}</div>}</div>
      <figcaption className="px-2 py-1.5 text-[12px] font-semibold capitalize text-silver">{entry.meal}</figcaption>
    </figure>
  );
}

/** Home in photo-diary mode: today's meals as pictures, no numbers. */
export function PhotoDiary({ entries, date }: { entries: LogEntry[]; date: string }) {
  // One tile per photo (a scanned plate logs several foods with the same photo).
  const seen = new Set<string>();
  const tiles = entries.filter((e) => { const k = e.photoId ?? e.id; if (seen.has(k)) return false; seen.add(k); return true; });
  return (
    <section className="card mt-4 p-5" aria-label="Photo diary">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold">Photo diary</p>
          <p className="text-[14px] text-silver">{tiles.length ? `${tiles.length} meal${tiles.length > 1 ? 's' : ''} so far` : 'Snap what you eat — no counting needed.'}</p>
        </div>
        <Link to={`/snap${date !== todayKey() ? `?date=${date}` : ''}`} className="btn-primary !h-11 !px-4 text-[15px]"><Camera size={17} /> Snap</Link>
      </div>
      {tiles.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2">{tiles.map((e) => <Tile key={e.id} entry={e} />)}</div>}
      <p className="mt-3 text-[12px] text-dim">Switch to Simple or Detailed in Settings whenever you want numbers again — nothing is lost.</p>
    </section>
  );
}
