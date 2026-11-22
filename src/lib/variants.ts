/**
 * The same chicken cut in its other real database records: meat only vs meat and skin, and raw vs
 * each way of cooking. USDA lists every combination separately (different calories), so switching
 * swaps the record; nothing is estimated or adjusted.
 */
import type { Food } from './types';

const RE = /^Chicken, broilers or fryers, (breast|thigh|drumstick|leg|wing), (meat only|meat and skin), (raw|cooked, (roasted|fried|stewed)(?:, (batter|flour))?)$/;

export interface Poultry { part: string; skin: boolean; method: 'raw' | 'roasted' | 'fried' | 'stewed'; coating?: string }
export function parsePoultry(name: string): Poultry | null {
  const m = RE.exec(name);
  if (!m) return null;
  return { part: m[1], skin: m[2] === 'meat and skin', method: (m[3] === 'raw' ? 'raw' : m[4]) as Poultry['method'], coating: m[5] };
}

export interface Variants { skin: { meatOnly?: Food; withSkin?: Food }; methods: { method: Poultry['method']; food: Food }[]; current: Poultry }

export function poultryVariants(food: Food, all: Food[]): Variants | null {
  const cur = parsePoultry(food.name);
  if (!cur) return null;
  const same = all.map((f) => ({ f, p: parsePoultry(f.name) })).filter((x): x is { f: Food; p: Poultry } => !!x.p && x.p.part === cur.part);
  const pick = (skin: boolean, method: Poultry['method']) =>
    same.find((x) => x.p.skin === skin && x.p.method === method && (x.p.coating ?? '') === (method === 'fried' && skin ? cur.coating ?? 'flour' : ''))?.f
    ?? same.find((x) => x.p.skin === skin && x.p.method === method)?.f;
  const methods = (['raw', 'roasted', 'fried', 'stewed'] as const).map((m) => ({ method: m, food: pick(cur.skin, m) })).filter((x): x is { method: Poultry['method']; food: Food } => !!x.food);
  return { skin: { meatOnly: pick(false, cur.method), withSkin: pick(true, cur.method) }, methods, current: cur };
}

/** What to weigh, in plain words, from the record itself. */
export function weighGuide(name: string): string {
  const n = name.toLowerCase();
  if (/with bone|bone-in|weighed with/.test(n)) return 'Enter the weight of the whole piece, including the bone.';
  if (/meat and skin|skin eaten|with skin/.test(n)) return 'Weigh the meat and skin together, without the bones.';
  if (/meat only|skinless|skin not eaten|without skin/.test(n)) return 'Weigh the meat only, without bones or skin.';
  if (/\b(chicken|turkey|duck|beef|pork|lamb|goat|mutton|fish|tilapia|catfish|mackerel|salmon|cod)\b/.test(n)) return 'Weigh what you ate, without bones.';
  if (/\b(bananas?|oranges?|mangos?|mangoes|plantains?|avocados?|pineapples?|melons?|apples?|pears?|peach(?:es)?|papayas?|pawpaws?|tangerines?|limes?|lemons?)\b/.test(n)) return 'Weigh the part you ate, without peel, core or stones.';
  if (/\b(shrimp|prawn|crab|lobster|snail|periwinkle|egg)\b/.test(n)) return 'Weigh the part you ate, without shells.';
  return 'Weigh what you ate.';
}
