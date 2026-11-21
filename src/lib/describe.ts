/**
 * Reads what people type or say ("2 boiled eggs and a cup of rice, 3 chicken wings") into foods
 * and amounts, on the phone, with no AI. Used for Describe and voice logging.
 *
 * Amounts are only worked out from things we know: grams/oz/ml, or the food's own serving
 * sizes from the database (1 wing, 1 slice, 1 cup). When a count is given but the food has no
 * matching serving ("3 pieces" of something with no piece size), the amount is left for the
 * person to fill in rather than guessed.
 */
import type { Food } from './types';
import type { RecognitionResult } from './recognition';

export interface SaidFood { text: string; qty: number | null; unit: string | null; size?: Size | null }
export type Size = 'small' | 'medium' | 'large';

/** "big", "normal" → the size words our servings use. */
const SIZE_WORD = '(small|little|medium|normal|regular|average|big|large)';
export const toSize = (w?: string | null): Size | null => (!w ? null : /small|little/.test(w) ? 'small' : /big|large/.test(w) ? 'large' : 'medium');

const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5, quarter: 0.25, couple: 2, few: 3 };
const UNIT = '(g|grams?|gram|kg|kilos?|kilograms?|oz|ounces?|lbs?|pounds?|ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|cups?|tbsps?|tablespoons?|tsps?|teaspoons?|slices?|pieces?|pcs|wings?|drumsticks?|thighs?|legs?|breasts?|bowls?|plates?|servings?|portions?|scoops?|glass(?:es)?|cans?|bottles?|handfuls?|pots?|bars?|bags?|packs?|packets?|biscuits?|cookies?|crackers?|muffins?|cooking spoons?|serving spoons?|stew spoons?|milk tins?|tins?|spoons?|wraps?|balls?|fillets?|eggs?|sticks?|skewers?|ladles?|wraps?|handfuls?)';
const LEAD = new RegExp(`^(?:about|around|roughly|like|maybe|some)?\\s*(\\d+(?:[.,]\\d+)?|${Object.keys(WORDS).join('|')})?\\s*(?:x\\s*)?(?:${SIZE_WORD}\\s+(?=${UNIT.replace('(', '(?:')}\\b))?${UNIT}?\\b\\s*(?:of\\s+)?(.*)$`, 'i');

