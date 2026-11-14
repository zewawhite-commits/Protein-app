/**
 * Accounts and cloud sync with Supabase (optional). Enabled when the build has
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (both are public by design; data is
 * protected by row-level security, see supabase/schema.sql).
 *
 * Sync model: the whole app state (minus photos, API keys and passes) is one JSON row
 * per user. Last write wins, decided by `updated_at`.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { exportData, useStore } from '@/store/useStore';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const accountsEnabled = !!(url && anon);
export const supabase: SupabaseClient | null = accountsEnabled ? createClient(url!, anon!, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;

const appUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`;

export async function signInWithGoogle() {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } });
  if (error) throw error;
}

/** Sends a one-time sign-in link to the email address. */
export async function signInWithEmail(email: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl() } });
  if (error) throw error;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export async function accessToken(): Promise<string | undefined> {
  return (await supabase?.auth.getSession())?.data.session?.access_token;
}

// ---------- cloud sync ----------

type Snapshot = ReturnType<typeof exportData>;
let lastPushed = '';
let timer: ReturnType<typeof setTimeout> | undefined;

/** After sign-in: bring down the cloud copy if it is newer, otherwise upload this device's data. */
export async function syncOnSignIn(userId: string) {
  if (!supabase) return;
  const { data, error } = await supabase.from('user_data').select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const local = useStore.getState();
  const localUpdated = local.lastModified ?? 0;
  const remoteUpdated = data ? new Date(data.updated_at as string).getTime() : 0;
  if (data && (remoteUpdated > localUpdated || (!local.profile && !local.entries.length))) {
    const snap = data.data as Snapshot;
    useStore.getState().importData({ ...snap, settings: { ...snap.settings, aiApiKey: local.settings.aiApiKey } });
    useStore.setState({ lastModified: remoteUpdated, premium: local.premium });
    lastPushed = JSON.stringify(snap);
  } else {
    await push(userId);
  }
}

async function push(userId: string) {
  if (!supabase) return;
  const snap = exportData();
  const body = JSON.stringify({ ...snap, exportedAt: undefined });
  if (body === lastPushed) return;
  const { error } = await supabase.from('user_data').upsert({ user_id: userId, data: snap, updated_at: new Date(useStore.getState().lastModified ?? Date.now()).toISOString() });
  if (!error) lastPushed = body;
}

/** Keep the cloud copy up to date while signed in (debounced). */
export function useCloudSync() {
  const session = useSession();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    syncOnSignIn(userId).catch((e) => console.warn('Sync failed', e));
    const unsub = useStore.subscribe((s, prev) => {
      if (cancelled || s.lastModified === prev.lastModified) return;
      clearTimeout(timer);
      timer = setTimeout(() => void push(userId).catch((e) => console.warn('Sync failed', e)), 1500);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [userId]);
  return session;
}
