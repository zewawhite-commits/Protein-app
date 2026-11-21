import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';

// Diaries, favourites and recents point at recipe ids, so a dish must keep its id forever.
describe('standard recipe ids are permanent', () => {
  const reg = JSON.parse(readFileSync('scripts/recipe-ids.json', 'utf8')).ids as Record<string, string>;
  const foods = JSON.parse(readFileSync('public/data/foods.json', 'utf8')).foods as unknown[][];
  it('no id is used twice', () => expect(new Set(Object.values(reg)).size).toBe(Object.values(reg).length));
  it('every dish in the database has the id it was given', () => {
    for (const row of foods.filter((r) => r[10] === 'r')) {
      const full = row[1] as string;
      const base = Object.keys(reg).find((n) => full === n || full.startsWith(`${n} (`));
      expect(base, full).toBeTruthy();
      expect(row[0], full).toBe(reg[base!]);
    }
  });
  it('dishes that existed before keep their old ids', () => {
    expect(reg['Nigerian stew']).toBe('r030');
    expect(reg['Native jollof (palm oil rice)']).toBe('r126');
  });
});
