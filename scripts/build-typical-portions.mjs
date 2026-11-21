#!/usr/bin/env node
/**
 * Gives foods that have no natural serving (e.g. a UK "Cake, chocolate fudge" with only grams)
 * the typical serving of the same kind of food, taken from the database itself: the median
 * weight of that serving across the foods of that kind that do list it (mostly USDA FNDDS,
 * which records how much people actually eat). Labelled "(typical)" so it's never mistaken
 * for a measured serving of that exact product. Nothing is invented: no data, no serving.
 *
 *   node scripts/build-typical-portions.mjs     (re-runnable: old "(typical)" servings are replaced)
 */
import { readFileSync, writeFileSync } from 'fs';

const FILE = 'public/data/foods.json';
const db = JSON.parse(readFileSync(FILE, 'utf8'));
const NAME = db.fields.indexOf('name'), PORTIONS = db.fields.indexOf('portions');

// kind: which foods (by name), which existing servings to learn from, and the label to give.
const KINDS = [
  { kind: 'cake', is: /^(cakes?|gateau|cheesecake|cake or cupcake)\b/i, not: /mix|batter|frosting|icing,|dry/i, from: /^1 (piece \(1\/|slice\b)/i, label: '1 slice (typical)' },
  { kind: 'muffin', is: /^(muffins?|cupcakes?)\b/i, not: /english|mix|batter/i, from: /^1 (muffin|cupcake|medium|regular)\b/i, label: '1 muffin (typical)' },
  { kind: 'pie', is: /^(pies?|pasty|pasties|pork pie)\b/i, not: /spice|crust|filling|cottage|shepherd|mix/i, from: /^1 (piece|pie|individual|pasty)\b/i, label: '1 piece (typical)' },
  { kind: 'bread', is: /^(bread|breads|toast)\b/i, not: /naan|paratha|wrap|pitta|pita|chapat|tortilla|rolls?\b|bun|bagel|crumbs|stuffing|pudding|dough|mix|fruit|stick|sauce|crouton/i, from: /^1 (medium or regular |regular |medium )?slice\b/i, label: '1 slice (typical)' },
  { kind: 'biscuit', is: /^(biscuits,|biscuit, (sweet|savoury)|cookies?,|crackers?,|digestive|shortbread)/i, not: /dough|mix|crumbs|crust|sandwich|chicken|sausage|egg/i, from: /^1 (cookie|biscuit|cracker|piece|medium)\b/i, label: '1 biscuit (typical)' },
  { kind: 'drink', is: /^(juice|[a-z ]+ juice\b|fruit juice|orange juice|apple juice|nectar\b|smoothie|lemonade|cordial|soft drink|energy drink|iced tea|beverages, carbonated|carbonated|cola|soda,|malt drink)/i, not: /lemon juice|lime juice|^juice, (lemon|lime)|concentrate|powder|jelly|clam|pickle|vodka|alcoholic|frozen,? undiluted/i, from: /^1 cup\b|^8 fl oz/i, label: '1 glass (typical)' },
  { kind: 'yogurt', is: /^yog(h)?urts?\b/i, not: /parfait|coating|covered|frozen|dressing|dip|powder/i, from: /^1 (container|pot|carton)\b|^6 oz/i, label: '1 pot (typical)' },
  { kind: 'crisps', is: /^(potato crisps|crisps|snacks, potato chips|snacks, tortilla chips|corn chips|vegetable crisps)/i, not: /dip/i, from: /small single serving bag|^1 oz\b/i, label: '1 small bag (typical)' },
  { kind: 'chocolate', is: /^(chocolate, (milk|dark|plain|white)|sweets, chocolate|chocolate bar)/i, not: /drink|spread|chips|syrup|baking/i, from: /^1 (bar|package)\b|^1\.5 oz/i, label: '1 bar (typical)' },
];
// Pack sizes printed on the product itself.
const PACKS = [
  { is: /indomie/i, portions: [['1 pack (as sold)', 70], ['1 super pack (as sold)', 120]] },
];
// Plain cooked rice the way it's served in West Africa (Accra photographic food atlas, IFPRI 2022:
// about 100 g per cooking spoon / ladle step; see docs/portions.md). Added alongside the cup.
const RICE = { is: /^rice, (white|brown|parboiled)[^]*\bcooked\b/i, not: /flour|cake|pudding|noodle|bran|glutinous|sticky/i,
  portions: [['1 medium plate (typical)', 300], ['1 small plate (typical)', 200], ['1 large plate (typical)', 400], ['1 cooking spoon (typical)', 100]] };

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
let added = 0;
const report = [];
for (const f of db.foods) f[PORTIONS] = (f[PORTIONS] ?? []).filter(([l]) => !/\((typical|as sold)\)/.test(l));
for (const k of KINDS) {
  const members = db.foods.filter((f) => k.is.test(f[NAME]) && !k.not.test(f[NAME]));
  const donors = members.flatMap((f) => (f[PORTIONS] ?? []).filter(([l, g]) => k.from.test(l) && !/any size/i.test(l) && g > 0).map(([, g]) => g));
  if (donors.length < 5) { report.push(`${k.kind}: only ${donors.length} examples, skipped`); continue; }
  const g = Math.round(median(donors));
  let n = 0;
  for (const f of members) {
    if ((f[PORTIONS] ?? []).some(([l]) => k.from.test(l))) continue;
    f[PORTIONS] = [[k.label, g], ...(f[PORTIONS] ?? [])];
    n++;
  }
  added += n;
  report.push(`${k.kind.padEnd(13)} ${String(g).padStart(4)} g  (median of ${donors.length} listed servings) → added to ${n} foods`);
}
for (const f of db.foods) if (RICE.is.test(f[NAME]) && !RICE.not.test(f[NAME])) { f[PORTIONS] = [...RICE.portions.map(([l, g]) => [l, g]), ...(f[PORTIONS] ?? [])]; added++; }
for (const k of PACKS) for (const f of db.foods) if (k.is.test(f[NAME]) && !(f[PORTIONS] ?? []).length) { f[PORTIONS] = k.portions.map(([l, g]) => [l, g]); added++; }
writeFileSync(FILE, JSON.stringify(db));
console.log(report.join('\n'));
console.log(`Added a typical serving to ${added} foods.`);
