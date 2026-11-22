import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const lib = JSON.parse(readFileSync('public/data/recipes.json', 'utf8')).recipes as { id: string; name: string; steps: string[]; ingredients: [string, number][]; servings: number; minutes: number }[];
const ids = JSON.parse(readFileSync('scripts/recipe-ids.json', 'utf8')).ids as Record<string, string>;
const foods = JSON.parse(readFileSync('public/data/foods.json', 'utf8')).foods as unknown[][];

describe('world recipe library', () => {
  it('has a complete, real recipe for every dish', () => {
    expect(lib.length).toBeGreaterThan(180);
    const foodIds = new Set(foods.map((f) => f[0]));
    for (const r of lib) {
      expect(ids[r.name], r.name).toBe(r.id);
      expect(foodIds.has(r.id), `${r.name} has a food record`).toBe(true);
      expect(r.steps.length, r.name).toBeGreaterThan(0);
      expect(r.ingredients.every(([n, g]) => n && g > 0), r.name).toBe(true);
      expect(r.servings).toBeGreaterThan(0);
      expect(r.minutes).toBeGreaterThan(0);
    }
  });
});
