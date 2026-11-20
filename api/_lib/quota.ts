/**
 * Plan limits for every AI feature, enforced on the server so they can't be bypassed.
 *
 *            scan  coach  workout  recipe  plan  ideas   (per calendar month, UTC)
 *   free       3      5      0        0      0     0
 *   plus      ∞      ∞      ∞        ∞     30     ∞     ∞ = unlimited (with a hidden fair-use cap against abuse)
 *   pro       ∞      ∞      ∞        ∞      ∞     ∞     Pro: unlimited plans, smarter coach, advanced analysis & reports
 *   trial    60    100      4       15      3    30     free Pro time (trial, invite rewards): every Pro feature, capped
 *
 * Rules:
 *  - AI features need a signed-in account (x-user-token: Supabase access token).
 *  - The tier comes from a valid Premium pass (Authorization: Bearer <pass>); otherwise Free.
 *  - Limits apply even before payments are set up, so AI credit is protected from day one.
 *  - Emails in ADMIN_EMAILS (comma-separated) are unlimited, for testing.
 *  - Override any limit with env, e.g. LIMIT_FREE_SCAN=5, LIMIT_PRO_COACH=1000.
 */
import { bearer, readPass } from './premium.js';
import { accountsConfigured, useScan, userFromToken } from './accounts.js';

export type Feature = 'scan' | 'coach' | 'workout' | 'recipe' | 'plan' | 'ideas';
export type PlanTier = 'free' | 'plus' | 'pro' | 'trial';

const FAIR_USE = 900;

const DEFAULTS: Record<PlanTier, Record<Feature, number>> = {
  free: { scan: 3, coach: 5, workout: 0, recipe: 0, plan: 0, ideas: 0 },
  plus: { scan: FAIR_USE, coach: FAIR_USE * 3, workout: FAIR_USE, recipe: FAIR_USE, plan: 30, ideas: FAIR_USE },
  pro: { scan: FAIR_USE, coach: FAIR_USE * 3, workout: FAIR_USE, recipe: FAIR_USE, plan: FAIR_USE, ideas: FAIR_USE },
  trial: { scan: 60, coach: 100, workout: 4, recipe: 15, plan: 3, ideas: 30 },
};

/** Limits at or above this are shown as "Unlimited" (a fair-use cap, ~30 a day). */
export const UNLIMITED = 900;

const NAMES: Record<Feature, string> = { scan: 'AI scans', coach: 'coach messages', workout: 'workout guides', recipe: 'AI recipes', plan: 'eating plans', ideas: 'AI meal ideas' };

export function limitFor(tier: PlanTier, feature: Feature): number {
  const v = Number(process.env[`LIMIT_${tier.toUpperCase()}_${feature.toUpperCase()}`]);
  if (Number.isFinite(v) && v >= 0) return v;
  // Older settings for scans still apply.
  if (feature === 'scan' && tier !== 'trial') {
    const old = Number(tier === 'free' ? process.env.FREE_SCANS : tier === 'pro' ? process.env.SCAN_LIMIT_PRO : process.env.SCAN_LIMIT_PLUS);
    if (Number.isFinite(old) && old >= 0) return old;
  }
  return DEFAULTS[tier][feature];
}

export const isAdmin = (email: string) =>
  (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());

export interface Allowed { ok: true; tier: PlanTier; left: number; limit: number }
export interface Denied { ok: false; status: number; body: Record<string, unknown> }

/** Who is calling and what plan they're on (no counting). */
export async function whoIs(request: Request) {
  const user = await userFromToken(request.headers.get('x-user-token'));
  const pass = readPass(bearer(request));
  const paid = pass && pass.exp > Date.now() && (!pass.uid || !user || pass.uid === user.id) ? pass : null;
  const freePro = !!user && user.perks.proUntil > Date.now();
  const tier: PlanTier = paid ? (paid.tier === 'pro' ? 'pro' : 'plus') : freePro ? 'trial' : 'free';
  return { user, tier, pass, expired: !!pass && pass.exp <= Date.now() };
}

