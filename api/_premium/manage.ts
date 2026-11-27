/** POST /api/premium/manage (Authorization: Bearer <pass>) → { url } Paystack page to update card or cancel. */
import { activeSubscription, bearer, fail, json, paymentsEnabled, paystack, readPass } from '../_lib/premium.js';

export async function POST(request: Request): Promise<Response> {
  if (!paymentsEnabled()) return json({ error: 'Payments are not set up yet.' }, 501);
  const pass = readPass(bearer(request));
  if (!pass) return json({ error: 'Invalid Premium pass.' }, 401);
  try {
    const sub = await activeSubscription(pass.cid);
    if (!sub) return json({ error: 'No active subscription found.' }, 404);
    const data = await paystack<{ link?: string }>(`/subscription/${encodeURIComponent(sub.code)}/manage/link`);
    if (!data?.link) return json({ error: 'Paystack did not return a management link.' }, 502);
    return json({ url: data.link });
  } catch (e) {
    return fail(e);
  }
}

/**
 * POST /api/premium/cancel (Authorization: Bearer <pass>) → { ok, until }
 * Cancels renewal straight from the app, in one tap: no page to find, no email to send. The
 * person keeps Plus until the end of the period they paid for.
 */
export async function CANCEL(request: Request): Promise<Response> {
  if (!paymentsEnabled()) return json({ error: 'Payments are not set up yet.' }, 501);
  const pass = readPass(bearer(request));
  if (!pass) return json({ error: 'Invalid Premium pass.' }, 401);
  try {
    const sub = await activeSubscription(pass.cid);
    if (!sub) return json({ error: 'No active subscription found. If you were charged, contact support and we’ll sort it out.' }, 404);
    const detail = await paystack<{ email_token?: string }>(`/subscription/${encodeURIComponent(sub.code)}`);
    if (!detail?.email_token) return json({ error: 'Could not cancel right now. Try again, or use the manage page.' }, 502);
    await paystack('/subscription/disable', { method: 'POST', body: { code: sub.code, token: detail.email_token } });
    return json({ ok: true, until: sub.until });
  } catch (e) {
    return fail(e);
  }
}
