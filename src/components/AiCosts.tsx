import { useEffect, useState } from 'react';
import { aiHeaders } from '@/lib/premium';
import { fmt } from './ui';

interface Dash {
  ready: boolean; error?: string; month: string;
  byFeature: { feature: string; tier: string; requests: number; cost: number; people: number }[];
  totals: { cost: number; requests: number; paidCost: number; freeCost: number };
  perSubscriber: number | null;
  top: { user_id: string; email: string; requests: number; cost: number; devices: number; tier: string; scans: number; coach: number }[];
  monthly: { month: string; requests: number; cost: number; people: number; paidCost: number; paidPeople: number }[];
  alerts: { at: string; user_id: string; email: string; kind: string; detail: string }[];
  revenue: { monthlyUsd: number | null; subscribers: number; currency: string; note?: string };
  paymentFeePct: number; margin: number | null;
}
const NAME: Record<string, string> = { scan: 'Photo scans', menu: 'Menu scans', label: 'Label scans', coach: 'Coach', import: 'Recipe imports', recipe: 'AI recipes', plan: 'Meal plans', workout: 'Workouts', ideas: 'Meal ideas' };
const usd = (n: number) => `$${n < 1 ? n.toFixed(3) : fmt(n, 2)}`;

/** Owner only (server checks ADMIN_EMAILS): real AI spend from the model's token counts, and margin. */
export function AiCosts() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/stats?ai=1', { headers: await aiHeaders() });
        if (!res.ok || !res.headers.get('content-type')?.includes('json')) return;
        const j = (await res.json()) as Dash;
        if (!j.ready) setErr(j.error ?? 'Not ready'); else setD(j);
      } catch { /* not the owner, or offline */ }
    })();
  }, []);
  if (err) return <section className="card mt-4 p-5 text-sm text-silver"><p className="font-bold text-ink">AI costs</p>{err}</section>;
  if (!d) return null;
  const features = Object.values(d.byFeature.reduce<Record<string, { feature: string; requests: number; cost: number; people: number }>>((acc, r) => {
    const a = (acc[r.feature] ??= { feature: r.feature, requests: 0, cost: 0, people: 0 }); a.requests += r.requests; a.cost += r.cost; a.people += r.people; return acc;
  }, {})).sort((a, b) => b.cost - a.cost);
  return (
    <section className="card mt-4 p-5" aria-label="AI costs">
      <div className="flex items-baseline justify-between"><p className="text-lg font-bold">AI costs · {d.month}</p><p className="text-xs text-dim">From real token counts</p></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-raised p-3"><p className="num text-xl font-extrabold">{usd(d.totals.cost)}</p><p className="text-xs text-silver">AI spend this month · {fmt(d.totals.requests)} requests</p></div>
        <div className="rounded-2xl bg-raised p-3"><p className="num text-xl font-extrabold">{d.perSubscriber == null ? '–' : usd(d.perSubscriber)}</p><p className="text-xs text-silver">Average AI cost per Plus subscriber</p></div>
        <div className="rounded-2xl bg-raised p-3"><p className="num text-xl font-extrabold">{d.revenue.monthlyUsd == null ? '–' : usd(d.revenue.monthlyUsd)}</p><p className="text-xs text-silver">Plus revenue a month · {d.revenue.subscribers} subscribers</p></div>
        <div className="rounded-2xl bg-raised p-3"><p className={`num text-xl font-extrabold ${d.margin != null && d.margin < 0 ? 'text-danger' : ''}`}>{d.margin == null ? '–' : usd(d.margin)}</p><p className="text-xs text-silver">Contribution margin (after {d.paymentFeePct}% payment fees and all AI)</p></div>
      </div>
      {d.revenue.note && <p className="mt-2 text-xs text-dim">{d.revenue.note}</p>}
      <p className="mt-2 text-xs text-silver">Free users cost {usd(d.totals.freeCost)} of AI this month; Plus users {usd(d.totals.paidCost)}.</p>

      <p className="mt-4 font-semibold">Cost by feature</p>
      <div className="mt-1 divide-y divide-line text-sm">
        {features.map((f) => <div key={f.feature} className="flex justify-between py-1.5"><span>{NAME[f.feature] ?? f.feature} <span className="text-silver">· {fmt(f.requests)} requests</span></span><span className="num font-semibold">{usd(f.cost)} <span className="text-xs font-normal text-silver">({usd(f.requests ? f.cost / f.requests : 0)} each)</span></span></div>)}
      </div>

      <p className="mt-4 font-semibold">Highest-cost accounts</p>
      <div className="mt-1 divide-y divide-line text-sm">
        {d.top.map((t) => <div key={t.user_id} className="flex justify-between gap-2 py-1.5"><span className="min-w-0 truncate">{t.email || t.user_id.slice(0, 8)} <span className="text-silver">· {t.tier} · {t.requests} requests · {t.scans} scans · {t.coach} coach{t.devices > 3 ? ` · ${t.devices} devices (check)` : ''}</span></span><span className="num font-semibold">{usd(t.cost)}</span></div>)}
      </div>

      <p className="mt-4 font-semibold">Monthly AI spend</p>
      <div className="mt-1 divide-y divide-line text-sm">
        {d.monthly.map((m) => <div key={m.month} className="flex justify-between py-1.5"><span>{m.month} <span className="text-silver">· {m.people} people · {fmt(m.requests)} requests</span></span><span className="num font-semibold">{usd(m.cost)}</span></div>)}
      </div>

      <p className="mt-4 font-semibold">Unusual usage</p>
      {d.alerts.length ? (
        <div className="mt-1 divide-y divide-line text-sm">{d.alerts.map((a, i) => <div key={i} className="py-1.5"><span className="font-semibold">{a.kind}</span> <span className="text-silver">· {a.email || a.user_id.slice(0, 8)} · {a.detail} · {new Date(a.at).toLocaleString()}</span></div>)}</div>
      ) : <p className="text-sm text-silver">No alerts.</p>}
      <p className="mt-3 text-xs leading-relaxed text-dim">Alerts: very fast bursts, unusually heavy days (for review only, nobody is blocked) and the fair-use ceiling being reached. Accounts used from more than 3 devices are marked “check”.</p>
    </section>
  );
}
