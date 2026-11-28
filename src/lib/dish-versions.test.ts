import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fitsDiet } from './goals';

type Row = [string, string, number, string, number, number, number, number, number, [string, number][], string, unknown, string];
const main = JSON.parse(readFileSync('public/data/foods.json', 'utf8')).foods as Row[];
const more = JSON.parse(readFileSync('public/data/foods-more.json', 'utf8')).foods as Row[];
const food = (r: Row) => ({ name: r[1].split(' (')[0], sourceNote: r[12] });

describe('other versions of dishes (foods-more.json)', () => {
  it('never reuses an id or a name from the main file', () => {
    const ids = new Set(main.map((r) => `${r[10]}:${r[0]}`));
    const names = new Set(main.map((r) => r[1].split(' (')[0].toLowerCase()));
    for (const r of more) {
      expect(ids.has(`r:${r[0]}`), r[1]).toBe(false);
      expect(names.has(r[1].split(' (')[0].toLowerCase()), r[1]).toBe(false);
    }
  });

  it('vegan versions are vegan and vegetarian versions are vegetarian, judged from their ingredients', () => {
    const vegan = more.filter((r) => /^Vegan /.test(r[1]));
    const veg = more.filter((r) => /^Vegetarian /.test(r[1]));
    expect(vegan.length).toBeGreaterThan(500);
    expect(veg.length).toBeGreaterThan(150);
    for (const r of vegan) expect(fitsDiet(food(r), 'vegan'), r[1] + ' — ' + r[12]).toBe(true);
    for (const r of veg) expect(fitsDiet(food(r), 'vegetarian'), r[1] + ' — ' + r[12]).toBe(true);
  });

  it('every version says which dish it comes from and has real numbers', () => {
    for (const r of more) {
      expect(r[12], r[1]).toMatch(/standard recipe( \(((vegan |vegetarian )?version of|.+ served with) .+\))?, per \d+(\.\d+)? g cooked:/);
      expect(r[5], r[1]).toBeGreaterThan(0);
    }
  });

  it('stays small enough for the offline cache', () => {
    expect(statSync('public/data/foods-more.json').size).toBeLessThan(8 * 1024 * 1024);
  });
});

describe('kidney beans', () => {
  it('are a plant food, kidneys are meat', () => {
    expect(fitsDiet({ name: 'Red kidney beans, boiled' }, 'vegan')).toBe(true);
    expect(fitsDiet({ name: 'Rice and beans', sourceNote: 'standard recipe, per 300 g cooked: 150 g Beans, kidney, red, cooked' }, 'vegan')).toBe(true);
    expect(fitsDiet({ name: 'Lamb kidneys, fried' }, 'vegetarian')).toBe(false);
    expect(fitsDiet({ name: 'Steak and kidney pie' }, 'vegetarian')).toBe(false);
  });
});

describe('world spice blends', () => {
  it('are in the database, measured by the teaspoon', () => {
    for (const n of ['Berbere spice blend', 'Jerk seasoning, dry', 'Suya spice', 'Ras el hanout spice blend', "Za'atar spice blend", 'Five-spice powder', 'Garam masala, Pakistani', 'Harissa paste']) {
      const r = main.find((x) => x[1].split(' (')[0] === n);
      expect(r, n).toBeTruthy();
      expect(r![9][0][0], n).toBe('1 teaspoon');
    }
  });
});
