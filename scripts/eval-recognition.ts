/**
 * Accuracy test for food recognition and portions, on your own labelled photos.
 *
 *   1. Put meal photos in a folder (jpg, png or webp) with a labels.csv like
 *      scripts/eval-labels.example.csv:
 *        file,cuisine,foods,grams,records
 *        jollof.jpg,Nigerian,jollof rice;fried plantain;grilled chicken,250;80;120,jollof rice;plantain;chicken
 *      - foods:   what's really on the plate, separated by ;
 *      - grams:   the weighed amounts in the same order (leave empty if not weighed)
 *      - records: optional words the right database record should contain, same order
 *   2. Check the folder without using AI:   npx vite-node scripts/eval-recognition.ts <folder> --dry
 *   3. Run it (uses the AI, roughly $0.05 per photo):
 *        ANTHROPIC_API_KEY=... npx vite-node scripts/eval-recognition.ts <folder>
 *
 * Prints, per cuisine and overall: foods found, extra items, database match, portion
 * error, and how often the real weight fell inside the AI's range. Writes the details
 * to <folder>/results.csv.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { recognizeWithClient, type RecognizedItem } from '../src/lib/recognition';
import { loadFoodDb } from '../src/lib/foods';
import { matchItems } from '../src/lib/recognize-client';

const folder = process.argv[2];
const dry = process.argv.includes('--dry');
if (!folder || !existsSync(folder)) {
  console.error('Usage: npx vite-node scripts/eval-recognition.ts <folder with photos and labels.csv> [--dry]');
  process.exit(1);
}
const labelsPath = join(folder, 'labels.csv');
if (!existsSync(labelsPath)) {
  console.error(`No labels.csv in ${folder}. Copy scripts/eval-labels.example.csv there and fill it in.`);
  process.exit(1);
}

interface Label { file: string; cuisine: string; foods: string[]; grams: (number | null)[]; records: string[] }
const split = (s = '') => s.split(';').map((x) => x.trim()).filter(Boolean);
const labels: Label[] = readFileSync(labelsPath, 'utf8').split(/\r?\n/).slice(1).filter((l) => l.trim()).map((line) => {
  const [file, cuisine, foods, grams, records] = line.split(',').map((x) => x.trim());
  return { file, cuisine: cuisine || 'Other', foods: split(foods), grams: split(grams).map((g) => (Number(g) > 0 ? Number(g) : null)), records: split(records) };
});
const missing = labels.filter((l) => !existsSync(join(folder, l.file)));
const unlabelled = readdirSync(folder).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !labels.some((l) => l.file === f));
console.log(`${labels.length} labelled photos${missing.length ? `, ${missing.length} missing files: ${missing.map((m) => m.file).join(', ')}` : ''}${unlabelled.length ? `, ${unlabelled.length} photos without a label` : ''}.`);
if (dry) process.exit(missing.length ? 1 : 0);
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY to run the test (or add --dry to only check the folder).');
  process.exit(1);
}

// The food database normally loads over HTTP in the app; read it from disk here.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith('data/foods.json')) return new Response(readFileSync(resolve('public/data/foods.json')), { headers: { 'content-type': 'application/json' } });
  return realFetch(input, init);
}) as typeof fetch;
await loadFoodDb();

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2);
/** How well a predicted item matches an expected food name (share of the expected words it contains). */
function overlap(expected: string, item: RecognizedItem): number {
  const want = words(expected);
  if (!want.length) return 0;
  const have = new Set(words([item.name, item.localName, ...item.searchQueries].join(' ')));
  return want.filter((w) => have.has(w) || [...have].some((h) => h.startsWith(w) || w.startsWith(h))).length / want.length;
}

const client = new Anthropic();
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
type Row = { file: string; cuisine: string; expected: string; found: string; matched: boolean; record: string; recordOk: boolean | null; realGrams: number | null; aiGrams: number | null; low: number | null; high: number | null; method: string; quality: string };
const rows: Row[] = [];
const extras: Record<string, number> = {};

for (const l of labels) {
  if (!existsSync(join(folder, l.file))) continue;
  const data = readFileSync(join(folder, l.file)).toString('base64');
  let result;
  try {
    result = await recognizeWithClient(client, data, TYPES[extname(l.file).toLowerCase()] ?? 'image/jpeg');
  } catch (e) {
    console.log(`✗ ${l.file}: ${(e as Error).message}`);
    continue;
  }
  const matched = matchItems(result, []);
  const used = new Set<number>();
  l.foods.forEach((food, k) => {
    // Best unused predicted item for this expected food.
    let best = -1, score = 0;
    result.items.forEach((it, i) => { const s = overlap(food, it); if (!used.has(i) && s > score) { best = i; score = s; } });
    const ok = best >= 0 && score >= 0.5;
    if (ok) used.add(best);
    const it = ok ? result.items[best] : null;
    const top = ok ? matched[best].candidates[0]?.name ?? '' : '';
    const want = l.records[k];
    rows.push({
      file: l.file, cuisine: l.cuisine, expected: food, found: it?.name ?? '', matched: ok,
      record: top, recordOk: want && ok ? words(want).every((w) => top.toLowerCase().includes(w)) : null,
      realGrams: l.grams[k] ?? null, aiGrams: it?.estimatedGrams || null, low: it?.gramsLow || null, high: it?.gramsHigh || null,
      method: it?.method ?? '', quality: result.photoQuality,
    });
  });
  extras[l.cuisine] = (extras[l.cuisine] ?? 0) + result.items.filter((_, i) => !used.has(i)).length;
  console.log(`${l.file}: found ${used.size}/${l.foods.length} · photo ${result.photoQuality} · AI saw: ${result.items.map((i) => `${i.name} ~${i.estimatedGrams} g`).join(', ')}`);
}

function summary(name: string, rs: Row[]) {
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  const withRecord = rs.filter((r) => r.recordOk != null);
  const weighed = rs.filter((r) => r.matched && r.realGrams && r.aiGrams);
  const errs = weighed.map((r) => Math.abs(r.aiGrams! - r.realGrams!) / r.realGrams!).sort((a, b) => a - b);
  const median = errs.length ? `${Math.round(errs[Math.floor(errs.length / 2)] * 100)}%` : '–';
  const inRange = weighed.filter((r) => r.low != null && r.high != null && r.realGrams! >= r.low && r.realGrams! <= r.high).length;
  const extra = name === 'All' ? Object.values(extras).reduce((a, b) => a + b, 0) : extras[name] ?? 0;
  console.log(`${name.padEnd(14)} foods found ${pct(rs.filter((r) => r.matched).length, rs.length).padStart(4)} (${rs.length})  extra items ${String(extra).padStart(3)}  right record ${pct(withRecord.filter((r) => r.recordOk).length, withRecord.length).padStart(4)}  median portion error ${median.padStart(4)}  real weight in range ${pct(inRange, weighed.length).padStart(4)}`);
}
console.log('\nResults');
for (const c of [...new Set(rows.map((r) => r.cuisine))].sort()) summary(c, rows.filter((r) => r.cuisine === c));
summary('All', rows);

const csv = ['file,cuisine,expected,found,matched,record,record_ok,real_g,ai_g,low_g,high_g,method,photo'].concat(
  rows.map((r) => [r.file, r.cuisine, r.expected, r.found, r.matched, r.record, r.recordOk ?? '', r.realGrams ?? '', r.aiGrams ?? '', r.low ?? '', r.high ?? '', r.method, r.quality].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
).join('\n');
writeFileSync(join(folder, 'results.csv'), csv);
console.log(`\nDetails saved to ${join(folder, 'results.csv')}`);
