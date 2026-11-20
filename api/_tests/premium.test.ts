process.env.AUTO_TRIAL = 'off'; // these tests check the plain Free limits
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeSubscription, readPass, signPass } from '../_lib/premium.js';
import { POST as activate } from '../_premium/activate.js';
import { POST as checkout } from '../_premium/checkout.js';
import { POST as recognize } from '../recognize.js';

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Minimal fake of the Paystack API used by the handlers. */
function fakePaystack(state: { tx?: Record<string, unknown>; subs?: unknown[]; customer?: { id: number } }) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const path = url.replace('https://api.paystack.co', '');
    calls.push(`${init?.method ?? 'GET'} ${path}`);
    const ok = (data: unknown) => new Response(JSON.stringify({ status: true, message: 'ok', data }), { status: 200 });
    if (path.startsWith('/transaction/verify/')) return state.tx ? ok(state.tx) : new Response(JSON.stringify({ status: false, message: 'Transaction reference not found' }), { status: 400 });
    if (path.startsWith('/subscription?')) return ok(state.subs ?? []);
    if (path.startsWith('/customer/')) return state.customer ? ok(state.customer) : new Response(JSON.stringify({ status: false, message: 'Customer not found' }), { status: 404 });
    if (path === '/transaction/initialize') return ok({ authorization_url: 'https://checkout.paystack.com/abc', reference: 'ref123' });
    return new Response('{}', { status: 404 });
  });
  return calls;
}

const post = (url: string, body: unknown, token?: string) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) });

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
  process.env.PAYSTACK_PLAN_PLUS_MONTHLY = 'PLN_month';
  process.env.PAYSTACK_PLAN_PRO_YEARLY = 'PLN_year';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.PREMIUM_TOKEN_SECRET = 'test-secret-that-is-long-enough';
});
afterEach(() => vi.unstubAllGlobals());

const paidTx = (over: Record<string, unknown> = {}) => ({
  status: 'success', reference: 'ref123', paid_at: iso(Date.now() - 60_000),
  customer: { id: 42, email: 'Ada@Example.com' }, plan_object: { plan_code: 'PLN_month', interval: 'monthly' }, ...over,
});
const sub = (status: string, nextInMs: number, plan = 'PLN_month') => ({ status, subscription_code: 'SUB_1', next_payment_date: iso(Date.now() + nextInMs), plan: { plan_code: plan } });

describe('Premium pass', () => {
  it('round-trips and rejects tampering', () => {
    const t = signPass({ email: 'a@b.co', cid: 1, plan: 'PLN_month', tier: 'plus', exp: Date.now() + DAY });
    expect(readPass(t)?.cid).toBe(1);
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ email: 'a@b.co', cid: 1, plan: 'PLN_month', tier: 'plus', exp: Date.now() + 999 * DAY })).toString('base64url');
    expect(readPass(`${forged}.${sig}`)).toBeNull();
    // Change the first character to a different one (replacing it with a fixed letter fails 1 time in 64).
    expect(readPass(`${body}.${sig[0] === 'x' ? 'y' : 'x'}${sig.slice(1)}`)).toBeNull();
    expect(readPass('garbage')).toBeNull();
  });
});

describe('subscription status', () => {
  it.each([
    ['active', 10 * DAY, true],
    ['non-renewing', 5 * DAY, true],
    ['attention', 1 * DAY, true],
    ['cancelled', 10 * DAY, false],
    ['completed', 10 * DAY, false],
    ['active', -10 * DAY, false], // renewal date long past
  ])('%s with next payment in %ims → premium %s', async (status, next, expected) => {
    fakePaystack({ subs: [sub(status as string, next as number)] });
    expect(!!(await activeSubscription(42))).toBe(expected);
  });

  it('ignores subscriptions to plans that are not ours', async () => {
    fakePaystack({ subs: [sub('active', 10 * DAY, 'PLN_other_app')] });
    expect(await activeSubscription(42)).toBeNull();
  });
});

