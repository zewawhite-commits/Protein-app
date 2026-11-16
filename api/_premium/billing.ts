/**
 * POST /api/premium/billing (Authorization: Bearer <pass>)
 * → { status, plan, amount, currency, nextPayment, card: { brand, last4, expMonth, expYear } | null }
 * Subscription and payment-method details for the Profile page, straight from Paystack.
 */
import { activeSubscription, bearer, fail, json, paymentsEnabled, paystack, readPass } from '../_lib/premium.js';

interface SubscriptionDetail {
  status: string;
  amount: number;
  next_payment_date: string | null;
  plan?: { name?: string; currency?: string; interval?: string } | null;
  authorization?: { brand?: string; card_type?: string; last4?: string; exp_month?: string; exp_year?: string; channel?: string } | null;
}

export async function POST(request: Request): Promise<Response> {
  if (!paymentsEnabled()) return json({ error: 'Payments are not set up yet.' }, 501);
  const pass = readPass(bearer(request));
  if (!pass) return json({ error: 'Invalid Premium pass.' }, 401);
  try {
    const sub = await activeSubscription(pass.cid);
    if (!sub) return json({ error: 'No active subscription found.' }, 404);
    const d = await paystack<SubscriptionDetail>(`/subscription/${encodeURIComponent(sub.code)}`);
    const a = d.authorization;
    return json({
      status: d.status,
      plan: d.plan?.name ?? null,
      interval: d.plan?.interval ?? null,
      amount: d.amount / 100,
      currency: d.plan?.currency ?? 'NGN',
      nextPayment: d.next_payment_date,
      card: a?.last4 ? { brand: (a.brand || a.card_type || 'Card').trim(), last4: a.last4, expMonth: a.exp_month ?? '', expYear: a.exp_year ?? '' } : null,
    });
  } catch (e) {
    return fail(e);
  }
}
