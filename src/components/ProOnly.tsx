import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useHasTier } from '@/lib/perks';
import { PlanBadge } from './PlanBadge';

/**
 * A Plus feature for Plus members. Everyone else sees a short "comes with Plus" note,
 * or nothing at all when `quiet` (the page then lists Plus extras once, with ProMore).
 */
export function ProOnly({ what = '', quiet, children }: { what?: string; quiet?: boolean; children: ReactNode }) {
  const has = useHasTier('pro');
  if (has) return <>{children}</>;
  return quiet ? null : <PlanBadge needs="pro" what={what} />;
}

/** One line listing what Plus adds to Progress — instead of a locked card in every section. */
export function ProMore() {
  const has = useHasTier('pro');
  if (has) return null;
  return (
    <Link to="/premium?tier=pro" className="mt-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] text-silver transition active:bg-raised">
      <span className="min-w-0 flex-1"><b className="text-ink">Plus adds:</b> the AI coach to review your week and answer questions about these charts, unlimited AI scans, the weekly meal planner with grocery lists, and personalised meal plans, recipes and workouts.</span>
      <ChevronRight size={16} className="shrink-0 text-dim" />
    </Link>
  );
}
