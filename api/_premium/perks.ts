/**
 * POST /api/premium/trial            → start the one-off free Plus trial  { proUntil, days }
 * POST /api/premium/invite {code}    → accept a friend's invite link     { proUntil, days }
 * Both need a signed-in account (x-user-token).
 */
import { json } from '../_lib/premium.js';
import { userFromToken } from '../_lib/accounts.js';
import { acceptInvite, startTrial } from '../_lib/perks.js';

async function signedIn(request: Request) {
  return userFromToken(request.headers.get('x-user-token'));
}

export async function trial(request: Request): Promise<Response> {
  const user = await signedIn(request);
  if (!user) return json({ error: 'Sign in to start your free trial.', signIn: true }, 401);
  try {
    const r = await startTrial(user);
    return r.ok ? json({ proUntil: r.proUntil, days: r.days }) : json({ error: r.error }, r.status);
  } catch (e) {
    return json({ error: (e as Error).message }, 503);
  }
}

export async function invite(request: Request): Promise<Response> {
  const user = await signedIn(request);
  if (!user) return json({ error: 'Sign in first.', signIn: true }, 401);
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  try {
    const r = await acceptInvite(user, code);
    return r.ok ? json({ proUntil: r.proUntil, days: r.days }) : json({ error: r.error }, r.status);
  } catch (e) {
    return json({ error: (e as Error).message }, 503);
  }
}
