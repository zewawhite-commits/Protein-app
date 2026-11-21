/**
 * GET /api/premium/health → { ai: 'ok' | 'missing-key' | 'error', detail?, checkedAt }
 * A quick "is the AI working?" check for the owner: sends Claude a one-word request with
 * the server's key. To keep costs negligible and stop abuse, a real check runs at most once
 * every 10 minutes per server; in between, the last result is returned.
 */
import Anthropic from '@anthropic-ai/sdk';
import { json } from '../_lib/premium.js';
import { RECOGNITION_MODEL } from '../../src/lib/recognition.js';

let last: { at: number; body: Record<string, unknown> } | null = null;
const EVERY = 10 * 60_000;

export async function GET(): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ ai: 'missing-key', detail: 'ANTHROPIC_API_KEY is not set on this deployment.', checkedAt: new Date().toISOString() });
  if (last && Date.now() - last.at < EVERY) return json({ ...last.body, cached: true });
  let body: Record<string, unknown>;
  try {
    const r = await new Anthropic({ maxRetries: 3 }).messages.create({
      model: RECOGNITION_MODEL,
      max_tokens: 256,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    });
    const text = r.content.find((b) => b.type === 'text');
    body = { ai: 'ok', model: r.model, reply: text && text.type === 'text' ? text.text.slice(0, 20) : '', checkedAt: new Date().toISOString() };
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    const why =
      status === 401 ? 'The key was rejected — check it was copied fully, or make a new one.'
      : status === 400 && /credit|balance|billing/i.test((e as Error).message) ? 'The key works but there is no credit — buy credit in Billing.'
      : status === 403 ? 'The key is not allowed to use this model or region.'
      : status === 429 ? 'Rate limited — try again in a minute.'
      : `Request failed (${status ?? 'network'}).`;
    console.error('[health]', status, (e as Error).message);
    body = { ai: 'error', detail: why, status: status ?? null, checkedAt: new Date().toISOString() };
  }
  last = { at: Date.now(), body };
  return json(body);
}
