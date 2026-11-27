import { Link } from 'react-router-dom';
import { Bookmark, Camera, Dumbbell, Mic, ScanBarcode, Search } from 'lucide-react';
import { haptic } from './fx';

/** Home's way in to logging: a search bar with the mic, then big shortcuts for the things people use most. */
export function QuickActions({ dateQuery = '' }: { dateQuery?: string }) {
  const add = `/add${dateQuery}`;
  const join = (path: string, q: string) => `${path}${dateQuery ? `${dateQuery}&` : '?'}${q}`;
  const tiles = [
    { to: `/snap${dateQuery}`, icon: Camera, label: 'Scan food', primary: true },
    { to: `/barcode${dateQuery}`, icon: ScanBarcode, label: 'Barcode' },
    { to: join('/add', 'tab=saved'), icon: Bookmark, label: 'Saved meals' },
    { to: '/train', icon: Dumbbell, label: 'Exercises' },
  ];
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <Link to={add} onClick={() => haptic()} className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-full bg-surface px-5 text-silver transition active:scale-[0.98]" style={{ boxShadow: 'var(--shadow)' }} aria-label="Log food">
          <Search size={19} className="shrink-0" /><span className="truncate text-[16px]">What did you eat?</span>
        </Link>
        <Link to={join('/add', 'voice=1')} onClick={() => haptic()} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface text-ink transition active:scale-95" style={{ boxShadow: 'var(--shadow)' }} aria-label="Say what you ate"><Mic size={21} /></Link>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="Shortcuts">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} onClick={() => haptic()} className="flex flex-col items-center gap-1.5 rounded-[22px] bg-surface px-1 py-3 text-center transition active:scale-95" style={{ boxShadow: 'var(--shadow)' }}>
            <span className={t.primary ? 'grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary' : 'grid h-11 w-11 place-items-center rounded-full bg-raised text-ink'}><t.icon size={20} /></span>
            <span className="text-[13px] font-semibold leading-tight">{t.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
