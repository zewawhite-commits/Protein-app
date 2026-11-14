import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeSubscription, readPass, signPass } from './_lib/premium';
import { POST as activate } from './premium/activate';
import { POST as checkout } from './premium/checkout';
import { POST as recognize } from './recognize';

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Minimal fake of the Paystack API used by the handlers. */
function fakePaystack(state: { tx?: Record<string, unknown>; subs?: unknown[] }) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const path = url.replace('https://api.paystack.co', '');
    calls.push(`${init?.method ?? 'GET'} ${path}`);
    const ok = (data: unknown) => new Response(JSON.stringify({ status: true, message: 'ok', data }), { status: 200 });
    if (path.startsWith('/transaction/verify/')) return state.tx ? ok(state.tx) : new Response(JSON.stringify({ status: false, message: 'Transaction reference not found' }), { status: 400 });
    if (path.startsWith('/subscription?')) return ok(state.subs ?? []);
    if (path === '/transaction/initialize') return ok({ authorization_url: 'https://checkout.paystack.com/abc', reference: 'ref123' });
    return new Response('{}', { status: 404 });
  });
  return calls;
}

const post = (url: string, body: unknown, token?: string) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) });

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
  process.env.PAYSTACK_PLAN_MONTHLY = 'PLN_month';
  process.env.PAYSTACK_PLAN_YEARLY = 'PLN_year';
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
    const t = signPass({ email: 'a@b.co', cid: 1, plan: 'PLN_month', exp: Date.now() + DAY });
    expect(readPass(t)?.cid).toBe(1);
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ email: 'a@b.co', cid: 1, plan: 'PLN_month', exp: Date.now() + 999 * DAY })).toString('base64url');
    expect(readPass(`${forged}.${sig}`)).toBeNull();
    expect(readPass(`${body}.x${sig.slice(1)}`)).toBeNull();
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
    const old = signPass({ email: 'ada@example.com', cid: 42, plan: 'PLN_month', exp: Date.now() - DAY });
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
    const res = await checkout(post('https://protein.example/api/premium/checkout', { email: 'a@b.co', plan: 'yearly' }));
    expect(res.status).toBe(200);
    expect(sent).toMatchObject({ email: 'a@b.co', plan: 'PLN_year', callback_url: 'https://protein.example/premium' });
  });

  it('validates input', async () => {
    fakePaystack({});
    expect((await checkout(post('https://x/api', { email: 'nope', plan: 'yearly' }))).status).toBe(400);
    expect((await checkout(post('https://x/api', { email: 'a@b.co', plan: 'lifetime' }))).status).toBe(400);
  });
});

describe('recognition is Premium-gated when payments are on', () => {
  it('returns 402 without a valid, unexpired pass', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect((await recognize(post('https://x/api/recognize', { image: 'abc' }))).status).toBe(402);
    const expired = signPass({ email: 'a@b.co', cid: 1, plan: 'PLN_month', exp: Date.now() - 1 });
    const res = await recognize(post('https://x/api/recognize', { image: 'abc' }, expired));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ renew: true });
    delete process.env.ANTHROPIC_API_KEY;
  });
});
