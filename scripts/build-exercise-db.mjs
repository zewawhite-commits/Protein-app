// Builds public/data/exercises.json from Free Exercise DB (public domain, Unlicense,
// github.com/yuhonas/free-exercise-db): 870+ exercises with start/end photos and written steps.
// Run: node scripts/build-exercise-db.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(new URL('./data/free-exercise-db.json', import.meta.url)));
const CAT = (x) => {
  if (x.category === 'stretching') return 'flexibility';
  if (x.category === 'cardio') return 'cardio';
  const m = x.primaryMuscles[0] ?? '';
  if (m === 'abdominals') return 'core';
  if (m === 'chest') return 'chest';
  if (['lats', 'middle back', 'lower back', 'traps'].includes(m)) return 'back';
  if (['shoulders', 'neck'].includes(m)) return 'shoulders';
  if (['biceps', 'triceps', 'forearms'].includes(m)) return 'arms';
  if (m === 'glutes') return 'glutes';
  return 'legs';
};
const EQ = { barbell: 'barbell', dumbbell: 'dumbbells', 'body only': 'none', cable: 'cable', machine: 'machine', kettlebells: 'kettlebell', bands: 'band', 'medicine ball': 'medicine ball', 'exercise ball': 'exercise ball', 'foam roll': 'foam roller', 'e-z curl bar': 'ez bar', other: 'other' };
const KIND = (x) => (x.category === 'cardio' ? 'cardio' : x.category === 'stretching' || /\b(plank|hold|wall sit|hang|bridge hold|isometric)\b/i.test(x.name) ? 'time' : 'strength');
const LEVEL = { beginner: 1, intermediate: 2, expert: 3 };
const cap = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const seen = new Set();
const out = [];
for (const x of src) {
  const key = x.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (seen.has(key) || !x.images?.length || !x.instructions?.length) continue;
  seen.add(key);
  out.push([x.id, x.name, CAT(x), KIND(x), LEVEL[x.level] ?? 1, EQ[x.equipment] ?? 'none', x.primaryMuscles.map(cap), x.secondaryMuscles.map(cap), x.instructions.map((s) => s.trim()).filter(Boolean), x.images.slice(0, 2), x.category]);
}
writeFileSync(new URL('../public/data/exercises.json', import.meta.url), JSON.stringify({
  about: 'Exercises and photos: Free Exercise DB (public domain, Unlicense), github.com/yuhonas/free-exercise-db. Photos load from jsDelivr.',
  imageBase: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/',
  fields: ['id', 'name', 'category', 'kind', 'level', 'equipment', 'primary', 'secondary', 'steps', 'images', 'type'],
  exercises: out,
}));
console.log(`exercises.json: ${out.length} exercises`);
