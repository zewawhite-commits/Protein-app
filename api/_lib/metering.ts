/**
 * AI cost metering and fair-use protection.
 *
 *  - Every AI call is recorded with the model's own token counts and its cost in US$ (ai_usage),
 *    by feature, so the owner dashboard shows real spend, not estimates.
 *  - Throttling: more than BURST_PER_MIN AI requests a minute (or BURST_PER_10MIN in ten minutes)
 *    from one account is bot-like; the person is asked to slow down for a moment. Applies to every plan.
 *  - Duplicates: the same request from the same account within DUP_SECONDS is answered once.
 *  - Plus has generous daily limits (CEILING, published in the Terms), far above normal personal use.
 *    Crossing a review threshold (REVIEW) only creates an alert for the owner. People hear about a limit
 *    only when they reach it.
 * Every check fails open: if the counters are unavailable, people are never blocked by mistake.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { admin } from './accounts.js';

/** US$ per million tokens (input, output, cache read). Cache writes are 1.25 × input. */
export const PRICES: Record<string, { in: number; out: number; cacheRead: number }> = {
  'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { in: 2, out: 10, cacheRead: 0.1 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, cacheRead: 0.01 },
};

export interface Usage { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }

export function costOf(model: string, u: Usage): number {
  const p = PRICES[model] ?? PRICES['claude-opus-5-5'];
  const n = (x?: number | null) => x ?? 0;
  return (n(u.input_tokens) * p.in + n(u.output_tokens) * p.out + n(u.cache_read_input_tokens) * p.cacheRead + n(u.cache_creation_input_tokens) * p.in * 1.25) / 1e6;
}

export type AiFeature = 'scan' | 'menu' | 'label' | 'coach' | 'import' | 'recipe' | 'plan' | 'workout' | 'ideas';
export interface Caller { userId: string; tier: string; device?: string | null }

export const BURST_PER_MIN = 12;
export const BURST_PER_10MIN = 80;
export const DUP_SECONDS = 15;
/** Per day, per account. REVIEW: owner gets an alert. CEILING: AI pauses until tomorrow (bulk/automated use). */
export const REVIEW: Partial<Record<AiFeature, number>> = { scan: 25, menu: 7, coach: 75, import: 10, recipe: 10, plan: 5, workout: 5, ideas: 15 };
/** A second, louder alert level for the owner (paid use is capped by the monthly credits). */
export const CEILING: Partial<Record<AiFeature, number>> = { scan: 50, menu: 15, coach: 150, import: 20, recipe: 20, plan: 10, workout: 10, ideas: 30 };

async function record(feature: AiFeature, who: Caller, model: string, u: Usage | undefined) {
  if (!u) return;
  try {
    await admin()?.from('ai_usage').insert({
      user_id: who.userId, feature, tier: who.tier, model,
      input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0,
      cache_read: u.cache_read_input_tokens ?? 0, cache_write: u.cache_creation_input_tokens ?? 0,
      cost_usd: Number(costOf(model, u).toFixed(6)), device: who.device?.slice(0, 64) ?? null,
    });
  } catch { /* metering never breaks a reply */ }
}

/** An Anthropic client whose calls are metered under `feature` for this caller. */
export function aiClient(feature: AiFeature, who: Caller | null): Anthropic {
  const client = new Anthropic({ maxRetries: 3 });
  if (!who) return client;
  const wrap = (msgs: { create: (...a: never[]) => unknown; stream?: (...a: never[]) => unknown }) => {
    const create = msgs.create.bind(msgs) as (body: { model: string; stream?: boolean }, opts?: unknown) => Promise<unknown>;
    (msgs as { create: unknown }).create = async (body: { model: string; stream?: boolean }, opts?: unknown) => {
      const r = await create(body, opts);
      // The model that actually answered (a refusal fallback can answer on another model).
      if (!body.stream) await record(feature, who, (r as { model?: string }).model ?? body.model, (r as { usage?: Usage }).usage);
      return r;
    };
    if (msgs.stream) {
      const stream = msgs.stream.bind(msgs) as (body: { model: string }, opts?: unknown) => { finalMessage: () => Promise<{ usage?: Usage }> };
      (msgs as { stream: unknown }).stream = (body: { model: string }, opts?: unknown) => {
        const s = stream(body, opts);
        s.finalMessage().then((m) => record(feature, who, (m as { model?: string }).model ?? body.model, m.usage)).catch(() => undefined);
        return s;
      };
    }
  };
  wrap(client.messages as never);
  wrap(client.beta.messages as never);
  return client;
}

