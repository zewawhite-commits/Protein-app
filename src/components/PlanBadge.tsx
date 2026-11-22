import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useHasTier } from '@/lib/perks';

/** Says up front which plan a feature needs, so nobody finds out only after tapping. Hidden once they have it. */
/** `free`: what Free already includes (e.g. "2 a month on Free"), shown instead of a lock. */
export function PlanBadge({ needs, what, free }: { needs: 'plus' | 'pro'; what: string; free?: string }) {
  const has = useHasTier(needs);
  if (has) return null;
  const name = 'Plus';
  return (
    <Link to={`/premium?tier=${needs}`} className="flex items-center gap-3 rounded-[22px] bg-accent/10 px-4 py-3 text-accent transition active:scale-[.99]">
      {!free && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15"><Lock size={16} /></span>}
      <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug">{what}<span className="block text-xs font-medium opacity-80">{free ? `${free} · more with ${name}` : `Included with ${name}`}</span></span>
      <span className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white">{free ? 'See' : 'Get'} {name}</span>
    </Link>
  );
}
