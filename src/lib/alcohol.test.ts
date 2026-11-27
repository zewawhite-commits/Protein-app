import { expect, it } from 'vitest';
import { isAlcoholic } from './alcohol';
it('removes alcoholic drinks only', () => {
  for (const n of ['Beer', 'Wine, red', 'Alcoholic beverage, distilled, vodka, 80 proof', 'Palm wine (ca. 3.8% v/v alcohol)', 'Gin and tonic', 'Margarita', 'Cookie, rum ball, no bake', 'Mussels in white wine sauce, cooked', 'Vodka sauce with tomatoes and cream']) expect(isAlcoholic(n), n).toBe(true);
  for (const n of ['Beer, nonalcoholic', 'Soft drink, ginger ale', 'Vinegar, red wine', 'Fruit cocktail, canned, NFS', 'Shrimp cocktail', 'Scotch eggs, retail', 'Chapman (chapman drink, nigerian chapman, chapman cocktail)', 'Malt beverage, includes non-alcoholic beer', 'Gingerbread', 'Rumpsteak', 'Beverages, carbonated, root beer', 'Scotch broth, homemade', 'Cranberry juice cocktail, bottled']) expect(isAlcoholic(n), n).toBe(false);
});
