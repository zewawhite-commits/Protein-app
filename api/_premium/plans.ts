/** GET /api/premium/plans → prices straight from the Paystack plans, so the app never shows a stale price. */
import { config, fail, json, paystack, scanLimit, type PlanId, type Tier } from '../_lib/premium.js';
import { accountsConfigured } from '../_lib/accounts.js';

interface Plan { name: string; amount: number; currency: string; interval: string }

export async function GET(): Promise<Response> {
  const c = config();
  if (!c.enabled) return json({ enabled: false, plans: [] });
  try {
    const plans = await Promise.all(
      (Object.entries(c.plans) as [PlanId, string][]).map(async ([id, code]) => {
        const p = await paystack<Plan>(`/plan/${encodeURIComponent(code)}`);
        const tier = id.split('_')[0] as Tier;
        // Paystack amounts are in the smallest unit (kobo/cents).
        return { id, tier, name: p.name, amount: p.amount / 100, currency: p.currency, interval: p.interval, scans: scanLimit(tier) };
      }),
    );
    return new Response(JSON.stringify({ enabled: true, plans, accountRequired: accountsConfigured() }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    });
  } catch (e) {
    return fail(e);
  }
}
