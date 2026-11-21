/**
 * Free Plus time: a one-off 3-day trial, and invite rewards. Kept in the user's Supabase
 * app_metadata (only the server can write it), so no extra table is needed.
 *
 *  - Trial: once per account, 3 days of Plus, no card. Invited friends get 14 days.
 *  - Invites: when a new account (under 14 days old) joins with someone's link, the
 *    inviter gets 7 more days of Plus, up to 10 friends (70 days). Not your own link.
 *  - Trial time uses the "trial" limits in quota.ts — generous, but capped, so AI costs
 *    stay predictable. Invite rewards (reward_until) use the "reward" limits: Plus features,
 *    with coach messages kept at the Free allowance.
 */
import { admin } from './accounts.js';

export const TRIAL_DAYS = 3;
export const INVITED_TRIAL_DAYS = 14;
export const REFERRAL_DAYS = 7;
export const MAX_REFERRALS = 10;
export const NEW_ACCOUNT_DAYS = 14;
const DAY = 864e5;

export interface Perks { proUntil: number; trialUsed: boolean; referredBy: string | null; referrals: number; rewardUntil: number }

export function perksFrom(meta: Record<string, unknown> | undefined | null): Perks {
  const m = meta ?? {};
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return { proUntil: n(m.pro_until), trialUsed: m.trial_used === true, referredBy: typeof m.referred_by === 'string' ? m.referred_by : null, referrals: n(m.referrals), rewardUntil: n(m.reward_until) };
}

/** Add days of Plus, starting from now or from the end of the time already given. */
export const extend = (proUntil: number, days: number, now: number) => Math.max(now, proUntil) + days * DAY;

/** Short invite code for a user id (the UUID's 16 bytes, base64url: 22 characters). */
export function inviteCode(userId: string): string {
  const hex = userId.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) return '';
  return Buffer.from(hex, 'hex').toString('base64url');
}
export function userIdFromCode(code: string): string | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return null;
  const hex = Buffer.from(code, 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type TrialResult = { ok: true; proUntil: number; days: number } | { ok: false; status: number; error: string };

/** What starting the trial does (pure, for tests). */
export function planTrial(p: Perks, now: number): TrialResult {
  if (p.trialUsed) return { ok: false, status: 409, error: 'You’ve already had your free Plus trial on this account.' };
  const days = p.referredBy ? INVITED_TRIAL_DAYS : TRIAL_DAYS;
  return { ok: true, proUntil: extend(p.proUntil, days, now), days };
}

export type ReferralCheck = { ok: true; inviterId: string } | { ok: false; status: number; error: string };

/** Whether this account can accept an invite (pure, for tests). */
export function checkReferral(o: { userId: string; createdAt: number; perks: Perks; code: string; now: number }): ReferralCheck {
  const inviterId = userIdFromCode(o.code);
  if (!inviterId) return { ok: false, status: 400, error: 'That invite link isn’t valid.' };
  if (inviterId === o.userId) return { ok: false, status: 400, error: 'You can’t use your own invite link.' };
  if (o.perks.referredBy) return { ok: false, status: 409, error: 'This account has already used an invite.' };
  if (o.now - o.createdAt > NEW_ACCOUNT_DAYS * DAY) return { ok: false, status: 409, error: 'Invite links are for new accounts.' };
  return { ok: true, inviterId };
}

async function setMeta(userId: string, meta: Record<string, unknown>) {
  const db = admin();
  if (!db) throw new Error('Accounts aren’t set up on the server.');
  const { error } = await db.auth.admin.updateUserById(userId, { app_metadata: meta });
  if (error) throw new Error(error.message);
}

export async function startTrial(user: { id: string; perks: Perks }, now = Date.now()): Promise<TrialResult> {
  const r = planTrial(user.perks, now);
  if (r.ok) await setMeta(user.id, { trial_used: true, pro_until: r.proUntil });
  return r;
}

/**
 * Accept an invite: the new account starts a 14-day trial (if it hasn't had one), and
 * the inviter gets 7 days, up to MAX_REFERRALS friends.
 */
export async function acceptInvite(user: { id: string; createdAt: number; perks: Perks }, code: string, now = Date.now()): Promise<{ ok: true; proUntil: number; days: number } | { ok: false; status: number; error: string }> {
  const check = checkReferral({ userId: user.id, createdAt: user.createdAt, perks: user.perks, code, now });
  if (!check.ok) return check;
  const db = admin();
  if (!db) return { ok: false, status: 503, error: 'Accounts aren’t set up on the server.' };
  const { data, error } = await db.auth.admin.getUserById(check.inviterId);
  if (error || !data.user) return { ok: false, status: 404, error: 'That invite link isn’t valid.' };

  // The new account.
  const mine = { ...user.perks, referredBy: check.inviterId };
  const trial = planTrial(mine, now);
  await setMeta(user.id, { referred_by: check.inviterId, ...(trial.ok && { trial_used: true, pro_until: trial.proUntil }) });

  // The inviter.
  const theirs = perksFrom(data.user.app_metadata);
  if (theirs.referrals < MAX_REFERRALS) {
    await setMeta(check.inviterId, { referrals: theirs.referrals + 1, reward_until: extend(theirs.rewardUntil, REFERRAL_DAYS, now) });
  }
  return trial.ok ? { ok: true, proUntil: trial.proUntil, days: trial.days } : { ok: true, proUntil: user.perks.proUntil, days: 0 };
}
