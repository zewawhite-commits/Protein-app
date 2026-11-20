import { Link } from 'react-router-dom';
import { useState } from 'react';
import { BarChart3, Camera, ChefHat, Dumbbell, Mic, PenLine, ScanBarcode, ListChecks, type LucideIcon } from 'lucide-react';
import { ExerciseSheet } from './LogMenu';
import { todayKey } from '@/lib/dates';
import { haptic } from './fx';

/** Shortcuts at the top of Home: the ways to log food, plus recipes, workouts and reports. */
export function QuickActions({ dateQuery = '' }: { dateQuery?: string }) {
  const [ex, setEx] = useState(false);
  const and = dateQuery ? `${dateQuery}&` : '?';
  const items: { to: string; icon: LucideIcon; label: string }[] = [
    { to: `/snap${dateQuery}`, icon: Camera, label: 'Scan food' },
    { to: `/barcode${dateQuery}`, icon: ScanBarcode, label: 'Barcode' },
    { to: `/snap${and}mode=describe`, icon: PenLine, label: 'Describe' },
    { to: `/add${and}voice=1`, icon: Mic, label: 'Voice' },
    { to: '#exercise', icon: Dumbbell, label: 'Workout' },
    { to: '/routines', icon: ListChecks, label: 'Routines' },
    { to: '/coach?view=recipe', icon: ChefHat, label: 'Recipes' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
  ];
  return (
    <div className="mb-5 mt-3 grid grid-cols-4 gap-2">
      {items.map((i) => (
        <Link key={i.label} to={i.to === '#exercise' ? '#' : i.to} onClick={(e) => { haptic(); if (i.to === '#exercise') { e.preventDefault(); setEx(true); } }} className="flex flex-col items-center rounded-[18px] bg-surface px-1 pb-2 pt-2.5 text-center transition active:scale-95" style={{ boxShadow: 'var(--shadow)' }}>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-on-primary"><i.icon size={16} strokeWidth={2.3} /></span>
          <span className="mt-1 text-[12px] font-semibold leading-tight">{i.label}</span>
        </Link>
      ))}
      <ExerciseSheet open={ex} onClose={() => setEx(false)} date={dateQuery ? dateQuery.split('=')[1] : todayKey()} />
    </div>
  );
}
