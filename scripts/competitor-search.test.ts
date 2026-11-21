/**
 * Competitor-complaint checks for food search (Cronometer / MacroFactor users): plain foods first,
 * partial words, misspellings. Opt-in: COMPETITOR_AUDIT=1 npx vitest run scripts/competitor-search.test.ts
 */
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { loadFoodDb, searchFoods } from '../src/lib/foods';

const Q: [string, RegExp][] = [
  ['potato', /^potato(es)?(,|$)/i], ['orange', /^oranges?\b(?!.*juice)/i], ['apple', /^apples?\b(?!.*(pie|juice|sauce))/i], ['banana', /^bananas?\b/i],
  ['egg', /^eggs?\b/i], ['milk', /^milk\b/i], ['chicken', /^chicken/i], ['rice', /^rice\b/i], ['bread', /^bread\b/i], ['yogurt', /yog(h)?urt/i], ['oats', /^oats?\b/i],
  ['broccoli', /^broccoli/i], ['carrot', /^carrots?, /i], ['tomato', /^tomato(es)?, (?!.*(sauce|soup|juice))/i], ['onion', /^onions?, /i], ['avocado', /^avocados?\b/i], ['salmon', /salmon/i], ['beef', /^beef\b/i], ['cheese', /cheese/i], ['butter', /^butter\b/i],
  // partial words and typos
  ['chick', /chick/i], ['banan', /banana/i], ['brocoli', /broccoli/i], ['yoghurt', /yog(h)?urt/i], ['spagetti', /^spaghetti(?!.*sauce)/i], ['avacado', /avocado/i], ['potatoe', /potato/i], ['jolof', /jollof/i], ['egusi', /egusi/i], ['plantian', /plantain/i],
];

it.skipIf(!process.env.COMPETITOR_AUDIT)('plain foods first, partial words, typos', async () => {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => new Response(readFileSync('public/data/foods.json', 'utf8'))) as never;
  await loadFoodDb();
  const rows = Q.map(([q, re]) => { const r = searchFoods(q).slice(0, 5).map((f) => f.name); return { q, ok: re.test(r[0] ?? ''), top: r }; });
  writeFileSync('docs/competitor-search.json', JSON.stringify(rows, null, 1));
  for (const r of rows) console.log(r.ok ? 'ok  ' : 'MISS', r.q.padEnd(10), '→', r.top.slice(0, 3).join(' | '));
  console.log(rows.filter((r) => r.ok).length, '/', rows.length);
});
