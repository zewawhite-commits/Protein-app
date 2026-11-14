/** GET /api/premium/plans → prices straight from the Paystack plans, so the app never shows a stale price. */
import { config, fail, json, paystack, type PlanId } from '../_lib/premium';

interface Plan { name: string; amount: number; currency: string; interval: string }

export async function GET(): Promise<Response> {
  const c = config();
  if (!c.enabled) return json({ enabled: false, plans: [] });
  try {
    const plans = await Promise.all(
      (Object.entries(c.plans) as [PlanId, string][]).map(async ([id, code]) => {
        const p = await paystack<Plan>(`/plan/${encodeURIComponent(code)}`);
        // Paystack amounts are in the smallest unit (kobo for NGN).
        return { id, name: p.name, amount: p.amount / 100, currency: p.currency, interval: p.interval };
      }),
    );
    return new Response(JSON.stringify({ enabled: true, plans }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    });
  } catch (e) {
    return fail(e);
  }
}
