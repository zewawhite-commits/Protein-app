import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUsage, type Usage } from '@/lib/premium';
import { useSession } from '@/lib/account';

const LABELS = { scan: 'AI scans', coach: 'Coach messages', workout: 'Workout guides', recipe: 'AI recipes', plan: 'Eating plans', ideas: 'Meal ideas' } as const;

/** This month's AI usage, so people know where they stand before they hit a limit. */
export function UsageCard() {
  const session = useSession();
  const [u, setU] = useState<Usage | null>(null);
  useEffect(() => {
    if (session) fetchUsage().then(setU);
  }, [session]);
  if (!u) return null;
  const name = u.perks?.freePro ? 'Free Pro' : u.tier === 'pro' ? 'Pro' : u.tier === 'plus' ? 'Plus' : 'Free';
  return (
    <div className="card mt-5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-bold">This month</p>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">{u.admin ? 'Admin' : name}</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((f) => {
          const { used, limit } = u.features[f] ?? { used: 0, limit: 0 };
          const text = limit === null ? 'Unlimited' : limit === 0 ? (f === 'plan' || f === 'ideas' ? 'Pro' : 'Plus') : `${Math.max(0, limit - used)} of ${limit} left`;
          return (
            <div key={f}>
              <div className="flex justify-between text-[14px]"><span className="font-medium">{LABELS[f]}</span><span className="text-silver">{text}</span></div>
              {limit !== null && limit > 0 && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div>
              )}
            </div>
          );
        })}
      </div>
      {u.tier !== 'pro' && !u.admin && (
        <Link to="/premium" className="btn-primary mt-4 w-full">{u.tier === 'free' ? 'Go unlimited with Plus — $4.99/month' : 'Get advanced plans, reports and a smarter coach with Pro'}</Link>
      )}
    </div>
  );
}
