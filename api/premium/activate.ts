/**
 * POST /api/premium/activate
 *   { reference }                 after returning from Paystack checkout
 *   { reference, email }          restore on another device (reference is on the Paystack receipt)
 *   { token }                     renew an existing (possibly expired) pass
 *   { account: true }             restore for the signed-in account (Authorization: Bearer <Supabase token>)
 * → { token, exp, email, plan } or 402 when there is no paid subscription.
 */
import { bearer, customerIdByEmail, fail, issuePass, json, paymentsEnabled, readPass, verifiedPlanPayment } from '../_lib/premium';
import { userFromToken } from '../_lib/accounts';

export async function POST(request: Request): Promise<Response> {
  if (!paymentsEnabled()) return json({ error: 'Payments are not set up yet.' }, 501);
  const body = (await request.json().catch(() => ({}))) as { reference?: string; email?: string; token?: string; account?: boolean };
  try {
    if (body.account) {
      const user = await userFromToken(bearer(request));
      if (!user) return json({ error: 'Sign in first.' }, 401);
      const cid = await customerIdByEmail(user.email);
      const pass = cid ? await issuePass({ email: user.email, cid, plan: '', uid: user.id }) : null;
      return pass ? json(pass) : json({ error: 'No active subscription for this account.' }, 402);
    }
    if (body.token) {
      const pass = readPass(body.token);
      if (!pass) return json({ error: 'Invalid Premium pass.' }, 401);
      const renewed = await issuePass({ email: pass.email, cid: pass.cid, plan: pass.plan, uid: pass.uid });
      return renewed ? json(renewed) : json({ error: 'Your subscription is no longer active.' }, 402);
    }

    const reference = body.reference?.trim();
    if (!reference || !/^[\w.=-]{4,100}$/.test(reference)) return json({ error: 'Missing payment reference.' }, 400);
    const paid = await verifiedPlanPayment(reference);
    if (!paid) return json({ error: 'That payment was not completed or is not a Premium plan.' }, 402);
    if (body.email) {
      if (body.email.trim().toLowerCase() !== paid.email) return json({ error: 'Email and payment reference do not match.' }, 403);
    } else if (Date.now() - paid.paidAt > 2 * 3600_000) {
      // Without the email, only accept the fresh reference from the checkout redirect.
      return json({ error: 'Enter the email you paid with to restore Premium.' }, 403);
    }
    const pass = await issuePass(paid);
    return pass ? json(pass) : json({ error: 'This subscription has ended.' }, 402);
  } catch (e) {
    return fail(e);
  }
}