describe('activate', () => {
  it('issues a pass right after checkout (fresh reference, no email)', async () => {
    fakePaystack({ tx: paidTx(), subs: [sub('active', 30 * DAY)] });
    const res = await activate(post('https://app.test/api/premium/activate', { reference: 'ref123' }));
    expect(res.status).toBe(200);
    const pass = (await res.json()) as { token: string; email: string; exp: number };
    expect(pass.email).toBe('ada@example.com');
    expect(pass.exp).toBeGreaterThan(Date.now() + 29 * DAY);
    expect(readPass(pass.token)?.cid).toBe(42);
  });

  it('covers the paid period even before Paystack creates the subscription', async () => {
    fakePaystack({ tx: paidTx(), subs: [] });
    const res = await activate(post('https://app.test/api/premium/activate', { reference: 'ref123' }));
    expect(res.status).toBe(200);
  });

  it('requires the email to restore with an old reference', async () => {
    fakePaystack({ tx: paidTx({ paid_at: iso(Date.now() - 5 * DAY) }), subs: [sub('active', 25 * DAY)] });
    expect((await activate(post('https://app.test/x', { reference: 'ref123' }))).status).toBe(403);
    expect((await activate(post('https://app.test/x', { reference: 'ref123', email: 'other@x.com' }))).status).toBe(403);
    expect((await activate(post('https://app.test/x', { reference: 'ref123', email: 'ada@example.com' }))).status).toBe(200);
  });

  it('rejects failed payments and payments for other products', async () => {
    fakePaystack({ tx: paidTx({ status: 'failed' }) });
    expect((await activate(post('https://app.test/x', { reference: 'ref123' }))).status).toBe(402);
    fakePaystack({ tx: paidTx({ plan_object: {} }) });
    expect((await activate(post('https://app.test/x', { reference: 'ref123' }))).status).toBe(402);
  });

  it('renews a pass while subscribed and refuses after cancellation', async () => {
    const old = signPass({ email: 'ada@example.com', cid: 42, plan: 'PLN_month', tier: 'plus', exp: Date.now() - DAY });
    fakePaystack({ subs: [sub('active', 30 * DAY)] });
    expect((await activate(post('https://app.test/x', { token: old }))).status).toBe(200);
    fakePaystack({ subs: [sub('cancelled', 30 * DAY)] });
    expect((await activate(post('https://app.test/x', { token: old }))).status).toBe(402);
  });
});

describe('checkout', () => {
  it('sends the plan code and a callback to this same site', async () => {
    let sent: Record<string, unknown> = {};
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.com/abc', reference: 'r' } }));
    });
    const res = await checkout(post('https://protein.example/api/premium/checkout', { email: 'a@b.co', plan: 'pro_yearly' }));
    expect(res.status).toBe(200);
    expect(sent).toMatchObject({ email: 'a@b.co', plan: 'PLN_year', callback_url: 'https://protein.example/premium' });
  });

  it('refuses to start a second subscription for someone who already pays', async () => {
    const calls = fakePaystack({ subs: [sub('active', 20 * DAY)], customer: { id: 42 } });
    const res = await checkout(post('https://x/api', { email: 'ada@example.com', plan: 'plus_monthly' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ alreadySubscribed: true });
    expect(calls.some((c) => c.includes('/transaction/initialize'))).toBe(false);
  });

  it('validates input', async () => {
    fakePaystack({});
    expect((await checkout(post('https://x/api', { email: 'nope', plan: 'pro_yearly' }))).status).toBe(400);
    expect((await checkout(post('https://x/api', { email: 'a@b.co', plan: 'lifetime' }))).status).toBe(400);
  });
});

describe('tiers and accounts', () => {
  it('passes carry the tier of the plan bought', async () => {
    fakePaystack({ tx: paidTx({ plan_object: { plan_code: 'PLN_year', interval: 'annually' } }), subs: [sub('active', 300 * DAY, 'PLN_year')] });
    const res = await activate(post('https://app.test/x', { reference: 'ref123' }));
    expect(await res.json()).toMatchObject({ tier: 'pro', scanLimit: 200 });
  });

  it('requires sign-in to subscribe when accounts are on', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    fakePaystack({});
    const res = await checkout(post('https://x/api', { email: 'a@b.co', plan: 'plus_monthly' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ signIn: true });
  });

  it('lets phone-only accounts subscribe with a receipt email, and remembers it', async () => {
    process.env.STORAGE_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    const calls: string[] = [];
    let initBody: Record<string, unknown> = {};
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: '7f1c2e7a-3b4d-4c5e-8f9a-0b1c2d3e4f5a', phone: '2348012345678', email: '', app_metadata: {} }), { status: 200 });
      if (url.includes('/auth/v1/admin/users/7f1c2e7a-3b4d-4c5e-8f9a-0b1c2d3e4f5a')) return new Response(JSON.stringify({ id: '7f1c2e7a-3b4d-4c5e-8f9a-0b1c2d3e4f5a' }), { status: 200 });
      if (url.endsWith('/transaction/initialize')) {
        initBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.com/abc', reference: 'r' } }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    const noEmail = await checkout(post('https://x/api', { plan: 'plus_monthly' }, 'jwt'));
    expect(noEmail.status).toBe(400);
    expect(await noEmail.json()).toMatchObject({ needEmail: true });
    const res = await checkout(post('https://x/api', { email: 'Me@Mail.com', plan: 'plus_monthly' }, 'jwt'));
    expect(res.status).toBe(200);
    expect(initBody).toMatchObject({ email: 'me@mail.com', metadata: { user_id: '7f1c2e7a-3b4d-4c5e-8f9a-0b1c2d3e4f5a' } });
    expect(calls.filter((c) => c.includes('/admin/users/'))).toEqual(['PUT https://proj.supabase.co/auth/v1/admin/users/7f1c2e7a-3b4d-4c5e-8f9a-0b1c2d3e4f5a']);
    delete process.env.STORAGE_SUPABASE_URL;
    delete process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY;
  });
});

