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
  credits?: { monthlyCredits: number; scansPerDay: number; costs: Record<string, number>; monthlyCaps: Record<string, number> };
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

      {d.credits && <CreditSettings initial={d.credits} perRequest={Object.fromEntries(features.map((f) => [f.feature, f.requests ? f.cost / f.requests : 0]))} />}

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

/** Owner: change the Plus credit allowance and costs (provisional until real costs are measured). */
function CreditSettings({ initial, perRequest }: { initial: NonNullable<Dash['credits']>; perRequest: Record<string, number> }) {
  const [cfg, setCfg] = useState(initial);
  const [msg, setMsg] = useState('');
  const set = (k: string, v: string) => setCfg((c) => ({ ...c, costs: { ...c.costs, [k]: Math.max(0, Math.round(Number(v) || 0)) } }));
  // What one credit costs you at worst, per feature, from this month's real spend.
  const worst = Math.max(0, ...Object.entries(cfg.costs).map(([k, n]) => (n && perRequest[k] ? perRequest[k] / n : 0)));
  const save = async () => {
    setMsg('Saving…');
    try {
      const res = await fetch('/api/stats', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ credits: { ...cfg, monthlyCaps: cfg.monthlyCaps ?? {} } }) });
      const j = (await res.json()) as { credits?: typeof cfg; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'Failed');
      setCfg(j.credits!); setMsg('Saved. New values apply within a minute.');
    } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="mt-4 rounded-2xl bg-raised p-4">
      <p className="font-semibold">Plus AI credits</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <label className="flex items-center justify-between gap-2">Credits a month<input className="field !h-9 !w-20 text-right" inputMode="numeric" value={cfg.monthlyCredits} onChange={(e) => setCfg({ ...cfg, monthlyCredits: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></label>
        <label className="flex items-center justify-between gap-2">Photo scans a day (0 = unlimited)<input className="field !h-9 !w-20 text-right" inputMode="numeric" value={cfg.scansPerDay} onChange={(e) => setCfg({ ...cfg, scansPerDay: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></label>
        {Object.keys(cfg.costs).map((k) => (
          <label key={k} className="flex items-center justify-between gap-2">{NAME[k] ?? k}<span className="flex items-center gap-1"><input className="field !h-9 !w-14 text-right" inputMode="numeric" value={cfg.costs[k]} onChange={(e) => set(k, e.target.value)} />{perRequest[k] ? <span className="text-[11px] text-dim">{usd(perRequest[k])}</span> : null}</span></label>
        ))}
      </div>
      <p className="mt-4 text-sm font-semibold">Most per member a month <span className="font-normal text-silver">(blank = only credits limit it)</span></p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {(['scan', 'coach', 'recipe', 'plan', 'workout', 'ideas'] as const).map((k) => (
          <label key={k} className="flex items-center justify-between gap-2">{NAME[k] ?? k}<input className="field !h-9 !w-16 text-right" inputMode="numeric" placeholder="–" value={cfg.monthlyCaps?.[k] ?? ''} onChange={(e) => { const n = Math.round(Number(e.target.value.replace(/\D/g, '')) || 0); setCfg((c) => { const caps = { ...c.monthlyCaps }; if (n > 0) caps[k] = n; else delete caps[k]; return { ...c, monthlyCaps: caps }; }); }} /></label>
        ))}
      </div>
      <p className="mt-2 text-xs text-silver">Grey numbers: this month’s real average cost of one request. A full month of credits costs you at most about <b className="num">{usd(worst * cfg.monthlyCredits)}</b> per member{worst ? '' : ' (no data yet)'}.</p>
      <button onClick={save} className="btn-primary mt-3 !h-10 w-full text-sm">Save credit settings</button>
      {msg && <p className="mt-2 text-xs text-silver">{msg}</p>}
    </div>
  );
}
