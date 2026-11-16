import { describe, expect, it } from 'vitest';
import { allergensIn, avoidSet, foodAllergens } from './allergens';

describe('allergen checks', () => {
  it('finds allergens by name, with plurals', () => {
    expect(allergensIn('Peanut butter, smooth', ['Peanuts', 'Dairy', 'Tree nuts'])).toEqual(['Peanuts']);
    expect(allergensIn('Scrambled eggs', ['Eggs'])).toEqual(['Eggs']);
    expect(allergensIn('Mixed nuts, roasted', ['Tree nuts'])).toEqual(['Tree nuts']);
    expect(allergensIn('Suya (beef suya, kilishi)', ['Peanuts', 'Beef'])).toEqual(['Peanuts', 'Beef']);
    expect(allergensIn('Egusi soup with crayfish', ['Shellfish', 'Fish'])).toEqual(['Shellfish']);
  });
  it('avoids common false alarms', () => {
    expect(allergensIn('Eggplant, cooked', ['Eggs'])).toEqual([]);
    expect(allergensIn('Coconut milk', ['Dairy', 'Tree nuts'])).toEqual([]);
    expect(allergensIn('Butternut squash', ['Dairy', 'Tree nuts'])).toEqual([]);
    expect(allergensIn('Hamburger bun', ['Pork'])).toEqual([]);
    expect(allergensIn('Cowpeas, boiled', ['Beef'])).toEqual([]);
    expect(allergensIn('Ginger ale', ['Alcohol'])).toEqual([]);
    expect(allergensIn('Rice noodles', ['Gluten'])).toEqual([]);
    expect(allergensIn('Kale, raw', ['Alcohol'])).toEqual([]);
  });
  it('checks recipe ingredients and diet preferences', () => {
    const egusi = { name: 'Egusi soup', source: 'recipe', sourceNote: 'West African standard recipe: 100 g Melon seed [FAO]; 20 g Shrimp, dried [USDA 1]; 250 g Beef, round [USDA 2]' };
    expect(foodAllergens(egusi, ['Shellfish', 'Beef', 'Dairy'])).toEqual(['Shellfish', 'Beef']);
    expect(avoidSet({ avoid: ['Peanuts'], dietPrefs: ['Halal'] }).sort()).toEqual(['Alcohol', 'Peanuts', 'Pork']);
  });
});