describe('plan limits (quota)', () => {
  const U = '7f1c2e7a-3b4d-4c5e-8f9a-0b1c2d3e4f5a';
  function fakeSupabase(counts: Record<string, number>, email = 'me@example.com') {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: U, email, app_metadata: {} }), { status: 200 });
      if (url.endsWith('/rest/v1/rpc/use_scan')) {
        const { p_key, p_limit } = JSON.parse(String(init?.body));
        const used = counts[p_key] ?? 0;
        if (used >= p_limit) return new Response('-1', { status: 200 });
        counts[p_key] = used + 1;
        return new Response(String(p_limit - used - 1), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
  }
  const call = (body: unknown, token?: string, pass?: string) =>
    new Request('https://x/api/recognize', { method: 'POST', headers: { 'content-type': 'application/json', ...(token && { 'x-user-token': token }), ...(pass && { authorization: `Bearer ${pass}` }) }, body: JSON.stringify(body) });
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.ADMIN_EMAILS; });

  it('needs sign-in for AI', async () => {
    fakeSupabase({});
    const res = await recognize(call({ image: 'abc' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ signIn: true });
  });

  it('gives free users 3 scans a day, then asks them to upgrade', async () => {
    fakeSupabase({ [`scan:${U}:${new Date().toISOString().slice(0, 10)}`]: 3 });
    const res = await recognize(call({ image: 'abc' }, 'jwt'));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ limitReached: true, premium: true, tier: 'free' });
  });

  it('keeps plans and ideas for paid tiers, and uses the pass tier limits', async () => {
    const { gate, limitFor } = await import('../_lib/quota.js');
    fakeSupabase({});
    const free = await gate(call({}, 'jwt'), 'plan');
    expect(free.ok).toBe(false);
    if (!free.ok) expect(free.status).toBe(402);
    const pro = signPass({ email: 'me@example.com', cid: 1, plan: 'PLN_year', tier: 'pro', exp: Date.now() + 86400e3 });
    const ok = await gate(call({}, 'jwt', pro), 'plan');
    expect(ok).toMatchObject({ ok: true, tier: 'pro', limit: limitFor('pro', 'plan'), left: limitFor('pro', 'plan') - 1 });
    const expired = signPass({ email: 'me@example.com', cid: 1, plan: 'PLN_month', tier: 'plus', exp: Date.now() - 1 });
    const back = await gate(call({}, 'jwt', expired), 'plan');
    if (!back.ok) expect(back.body).toMatchObject({ renew: true, tier: 'free' });
  });

  it('treats an older Plus subscription as Pro (one paid plan)', async () => {
    const { gate } = await import('../_lib/quota.js');
    fakeSupabase({});
    expect((await gate(call({}, 'jwt'), 'workout')).ok).toBe(false); // free
    const plus = signPass({ email: 'me@example.com', cid: 1, plan: 'PLN_month', tier: 'plus', exp: Date.now() + 86400e3 });
    expect(await gate(call({}, 'jwt', plus), 'workout')).toMatchObject({ ok: true, tier: 'plus' });
    expect(await gate(call({}, 'jwt', plus), 'recipe')).toMatchObject({ ok: true, tier: 'plus' });
    expect(await gate(call({}, 'jwt', plus), 'plan')).toMatchObject({ ok: true, tier: 'plus', limit: 900 });
    expect(await gate(call({}, 'jwt', plus), 'ideas')).toMatchObject({ ok: true, tier: 'plus' });
  });

  it('lets admins test without limits', async () => {
    const { gate } = await import('../_lib/quota.js');
    fakeSupabase({ [`scan:${U}`]: 999 }, 'boss@example.com');
    process.env.ADMIN_EMAILS = 'boss@example.com';
    expect(await gate(call({}, 'jwt'), 'scan')).toMatchObject({ ok: true, left: Infinity });
  });
});

