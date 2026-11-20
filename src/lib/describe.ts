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

export interface SaidFood { text: string; qty: number | null; unit: string | null }

const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5, quarter: 0.25, couple: 2, few: 3 };
const UNIT = '(g|grams?|gram|kg|kilos?|kilograms?|oz|ounces?|lbs?|pounds?|ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|cups?|tbsps?|tablespoons?|tsps?|teaspoons?|slices?|pieces?|pcs|wings?|drumsticks?|thighs?|legs?|breasts?|bowls?|plates?|servings?|portions?|scoops?|glass(?:es)?|cans?|bottles?|handfuls?|spoons?|wraps?|balls?|fillets?|eggs?)';
const LEAD = new RegExp(`^(?:about|around|roughly|like|maybe|some)?\\s*(\\d+(?:[.,]\\d+)?|${Object.keys(WORDS).join('|')})?\\s*(?:x\\s*)?${UNIT}?\\b\\s*(?:of\\s+)?(.*)$`, 'i');

/** Split a sentence into foods with their amounts. */
export function parseSaid(text: string): SaidFood[] {
  const clean = text.toLowerCase().replace(/^(i (had|ate|drank)|for (breakfast|lunch|dinner)( i had)?|today i had|log)\s+/, '').replace(/[.!?]/g, ' ');
  return clean
    .split(/,|;|\band then\b|\band\b|\bwith\b|\bplus\b|\balso\b|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1)
    .map((p) => {
      const m = LEAD.exec(p);
      if (!m) return { text: p, qty: null, unit: null };
      const [, n, unit, rest] = m;
      const qty = n == null ? null : WORDS[n] ?? Number(n.replace(',', '.'));
      // "2 eggs": the unit word is the food itself.
      const foodText = (rest || (unit ?? '')).trim();
      const u = unit && rest ? sing(unit) : null;
      return { text: foodText || p, qty: Number.isFinite(qty as number) ? qty : null, unit: u };
    })
    .filter((s) => s.text.length > 1);
}

/** "pieces" → "piece", "glasses" → "glass", "cups" → "cup". */
const sing = (u: string) => (/(ss|sh|ch|x)es$/.test(u) ? u.slice(0, -2) : /ss$/.test(u) ? u : u.replace(/s$/, ''));

const PIECE = /^(piece|pc|wing|drumstick|thigh|leg|breast|egg|ball|fillet|wrap|slice|scoop|can|bottle|glass|bowl|plate|handful|serving|portion|spoon)/;

/** Grams for "qty unit" of this food, or null when we'd have to guess. */
export function gramsFor(food: Pick<Food, 'portions' | 'name'>, qty: number | null, unit: string | null): { grams: number; how: string } | null {
  const n = qty ?? 1;
  const u = unit ?? '';
  const direct: Record<string, number> = { g: 1, gram: 1, kg: 1000, kilo: 1000, kilogram: 1000, oz: 28.35, ounce: 28.35, lb: 453.6, pound: 453.6, ml: 1, millilitre: 1, milliliter: 1, l: 1000, litre: 1000, liter: 1000 };
  if (direct[u] != null) return { grams: Math.round(n * direct[u]), how: `${n} ${u}` };
  const portions = food.portions ?? [];
  const find = (re: RegExp) => portions.find((p) => re.test(p.label.toLowerCase()));
  let p;
  if (/^cup/.test(u)) p = find(/\bcup\b/);
  else if (/^(tbsp|tablespoon)/.test(u)) p = find(/tbsp|tablespoon/);
  else if (/^(tsp|teaspoon)/.test(u)) p = find(/tsp|teaspoon/);
  else if (PIECE.test(u)) p = find(new RegExp(`\\b${u}`)) ?? find(/\b(piece|medium|whole|large|1 (?!cup|tbsp|tsp|oz)\w+)\b/);
  else if (!u && qty != null) p = find(/\b(piece|medium|whole|large|1 (?!cup|tbsp|tsp|oz)\w+)\b/);
  else if (!u) p = find(/serving|medium|piece/) ?? portions.find((x) => x.grams >= 25 && x.grams <= 400);
  if (!p) return null;
  return { grams: Math.round(p.grams * n), how: `${n} × ${p.label}` };
}

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
export function parseAmount(answer: string): { qty: number | null; unit: string | null } {
  const m = new RegExp(`(?:^|\\s)(\\d+(?:[.,]\\d+)?|(?:${Object.keys(WORDS).join('|')})\\b)\\s*(?:${UNIT}\\b)?`, 'i').exec(answer.toLowerCase());
  if (!m) return { qty: null, unit: null };
  const qty = WORDS[m[1]] ?? Number(m[1].replace(',', '.'));
  return { qty: Number.isFinite(qty) ? qty : null, unit: m[2] ? sing(m[2]) : null };
}
