/**
 * Plan limits for every AI feature, enforced on the server so they can't be bypassed.
 *
 *            scan  coach  workout  recipe  plan  ideas   (per calendar month, UTC)
 *   free       3      5      0        0      0     0     + 1 recipe import a day
 *   plus / trial / reward: generous daily fair-use limits (metering.ts CEILING, published in the Terms):
 *              50 photo scans, 150 coach messages, 20 recipe imports, 20 AI recipes, 10 plans, 10 workouts, 30 ideas a day
 *   reward    ∞      5      ∞        ∞      ∞     ∞     invite rewards: Plus features, coach at the Free allowance (per day)
 *   (Free limits are per day; the others per month.)
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
import { fairUse, type AiFeature, type Caller } from './metering.js';

export type Feature = 'scan' | 'coach' | 'workout' | 'recipe' | 'plan' | 'ideas' | 'menu' | 'import';
export type PlanTier = 'free' | 'plus' | 'pro' | 'trial' | 'reward';

// Plus is unlimited for personal use: these are counters, not caps. Fair use (bots, bulk, sharing)
// is handled by metering.ts with throttling, review alerts and a published far-out ceiling.
const FAIR_USE = 1_000_000;

/** Free limits reset every day (UTC); paid plans count per month. */
const DAILY: Record<PlanTier, boolean> = { free: true, plus: false, pro: false, trial: false, reward: false };
const today = () => new Date().toISOString().slice(0, 10);
/** The counter for this feature: per day on Free, per month otherwise. */
export const usageKey = (feature: string, userId: string, tier: PlanTier) => (DAILY[tier] || (tier === 'reward' && feature === 'coach') ? `${feature}:${userId}:${today()}` : `${feature}:${userId}`);

const DEFAULTS: Record<PlanTier, Record<Feature, number>> = {
  free: { scan: 3, coach: 5, workout: 0, recipe: 0, plan: 0, ideas: 0, menu: 0, import: 1 },
  // There is only one paid plan now (Plus); any older Plus subscription gets everything Plus has.
  plus: { scan: FAIR_USE, coach: FAIR_USE * 3, workout: FAIR_USE, recipe: FAIR_USE, plan: FAIR_USE, ideas: FAIR_USE, menu: FAIR_USE, import: FAIR_USE },
  pro: { scan: FAIR_USE, coach: FAIR_USE * 3, workout: FAIR_USE, recipe: FAIR_USE, plan: FAIR_USE, ideas: FAIR_USE, menu: FAIR_USE, import: FAIR_USE },
  // The 3-day Plus trial: everything Plus has (same daily fair-use limits).
  trial: { scan: FAIR_USE, coach: FAIR_USE * 3, workout: FAIR_USE, recipe: FAIR_USE, plan: FAIR_USE, ideas: FAIR_USE, menu: FAIR_USE, import: FAIR_USE },
  // Days earned by inviting friends: Plus features, coach at the Free daily allowance.
  reward: { scan: FAIR_USE, coach: 5, workout: FAIR_USE, recipe: FAIR_USE, plan: FAIR_USE, ideas: FAIR_USE, menu: FAIR_USE, import: FAIR_USE },
};

/** Limits at or above this are shown as "Unlimited" (a fair-use cap, ~30 a day). */
export const UNLIMITED = 900;

const NAMES: Record<Feature, string> = { scan: 'AI scans', coach: 'coach messages', workout: 'workout guides', recipe: 'AI recipes', plan: 'eating plans', ideas: 'AI meal ideas', menu: 'Restaurant menu scans', import: 'recipe imports' };

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

export interface Allowed { ok: true; tier: PlanTier; left: number; limit: number; who: Caller }
export interface Denied { ok: false; status: number; body: Record<string, unknown> }

