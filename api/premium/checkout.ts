/**
 * POST /api/premium/checkout { email, plan }  (Authorization: Bearer <Supabase access token> when accounts are on)
 * → { url } of Paystack's hosted checkout. Paystack redirects back to /premium?reference=…
 */
import { bearer, config, fail, json, paystack, type PlanId } from '../_lib/premium';
import { accountsConfigured, userFromToken } from '../_lib/accounts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request): Promise<Response> {
  const c = config();
  if (!c.enabled) return json({ error: 'Payments are not set up yet.' }, 501);
  const body = (await request.json().catch(() => ({}))) as { email?: string; plan?: PlanId; returnPath?: string };
  const code = body.plan && c.plans[body.plan];
  if (!code) return json({ error: 'Unknown plan.' }, 400);

  // With accounts, the subscription belongs to the signed-in user and uses their email.
  let email = body.email?.trim().toLowerCase();
  let userId: string | undefined;
  if (accountsConfigured()) {
    const user = await userFromToken(bearer(request));
    if (!user) return json({ error: 'Sign in to subscribe.', signIn: true }, 401);
    email = user.email;
    userId = user.id;
  }
  if (!email || !EMAIL.test(email) || email.length > 200) return json({ error: 'Enter a valid email address.' }, 400);

  // Return to this same deployment, never to a URL supplied by the client.
  const origin = new URL(request.url).origin;
  try {
    const data = await paystack<{ authorization_url: string; reference: string }>('/transaction/initialize', {
      method: 'POST',
      // With a plan, Paystack charges the plan's amount; amount is still a required field.
      body: { email, amount: 100, plan: code, callback_url: `${origin}/premium`, metadata: { app: 'protein', plan: body.plan, user_id: userId } },
    });
    return json({ url: data.authorization_url, reference: data.reference });
  } catch (e) {
    return fail(e);
  }
}
