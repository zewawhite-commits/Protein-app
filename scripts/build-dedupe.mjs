#!/usr/bin/env node
/**
 * Merges records that are genuinely the same food: identical name AND identical calories, protein,
 * carbs and fat (usually the same USDA value published in two USDA tables). Records whose numbers
 * differ at all are kept — they're real differences between countries' foods or methods, and
 * search groups them under one row with "values agree / calories differ".
 * The kept record gets the others' serving sizes; dropped ids are redirected to it so saved
 * diaries, recents and favourites still find their food.
 *
 *   node scripts/build-dedupe.mjs   (run after build-recipes and build-typical-portions)
 */
import { readFileSync, writeFileSync } from 'fs';

const FILE = 'public/data/foods.json';
const db = JSON.parse(readFileSync(FILE, 'utf8'));
const F = db.fields; const ix = Object.fromEntries(F.map((k, i) => [k, i]));
const groups = new Map();
for (const r of db.foods) {
  const k = `${r[ix.name].trim().toLowerCase()}|${['kcal', 'protein', 'carbs', 'fat'].map((f) => r[ix[f]]).join('|')}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const redirects = { ...(db.redirects ?? {}) };
const drop = new Set();
let merged = 0;
for (const rows of groups.values()) {
  if (rows.length < 2) continue;
  // Keep the one with the most serving sizes (then the most nutrients listed).
  const score = (r) => (r[ix.portions]?.length ?? 0) * 100 + (r[ix.extra] ?? []).filter((v) => v != null).length;
  const [keep, ...rest] = [...rows].sort((a, b) => score(b) - score(a));
  const labels = new Set((keep[ix.portions] ?? []).map(([l]) => l.toLowerCase()));
  for (const r of rest) {
    for (const p of r[ix.portions] ?? []) if (!labels.has(p[0].toLowerCase())) { keep[ix.portions].push(p); labels.add(p[0].toLowerCase()); }
    redirects[`${r[ix.source]}:${r[ix.fdcId]}`] = `${keep[ix.source]}:${keep[ix.fdcId]}`;
    drop.add(r);
    merged++;
  }
}
db.foods = db.foods.filter((r) => !drop.has(r));
db.redirects = redirects;
writeFileSync(FILE, JSON.stringify(db));
console.log(`Merged ${merged} identical records into their twins; ${db.foods.length} foods remain; ${Object.keys(redirects).length} redirects.`);
