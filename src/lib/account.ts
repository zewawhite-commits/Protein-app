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
export { toE164 } from './dialCodes';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const accountsEnabled = !!(url && anon);
export const supabase: SupabaseClient | null = accountsEnabled ? createClient(url!, anon!, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;

/** Where to land after an email/Google sign-in: the page you were on. */
const returnUrl = () => `${window.location.origin}${window.location.pathname}${window.location.search}`;

export async function signInWithGoogle() {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl() } });
  if (error) throw error;
}

/**
 * Emails a 6-digit sign-in code (and a link, if the email template includes one).
 * The Supabase "Magic Link" template must contain {{ .Token }} for the code to appear.
 */
export async function signInWithEmail(email: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: returnUrl() } });
  if (error) throw error;
}

/** Sends a one-time code by SMS. `phone` in international format, e.g. +2348012345678. */
/** Signs in with the 6-digit code from the email. */
export async function verifyEmailCode(email: string, token: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function sendPhoneCode(phone: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

export async function verifyPhoneCode(phone: string, token: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
}

/**
 * Signs out. The log is saved to the account first and then removed from this phone,
 * so the next person to use it starts clean and nothing is mixed between accounts.
 */
export async function signOut() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (userId && useStore.getState().ownerId === userId) {
    try { await push(userId, true); } catch { /* still sign out */ }
  }
  await supabase.auth.signOut();
  if (userId) {
    lastPushed = '';
    useStore.getState().resetAll();
    useStore.setState({ ownerId: undefined, lastModified: undefined });
  }
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
  let local = useStore.getState();
  // Data on this phone belongs to a different account: don't mix it in. Start from this account's own copy.
  if (local.ownerId && local.ownerId !== userId) {
    local.resetAll();
    useStore.setState({ ownerId: undefined, lastModified: undefined });
    lastPushed = '';
    local = useStore.getState();
  }
  // Used the app as a guest, then signed in to an account that already has data:
  // keep the account's profile and history and add what was logged as a guest. Nothing is lost.
  if (data && !local.ownerId && (local.entries.length || local.weights.length || local.exercises.length)) {
    const remote = data.data as Snapshot;
    const byId = <T extends { id: string }>(a: T[] = [], b: T[] = []) => [...a, ...b.filter((x) => !a.some((y) => y.id === x.id))];
    const merged = {
      ...remote,
      entries: byId(remote.entries, local.entries),
      exercises: byId(remote.exercises, local.exercises),
      savedMeals: byId(remote.savedMeals, local.savedMeals),
      customFoods: byId(remote.customFoods, local.customFoods),
      weights: [...(remote.weights ?? []), ...local.weights.filter((w) => !(remote.weights ?? []).some((r) => r.date === w.date))].sort((a, b) => a.date.localeCompare(b.date)),
      profile: remote.profile ?? local.profile,
    } as Snapshot;
    useStore.getState().importData(merged);
    useStore.setState({ lastModified: Date.now(), premium: local.premium, ownerId: userId });
    await push(userId, true);
    return;
  }
  const localUpdated = local.lastModified ?? 0;
  const remoteUpdated = data ? new Date(data.updated_at as string).getTime() : 0;
  // A guest who only did the sign-up questions, then signed in to an existing account: the account wins.
  if (data && (remoteUpdated > localUpdated || !local.ownerId || (!local.profile && !local.entries.length))) {
    const snap = data.data as Snapshot;
    useStore.getState().importData(snap);
    useStore.setState({ lastModified: remoteUpdated, premium: local.premium, ownerId: userId });
    lastPushed = JSON.stringify(snap);
  } else {
    useStore.setState({ ownerId: userId });
    await push(userId);
  }
}

async function push(userId: string, force = false) {
  if (!supabase) return;
  // Never upload a log that belongs to someone else.
  if (useStore.getState().ownerId !== userId) return;
  if (force) lastPushed = '';
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

/** Starts an email change: Supabase emails a confirmation to the new address. */
export async function changeEmail(email: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/settings` });
  if (error) throw error;
}

/** Permanently deletes the account and everything linked to it, then clears this phone. */
export async function deleteAccount() {
  if (!supabase) return;
  const token = await accessToken();
  if (!token) throw new Error('Sign in again to delete your account.');
  const res = await fetch('/api/account', { method: 'DELETE', headers: { 'x-user-token': token } });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? ((await res.json()) as { error?: string }) : {};
  if (!res.ok) throw new Error(data.error || 'Could not delete the account. Try again.');
  await supabase.auth.signOut().catch(() => undefined);
  lastPushed = '';
  useStore.getState().resetAll();
  useStore.setState({ ownerId: undefined, lastModified: undefined });
}
