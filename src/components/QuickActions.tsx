import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Camera, Dumbbell, PenLine, ScanBarcode, type LucideIcon } from 'lucide-react';
import { ExerciseSheet } from './LogMenu';
import { todayKey } from '@/lib/dates';
import { haptic } from './fx';

/** Shortcuts on Home: scan, today's plan, saved meals, coach. */
export function QuickActions({ dateQuery = '' }: { dateQuery?: string }) {
  const [ex, setEx] = useState(false);
  const items: { to: string; icon: LucideIcon; label: string; sub: string }[] = [
    { to: `/snap${dateQuery}`, icon: Camera, label: 'Scan food', sub: 'Photo' },
    { to: `/barcode${dateQuery}`, icon: ScanBarcode, label: 'Barcode', sub: 'Packaged' },
    { to: `/snap${dateQuery ? `${dateQuery}&` : '?'}mode=describe`, icon: PenLine, label: 'Describe', sub: 'Type it' },
    { to: '#exercise', icon: Dumbbell, label: 'Exercise', sub: 'Workout' },
  ];
  return (
    <div className="mb-6 grid grid-cols-4 gap-2.5">
      {items.map((i) => (
        <Link key={i.label} to={i.to === '#exercise' ? '#' : i.to} onClick={(e) => { haptic(); if (i.to === '#exercise') { e.preventDefault(); setEx(true); } }} className="flex flex-col items-center rounded-[22px] bg-surface px-1 pb-3 pt-3.5 text-center transition active:scale-95" style={{ boxShadow: 'var(--shadow)' }}>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary"><i.icon size={20} strokeWidth={2.2} /></span>
          <span className="mt-2 text-[13px] font-bold leading-tight">{i.label}</span>
          <span className="mt-0.5 text-[12px] font-medium leading-tight text-silver">{i.sub}</span>
        </Link>
      ))}
      <ExerciseSheet open={ex} onClose={() => setEx(false)} date={dateQuery ? dateQuery.split('=')[1] : todayKey()} />
    </div>
  );
}
