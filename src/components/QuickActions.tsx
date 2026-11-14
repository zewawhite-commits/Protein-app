import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { artUrl } from '@/data/foodArt';
import { haptic } from './fx';

/** Big, friendly shortcuts on Home: scan, today's plan, saved meals, coach. */
export function QuickActions({ dateQuery = '' }: { dateQuery?: string }) {
  const plans = useStore((s) => s.savedPlans.length);
  const meals = useStore((s) => s.savedMeals.length);
  const items = [
    { to: `/snap${dateQuery}`, art: 'camera_with_flash', label: 'Scan meal', sub: 'Any dish' },
    { to: '/coach?view=plan', art: 'spiral_notepad', label: 'My plan', sub: plans ? `${plans} saved` : 'AI day plan' },
    { to: `/add?tab=saved${dateQuery ? `&${dateQuery.slice(1)}` : ''}`, art: 'bento_box', label: 'Saved', sub: meals ? `${meals} saved` : '1-tap log' },
    { to: '/coach', art: 'speech_balloon', label: 'Ask coach', sub: 'Chat & tips' },
  ];
  return (
    <div className="mb-6 grid grid-cols-4 gap-2.5">
      {items.map((i) => (
        <Link key={i.label} to={i.to} onClick={() => haptic()} className="flex flex-col items-center rounded-[22px] bg-surface px-1 pb-3 pt-3.5 text-center transition active:scale-95" style={{ boxShadow: 'var(--shadow)' }}>
          <img src={artUrl(i.art)} alt="" draggable={false} className="h-11 w-11" />
          <span className="mt-2 text-[13px] font-bold leading-tight">{i.label}</span>
          <span className="mt-0.5 text-[12px] font-medium leading-tight text-silver">{i.sub}</span>
        </Link>
      ))}
    </div>
  );
}