/** Check and count one use of a feature. */
export async function gate(request: Request, feature: Feature, count = 1): Promise<Allowed | Denied> {
  if (!accountsConfigured()) {
    return { ok: false, status: 503, body: { error: 'Accounts aren’t set up on the server yet, so AI features are off.' } };
  }
  const who = await whoIs(request);
  const { user, expired } = who;
  let { tier } = who;
  if (!user) return { ok: false, status: 401, body: { error: `Sign in to use ${NAMES[feature]}.`, signIn: true } };
  if (isAdmin(user.email)) return { ok: true, tier: 'pro', left: Infinity, limit: Infinity };
  // New accounts get their free Pro trial automatically on their first AI use, so every
  // feature works straight away (once per account; afterwards the Free limits apply).
  if (tier === 'free' && !user.perks.trialUsed && process.env.AUTO_TRIAL !== 'off') {
    try {
      const { startTrial } = await import('./perks.js');
      const r = await startTrial(user);
      if (r.ok) { tier = 'trial'; user.perks.trialUsed = true; user.perks.proUntil = r.proUntil; }
    } catch { /* keep the Free limits */ }
  }

  const limit = limitFor(tier, feature);
  if (limit <= 0) {
    return { ok: false, status: 402, body: { error: `${NAMES[feature][0].toUpperCase()}${NAMES[feature].slice(1)} come with Plus and Pro.`, premium: true, feature, tier, renew: expired } };
  }
  try {
    let left = 0;
    for (let i = 0; i < count; i++) {
      left = await useScan(`${feature}:${user.id}`, limit);
      if (left < 0) break;
    }
    if (left < 0) {
      if (limit >= UNLIMITED) return { ok: false, status: 429, body: { error: 'You’ve hit the fair-use limit for this month. It resets on the 1st — contact support if you need more.', limitReached: true, feature, tier } };
      return { ok: false, status: 402, body: { error: tier === 'plus' ? `You’ve used your ${limit} ${NAMES[feature]} this month. Pro has unlimited.` : `You’ve used your ${limit} free ${NAMES[feature]} this month. Upgrade to Plus for unlimited.`, premium: true, limitReached: true, feature, tier } };
    }
    return { ok: true, tier, left, limit };
  } catch (e) {
    return { ok: false, status: 503, body: { error: (e as Error).message } };
  }
}

/** This month's usage for the signed-in user (for the app to display). */
export async function usage(request: Request) {
  const { user, tier } = await whoIs(request);
  if (!user) return null;
  const features: Feature[] = ['scan', 'coach', 'workout', 'recipe', 'plan', 'ideas'];
  const month = new Date().toISOString().slice(0, 7);
  const { admin } = await import('./accounts.js');
  const db = admin();
  const used: Record<string, number> = {};
  if (db) {
    const { data } = await db.from('scan_usage').select('subscriber, scans').eq('month', month).in('subscriber', features.map((f) => `${f}:${user.id}`));
    for (const r of data ?? []) used[String(r.subscriber).split(':')[0]] = r.scans as number;
  }
  const unlimited = isAdmin(user.email);
  const { inviteCode, MAX_REFERRALS, REFERRAL_DAYS } = await import('./perks.js');
  return {
    tier: unlimited || tier === 'trial' ? 'pro' : tier,
    admin: unlimited,
    // Free Pro time (trial or invite rewards), and what the invite card needs.
    perks: { proUntil: user.perks.proUntil, freePro: tier === 'trial', trialUsed: user.perks.trialUsed, referrals: user.perks.referrals, maxReferrals: MAX_REFERRALS, referralDays: REFERRAL_DAYS, code: inviteCode(user.id) },
    // null = unlimited (admins, or a fair-use cap on paid plans).
    features: Object.fromEntries(features.map((f) => { const l = limitFor(tier, f); return [f, { used: used[f] ?? 0, limit: unlimited || l >= UNLIMITED ? null : l }]; })),
  };
}
