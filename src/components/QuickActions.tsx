import { Link } from 'react-router-dom';
import { Camera, Mic, Search } from 'lucide-react';
import { haptic } from './fx';

/**
 * Home's one way in to logging, kept minimal: tap the bar to search, or the camera / mic.
 * Everything else (barcode, label, describe, exercise) is in the + button and on Add food.
 */
export function QuickActions({ dateQuery = '' }: { dateQuery?: string }) {
  const add = `/add${dateQuery}`;
  const voice = `/add${dateQuery ? `${dateQuery}&` : '?'}voice=1`;
  return (
    <div className="mb-6 flex items-center gap-2">
      <Link to={add} onClick={() => haptic()} className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-full bg-surface px-5 text-silver transition active:scale-[0.98]" style={{ boxShadow: 'var(--shadow)' }} aria-label="Log food">
        <Search size={19} className="shrink-0" /><span className="truncate text-[16px]">What did you eat?</span>
      </Link>
      <Link to={voice} onClick={() => haptic()} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface text-ink transition active:scale-95" style={{ boxShadow: 'var(--shadow)' }} aria-label="Say what you ate"><Mic size={21} /></Link>
      <Link to={`/snap${dateQuery}`} onClick={() => haptic()} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-on-primary transition active:scale-95" aria-label="Scan food with the camera"><Camera size={21} /></Link>
    </div>
  );
}
