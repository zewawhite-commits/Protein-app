/**
 * GET /api/stats (x-user-token) → usage totals for the app owner (emails in ADMIN_EMAILS only).
 */
import { json } from './_lib/premium.js';
import { admin, userFromToken } from './_lib/accounts.js';
import { isAdmin } from './_lib/quota.js';
import { summarize, type Row } from './_lib/stats.js';

export async function GET(request: Request): Promise<Response> {
  const db = admin();
  if (!db) return json({ error: 'Accounts aren’t set up on the server yet.' }, 503);
  const user = await userFromToken(request.headers.get('x-user-token'));
  if (!user) return json({ error: 'Sign in first.' }, 401);
  if (!isAdmin(user.email)) return json({ error: 'Not available.' }, 403);
  const rows: Row[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db.from('user_data').select('data, updated_at').range(from, from + 999);
    if (error) return json({ error: error.message }, 500);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await db.from('scan_usage').select('subscriber, scans').eq('month', month);
  const ai: Record<string, { people: number; uses: number }> = {};
  for (const u of usage ?? []) {
    const f = String(u.subscriber).includes(':') ? String(u.subscriber).split(':')[0] : 'scan';
    ai[f] ??= { people: 0, uses: 0 };
    ai[f].people++;
    ai[f].uses += u.scans as number;
  }
  return json({ ...summarize(rows), aiThisMonth: ai });
}
