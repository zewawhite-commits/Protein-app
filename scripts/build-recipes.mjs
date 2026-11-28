#!/usr/bin/env node
/**
 * Adds standard-recipe world dishes (scripts/recipes.mjs) to public/data/foods.json.
 * Safe to re-run: it removes previously added recipe rows first.
 *
 *   node scripts/build-recipes.mjs
 *
 * A dish's value per 100 g = Σ(ingredient value × grams) / cooked yield.
 * If ingredients with no value for a nutrient make up more than 10% of the weight,
 * that nutrient stays null (unknown) rather than being guessed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES, K, LATER, coverage } from './recipes-countries.mjs';
import { pairingsOf, variantsOf } from './recipe-variants.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dest = join(root, 'public', 'data', 'foods.json');
const file = JSON.parse(readFileSync(dest, 'utf8'));

const RECIPE_CAT = '9900';
file.categories[RECIPE_CAT] = 'World dishes (standard recipes)';
file.sources.r = {
  name: 'Standard recipes from USDA and FAO ingredient records',
  release: '2026',
  citation: 'Dish values calculated from the listed USDA FoodData Central and FAO/INFOODS ingredient records, weighted by grams and divided by cooked weight.',
};
file.foods = file.foods.filter((row) => row[10] !== 'r');

const byName = new Map();
for (const row of file.foods) if (!byName.has(row[1])) byName.set(row[1], row);

// Permanent ids (scripts/recipe-ids.json): a dish keeps its id forever, wherever it sits in the list.
const REG_FILE = 'scripts/recipe-ids.json';
const reg = JSON.parse(readFileSync(REG_FILE, 'utf8'));
let nextId = Math.max(0, ...Object.values(reg.ids).map((id) => Number(id.slice(1)))) + 1;
const idFor = (name) => (reg.ids[name] ??= `r${String(nextId++).padStart(3, '0')}`);

const round = (v, d) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
function rowFor(r) {
  const parts = r.ingredients.map(([name, grams]) => {
    const row = byName.get(name);
    if (!row) throw new Error(`${r.name}: no record named "${name}"`);
    return { row, grams };
  });
  const total = parts.reduce((s, p) => s + p.grams, 0);
  const value = (get) => {
    let sum = 0;
    let missing = 0;
    for (const p of parts) {
      const v = get(p.row);
      if (v == null) missing += p.grams;
      else sum += (v * p.grams) / 100;
    }
    return missing / total > 0.1 ? null : (sum * 100) / r.yield;
  };
  const base = [4, 5, 6, 7, 8].map((idx) => value((row) => row[idx]));
  const extra = Array.from({ length: file.extraFields.length }, (_, k) => value((row) => (row[11] ? row[11][k] : null)));
  const name = `${r.name}${r.aliases?.length ? ` (${r.aliases.join(', ')})` : ''}`;
  const note = `${r.cuisine} standard recipe, per ${r.yield} g cooked: ${parts.map((p) => `${p.grams} g ${p.row[1]} [${p.row[10] === 'w' ? 'FAO' : 'USDA'} ${p.row[0]}]`).join('; ')}`;
  return [
    idFor(r.name), name, Number(RECIPE_CAT), 'cooked',
    round(base[0], 2), round(base[1], 0), round(base[2], 2), round(base[3], 2), round(base[4], 2),
    r.portions, 'r', extra.map((v) => round(v, 2)), note,
  ];
}
const out = RECIPES.filter((r) => !LATER.has(r.name)).map(rowFor);
file.foods.push(...out);
// Newer dishes live in the second file with the versions (the main file is near the offline-cache limit).
const later = RECIPES.filter((r) => LATER.has(r.name)).map(rowFor);

// Other versions of each dish (other proteins, vegetarian, vegan) go to a second file that the app
// loads right after the main one, so the first load and the offline cache stay small.
const names = new Set([...file.foods.map((row) => row[1].split(' (')[0].toLowerCase()), ...RECIPES.map((r) => r.name.toLowerCase())]);
const recipeByName = new Map(RECIPES.map((r) => [r.name, r]));
const versions = RECIPES.flatMap((r) => variantsOf(r, K, names));
// Complete meals: each dish, and each of its versions, with the staples it's eaten with.
const variants = [...versions, ...[...RECIPES, ...versions].flatMap((r) => pairingsOf(r, K, names, recipeByName))];
const more = variants.map((v) => {
  const row = rowFor(v);
  row[12] = row[12].replace(' standard recipe,', v.kind === 'meal' ? ` standard recipe (${v.served} served with ${v.staple}),` : ` standard recipe (${v.kind === 'protein' ? 'version' : v.kind + ' version'} of ${v.of}),`);
  return row;
});
writeFileSync(join(root, 'public', 'data', 'foods-more.json'), JSON.stringify({ foods: [...later, ...more] }));
console.log(`Second file: ${later.length} newer dishes + ${more.length} versions.`);

// Completion tracker (Owner page): per country, its dishes and the versions made from them.
// Every dish counted here has a full ingredient list of measured USDA/FAO records (the build stops otherwise).
const kindsOf = new Map();
for (const v of variants) { const k = kindsOf.get(v.of) ?? { protein: 0, vegetarian: 0, vegan: 0, meal: 0 }; k[v.kind] += 1; kindsOf.set(v.of, k); }
const recipeByShown = new Map(RECIPES.map((r) => [r.name.split(' (')[0], r]));
const tracker = Object.entries(coverage).filter(([c]) => !c.startsWith('Worldwide')).map(([country, v]) => {
  const dishes = [...new Set(v.dishes)];
  const t = { country, region: v.region, dishes: dishes.length, protein: 0, vegetarian: 0, vegan: 0, meals: 0, plantDishes: 0 };
  for (const d of dishes) {
    const k = kindsOf.get(recipeByShown.get(d)?.name ?? d);
    if (k) { t.protein += k.protein; t.vegetarian += k.vegetarian; t.vegan += k.vegan; t.meals += k.meal; }
    if (/^(vegan|vegetarian)\b/i.test(d)) t.plantDishes += 1;
  }
  return t;
}).sort((a, b) => a.country.localeCompare(b.country));
const everyday = Object.entries(coverage).filter(([c]) => c.startsWith('Worldwide')).reduce((s, [, v]) => s + new Set(v.dishes).size, 0);
writeFileSync(join(root, 'public', 'data', 'coverage.json'), JSON.stringify({ target: 1000, everyday, countries: tracker }));
console.log(`Tracker: ${tracker.length} countries and territories, ${everyday} everyday dishes.`);
console.log(`Added ${more.length} versions: ${['protein', 'vegetarian', 'vegan', 'meal'].map((k) => `${variants.filter((v) => v.kind === k).length} ${k}`).join(', ')}.`);
writeFileSync(dest, JSON.stringify(file));
writeFileSync(REG_FILE, `${JSON.stringify(reg, null, 1)}\n`);
console.log(`Added ${out.length} standard-recipe dishes.`);
for (const row of out) console.log(`  ${row[1].split(' (')[0].padEnd(24)} ${row[5]} kcal  ${row[4]} g protein  ${row[7]} g carbs  ${row[6]} g fat /100 g`);
