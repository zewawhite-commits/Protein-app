/**
 * Real photo-scanner test: runs the app's own recognition (same prompt, model and food matching)
 * on real photos and compares with weighed reference values. Costs one AI call per photo.
 *
 *   ANTHROPIC_API_KEY=… SCAN_EVAL=25 npx vitest run scripts/scan-eval.test.ts
 *
 * 1. Nutrition5k (Google Research, CC BY 4.0): real cafeteria plates, each weighed ingredient by
 *    ingredient — total grams and calories are measured, not estimated.
 * 2. Nigerian dishes: the hand-checked photos the app shows (identification only: no weights exist).
 * Writes docs/scan-eval.md with every photo's result. Skipped when no key is set.
 */
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { recognizeWithClient } from '../src/lib/recognition';
import { matchItems } from '../src/lib/recognize-client';
import { loadFoodDb } from '../src/lib/foods';

const N = Number(process.env.SCAN_EVAL || 0);
const BASE = 'https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset';

const NIGERIAN: [string, RegExp, string][] = [
  ['jollof', /jollof/i, ''], ['moi_moi', /moi|moin|bean pudding/i, ''], ['kelewele', /plantain|kelewele|dodo/i, ''],
  ['puff_puff', /puff|bofrot|doughnut/i, ''], ['pepper_soup', /pepper soup|soup/i, ''], ['zobo', /zobo|hibiscus|sobolo|bissap/i, ''],
  ['chin_chin', /chin/i, ''], ['akara', /akara|bean (fritter|cake)|koose/i, ''], ['pounded_yam', /pounded yam|iyan|fufu|swallow/i, ''],
  ['efo_riro', /efo|vegetable soup|spinach/i, ''], ['eba', /eba|garri|gari/i, ''],
];

it.skipIf(!N || !process.env.ANTHROPIC_API_KEY)('photo scanner against weighed plates', async () => {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = ((orig) => (u: RequestInfo | URL, i?: RequestInit) => (String(u).endsWith('/data/foods.json') ? Promise.resolve(new Response(readFileSync('public/data/foods.json', 'utf8'))) : orig(u, i)))(globalThis.fetch);
  await loadFoodDb();
  const client = new Anthropic();
  const lines = ['# Photo scanner test', '', `Run ${new Date().toISOString().slice(0, 10)} with the app's own recognition and matching code.`, ''];

  // 1. Weighed plates.
  const csv = await (await fetch(`${BASE}/metadata/dish_metadata_cafe1.csv`)).text();
  const dishes = csv.trim().split('\n').map((l) => l.split(',')).filter((c) => Number(c[2]) > 50);
  // Spread the sample across the file (deterministic), skipping single-ingredient plates.
  const pick = dishes.filter((c) => (c.length - 6) / 7 >= 2).filter((_, i, a) => i % Math.floor(a.length / N) === 0).slice(0, N);
  const rows: string[] = [];
  let massErr = 0, kcalErr = 0, n = 0, within25 = 0;
  for (const c of pick) {
    const [id, kcal, mass] = [c[0], Number(c[1]), Number(c[2])];
    const ingr = Array.from({ length: (c.length - 6) / 7 }, (_, k) => ({ name: c[7 + k * 7], g: Number(c[8 + k * 7]) })).filter((x) => x.g >= 5);
    const img = await fetch(`${BASE}/imagery/realsense_overhead/${id}/rgb.png`);
    if (!img.ok) continue;
    const b64 = Buffer.from(await img.arrayBuffer()).toString('base64');
    let res;
    try { res = await recognizeWithClient(client, b64, 'image/png'); } catch (e) { rows.push(`| ${id} | error: ${(e as Error).message.slice(0, 60)} | | | | |`); continue; }
    const matched = matchItems(res, []);
    const estMass = res.items.reduce((s, x) => s + (x.estimatedGrams || 0), 0);
    const estKcal = matched.reduce((s, m, i) => s + (m.candidates[0]?.per100.kcal ?? 0) * (res.items[i].estimatedGrams || 0) / 100, 0);
    const me = (estMass - mass) / mass, ke = (estKcal - kcal) / Math.max(1, kcal);
    massErr += Math.abs(me); kcalErr += Math.abs(ke); n++; if (Math.abs(ke) <= 0.25) within25++;
    rows.push(`| ${id} | ${ingr.map((x) => `${x.name} ${Math.round(x.g)} g`).join(', ')} | ${res.items.map((x, i) => `${x.name} ${x.estimatedGrams} g → ${matched[i].candidates[0]?.name.slice(0, 30) ?? 'no match'}`).join('; ')} | ${Math.round(mass)} / ${Math.round(estMass)} g (${me > 0 ? '+' : ''}${Math.round(me * 100)}%) | ${Math.round(kcal)} / ${Math.round(estKcal)} kcal (${ke > 0 ? '+' : ''}${Math.round(ke * 100)}%) |`);
  }
  lines.push('## Weighed plates (Nutrition5k)', '', !n ? 'No plates could be scanned (see errors below).' : `${n} plates. Average weight error ${Math.round((massErr / n) * 100)}%, average calorie error ${Math.round((kcalErr / n) * 100)}%; ${within25} of ${n} within ±25% of the weighed calories.`, '',
    '| Plate | Weighed ingredients | Scanner said → matched food | Weighed / estimated weight | Weighed / estimated calories |', '|---|---|---|---|---|', ...rows, '');

  // 2. Nigerian dishes (identification only).
  const photos = (await (await fetch('https://nutiviliai.vercel.app/api/photos?keys=' + NIGERIAN.map((x) => x[0]).join(','))).json()) as { photos: Record<string, { url: string } | null> };
  const ng: string[] = [];
  let ok = 0, tried = 0;
  for (const [key, re] of NIGERIAN) {
    const p = photos.photos[key];
    if (!p) continue;
    const r = await fetch(/unsplash/.test(p.url) ? `${p.url}${p.url.includes('?') ? '&' : '?'}w=800` : p.url, { headers: { 'User-Agent': 'NutiviliScanTest/1.0' } });
    if (!r.ok) { ng.push(`| ${key} | photo not downloadable (${r.status}) | |`); continue; }
    const type = r.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
    let res;
    try { res = await recognizeWithClient(client, Buffer.from(await r.arrayBuffer()).toString('base64'), type); } catch (e) { ng.push(`| ${key} | error ${(e as Error).message.slice(0, 50)} | |`); continue; }
    const names = res.items.map((x) => `${x.name}${x.localName ? ` (${x.localName})` : ''} [${x.confidence}]`).join('; ');
    const hit = res.items.some((x) => re.test(`${x.name} ${x.localName}`));
    tried++; if (hit) ok++;
    ng.push(`| ${key} | ${names} | ${hit ? 'correct' : 'WRONG'} |`);
  }
  lines.push('## Nigerian dishes (identification only)', '', `${ok} of ${tried} identified correctly.`, '', '| Photo | Scanner said | Result |', '|---|---|---|', ...ng, '');
  writeFileSync('docs/scan-eval.md', lines.join('\n'));
  console.log(lines.slice(0, 12).join('\n'));
}, 1_800_000);
