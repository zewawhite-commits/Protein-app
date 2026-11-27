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
import { RECIPES } from './recipes-countries.mjs';

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
const out = [];
for (const r of RECIPES) {
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
  out.push([
    idFor(r.name), name, Number(RECIPE_CAT), 'cooked',
    round(base[0], 2), round(base[1], 0), round(base[2], 2), round(base[3], 2), round(base[4], 2),
    r.portions, 'r', extra.map((v) => round(v, 2)), note,
  ]);
}
file.foods.push(...out);
writeFileSync(dest, JSON.stringify(file));
writeFileSync(REG_FILE, `${JSON.stringify(reg, null, 1)}\n`);
console.log(`Added ${out.length} standard-recipe dishes.`);
for (const row of out) console.log(`  ${row[1].split(' (')[0].padEnd(24)} ${row[5]} kcal  ${row[4]} g protein  ${row[7]} g carbs  ${row[6]} g fat /100 g`);
