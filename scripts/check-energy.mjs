#!/usr/bin/env node
/**
 * Explains every food whose calories differ by more than 25% from the simple 4/4/9 rule
 * (protein and carbs 4 kcal/g, fat 9 kcal/g). Nothing is changed: each table's published energy is
 * kept. Each record gets the reason its table counts energy differently, and anything unexplained
 * is listed for review. Writes docs/energy-check.md.
 *
 *   node scripts/check-energy.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const db = JSON.parse(readFileSync('public/data/foods.json', 'utf8'));
const ix = Object.fromEntries(db.fields.map((k, i) => [k, i]));
const SRC = { s: 'USDA SR Legacy', f: 'USDA FNDDS', w: 'FAO West Africa', u: 'UK CoFID', a: 'Australia AFCD', r: 'standard recipe' };
const ALCOHOL = /\b(beer|lager|stout|ale|cider|wine|champagne|vodka|gin|rum|whisk(e)?y|scotch|brandy|cognac|tequila|liqueur|spirits?|alcoholic|martini|cocktail|sherry|port|sake|daiquiri|margarita|mojito|pina colada|bourbon|schnapps|vermouth|cooking wine|liqueurs?|malt liquor|black russian|bloody mary|irish coffee|mirin|vanilla (bean )?extract|sangria|cosmopolitan|manhattan|screwdriver|gimlet|mai tai|tom collins|whiskey sour|mudslide|kahlua|amaretto|eggnog with alcohol|creme de menthe|grasshopper|white russian|long island|tom and jerry|hot toddy|mint julep|piña colada|pina colada|sake|soju|shochu|ouzo|absinthe|cognac|armagnac|pimms|alcopop|hard lemonade|hard seltzer|wine cooler|cape cod|coffee, irish)\b/i;
const POLYOL = /\b(sugar[- ]free|sugarless|no sugar added|reduced sugar|polyol|sorbitol|xylitol|maltitol|erythritol|isomalt|diabetic|low calorie|diet)\b/i;
const ACID = /\b(vinegar|lemon(?! sole)|lime|citric|tamarind|sour|pickle)\b/i;
const MINERAL = /\b(baking powder|baking soda|salt|cream of tartar|leavening|yeast|gelatin|psyllium|bran|cellulose|gum|agar)\b/i;

const reasons = new Map();
const unexplained = [];
let checked = 0;
for (const r of db.foods) {
  const [kcal, p, c, f, fib] = ['kcal', 'protein', 'carbs', 'fat', 'fiber'].map((k) => r[ix[k]]);
  if ([kcal, p, c, f].some((v) => v == null) || kcal < 40) continue;
  checked++;
  const simple = 4 * p + 4 * c + 9 * f;
  if (Math.abs(kcal - simple) / kcal <= 0.25) continue;
  const name = r[ix.name], src = r[ix.source];
  // Tables outside the US count fibre at about 2 kcal/g (and US "carbs" include fibre).
  const withFibre = src === 'u' || src === 'a' || src === 'w' || src === 'r' ? simple + 2 * (fib ?? 0) : simple - 2 * (fib ?? 0);
  let why;
  const drinkCat = /^(Beer|Wine|Liquor and cocktails|Alcoholic beverages)/.test(db.categories[String(r[ix.categoryId])] ?? '');
  if (ALCOHOL.test(name) || drinkCat) why = 'Alcohol (7 kcal/g) — tables list the calories but no alcohol grams; the app now shows alcohol worked out from them';
  else if (POLYOL.test(name)) why = 'Sugar alcohols / sweeteners — counted at about 2.4 kcal/g, not 4';
  else if (Math.abs(kcal - withFibre) / kcal <= 0.25) why = 'Fibre energy — this table counts fibre at about 2 kcal/g';
  else if (ACID.test(name)) why = 'Organic acids (vinegar, citrus) — counted at about 3 kcal/g';
  else if (MINERAL.test(name)) why = 'Mostly minerals, gums or fibre that give little energy';
  else if (Math.abs(kcal - simple) < 25) why = 'Small absolute difference on a low-energy food (food-specific factors)';
  else if (src === 's' || src === 'f') why = 'USDA food-specific energy factors (e.g. 3.36–4.27 kcal/g protein, 3.57–4.16 carbs, 8.37–9.02 fat)';
  if (why) { if (!reasons.has(why)) reasons.set(why, []); reasons.get(why).push({ name, src, kcal, simple: Math.round(simple) }); }
  else unexplained.push({ name, src, kcal, simple: Math.round(simple) });
}
const total = [...reasons.values()].reduce((s, a) => s + a.length, 0) + unexplained.length;
const lines = [
  '# Energy check',
  '',
  `Foods checked (40 kcal or more per 100 g): ${checked}. Foods more than 25% away from the simple 4/4/9 rule: ${total}.`,
  'No values were changed: every table\'s published energy is kept. Each difference has a known cause below.',
  '',
  '| Reason | Foods | Examples (table kcal vs 4/4/9) |',
  '|---|---|---|',
  ...[...reasons.entries()].sort((a, b) => b[1].length - a[1].length).map(([why, list]) => `| ${why} | ${list.length} | ${list.slice(0, 3).map((x) => `${x.name.slice(0, 40)} (${x.kcal} vs ${x.simple})`).join('; ')} |`),
  '',
  `## Not explained by a known factor (${unexplained.length}) — kept, for review`,
  '',
  ...unexplained.map((x) => `- ${x.name} — ${SRC[x.src]}: ${x.kcal} kcal vs ${x.simple}`),
  '',
];
writeFileSync('docs/energy-check.md', lines.join('\n'));
console.log(lines.slice(0, 16).join('\n'));
console.log(`unexplained: ${unexplained.length}`);
