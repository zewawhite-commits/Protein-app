/**
 * Premium subscriptions via Paystack, without a database: Paystack is the source of
 * truth and the app holds a short-lived signed pass (HMAC-SHA256) that is renewed by
 * asking Paystack whether the subscription is still active.
 *
 * Environment variables (set in Vercel → Project → Settings → Environment Variables):
 *   PAYSTACK_SECRET_KEY    sk_live_… / sk_test_… from the Paystack dashboard
 *   PAYSTACK_PLAN_MONTHLY  plan code, e.g. PLN_xxxxx (optional)
 *   PAYSTACK_PLAN_YEARLY   plan code (optional)
 *   PREMIUM_TOKEN_SECRET   long random string used to sign Premium passes
 *
 * Files in api/_lib are helpers, not routes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const API = 'https://api.paystack.co';
const DAY = 86_400_000;
/** Extra time after the renewal date so a slightly late renewal doesn't lock anyone out. */
const GRACE_MS = 3 * DAY;

export type PlanId = 'monthly' | 'yearly';

export function config() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const tokenSecret = process.env.PREMIUM_TOKEN_SECRET;
  const plans: Partial<Record<PlanId, string>> = {};
  if (process.env.PAYSTACK_PLAN_MONTHLY) plans.monthly = process.env.PAYSTACK_PLAN_MONTHLY;
  if (process.env.PAYSTACK_PLAN_YEARLY) plans.yearly = process.env.PAYSTACK_PLAN_YEARLY;
  return { enabled: !!(secret && tokenSecret && Object.keys(plans).length), secret, tokenSecret, plans };
}

export const paymentsEnabled = () => config().enabled;

export async function paystack<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { secret } = config();
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: unknown };
  if (!res.ok || !json.status) throw new PaystackError(json.message || `Paystack error ${res.status}`, res.status);
  return json.data as T;
}

export class PaystackError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// ---------- Premium pass ----------

export interface Pass {
  email: string;
  /** Paystack customer id */
  cid: number;
  plan: string;
  /** Expiry, epoch ms */
  exp: number;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signPass(p: Pass): string {
  const body = b64url(JSON.stringify(p));
  const sig = createHmac('sha256', config().tokenSecret!).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Returns the pass if the signature is valid. Expiry is checked by the caller. */
export function readPass(token: string | null | undefined): Pass | null {
  if (!token || !config().tokenSecret) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', config().tokenSecret!).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as Pass;
  } catch {
    return null;
  }
}

export const bearer = (req: Request) => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;

// ---------- Subscriptions ----------

interface Subscription {
  status: string;
  subscription_code: string;
  next_payment_date: string | null;
  plan: { plan_code: string } | null;
}

/**
 * Paystack subscription statuses: active and non-renewing (cancelled, but paid until the
 * next payment date) keep Premium until next_payment_date; attention (a renewal charge
 * failed) keeps it during the grace period so the customer can update their card.
 */
const PAID_STATUSES = new Set(['active', 'non-renewing', 'attention']);

export async function activeSubscription(customerId: number): Promise<{ code: string; plan: string; until: number } | null> {
  const ourPlans = new Set(Object.values(config().plans));
  const subs = await paystack<Subscription[]>(`/subscription?customer=${customerId}&perPage=50`);
  let best: { code: string; plan: string; until: number } | null = null;
  for (const s of subs) {
    if (!PAID_STATUSES.has(s.status) || !s.plan || !ourPlans.has(s.plan.plan_code) || !s.next_payment_date) continue;
    const until = new Date(s.next_payment_date).getTime() + GRACE_MS;
    if (until > Date.now() && (!best || until > best.until)) best = { code: s.subscription_code, plan: s.plan.plan_code, until };
  }
  return best;
}

// ---------- Transactions ----------

interface VerifiedTransaction {
  status: string;
  reference: string;
  paid_at: string | null;
  customer: { id: number; email: string };
  plan_object?: { plan_code?: string; interval?: string } | null;
}

/** Verifies a payment reference and checks it bought one of our plans. */
export async function verifiedPlanPayment(reference: string) {
  const tx = await paystack<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
  const planCode = tx.plan_object?.plan_code;
  const ours = Object.values(config().plans).includes(planCode ?? '');
  if (tx.status !== 'success' || !ours) return null;
  return { email: tx.customer.email.toLowerCase(), cid: tx.customer.id, plan: planCode!, paidAt: tx.paid_at ? new Date(tx.paid_at).getTime() : Date.now(), interval: tx.plan_object?.interval ?? 'monthly' };
}

/** Period covered by a payment when Paystack hasn't created the subscription record yet. */
export function periodMs(interval: string): number {
  const days: Record<string, number> = { daily: 1, weekly: 7, monthly: 31, quarterly: 92, biannually: 183, annually: 366 };
  return (days[interval] ?? 31) * DAY;
}

/** Issue a pass for a verified customer: subscription date if available, else the paid period. */
export async function issuePass(p: { email: string; cid: number; plan: string; paidAt?: number; interval?: string }) {
  const sub = await activeSubscription(p.cid).catch(() => null);
  const until = sub?.until ?? (p.paidAt ? p.paidAt + periodMs(p.interval ?? 'monthly') + GRACE_MS : 0);
  if (until <= Date.now()) return null;
  const pass: Pass = { email: p.email, cid: p.cid, plan: sub?.plan ?? p.plan, exp: until };
  return { token: signPass(pass), exp: pass.exp, email: pass.email, plan: pass.plan };
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function fail(e: unknown) {
  if (e instanceof PaystackError) return json({ error: e.message }, e.status >= 500 ? 502 : 400);
  return json({ error: (e as Error).message || 'Something went wrong.' }, 500);
}
