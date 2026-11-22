/**
 * Plus AI credits: a monthly allowance per billing cycle, spent per AI feature, plus a daily cap on
 * photo scans. Deducted on the server before the AI call (atomically), refunded if the call fails.
 * The allowance and costs are owner-editable (ai_config 'credits'); defaults below are provisional
 * until real costs per feature are measured (owner dashboard → AI costs).
 */
import { admin } from './accounts.js';

export interface CreditConfig {
  monthlyCredits: number;
  scansPerDay: number;
  costs: Record<string, number>;
}
export const DEFAULT_CREDITS: CreditConfig = {
  monthlyCredits: 300,
  scansPerDay: 4,
  costs: { scan: 2, menu: 2, label: 2, coach: 1, import: 2, recipe: 3, plan: 5, workout: 3, ideas: 1 },
};
/** Features that count as a photo scan for the daily cap. */
export const SCAN_FEATURES = new Set(['scan', 'menu', 'label']);

let cached: { at: number; cfg: CreditConfig } | null = null;

/** Only sane numbers are kept: anything else falls back to the default. */
export function cleanConfig(v: unknown): CreditConfig {
  const o = (v ?? {}) as Partial<CreditConfig>;
  const int = (x: unknown, d: number, max: number) => (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max ? (x as number) : d);
  const costs = { ...DEFAULT_CREDITS.costs };
  for (const k of Object.keys(costs)) costs[k] = int(o.costs?.[k], costs[k], 100);
  return { monthlyCredits: int(o.monthlyCredits, DEFAULT_CREDITS.monthlyCredits, 100000), scansPerDay: int(o.scansPerDay, DEFAULT_CREDITS.scansPerDay, 1000), costs };
}

export async function creditConfig(): Promise<CreditConfig> {
  if (cached && Date.now() - cached.at < 60_000) return cached.cfg;
  let cfg = DEFAULT_CREDITS;
  try {
    const { data } = await admin()!.from('ai_config').select('value').eq('key', 'credits').maybeSingle();
    if (data) cfg = cleanConfig(data.value);
  } catch { /* defaults */ }
  cached = { at: Date.now(), cfg };
  return cfg;
}

export async function saveCreditConfig(v: unknown): Promise<CreditConfig> {
  const cfg = cleanConfig(v);
  const { error } = await admin()!.from('ai_config').upsert({ key: 'credits', value: cfg, at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cached = { at: Date.now(), cfg };
  return cfg;
}

const addMonths = (t: number, n: number) => { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + n); return d.getTime(); };

/**
 * The current credit month. Paid plans: monthly windows that line up with the billing date (the pass
 * expiry), so credits refresh when the subscription renews. Trials and rewards: the calendar month.
 */
export function creditCycle(passExp: number | null, now = Date.now()): { start: number; end: number } {
  if (passExp && passExp > now) {
    let end = passExp;
    while (addMonths(end, -1) > now) end = addMonths(end, -1);
    return { start: addMonths(end, -1), end };
  }
  const d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return { start, end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) };
}

export const creditKey = (userId: string, cycleStart: number) => `credits:${userId}:${new Date(cycleStart).toISOString().slice(0, 10)}`;
export const scanDayKey = (userId: string, now = Date.now()) => `scanday:${userId}:${new Date(now).toISOString().slice(0, 10)}`;

/** Spend if it fits. New total used, -1 if not enough left, or null if the ledger isn't set up (never blocks). */
export async function spend(key: string, cost: number, limit: number): Promise<number | null> {
  try {
    const { data, error } = await admin()!.rpc('credit_spend', { p_key: key, p_cost: cost, p_limit: limit });
    return error ? null : (data as number);
  } catch { return null; }
}
export async function refund(key: string, cost: number) {
  try { await admin()!.rpc('credit_refund', { p_key: key, p_cost: cost }); } catch { /* ignore */ }
}
export async function usedNow(key: string): Promise<number> {
  try { const { data } = await admin()!.from('ai_credits').select('used').eq('key', key).maybeSingle(); return (data?.used as number) ?? 0; } catch { return 0; }
}
