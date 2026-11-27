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

export interface Variants { skin: { meatOnly?: Food; withSkin?: Food }; methods: { method: string; food: Food }[]; current: { part: string; skin: boolean; method: string }; parts: { part: string; food: Food }[] }

// The survey records: "Chicken drumstick, fried, coated, skin / coating eaten, from raw".
const FN = /^Chicken (breast|thigh|drumstick|wing|leg), (?:drumstick and thigh, )?(.+?)(?:, (skin(?: \/ coating)? (not )?eaten|prepared skinless, coating eaten))?(?:, from (raw|pre-cooked|fast food(?: \/ restaurant)?))?$/;
const FN_METHODS: [string, RegExp][] = [['Roasted', /^baked, broiled, or roasted|^baked or broiled$/], ['Grilled', /^grilled without sauce/], ['Grilled with sauce', /^grilled with sauce/], ['Fried', /^fried, coated/], ['Baked, coated', /^baked, coated/], ['Stewed', /^stewed/], ['Rotisserie', /^rotisserie/], ['Sautéed', /^sauteed/]];
interface Fn { part: string; method: string; skin: boolean; from: string }
function parseFn(name: string): Fn | null {
  const m = FN.exec(name);
  if (!m) return null;
  const method = FN_METHODS.find(([, re]) => re.test(m[2]))?.[0];
  if (!method) return null;
  return { part: m[1], method, skin: m[3] ? !m[4] && !/skinless/.test(m[3]) : true, from: m[5] ?? '' };
}

const PARTS = ['breast', 'thigh', 'drumstick', 'wing', 'leg'] as const;

/** The same way of cooking for each other chicken part, so "drumstick" or "wing" always gives that part's own values. */
function otherParts(cur: { part: string; skin: boolean; method: string }, all: Food[], isSr: boolean): { part: string; food: Food }[] {
  const out: { part: string; food: Food }[] = [];
  for (const part of PARTS) {
    let best: Food | undefined; let score = -1;
    for (const f of all) {
      const p = isSr ? parsePoultry(f.name) : parseFn(f.name);
      if (!p || p.part !== part) continue;
      const sc = (p.method.toLowerCase() === cur.method.toLowerCase() ? 4 : 0) + (p.skin === cur.skin ? 2 : 0) + ('from' in p && (p as Fn).from === 'raw' ? 1 : 0);
      if (sc > score) { score = sc; best = f; }
    }
    if (best) out.push({ part, food: best });
  }
  return out.length > 1 ? out : [];
}

export function poultryVariants(food: Food, all: Food[]): Variants | null {
  const fn = parseFn(food.name);
  if (fn) {
    const same = all.map((f) => ({ f, p: parseFn(f.name) })).filter((x): x is { f: Food; p: Fn } => !!x.p && x.p.part === fn.part);
    const pick = (skin: boolean, method: string) => {
      const c = same.filter((x) => x.p.skin === skin && x.p.method === method);
      return (c.find((x) => x.p.from === fn.from) ?? c.find((x) => x.p.from === 'raw') ?? c[0])?.f;
    };
    const methods = FN_METHODS.map(([m]) => ({ method: m, food: pick(fn.skin, m) })).filter((x): x is { method: string; food: Food } => !!x.food);
    return { skin: { meatOnly: pick(false, fn.method), withSkin: pick(true, fn.method) }, methods, current: fn, parts: otherParts(fn, all, false) };
  }
  const whole = /^Chicken, broilers or fryers, (meat only|meat and skin), (raw|cooked, (roasted|fried|stewed))/.exec(food.name);
  const uk = /^Chicken, whole, (?:corn-fed, )?(raw|roasted), (meat and skin|meat only|meat)$/.exec(food.name);
  if (whole || uk) {
    const cur = whole ? { part: 'whole', skin: whole[1] === 'meat and skin', method: whole[2] === 'raw' ? 'raw' : whole[3] } : { part: 'whole', skin: uk![2] === 'meat and skin', method: uk![1] };
    const parts = otherParts(cur, all, true);
    return parts.length ? { skin: {}, methods: [], current: cur, parts } : null;
  }
  const cur = parsePoultry(food.name);
  if (!cur) return null;
  const same = all.map((f) => ({ f, p: parsePoultry(f.name) })).filter((x): x is { f: Food; p: Poultry } => !!x.p && x.p.part === cur.part);
  const pick = (skin: boolean, method: Poultry['method']) =>
    same.find((x) => x.p.skin === skin && x.p.method === method && (x.p.coating ?? '') === (method === 'fried' && skin ? cur.coating ?? 'flour' : ''))?.f
    ?? same.find((x) => x.p.skin === skin && x.p.method === method)?.f;
  const methods = (['raw', 'roasted', 'fried', 'stewed'] as const).map((m) => ({ method: m, food: pick(cur.skin, m) })).filter((x): x is { method: Poultry['method']; food: Food } => !!x.food);
  return { skin: { meatOnly: pick(false, cur.method), withSkin: pick(true, cur.method) }, methods, current: cur, parts: otherParts(cur, all, true) };
}

/** What to weigh, in plain words, from the record itself. */
export function weighGuide(name: string): string {
  const n = name.toLowerCase();
  if (/with bone|bone-in|weighed with/.test(n)) return 'Enter the weight of the whole piece, including the bone.';
  if (/coating not eaten/.test(n)) return 'Weigh the meat only, without bones, skin or coating.';
  if (/skinless, coating eaten/.test(n)) return 'Weigh the meat with its coating, without the bones.';
  if (/coating eaten|with breading|battered|breaded/.test(n)) return 'Weigh the meat with its skin and coating, without the bones.';
  if (/meat and skin|skin eaten|with skin/.test(n)) return 'Weigh the meat and skin together, without the bones.';
  if (/meat only|skinless|skin not eaten|without skin/.test(n)) return 'Weigh the meat only, without bones or skin.';
  if (/\b(chicken|turkey|duck|beef|pork|lamb|goat|mutton|fish|tilapia|catfish|mackerel|salmon|cod)\b/.test(n)) return 'Weigh what you ate, without bones.';
  if (/\b(bananas?|oranges?|mangos?|mangoes|plantains?|avocados?|pineapples?|melons?|apples?|pears?|peach(?:es)?|papayas?|pawpaws?|tangerines?|limes?|lemons?)\b/.test(n)) return 'Weigh the part you ate, without peel, core or stones.';
  if (/\b(shrimp|prawn|crab|lobster|snail|periwinkle|egg)\b/.test(n)) return 'Weigh the part you ate, without shells.';
  return 'Weigh what you ate.';
}
