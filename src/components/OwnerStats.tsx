import { useEffect, useState } from 'react';
import { aiHeaders } from '@/lib/premium';
import { useSession } from '@/lib/account';

interface Stats {
  accounts: number; finishedSetup: number; loggedFood: number; loggedTwoDays: number; activeLast7Days: number; activeLast30Days: number;
  loggedWeight: number; loggedWorkout: number; avgDaysLogged: number; day2Rate: number | null;
  week2: { eligible: number; returned: number; rate: number | null };
  aiThisMonth: Record<string, { people: number; uses: number }>;
}
const AI_LABEL: Record<string, string> = { scan: 'AI scans', coach: 'Coach messages', workout: 'Workout guides', recipe: 'AI recipes', plan: 'Eating plans', ideas: 'Meal ideas' };

/** Only the app owner sees this (server checks ADMIN_EMAILS): are people finishing sign-up, logging, and coming back? */
export function OwnerStats() {
  const session = useSession();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    if (!session) return;
    void (async () => {
      try {
        const res = await fetch('/api/stats', { headers: await aiHeaders() });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) setS((await res.json()) as Stats);
      } catch { /* not the owner, or offline */ }
    })();
  }, [session]);
  if (!s) return null;
  const pct = (v: number | null) => (v == null ? '–' : `${v}%`);
  const rows: [string, string, string][] = [
    ['Accounts', String(s.accounts), 'signed-in users'],
    ['Finished sign-up', String(s.finishedSetup), s.accounts ? `${Math.round((s.finishedSetup / s.accounts) * 100)}% of accounts` : ''],
    ['Logged food', String(s.loggedFood), 'at least once'],
    ['Came back a 2nd day', pct(s.day2Rate), `${s.loggedTwoDays} of ${s.loggedFood}`],
    ['Still logging in week 2', pct(s.week2.rate), s.week2.eligible ? `${s.week2.returned} of ${s.week2.eligible} who joined 14+ days ago` : 'nobody has been here 14 days yet'],
    ['Active this week', String(s.activeLast7Days), `${s.activeLast30Days} in the last 30 days`],
    ['Logged a weight', String(s.loggedWeight), `${s.loggedWorkout} logged a workout`],
    ['Average days logged', String(s.avgDaysLogged), 'per account'],
  ];
  return (
    <section className="mt-6">
      <p className="mb-3 px-1 text-sm font-semibold text-silver">Your app’s numbers <span className="font-normal text-dim">(only you see this)</span></p>
      <div className="card p-5">
        <div className="grid grid-cols-2 gap-2">
          {rows.map(([label, value, sub]) => (
            <div key={label} className="rounded-2xl bg-raised p-3.5">
              <p className="num text-[22px] font-extrabold leading-none">{value}</p>
              <p className="mt-1 text-[14px] font-semibold leading-tight">{label}</p>
              {sub && <p className="mt-0.5 text-xs text-silver">{sub}</p>}
            </div>
          ))}
        </div>
        {Object.keys(s.aiThisMonth).length > 0 && (
          <div className="mt-3 rounded-2xl bg-raised p-3.5">
            <p className="text-[14px] font-semibold">AI use this month</p>
            <ul className="mt-1.5 space-y-1 text-[14px]">
              {Object.entries(s.aiThisMonth).map(([k, v]) => (
                <li key={k} className="flex justify-between"><span>{AI_LABEL[k] ?? k}</span><span className="num font-semibold">{v.uses} <span className="font-normal text-silver">by {v.people} people</span></span></li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-dim">Totals only, from signed-in users’ own logs. People using the app without an account aren’t counted.</p>
      </div>
    </section>
  );
}