describe('owner stats', () => {
  it('summarises sign-up, return and week-2 retention from stored logs', async () => {
    const { summarize } = await import('../_lib/stats.js');
    const now = Date.parse('2026-11-30T12:00:00Z');
    const day = (n: number) => new Date(now - n * 864e5).toISOString().slice(0, 10);
    const rows = [
      // joined 20 days ago, logged in week 1 and week 2 → retained
      { updated_at: '', data: { profile: { createdAt: now - 20 * 864e5 }, entries: [{ date: day(20) }, { date: day(19) }, { date: day(10) }], weights: [1] } },
      // joined 20 days ago, logged only on day 1 → not retained
      { updated_at: '', data: { profile: { createdAt: now - 20 * 864e5 }, entries: [{ date: day(20) }] } },
      // joined 3 days ago, logging → too new to count for week 2
      { updated_at: '', data: { profile: { createdAt: now - 3 * 864e5 }, entries: [{ date: day(3) }, { date: day(1) }], exercises: [1] } },
      // signed in but never finished sign-up
      { updated_at: '', data: {} },
    ];
    const s = summarize(rows as never, now);
    expect(s).toMatchObject({ accounts: 4, finishedSetup: 3, loggedFood: 3, loggedTwoDays: 2, day2Rate: 67, activeLast7Days: 1, loggedWeight: 1, loggedWorkout: 1 });
    expect(s.week2).toEqual({ eligible: 2, returned: 1, rate: 50 });
    expect(s.retention.day1).toEqual({ eligible: 3, returned: 1, rate: 33 });
    expect(s.retention.day7).toEqual({ eligible: 2, returned: 1, rate: 50 });
    expect(s.retention.day30).toEqual({ eligible: 0, returned: 0, rate: null });
    const foods = summarize([{ updated_at: '', data: { entries: [{ date: day(1), food: { name: 'Jollof rice (party jollof)' } }, { date: day(2), food: { name: 'Jollof rice (party jollof)' } }] } }] as never, now);
    expect(foods.topFoods).toEqual([{ name: 'Jollof rice', entries: 2, people: 1 }]);
  });
});

describe('deployment limits', () => {
  it('stays within the 12 server functions Vercel Hobby allows', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const count = (dir: string): number => readdirSync(dir).reduce((n, f) => {
      if (f.startsWith('_') || f.startsWith('.')) return n; // underscore folders/files aren't deployed as functions
      const p = join(dir, f);
      return n + (statSync(p).isDirectory() ? count(p) : /\.(ts|js)$/.test(f) && !/\.test\./.test(f) ? 1 : 0);
    }, 0);
    expect(count('api')).toBeLessThanOrEqual(12);
  });

  it('uses .js on every relative import the server loads (Vercel runs it as ES modules)', async () => {
    const { readFileSync, existsSync, readdirSync, statSync } = await import('node:fs');
    const { dirname, join, normalize } = await import('node:path');
    const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') && !p.includes('.test.') ? [p] : []; });
    const seen = new Set<string>(); const todo = files('api'); const bad: string[] = [];
    while (todo.length) {
      const f = todo.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      for (const m of readFileSync(f, 'utf8').matchAll(/(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const spec = m[1];
        if (!spec.endsWith('.js') && !spec.endsWith('.json')) bad.push(`${f}: ${spec}`);
        const target = normalize(join(dirname(f), spec.replace(/\.js$/, '.ts')));
        if (existsSync(target)) todo.push(target);
      }
      if (/from\s+['"]@\//.test(readFileSync(f, 'utf8'))) bad.push(`${f}: uses an @/ alias the server can't resolve`);
    }
    expect(bad).toEqual([]);
  });

  it('routes every premium action through the single function', async () => {
    const { GET, POST } = await import('../premium/[action].js');
    delete process.env.PAYSTACK_SECRET_KEY;
    const plans = await GET(new Request('https://x/api/premium/plans'));
    expect(plans.status).toBe(200);
    expect(await plans.json()).toMatchObject({ enabled: false });
    for (const a of ['checkout', 'activate', 'manage', 'billing']) {
      const r = await POST(new Request(`https://x/api/premium/${a}`, { method: 'POST', body: '{}' }));
      expect(r.status).not.toBe(404); // reached the real handler (payments off → its own error)
    }
    expect((await POST(new Request('https://x/api/premium/nope', { method: 'POST', body: '{}' }))).status).toBe(404);
  });
});
