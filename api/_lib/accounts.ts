/**
 * Server-side Supabase access (optional). Set in Vercel:
 *   SUPABASE_URL               https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service_role key (secret — never put it in the app)
 * Used to identify signed-in users and to count photo scans per month.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;
function admin(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}

export const accountsConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** The signed-in user behind a Supabase access token, or null. */
export async function userFromToken(token: string | null | undefined): Promise<{ id: string; email: string } | null> {
  const db = admin();
  if (!db || !token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email.toLowerCase() };
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
