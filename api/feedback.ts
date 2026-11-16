/**
 * POST /api/feedback
 *  - { items: [{ aiName, localName?, cuisine?, chosenFoodId, chosenName, rank, kind }] }
 *    Which database entry a signed-in person chose for an AI-recognised food. Stored for
 *    review and used to put the right record first next time (api/_lib/popular.ts).
 *    Needs a signed-in account (x-user-token), so it can't be spammed anonymously.
 *  - { type: 'error', message, stack?, path? }
 *    An app crash report. Written to the server log (Vercel → Logs), never stored with
 *    anything about the person.
 */
import { createClient } from '@supabase/supabase-js';
import { json } from './_lib/premium.js';
import { supabaseServiceKey, supabaseUrl, userFromToken } from './_lib/accounts.js';

interface Item { aiName: string; localName?: string; cuisine?: string; chosenFoodId: string; chosenName: string; rank: number; kind: 'item' | 'ingredient' }

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : null);

// Best-effort limit per server instance: 30 requests a minute per address.
const hits = new Map<string, { n: number; t: number }>();
function limited(request: Request): boolean {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); if (hits.size > 5000) hits.clear(); return false; }
  h.n++;
  return h.n > 30;
}

export async function POST(request: Request): Promise<Response> {
  if (limited(request)) return json({ error: 'Too many requests.' }, 429);
  const body = (await request.json().catch(() => null)) as { items?: Item[]; type?: string; message?: unknown; stack?: unknown; path?: unknown } | null;

  if (body?.type === 'error') {
    console.error('[app-error]', JSON.stringify({ message: clip(body.message, 300), path: clip(body.path, 100), stack: clip(body.stack, 1500) }));
    return json({ ok: true });
  }

  const items = Array.isArray(body?.items) ? body!.items.slice(0, 20) : [];
  if (!items.length) return json({ error: 'Nothing to record.' }, 400);
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) return json({ stored: 0 });
  const user = await userFromToken(request.headers.get('x-user-token'));
  if (!user) return json({ error: 'Sign in first.', signIn: true }, 401);
  const rows = items
    .map((i) => ({
      ai_name: clip(i.aiName, 80), local_name: clip(i.localName, 80), cuisine: clip(i.cuisine, 40),
      chosen_food_id: clip(i.chosenFoodId, 60), chosen_name: clip(i.chosenName, 200),
      candidate_rank: Number.isInteger(i.rank) ? Math.max(-1, Math.min(20, i.rank)) : -1,
      kind: i.kind === 'ingredient' ? 'ingredient' : 'item',
    }))
    .filter((r) => r.ai_name && r.chosen_food_id);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.from('recognition_feedback').insert(rows);
  if (error) console.error('[feedback] insert failed:', error.message);
  return error ? json({ error: 'Could not store feedback.' }, 500) : json({ stored: rows.length });
}
