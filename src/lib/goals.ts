import { allergensIn } from './allergens';
/**
 * Protein target suggestion from onboarding answers. A starting point the user can
 * change — not medical advice. Reference points:
 *  - 0.8 g/kg: adult RDA (US National Academies, Dietary Reference Intakes 2005)
 *  - 1.4–2.0 g/kg: International Society of Sports Nutrition position stand for
 *    exercising individuals (Jäger et al., 2017)
 *  - ~1.6 g/kg: intake above which added protein stopped improving resistance-training
 *    gains in a meta-analysis (Morton et al., Br J Sports Med 2018)
 *  - 1.0–1.2 g/kg: recommended for healthy adults aged 65+ (PROT-AGE study group,
 *    Bauer et al., J Am Med Dir Assoc 2013)
 *  - 1.1 g/kg: RDA during pregnancy and breastfeeding (US National Academies, DRI 2005)
 */
import type { ActivityLevel, Diet, FitnessGoal, Food } from './types';

const BY_ACTIVITY: Record<ActivityLevel, number> = { sedentary: 0.8, light: 1.2, active: 1.6, athlete: 1.8 };
const GOAL_FLOOR: Record<FitnessGoal, number> = { muscle: 1.6, fatloss: 1.8, performance: 1.6, maintain: 0, health: 0 };

export interface PersonFactors { age?: number; pregnant?: boolean }

export function suggestGramsPerKg(goal: FitnessGoal, activity: ActivityLevel, person: PersonFactors = {}): number {
  // Higher targets assume training; without it, stay at the general-population levels.
  let floor = activity === 'sedentary' ? Math.min(GOAL_FLOOR[goal], 1.2) : GOAL_FLOOR[goal];
  if ((person.age ?? 0) >= 65) floor = Math.max(floor, 1.0);
  if (person.pregnant) floor = Math.max(floor, 1.1);
  return Math.min(2.0, Math.max(BY_ACTIVITY[activity], floor));
}

/** With several goals, use the one that asks for the most protein. */
export function primaryGoal(goals: FitnessGoal[], activity: ActivityLevel): FitnessGoal {
  return goals.reduce((best, g) => (suggestGramsPerKg(g, activity) > suggestGramsPerKg(best, activity) ? g : best), goals[0] ?? 'health');
}

export function suggestionReason(goal: FitnessGoal, activity: ActivityLevel, gPerKg: number, person: PersonFactors = {}): string {
  if (person.pregnant && gPerKg <= 1.1) return 'During pregnancy and breastfeeding the recommended intake rises to about 1.1 g/kg.';
  if ((person.age ?? 0) >= 65 && gPerKg <= 1.2) return 'From age 65, experts recommend about 1.0–1.2 g/kg to help keep muscle and strength.';
  if (gPerKg <= 0.8) return 'The adult Recommended Dietary Allowance (0.8 g/kg) covers the needs of most people who don’t train.';
  if (goal === 'muscle') return 'Around 1.6 g/kg is where extra protein stopped adding muscle gains in a large study of people who lift.';
  if (goal === 'fatloss' && activity !== 'sedentary') return 'Eating toward the top of the 1.4–2.0 g/kg sports range helps keep muscle while losing fat.';
  return 'Within the 1.4–2.0 g/kg range recommended for people who exercise regularly.';
}

const MEAT = /\b(chicken|beef|pork|lamb|turkey|veal|ham|bacon|sausages?|duck|goat|mutton|venison|rabbit|liver|tripe|kidneys?|gizzards?|oxtails?|suya|meats?|lard|gelatin|gelatine|pepperoni|salami|chorizo|frankfurters?|hot dogs?|bologna|pastrami|jerky|game|quail|goose|pigeon|snail|stock, (beef|chicken)|broth, (beef|chicken)|bone broth)\b/i;
const FISH = /\b(fish|salmon|tuna|shrimps?|prawns?|crustaceans|mollusks|cod|sardines?|catfish|tilapia|mackerel|anchov(y|ies)|crabs?|lobsters?|oysters?|mussels?|clams?|scallops?|squid|octopus|crayfish|periwinkles?|herring|trout|haddock|hake|croaker|stockfish|seafood|calamari|worcestershire|caesar dressing|dashi|bonito)\b/i;
const ANIMAL = /\b(eggs?|milk|cheeses?|yogh?urts?|whey|casein|cream|butter|honey|ghee|mayonnaise|paneer|custard|kefir|buttermilk|lactose|pesto|mayo|mayonnaise|meringues?|lassi|tzatziki|labneh|ricotta|mozzarella|feta|parmesan)\b/i;
/** Plant foods whose names contain an animal word ("peanut butter", "soy milk", "eggplant" is fine already). */
const PLANT_ALIKE = /\b(vegetarian|vegan|veggie|plant-based|meat-free) (sausages?( rolls?)?|burgers?|mince|nuggets|bacon|hot dogs?)\b|\b(peanut|almond|cashew|nut|seed|shea|cocoa|apple|soy|soya|sunflower|groundnut|sesame)\s+butter\b|\b(coconut|soy|soya|almond|oat|rice|cashew|hemp|pea)\s+(milk|cream|yogh?urt|cheese)\b|\byogh?urt, (coconut|soy|almond)( milk)?\b|\bcheese substitute\b|\bvegan mayonnaise\b|\bmeatless\b|\bveggie\b|\bvegan\b|\bcream of tartar\b|\bplant-based\b|\b(non-?dairy|dairy-free)\b/gi;

