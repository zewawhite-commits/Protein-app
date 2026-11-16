/** GET /api/usage → this month's AI usage and limits for the signed-in user. */
import { json } from './_lib/premium.js';
import { usage } from './_lib/quota.js';

export async function GET(request: Request): Promise<Response> {
  const u = await usage(request);
  return u ? json(u) : json({ error: 'Sign in first.', signIn: true }, 401);
}
