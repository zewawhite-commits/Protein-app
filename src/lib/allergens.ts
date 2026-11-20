/**
 * Allergy and avoid-list checks by food name (and recipe ingredients). Used when logging
 * and searching, and on the server to check what the AI suggests.
 *
 * Name matching can't see inside a product the way a full ingredients list does, so the
 * app treats a match as "may contain" and always tells people to check labels. It errs
 * towards warning: e.g. suya is flagged for peanuts because the spice mix (yaji) usually
 * contains groundnut.
 */

type Rule = { words: string[]; except?: string[] };

const RULES: Record<string, Rule> = {
  Peanuts: { words: ['peanut', 'groundnut', 'kuli kuli', 'kuli-kuli', 'satay', 'suya', 'yaji', 'arachis', 'monkey nut'] },
  'Tree nuts': {
    words: ['almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'macadamia', 'brazil nut', 'pine nut', 'praline', 'marzipan', 'nutella', 'nut', 'mixed nuts', 'nut butter', 'baklava', 'pesto'],
    except: ['peanut', 'groundnut', 'coconut', 'doughnut', 'donut', 'nutmeg', 'butternut', 'water chestnut', 'tiger nut', 'nutrition', 'nutritional'],
  },
  Dairy: {
    words: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'whey', 'casein', 'ghee', 'paneer', 'custard', 'kefir', 'lactose', 'ice cream', 'curd', 'mozzarella', 'cheddar', 'parmesan', 'feta', 'ricotta', 'mascarpone', 'latte', 'cappuccino', 'milkshake', 'labneh', 'wara'],
    except: ['coconut milk', 'almond milk', 'soy milk', 'soya milk', 'oat milk', 'rice milk', 'cashew milk', 'peanut butter', 'nut butter', 'butter beans', 'butter bean', 'cocoa butter', 'shea butter', 'butternut', 'dairy-free', 'dairy free', 'non-dairy', 'cream crackers', 'cream of tartar', 'bean curd', 'soy curd', 'milk thistle', 'groundnut butter', 'apple butter', 'butterfish'],
  },
  Eggs: { words: ['egg', 'omelet', 'omelette', 'mayonnaise', 'mayo', 'meringue', 'frittata', 'quiche', 'eggnog', 'custard', 'shakshuka', 'scotch egg', 'aioli'], except: ['eggplant', 'egg-free', 'egg free', 'eggless'] },
  Fish: {
    words: ['fish', 'salmon', 'tuna', 'cod', 'sardine', 'mackerel', 'tilapia', 'catfish', 'anchovy', 'anchovies', 'herring', 'trout', 'haddock', 'pollock', 'hake', 'stockfish', 'stock fish', 'panla', 'bonga', 'sushi', 'sashimi', 'fish sauce', 'swordfish', 'snapper', 'sea bass', 'halibut', 'eel', 'caviar', 'roe', 'bonito', 'dashi', 'worcestershire'],
    except: ['shellfish', 'crayfish', 'fish-free'],
  },
  Shellfish: { words: ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'crawfish', 'oyster', 'mussel', 'clam', 'scallop', 'squid', 'calamari', 'octopus', 'periwinkle', 'langoustine', 'cockle', 'whelk', 'snail', 'escargot', 'abalone', 'seafood', 'paella'] },
  Gluten: {
    words: ['wheat', 'bread', 'barley', 'rye', 'pasta', 'spaghetti', 'macaroni', 'noodle', 'couscous', 'semolina', 'seitan', 'bulgur', 'cracker', 'biscuit', 'cake', 'pastry', 'pizza', 'bun', 'bagel', 'croissant', 'chin chin', 'puff puff', 'puff-puff', 'meat pie', 'doughnut', 'donut', 'pancake', 'waffle', 'beer', 'soy sauce', 'malt', 'flour', 'dumpling', 'tortilla', 'pita', 'chapati', 'roti', 'naan', 'samosa', 'spelt', 'farro', 'breadcrumb', 'crouton', 'cookie', 'muffin', 'brownie', 'cereal', 'shawarma', 'burger', 'sandwich', 'wrap', 'semovita', 'udon', 'ramen'],
    except: ['gluten-free', 'gluten free', 'rice noodle', 'rice noodles', 'glass noodle', 'buckwheat', 'corn tortilla', 'cassava flour', 'rice flour', 'corn flour', 'maize flour', 'plantain flour', 'yam flour', 'almond flour', 'coconut flour', 'chickpea flour', 'gram flour', 'tapioca flour', 'sorghum flour', 'millet flour', 'teff flour', 'breadfruit', 'rice cake', 'corn bread', 'cornbread'],
  },
  Soy: { words: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'natto', 'soy sauce', 'teriyaki', 'tamari', 'beske', 'awara'], except: ['soy-free', 'soy free'] },
  Sesame: { words: ['sesame', 'tahini', 'hummus', 'houmous', 'halva', 'halwa', 'benne', 'beniseed', 'gomasio', 'za\'atar', 'zaatar'] },
  Pork: { words: ['pork', 'bacon', 'ham', 'salami', 'pepperoni', 'chorizo', 'prosciutto', 'lard', 'pancetta', 'gammon', 'pig', 'char siu', 'carnitas'], except: ['hamburger', 'hamachi', 'pork-free'] },
  Beef: { words: ['beef', 'steak', 'veal', 'brisket', 'kilishi', 'ponmo', 'cow', 'oxtail', 'corned beef', 'bresaola', 'pastrami', 'suya'], except: ['cowpea', 'cowpeas', 'beef-free'] },
  Alcohol: { words: ['beer', 'wine', 'vodka', 'whisky', 'whiskey', 'rum', 'gin', 'liqueur', 'alcohol', 'alcoholic', 'cider', 'sake', 'champagne', 'brandy', 'tequila', 'cocktail', 'lager', 'stout', 'ale', 'prosecco', 'mead', 'burukutu', 'pito'], except: ['ginger ale', 'root beer', 'ginger beer', 'non-alcoholic', 'alcohol-free', 'alcohol free', '0%', 'ginger', 'rum raisin', 'wine vinegar', 'vinegar'] },
};

