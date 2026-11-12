#!/usr/bin/env node
/**
 * Builds public/data/foods.json from the official USDA FoodData Central
 * "SR Legacy" CSV download (April 2018 release).
 *
 *   1. Download https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
 *   2. Unzip it somewhere outside this repo.
 *   3. npm run build:foods -- /path/to/FoodData_Central_sr_legacy_food_csv_2018-04
 *
 * Every nutrient value in the output is copied verbatim from USDA's
 * food_nutrient.csv (per 100 g edible portion). Nothing is estimated or
 * filled in: if USDA has no value for a nutrient, the output stores null.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = process.argv[2];
if (!src) {
  console.error('Usage: npm run build:foods -- <path to unzipped SR Legacy CSV folder>');
  process.exit(1);
}

/** Minimal RFC 4180 CSV parser (handles quoted fields, escaped quotes, commas, newlines). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const read = (name) => parseCsv(readFileSync(join(src, name), 'utf8'));

// USDA nutrient ids
const N = { protein: '1003', fat: '1004', carbs: '1005', kcal: '1008', fiber: '1079' };

// Categories excluded: Baby Foods, American Indian/Alaska Native Foods,
// Branded Food Products Database, Quality Control Materials.
const EXCLUDED_CATEGORIES = new Set(['3', '24', '26', '27']);

const categories = Object.fromEntries(read('food_category.csv').map((c) => [c.id, c.description]));
const units = Object.fromEntries(read('measure_unit.csv').map((u) => [u.id, u.name]));
const foods = read('food.csv').filter((f) => !EXCLUDED_CATEGORIES.has(f.food_category_id));
const wanted = new Set(foods.map((f) => f.fdc_id));

const nutrients = new Map();
for (const n of read('food_nutrient.csv')) {
  if (!wanted.has(n.fdc_id)) continue;
  let rec = nutrients.get(n.fdc_id);
  if (!rec) nutrients.set(n.fdc_id, (rec = {}));
  rec[n.nutrient_id] = Number(n.amount);
}

const portions = new Map();
for (const p of read('food_portion.csv')) {
  if (!wanted.has(p.fdc_id)) continue;
  const grams = Number(p.gram_weight);
  if (!grams) continue;
  const unit = p.measure_unit_id === '9999' ? '' : units[p.measure_unit_id] ?? '';
  const amount = Number(p.amount) || 1;
  const label = [amount !== 1 || unit ? String(amount) : '1', unit, p.modifier].filter(Boolean).join(' ').trim();
  const list = portions.get(p.fdc_id) ?? [];
  list.push([label, Math.round(grams * 10) / 10]);
  portions.set(p.fdc_id, list);
}

/**
 * Classify preparation state from the USDA description.
 *  cooked – description names a cooking method
 *  raw    – description says raw / uncooked
 *  dry    – dry, uncooked grains, pasta, cereals and pulses (weigh before cooking)
 *  na     – not applicable (milk, cheese, bread, nuts, ...)
 */
const COOKED = /\b(cooked|roasted|boiled|baked|grilled|broiled|fried|pan-fried|pan-browned|braised|stewed|steamed|simmered|microwaved|poached|scrambled|toasted|heated|rotisserie|blanched)\b/i;
const RAW = /\b(raw|uncooked|unprepared)\b/i;
const DRY_CATEGORIES = new Set(['8', '16', '20']);
function prepState(description, categoryId) {
  // "cooked, dry heat" is a cooking method, so cooked is checked first.
  if (COOKED.test(description) && !/\bnot cooked\b/i.test(description)) return 'cooked';
  if (RAW.test(description)) return 'raw';
  if (DRY_CATEGORIES.has(categoryId) && /\bdry\b/i.test(description)) return 'dry';
  return 'na';
}

const r1 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 100) / 100);

const out = [];
let missingProtein = 0;
for (const f of foods) {
  const n = nutrients.get(f.fdc_id) ?? {};
  if (n[N.protein] == null) { missingProtein++; continue; }
  out.push([
    Number(f.fdc_id),
    f.description,
    Number(f.food_category_id),
    prepState(f.description, f.food_category_id),
    r1(n[N.protein]),
    r1(n[N.kcal]),
    r1(n[N.fat]),
    r1(n[N.carbs]),
    r1(n[N.fiber]),
    (portions.get(f.fdc_id) ?? []).slice(0, 6),
  ]);
}
out.sort((a, b) => a[1].localeCompare(b[1]));

// Hand-picked shortcuts. These are only FDC ids: values still come from USDA.
const QUICK_PICKS = [
  171077, 171477, 173424, 171287, 170894, 172182, 175168, 173709, 174031, 171794,
  172421, 173757, 172448, 172470, 170567, 173180, 175180, 168878, 169737, 173904,
];
const ids = new Set(out.map((f) => f[0]));
for (const id of QUICK_PICKS) if (!ids.has(id)) throw new Error(`Quick pick ${id} not found in dataset`);

const usedCats = [...new Set(out.map((f) => f[2]))].sort((a, b) => a - b);
const payload = {
  version: 1,
  source: {
    name: 'USDA FoodData Central — SR Legacy',
    release: '2018-04',
    url: 'https://fdc.nal.usda.gov/',
    citation: 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central: SR Legacy, 2018. fdc.nal.usda.gov.',
    basis: 'per 100 g edible portion',
  },
  generatedAt: new Date().toISOString().slice(0, 10),
  fields: ['fdcId', 'name', 'categoryId', 'state', 'protein', 'kcal', 'fat', 'carbs', 'fiber', 'portions'],
  categories: Object.fromEntries(usedCats.map((id) => [id, categories[id]])),
  quickPicks: QUICK_PICKS,
  foods: out,
};

const dest = join(root, 'public', 'data', 'foods.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(payload));
const states = out.reduce((acc, f) => ((acc[f[3]] = (acc[f[3]] ?? 0) + 1), acc), {});
console.log(`Wrote ${out.length} foods to ${dest} (skipped ${missingProtein} without a protein value)`, states);
