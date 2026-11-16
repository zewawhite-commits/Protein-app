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