/** Split a sentence into foods with their amounts. */
const FILLER = /\b(hey|hi|hello|um+|uh+|erm|okay|ok|so|well|like|just|basically|actually|please|nutivili|for (breakfast|lunch|dinner|supper|a snack|my \w+)|this (morning|afternoon|evening)|today|tonight|earlier|i (have |just )?(had|ate|eaten|drank|drunk|consumed)|i'?ve (had|eaten)|(can you |please )?(log|add|record)( that)?( i had)?|i want to log|some of)\b/g;
const NUM_WORD = `\\d+(?:[.,]\\d+)?|${Object.keys(WORDS).join('|')}`;
// A quantity that starts a new food, even without "and": "two boiled eggs a cup of rice" → two items.
const NEW_ITEM = new RegExp(`\\s(?=(?:${NUM_WORD})\\s+(?!of\\b)[a-z])`, 'g');

export function parseSaid(text: string): SaidFood[] {
  const clean = text.toLowerCase().replace(/[.!?]/g, ' ').replace(FILLER, ' ').replace(/\b(half|quarter)( of)? an? /g, '$1 ').replace(/\s+/g, ' ').trim();
  return clean
    .split(/,|;|\band then\b|\band\b|\bwith\b|\bplus\b|\balso\b|\n/)
    .flatMap((p) => p.trim().split(NEW_ITEM).map((x) => x.trim()).filter(Boolean)
      // "a" / "an" only start a new item after a word that ends a food, not "half a cup".
      .reduce<string[]>((acc, part) => { const prev = acc[acc.length - 1]; if (prev && /^(a|an)\s/.test(part) && /\b(half|quarter|about|around|roughly)$/.test(prev)) acc[acc.length - 1] = `${prev} ${part}`; else acc.push(part); return acc; }, []))
    .map((p) => p.trim())
    .filter((p) => p.length > 1)
    .map((p) => {
      const m = LEAD.exec(p);
      if (!m) return { text: p, qty: null, unit: null };
      const [, n, sizeWord, unit, rest] = m;
      const qty = n == null ? null : WORDS[n] ?? Number(n.replace(',', '.'));
      // "2 eggs": the unit word is the food itself.
      const foodText = (rest || (unit ?? '')).trim();
      const u = unit && rest ? sing(unit) : null;
      const size = u ? toSize(sizeWord) : null;
      return { text: foodText || p, qty: Number.isFinite(qty as number) ? qty : size ? 1 : null, unit: u, ...(size && { size }) };
    })
    .filter((s) => s.text.length > 1);
}

/** "pieces" → "piece", "glasses" → "glass", "cups" → "cup". */
const sing = (u: string) => (/(ss|sh|ch|x)es$/.test(u) ? u.slice(0, -2) : /ss$/.test(u) ? u : u.replace(/s$/, ''));

/** Words for the same serving: a drink's "glass" is its cup if it has no glass size; packet = pack. */
const SAME_AS: Record<string, string[]> = { stick: ['skewer'], skewer: ['stick'], glass: ['cup', '8 fl oz'], packet: ['pack', 'package'], pack: ['packet', 'package'], pot: ['container', 'carton'], biscuit: ['cookie', 'cracker'], cookie: ['biscuit'], cracker: ['biscuit'], bag: ['small single serving bag', 'single serving bag'] };

const PIECE = /^(piece|pc|wing|drumstick|thigh|leg|breast|egg|ball|fillet|wrap|slice|scoop|can|bottle|glass|bowl|plate|handful|serving|portion|spoon|pot|bar|bag|pack|biscuit|cookie|cracker|muffin)/;

/** Grams for "qty unit" of this food, or null when we'd have to guess. */
export function gramsFor(food: Pick<Food, 'portions' | 'name'>, qty: number | null, unit: string | null, size?: Size | null): { grams: number; how: string } | null {
  const n = qty ?? 1;
  const u = unit ?? '';
  // "a small plate", "two big wraps", "medium": that size of the food's own serving.
  if (size) {
    const sized = (food.portions ?? []).filter((p) => new RegExp(`\\b${size}\\b`).test(p.label.toLowerCase()));
    const p = (u && sized.find((x) => x.label.toLowerCase().includes(u))) || (!u || u === 'portion' || u === 'serving' ? sized[0] : undefined);
    if (p) return { grams: Math.round(p.grams * n), how: `${n} × ${p.label}` };
  }
  const direct: Record<string, number> = { g: 1, gram: 1, kg: 1000, kilo: 1000, kilogram: 1000, oz: 28.35, ounce: 28.35, lb: 453.6, pound: 453.6, ml: 1, millilitre: 1, milliliter: 1, l: 1000, litre: 1000, liter: 1000 };
  if (direct[u] != null) return { grams: Math.round(n * direct[u]), how: `${n} ${u}` };
  const portions = food.portions ?? [];
  const find = (re: RegExp) => portions.find((p) => re.test(p.label.toLowerCase()));
  let p;
  if (/^cup/.test(u)) p = find(/\bcup\b/);
  else if (/^(tbsp|tablespoon)/.test(u)) p = find(/tbsp|tablespoon/);
  else if (/^(tsp|teaspoon)/.test(u)) p = find(/tsp|teaspoon/);
  // West African household measures: cooking/serving/stew spoon, milk tin.
  else if (/^(cooking|serving|stew) spoon$|^spoon$/.test(u)) p = find(/cooking spoon/) ?? (u === 'spoon' ? find(/\bspoon\b/) : undefined);
  else if (/tin$/.test(u)) p = find(/\btin\b/);
  // A named unit ("2 slices", "a stick") only uses that unit's own size: never another serving (a slice isn't a wrap).
  else if (/^(piece|pc)/.test(u)) p = find(/\b(piece|medium|whole|1 (?!cup|tbsp|tsp|oz|plate|bowl|wrap|ladle)\w+)\b/);
  else if (PIECE.test(u) || /^(stick|skewer|ladle)/.test(u)) p = find(new RegExp(`\\b${u}`)) ?? SAME_AS[u]?.map((x) => find(new RegExp(`\\b${x}`))).find(Boolean);
  else if (!u && qty != null) p = find(/\b(piece|medium|whole|large|1 (?!cup|tbsp|tsp|oz)\w+)\b/);
  else if (!u) p = find(/serving|medium|piece/) ?? portions.find((x) => x.grams >= 25 && x.grams <= 400);
  if (!p) return null;
  // "2 tbsp = 32 g" means one tablespoon is 16 g; "0.5 fillet = 178 g" means a fillet is 356 g.
  const per = p.grams / (Number(/^(\d+(?:\.\d+)?)\s/.exec(p.label)?.[1]) || 1);
  const label = /^1\s/.test(p.label) || !/^\d/.test(p.label) ? p.label : `1 ${singular(p.label.replace(/^[\d.]+\s/, ''))}`;
  return { grams: Math.round(per * n), how: `${n} × ${label}` };
}

/** "tbsp" stays; "pieces" → "piece", "chips" → "chip" (first word only). */
const singular = (label: string) => label.replace(/^(\w+?)(es|s)\b/, (w, stem: string, end: string) => (/(tbsp|tsp|oz|fl)$/.test(w) ? w : end === 'es' && /(ch|sh|x|ss)$/.test(stem) ? stem : stem + (end === 'es' ? 'e' : '')));

/** The said foods in the shape the scan results screen uses (amounts filled in later). */
export function asRecognition(said: SaidFood[]): RecognitionResult {
  return {
    isFood: said.length > 0, photoQuality: 'fair', note: '',
    items: said.map((s) => ({
      name: s.text, localName: '', cuisine: '', searchQueries: [s.text], state: 'na', estimatedGrams: 0, confidence: 'medium',
      method: 'none', size: 'medium', gramsLow: 0, gramsHigh: 0, hidden: [], ingredients: [],
    })),
  };
}

/** An answer like "three", "2 pieces", "150 grams" or "a cup" → number and unit. */
export function parseAmount(answer: string): { qty: number | null; unit: string | null; size?: Size } {
  const t = answer.toLowerCase();
  const size = toSize(new RegExp(`\\b${SIZE_WORD}\\b`).exec(t)?.[1]);
  const m = new RegExp(`(?:^|\\s)(\\d+(?:[.,]\\d+)?|(?:${Object.keys(WORDS).join('|')})\\b)\\s*(?:${SIZE_WORD}\\s+)?(?:${UNIT}\\b)?`, 'i').exec(t);
  const unitOnly = new RegExp(`\\b${UNIT}\\b`).exec(t)?.[1];
  // "medium", "a big one", "small plate": one of that size.
  if (!m) return { qty: size ? 1 : null, unit: unitOnly ? sing(unitOnly) : null, ...(size && { size }) };
  const qty = WORDS[m[1]] ?? Number(m[1].replace(',', '.'));
  return { qty: Number.isFinite(qty) ? qty : null, unit: m[3] ? sing(m[3]) : null, ...(size && { size }) };
}

/**
 * The amount this person logged last time for this food (their own number, not a guess), so we
 * don't ask again what we already know. Planned meals don't count.
 */
export function lastAmount(entries: { foodId: string; food: { name: string }; grams: number; loggedAt: number; planned?: boolean }[], food: { id?: string; name: string }): number | null {
  let best: { grams: number; loggedAt: number } | null = null;
  for (const e of entries) {
    if (e.planned || !(e.grams > 0)) continue;
    if ((food.id && e.foodId === food.id) || e.food.name === food.name) if (!best || e.loggedAt > best.loggedAt) best = e;
  }
  return best ? best.grams : null;
}

/**
 * The question to ask when no amount was said, in the way this food is really served
 * (West African measures from docs/portions.md): soups by portion or ladle, swallows by the wrap,
 * rice and porridge by the plate or cooking spoon, moi moi / akara / puff puff counted.
 * `unit` is what a bare number in the answer counts.
 */
export function questionFor(food: Pick<Food, 'portions'>, name: string): { q: string; many: string; unit: string | null } {
  const labels = (food.portions ?? []).map((p) => p.label.toLowerCase());
  const has = (re: RegExp) => labels.some((l) => re.test(l));
  const sized = (noun: string) => has(new RegExp(`^1 (small|medium|large) ${noun}`));
  // Things people count by name: "two moi moi", "five akara", "three puff puff".
  if (has(/^1 (piece \(ball\)|wrap \(milk-tin size\))/)) {
    const unit = has(/^1 wrap/) ? 'wrap' : 'piece';
    const many = `How many ${name}?`; return { q: many, many, unit };
  }
  if (sized('portion')) {
    const many = `How much ${name} did you have: a small, medium or large portion?`;
    return { q: `${many} Or say how many ladles.`, many, unit: has(/ladle/) ? 'ladle' : null };
  }
  if (sized('wrap')) { const many = `How many wraps of ${name}?`; return { q: `${many} You can add small, medium or large.`, many, unit: 'wrap' }; }
  if (sized('plate')) {
    const many = `How much ${name}: a small, medium or large plate?`;
    return { q: `${many} Or say how many cooking spoons.`, many, unit: 'plate' };
  }
  if (sized('bowl')) { const many = `How much ${name}: a small, medium or large bowl?`; return { q: many, many, unit: 'bowl' }; }
  // Drinks: by the glass or cup, or ml.
  if (DRINK.test(name) && has(/\b(glass|cup|fl oz|can|bottle)\b/)) {
    const many = `How much ${name} did you drink: a glass, a cup, or how many ml?`;
    return { q: many, many, unit: has(/\bglass\b/) ? 'glass' : 'cup' };
  }
  // Spreads, oils, sugar, sauces: by the spoon.
  if (SPOONED.test(name) && has(/\b(tbsp|tablespoon|tsp|teaspoon)\b/)) {
    const many = `How many spoons of ${name}: teaspoons or tablespoons?`;
    return { q: many, many, unit: has(/\b(tbsp|tablespoon)\b/) ? 'tablespoon' : 'teaspoon' };
  }
  // Sliced foods (cake, bread, pizza...): by the slice.
  if (has(/^1 (\w+ )*slices?\b/) && SLICED.test(name)) {
    const many = `How many slices of ${name}?`;
    return { q: many, many, unit: 'slice' };
  }
  // Packaged things: pots, bars, bags, packs; baked goods by the piece.
  const packWord = ['pot', 'container', 'bar', 'bag', 'pack', 'biscuit', 'muffin', 'cookie', 'cracker'].find((w) => has(new RegExp(`^1 (small |medium |large |super |individual )?${w}\\b`)))?.replace('container', 'pot');
  if (packWord) { const many = `How many ${packWord === 'bag' ? 'bags' : packWord + 's'} of ${name}?`; return { q: many, many, unit: packWord }; }
  // Fruit, eggs, potatoes...: counted, in their size.
  if (has(/^1 (small|medium|large|extra large)$/)) {
    const many = `How many ${name}?`;
    return { q: `${many} You can say small, medium or large.`, many, unit: null };
  }
  const unitP = labels.find((l) => /\b(piece|wing|drumstick|thigh|leg|slice|egg|ball|fillet|wrap|stick|plate|bowl)\b/.test(l));
  const unit = unitP ? /\b(piece|wing|drumstick|thigh|leg|slice|egg|ball|fillet|wrap|stick|plate|bowl)\b/.exec(unitP)![1] : null;
  if (unit) {
    const many = /(wing|drumstick|thigh|leg|egg|ball|fillet)/.test(unit) && name.includes(unit) ? `How many ${name}?` : `How many ${unit === 'piece' ? 'pieces' : `${unit}s`} of ${name}?`;
    return { q: many, many, unit };
  }
  // Anything else: give this food's own servings as examples, never ones it doesn't have.
  const examples = (food.portions ?? []).map((p) => spokenServing(p.label)).filter((x): x is string => !!x).slice(0, 2);
  const many = `How much ${name}?`;
  return { q: `${many} ${examples.length ? `For example ${examples.join(' or ')}, or grams.` : 'Say how many grams.'}`, many, unit: null };
}

const DRINK = /\b(juice|milk|tea|coffee|cola|coke|soda|drink|water|beer|wine|malt|smoothie|lemonade|zobo|kunu|fanta|sprite|pepsi|yoghurt drink|yogurt drink|shake)\b/;
const SPOONED = /\b(butter|margarine|oil|honey|sugar|jam|marmalade|syrup|mayonnaise|mayo|ketchup|sauce|spread|nutella|peanut butter|salad cream|cream cheese|milo|bournvita|ovaltine|cocoa)\b/;
const SLICED = /\b(cake|bread|toast|pizza|loaf|cheesecake|gateau|pie|ham|cheese|watermelon|pineapple|pawpaw|papaya)\b/;

/** A serving label read naturally ("1 cup, chopped" → "1 cup", "0.5 fillet" → "half a fillet"), or null if odd. */
function spokenServing(label: string): string | null {
  const l = label.toLowerCase().replace(/\s*\(.*?\)/g, '').replace(/,.*$/, '').trim();
  if (/guideline|cubic|nlea|yield|any size|unit|container\b.*oz/.test(l) || !l) return null;
  return l.replace(/^0\.5 /, 'half a ').replace(/^0\.25 /, 'a quarter ');
}

/**
 * This food's servings in the order people use them (slices, wraps, ladles, glasses before cups
 * and ounces), each with the weight of ONE ("2 tbsp = 32 g" → tablespoon, 16 g). Odd ones are left out.
 */
export function naturalServings(food: Pick<Food, 'portions'>): { name: string; per: number }[] {
  const seen = new Set<string>();
  return (food.portions ?? [])
    .map((p) => {
      const n = Number(/^(\d+(?:\.\d+)?)\s/.exec(p.label)?.[1]) || 1;
      const name = spokenServing(p.label.replace(/^[\d.]+\s+/, '1 '))?.replace(/^1 /, '');
      return name && p.grams > 0 ? { name: n === 1 ? name : singular(name), per: p.grams / n, rank: NATURAL.findIndex((re) => re.test(name)) } : null;
    })
    .filter((x): x is { name: string; per: number; rank: number } => !!x && !seen.has(x.name) && !!seen.add(x.name))
    .sort((a, b) => (a.rank < 0 ? 99 : a.rank) - (b.rank < 0 ? 99 : b.rank))
    .map(({ name, per }) => ({ name, per }));
}
const NATURAL = [/^medium/, /^(small|large)/, /\b(slice|wrap|ladle|portion|plate|glass|pot|bar|bag|pack|piece|stick|biscuit|muffin|egg|fruit|wing|drumstick|thigh|fillet|breast)\b/, /cooking spoon/, /\b(tbsp|tablespoon|tsp|teaspoon)\b/, /\bcup\b/, /\boz\b/];
