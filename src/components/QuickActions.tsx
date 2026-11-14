import { Link } from 'react-router-dom';
import { Bookmark, Camera, MessageCircle, NotebookPen, type LucideIcon } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { haptic } from './fx';

/** Shortcuts on Home: scan, today's plan, saved meals, coach. */
export function QuickActions({ dateQuery = '' }: { dateQuery?: string }) {
  const plans = useStore((s) => s.savedPlans.length);
  const meals = useStore((s) => s.savedMeals.length);
  const items: { to: string; icon: LucideIcon; label: string; sub: string }[] = [
    { to: `/snap${dateQuery}`, icon: Camera, label: 'Scan meal', sub: 'Any dish' },
    { to: '/coach?view=plan', icon: NotebookPen, label: 'My plan', sub: plans ? `${plans} saved` : 'AI day plan' },
    { to: `/add?tab=saved${dateQuery ? `&${dateQuery.slice(1)}` : ''}`, icon: Bookmark, label: 'Saved', sub: meals ? `${meals} saved` : '1-tap log' },
    { to: '/coach', icon: MessageCircle, label: 'Ask coach', sub: 'Chat & tips' },
  ];
  return (
    <div className="mb-6 grid grid-cols-4 gap-2.5">
      {items.map((i) => (
        <Link key={i.label} to={i.to} onClick={() => haptic()} className="flex flex-col items-center rounded-[22px] bg-surface px-1 pb-3 pt-3.5 text-center transition active:scale-95" style={{ boxShadow: 'var(--shadow)' }}>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary"><i.icon size={20} strokeWidth={2.2} /></span>
          <span className="mt-2 text-[13px] font-bold leading-tight">{i.label}</span>
          <span className="mt-0.5 text-[12px] font-medium leading-tight text-silver">{i.sub}</span>
        </Link>
      ))}
    </div>
  );
}
