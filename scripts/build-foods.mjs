#!/usr/bin/env node
/**
 * Builds public/data/foods.json from official USDA FoodData Central CSV downloads:
 *
 *   SR Legacy (April 2018)  — ingredients and basic foods, lab-analysed
 *     https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
 *   FNDDS (Survey, 2024-10-31) — ~5,400 foods and mixed dishes as eaten, incl. many
 *     international dishes (curries, biryani, falafel, dumplings, enchiladas, pho, sushi…)
 *     https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2024-10-31.zip
 *
 *   FAO/INFOODS West African Food Composition Table 2019 (WAFCT) — ~1,000 West African
 *     foods and dishes. Convert first: python3 scripts/convert-wafct.py WAFCT_2019.xlsx wafct.json
 *     https://www.fao.org/fileadmin/user_upload/faoweb/2020/WAFCT_2019.xlsx
 *
 *   npm run build:foods -- --sr <SR folder> --fndds <FNDDS folder> --wafct <wafct.json>
 *
 * Every nutrient value is copied verbatim from USDA's food_nutrient.csv (per 100 g).
 * Nothing is estimated or filled in: missing values stay null.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.sr) {
  console.error('Usage: npm run build:foods -- --sr <SR Legacy folder> [--fndds <FNDDS folder>]');
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


// SR Legacy keys food_nutrient by nutrient id; FNDDS by the legacy nutrient number.
const NUTRIENT_KEYS = {
  sr: { protein: '1003', fat: '1004', carbs: '1005', kcal: '1008', fiber: '1079' },
  fndds: { protein: '203', fat: '204', carbs: '205', kcal: '208', fiber: '291' },
};
const r1 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 100) / 100);

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


/**
 * Load one FoodData Central CSV folder.
 * kind 'sr'    → SR Legacy (food_category.csv, portions built from amount/unit/modifier)
 * kind 'fndds' → FNDDS survey foods (WWEIA categories, portion_description)
 */
function loadDataset(dir, kind) {
  const read = (name) => parseCsv(readFileSync(join(dir, name), 'utf8'));
  const N = NUTRIENT_KEYS[kind];
  const categories =
    kind === 'sr'
      ? Object.fromEntries(read('food_category.csv').map((c) => [c.id, c.description]))
      : Object.fromEntries(read('wweia_food_category.csv').map((c) => [c.wweia_food_category, c.wweia_food_category_description]));
  // SR: Baby Foods, American Indian/Alaska Native, Branded, QC materials. FNDDS: infant/baby/human milk.
  const excluded = (catId) =>
    kind === 'sr' ? ['3', '24', '26', '27'].includes(catId) : /baby|infant|human milk/i.test(categories[catId] ?? '');
  const units = Object.fromEntries(read('measure_unit.csv').map((u) => [u.id, u.name]));
  const foods = read('food.csv').filter((f) => !excluded(f.food_category_id) && !/\bhuman\b/i.test(f.description));
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
    let label;
    if (kind === 'fndds') label = p.portion_description;
    else {
      const unit = p.measure_unit_id === '9999' ? '' : units[p.measure_unit_id] ?? '';
      const amount = Number(p.amount) || 1;
      label = [String(amount), unit, p.modifier].filter(Boolean).join(' ').trim();
    }
    if (!label || /not specified/i.test(label)) continue;
    const list = portions.get(p.fdc_id) ?? [];
    list.push([label, Math.round(grams * 10) / 10]);
    portions.set(p.fdc_id, list);
  }

  const out = [];
  let missing = 0;
  for (const f of foods) {
    const n = nutrients.get(f.fdc_id) ?? {};
    if (n[N.protein] == null) { missing++; continue; }
    out.push([
      Number(f.fdc_id),
      f.description,
      Number(f.food_category_id),
      kind === 'sr' ? prepState(f.description, f.food_category_id) : prepState(f.description, ''),
      r1(n[N.protein]),
      r1(n[N.kcal]),
      r1(n[N.fat]),
      r1(n[N.carbs]),
      r1(n[N.fiber]),
      (portions.get(f.fdc_id) ?? []).slice(0, 6),
      kind === 'sr' ? 's' : 'f',
    ]);
  }
  return { out, categories, missing };
}

const sets = [loadDataset(args.sr, 'sr')];
if (args.fndds) sets.push(loadDataset(args.fndds, 'fndds'));
if (args.wafct) {
  // WAFCT rows use the table's own food code as id; categories are the table's food groups.
  const w = JSON.parse(readFileSync(args.wafct, 'utf8'));
  const groups = [...new Set(w.foods.map((f) => f.group))];
  const categories = Object.fromEntries(groups.map((g, i) => [String(9000 + i), `${g} (West Africa)`]));
  const catId = (g) => 9000 + groups.indexOf(g);
  sets.push({
    missing: 0,
    categories,
    out: w.foods.map((f) => [
      f.code, f.name, catId(f.group), prepState(f.name, ''), r1(f.protein), r1(f.kcal), r1(f.fat), r1(f.carbs), r1(f.fiber), [], 'w',
    ]),
  });
}
const out = sets.flatMap((d) => d.out).sort((a, b) => a[1].localeCompare(b[1]));
const allCategories = Object.assign({}, ...sets.map((d) => d.categories));

// Hand-picked shortcuts. These are only FDC ids: values still come from USDA.
const QUICK_PICKS = [
  171077, 171477, 173424, 171287, 170894, 172182, 175168, 173709, 174031, 171794,
  172421, 173757, 172448, 172470, 170567, 173180, 175180, 168878, 169737, 173904,
];
const ids = new Set(out.map((f) => f[0]));
for (const id of QUICK_PICKS) if (!ids.has(id)) throw new Error(`Quick pick ${id} not found in dataset`);

const usedCats = [...new Set(out.map((f) => f[2]))].sort((a, b) => a - b);
const payload = {
  version: 2,
  sources: {
    s: {
      name: 'USDA FoodData Central — SR Legacy',
      release: '2018-04',
      citation: 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central: SR Legacy, 2018.',
    },
    f: {
      name: 'USDA FoodData Central — FNDDS',
      release: '2024-10-31',
      citation: 'U.S. Department of Agriculture, Agricultural Research Service. Food and Nutrient Database for Dietary Studies 2021–2023, 2024.',
    },
    w: {
      name: 'FAO/INFOODS West African Food Composition Table',
      release: '2019',
      citation: 'Vincent A. et al. 2020. FAO/INFOODS Food Composition Table for Western Africa (2019). Rome, FAO. © FAO 2020 — non-commercial use with acknowledgement; commercial use requires FAO permission.',
    },
  },
  basis: 'per 100 g edible portion',
  url: 'https://fdc.nal.usda.gov/',
  generatedAt: new Date().toISOString().slice(0, 10),
  fields: ['fdcId', 'name', 'categoryId', 'state', 'protein', 'kcal', 'fat', 'carbs', 'fiber', 'portions', 'source'],
  categories: Object.fromEntries(usedCats.map((id) => [id, allCategories[id]])),
  quickPicks: QUICK_PICKS,
  foods: out,
};

const dest = join(root, 'public', 'data', 'foods.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(payload));
const bySource = out.reduce((acc, f) => ((acc[f[10]] = (acc[f[10]] ?? 0) + 1), acc), {});
console.log(`Wrote ${out.length} foods to ${dest}`, bySource, 'skipped without protein:', sets.map((d) => d.missing));