const AVOID_RULES: Record<string, RegExp> = {
  Peanuts: /\bpeanut/i,
  'Tree nuts': /\b(almond|cashew|walnut|pecan|hazelnut|pistachio|macadamia|brazil nut|nuts?)\b/i,
  Dairy: /\b(milk|cheese|yogh?urt|cream|butter|whey|ghee|paneer)\b/i,
  Eggs: /\beggs?\b/i,
  Fish: FISH,
  Shellfish: /\b(shrimp|prawns?|crab|lobster|crustaceans?|mollusks?|mussels?|oysters?|clams?|squid|scallops?|crayfish)\b/i,
  Gluten: /\b(wheat|bread|pasta|spaghetti|macaroni|barley|rye|flour|couscous|noodles?|biscuits?|cake|pizza|chapati|naan|roti|pita)\b/i,
  Soy: /\b(soy|soya|tofu|edamame|miso|tempeh)\b/i,
  Sesame: /\b(sesame|tahini)\b/i,
  Pork: /\b(pork|ham|bacon|sausages?|lard|gammon)\b/i,
  Beef: /\bbeef\b/i,
  Alcohol: /\b(beer|wine|alcohol|spirits|vodka|whisky|rum|cider|lager)\b/i,
};
const PREF_AVOIDS: Record<string, string[]> = { Halal: ['Pork', 'Alcohol'], Kosher: ['Pork', 'Shellfish'], 'Gluten-free': ['Gluten'], 'Dairy-free': ['Dairy'] };

/** Whether a food fits everything the person picked: diet, extra preferences and allergies. */
export function fitsPrefs(food: Pick<Food, 'name' | 'per100'>, p: { diet?: Diet; dietPrefs?: string[]; avoid?: string[] } | null | undefined): boolean {
  if (!p) return true;
  if (!fitsDiet(food, p.diet)) return false;
  const avoid = new Set([...(p.avoid ?? []), ...(p.dietPrefs ?? []).flatMap((d) => PREF_AVOIDS[d] ?? [])]);
  for (const a of avoid) if (AVOID_RULES[a] ? AVOID_RULES[a].test(food.name) : allergensIn(food.name, [a]).length) return false;
  const prefs = p.dietPrefs ?? [];
  if ((prefs.includes('Keto') || prefs.includes('Low-carb')) && (food.per100.carbs ?? 0) > (prefs.includes('Keto') ? 5 : 15)) return false;
  if (prefs.includes('Low-sugar') && (food.per100.sugar ?? 0) > 10) return false;
  return true;
}

/**
 * Whether a food fits a diet, judged from its name and, for dishes, its ingredient list
 * (so egusi soup made with beef isn't called vegetarian). Used to tailor suggestions and the
 * Vegetarian / Vegan filter; it never hides anything from a plain search.
 */
export function fitsDiet(food: Pick<Food, 'name'> & { sourceNote?: string; recipe?: { ingredients: { name: string }[] } }, diet: Diet | undefined): boolean {
  if (!diet || diet === 'all') return true;
  const ingredients = food.recipe ? food.recipe.ingredients.map((i) => i.name).join('; ') : /standard recipe|^Your recipe/i.test(food.sourceNote ?? '') ? (food.sourceNote ?? '').replace(/\([^)]*version of [^)]*\)/, '') : ''; // "(vegan version of Goat pepper soup)" names the original dish, not an ingredient
  // Named as vegan / plant-based by its maker or recipe: trust that.
  if (/\b(vegan|plant-based|meatless)\b/i.test(food.name) && !ingredients) return true;
  const text = `${food.name}; ${ingredients}`.replace(PLANT_ALIKE, ' ');
  if (MEAT.test(text)) return false;
  if (diet === 'pescatarian') return true;
  if (FISH.test(text)) return false;
  if (diet === 'vegetarian') return true;
  return !ANIMAL.test(text);
}

/** "Vegan" / "Vegetarian" label for a food, or null. */
export const dietLabel = (food: Parameters<typeof fitsDiet>[0]): 'Vegan' | 'Vegetarian' | null => (fitsDiet(food, 'vegan') ? 'Vegan' : fitsDiet(food, 'vegetarian') ? 'Vegetarian' : null);
