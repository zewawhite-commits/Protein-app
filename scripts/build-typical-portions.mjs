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

// UK, Australian and West African tables list no household servings. Borrow them from the US
// record for the same food in the same state (raw/cooked/dry/as eaten), matched by name:
// "Carrot, raw" ← "Carrots, raw"; "Apples, eating, raw" ← "Apples, raw". Only household measures
// (cup, tbsp, tsp, slice, piece, medium…) are copied, labelled "(typical)". No match → no serving.
const SOURCE = db.fields.indexOf('source'), STATE = db.fields.indexOf('state');
const sing = (w) => w.replace(/(ies)$/, 'y').replace(/(oes|ches|shes|xes)$/, (m) => m.slice(0, -2)).replace(/([^s])s$/, '$1');
const norm = (n) => n.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[’']/g, '').split(',').map((x) => x.trim().split(/\s+/).map(sing).join(' ')).filter(Boolean);
const STOP = /^(raw|fresh|cooked|boiled|flesh only|flesh and skin|without skin|with skin|peeled|whole|average|unspecified|nfs|edible portion|canned|frozen|dried)$/;
const HOUSEHOLD = /^(1|2|0\.5|1\/2|1\/4) (cup|tbsp|tablespoon|tsp|teaspoon|slice|piece|medium|small|large|fruit|serving|oz|fl oz|stalk|clove|leaf|egg|fillet|wedge|bar|roll|muffin|biscuit|cookie|patty|link|strip|wing|drumstick|thigh|breast|cob|ear|spear|floret|head|bunch|glass|bowl|can|bottle|container|pot)\b/i;
// The food's meaningful name parts (cooking/state words dropped), all of them, in order.
const key = (n) => norm(n).filter((x) => !STOP.test(x)).join(', ');
const donorsBy = new Map();
for (const f of db.foods) {
  if (!['s', 'f'].includes(f[SOURCE])) continue;
  const ps = (f[PORTIONS] ?? []).filter(([l, g]) => HOUSEHOLD.test(l) && !/yields|\bear\b|any size/i.test(l) && g > 0 && !/\((typical|as sold)\)/.test(l));
  if (!ps.length) continue;
  const id = `${f[STATE]}|${key(f[NAME])}`;
  const cur = donorsBy.get(id);
  if (!cur || ps.length > cur.length) donorsBy.set(id, ps);
}
let borrowed = 0; const bySource = {};
for (const f of db.foods) {
  if (!['u', 'a', 'w'].includes(f[SOURCE]) || (f[PORTIONS] ?? []).length) continue;
  const ps = donorsBy.get(`${f[STATE]}|${key(f[NAME])}`);
  if (!ps) continue;
  f[PORTIONS] = ps.slice(0, 4).map(([l, g]) => [`${l} (typical)`, g]);
  borrowed++; bySource[f[SOURCE]] = (bySource[f[SOURCE]] ?? 0) + 1;
}
added += borrowed;
// Still nothing: a serving from an official portion guide, by kind of food. Each one is a standard
// household or guideline measure, not a guess at this exact food.
//  - Fruit and vegetables: 1 portion = 80 g, dried fruit 30 g (NHS "5 A Day" portion sizes).
//  - Nuts and seeds: 1 handful = 30 g (NHS / British Heart Foundation).
//  - Cooked meat and fish: 3 oz = 85 g (USDA Dietary Guidelines cooked portion).
//  - Oils 1 tbsp = 13.6 g, butter and spreads 1 tbsp = 14.2 g (USDA SR household weights).
//  - Beer and cider 1 pint (568 ml), wine 1 glass (175 ml), spirits 1 measure (25 ml) — UK standard
//    servings; grams assume the density of water (beer/cider ~1.01, close enough at this size).
//  - A whole boiled, poached or fried egg: 50 g (USDA large egg, edible part).
const CAT = db.fields.indexOf('categoryId');
const catName = (f) => db.categories[String(f[CAT])] ?? '';
const usFruitVegCat = new Map(db.foods.filter((f) => ['s', 'f'].includes(f[SOURCE]) && /^(Fruits and Fruit Juices|Vegetables and Vegetable Products)$/.test(catName(f))).map((f) => [norm(f[NAME])[0], catName(f)]));
const usFruitVeg = new Set(db.foods.filter((f) => ['s', 'f'].includes(f[SOURCE]) && /^(Fruits and Fruit Juices|Vegetables and Vegetable Products)$/.test(catName(f))).map((f) => norm(f[NAME])[0]));
const NOT_FV = /homemade|burger|sausage|\brice\b| and |\bwith\b|\bpeel\b|potato|\byam\b|plantain|cassava|breadfruit|\btaro\b|cocoyam|\bbeans?, (aduki|black|blackeye|borlotti|cannellini|haricot|kidney|mung|pinto|soya|baked)|lentil|chickpea|juice|soup|curry|pie|crumble|sauce|chutney|pickle|jam|marmalade|powder|flour|bhaji|pakora|samosa|fritter|chips|crisps|cake|pudding|salad dressing|weighed with|stuffed|in batter|ketchup|puree, concentrated|leaves, dried|seasoning|stock|gravy|\bmix\b/i;
const GUIDE = [
  { when: (f) => /dried/i.test(f[NAME]) && !/boiled|soaked|cooked/i.test(f[NAME]) && /Fruit/i.test(catName(f) + (usFruitVegCat.get(norm(f[NAME])[0]) ?? '')) && !NOT_FV.test(f[NAME]), portions: [['1 portion, dried fruit (typical)', 30]] },
  { when: (f) => isFV(f) && !NOT_FV.test(f[NAME]) && !/dried|dehydrated|freeze/i.test(f[NAME]), portions: [['1 portion (typical)', 80]] },
  { when: (f) => /Nuts and seeds|Nuts, seeds/i.test(catName(f)) && !/butter|oil|flour|paste|spread|milk|weighed with/i.test(f[NAME]), portions: [['1 handful (typical)', 30]] },
  { when: (f) => f[STATE] === 'cooked' && /meat|poultry|fish|Meat and meat|Fish and fish/i.test(catName(f)) && !/curry|pie|stew|soup|sauce|casserole|burger|sandwich|pasty|in batter|risotto|pilau|lasagne|bolognese|weighed with/i.test(f[NAME]), portions: [['3 oz cooked portion (typical)', 85]] },
  { when: (f) => /^(oil|[a-z ]+ oil)\b/i.test(f[NAME]) && !/fish oil capsule|essential/i.test(f[NAME]), portions: [['1 tbsp (typical)', 13.6], ['1 tsp (typical)', 4.5]] },
  { when: (f) => /^(butter|margarine|spread|fat spread|ghee|lard|dripping|baking fat)/i.test(f[NAME]), portions: [['1 tbsp (typical)', 14.2], ['1 tsp (typical)', 4.7]] },
  { when: (f) => /^(beer|lager|cider|stout|ale)\b/i.test(f[NAME]), portions: [['1 pint, 568 ml (typical)', 574], ['1 can, 330 ml (typical)', 333]] },
  { when: (f) => /^wine\b/i.test(f[NAME]) && !/vinegar|cooking/i.test(f[NAME]), portions: [['1 glass, 175 ml (typical)', 175], ['1 small glass, 125 ml (typical)', 125]] },
  { when: (f) => /^(spirits|whisky|whiskey|vodka|gin|rum|brandy)\b/i.test(f[NAME]), portions: [['1 measure, 25 ml (typical)', 24]] },
  { when: (f) => /^eggs?, (chicken|whole)?,? ?(boiled|poached|fried)/i.test(f[NAME]) && !/white|yolk|dried/i.test(f[NAME]), portions: [['1 egg (typical)', 50]] },
];
function isFV(f) { return usFruitVeg.has(norm(f[NAME])[0]) && (/Fruit|Vegetable/i.test(catName(f)) || f[SOURCE] === 'a'); }
let guided = 0; const guidedBy = {};
for (const f of db.foods) {
  if (!['u', 'a', 'w'].includes(f[SOURCE]) || (f[PORTIONS] ?? []).length) continue;
  const g = GUIDE.find((x) => x.when(f));
  if (!g) continue;
  f[PORTIONS] = g.portions.map(([l, w]) => [l, w]);
  guided++; guidedBy[f[SOURCE]] = (guidedBy[f[SOURCE]] ?? 0) + 1;
}
added += guided;
report.push(`from official portion guides: ${guided} (UK ${guidedBy.u ?? 0}, Australia ${guidedBy.a ?? 0}, West Africa ${guidedBy.w ?? 0})`);
report.push(`borrowed from the matching US food: ${borrowed} (UK ${bySource.u ?? 0}, Australia ${bySource.a ?? 0}, West Africa ${bySource.w ?? 0})`);
writeFileSync(FILE, JSON.stringify(db));
console.log(report.join('\n'));
console.log(`Added a typical serving to ${added} foods.`);
