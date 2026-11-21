/**
 * Look-only mode: someone who asked for a sign-up code can look around the app before typing
 * it in, but nothing can be logged or saved until the code is entered. Kept on this device
 * (not sessionStorage), so leaving the app to open the email doesn't lose it.
 */
const KEY = 'nutivili-pending';
const AUTH_KEY = 'nutivili-auth';
const DAY = 864e5;

export class LockedError extends Error {
  constructor() { super('Enter the code from your email to start logging.'); this.name = 'LockedError'; }
}

export function pendingEmail(): string | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { email: string; at: number } | null;
    return p && Date.now() - p.at < 30 * DAY ? p.email : null;
  } catch { return null; }
}
export function setPending(email: string | null) {
  try { if (email) localStorage.setItem(KEY, JSON.stringify({ email, at: Date.now() })); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('nutivili-pending'));
}

/** Writes are blocked while waiting for the code. Opens the "enter your code" sheet and stops the action. */
export function guardWrite() {
  if (!pendingEmail()) return;
  window.dispatchEvent(new Event('nutivili-locked'));
  throw new LockedError();
}

/** The "enter your code" step survives the app being closed while someone checks their email (1 hour). */
export type AuthDraft = { step: 'code'; email: string; signup: boolean };
export function getAuthDraft(): AuthDraft | null {
  try {
    const d = JSON.parse(localStorage.getItem(AUTH_KEY) ?? sessionStorage.getItem(AUTH_KEY) ?? 'null') as (AuthDraft & { at?: number }) | null;
    return d && (!d.at || Date.now() - d.at < 3600_000) ? d : null;
  } catch { return null; }
}
export function setAuthDraft(d: AuthDraft | null) {
  try {
    if (d) localStorage.setItem(AUTH_KEY, JSON.stringify({ ...d, at: Date.now() }));
    else { localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY); }
  } catch { /* storage blocked */ }
}
