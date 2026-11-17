import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadFoodDb, searchFoods } from './foods';

beforeAll(async () => {
  const json = JSON.parse(readFileSync('public/data/foods.json', 'utf8'));
  (globalThis as { fetch: unknown }).fetch = async () => ({ ok: true, json: async () => json });
  await loadFoodDb();
});

// Everyday names people type, and a word the top results should contain.
const CASES: [string, RegExp][] = [
  ['semovita', /semovita/i], ['semo', /semovita/i], ['tuwo shinkafa', /tuwo shinkafa/i], ['tuwon shinkafa', /tuwo shinkafa/i],
  ['fufu', /fufu/i], ['akpu', /fufu/i], ['banku', /banku/i], ['amala', /amala/i], ['eba', /eba/i], ['pounded yam', /pounded yam/i],
  ['poundo', /poundo/i], ['ogbono', /ogbono/i], ['egusi', /egusi/i], ['zobo', /zobo/i], ['kunu', /kunu/i], ['chapman', /chapman/i],
  ['agbalumo', /star apple/i], ['udara', /star apple/i], ['garden egg', /eggplant/i], ['pawpaw', /papaya/i], ['kilishi', /jerky|suya/i],
  ['gooseberry', /gooseberr/i], ['elderberry', /elderberr/i], ['blackberry', /blackberr/i], ['mango', /mango/i], ['soursop', /soursop/i],
  ['tiger nut', /tiger ?nut|chufa/i], ['kuli kuli', /kuli/i], ['agidi', /agidi/i], ['coconut rice', /coconut rice/i], ['fried yam', /fried yam|yam/i],
  ['peppered snail', /snail/i], ['nkwobi', /nkwobi/i], ['isi ewu', /isi ewu/i], ['okpa', /okpa/i], ['fura', /fura/i], ['puff puff', /puff/i],
  ['chin chin', /chin/i], ['moi moi', /moi/i], ['akara', /akara/i], ['jollof', /jollof/i], ['suya', /suya/i], ['dodo', /plantain/i],
];

describe('local foods people search for', () => {
  it.each(CASES)('"%s" finds it', (q, re) => {
    const top = searchFoods(q, { limit: 5 }).map((f) => f.name);
    expect(top.some((n) => re.test(n)), `${q} → ${top.join(' | ')}`).toBe(true);
  });
});
