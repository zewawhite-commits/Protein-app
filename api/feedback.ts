/**
 * POST /api/feedback { items: [{ aiName, localName?, cuisine?, chosenFoodId, chosenName, rank, kind }] }
 * Anonymous record of which database entry people chose for an AI-recognised food.
 * Stored for human review to improve food coverage — never treated as verified data.
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; otherwise accepted and dropped.
 */
import { createClient } from '@supabase/supabase-js';
import { json } from './_lib/premium';
import { supabaseServiceKey, supabaseUrl } from './_lib/accounts';

interface Item { aiName: string; localName?: string; cuisine?: string; chosenFoodId: string; chosenName: string; rank: number; kind: 'item' | 'ingredient' }

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : null);

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { items?: Item[] } | null;
  const items = Array.isArray(body?.items) ? body!.items.slice(0, 20) : [];
  if (!items.length) return json({ error: 'Nothing to record.' }, 400);
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) return json({ stored: 0 });
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
  return error ? json({ error: 'Could not store feedback.' }, 500) : json({ stored: rows.length });
}
