import type { ReactNode } from 'react';
import { useHasTier } from '@/lib/perks';
import { PlanBadge } from './PlanBadge';

/** Shows a Pro feature to Pro members, and a short "comes with Pro" teaser to everyone else. */
export function ProOnly({ what, children }: { what: string; children: ReactNode }) {
  const has = useHasTier('pro');
  return has ? <>{children}</> : <PlanBadge needs="pro" what={what} />;
}