/** Diet preferences that imply avoid-list items. */
const FROM_PREFS: Record<string, string[]> = {
  'Gluten-free': ['Gluten'], 'Dairy-free': ['Dairy'], Halal: ['Pork', 'Alcohol'], Kosher: ['Pork', 'Shellfish'],
};

export const ALLERGEN_NAMES = Object.keys(RULES);

/** Everything this person avoids: their avoid list plus what their diet preferences imply. */
export function avoidSet(p: { avoid?: string[]; dietPrefs?: string[] } | null | undefined): string[] {
  const out = new Set<string>();
  // Known allergens plus anything the person typed themselves (e.g. "Mango", "Okra").
  for (const a of p?.avoid ?? []) if (a.trim()) out.add(a.trim());
  for (const d of p?.dietPrefs ?? []) for (const a of FROM_PREFS[d] ?? []) out.add(a);
  return [...out];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cache = new Map<string, { hit: RegExp; skip: RegExp | null }>();
function compiled(name: string) {
  let c = cache.get(name);
  if (!c) {
    // Something typed in (not one of the built-in allergens): match that word and simple plurals.
    const r = RULES[name] ?? { words: [name.toLowerCase().replace(/(es|s)$/, '')] };
    // Whole words, with simple plurals (egg/eggs, nut/nuts, noodle/noodles).
    c = {
      hit: new RegExp(`(^|[^a-z])(${r.words.map(esc).join('|')})(e?s)?(?![a-z])`, 'i'),
      skip: r.except?.length ? new RegExp(`(${r.except.map(esc).join('|')})`, 'gi') : null,
    };
    cache.set(name, c);
  }
  return c;
}

/** Which of the given avoid-list items a piece of text (a food or dish name) may contain. */
export function allergensIn(text: string, avoid: string[]): string[] {
  if (!text || !avoid.length) return [];
  const out: string[] = [];
  for (const a of avoid) {
    if (!a.trim()) continue;
    const { hit, skip } = compiled(a);
    const t = skip ? text.replace(skip, ' ') : text;
    if (hit.test(t)) out.push(a);
  }
  return out;
}

/** Allergens in a food: its name, plus the ingredients of a recipe or custom dish. */
export function foodAllergens(food: { name: string; source?: string; sourceNote?: string; recipe?: { ingredients?: { name?: string }[] } }, avoid: string[]): string[] {
  if (!avoid.length) return [];
  // Standard recipes list their ingredients in the source note ("…: 100 g Melon seed…; 20 g Shrimp, dried…").
  const note = food.source === 'recipe' && food.sourceNote ? food.sourceNote.replace(/\[[^\]]*\]/g, '').split(/[;:]/) : [];
  const parts = [food.name, ...(food.recipe?.ingredients ?? []).map((i) => i.name ?? ''), ...note];
  return [...new Set(parts.flatMap((p) => allergensIn(p, avoid)))];
}

/** Allergens found across several names (e.g. every ingredient of an AI recipe). */
export function allergensInAll(texts: string[], avoid: string[]): string[] {
  return [...new Set(texts.flatMap((t) => allergensIn(t, avoid)))];
}
