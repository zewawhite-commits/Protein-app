/**
 * Plan limits for every AI feature, enforced on the server so they can't be bypassed.
 *
 *   free: 3 photo scans and 5 coach messages a day; 2 AI recipes and 1 meal plan a month; no AI workouts
 *         or meal ideas. Recipe imports are unlimited for everyone (burst throttle only, no credits).
 *   plus / trial / reward: 300 AI credits per billing month (credits.ts, owner-editable), up to 4 photo
 *         scans a day, and monthly caps per feature (120 scans, 12 AI recipes, 8 workouts, 4 meal plans).
 *   reward: invite rewards — Plus features, coach at the Free daily allowance.
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
import { capGroup, capKey, creditConfig, creditCycle, creditKey, refund, scanDayKey, SCAN_FEATURES, spend, usedNow } from './credits.js';

export type Feature = 'scan' | 'coach' | 'workout' | 'recipe' | 'plan' | 'ideas' | 'menu' | 'import';
export type PlanTier = 'free' | 'plus' | 'pro' | 'trial' | 'reward';

// Plus is unlimited for personal use: these are counters, not caps. Fair use (bots, bulk, sharing)
// is handled by metering.ts with throttling, review alerts and a published far-out ceiling.
const FAIR_USE = 1_000_000;

/** Free limits reset every day (UTC); paid plans count per month. */
const DAILY: Record<PlanTier, boolean> = { free: true, plus: false, pro: false, trial: false, reward: false };
/** Free features counted per month instead of per day. */
const FREE_MONTHLY = new Set(['recipe', 'plan', 'workout']);
const today = () => new Date().toISOString().slice(0, 10);
const daily = (feature: string, tier: PlanTier) => (DAILY[tier] && !FREE_MONTHLY.has(feature)) || (tier === 'reward' && feature === 'coach');
/** The counter for this feature: per day on Free (AI recipes and plans per month), per month otherwise. */
export const usageKey = (feature: string, userId: string, tier: PlanTier) => (daily(feature, tier) ? `${feature}:${userId}:${today()}` : `${feature}:${userId}`);

const DEFAULTS: Record<PlanTier, Record<Feature, number>> = {
  free: { scan: 3, coach: 5, workout: 0, recipe: 2, plan: 1, ideas: 0, menu: 0, import: FAIR_USE },
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

const NAMES: Record<Feature, string> = { scan: 'AI scans', coach: 'coach messages', workout: 'AI workout plans', recipe: 'AI recipes', plan: 'AI meal plans', ideas: 'AI meal ideas', menu: 'Restaurant menu scans', import: 'recipe imports' };
const ONE: Record<Feature, string> = { scan: 'AI scan', coach: 'coach message', workout: 'AI workout plan', recipe: 'AI recipe', plan: 'AI meal plan', ideas: 'AI meal idea', menu: 'Restaurant menu scan', import: 'recipe import' };

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

export interface Allowed { ok: true; tier: PlanTier; left: number; limit: number; who: Caller; /** Give back what this request spent (the AI call failed). */ refund?: () => Promise<void>; credits?: { left: number; total: number } }
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
  return { user, tier, pass, paid, expired: !!pass && pass.exp <= Date.now() };
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
  // Paid plans (and the trial / invite rewards): a monthly AI credit allowance plus a daily photo-scan cap.
  if (tier !== 'free' && !(tier === 'reward' && feature === 'coach')) return spendCredits(feature, caller, who.paid?.exp ?? null, count);
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
      const n = limit === 1 ? ONE[feature] : NAMES[feature];
      const when = daily(feature, tier) ? 'for today. More tomorrow' : 'for this month. More on the 1st';
      return { ok: false, status: 402, body: { error: tier === 'reward' ? `You’ve used your ${limit} ${n} ${when}.` : `You’ve used your ${limit} free ${n} ${when}, or get more with Plus.`, premium: true, limitReached: true, feature, tier } };
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

const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Deduct this feature's credits (and a daily photo scan) for a paid plan, atomically, before the AI call. */
async function spendCredits(feature: Feature, who: Caller, passExp: number | null, count = 1): Promise<Allowed | Denied> {
  const cfg = await creditConfig();
  const cost = (cfg.costs[feature] ?? 1) * count;
  const cycle = creditCycle(passExp);
  const ck = creditKey(who.userId, cycle.start);
  // Free of credits (recipe imports): nothing to count.
  if (cost === 0 && !SCAN_FEATURES.has(feature)) return { ok: true, tier: who.tier as PlanTier, left: Infinity, limit: Infinity, who };
  let dayKey: string | null = null;
  let capK: string | null = null;
  if (SCAN_FEATURES.has(feature)) {
    dayKey = scanDayKey(who.userId);
    const day = await spend(dayKey, count, cfg.scansPerDay);
    if (day === -1) {
      const left = Math.max(0, cfg.monthlyCredits - (await usedNow(ck)));
      return { ok: false, status: 429, body: { error: `You’ve used today’s ${cfg.scansPerDay} photo scans. More tomorrow. You still have ${left} AI credits for the coach and recipes, and logging by search, barcode or voice always works.`, limitReached: true, scanDay: true, feature, tier: who.tier } };
    }
    if (day == null) dayKey = null; // ledger not set up: never block
  }
  // Monthly cap for this feature (inside the credits).
  const cap = cfg.monthlyCaps[capGroup(feature)];
  if (cap) {
    capK = capKey(feature, who.userId, cycle.start);
    const n = await spend(capK, count, cap);
    if (n === -1) {
      if (dayKey) await refund(dayKey, count);
      const g = capGroup(feature) as Feature;
      return { ok: false, status: 429, body: { error: `You’ve used this month’s ${cap} ${cap === 1 ? ONE[g] : NAMES[g]}. More on ${fmtDate(cycle.end)}. Your other AI features and all logging keep working.`, limitReached: true, monthlyCap: true, resetsAt: cycle.end, feature, tier: who.tier } };
    }
    if (n == null) capK = null;
  }
  const used = await spend(ck, cost, cfg.monthlyCredits);
  if (used === -1) {
    if (dayKey) await refund(dayKey, count);
    if (capK) await refund(capK, count);
    return { ok: false, status: 402, body: { error: `You’ve used this month’s ${cfg.monthlyCredits} AI credits. They refresh on ${fmtDate(cycle.end)}. Logging, search, barcode, voice and saved meals keep working.`, limitReached: true, creditsOut: true, resetsAt: cycle.end, feature, tier: who.tier } };
  }
  const left = used == null ? cfg.monthlyCredits : cfg.monthlyCredits - used;
  return {
    ok: true, tier: who.tier as PlanTier, left: Infinity, limit: Infinity, who,
    credits: { left, total: cfg.monthlyCredits },
    refund: async () => { if (used != null) await refund(ck, cost); if (dayKey) await refund(dayKey, count); if (capK) await refund(capK, count); },
  };
}

/** Credit balance for Profile (paid plans only). */
export async function creditBalance(request: Request) {
  const { user, tier, paid } = await whoIs(request);
  if (!user || tier === 'free') return null;
  const cfg = await creditConfig();
  const cycle = creditCycle(paid?.exp ?? null);
  const used = await usedNow(creditKey(user.id, cycle.start));
  const scansToday = await usedNow(scanDayKey(user.id));
  return { total: cfg.monthlyCredits, used, left: Math.max(0, cfg.monthlyCredits - used), resetsAt: cycle.end, costs: cfg.costs, scansPerDay: cfg.scansPerDay, scansToday, monthlyCaps: cfg.monthlyCaps };
}
