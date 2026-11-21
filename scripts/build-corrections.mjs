#!/usr/bin/env node
/** Applies the reviewed corrections in scripts/corrections.json to public/data/foods.json (re-runnable). */
import { readFileSync, writeFileSync } from 'fs';
const FILE = 'public/data/foods.json';
const db = JSON.parse(readFileSync(FILE, 'utf8'));
const c = JSON.parse(readFileSync('scripts/corrections.json', 'utf8'));
const F = (n) => db.fields.indexOf(n);
const [KEY, STATE, PORTIONS, SOURCE, EXTRA] = ['fdcId', 'state', 'portions', 'source', 'extra'].map(F);
const byId = new Map(db.foods.map((r) => [`${r[SOURCE]}:${r[KEY]}`, r]));
const notes = { ...c.checkNotes };
let n = 0;
for (const fx of c.fixes) {
  const r = byId.get(fx.id);
  if (!r) { console.error('not found', fx.id); process.exitCode = 1; continue; }
  if (fx.portion) r[PORTIONS] = r[PORTIONS].map(([l, g]) => [l === fx.portion[0] ? fx.portion[1] : l, g]);
  if (fx.dropPortion) r[PORTIONS] = r[PORTIONS].filter(([l]) => l !== fx.dropPortion);
  if (fx.state) r[STATE] = fx.state;
  if ('sugar' in fx && r[EXTRA]) r[EXTRA][db.extraFields.indexOf('sugar')] = fx.sugar;
  if (fx.note) notes[fx.id] = fx.note;
  n++;
}
for (const id of Object.keys(c.checkNotes)) if (!byId.has(id)) { console.error('note for unknown food', id); process.exitCode = 1; }
db.checkNotes = notes;
writeFileSync(FILE, JSON.stringify(db));
console.log(`Applied ${n} corrections; ${Object.keys(notes).length} foods carry a note.`);
