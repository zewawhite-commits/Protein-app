// Builds public/data/recipes.json: the world recipe library (free for everyone).
// Ingredients and amounts come from recipes.mjs (official USDA/FAO records); method from recipe-steps.mjs.
// Nutrition is read in the app from each dish's food record (same id), so numbers always match the diary.
import { readFileSync, writeFileSync } from 'node:fs';
import { RECIPES } from './recipes-global.mjs';
import { STEPS } from './recipe-steps.mjs';

const ids = JSON.parse(readFileSync(new URL('./recipe-ids.json', import.meta.url))).ids;
const NAMES = [
  [/^Peppers, hot chili/, 'Chilli pepper (scotch bonnet or similar)'], [/^Peppers, sweet/, 'Bell pepper'], [/^Soup, stock/, 'Stock'],
  [/^Beverages, water|^Water, tap/, 'Water'], [/^Tomato products, canned, paste/, 'Tomato paste'], [/^Oil, vegetable/, 'Vegetable oil'],
  [/^Oil, palm/, 'Palm oil'], [/^Oil, olive/, 'Olive oil'], [/^Salt, table/, 'Salt'], [/^Sugars, granulated/, 'Sugar'], [/^Sugars, brown/, 'Brown sugar'],
  [/^Spices, curry powder/, 'Curry powder (or the dish’s spice mix)'], [/^Nuts, coconut milk|^Coconut milk/, 'Coconut milk'], [/^Crustaceans, shrimp/, 'Prawns'],
  [/^Shrimp, dried/, 'Dried shrimp or crayfish'], [/^Game meat, goat|^Goat meat/, 'Goat meat'], [/^Chicken, broilers or fryers/, 'Chicken'],
  [/^Cowpeas, common/, 'Black-eyed beans'], [/^Wheat flour, white/, 'Plain flour'], [/^Onions, raw/, 'Onion'], [/^Garlic, raw/, 'Garlic'],
  [/^Ginger root/, 'Fresh ginger'], [/^Tomatoes, red/, 'Tomatoes'], [/^Egg, whole/, 'Eggs'], [/^Butter, salted/, 'Butter'], [/^Milk, whole|^Milk, cow/, 'Milk'],
  [/^Lemon juice/, 'Lemon or lime juice'], [/^Spinach/, 'Spinach (or ugu / local greens)'], [/^African locust bean/, 'Locust beans (iru / ogiri)'],
  [/^Beef, variety meats/, 'Beef offal (shaki, cow foot)'], [/^Fish, cod/, 'Stockfish or dried fish'], [/^Melon seed/, 'Ground egusi (melon seed)'],
  [/^Beef, round/, 'Lean beef (stewing)'], [/^Beef, top sirloin/, 'Beef sirloin'], [/^Beef, ground/, 'Minced beef'], [/^Beef, brisket/, 'Beef brisket'], [/^Beef, chuck/, 'Beef short ribs'], [/^Beef, flank/, 'Beef flank'],
  [/^Pork, ground/, 'Minced pork'], [/^Lamb, ground/, 'Minced lamb'], [/^Pork, cured/, 'Bacon or ham'], [/^Pork, fresh/, 'Pork'], [/^Lamb, leg/, 'Lamb leg'], [/^Lamb, shoulder/, 'Lamb shoulder'],
  [/^Rice, white/, 'White rice'], [/^Rice noodles/, 'Rice noodles'], [/^Pasta/, 'Pasta'], [/^Potatoes, boiled/, 'Potatoes'], [/^Potatoes, baked/, 'Baking potato'], [/^Potato, roasted/, 'Potatoes'], [/^Potatoes, french fried/, 'Chips (fries)'],
  [/^Beans, kidney/, 'Red kidney beans'], [/^Beans, black/, 'Black beans'], [/^Beans, baked/, 'Baked beans'], [/^Lentils/, 'Lentils'], [/^Chickpeas/, 'Chickpeas'],
  [/^Yam, cooked/, 'Yam'], [/^Yam, tuber/, 'Yam (or yam flour)'], [/^Plantain, cooked with oil/, 'Ripe plantain, fried'], [/^Plantain, cooked/, 'Plantain'],
  [/^Carrots/, 'Carrots'], [/^Peas, green/, 'Green peas'], [/^Corn, sweet/, 'Sweetcorn'], [/^Cabbage/, 'Cabbage'], [/^Mushrooms/, 'Mushrooms'], [/^Okra/, 'Okra'], [/^Eggplant/, 'Aubergine'],
  [/^Cheese, Cheddar/, 'Cheddar'], [/^Fish, tilapia/, 'Tilapia (or other white fish)'], [/^Catfish/, 'Catfish'], [/^Bread, white/, 'White bread'], [/^Bread, pita/, 'Pitta bread'],
  [/^Yogurt, plain/, 'Plain yogurt'], [/^Yogurt, Greek/, 'Greek yogurt'], [/^Soy sauce/, 'Soy sauce'], [/^Fish sauce/, 'Fish sauce'],
];
const COOKED = /\b(cooked|boiled|braised|roasted|baked|steamed|french fried)\b/i;
function label(record) {
  for (const [re, n] of NAMES) if (re.test(record)) return n;
  const parts = record.split(',').map((s) => s.replace(/\(.*?\)/g, '').trim()).filter(Boolean);
  const skip = /^(raw|cooked|boiled|drained|without salt|with salt|all grades|regular|fresh|enriched|mature seeds|year round average)$/i;
  const words = [parts[0], ...parts.slice(1, 3).filter((p) => !skip.test(p) && p.length < 24)];
  const t = words.join(', ');
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
const SKIP = new Set(['Baguette']);
const out = RECIPES.filter((r) => !SKIP.has(r.name) && STEPS[r.name]).map((r) => {
  const serving = r.portions?.[0]?.[1] ?? 300;
  const [minutes, steps] = STEPS[r.name];
  return {
    id: ids[r.name], name: r.name, cuisine: r.cuisine, minutes, steps,
    servings: Math.max(1, Math.round(r.yield / serving)), servingLabel: r.portions?.[0]?.[0] ?? '1 serving', servingGrams: serving, yield: r.yield,
    ingredients: r.ingredients.map(([n, g]) => [label(n) + (COOKED.test(n) ? ' (cooked weight)' : ''), g]),
  };
});
if (out.some((r) => !r.id)) throw new Error('A recipe has no permanent id');
writeFileSync(new URL('../public/data/recipes.json', import.meta.url), JSON.stringify({ about: 'Nutivili world recipe library. Amounts from official food records; method written for the app.', recipes: out }));
console.log(`recipes.json: ${out.length} recipes`);
