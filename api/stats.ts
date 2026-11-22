/**
 * GET /api/stats (x-user-token) → usage totals for the app owner (emails in ADMIN_EMAILS only).
 */
import { json } from './_lib/premium.js';
import { admin, userFromToken } from './_lib/accounts.js';
import { isAdmin } from './_lib/quota.js';
import { summarize, type Row } from './_lib/stats.js';

export async function GET(request: Request): Promise<Response> {
  const db = admin();
  if (!db) return json({ error: 'Accounts aren’t set up on the server yet.' }, 503);
  const user = await userFromToken(request.headers.get('x-user-token'));
  if (!user) return json({ error: 'Sign in first.' }, 401);
  if (!isAdmin(user.email)) return json({ error: 'Not available.' }, 403);
  // The owner's mailing list: only people who ticked "Email me tips and offers", as a CSV.
  if (new URL(request.url).searchParams.get('export') === 'marketing') {
    const lines = ['email,name,signed_up'];
    for (let page = 1; page <= 50; page++) {
      const { data: list } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of list?.users ?? []) {
        if (u.email && u.user_metadata?.marketing_opt_in !== false) lines.push([u.email, String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? '').replace(/[",\n]/g, ' '), u.created_at.slice(0, 10)].join(','));
      }
      if (!list || list.users.length < 1000) break;
    }
    return new Response(lines.join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="nutivili-mailing-list.csv"', 'cache-control': 'no-store' } });
  }
  if (new URL(request.url).searchParams.get('ai') === '1') {
    const { creditConfig } = await import('./_lib/credits.js');
    return json({ ...(await aiDashboard(db)), credits: await creditConfig() });
  }
  const rows: Row[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db.from('user_data').select('data, updated_at').range(from, from + 999);
    if (error) return json({ error: error.message }, 500);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await db.from('scan_usage').select('subscriber, scans').eq('month', month);
  const ai: Record<string, { people: number; uses: number }> = {};
  for (const u of usage ?? []) {
    const f = String(u.subscriber).includes(':') ? String(u.subscriber).split(':')[0] : 'scan';
    ai[f] ??= { people: 0, uses: 0 };
    ai[f].people++;
    ai[f].uses += u.scans as number;
  }
  // Rough AI cost per use (US$), from the model's per-token price and typical request sizes.
  // An estimate for planning, not a bill: check the Anthropic console for real spend.
  const COST: Record<string, number> = { scan: 0.05, coach: 0.04, workout: 0.2, recipe: 0.12, plan: 0.25, ideas: 0.02 };
  const totalCost = Object.entries(ai).reduce((a, [k, v]) => a + v.uses * (COST[k] ?? 0.05), 0);
  const people = new Set((usage ?? []).map((u) => String(u.subscriber).split(':').pop())).size;
  const aiCost = { estimatedUsd: Math.round(totalCost * 100) / 100, perActivePerson: people ? Math.round((totalCost / people) * 100) / 100 : 0, people };
  // Onboarding funnel: how many people reached each step (from /api/feedback events).
  const { data: steps } = await db.from('recognition_feedback').select('chosen_food_id, chosen_name').eq('ai_name', 'ONBOARDING').limit(20000);
  const funnelMap = new Map<string, Set<string>>();
  for (const r of steps ?? []) { const k = String(r.chosen_food_id); if (!funnelMap.has(k)) funnelMap.set(k, new Set()); funnelMap.get(k)!.add(String(r.chosen_name)); }
  const funnel = [...funnelMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([step, s]) => ({ step: step.replace(/^\d+-/, ''), people: s.size }));
  // New accounts per day, last 14 days (from sign-up time).
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const signups: Record<string, number> = {};
  for (let page = 1; page <= 20; page++) {
    const { data: list } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of list?.users ?? []) if (u.created_at >= since) signups[u.created_at.slice(0, 10)] = (signups[u.created_at.slice(0, 10)] ?? 0) + 1;
    if (!list || list.users.length < 1000) break;
  }
  return json({ ...summarize(rows), aiThisMonth: ai, aiCost, funnel, signups });
}

/** AI cost dashboard: real metered spend (ai_usage), by feature and account, with revenue and margin. */
async function aiDashboard(db: NonNullable<ReturnType<typeof admin>>) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const [byFeature, top, monthly, alerts] = await Promise.all([
    db.rpc('ai_cost_by_feature', { p_from: from, p_to: to }),
    db.rpc('ai_top_accounts', { p_from: from, p_to: to, p_limit: 15 }),
    db.rpc('ai_monthly', { p_months: 6 }),
    db.from('ai_alerts').select('at, user_id, kind, detail').order('at', { ascending: false }).limit(25),
  ]);
  if (byFeature.error) return { ready: false, error: 'Run supabase/ai-usage.sql in Supabase to start metering AI costs.' };
  // Emails for the top accounts and alerts (owner-only view).
  const ids = [...new Set([...(top.data ?? []).map((r: { user_id: string }) => r.user_id), ...(alerts.data ?? []).map((r: { user_id: string }) => r.user_id)])];
  const emails: Record<string, string> = {};
  await Promise.all(ids.slice(0, 40).map(async (id) => { const { data } = await db.auth.admin.getUserById(id); if (data.user?.email) emails[id] = data.user.email; }));
  // Revenue: active Plus subscriptions from Paystack, as a monthly figure (yearly ÷ 12).
  let revenue: { monthlyUsd: number | null; subscribers: number; currency: string; note?: string } = { monthlyUsd: null, subscribers: 0, currency: 'USD', note: 'Paystack isn’t connected yet.' };
  try {
    const { config, paystack } = await import('./_lib/premium.js');
    if (config().enabled) {
      let monthly = 0, subs = 0, currency = 'USD';
      for (let page = 1; page <= 20; page++) {
        const list = await paystack<{ status: string; amount: number; plan?: { interval?: string; currency?: string } }[]>(`/subscription?perPage=100&page=${page}`);
        for (const s of list.filter((x) => x.status === 'active' || x.status === 'non-renewing')) {
          subs++; currency = s.plan?.currency ?? currency;
          monthly += (s.amount / 100) / (s.plan?.interval === 'annually' ? 12 : 1);
        }
        if (list.length < 100) break;
      }
      revenue = { monthlyUsd: currency === 'USD' ? Math.round(monthly * 100) / 100 : null, subscribers: subs, currency, ...(currency !== 'USD' && { note: `Paystack plans are in ${currency}: ${Math.round(monthly)} ${currency} a month.` }) };
    }
  } catch (e) { revenue.note = `Couldn’t read Paystack: ${(e as Error).message}`; }
  type F = { feature: string; tier: string; requests: number; cost: number; people: number };
  const rows = (byFeature.data ?? []) as F[];
  const sum = (f: (r: F) => boolean, k: 'cost' | 'requests') => rows.filter(f).reduce((a, r) => a + Number(r[k]), 0);
  const paid = (r: F) => r.tier === 'plus' || r.tier === 'pro';
  const paidPeople = new Set((top.data ?? []).filter((r: { tier: string }) => ['plus', 'pro'].includes(r.tier)).map((r: { user_id: string }) => r.user_id)).size;
  const totalCost = sum(() => true, 'cost'), paidCost = sum(paid, 'cost');
  const feePct = Number(process.env.PAYMENT_FEE_PCT ?? 3.9) / 100;
  const margin = revenue.monthlyUsd == null ? null : Math.round((revenue.monthlyUsd * (1 - feePct) - totalCost) * 100) / 100;
  return {
    ready: true, month: from.slice(0, 7),
    byFeature: rows.map((r) => ({ ...r, cost: Number(r.cost), requests: Number(r.requests), people: Number(r.people) })),
    totals: { cost: Math.round(totalCost * 100) / 100, requests: sum(() => true, 'requests'), paidCost: Math.round(paidCost * 100) / 100, freeCost: Math.round((totalCost - paidCost) * 100) / 100 },
    perSubscriber: revenue.subscribers ? Math.round((paidCost / revenue.subscribers) * 1000) / 1000 : paidPeople ? Math.round((paidCost / paidPeople) * 1000) / 1000 : null,
    top: (top.data ?? []).map((r: Record<string, unknown>) => ({ ...r, email: emails[r.user_id as string] ?? '', cost: Number(r.cost), requests: Number(r.requests), devices: Number(r.devices) })),
    monthly: (monthly.data ?? []).map((r: Record<string, unknown>) => ({ month: r.month, requests: Number(r.requests), cost: Number(r.cost), people: Number(r.people), paidCost: Number(r.paid_cost), paidPeople: Number(r.paid_people) })),
    alerts: (alerts.data ?? []).map((a: { at: string; user_id: string; kind: string; detail: string }) => ({ ...a, email: emails[a.user_id] ?? '' })),
    revenue, paymentFeePct: feePct * 100, margin,
  };
}

/** POST /api/stats {credits} (owner only): change the Plus credit allowance and the cost of each feature. */
export async function POST(request: Request): Promise<Response> {
  const user = await userFromToken(request.headers.get('x-user-token'));
  if (!user) return json({ error: 'Sign in first.' }, 401);
  if (!isAdmin(user.email)) return json({ error: 'Not available.' }, 403);
  const body = (await request.json().catch(() => null)) as { credits?: unknown } | null;
  if (!body?.credits) return json({ error: 'Nothing to save.' }, 400);
  try {
    const { saveCreditConfig } = await import('./_lib/credits.js');
    return json({ credits: await saveCreditConfig(body.credits) });
  } catch (e) {
    return json({ error: `Couldn’t save: ${(e as Error).message}. Run supabase/ai-usage.sql first.` }, 500);
  }
}