/** One hit on a short-lived counter; null when counters aren't available (then nothing is blocked). */
export async function hit(key: string, ttlSeconds: number): Promise<number | null> {
  try {
    const { data, error } = await admin()!.rpc('ai_hit', { p_key: key, p_ttl: ttlSeconds });
    return error ? null : (data as number);
  } catch { return null; }
}

export async function alert(userId: string, kind: string, detail: string) {
  console.warn(`[fair-use] ${kind} ${userId} ${detail}`);
  try { await admin()?.from('ai_alerts').insert({ user_id: userId, kind, detail }); } catch { /* ignore */ }
}

export type Verdict = { ok: true } | { ok: false; status: number; error: string };

/** Throttling and fair use, before an AI call. `today` is YYYY-MM-DD (UTC). */
export async function fairUse(feature: AiFeature, who: Caller, paid: boolean, today = new Date().toISOString().slice(0, 10)): Promise<Verdict> {
  const minute = Math.floor(Date.now() / 60000), tenMin = Math.floor(Date.now() / 600000);
  const [perMin, per10] = await Promise.all([hit(`b1:${who.userId}:${minute}`, 90), hit(`b10:${who.userId}:${tenMin}`, 700)]);
  if ((perMin ?? 0) > BURST_PER_MIN || (per10 ?? 0) > BURST_PER_10MIN) {
    if ((perMin ?? 0) === BURST_PER_MIN + 1 || (per10 ?? 0) === BURST_PER_10MIN + 1) await alert(who.userId, 'burst', `${perMin}/min, ${per10}/10min (${feature})`);
    return { ok: false, status: 429, error: 'That’s a lot of requests in a short time. Please wait a minute and try again.' };
  }
  if (!paid) return { ok: true }; // Free has its own small daily allowance (quota.ts).
  const day = await hit(`d:${feature}:${who.userId}:${today}`, 26 * 3600);
  if (day == null) return { ok: true };
  if (day === (REVIEW[feature] ?? Infinity) + 1) await alert(who.userId, `daily:${feature}`, `${day} today`);
  if (day === (CEILING[feature] ?? Infinity) + 1) await alert(who.userId, `heavy:${feature}`, `${day} today`);
  return { ok: true };
}

/** True if this exact request arrived from this account in the last few seconds (answered once). */
export async function isDuplicate(userId: string, payload: string): Promise<boolean> {
  const h = createHash('sha256').update(payload).digest('hex').slice(0, 32);
  const n = await hit(`dup:${userId}:${h}`, DUP_SECONDS);
  return (n ?? 1) > 1;
}

/** Key for a saved answer: this account + exactly what was sent. */
export const cacheKey = (userId: string, kind: string, payload: string) => `${kind}:${userId}:${createHash('sha256').update(payload).digest('hex').slice(0, 40)}`;

/** A saved answer for an identical request, if it hasn't expired. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const { data } = await admin()!.from('ai_cache').select('value, expires').eq('key', key).maybeSingle();
    return data && new Date(data.expires as string).getTime() > Date.now() ? (data.value as T) : null;
  } catch { return null; }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  try {
    await admin()?.from('ai_cache').upsert({ key, value, expires: new Date(Date.now() + ttlSeconds * 1000).toISOString() });
    if (Math.random() < 0.01) await admin()?.from('ai_cache').delete().lt('expires', new Date().toISOString());
  } catch { /* caching is optional */ }
}

/** A failed or refused request after credits were spent: give them back, then answer. */
export async function refundOnError(g: { refund?: () => Promise<void> } | null | undefined, r: Response): Promise<Response> {
  if (r.status >= 400) await g?.refund?.();
  return r;
}