/** Who is calling and what plan they're on (no counting). */
export async function whoIs(request: Request) {
  const user = await userFromToken(request.headers.get('x-user-token'));
  const pass = readPass(bearer(request));
  // A paid pass works only for the account it was bought for (by account id; older passes by email).
  const owns = !!pass && !!user && (pass.uid ? pass.uid === user.id : pass.email?.toLowerCase() === user.email.toLowerCase());
  const paid = pass && pass.exp > Date.now() && owns ? pass : null;
  const freePro = !!user && user.perks.proUntil > Date.now();
  const reward = !!user && (user.perks.rewardUntil ?? 0) > Date.now();
  const tier: PlanTier = paid ? (paid.tier === 'pro' ? 'pro' : 'plus') : freePro ? 'trial' : reward ? 'reward' : 'free';
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
  const device = request.headers.get('x-device-id');
  if (isAdmin(user.email)) return { ok: true, tier: 'pro', left: Infinity, limit: Infinity, who: { userId: user.id, tier: 'admin', device } };
  // New accounts get their free Plus trial automatically on their first AI use, so every
  // feature works straight away (once per account; afterwards the Free limits apply).
  if (tier === 'free' && !user.perks.trialUsed && process.env.AUTO_TRIAL !== 'off') {
    try {
      const { startTrial } = await import('./perks.js');
      const r = await startTrial(user);
      if (r.ok) { tier = 'trial'; user.perks.trialUsed = true; user.perks.proUntil = r.proUntil; }
    } catch { /* keep the Free limits */ }
  }

  const caller: Caller = { userId: user.id, tier, device };
  // Throttling for everyone; fair-use review and far-out ceiling for unlimited (paid) use.
  const fair = await fairUse(feature as AiFeature, caller, tier !== 'free');
  if (!fair.ok) return { ok: false, status: fair.status, body: { error: fair.error, fairUse: true, feature, tier } };
  const limit = limitFor(tier, feature);
  if (limit <= 0) {
    return { ok: false, status: 402, body: { error: `${NAMES[feature][0].toUpperCase()}${NAMES[feature].slice(1)} come with Plus.`, premium: true, feature, tier, renew: expired } };
  }
  try {
    let left = 0;
    for (let i = 0; i < count; i++) {
      left = await useScan(usageKey(feature, user.id, tier), limit);
      if (left < 0) break;
    }
    if (left < 0) {
      return { ok: false, status: 402, body: { error: tier === 'plus' ? `You’ve used your ${limit} ${NAMES[feature]} for now.` : tier === 'reward' ? `You’ve used your ${limit} ${NAMES[feature]} for today. They reset tomorrow, or upgrade to Plus for unlimited.` : `You’ve used your ${limit} free ${limit === 1 ? NAMES[feature].replace(/s$/, '') : NAMES[feature]} for today. They reset tomorrow, or upgrade to Plus for unlimited.`, premium: true, limitReached: true, feature, tier } };
    }
    return { ok: true, tier, left, limit, who: caller };
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
    const { data } = await db.from('scan_usage').select('subscriber, scans').eq('month', month).in('subscriber', features.map((f) => usageKey(f, user.id, tier)));
    for (const r of data ?? []) used[String(r.subscriber).split(':')[0]] = r.scans as number;
  }
  const unlimited = isAdmin(user.email);
  const { inviteCode, MAX_REFERRALS, REFERRAL_DAYS } = await import('./perks.js');
  return {
    tier: unlimited || tier === 'trial' ? 'pro' : tier === 'reward' ? 'plus' : tier,
    admin: unlimited,
    // Free Plus time (trial or invite rewards), and what the invite card needs.
    perks: { proUntil: Math.max(user.perks.proUntil, user.perks.rewardUntil ?? 0), freePro: tier === 'trial' || tier === 'reward', trialUsed: user.perks.trialUsed, referrals: user.perks.referrals, maxReferrals: MAX_REFERRALS, referralDays: REFERRAL_DAYS, code: inviteCode(user.id) },
    // null = unlimited (admins, or a fair-use cap on paid plans).
    features: Object.fromEntries(features.map((f) => { const l = limitFor(tier, f); return [f, { used: used[f] ?? 0, limit: unlimited || l >= UNLIMITED ? null : l }]; })),
  };
}
