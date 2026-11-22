/** GET /api/usage → this month's AI usage and limits for the signed-in user. */
import { json } from './_lib/premium.js';
import { creditBalance, usage } from './_lib/quota.js';

export async function GET(request: Request): Promise<Response> {
  const u = await usage(request);
  if (!u) return json({ error: 'Sign in first.', signIn: true }, 401);
  // Paid plans: their AI credit balance (shown in Profile).
  const credits = await creditBalance(request).catch(() => null);
  return json({ ...u, ...(credits && { credits }) });
}
