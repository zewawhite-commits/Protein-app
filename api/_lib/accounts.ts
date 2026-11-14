/**
 * Server-side Supabase access (optional). Set in Vercel:
 *   SUPABASE_URL               https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service_role key (secret — never put it in the app)
 * Used to identify signed-in users and to count photo scans per month.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Env lookup tolerant of the custom prefix Vercel's Supabase integration can add (e.g. STORAGE_SUPABASE_URL). */
function envBySuffix(...suffixes: string[]): string | undefined {
  for (const sfx of suffixes) {
    if (process.env[sfx]) return process.env[sfx];
    const key = Object.keys(process.env).sort((a, b) => a.length - b.length).find((k) => k.endsWith('_' + sfx) && process.env[k]);
    if (key) return process.env[key];
  }
  return undefined;
}
export const supabaseUrl = () => envBySuffix('SUPABASE_URL');
export const supabaseServiceKey = () => envBySuffix('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');

let client: { id: string; db: SupabaseClient } | undefined;
export function admin(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) return null;
  if (client?.id !== url + key) {
    client = { id: url + key, db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (...a) => fetch(...a) } }) };
  }
  return client.db;
}

export const accountsConfigured = () => !!(supabaseUrl() && supabaseServiceKey());

/**
 * The signed-in user behind a Supabase access token, or null. `email` is the sign-in
 * email, or for phone sign-ins the billing email saved at their first checkout ('' if none yet).
 */
export async function userFromToken(token: string | null | undefined): Promise<{ id: string; email: string } | null> {
  const db = admin();
  if (!db || !token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const billing = data.user.app_metadata?.billing_email;
  const email = data.user.email || (typeof billing === 'string' ? billing : '');
  return { id: data.user.id, email: email.toLowerCase() };
}

/** Phone-only users: remember the receipt email they paid with (app_metadata — users can't edit it). */
export async function saveBillingEmail(userId: string, email: string) {
  await admin()?.auth.admin.updateUserById(userId, { app_metadata: { billing_email: email } });
}

/**
 * Count one scan for this subscriber this month. Returns scans left, or -1 when the
 * monthly limit is reached. Without Supabase configured, scans are not counted (Infinity).
 */
export async function useScan(key: string, limit: number): Promise<number> {
  const db = admin();
  if (!db) return Infinity;
  const { data, error } = await db.rpc('use_scan', { p_key: key, p_limit: limit });
  if (error) throw new Error(`Scan counter unavailable: ${error.message}`);
  return data as number;
}
