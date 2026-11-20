import { useEffect, useState } from 'react';
import { aiHeaders } from '@/lib/premium';
import { useSession } from '@/lib/account';

interface Stats {
  accounts: number; finishedSetup: number; loggedFood: number; loggedTwoDays: number; activeLast7Days: number; activeLast30Days: number;
  loggedWeight: number; loggedWorkout: number; avgDaysLogged: number; day2Rate: number | null;
  week2: { eligible: number; returned: number; rate: number | null };
  aiThisMonth: Record<string, { people: number; uses: number }>;
  activeToday?: number;
  retention?: Record<'day1' | 'day7' | 'day30', { eligible: number; returned: number; rate: number | null }>;
  topFoods?: { name: string; entries: number; people: number }[];
  aiCost?: { estimatedUsd: number; perActivePerson: number; people: number };
  funnel?: { step: string; people: number }[];
  signups?: Record<string, number>;
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
    ...(s.activeToday != null ? [['Logged today', String(s.activeToday), 'people'] as [string, string, string]] : []),
  ];
  const ret = s.retention;
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
        <button onClick={async () => {
          const res = await fetch('/api/stats?export=marketing', { headers: await aiHeaders() });
          if (!res.ok) return;
          const url = URL.createObjectURL(await res.blob());
          const a = document.createElement('a'); a.href = url; a.download = 'nutivili-mailing-list.csv'; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }} className="btn-ghost mt-3 w-full !h-11 text-sm">Download mailing list (people who opted in)</button>
        {s.signups && (() => {
          const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10));
          const max = Math.max(1, ...days.map((d) => s.signups![d] ?? 0));
          const today = s.signups[days[13]] ?? 0;
          return (
            <div className="mt-3 rounded-2xl bg-raised p-3.5">
              <p className="text-[14px] font-semibold">New sign-ups <span className="font-normal text-silver">· {today} today</span></p>
              <div className="mt-2 flex h-16 items-end gap-1" aria-label="Sign-ups per day, last 14 days">
                {days.map((d) => <div key={d} title={`${d}: ${s.signups![d] ?? 0}`} className="flex-1 rounded-t bg-accent" style={{ height: `${Math.max(4, ((s.signups![d] ?? 0) / max) * 100)}%`, opacity: s.signups![d] ? 1 : 0.25 }} />)}
              </div>
              <p className="mt-1 text-xs text-silver">Last 14 days. Gmail sends about 500 confirmation emails a day: move to your own domain before you get close.</p>
            </div>
          );
        })()}
        {s.funnel && s.funnel.length > 0 && (
          <div className="mt-3 rounded-2xl bg-raised p-3.5">
            <p className="text-[14px] font-semibold">Where people stop in onboarding</p>
            <ul className="mt-2 space-y-1.5">
              {s.funnel.map((f) => (
                <li key={f.step} className="text-[13px]">
                  <div className="flex justify-between"><span className="capitalize">{f.step.replace(/_/g, ' ')}</span><span className="num font-semibold">{f.people}</span></div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-accent" style={{ width: `${(f.people / Math.max(1, s.funnel![0].people)) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {ret && (
          <div className="mt-3 rounded-2xl bg-raised p-3.5">
            <p className="text-[14px] font-semibold">Retention</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {([['Day 1', ret.day1, 'next day'], ['Week 1', ret.day7, 'days 7–13'], ['Month 1', ret.day30, 'days 30–36']] as const).map(([l, r, w]) => (
                <div key={l}>
                  <p className="num text-[20px] font-extrabold leading-none">{pct(r.rate)}</p>
                  <p className="mt-1 text-[13px] font-semibold">{l}</p>
                  <p className="text-[11px] text-silver">{r.eligible ? `${r.returned} of ${r.eligible} · ${w}` : 'not enough time yet'}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-dim">Share of people who logged food in that window after joining.</p>
          </div>
        )}
        {s.topFoods && s.topFoods.length > 0 && (
          <div className="mt-3 rounded-2xl bg-raised p-3.5">
            <p className="text-[14px] font-semibold">Most-logged foods (30 days)</p>
            <ol className="mt-1.5 space-y-1 text-[14px]">
              {s.topFoods.map((f, i) => (
                <li key={f.name} className="flex justify-between gap-3"><span className="truncate">{i + 1}. {f.name}</span><span className="num shrink-0 text-silver">{f.people} people · {f.entries}×</span></li>
              ))}
            </ol>
          </div>
        )}
        {Object.keys(s.aiThisMonth).length > 0 && (
          <div className="mt-3 rounded-2xl bg-raised p-3.5">
            <p className="text-[14px] font-semibold">AI use this month</p>
            <ul className="mt-1.5 space-y-1 text-[14px]">
              {Object.entries(s.aiThisMonth).map(([k, v]) => (
                <li key={k} className="flex justify-between"><span>{AI_LABEL[k] ?? k}</span><span className="num font-semibold">{v.uses} <span className="font-normal text-silver">by {v.people} people</span></span></li>
              ))}
            </ul>
            {s.aiCost && (
              <p className="mt-2 border-t border-line pt-2 text-[14px]">
                Estimated AI cost: <b className="num">${s.aiCost.estimatedUsd.toFixed(2)}</b> this month · <span className="num">${s.aiCost.perActivePerson.toFixed(2)}</span> per person using AI
                <span className="block text-[12px] text-dim">A rough estimate from typical request sizes. Your real bill is in the Anthropic console.</span>
              </p>
            )}
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-dim">Totals only, from signed-in users’ own logs. People using the app without an account aren’t counted.</p>
      </div>
    </section>
  );
}
