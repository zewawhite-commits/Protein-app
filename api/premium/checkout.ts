/**
 * POST /api/premium/checkout { email, plan: "monthly" | "yearly" }
 * → { url } of Paystack's hosted checkout. Paystack redirects back to /premium?reference=…
 */
import { config, fail, json, paystack, type PlanId } from '../_lib/premium';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request): Promise<Response> {
  const c = config();
  if (!c.enabled) return json({ error: 'Payments are not set up yet.' }, 501);
  const { email, plan } = (await request.json().catch(() => ({}))) as { email?: string; plan?: PlanId };
  if (!email || !EMAIL.test(email) || email.length > 200) return json({ error: 'Enter a valid email address.' }, 400);
  const code = plan && c.plans[plan];
  if (!code) return json({ error: 'Unknown plan.' }, 400);
  // Return to this same deployment, never to a URL supplied by the client.
  const origin = new URL(request.url).origin;
  try {
    const data = await paystack<{ authorization_url: string; reference: string }>('/transaction/initialize', {
      method: 'POST',
      // With a plan, Paystack charges the plan's amount; amount is still a required field.
      body: { email: email.trim().toLowerCase(), amount: 100, plan: code, callback_url: `${origin}/premium`, metadata: { app: 'protein', plan } },
    });
    return json({ url: data.authorization_url, reference: data.reference });
  } catch (e) {
    return fail(e);
  }
}
