/**
 * "Most people picked this": turns recorded corrections (recognition_feedback) into a
 * preferred database record per AI food name. Only when enough people agree: at least
 * 3 picks and 60% of them for the same record.
 */
import { admin } from './accounts.js';
import { pickKey } from '../../src/lib/recognition.js';

export const MIN_VOTES = 3;
export const MIN_SHARE = 0.6;

export function popularFrom(rows: { ai_name: string; chosen_food_id: string }[]): Record<string, string> {
  const byName = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const k = pickKey(r.ai_name ?? '');
    if (!k || !r.chosen_food_id) continue;
    const m = byName.get(k) ?? new Map<string, number>();
    m.set(r.chosen_food_id, (m.get(r.chosen_food_id) ?? 0) + 1);
    byName.set(k, m);
  }
  const out: Record<string, string> = {};
  for (const [k, m] of byName) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const [id, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= MIN_VOTES && n / total >= MIN_SHARE) out[k] = id;
  }
  return out;
}

/** Preferred records for these AI names ({} when the database isn't set up or on any error). */
export async function popularPicks(names: string[]): Promise<Record<string, string>> {
  const db = admin();
  const list = [...new Set(names.filter(Boolean))].slice(0, 30);
  if (!db || !list.length) return {};
  try {
    const { data, error } = await db.from('recognition_feedback').select('ai_name, chosen_food_id').eq('kind', 'item').in('ai_name', list).order('id', { ascending: false }).limit(3000);
    return error || !data ? {} : popularFrom(data as { ai_name: string; chosen_food_id: string }[]);
  } catch {
    return {};
  }
}
