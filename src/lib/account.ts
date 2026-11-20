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
import { fingerprint, mergeSnapshots, type SyncSnapshot } from './sync';
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
  if (error) throw new Error(friendly(error.message));
}

/** Sends a one-time code by SMS. `phone` in international format, e.g. +2348012345678. */
/** Signs in with the 6-digit code from the email. */
export async function verifyEmailCode(email: string, token: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new Error(friendly(error.message));
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
    try { await syncNow(userId); } catch { /* still sign out */ }
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

let lastPushed = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;

/**
 * Sync this device with the cloud copy, without losing anything:
 *  1. read the cloud copy,
 *  2. merge it with this device (item by item — see sync.ts),
 *  3. save the merged copy here and, only if the cloud copy hasn't changed meanwhile, there.
 * If another device saved in between, start again (up to 3 times).
 */
// Whether this account's first sync on this device has finished, so screens can wait for the
// account's saved profile instead of asking the setup questions again.
const synced = new Set<string>();
const syncListeners = new Set<() => void>();
export function useFirstSyncDone(userId?: string): boolean {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); syncListeners.add(f); return () => { syncListeners.delete(f); }; }, []);
  return !userId || synced.has(userId);
}
export function syncNow(userId: string): Promise<void> {
  if (!running) running = doSync(userId).finally(() => { running = null; synced.add(userId); syncListeners.forEach((f) => f()); });
  return running;
}

async function doSync(userId: string, attempt = 0): Promise<void> {
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
  const localSnap = exportData() as SyncSnapshot;
  const localTime = local.lastModified ?? 0;
  if (!data) {
    // First sync for this account: upload this device's data.
    useStore.setState({ ownerId: userId });
    const { error: e } = await supabase.from('user_data').insert({ user_id: userId, data: exportData(), updated_at: new Date().toISOString() });
    if (e && attempt < 3 && /duplicate|conflict/i.test(e.message)) return doSync(userId, attempt + 1);
    if (e) throw e;
    lastPushed = fingerprint(exportData() as SyncSnapshot);
    return;
  }
  const remote = data.data as SyncSnapshot;
  const remoteTime = new Date(data.updated_at as string).getTime();
  // A guest who only answered the setup questions, then signed in to an existing account: the account's profile wins.
  const guestOnly = !local.ownerId && !(local.entries.length || local.weights.length || local.exercises.length);
  const merged = guestOnly ? { ...remote, deleted: remote.deleted ?? {} } : mergeSnapshots(localSnap, remote, local.ownerId ? localTime : 0, remoteTime);
  if (!local.profile && remote.profile) { try { sessionStorage.setItem('provora-restored', '1'); } catch { /* ignore */ } }

  // Bring the merged copy onto this device if it differs.
  if (fingerprint(merged) !== fingerprint(localSnap)) {
    useStore.getState().importData({ ...merged, app: 'protein-app' });
  }
  useStore.setState({ ownerId: userId, lastModified: Math.max(localTime, remoteTime) });

  // Upload only if the cloud copy is missing something, and only if nobody else saved since we read it.
  const after = exportData() as SyncSnapshot;
  if (fingerprint(after) === fingerprint(remote)) { lastPushed = fingerprint(after); return; }
  const { data: written, error: e } = await supabase.from('user_data')
    .update({ data: after, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('updated_at', data.updated_at as string)
    .select('user_id');
  if (e) throw e;
  if (!written?.length) {
    // Another device saved in between: merge again with its copy.
    if (attempt < 3) return doSync(userId, attempt + 1);
    return;
  }
  lastPushed = fingerprint(after);
}

/** @deprecated name kept for callers: same as syncNow. */
export const syncOnSignIn = syncNow;

/** Keep this device and the cloud in step while signed in. */
export function useCloudSync() {
  const session = useSession();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const run = () => { if (!cancelled) void syncNow(userId).catch((e) => console.warn('Sync failed', e)); };
    run();
    // Local changes: sync shortly after (debounced).
    const unsub = useStore.subscribe((s, prev) => {
      if (cancelled || s.lastModified === prev.lastModified) return;
      if (fingerprint(exportData() as SyncSnapshot) === lastPushed) return;
      clearTimeout(timer);
      timer = setTimeout(run, 1500);
    });
    // Changes from other devices: check when the app comes back into view, and every 2 minutes while open.
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', run);
    const every = setInterval(() => { if (document.visibilityState === 'visible') run(); }, 120_000);
    return () => {
      cancelled = true;
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
      clearInterval(every);
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

/** Sets or changes the account password (optional: Google and email codes keep working). */
export async function setPassword(password: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** Plain-English versions of the auth errors people actually hit. */
function friendly(message: string): string {
  if (/rate limit|too many/i.test(message)) return 'Too many emails were sent in the last hour. Please try again a bit later, or continue with Google.';
  if (/invalid login/i.test(message)) return 'Wrong email or password. Forgot it? Tap “Forgot password” to get a login link by email.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first: tap the link in the email we sent you.';
  if (/already registered|already been registered|already exists/i.test(message)) return 'An account with this email already exists. Log in instead.';
  if (/password should be|weak password|at least/i.test(message)) return 'Choose a stronger password: at least 8 characters.';
  if (/expired|invalid.*(token|otp)|token.*invalid/i.test(message)) return 'That link or code has expired. Ask for a new email.';
  return message;
}

/** Logs in with email and password. No email is sent, so it never hits email limits. */
export async function signInWithPassword(email: string, password: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error.message));
}

/**
 * Creates an account with email and password. Returns 'signed-in' when the project lets
 * people in straight away, or 'confirm' when Supabase first emails a confirmation
 * (6-digit code if the "Confirm signup" template has {{ .Token }}, plus a link).
 */
export async function signUpWithPassword(email: string, password: string, phone?: string, marketing = false): Promise<'signed-in' | 'confirm'> {
  if (!supabase) return 'signed-in';
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: returnUrl(), data: { ...(phone ? { phone_number: phone } : {}), marketing_opt_in: marketing } } });
  if (error) throw new Error(friendly(error.message));
  // Supabase hides whether an email is taken by returning a user with no identities.
  if (data.user && (data.user.identities?.length ?? 0) === 0) throw new Error(friendly('already registered'));
  return data.session ? 'signed-in' : 'confirm';
}

/** Confirms a new account with the 6-digit code from the sign-up email. */
export async function verifySignupCode(email: string, token: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) throw new Error(friendly(error.message));
}

export async function resendSignupCode(email: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: returnUrl() } });
  if (error) throw new Error(friendly(error.message));
}

/** A rough check for an international phone number: +, then 7–15 digits. */
export const validPhone = (p: string) => /^\+[1-9]\d{6,14}$/.test(p);
/** Tidies what people type ("+234 801-234 5678") into +2348012345678. */
export const cleanPhone = (p: string) => (p.trim().startsWith('+') ? '+' : '') + p.replace(/\D/g, '');

/** Saves (or clears) the contact phone number on the account. Sign-in stays by email or Google. */
export async function setPhoneNumber(phone: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ data: { phone_number: phone || null } });
  if (error) throw new Error(friendly(error.message));
}

/** Tips and offers by email: on only if the person ticked it (stored on their account). */
export async function setMarketingOptIn(on: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ data: { marketing_opt_in: on } });
  if (error) throw new Error(friendly(error.message));
}
