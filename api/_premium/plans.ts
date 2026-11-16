/** GET /api/premium/plans → prices straight from the Paystack plans, so the app never shows a stale price. */
import { config, fail, json, paystack, scanLimit, type PlanId, type Tier } from '../_lib/premium.js';
import { accountsConfigured } from '../_lib/accounts.js';
import { USD_PRICES } from '../../src/lib/prices.js';

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
        const amount = p.amount / 100;
        // The app advertises USD_PRICES; flag a Paystack plan set to a different dollar amount.
        const expected = USD_PRICES[id];
        const mismatch = p.currency === 'USD' && expected != null && Math.abs(amount - expected) > 0.005;
        if (mismatch) console.warn(`[plans] Paystack plan ${id} is $${amount}, but the app advertises $${expected}. Update one of them.`);
        return { id, tier, name: p.name, amount, currency: p.currency, interval: p.interval, scans: scanLimit(tier), ...(mismatch && { mismatch: true }) };
      }),
    );
    return new Response(JSON.stringify({ enabled: true, plans, accountRequired: accountsConfigured() }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    });
  } catch (e) {
    return fail(e);
  }
}
