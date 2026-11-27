/**
 * Nutivili has no alcoholic drinks: they're removed from the food database and filtered out here
 * too, so a rebuilt database can't bring them back. Alcohol-free versions (non-alcoholic beer, malt
 * drinks), vinegars, ginger ale, root beer and fruit cocktail stay.
 */
const DRINK = /\b(alcoholic beverages?|beers?|lager|stout|wines?|vodka|gin|rum|whiske?y|whisky|scotch|bourbon|brandy|tequila|liqueurs?|cocktails?|margarita|martini|mojito|daiquiri|sangria|champagne|prosecco|hard cider|sake|soju|shandy|palm wine|burukutu|pito|ogogoro|sherry|vermouth|mead|schnapps|cognac|pina colada|mai tai|jagerbomb|kamikaze|bloody mary|screwdriver|manhattan|old fashioned|gimlet|negroni|spritz|black russian|white russian|tom collins|singapore sling|rob roy|rusty nail|greyhound|fuzzy navel|seabreeze|glug|gin fizz|seven and seven|moscow mule|tequila sunrise|brandy alexander|whiskey sour|eggnog, alcoholic|gelatin shot, alcoholic|alcoholic (coffee drink|malt)|malt beer|malt liquor|rum ball|rum baba|truffles, rum|creme de menthe|cider, apple \(alcohol)\b/i;
const ALCOHOL_FREE = /non-?alcoholic|nonalcoholic|alcohol[- ]free|dealcoholi[sz]ed|vinegar|ginger (ale|beer)|root beer|fruit cocktail|juice cocktail|vegetable juice cocktail|tomato juice cocktail|shrimp cocktail|cocktail sauce|sauce, cocktail|beerwurst|beer salami|beer yeast|scotch (eggs|broth|pancakes|fillet|roast)|manhattan clam|manhattan style|manhattan, canned|old fashioned (molasses|windmill|vegetable)|brandy snaps|ginger|wine, nonalcoholic|sour mix|cocktail mix|margarita mix|chapman/i;
const CATEGORIES = new Set(['Beer', 'Wine', 'Liquor and cocktails', 'Alcoholic beverages (UK)']);

export function isAlcoholic(name: string, category?: string): boolean {
  if (category && CATEGORIES.has(category)) return true;
  return DRINK.test(name) && !ALCOHOL_FREE.test(name);
}
