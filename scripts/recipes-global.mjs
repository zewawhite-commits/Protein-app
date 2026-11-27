/**
 * International dishes, one serving each (Nov 2026 global expansion: the app had too few
 * non-Nigerian dishes). Same rules: every ingredient is an exact USDA / FAO / UK / AU record;
 * a dish's weight is what goes in (cooked components), so its values are a plain weighted sum.
 * Recipes follow common home / restaurant versions and are shown on every dish to check.
 * Dishes are generated from named families (curries, stir-fries, tacos…) with the protein
 * people actually choose; a name that already exists in the database is skipped.
 */
import { readFileSync } from 'node:fs';
import { RECIPES, K as BASE } from './recipes-world.mjs';

const K = {
  ...BASE,
  sour_cream: 'Cream, sour, cultured', cashews: 'Nuts, cashew nuts, raw', almonds: 'Nuts, almonds', oj: "Orange juice, raw (Includes foods for USDA's Food Distribution Program)",
  pineapple: 'Pineapple, raw', naan: 'Bread, naan', chili_powder: 'Spices, chili powder', coriander_seed: 'Spices, coriander seed', cinnamon: 'Spices, cinnamon, ground',
  fenugreek: 'Fenugreek leaves, raw', teriyaki: 'Sauce, teriyaki, ready-to-serve', sweet_sour: 'Sauce, sweet and sour, ready-to-serve', salsa: 'Sauce, salsa, ready-to-serve',
  pesto: 'Pesto sauce, homemade', marinara: 'Sauce, pasta, spaghetti/marinara, ready-to-serve', sriracha: 'Sauce, hot chile, sriracha', hoisin: 'Sauce, hoisin, ready-to-serve',
  somen: 'Noodles, japanese, somen, cooked', soba: 'Noodles, japanese, soba, cooked', duck_meat: 'Duck, domesticated, meat only, cooked, roasted',
  tuna_steak: 'Fish, tuna, yellowfin, fresh, cooked, dry heat', salmon_raw: 'Fish, salmon, Atlantic, farmed, raw', tuna_raw: 'Fish, tuna, fresh, yellowfin, raw',
  crab: 'Crustaceans, crab, blue, cooked, moist heat', squid: 'Mollusks, squid, mixed species, cooked, fried', mussels: 'Mollusks, mussel, blue, cooked, moist heat',
  clams: 'Mollusks, clam, mixed species, cooked, moist heat', ham_slice: 'Pork, cured, ham, slice, bone-in, separable lean only, unheated', italian_sausage: 'Italian sausage',
  pepperoni: 'Pepperoni, beef and pork, sliced', chorizo: 'Chorizo', ricotta: 'Cheese, ricotta, whole milk', goat_cheese: 'Cheese, goat, hard type', swiss: 'Cheese, swiss',
  blue_cheese: 'Cheese, blue', monterey: 'Cheese, monterey', provolone: 'Cheese, provolone', gouda: 'Cheese, gouda', pie_crust: 'Pie crust, standard-type, frozen, ready-to-bake, enriched',
  gnocchi: 'Gnocchi, potato', brown_rice: "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)", burger_bun: 'Rolls, hamburger or hot dog, wheat/cracked wheat',
  english_muffin: 'English muffins, plain, unenriched, with calcium propionate (includes sourdough)', waffle: 'Waffles, plain, frozen, ready -to-heat, toasted',
  pancake: 'Pancakes, plain, prepared from recipe', bagel: 'Bagels, plain, unenriched, without calcium propionate(includes onion, poppy, sesame)', croissant: 'Croissants',
  taco_shell: 'Taco shells, baked', refried: 'Refried beans', guacamole: 'Guacamole, homemade', mushrooms_raw: 'Mushrooms, white, raw', broccoli: 'Broccoli, cooked, boiled, drained, without salt',
  snow_peas: 'Peas, edible-podded, boiled, drained, without salt', carrots_raw: 'Carrots, raw', celery_raw: 'Celery, raw', iceberg: 'Lettuce, iceberg (includes crisphead types), raw',
  asparagus: 'Asparagus, cooked, boiled, drained', butternut: 'Squash, winter, butternut, cooked, baked, without salt', olives: 'Olives, ripe, canned (small-extra large)', capers: 'Capers, canned',
  pickles: 'Pickles, cucumber, dill or kosher dill', kale_raw: 'Kale, raw', arugula: 'Arugula, raw', beets: 'Beets, cooked, boiled, drained', bamboo: 'Bamboo shoots, canned, drained solids',
  wakame: 'Seaweed, wakame, raw', sesame: 'Seeds, sesame seeds, whole, dried', walnuts: 'Walnuts, excluding honey roasted', raisins: 'Raisins, golden, seedless', maple: 'Syrups, maple', oats: 'Cereals, oats, regular and quick, not fortified, dry',
  dark_choc: 'Chocolate, dark, 60-69% cacao solids', whipped: 'Cream, whipped', jam: 'Jam or marmalade', icing_sugar: 'Sugars, powdered', cornstarch: 'Cornstarch',
  beef_patty: 'Beef, ground, 80% lean meat / 20% fat, patty, cooked, pan-broiled', flank: 'Beef, flank, steak, separable lean only, trimmed to 0" fat, select, cooked, broiled',
  pot_roast: 'Beef, chuck, arm pot roast, separable lean only, trimmed to 0" fat, select, cooked, braised', shank: 'Beef, shank crosscuts, separable lean only, trimmed to 1/4" fat, choice, cooked, simmered',
  pork_ground: 'Pork, fresh, ground, cooked', pork_roast: 'Pork, fresh, shoulder, whole, separable lean and fat, cooked, roasted', lamb_chops: 'Lamb, loin chops, roasted, lean',
  veal_loin: 'Veal, loin, chop, separable lean only, cooked, grilled', turkey: 'Turkey, whole, meat only, cooked, roasted', turkey_mince: 'Turkey, ground, 93% lean, 7% fat, patties, broiled',
  chicken_fried: 'Chicken, broilers or fryers, breast, meat only, cooked, fried', egg_scrambled: 'Egg, whole, cooked, scrambled', egg_poached: 'Egg, whole, cooked, poached',
  buttermilk: 'Buttermilk', greek_yogurt_full: 'Yogurt, Greek, plain, whole milk', ghee: 'Ghee, butter', coconut_oil: 'Oil, coconut', balsamic: 'Vinegar, balsamic',
  mustard: 'Mustard, prepared, yellow', worcestershire: 'Worcestershire sauce', black_pepper: 'Spices, pepper, black', oregano: 'Spices, oregano, dried', rosemary: 'Rosemary, fresh',
  cardamom: 'Spices, cardamom', saffron: 'Spices, saffron', naan_ww: 'Bread, naan', corn_canned: 'Corn, sweet, yellow, canned, whole kernel, drained solids',
};
const key = (dish, k) => { if (!K[k]) throw new Error(`${dish}: unknown ingredient key ${k}`); return K[k]; };

// Existing names (database + recipes) are never duplicated.
const norm = (n) => n.toLowerCase().split(' (')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const taken = new Set([
  ...JSON.parse(readFileSync(new URL('../public/data/foods.json', import.meta.url), 'utf8')).foods.filter((r) => r[10] !== 'r').map((r) => norm(r[1])),
  ...RECIPES.map((r) => norm(r.name)),
]);
let added = 0, skipped = 0;
const NEW = [];
/** One serving of a dish, from cooked records; portions scale from that serving. */
function serve(name, cuisine, items, aliases = [], unit = 'serving') {
  if (taken.has(norm(name))) { skipped++; return; }
  taken.add(norm(name));
  const ingredients = items.filter(([, g]) => g > 0).map(([k, g]) => [key(name, k), g]);
  const total = ingredients.reduce((s, [, g]) => s + g, 0);
  NEW.push({ name, cuisine, aliases, yield: total, ingredients,
    portions: [[`1 ${unit}`, Math.round(total)], [`1 small ${unit}`, Math.round(total * 0.7)], [`1 large ${unit}`, Math.round(total * 1.35)]] });
  added++;
}

// Proteins as served in one portion (cooked records).
const P = {
  Chicken: [['chicken_thigh', 150]], Beef: [['beef', 150]], Lamb: [['lamb_shoulder', 150]], Pork: [['pork_shoulder', 150]], Prawn: [['shrimp', 130]],
  Fish: [['cod', 150]], Salmon: [['salmon', 150]], Tofu: [['tofu', 180]], Paneer: [['paneer', 130]], Vegetable: [['cauliflower', 70], ['peas', 50], ['carrots', 50], ['potato', 70]],
  Chickpea: [['chickpeas', 180]], Duck: [['duck_meat', 140]], Goat: [['goat', 150]], Mushroom: [['mushrooms', 180]], Egg: [['egg_boiled', 100]], Steak: [['beef_sirloin', 150]],
};
const PLANT = new Set(['Tofu', 'Vegetable', 'Chickpea', 'Mushroom']);
const vegan = (p, items) => (PLANT.has(p) ? items.map(([k, g]) => [k === 'fish_sauce' || k === 'oyster_sauce' ? 'soy' : k, g]) : items);
const withRice = (items, g = 250) => [...items, ['rice', g]];

// ---------------- South Asia ----------------
const IND = [['oil', 12], ['onion', 60], ['tomato', 50], ['garlic', 5], ['ginger', 5], ['curry', 4]];
const INDIAN = {
  korma: [[['cream', 40], ['cashews', 15], ['yogurt', 30], ['sugar', 3]], ['Chicken', 'Lamb', 'Beef', 'Prawn', 'Paneer', 'Vegetable']],
  vindaloo: [[['vinegar', 10], ['chili', 10], ['potato', 60], ['tomato_canned', 50]], ['Chicken', 'Lamb', 'Beef', 'Pork', 'Prawn', 'Vegetable']],
  jalfrezi: [[['green_pepper', 60], ['red_pepper', 40], ['tomato', 40], ['chili', 5]], ['Chicken', 'Lamb', 'Beef', 'Prawn', 'Paneer', 'Vegetable', 'Fish']],
  madras: [[['tomato_canned', 60], ['chili', 6], ['coconut_milk', 30]], ['Chicken', 'Lamb', 'Beef', 'Prawn', 'Fish', 'Vegetable']],
  'rogan josh': [[['yogurt', 40], ['tomato_canned', 60], ['paprika', 3]], ['Lamb', 'Chicken', 'Beef', 'Goat']],
  saag: [[['spinach', 120], ['cream', 15]], ['Chicken', 'Lamb', 'Paneer', 'Chickpea', 'Mushroom']],
  bhuna: [[['tomato_canned', 60], ['onion', 40]], ['Chicken', 'Lamb', 'Beef', 'Prawn', 'Goat', 'Mushroom']],
  dopiaza: [[['onion', 100]], ['Chicken', 'Lamb', 'Beef', 'Prawn']],
  balti: [[['green_pepper', 50], ['tomato_canned', 60], ['coriander', 5]], ['Chicken', 'Lamb', 'Beef', 'Prawn', 'Vegetable']],
  dhansak: [[['red_lentils', 100], ['pumpkin', 50], ['lemon', 5]], ['Chicken', 'Lamb', 'Prawn', 'Vegetable']],
  kadai: [[['green_pepper', 60], ['tomato', 60], ['coriander', 5]], ['Chicken', 'Paneer', 'Lamb', 'Mushroom']],
  methi: [[['fenugreek', 30], ['cream', 20]], ['Chicken', 'Lamb']],
  pasanda: [[['yogurt', 50], ['cream', 30], ['almonds', 15]], ['Chicken', 'Lamb']],
  'tikka masala': [[['tomato_canned', 80], ['cream', 40], ['yogurt', 20]], ['Lamb', 'Prawn', 'Paneer', 'Fish', 'Vegetable']],
  makhani: [[['tomato_canned', 80], ['butter', 15], ['cream', 40]], ['Paneer', 'Prawn', 'Vegetable']],
};
for (const [style, [sauce, proteins]] of Object.entries(INDIAN)) for (const p of proteins) {
  const nm = style === 'saag' ? `Saag ${p.toLowerCase()}` : style === 'makhani' ? `${p} makhani` : `${p} ${style}`;
  const items = [...IND, ...sauce, ...P[p]];
  serve(nm, 'Indian', items, [`${p.toLowerCase()} ${style} curry`]);
  if (['Chicken', 'Lamb', 'Prawn', 'Vegetable'].includes(p) && ['korma', 'vindaloo', 'jalfrezi', 'madras', 'rogan josh', 'tikka masala', 'bhuna'].includes(style)) serve(`${nm} with rice`, 'Indian', withRice(items, 220), [`${p.toLowerCase()} ${style} and rice`], 'plate');
}
for (const p of ['Chicken', 'Fish', 'Prawn', 'Paneer']) serve(`Tandoori ${p.toLowerCase()}`, 'Indian', [...P[p], ['yogurt', 30], ['lemon', 5], ['chili_powder', 3], ['oil', 5]]);
serve('Tandoori lamb chops', 'Indian', [['lamb_chops', 180], ['yogurt', 30], ['lemon', 5], ['chili_powder', 3]]);
for (const p of ['Prawn', 'Beef', 'Egg', 'Fish', 'Paneer', 'Mushroom']) serve(`${p} biryani`, 'Indian', [['rice', 300], ...P[p], ['yogurt', 25], ['onion', 40], ['oil', 15], ['curry', 5]], [`biryani with ${p.toLowerCase()}`], 'plate');
const IND_SINGLE = [
  ['Masala dosa', [['rice_short', 120], ['lentils', 40], ['potato', 120], ['onion', 30], ['oil', 15], ['curry', 2]], ['dosa', 'masala dosai']],
  ['Plain dosa', [['rice_short', 120], ['lentils', 40], ['oil', 10]], ['sada dosa']],
  ['Idli sambar', [['rice_short', 120], ['lentils', 60], ['red_lentils', 60], ['tomato', 40], ['pumpkin', 40], ['oil', 5]], ['idli with sambar']],
  ['Sambar', [['red_lentils', 120], ['tomato', 60], ['pumpkin', 50], ['onion', 40], ['tamarind', 10], ['oil', 8], ['curry', 4]], ['sambhar']],
  ['Poha', [['rice', 150], ['peanuts', 15], ['onion', 30], ['potato', 40], ['oil', 10], ['turmeric', 1], ['lemon', 5]], ['kanda poha']],
  ['Upma', [['semolina', 70], ['water', 150], ['onion', 30], ['peas', 30], ['oil', 10], ['peanuts', 10]], ['rava upma']],
  ['Aloo paratha', [['flour', 80], ['potato', 100], ['butter', 10], ['oil', 8], ['water', 40], ['chili', 2]], ['aloo ka paratha', 'potato paratha'], 'paratha'],
  ['Chole bhature', [['chickpeas', 200], ['tomato', 60], ['onion', 40], ['oil', 35], ['flour', 90], ['yogurt', 20], ['curry', 4]], ['chole bhatura'], 'plate'],
  ['Dal makhani', [['kidney', 60], ['lentils', 120], ['butter', 15], ['cream', 25], ['tomato_canned', 50], ['onion', 30]], ['daal makhani']],
  ['Dal tadka', [['red_lentils', 180], ['ghee', 10], ['onion', 30], ['tomato', 40], ['garlic', 5], ['cumin', 2]], ['tadka dal', 'yellow dal']],
  ['Rajma chawal', [['kidney', 180], ['tomato', 60], ['onion', 40], ['oil', 10], ['rice', 220]], ['rajma rice'], 'plate'],
  ['Matar paneer', [['paneer', 120], ['peas', 100], ['tomato_canned', 80], ['onion', 50], ['oil', 12], ['cream', 15], ['curry', 4]], ['mutter paneer']],
  ['Malai kofta', [['paneer', 80], ['potato', 100], ['cream', 50], ['tomato_canned', 80], ['cashews', 15], ['oil', 25], ['flour', 10]], ['malai kofta curry']],
  ['Baingan bharta', [['eggplant', 250], ['tomato', 60], ['onion', 50], ['oil', 15], ['garlic', 5]], ['baingan ka bharta']],
  ['Bhindi masala', [['okra', 200], ['onion', 60], ['tomato', 50], ['oil', 15], ['curry', 3]], ['okra masala', 'bhindi fry']],
  ['Egg curry', [['egg_boiled', 120], ['tomato_canned', 80], ['onion', 60], ['oil', 15], ['curry', 4], ['coconut_milk', 30]], ['anda curry']],
  ['Kerala fish curry', [['fish', 150], ['coconut_milk', 100], ['tamarind', 8], ['onion', 40], ['tomato', 40], ['oil', 10], ['chili_powder', 3]], ['meen curry', 'fish molee']],
  ['Keema matar', [['lamb_mince', 150], ['peas', 80], ['onion', 50], ['tomato', 50], ['oil', 10], ['curry', 4]], ['keema mutter', 'mince and peas curry']],
  ['Chicken tikka', [['chicken_breast', 180], ['yogurt', 30], ['lemon', 5], ['chili_powder', 3], ['oil', 5]], ['chicken tikka kebab']],
  ['Chicken 65', [['chicken_fried', 180], ['yogurt', 20], ['flour', 15], ['oil', 20], ['chili', 5]], ['chicken sixty five']],
  ['Butter chicken with naan', [['chicken_thigh', 150], ['tomato_canned', 80], ['butter', 15], ['cream', 40], ['naan', 90]], ['butter chicken and naan'], 'plate'],
  ['Chicken curry with rice', [...IND, ['chicken_thigh', 150], ['tomato_canned', 60], ['rice', 220]], ['chicken curry and rice', 'curry chicken rice'], 'plate'],
  ['Dal bhat', [['red_lentils', 150], ['rice', 250], ['spinach', 60], ['oil', 10], ['onion', 20]], ['dal bhat tarkari'], 'plate'],
  ['Thukpa', [['egg_noodles', 200], ['chicken_stewed', 100], ['cabbage', 40], ['carrots', 30], ['stock', 250], ['ginger', 5]], ['tibetan noodle soup'], 'bowl'],
  ['Chicken handi', [['chicken_thigh', 160], ['yogurt', 40], ['cream', 25], ['onion', 50], ['tomato', 50], ['oil', 15], ['curry', 4]], ['handi chicken']],
  ['Aloo keema', [['beef_mince', 140], ['potato', 120], ['onion', 50], ['tomato', 50], ['oil', 12], ['curry', 4]], ['keema aloo']],
  ['Daal chawal', [['red_lentils', 160], ['rice', 250], ['oil', 10], ['onion', 20]], ['dal chawal', 'lentils and rice pakistani'], 'plate'],
  ['Chicken pulao', [['rice', 280], ['chicken_thigh', 130], ['onion', 40], ['oil', 15], ['stock', 50]], ['murgh pulao', 'yakhni pulao'], 'plate'],
  ['Shorshe ilish', [['mackerel', 160], ['oil', 15], ['mustard', 15], ['chili', 3], ['turmeric', 1]], ['hilsa in mustard sauce', 'sorshe ilish']],
  ['Beef bhuna (Bangladeshi)', [['beef', 160], ['onion', 70], ['oil', 15], ['tomato', 40], ['curry', 5]], ['gorur mangsho bhuna']],
  ['Chicken rezala', [['chicken_thigh', 160], ['yogurt', 50], ['cashews', 15], ['onion', 50], ['ghee', 10]], ['murgir rezala']],
  ['Lamprais', [['rice', 200], ['chicken_thigh', 60], ['beef', 50], ['egg_boiled', 50], ['eggplant', 40], ['coconut_milk', 30]], ['lump rice'], 'parcel'],
  ['Fish ambul thiyal', [['tuna_steak', 160], ['tamarind', 10], ['black_pepper', 3], ['oil', 8]], ['sour fish curry sri lanka']],
  ['Chicken kottu', [['flour_tortilla', 120], ['chicken_thigh', 100], ['egg', 50], ['cabbage', 50], ['carrots', 30], ['oil', 15], ['curry', 3]], ['chicken kottu roti']],
  ['Egg hoppers', [['rice_short', 80], ['coconut_milk', 40], ['egg', 50]], ['appa', 'appam with egg'], 'hopper'],
  ['Samosa chaat', [['potato', 80], ['flour', 50], ['oil', 25], ['chickpeas', 80], ['yogurt', 40], ['tamarind', 10]], ['samosa chat']],
  ['Pani puri', [['flour', 40], ['oil', 15], ['potato', 50], ['chickpeas', 30], ['tamarind', 10], ['water', 100]], ['golgappa', 'puchka'], 'plate (6)'],
  ['Pav bhaji with butter', [['potato', 150], ['cauliflower', 40], ['peas', 40], ['tomato', 50], ['butter', 25], ['bread', 120]], ['butter pav bhaji'], 'plate'],
  ['Mango lassi', [['yogurt', 150], ['mango', 100], ['milk', 50], ['sugar', 10]], ['lassi'], 'glass'],
  ['Kheer', [['milk', 200], ['rice', 40], ['sugar', 20], ['cardamom', 1], ['almonds', 8]], ['rice pudding indian', 'payasam'], 'bowl'],
  ['Gulab jamun', [['milk', 30], ['flour', 20], ['ghee', 10], ['sugar', 40], ['water', 20]], ['gulab jamun sweets'], 'serving (2)'],
];
for (const [n, items, al, u] of IND_SINGLE) serve(n, 'South Asian', items, al, u);

// ---------------- South-East & East Asia ----------------
const THAI_BASE = [['coconut_milk2', 150], ['fish_sauce', 10], ['sugar', 5], ['basil', 3], ['oil', 5]];
const THAI_CURRY = {
  'green curry': [['chili', 10], ['eggplant', 50], ['bamboo', 40]], 'red curry': [['chili', 10], ['bamboo', 40], ['red_pepper', 40]],
  'yellow curry': [['curry', 5], ['potato', 80], ['onion', 40]], 'panang curry': [['peanuts', 15], ['red_pepper', 30]],
  'massaman curry': [['potato', 80], ['peanuts', 15], ['onion', 40], ['tamarind', 10]],
};
for (const [style, extra] of Object.entries(THAI_CURRY)) for (const p of ['Chicken', 'Beef', 'Pork', 'Prawn', 'Tofu', 'Duck', 'Vegetable', 'Fish']) {
  if (style === 'massaman curry' && ['Duck', 'Fish'].includes(p)) continue;
  const items = vegan(p, [...THAI_BASE, ...extra, ...P[p]]);
  serve(`Thai ${style} with ${p.toLowerCase()}`, 'Thai', items, [`${p.toLowerCase()} ${style}`, `gaeng ${style.split(' ')[0]} ${p.toLowerCase()}`]);
  if (['Chicken', 'Beef', 'Prawn', 'Tofu'].includes(p)) serve(`Thai ${style} with ${p.toLowerCase()} and rice`, 'Thai', withRice(items, 200), [], 'plate');
}
for (const p of ['Chicken', 'Beef', 'Pork', 'Prawn', 'Tofu']) {
  serve(`Jungle curry with ${p.toLowerCase()}`, 'Thai', vegan(p, [['bamboo', 50], ['green_beans', 50], ['eggplant', 50], ['chili', 10], ['fish_sauce', 10], ['water', 150], ['oil', 8], ...P[p]]), ['gaeng pa']);
}
const THAI_STIR = {
  'Pad krapow': [[['basil', 8], ['chili', 5], ['oyster_sauce', 15], ['fish_sauce', 8], ['oil', 15], ['egg_fried', 50], ['rice', 250]], ['Pork', 'Beef', 'Prawn', 'Tofu'], ['holy basil stir fry', 'kra pao']],
  'Cashew stir-fry': [[['cashews', 30], ['onion', 40], ['red_pepper', 40], ['oyster_sauce', 15], ['oil', 15], ['rice', 250]], ['Chicken', 'Prawn', 'Tofu'], ['kai pad med mamuang', 'cashew nut']],
  'Garlic pepper stir-fry': [[['garlic', 15], ['black_pepper', 2], ['oyster_sauce', 15], ['oil', 15], ['rice', 250]], ['Chicken', 'Pork', 'Prawn', 'Beef'], ['pad kratiem']],
  'Ginger stir-fry': [[['ginger', 20], ['onion', 40], ['mushrooms', 40], ['oyster_sauce', 15], ['oil', 15], ['rice', 250]], ['Chicken', 'Beef', 'Tofu'], ['pad king']],
  'Sweet chilli stir-fry': [[['sweet_sour', 40], ['red_pepper', 50], ['onion', 30], ['oil', 15], ['rice', 250]], ['Chicken', 'Prawn', 'Tofu'], []],
  'Pad see ew': [[['rice_noodles', 250], ['pak_choi', 60], ['egg', 50], ['soy', 20], ['oyster_sauce', 10], ['oil', 15]], ['Chicken', 'Beef', 'Pork', 'Tofu'], ['phat si io']],
  'Pad thai': [[['rice_noodles', 250], ['sprouts_cooked', 50], ['egg', 50], ['peanuts', 20], ['tamarind', 15], ['fish_sauce', 12], ['sugar', 10], ['oil', 15]], ['Chicken', 'Prawn', 'Beef'], []],
  'Drunken noodles': [[['rice_noodles', 250], ['basil', 8], ['chili', 6], ['red_pepper', 40], ['oyster_sauce', 15], ['soy', 10], ['oil', 15]], ['Chicken', 'Beef', 'Prawn', 'Tofu'], ['pad kee mao']],
  'Thai fried rice': [[['rice', 300], ['egg', 50], ['onion', 30], ['fish_sauce', 10], ['oil', 15], ['lime', 5]], ['Prawn', 'Pork', 'Beef', 'Tofu'], ['khao pad']],
};
for (const [base, [items, proteins, al]] of Object.entries(THAI_STIR)) for (const p of proteins) serve(`${base} with ${p.toLowerCase()}`, 'Thai', vegan(p, [...items, ...P[p]]), al.map((a) => `${a} ${p.toLowerCase()}`), 'plate');
serve('Crab fried rice', 'Thai', [['rice', 300], ['crab', 100], ['egg', 50], ['fish_sauce', 10], ['oil', 15]], ['khao pad poo'], 'plate');
serve('Pineapple fried rice', 'Thai', [['rice', 300], ['pineapple', 80], ['shrimp', 60], ['cashews', 15], ['egg', 40], ['curry', 3], ['oil', 15]], ['khao pad sapparot'], 'plate');
serve('Tom kha gai', 'Thai', [['chicken_stewed', 120], ['coconut_milk2', 150], ['mushrooms', 60], ['lemongrass', 10], ['lime', 10], ['fish_sauce', 8], ['water', 100]], ['coconut chicken soup'], 'bowl');
serve('Thai beef salad', 'Thai', [['beef_sirloin', 130], ['lettuce', 60], ['tomato', 50], ['cucumber', 50], ['onion', 20], ['lime', 15], ['fish_sauce', 10], ['mint', 3]], ['yam neua']);
serve('Moo ping', 'Thai', [['pork_shoulder', 150], ['soy', 10], ['sugar', 8], ['coconut_milk', 15], ['sticky_rice', 150]], ['thai grilled pork skewers'], 'plate');
serve('Khao man gai', 'Thai', [['chicken_stewed', 150], ['rice', 250], ['oil', 8], ['ginger', 5], ['soy', 10], ['cucumber', 30]], ['thai chicken rice'], 'plate');
serve('Hainanese chicken rice', 'Singaporean', [['chicken_stewed', 150], ['rice', 250], ['oil', 10], ['ginger', 5], ['soy', 10], ['cucumber', 30]], ['chicken rice singapore'], 'plate');

const CHINESE = {
  'Kung pao': [[['peanuts', 20], ['chili', 5], ['soy', 15], ['green_pepper', 40], ['onion', 30], ['sugar', 5], ['oil', 15]], ['Chicken', 'Prawn', 'Tofu', 'Beef']],
  'Sweet and sour': [[['sweet_sour', 80], ['pineapple', 50], ['red_pepper', 40], ['green_pepper', 30], ['onion', 30], ['flour', 15], ['oil', 20]], ['Chicken', 'Pork', 'Prawn', 'Tofu']],
  'Black bean': [[['soy', 15], ['oyster_sauce', 10], ['green_pepper', 50], ['onion', 50], ['oil', 15]], ['Chicken', 'Beef', 'Prawn']],
  Szechuan: [[['chili', 8], ['soy', 15], ['red_pepper', 50], ['onion', 30], ['sugar', 4], ['oil', 15]], ['Chicken', 'Beef', 'Prawn', 'Tofu']],
  'Garlic': [[['garlic', 15], ['soy', 15], ['broccoli', 60], ['oil', 15], ['cornstarch', 5]], ['Chicken', 'Prawn', 'Beef']],
  'Ginger and spring onion': [[['ginger', 15], ['onion', 40], ['soy', 15], ['oyster_sauce', 10], ['oil', 15]], ['Beef', 'Chicken', 'Fish']],
  'Honey chilli': [[['honey', 25], ['chili', 5], ['flour', 20], ['oil', 25], ['red_pepper', 30]], ['Chicken', 'Beef']],
  'Salt and pepper': [[['black_pepper', 3], ['chili', 5], ['onion', 30], ['flour', 20], ['oil', 25]], ['Chicken', 'Prawn', 'Tofu']],
  'Lemon': [[['lemon', 20], ['sugar', 15], ['flour', 25], ['oil', 25], ['cornstarch', 5]], ['Chicken']],
  'Orange': [[['oj', 40], ['sugar', 12], ['soy', 10], ['flour', 25], ['oil', 25]], ['Chicken', 'Beef']],
  'Broccoli': [[['broccoli', 120], ['oyster_sauce', 15], ['soy', 10], ['garlic', 5], ['oil', 12]], ['Beef', 'Chicken']],
};
for (const [style, [items, proteins]] of Object.entries(CHINESE)) for (const p of proteins) {
  const nm = style === 'Broccoli' ? `${p} and broccoli` : style === 'Garlic' || style === 'Lemon' || style === 'Orange' || style === 'Honey chilli' || style === 'Salt and pepper' ? `${style} ${p.toLowerCase()}` : `${style} ${p.toLowerCase()}`;
  serve(nm, 'Chinese', vegan(p, [...items, ...P[p]]), [`${p.toLowerCase()} in ${style.toLowerCase()} sauce`]);
  if (['Chicken', 'Beef', 'Prawn'].includes(p) && ['Kung pao', 'Sweet and sour', 'Black bean', 'Szechuan'].includes(style)) serve(`${nm} with rice`, 'Chinese', withRice(vegan(p, [...items, ...P[p]]), 220), [], 'plate');
}
for (const p of ['Chicken', 'Beef', 'Prawn', 'Vegetable', 'Pork']) {
  serve(`${p} chow mein`, 'Chinese', [['chow_mein_noodles', 60], ['egg_noodles', 180], ['cabbage', 50], ['sprouts_cooked', 40], ['onion', 30], ['soy', 20], ['oil', 15], ...P[p]], [`chow mein ${p.toLowerCase()}`], 'plate');
  serve(`${p} lo mein`, 'Chinese', [['egg_noodles', 250], ['pak_choi', 50], ['carrots', 30], ['soy', 20], ['oyster_sauce', 10], ['oil', 12], ...P[p]], [], 'plate');
}
serve('Special chow mein', 'Chinese', [['egg_noodles', 240], ['chicken_breast', 50], ['shrimp', 50], ['pork_shoulder', 40], ['cabbage', 40], ['sprouts_cooked', 40], ['soy', 20], ['oil', 15]], ['house special chow mein'], 'plate');
for (const p of ['Beef', 'Pork', 'Chicken']) serve(`${p} fried rice`, 'Chinese', [['rice', 300], ['egg', 50], ['peas', 40], ['soy', 15], ['oil', 15], ...P[p]], [`fried rice with ${p.toLowerCase()}`], 'plate');
serve('Special fried rice', 'Chinese', [['rice', 300], ['egg', 50], ['shrimp', 50], ['chicken_breast', 50], ['pork_shoulder', 40], ['peas', 40], ['soy', 15], ['oil', 15]], ['yangzhou fried rice', 'house special fried rice'], 'plate');
const CN_SINGLE = [
  ['Mongolian beef', [['beef_sirloin', 160], ['soy', 20], ['sugar', 15], ['onion', 40], ['oil', 15], ['cornstarch', 8]], []],
  ['Crispy chilli beef', [['beef_sirloin', 140], ['flour', 25], ['oil', 25], ['sweet_sour', 40], ['chili', 5], ['red_pepper', 30]], ['crispy shredded beef']],
  ['Char siu pork with rice', [['pork_tenderloin', 150], ['hoisin', 20], ['honey', 10], ['soy', 10], ['rice', 250], ['pak_choi', 50]], ['bbq pork rice', 'cha siu fan'], 'plate'],
  ['Twice-cooked pork', [['pork_belly', 0], ['pork_shoulder', 150], ['green_pepper', 50], ['cabbage', 50], ['chili', 5], ['soy', 15], ['oil', 15]], ['hui guo rou']],
  ['Dan dan noodles', [['egg_noodles', 220], ['pork_ground', 80], ['peanut_butter', 15], ['soy', 15], ['chili', 5], ['pak_choi', 40], ['sesame_oil', 8]], ['dandan mian'], 'bowl'],
  ['Hot and sour soup', [['tofu', 60], ['mushrooms', 40], ['bamboo', 30], ['egg', 30], ['vinegar', 15], ['soy', 10], ['stock', 250], ['cornstarch', 8]], ['suan la tang'], 'bowl'],
  ['Wonton soup', [['flour', 40], ['pork_ground', 60], ['shrimp', 30], ['pak_choi', 40], ['stock', 300], ['soy', 5]], ['wanton soup'], 'bowl'],
  ['Egg drop soup', [['egg', 50], ['stock', 300], ['cornstarch', 8], ['onion', 10]], ['egg flower soup'], 'bowl'],
  ['Chicken and sweetcorn soup', [['chicken_stewed', 60], ['corn', 80], ['egg', 30], ['stock', 250], ['cornstarch', 8]], ['chicken corn soup'], 'bowl'],
  ['Pork and chive dumplings', [['flour', 90], ['pork_ground', 90], ['onion', 20], ['soy', 8], ['sesame_oil', 5], ['water', 40]], ['jiaozi', 'chinese dumplings'], 'serving (8)'],
  ['Steamed fish with ginger and soy', [['cod', 180], ['ginger', 10], ['soy', 15], ['onion', 15], ['oil', 8]], ['cantonese steamed fish']],
  ['Chicken congee', [['rice', 120], ['water', 250], ['chicken_stewed', 70], ['ginger', 5], ['onion', 10]], ['chicken jook', 'rice porridge with chicken'], 'bowl'],
  ['Pork congee', [['rice', 120], ['water', 250], ['pork_ground', 60], ['egg_boiled', 30], ['ginger', 5]], ['century egg congee', 'pork jook'], 'bowl'],
  ['Beef ho fun', [['rice_noodles', 250], ['beef_sirloin', 100], ['sprouts_cooked', 50], ['soy', 20], ['oil', 15], ['onion', 20]], ['gon chow ngau ho'], 'plate'],
  ['Scallion pancake', [['flour', 80], ['onion', 25], ['oil', 20], ['water', 45]], ['cong you bing'], 'pancake'],
  ['Xiaolongbao', [['flour', 80], ['pork_ground', 90], ['stock', 40], ['ginger', 3], ['soy', 5]], ['soup dumplings'], 'serving (6)'],
];
for (const [n, items, al, u] of CN_SINGLE) serve(n, 'Chinese', items, al, u);

const JP = [
  ...['Chicken', 'Beef', 'Salmon', 'Tofu'].map((p) => [`${p} teriyaki with rice`, [...P[p], ['teriyaki', 30], ['rice', 220], ['broccoli', 50]], [`${p.toLowerCase()} teriyaki`], 'plate']),
  ['Chicken katsu curry', [['chicken_fried', 160], ['breadcrumbs', 20], ['rice', 220], ['potato', 50], ['carrots', 30], ['onion', 30], ['curry', 5], ['flour', 10], ['oil', 15]], ['katsu curry chicken'], 'plate'],
  ['Pork katsu curry', [['pork_tenderloin', 150], ['breadcrumbs', 20], ['oil', 20], ['rice', 220], ['potato', 50], ['carrots', 30], ['curry', 5], ['flour', 10]], ['tonkatsu curry'], 'plate'],
  ['Tonkatsu', [['pork_tenderloin', 160], ['breadcrumbs', 25], ['egg', 20], ['flour', 10], ['oil', 20], ['cabbage', 60]], ['pork cutlet japanese']],
  ['Gyudon', [['beef_sirloin', 120], ['onion', 60], ['soy', 15], ['sugar', 8], ['rice', 250]], ['beef bowl', 'gyu don'], 'bowl'],
  ['Katsudon', [['pork_tenderloin', 120], ['breadcrumbs', 20], ['oil', 15], ['egg', 50], ['onion', 40], ['soy', 15], ['rice', 250]], ['katsu don'], 'bowl'],
  ['Chicken karaage', [['chicken_thigh', 180], ['flour', 15], ['cornstarch', 10], ['soy', 10], ['oil', 20], ['ginger', 3]], ['japanese fried chicken']],
  ...[['Shoyu', [['soy', 20]]], ['Miso', [['miso', 30]]], ['Tonkotsu', [['pork_shoulder', 0], ['cream', 0], ['butter', 5], ['milk', 40]]], ['Shio', [['salt', 3]]]].map(([s, x]) => [`${s} ramen`, [['egg_noodles', 220], ['pork_tenderloin', 80], ['egg_boiled', 50], ['stock', 350], ['onion', 10], ['laver', 2], ...x], [`${s.toLowerCase()} ramen bowl`], 'bowl']),
  ['Chicken ramen', [['egg_noodles', 220], ['chicken_stewed', 100], ['egg_boiled', 50], ['stock', 350], ['soy', 15], ['onion', 10]], ['tori paitan'], 'bowl'],
  ['Vegetable ramen', [['egg_noodles', 220], ['tofu', 80], ['mushrooms', 60], ['pak_choi', 50], ['miso', 25], ['water', 350]], ['veggie ramen'], 'bowl'],
  ...['Chicken', 'Pork', 'Vegetable'].map((p) => [`${p} yakisoba`, [['egg_noodles', 220], ...P[p], ['cabbage', 60], ['carrots', 30], ['worcestershire', 15], ['oil', 12]], [`yakisoba ${p.toLowerCase()}`], 'plate']),
  ...['Chicken', 'Beef', 'Pork', 'Vegetable'].map((p) => [`Japanese ${p.toLowerCase()} curry with rice`, [...P[p], ['potato', 70], ['carrots', 40], ['onion', 40], ['curry', 6], ['flour', 12], ['butter', 10], ['rice', 230]], [`${p.toLowerCase()} kare raisu`], 'plate']),
  ['Salmon sushi roll', [['rice_short', 150], ['salmon_raw', 50], ['laver', 3], ['vinegar', 10], ['sugar', 5]], ['salmon maki'], 'roll (8 pieces)'],
  ['Tuna sushi roll', [['rice_short', 150], ['tuna_raw', 50], ['laver', 3], ['vinegar', 10], ['sugar', 5]], ['tekka maki', 'tuna maki'], 'roll (8 pieces)'],
  ['California roll', [['rice_short', 150], ['crab', 40], ['avocado', 30], ['cucumber', 20], ['laver', 3], ['vinegar', 10], ['sesame', 3]], ['california maki'], 'roll (8 pieces)'],
  ['Prawn tempura roll', [['rice_short', 150], ['shrimp', 50], ['flour', 15], ['oil', 10], ['laver', 3], ['vinegar', 10]], ['ebi tempura roll'], 'roll (8 pieces)'],
  ['Salmon nigiri', [['rice_short', 100], ['salmon_raw', 70], ['vinegar', 6], ['sugar', 3]], ['sake nigiri'], 'serving (4 pieces)'],
  ['Salmon sashimi', [['salmon_raw', 100], ['soy', 10]], ['sake sashimi'], 'serving (6 slices)'],
  ['Tuna sashimi', [['tuna_raw', 100], ['soy', 10]], ['maguro sashimi'], 'serving (6 slices)'],
  ['Salmon poke bowl', [['rice_short', 200], ['salmon_raw', 100], ['avocado', 40], ['cucumber', 40], ['soy', 15], ['sesame', 5], ['wakame', 20]], ['poke salmon'], 'bowl'],
  ['Tuna poke bowl', [['rice_short', 200], ['tuna_raw', 100], ['avocado', 40], ['cucumber', 40], ['soy', 15], ['sesame', 5], ['wakame', 20]], ['ahi poke'], 'bowl'],
  ['Tofu poke bowl', [['rice_short', 200], ['tofu', 120], ['avocado', 40], ['cucumber', 40], ['soy', 15], ['sesame', 5], ['wakame', 20]], ['vegan poke bowl'], 'bowl'],
  ['Prawn tempura', [['shrimp', 120], ['flour', 30], ['egg', 15], ['oil', 20]], ['ebi tempura']],
  ['Vegetable tempura', [['sweet_potato', 60], ['eggplant', 50], ['green_pepper', 40], ['flour', 35], ['oil', 25]], ['yasai tempura']],
  ['Miso glazed salmon', [['salmon', 160], ['miso', 15], ['sugar', 5], ['rice', 200]], ['salmon miso'], 'plate'],
  ['Agedashi tofu', [['tofu', 200], ['cornstarch', 15], ['oil', 15], ['soy', 15], ['stock', 60]], ['agedashi dofu']],
  ['Soba noodles with tofu', [['soba', 220], ['tofu', 80], ['soy', 20], ['onion', 10], ['water', 100]], ['zaru soba', 'cold soba'], 'bowl'],
];
for (const [n, items, al, u] of JP) serve(n, 'Japanese', items, al, u);

const KR = [
  ...['Beef', 'Chicken', 'Tofu', 'Vegetable'].map((p) => [`${p} bibimbap`, [['rice', 250], ...P[p], ['spinach', 40], ['carrots', 30], ['sprouts_cooked', 30], ['egg_fried', 50], ['sriracha', 15], ['sesame_oil', 5]], [`bibimbap ${p.toLowerCase()}`], 'bowl']),
  ['Dak galbi', [['chicken_thigh', 160], ['cabbage', 60], ['sweet_potato', 60], ['sriracha', 20], ['soy', 10], ['oil', 10]], ['spicy chicken stir fry korean']],
  ['Jeyuk bokkeum', [['pork_shoulder', 150], ['onion', 50], ['sriracha', 20], ['soy', 10], ['sugar', 6], ['oil', 10]], ['spicy pork bulgogi']],
  ['Kimchi fried rice', [['rice', 280], ['kimchi', 80], ['pork_shoulder', 40], ['egg_fried', 50], ['oil', 12], ['soy', 5]], ['kimchi bokkeumbap'], 'plate'],
  ['Sundubu jjigae', [['tofu', 200], ['shrimp', 40], ['egg', 50], ['sriracha', 15], ['stock', 250], ['onion', 20]], ['soft tofu stew'], 'bowl'],
  ['Doenjang jjigae', [['tofu', 120], ['zucchini', 60], ['potato', 50], ['miso', 30], ['onion', 30], ['water', 250]], ['soybean paste stew'], 'bowl'],
  ['Bulgogi rice bowl', [['beef_sirloin', 130], ['soy', 15], ['sugar', 8], ['onion', 40], ['rice', 250], ['sesame_oil', 5]], ['bulgogi bowl'], 'bowl'],
  ['Haemul pajeon', [['flour', 70], ['egg', 30], ['shrimp', 40], ['squid', 30], ['onion', 40], ['oil', 20], ['water', 60]], ['seafood pancake korean'], 'pancake'],
  ['Kimchi pancake', [['flour', 70], ['kimchi', 80], ['oil', 20], ['water', 60]], ['kimchijeon'], 'pancake'],
  ['Korean beef short ribs with rice', [['beef_brisket', 160], ['soy', 15], ['sugar', 10], ['pineapple', 20], ['rice', 220]], ['galbi plate'], 'plate'],
  ['Samgyetang', [['chicken_stewed', 200], ['rice_short', 50], ['garlic', 10], ['ginger', 5], ['water', 300]], ['ginseng chicken soup'], 'bowl'],
];
for (const [n, items, al, u] of KR) serve(n, 'Korean', items, al, u);

const SEA = [
  ['Beef pho', 'Vietnamese', [['rice_noodles', 220], ['beef_sirloin', 100], ['stock', 400], ['onion', 20], ['sprouts_cooked', 30], ['basil', 3], ['lime', 5]], ['pho bo'], 'bowl'],
  ['Chicken pho', 'Vietnamese', [['rice_noodles', 220], ['chicken_stewed', 110], ['stock', 400], ['onion', 20], ['sprouts_cooked', 30], ['lime', 5]], ['pho ga'], 'bowl'],
  ['Bun bo hue', 'Vietnamese', [['rice_noodles', 220], ['beef', 100], ['pork_shoulder', 40], ['lemongrass', 10], ['chili', 5], ['stock', 400]], ['hue beef noodle soup'], 'bowl'],
  ['Bun thit nuong', 'Vietnamese', [['rice_noodles', 200], ['pork_shoulder', 120], ['lettuce', 40], ['cucumber', 30], ['peanuts', 10], ['fish_sauce', 20], ['sugar', 8]], ['grilled pork vermicelli'], 'bowl'],
  ['Chicken banh mi', 'Vietnamese', [['baguette', 100], ['chicken_thigh', 90], ['carrots_raw', 25], ['cucumber', 20], ['coriander', 3], ['mayo', 10], ['soy', 5]], ['banh mi ga'], 'sandwich'],
  ['Tofu banh mi', 'Vietnamese', [['baguette', 100], ['tofu', 100], ['carrots_raw', 25], ['cucumber', 20], ['coriander', 3], ['soy', 8]], ['vegan banh mi'], 'sandwich'],
  ['Com ga', 'Vietnamese', [['chicken_stewed', 140], ['rice', 250], ['ginger', 5], ['fish_sauce', 10], ['cucumber', 30]], ['vietnamese chicken rice'], 'plate'],
  ['Bo luc lac', 'Vietnamese', [['beef_sirloin', 150], ['onion', 40], ['soy', 10], ['oyster_sauce', 10], ['butter', 8], ['lettuce', 40], ['tomato', 40]], ['shaking beef']],
  ['Ca kho to', 'Vietnamese', [['catfish', 160], ['fish_sauce', 15], ['sugar', 12], ['onion', 20], ['black_pepper', 2]], ['caramelised fish clay pot']],
  ['Canh chua', 'Vietnamese', [['catfish', 100], ['pineapple', 50], ['tomato', 50], ['sprouts_cooked', 40], ['tamarind', 10], ['water', 300]], ['vietnamese sour soup'], 'bowl'],
  ['Fresh spring rolls with prawn', 'Vietnamese', [['rice_noodles', 60], ['shrimp', 60], ['lettuce', 30], ['mint', 3], ['carrots_raw', 20], ['hoisin', 15]], ['goi cuon tom'], 'serving (2 rolls)'],
  ...['Chicken', 'Beef', 'Lamb'].map((p) => [`${p} satay`, 'Malaysian / Indonesian', [...P[p], ['peanut_butter', 25], ['coconut_milk', 30], ['soy', 10], ['sugar', 6], ['cucumber', 30]], [`sate ${p.toLowerCase()}`, 'satay skewers'], 'serving (5 skewers)']),
  ['Chicken rendang', 'Indonesian', [['chicken_thigh', 160], ['coconut_milk', 80], ['lemongrass', 5], ['chili', 8], ['onion', 30], ['oil', 10]], ['rendang ayam']],
  ['Seafood nasi goreng', 'Indonesian', [['rice', 280], ['shrimp', 60], ['squid', 40], ['egg_fried', 50], ['soy', 20], ['oil', 15], ['chili', 3]], ['nasi goreng seafood'], 'plate'],
  ['Chicken nasi goreng', 'Indonesian', [['rice', 280], ['chicken_thigh', 90], ['egg_fried', 50], ['soy', 20], ['oil', 15], ['chili', 3]], ['nasi goreng ayam'], 'plate'],
  ['Ayam goreng', 'Indonesian', [['chicken_fried', 180], ['oil', 15], ['turmeric', 2], ['coriander_seed', 2]], ['indonesian fried chicken']],
  ['Ayam penyet', 'Indonesian', [['chicken_fried', 160], ['rice', 220], ['chili', 15], ['tofu', 50], ['cucumber', 30], ['oil', 10]], ['smashed fried chicken'], 'plate'],
  ['Nasi campur', 'Indonesian', [['rice', 220], ['chicken_thigh', 70], ['beef', 50], ['egg_boiled', 50], ['green_beans', 40], ['peanuts', 15]], ['nasi campur bali'], 'plate'],
  ['Nasi lemak with fried chicken', 'Malaysian', [['rice', 220], ['coconut_milk', 40], ['chicken_fried', 120], ['egg_boiled', 50], ['peanuts', 15], ['cucumber', 30], ['chili', 10]], ['nasi lemak ayam goreng'], 'plate'],
  ['Curry laksa', 'Malaysian', [['rice_noodles', 200], ['chicken_stewed', 80], ['shrimp', 40], ['tofu', 30], ['coconut_milk', 100], ['curry', 5], ['stock', 200]], ['laksa lemak'], 'bowl'],
  ['Chilli crab', 'Singaporean', [['crab', 250], ['tomato_paste', 30], ['chili', 10], ['egg', 30], ['sugar', 10], ['oil', 15]], ['singapore chilli crab']],
  ['Hokkien mee', 'Singaporean', [['egg_noodles', 150], ['rice_noodles', 100], ['shrimp', 60], ['squid', 30], ['pork_shoulder', 40], ['egg', 30], ['stock', 60], ['oil', 15]], ['hokkien prawn noodles'], 'plate'],
  ['Mee rebus', 'Malaysian', [['egg_noodles', 220], ['sweet_potato', 60], ['egg_boiled', 50], ['tofu', 40], ['sprouts_cooked', 30], ['curry', 4], ['stock', 200]], [], 'bowl'],
  ['Chicken adobo', 'Filipino', [['chicken_thigh', 180], ['soy', 25], ['vinegar', 25], ['garlic', 10], ['black_pepper', 1], ['oil', 8]], ['adobong manok']],
  ['Pork adobo', 'Filipino', [['pork_shoulder', 170], ['soy', 25], ['vinegar', 25], ['garlic', 10], ['oil', 5]], ['adobong baboy']],
  ['Pork sinigang', 'Filipino', [['pork_shoulder', 140], ['tamarind', 15], ['tomato', 50], ['spinach', 50], ['eggplant', 40], ['water', 300]], ['sinigang na baboy'], 'bowl'],
  ['Prawn sinigang', 'Filipino', [['shrimp', 140], ['tamarind', 15], ['tomato', 50], ['spinach', 50], ['water', 300]], ['sinigang na hipon'], 'bowl'],
  ['Kare-kare', 'Filipino', [['oxtail', 150], ['peanut_butter', 30], ['eggplant', 50], ['green_beans', 50], ['pak_choi', 40], ['rice', 0]], ['kare kare oxtail']],
  ['Pancit canton', 'Filipino', [['egg_noodles', 220], ['chicken_thigh', 60], ['shrimp', 40], ['cabbage', 50], ['carrots', 30], ['soy', 15], ['oil', 12]], ['pancit canton guisado'], 'plate'],
  ['Chicken tinola', 'Filipino', [['chicken_stewed', 160], ['papaya', 80], ['spinach', 40], ['ginger', 10], ['fish_sauce', 10], ['water', 250]], ['tinolang manok'], 'bowl'],
  ['Lechon kawali', 'Filipino', [['pork_shoulder', 120], ['bacon', 40], ['oil', 15], ['vinegar', 10]], ['crispy pork belly filipino']],
  ['Beef caldereta', 'Filipino', [['beef', 150], ['potato', 70], ['carrots', 40], ['red_pepper', 30], ['tomato_paste', 25], ['cheddar', 10], ['oil', 10]], ['kaldereta']],
  ['Pork menudo', 'Filipino', [['pork_shoulder', 130], ['liver', 30], ['potato', 60], ['carrots', 40], ['tomato_paste', 25], ['raisins', 10], ['oil', 10]], ['menudo filipino']],
  ['Lumpia shanghai', 'Filipino', [['pork_ground', 80], ['carrots', 20], ['onion', 15], ['flour', 40], ['oil', 20]], ['filipino spring rolls'], 'serving (5 rolls)'],
  ['Chicken inasal', 'Filipino', [['chicken_leg', 200], ['lemon', 10], ['lemongrass', 5], ['oil', 10], ['vinegar', 10]], ['inasal na manok']],
  ['Bistek tagalog', 'Filipino', [['beef_sirloin', 150], ['soy', 20], ['lemon', 15], ['onion', 60], ['oil', 10]], ['filipino beef steak']],
  ['Tapsilog', 'Filipino', [['beef_sirloin', 100], ['rice', 220], ['egg_fried', 50], ['soy', 10], ['garlic', 5], ['oil', 10]], ['tapa sinangag itlog'], 'plate'],
];
for (const [n, cu, items, al, u] of SEA) serve(n, cu, items, al, u);

// ---------------- Middle East, Turkey, Iran, Greece ----------------
const ME = [
  ...['Beef', 'Lamb'].map((p) => [`${p} shawarma wrap`, 'Middle Eastern', [...P[p], ['pita', 90], ['tahini', 15], ['tomato', 30], ['lettuce', 20], ['onion', 15], ['pickles', 15]], [`${p.toLowerCase()} shawarma`], 'wrap']),
  ...['Beef', 'Lamb'].map((p) => [`${p} shawarma plate`, 'Middle Eastern', [...P[p], ['rice', 220], ['tahini', 20], ['tomato', 40], ['cucumber', 40], ['lettuce', 20]], [`${p.toLowerCase()} shawarma rice`], 'plate']),
  ['Shish tawook', 'Middle Eastern', [['chicken_breast', 180], ['yogurt', 25], ['lemon', 10], ['garlic', 5], ['olive_oil', 8]], ['shish taouk', 'chicken shish kebab']],
  ['Shish tawook plate', 'Middle Eastern', [['chicken_breast', 170], ['yogurt', 20], ['olive_oil', 8], ['rice', 200], ['pita', 40], ['tomato', 40], ['cucumber', 40]], ['chicken kebab plate'], 'plate'],
  ['Lamb shish kebab with rice', 'Middle Eastern', [['lamb', 170], ['onion', 30], ['green_pepper', 30], ['olive_oil', 8], ['rice', 220]], ['lamb kebab plate'], 'plate'],
  ['Lamb kofta with rice', 'Middle Eastern', [['lamb_mince', 160], ['onion', 30], ['parsley', 5], ['rice', 220], ['yogurt', 30]], ['kofta plate'], 'plate'],
  ['Adana kebab', 'Turkish', [['lamb_mince', 170], ['red_pepper', 30], ['chili', 5], ['flour_tortilla', 60], ['onion', 30], ['tomato', 40]], ['adana kebap'], 'plate'],
  ['Doner kebab wrap', 'Turkish', [['lamb', 130], ['flour_tortilla', 90], ['cabbage', 40], ['tomato', 30], ['onion', 20], ['yogurt', 25], ['chili', 3]], ['doner wrap', 'durum'], 'wrap'],
  ['Doner kebab with chips', 'Turkish', [['lamb', 150], ['fries', 200], ['cabbage', 40], ['yogurt', 25], ['chili', 5]], ['doner meat and chips'], 'box'],
  ['Iskender kebab', 'Turkish', [['lamb', 150], ['pita', 80], ['tomato_canned', 60], ['butter', 15], ['yogurt', 60]], ['iskender kebap'], 'plate'],
  ['Mixed grill', 'Middle Eastern', [['lamb_chops', 100], ['chicken_breast', 80], ['lamb_mince', 70], ['rice', 200], ['tomato', 40], ['onion', 20]], ['mixed grill platter'], 'plate'],
  ['Lamb kabsa', 'Saudi Arabian', [['lamb', 170], ['rice', 280], ['tomato', 40], ['onion', 30], ['oil', 15], ['raisins', 10], ['almonds', 8]], ['kabsa lahm'], 'plate'],
  ['Chicken mandi', 'Yemeni', [['chicken_leg', 200], ['rice', 280], ['onion', 30], ['oil', 15], ['cardamom', 1]], ['mandi chicken'], 'plate'],
  ['Chicken machboos', 'Gulf', [['chicken_thigh', 170], ['rice', 280], ['tomato', 50], ['onion', 40], ['oil', 15], ['lemon', 5]], ['majboos dajaj', 'machbous'], 'plate'],
  ['Fish machboos', 'Gulf', [['fish', 170], ['rice', 280], ['tomato', 50], ['onion', 40], ['oil', 15]], ['machboos samak'], 'plate'],
  ['Fatteh', 'Levantine', [['chickpeas', 120], ['pita', 60], ['yogurt', 120], ['tahini', 15], ['olive_oil', 10], ['almonds', 10]], ['fatteh hummus'], 'bowl'],
  ['Hummus with lamb', 'Levantine', [['chickpeas', 120], ['tahini', 25], ['olive_oil', 10], ['lemon', 8], ['lamb_mince', 80], ['pita', 60]], ['hummus lahmeh'], 'plate'],
  ['Cheese pide', 'Turkish', [['flour', 120], ['feta', 60], ['mozzarella', 40], ['egg', 20], ['water', 70], ['butter', 8]], ['kasarli pide'], 'pide'],
  ['Meat pide', 'Turkish', [['flour', 120], ['lamb_mince', 80], ['tomato', 40], ['onion', 30], ['water', 70], ['butter', 5]], ['kiymali pide'], 'pide'],
  ['Cheese borek', 'Turkish', [['phyllo', 80], ['feta', 60], ['egg', 20], ['butter', 15], ['milk', 20]], ['sigara borek', 'peynirli borek'], 'piece'],
  ['Spinach borek', 'Turkish', [['phyllo', 80], ['spinach', 80], ['feta', 30], ['butter', 15], ['egg', 15]], ['ispanakli borek'], 'piece'],
  ['Manti', 'Turkish', [['flour', 90], ['lamb_mince', 70], ['yogurt', 80], ['butter', 10], ['tomato_paste', 8], ['water', 40]], ['turkish dumplings'], 'plate'],
  ['Imam bayildi', 'Turkish', [['eggplant', 200], ['onion', 60], ['tomato', 80], ['olive_oil', 25], ['garlic', 5]], ['stuffed aubergine turkish']],
  ['Kisir', 'Turkish', [['bulgur', 150], ['tomato_paste', 15], ['parsley', 10], ['onion', 20], ['olive_oil', 15], ['lemon', 10]], ['turkish bulgur salad']],
  ['Mercimek kofte', 'Turkish', [['red_lentils', 150], ['bulgur', 80], ['onion', 30], ['olive_oil', 15], ['tomato_paste', 10], ['lettuce', 30]], ['lentil balls']],
  ['Dolma biber', 'Turkish', [['green_pepper', 150], ['rice', 100], ['beef_mince', 50], ['tomato', 40], ['olive_oil', 10]], ['stuffed peppers turkish']],
  ['Muhammara', 'Levantine', [['red_pepper', 100], ['walnuts', 30], ['breadcrumbs', 15], ['olive_oil', 15], ['lemon', 5]], ['red pepper walnut dip'], 'portion (100 g)'],
  ['Sambousek', 'Levantine', [['flour', 60], ['beef_mince', 50], ['onion', 20], ['oil', 15], ['water', 30]], ['sambusak'], 'serving (3)'],
  ['Spinach fatayer', 'Levantine', [['flour', 70], ['spinach', 70], ['onion', 20], ['olive_oil', 10], ['lemon', 5], ['water', 35]], ['fatayer sabanekh'], 'serving (3)'],
  ['Joojeh kabab', 'Iranian', [['chicken_breast', 180], ['yogurt', 25], ['lemon', 10], ['saffron', 0.2], ['onion', 20], ['rice', 220]], ['jujeh kabab', 'saffron chicken kebab'], 'plate'],
  ['Zereshk polo ba morgh', 'Iranian', [['chicken_thigh', 160], ['rice', 260], ['raisins', 15], ['butter', 10], ['saffron', 0.2], ['onion', 30]], ['barberry rice with chicken'], 'plate'],
  ['Fesenjan', 'Iranian', [['chicken_thigh', 160], ['walnuts', 50], ['honey', 15], ['onion', 30], ['oil', 10]], ['fesenjoon', 'walnut pomegranate stew']],
  ['Kuku sabzi', 'Iranian', [['egg', 120], ['spinach', 50], ['parsley', 30], ['walnuts', 10], ['oil', 10]], ['herb frittata persian']],
  ['Ash reshteh', 'Iranian', [['pasta', 80], ['kidney', 60], ['chickpeas', 60], ['lentils', 50], ['spinach', 80], ['yogurt', 40], ['onion', 30], ['oil', 10], ['water', 150]], ['ash e reshteh'], 'bowl'],
  ['Khoresh gheymeh', 'Iranian', [['beef', 130], ['split_peas', 80], ['tomato_paste', 20], ['onion', 40], ['fries', 40], ['oil', 12]], ['gheymeh']],
  ['Dizi', 'Iranian', [['lamb', 130], ['chickpeas', 80], ['kidney', 50], ['potato', 80], ['tomato', 50], ['water', 150]], ['abgoosht'], 'bowl'],
  ...['Chicken', 'Pork', 'Lamb'].map((p) => [`${p} souvlaki pita`, 'Greek', [...P[p], ['pita', 80], ['tomato', 30], ['onion', 20], ['yogurt', 30], ['cucumber', 15], ['fries', 40]], [`${p.toLowerCase()} souvlaki wrap`], 'pita']),
  ...['Chicken', 'Pork'].map((p) => [`${p} gyros plate`, 'Greek', [...P[p], ['pita', 60], ['fries', 120], ['tomato', 40], ['onion', 20], ['yogurt', 40], ['cucumber', 20]], [`${p.toLowerCase()} gyro`], 'plate']),
  ['Moussaka', 'Greek', [['eggplant', 150], ['beef_mince', 100], ['potato', 60], ['tomato_canned', 50], ['milk', 60], ['butter', 8], ['flour', 8], ['parmesan', 8], ['olive_oil', 12]], ['greek moussaka']],
  ['Pastitsio', 'Greek', [['pasta', 150], ['beef_mince', 100], ['tomato_canned', 50], ['milk', 60], ['butter', 8], ['flour', 8], ['parmesan', 10]], ['greek lasagne']],
  ['Spanakopita', 'Greek', [['phyllo', 70], ['spinach', 100], ['feta', 50], ['egg', 20], ['olive_oil', 12], ['onion', 15]], ['spinach pie greek'], 'slice'],
  ['Beef stifado', 'Greek', [['beef', 160], ['onion', 100], ['tomato_canned', 60], ['vinegar', 10], ['olive_oil', 12], ['cinnamon', 1]], ['stifado']],
  ['Keftedes', 'Greek', [['beef_mince', 140], ['breadcrumbs', 15], ['onion', 20], ['mint', 3], ['oil', 12]], ['greek meatballs'], 'serving (5)'],
  ['Fasolada', 'Greek', [['pinto', 180], ['carrots', 40], ['celery', 30], ['tomato_canned', 60], ['olive_oil', 20], ['water', 150]], ['greek bean soup'], 'bowl'],
  ['Gemista', 'Greek', [['red_pepper', 100], ['tomato', 120], ['rice', 100], ['onion', 30], ['olive_oil', 20], ['potato', 60]], ['stuffed tomatoes and peppers']],
  ['Tzatziki', 'Greek', [['greek_yogurt_full', 80], ['cucumber', 30], ['garlic', 3], ['olive_oil', 5]], ['tzatziki dip'], 'portion (100 g)'],
];
for (const [n, cu, items, al, u] of ME) serve(n, cu, items, al, u);

// ---------------- Europe ----------------
const PASTA = (sauce) => [['pasta', 250], ...sauce];
const EU = [
  ['Spaghetti carbonara', 'Italian', PASTA([['bacon', 40], ['egg', 50], ['parmesan', 20], ['black_pepper', 1]]), ['pasta carbonara'], 'plate'],
  ['Penne arrabbiata', 'Italian', PASTA([['tomato_canned', 120], ['olive_oil', 12], ['garlic', 5], ['chili', 5]]), ['arrabiata'], 'plate'],
  ['Pasta al pesto', 'Italian', PASTA([['pesto', 40], ['parmesan', 10]]), ['pesto pasta', 'trofie al pesto'], 'plate'],
  ['Fettuccine alfredo', 'Italian', PASTA([['butter', 20], ['cream', 50], ['parmesan', 30]]), ['alfredo pasta'], 'plate'],
  ['Chicken alfredo', 'Italian-American', PASTA([['chicken_breast', 120], ['butter', 15], ['cream', 50], ['parmesan', 25]]), ['chicken fettuccine alfredo'], 'plate'],
  ['Bucatini all’amatriciana', 'Italian', PASTA([['bacon', 40], ['tomato_canned', 100], ['parmesan', 15], ['chili', 2]]), ['amatriciana'], 'plate'],
  ['Spaghetti puttanesca', 'Italian', PASTA([['tomato_canned', 120], ['olives', 20], ['capers', 8], ['olive_oil', 12], ['garlic', 5]]), ['puttanesca'], 'plate'],
  ['Spaghetti aglio e olio', 'Italian', PASTA([['olive_oil', 25], ['garlic', 10], ['chili', 3], ['parsley', 3]]), ['aglio olio'], 'plate'],
  ['Pasta primavera', 'Italian', PASTA([['zucchini', 50], ['peas', 40], ['red_pepper', 40], ['olive_oil', 12], ['parmesan', 10]]), ['vegetable pasta'], 'plate'],
  ['Spaghetti marinara', 'Italian', PASTA([['marinara', 150], ['parmesan', 8]]), ['pasta with tomato sauce'], 'plate'],
  ['Linguine alle vongole', 'Italian', PASTA([['clams', 100], ['olive_oil', 15], ['garlic', 5], ['parsley', 3]]), ['spaghetti vongole', 'clam pasta'], 'plate'],
  ['Seafood linguine', 'Italian', PASTA([['shrimp', 60], ['mussels', 50], ['squid', 40], ['tomato_canned', 80], ['olive_oil', 12]]), ['linguine frutti di mare'], 'plate'],
  ['Cacio e pepe', 'Italian', PASTA([['parmesan', 35], ['black_pepper', 2], ['butter', 8]]), [], 'plate'],
  ['Penne pomodoro', 'Italian', PASTA([['tomato_canned', 120], ['olive_oil', 10], ['basil', 3], ['parmesan', 8]]), ['pasta pomodoro'], 'plate'],
  ['Tagliatelle al ragù', 'Italian', PASTA([['beef_mince', 100], ['tomato_canned', 100], ['carrots', 20], ['onion', 20], ['olive_oil', 8]]), ['ragu bolognese', 'tagliatelle bolognese'], 'plate'],
  ['Chicken pesto pasta', 'Italian', PASTA([['chicken_breast', 110], ['pesto', 35], ['parmesan', 10]]), [], 'plate'],
  ['Prawn linguine', 'Italian', PASTA([['shrimp', 110], ['tomato_canned', 80], ['olive_oil', 12], ['garlic', 5], ['chili', 3]]), ['garlic prawn pasta'], 'plate'],
  ['Creamy salmon pasta', 'Italian', PASTA([['salmon', 110], ['cream', 50], ['spinach', 40], ['parmesan', 10]]), ['salmon pasta'], 'plate'],
  ['Creamy mushroom pasta', 'Italian', PASTA([['mushrooms', 120], ['cream', 50], ['garlic', 5], ['parmesan', 10]]), ['mushroom pasta'], 'plate'],
  ['Gnocchi with tomato sauce', 'Italian', [['gnocchi', 250], ['marinara', 120], ['parmesan', 10]], ['gnocchi pomodoro'], 'plate'],
  ['Gnocchi with pesto', 'Italian', [['gnocchi', 250], ['pesto', 35], ['parmesan', 10]], ['gnocchi al pesto'], 'plate'],
  ['Spinach and ricotta ravioli', 'Italian', [['pasta', 180], ['ricotta', 60], ['spinach', 50], ['butter', 12], ['parmesan', 10]], ['ravioli ricotta spinaci'], 'plate'],
  ['Cheese tortellini', 'Italian', [['pasta', 180], ['ricotta', 40], ['parmesan', 20], ['marinara', 80]], ['tortellini'], 'plate'],
  ['Chicken risotto', 'Italian', [['rice_short', 250], ['chicken_breast', 100], ['parmesan', 20], ['butter', 12], ['onion', 30], ['stock', 60]], ['risotto al pollo'], 'plate'],
  ['Seafood risotto', 'Italian', [['rice_short', 250], ['shrimp', 60], ['mussels', 40], ['squid', 30], ['butter', 10], ['onion', 30], ['tomato', 30]], ['risotto ai frutti di mare'], 'plate'],
  ...[['Margherita', [['mozzarella', 70], ['marinara', 50], ['basil', 2]]], ['Pepperoni', [['mozzarella', 60], ['marinara', 50], ['pepperoni', 35]]], ['Four cheese', [['mozzarella', 50], ['gouda', 20], ['blue_cheese', 15], ['parmesan', 10], ['marinara', 40]]], ['Vegetarian', [['mozzarella', 55], ['marinara', 50], ['red_pepper', 30], ['mushrooms_raw', 30], ['onion', 15], ['olives', 10]]], ['Hawaiian', [['mozzarella', 60], ['marinara', 50], ['ham_slice', 30], ['pineapple', 30]]], ['BBQ chicken', [['mozzarella', 55], ['bbq', 35], ['chicken_breast', 50], ['onion', 15]]], ['Diavola', [['mozzarella', 60], ['marinara', 50], ['pepperoni', 30], ['chili', 3]]], ['Funghi', [['mozzarella', 60], ['marinara', 50], ['mushrooms_raw', 50]]], ['Capricciosa', [['mozzarella', 55], ['marinara', 50], ['ham_slice', 25], ['mushrooms_raw', 25], ['olives', 10]]], ['Prosciutto', [['mozzarella', 60], ['marinara', 50], ['ham_slice', 35], ['arugula', 10]]], ['Meat feast', [['mozzarella', 55], ['marinara', 50], ['pepperoni', 20], ['italian_sausage', 25], ['ham_slice', 20], ['beef_mince', 20]]]].map(([n, top]) => [`${n} pizza`, 'Italian', [['flour', 110], ['water', 65], ['olive_oil', 8], ...top], [`pizza ${n.toLowerCase()}`], 'half pizza (4 slices)']),
  ['Chicken parmigiana', 'Italian', [['chicken_fried', 170], ['breadcrumbs', 20], ['marinara', 80], ['mozzarella', 40], ['parmesan', 10]], ['chicken parm', 'parmo']],
  ['Eggplant parmigiana', 'Italian', [['eggplant', 220], ['marinara', 100], ['mozzarella', 50], ['parmesan', 15], ['olive_oil', 15]], ['melanzane alla parmigiana', 'aubergine parmigiana']],
  ['Chicken saltimbocca', 'Italian', [['chicken_breast', 160], ['ham_slice', 30], ['butter', 10], ['olive_oil', 8]], ['saltimbocca']],
  ['Minestrone', 'Italian', [['pasta', 40], ['kidney', 50], ['carrots', 40], ['zucchini', 40], ['tomato_canned', 80], ['celery', 20], ['olive_oil', 10], ['water', 150]], ['minestrone soup'], 'bowl'],
  ['Bruschetta', 'Italian', [['baguette', 60], ['tomato', 60], ['olive_oil', 10], ['basil', 3], ['garlic', 3]], ['tomato bruschetta'], 'serving (2)'],
  ['Caprese salad', 'Italian', [['mozzarella', 100], ['tomato', 120], ['basil', 4], ['olive_oil', 10], ['balsamic', 5]], ['insalata caprese']],
  ['Arancini', 'Italian', [['rice_short', 120], ['mozzarella', 25], ['breadcrumbs', 20], ['egg', 15], ['oil', 15], ['marinara', 0]], ['rice balls italian'], 'serving (2)'],
  ['Tiramisu', 'Italian', [['cream_cheese', 60], ['cream', 30], ['sugar', 20], ['egg', 20], ['flour', 25], ['dark_choc', 5]], ['tiramisu dessert'], 'slice'],
  ['Panna cotta', 'Italian', [['cream', 100], ['milk', 30], ['sugar', 15]], [], 'pot'],
  ['Quiche lorraine', 'French', [['pie_crust', 50], ['egg', 50], ['cream', 40], ['bacon', 25], ['swiss', 20]], ['quiche'], 'slice'],
  ['Croque monsieur', 'French', [['bread', 70], ['ham_slice', 40], ['swiss', 30], ['butter', 10], ['milk', 20], ['flour', 4]], ['croque-monsieur'], 'sandwich'],
  ['Croque madame', 'French', [['bread', 70], ['ham_slice', 40], ['swiss', 30], ['butter', 10], ['egg_fried', 50]], ['croque-madame'], 'sandwich'],
  ['Cassoulet', 'French', [['pinto', 150], ['sausage', 60], ['duck_meat', 60], ['pork_shoulder', 40], ['tomato_canned', 40], ['breadcrumbs', 10]], ['cassoulet toulousain'], 'bowl'],
  ['Bouillabaisse', 'French', [['cod', 100], ['mussels', 50], ['shrimp', 40], ['tomato_canned', 80], ['olive_oil', 15], ['onion', 30], ['water', 150], ['saffron', 0.2]], ['provencal fish stew'], 'bowl'],
  ['Steak frites', 'French', [['beef_sirloin', 180], ['fries', 150], ['butter', 10]], ['steak and fries'], 'plate'],
  ['Ham and cheese crêpe', 'French', [['flour', 30], ['milk', 60], ['egg', 20], ['butter', 8], ['ham_slice', 40], ['swiss', 30]], ['galette complete', 'savoury crepe'], 'crêpe'],
  ['Sweet crêpe with chocolate', 'French', [['flour', 30], ['milk', 60], ['egg', 20], ['butter', 8], ['dark_choc', 15], ['sugar', 5]], ['nutella crepe', 'crepe'], 'crêpe'],
  ['Salade niçoise', 'French', [['tuna', 80], ['egg_boiled', 50], ['green_beans', 60], ['potato', 80], ['tomato', 50], ['olives', 15], ['lettuce', 40], ['olive_oil', 12]], ['nicoise salad']],
  ['French onion soup', 'French', [['onion', 150], ['butter', 15], ['stock', 250], ['baguette', 30], ['swiss', 25]], ['soupe a l oignon'], 'bowl'],
  ['Chicken provençal', 'French', [['chicken_thigh', 170], ['tomato', 80], ['olives', 15], ['onion', 30], ['olive_oil', 12], ['garlic', 5]], ['poulet provencal']],
  ['Gratin dauphinois', 'French', [['potato', 200], ['cream', 50], ['milk', 30], ['garlic', 3], ['butter', 5]], ['potato gratin']],
  ['Cheese omelette', 'French', [['egg', 120], ['cheddar', 30], ['butter', 8]], ['omelette au fromage', 'cheese omelet']],
  ['Crème brûlée', 'French', [['cream', 90], ['egg', 25], ['sugar', 18]], ['creme brulee'], 'ramekin'],
  ['Seafood paella', 'Spanish', [['rice_short', 220], ['shrimp', 60], ['mussels', 50], ['squid', 40], ['peas', 30], ['red_pepper', 30], ['olive_oil', 15], ['tomato', 30], ['saffron', 0.2]], ['paella de marisco'], 'plate'],
  ['Chicken paella', 'Spanish', [['rice_short', 220], ['chicken_thigh', 120], ['green_beans', 40], ['red_pepper', 30], ['olive_oil', 15], ['tomato', 30], ['saffron', 0.2]], ['paella de pollo', 'paella valenciana'], 'plate'],
  ['Mixed paella', 'Spanish', [['rice_short', 220], ['chicken_thigh', 70], ['shrimp', 50], ['mussels', 40], ['chorizo', 20], ['peas', 30], ['olive_oil', 15], ['saffron', 0.2]], ['paella mixta'], 'plate'],
  ['Gambas al ajillo', 'Spanish', [['shrimp', 150], ['olive_oil', 25], ['garlic', 10], ['chili', 2]], ['garlic prawns'], 'tapa'],
  ['Albóndigas', 'Spanish', [['beef_mince', 130], ['breadcrumbs', 15], ['tomato_canned', 80], ['onion', 20], ['olive_oil', 12]], ['spanish meatballs', 'albondigas'], 'tapa'],
  ['Chorizo and potatoes', 'Spanish', [['chorizo', 70], ['potato', 180], ['olive_oil', 10], ['paprika', 2]], ['patatas con chorizo']],
  ['Gazpacho', 'Spanish', [['tomato', 200], ['cucumber', 60], ['red_pepper', 40], ['olive_oil', 15], ['bread', 20], ['vinegar', 8]], ['cold tomato soup'], 'bowl'],
  ['Ham croquetas', 'Spanish', [['ham_slice', 30], ['milk', 80], ['flour', 25], ['butter', 15], ['breadcrumbs', 20], ['oil', 15]], ['croquetas de jamon'], 'serving (4)'],
  ['Fabada asturiana', 'Spanish', [['pinto', 180], ['chorizo', 40], ['bacon', 30], ['ham_slice', 20], ['water', 150]], ['fabada'], 'bowl'],
  ['Pollo al ajillo', 'Spanish', [['chicken_thigh', 180], ['garlic', 15], ['olive_oil', 15], ['lemon', 5]], ['garlic chicken spanish']],
  ['Churros with chocolate', 'Spanish', [['flour', 60], ['water', 60], ['oil', 25], ['sugar', 10], ['dark_choc', 25], ['milk', 60]], ['churros con chocolate'], 'serving'],
  ['Piri piri chicken', 'Portuguese', [['chicken_leg', 220], ['chili', 8], ['lemon', 10], ['olive_oil', 10], ['garlic', 5]], ['peri peri chicken', 'frango piri piri']],
  ['Piri piri chicken with chips', 'Portuguese', [['chicken_leg', 200], ['chili', 6], ['olive_oil', 8], ['fries', 150]], ['peri peri chicken and chips'], 'plate'],
  ['Francesinha', 'Portuguese', [['bread', 80], ['ham_slice', 30], ['beef_sirloin', 60], ['sausage', 40], ['cheddar', 40], ['tomato_canned', 60], ['egg_fried', 50]], [], 'sandwich'],
  ['Caldo verde', 'Portuguese', [['potato', 150], ['kale', 60], ['chorizo', 25], ['olive_oil', 10], ['water', 200]], ['portuguese kale soup'], 'bowl'],
  ['Bitoque', 'Portuguese', [['beef_sirloin', 150], ['egg_fried', 50], ['fries', 120], ['rice', 120]], ['steak with egg portuguese'], 'plate'],
  ['Pork schnitzel', 'German', [['pork_tenderloin', 150], ['breadcrumbs', 25], ['egg', 15], ['flour', 10], ['oil', 20], ['lemon', 5]], ['schweineschnitzel']],
  ['Chicken schnitzel', 'German', [['chicken_breast', 160], ['breadcrumbs', 25], ['egg', 15], ['flour', 10], ['oil', 20]], ['hähnchenschnitzel']],
  ['Wiener schnitzel', 'Austrian', [['veal_loin', 150], ['breadcrumbs', 25], ['egg', 15], ['flour', 10], ['oil', 20], ['lemon', 5]], ['veal schnitzel']],
  ['Bratwurst with sauerkraut', 'German', [['sausage', 150], ['sauerkraut', 120], ['mustard', 10], ['potato', 120]], ['bratwurst and sauerkraut'], 'plate'],
  ['Currywurst with fries', 'German', [['sausage', 150], ['ketchup', 40], ['curry', 3], ['fries', 150]], ['currywurst pommes'], 'plate'],
  ['Sauerbraten', 'German', [['pot_roast', 170], ['vinegar', 15], ['onion', 40], ['raisins', 10], ['sugar', 5]], ['german pot roast']],
  ['Beef rouladen', 'German', [['beef_sirloin', 150], ['bacon', 20], ['pickles', 20], ['onion', 20], ['mustard', 8], ['gravy', 40]], ['rinderrouladen']],
  ['Käsespätzle', 'German', [['flour', 100], ['egg', 50], ['milk', 30], ['swiss', 50], ['onion', 30], ['butter', 10]], ['kasespatzle', 'cheese spaetzle']],
  ['German potato salad', 'German', [['potato', 200], ['bacon', 20], ['onion', 20], ['vinegar', 10], ['oil', 10]], ['kartoffelsalat']],
  ['Kartoffelpuffer', 'German', [['potato', 150], ['egg', 20], ['flour', 15], ['onion', 15], ['oil', 20]], ['potato pancakes'], 'serving (3)'],
  ['Hungarian goulash', 'Hungarian', [['beef', 150], ['onion', 60], ['paprika', 5], ['potato', 80], ['tomato', 40], ['oil', 10], ['water', 120]], ['gulyas', 'goulash soup'], 'bowl'],
  ['Chicken paprikash', 'Hungarian', [['chicken_thigh', 170], ['onion', 50], ['paprika', 5], ['sour_cream', 40], ['oil', 10]], ['csirkepaprikas']],
  ['Rösti', 'Swiss', [['potato', 200], ['butter', 15]], ['rosti', 'hash brown swiss']],
  ['Borscht', 'Ukrainian', [['beets', 120], ['cabbage', 60], ['potato', 60], ['carrots', 30], ['beef', 50], ['sour_cream', 20], ['water', 200]], ['borsch', 'beetroot soup'], 'bowl'],
  ['Beef stroganoff', 'Russian', [['beef_sirloin', 150], ['mushrooms', 60], ['onion', 40], ['sour_cream', 50], ['butter', 10], ['rice', 0]], ['stroganoff']],
  ['Beef stroganoff with rice', 'Russian', [['beef_sirloin', 140], ['mushrooms', 50], ['onion', 30], ['sour_cream', 45], ['butter', 8], ['rice', 200]], [], 'plate'],
  ['Chicken kiev', 'Ukrainian', [['chicken_breast', 160], ['butter', 25], ['breadcrumbs', 25], ['egg', 15], ['oil', 15], ['garlic', 3]], ['chicken kyiv']],
  ['Plov', 'Uzbek', [['rice', 250], ['lamb', 120], ['carrots', 80], ['onion', 40], ['oil', 25], ['chickpeas', 30]], ['osh', 'pilaf uzbek'], 'plate'],
  ['Shashlik', 'Russian / Caucasian', [['pork_shoulder', 180], ['onion', 40], ['vinegar', 5], ['oil', 5]], ['shashlyk', 'mtsvadi'], 'serving (2 skewers)'],
  ['Gołąbki', 'Polish', [['cabbage_cooked', 120], ['pork_ground', 80], ['rice', 60], ['tomato_canned', 80], ['onion', 20]], ['golabki', 'stuffed cabbage rolls'], 'serving (2)'],
  ['Potato pierogi', 'Polish', [['flour', 90], ['potato', 80], ['cottage', 30], ['onion', 20], ['butter', 12], ['water', 40]], ['pierogi ruskie'], 'serving (6)'],
  ['Varenyky with potato', 'Ukrainian', [['flour', 90], ['potato', 90], ['onion', 20], ['butter', 12], ['sour_cream', 20], ['water', 40]], ['vareniki'], 'serving (6)'],
  ['Syrniki', 'Ukrainian', [['cottage', 150], ['egg', 25], ['flour', 25], ['sugar', 10], ['oil', 12], ['sour_cream', 20]], ['cottage cheese pancakes'], 'serving (3)'],
  ['Blini', 'Russian', [['flour', 60], ['milk', 100], ['egg', 25], ['butter', 10], ['sugar', 5]], ['russian pancakes'], 'serving (3)'],
  ['Swedish meatballs', 'Swedish', [['beef_mince', 120], ['pork_ground', 40], ['breadcrumbs', 15], ['cream', 30], ['gravy', 40], ['mash', 150]], ['kottbullar'], 'plate'],
  ['Shepherd’s pie', 'British', [['lamb_mince', 130], ['mash', 180], ['carrots', 30], ['peas', 30], ['onion', 20], ['gravy', 40]], ['shepherds pie'], 'portion'],
  ['Steak and kidney pie', 'British', [['beef', 100], ['liver', 30], ['gravy', 60], ['onion', 20], ['pie_crust', 80]], ['steak & kidney pie'], 'pie'],
  ['Chicken and mushroom pie', 'British', [['chicken_meat', 100], ['mushrooms', 50], ['cream', 30], ['milk', 30], ['pie_crust', 80]], ['chicken pie'], 'pie'],
  ['Cornish pasty', 'British', [['pie_crust', 90], ['beef', 70], ['potato', 60], ['onion', 20], ['carrots', 20]], ['pasty'], 'pasty'],
  ['Toad in the hole', 'British', [['sausage', 120], ['flour', 40], ['egg', 30], ['milk', 80], ['oil', 10], ['gravy', 50]], [], 'portion'],
  ['Roast chicken dinner', 'British', [['chicken_meat', 140], ['potato_roast', 150], ['carrots', 60], ['peas', 50], ['gravy', 60], ['yorkshire', 30]], ['sunday roast chicken'], 'plate'],
  ['Jacket potato with tuna mayo', 'British', [['potato_baked', 250], ['tuna', 80], ['mayo', 25], ['lettuce', 20]], ['baked potato with tuna'], 'potato'],
  ['Jacket potato with cheese', 'British', [['potato_baked', 250], ['cheddar', 50], ['butter', 10]], ['baked potato with cheese'], 'potato'],
  ['Kedgeree', 'British', [['rice', 220], ['cod', 100], ['egg_boiled', 50], ['butter', 15], ['curry', 3], ['onion', 20]], [], 'plate'],
  ['Beef stew and dumplings', 'British', [['beef', 140], ['carrots', 50], ['potato', 70], ['onion', 30], ['gravy', 80], ['flour', 40], ['butter', 15]], ['stew and dumplings'], 'bowl'],
  ['Bacon sandwich', 'British', [['bread', 80], ['bacon', 40], ['butter', 8], ['ketchup', 10]], ['bacon butty', 'bacon sarnie'], 'sandwich'],
  ['Cheese on toast', 'British', [['bread', 70], ['cheddar', 40]], ['cheesy toast'], 'serving (2 slices)'],
  ['Fish pie', 'British', [['cod', 80], ['salmon', 50], ['shrimp', 30], ['milk', 80], ['butter', 10], ['flour', 10], ['mash', 180]], ['fisherman’s pie'], 'portion'],
  ['Lancashire hotpot', 'British', [['lamb', 130], ['potato', 150], ['onion', 50], ['carrots', 30], ['gravy', 60], ['butter', 8]], ['hotpot'], 'portion'],
  ['Bubble and squeak', 'British', [['potato', 150], ['cabbage_cooked', 80], ['butter', 15]], [], 'portion'],
  ['Welsh rarebit', 'British', [['bread', 70], ['cheddar', 50], ['mustard', 5], ['worcestershire', 5], ['milk', 15]], ['welsh rabbit'], 'serving (2 slices)'],
  ['Sausage roll', 'British', [['pie_crust', 50], ['sausage', 50]], ['pork sausage roll'], 'roll'],
  ['Scotch pancakes with jam', 'British', [['pancake', 100], ['jam', 20], ['butter', 8]], ['drop scones'], 'serving (3)'],
  ['Sticky toffee pudding with custard', 'British', [['flour', 40], ['dates', 40], ['brown_sugar', 30], ['butter', 20], ['egg', 20], ['cream', 30]], [], 'portion'],
  ['Apple crumble', 'British', [['apple', 120], ['flour', 35], ['butter', 20], ['sugar', 25]], ['apple crisp'], 'portion'],
  ['Banoffee pie', 'British', [['pie_crust', 40], ['banana', 50], ['cream', 40], ['sugar', 25], ['butter', 15]], [], 'slice'],
];
for (const [n, cu, items, al, u] of EU) serve(n, cu, items, al, u);

// ---------------- North America ----------------
const NA = [
  ['Cheeseburger', [['beef_patty', 110], ['burger_bun', 60], ['cheddar', 20], ['lettuce', 15], ['tomato', 20], ['ketchup', 10], ['pickles', 10]], ['cheese burger'], 'burger'],
  ['Bacon cheeseburger', [['beef_patty', 110], ['burger_bun', 60], ['cheddar', 20], ['bacon', 20], ['lettuce', 15], ['tomato', 20], ['ketchup', 10]], [], 'burger'],
  ['Double cheeseburger', [['beef_patty', 200], ['burger_bun', 60], ['cheddar', 40], ['pickles', 10], ['ketchup', 10], ['onion', 10]], [], 'burger'],
  ['Grilled chicken burger', [['chicken_breast', 130], ['burger_bun', 60], ['lettuce', 15], ['tomato', 20], ['mayo', 12]], ['chicken sandwich grilled'], 'burger'],
  ['Crispy chicken burger', [['chicken_fried', 130], ['burger_bun', 60], ['lettuce', 15], ['mayo', 15], ['pickles', 10]], ['fried chicken sandwich'], 'burger'],
  ['Burger and fries', [['beef_patty', 110], ['burger_bun', 60], ['cheddar', 20], ['lettuce', 15], ['tomato', 20], ['ketchup', 10], ['fries', 120]], ['burger meal'], 'meal'],
  ['Pulled pork sandwich', [['pork_roast', 130], ['bbq', 30], ['burger_bun', 70], ['cabbage', 30], ['mayo', 8]], ['bbq pulled pork sandwich'], 'sandwich'],
  ['Beef brisket plate', [['beef_brisket', 180], ['bbq', 30], ['bread', 30], ['cabbage', 60], ['mayo', 10], ['pickles', 15]], ['texas brisket'], 'plate'],
  ['Fried chicken with fries', [['chicken_fried', 200], ['flour', 15], ['oil', 10], ['fries', 150]], ['fried chicken meal', 'chicken and chips'], 'meal'],
  ['Chicken tenders with fries', [['chicken_fried', 150], ['breadcrumbs', 20], ['oil', 15], ['fries', 150], ['ketchup', 15]], ['chicken strips and fries'], 'meal'],
  ['Chicken and waffles', [['chicken_fried', 150], ['waffle', 90], ['maple', 30], ['butter', 8]], [], 'plate'],
  ['Meatloaf with mashed potatoes', [['beef_mince', 140], ['breadcrumbs', 15], ['egg', 15], ['ketchup', 20], ['mash', 180], ['gravy', 40]], ['meatloaf dinner'], 'plate'],
  ['Pot roast', [['pot_roast', 170], ['potato', 100], ['carrots', 60], ['onion', 30], ['gravy', 50]], ['yankee pot roast'], 'plate'],
  ['Jambalaya', [['rice', 220], ['chicken_thigh', 70], ['shrimp', 50], ['sausage', 40], ['tomato_canned', 60], ['red_pepper', 30], ['onion', 30], ['oil', 10]], ['cajun jambalaya'], 'plate'],
  ['Chicken and sausage gumbo', [['chicken_thigh', 80], ['sausage', 50], ['okra', 60], ['flour', 15], ['oil', 15], ['onion', 30], ['rice', 150], ['stock', 150]], ['gumbo'], 'bowl'],
  ['Shrimp and grits', [['shrimp', 120], ['cornmeal', 50], ['water', 150], ['cheddar', 25], ['butter', 15], ['bacon', 15]], [], 'bowl'],
  ['Philly cheesesteak', [['beef_sirloin', 120], ['roll', 90], ['provolone', 40], ['onion', 40], ['green_pepper', 30], ['oil', 8]], ['cheesesteak'], 'sandwich'],
  ['Club sandwich', [['bread', 100], ['turkey', 50], ['bacon', 20], ['lettuce', 15], ['tomato', 25], ['mayo', 15]], ['turkey club'], 'sandwich'],
  ['Cobb salad', [['lettuce', 120], ['chicken_breast', 90], ['bacon', 20], ['egg_boiled', 50], ['avocado', 40], ['blue_cheese', 20], ['tomato', 40], ['olive_oil', 12]], [], 'bowl'],
  ['Chicken Caesar salad', [['lettuce', 120], ['chicken_breast', 110], ['parmesan', 15], ['bread', 20], ['mayo', 20], ['lemon', 5]], ['caesar salad with chicken'], 'bowl'],
  ['Pancakes with bacon and syrup', [['pancake', 150], ['bacon', 30], ['maple', 40], ['butter', 10]], ['pancake breakfast'], 'plate'],
  ['Eggs Benedict', [['english_muffin', 60], ['egg_poached', 100], ['ham_slice', 40], ['butter', 20], ['egg', 15], ['lemon', 3]], ['eggs benny'], 'plate'],
  ['Biscuits and gravy', [['flour', 70], ['butter', 20], ['buttermilk', 40], ['sausage', 50], ['milk', 80], ['flour', 0]], [], 'plate'],
  ['Steak and eggs', [['beef_sirloin', 170], ['egg_fried', 100], ['potato', 100], ['oil', 5]], [], 'plate'],
  ['Reuben sandwich', [['bread', 80], ['beef_brisket', 90], ['sauerkraut', 40], ['swiss', 25], ['mayo', 10], ['butter', 8]], ['reuben'], 'sandwich'],
  ['Sloppy joe', [['beef_mince', 110], ['ketchup', 30], ['onion', 20], ['green_pepper', 20], ['burger_bun', 60]], ['sloppy joes'], 'sandwich'],
  ['Tuna melt', [['bread', 70], ['tuna', 70], ['mayo', 15], ['cheddar', 30], ['butter', 8]], [], 'sandwich'],
  ['Buffalo chicken wrap', [['chicken_fried', 110], ['flour_tortilla', 70], ['lettuce', 20], ['blue_cheese', 15], ['chili', 5], ['butter', 8]], [], 'wrap'],
  ['Roast turkey dinner', [['turkey', 150], ['mash', 150], ['gravy', 60], ['green_beans', 60], ['corn', 50]], ['thanksgiving dinner'], 'plate'],
  ['Lobster roll', [['crab', 0], ['roll', 70], ['mayo', 15], ['celery_raw', 10], ['butter', 10], ['lemon', 3]], [], 'roll'],
  ['Crab cakes', [['crab', 120], ['breadcrumbs', 20], ['mayo', 15], ['egg', 15], ['mustard', 5], ['oil', 12]], ['maryland crab cakes'], 'serving (2)'],
  ['Chili dog', [['sausage', 60], ['burger_bun', 50], ['beef_mince', 40], ['kidney', 20], ['tomato_canned', 20], ['cheddar', 10]], [], 'hot dog'],
  ['Chicken pot pie', [['chicken_meat', 90], ['peas', 30], ['carrots', 30], ['milk', 60], ['butter', 15], ['flour', 10], ['pie_crust', 60]], [], 'pie'],
  ['New York cheesecake', [['cream_cheese', 80], ['sugar', 20], ['egg', 15], ['sour_cream', 15], ['flour', 15], ['butter', 8]], ['cheesecake'], 'slice'],
  ['Apple pie', [['pie_crust', 50], ['apple', 90], ['sugar', 20], ['butter', 8], ['cinnamon', 1]], ['american apple pie'], 'slice'],
  ['Chocolate brownie', [['dark_choc', 25], ['butter', 20], ['sugar', 25], ['egg', 15], ['flour', 15]], ['brownie'], 'piece'],
  ['Poutine with pulled pork', [['fries', 200], ['cheddar', 50], ['gravy', 70], ['pork_roast', 70]], ['pulled pork poutine'], 'box'],
  ['Butter chicken poutine', [['fries', 200], ['mozzarella', 40], ['chicken_thigh', 80], ['tomato_canned', 50], ['cream', 30]], [], 'box'],
  ['Tourtière', [['pie_crust', 70], ['pork_ground', 90], ['potato', 40], ['onion', 20], ['cinnamon', 0.5]], ['quebec meat pie'], 'slice'],
];
for (const [n, items, al, u] of NA) serve(n, 'North American', items, al, u);

const MX = [
  ...[['chicken', 'Chicken', 'tacos de pollo'], ['carne asada', 'Steak', 'tacos de carne asada'], ['al pastor', 'Pork', 'tacos al pastor'], ['carnitas', 'Pork', 'tacos de carnitas'], ['fish', 'Fish', 'baja fish tacos'], ['shrimp', 'Prawn', 'tacos de camaron'], ['barbacoa', 'Beef', 'tacos de barbacoa'], ['birria', 'Beef', 'birria tacos']].map(([n, p, al]) => [`${n.replace(/^./, (c) => c.toUpperCase())} tacos`, [['corn_tortilla', 90], ...P[p].map(([k, g]) => [k, Math.round(g * 0.8)]), ['onion', 20], ['coriander', 4], ['salsa', 30], ['lime', 5], ...(n === 'al pastor' ? [['pineapple', 20]] : []), ...(n === 'fish' || n === 'shrimp' ? [['cabbage', 20], ['flour', 10], ['oil', 8], ['mayo', 8]] : [])], [al], 'serving (3 tacos)']),
  ...[['Chicken', 'Chicken'], ['Carne asada', 'Steak'], ['Carnitas', 'Pork'], ['Shrimp', 'Prawn'], ['Beef', 'Beef']].map(([n, p]) => [`${n} burrito`, [['flour_tortilla', 100], ['rice', 100], ['pinto', 80], ...P[p].map(([k, g]) => [k, Math.round(g * 0.8)]), ['cheddar', 25], ['salsa', 30], ['sour_cream', 20]], [`burrito de ${n.toLowerCase()}`], 'burrito']),
  ...[['Chicken', [['chicken_meat', 110]]], ['Beef', [['beef_mince', 100]]], ['Cheese', [['monterey', 60]]]].map(([n, f]) => [`${n} enchiladas`, [['corn_tortilla', 90], ...f, ['salsa', 60], ['tomato_canned', 40], ['cheddar', 30], ['sour_cream', 15]], [`enchiladas de ${n.toLowerCase()}`], 'serving (3)']),
  ['Enchiladas verdes', [['corn_tortilla', 90], ['chicken_meat', 100], ['salsa', 80], ['sour_cream', 20], ['monterey', 30]], ['green enchiladas'], 'serving (3)'],
  ...[['Cheese', []], ['Chicken', [['chicken_meat', 80]]], ['Steak', [['beef_sirloin', 80]]]].map(([n, f]) => [`${n} quesadilla`, [['flour_tortilla', 90], ['monterey', 60], ...f, ['salsa', 20], ['oil', 5]], [`quesadilla de ${n.toLowerCase()}`], 'quesadilla']),
  ...[['Chicken', 'Chicken'], ['Steak', 'Steak'], ['Shrimp', 'Prawn']].map(([n, p]) => [`${n} fajitas`, [...P[p], ['red_pepper', 60], ['green_pepper', 40], ['onion', 50], ['oil', 10], ['flour_tortilla', 90], ['sour_cream', 20], ['guacamole', 30]], ['fajitas'], 'serving']),
  ['Chicken tostadas', [['taco_shell', 40], ['refried', 60], ['chicken_meat', 80], ['lettuce', 20], ['sour_cream', 15], ['cheddar', 15], ['salsa', 20]], [], 'serving (2)'],
  ['Chiles rellenos', [['green_pepper', 150], ['monterey', 60], ['egg', 40], ['flour', 10], ['oil', 20], ['tomato_canned', 60]], ['chile relleno'], 'serving (2)'],
  ['Pozole rojo', [['hominy', 150], ['pork_shoulder', 110], ['chili', 8], ['onion', 20], ['cabbage', 20], ['stock', 250]], ['pozole'], 'bowl'],
  ['Pork tamales', [['masa', 70], ['water', 60], ['oil', 15], ['pork_shoulder', 60], ['chili', 5]], ['tamales de puerco'], 'serving (2)'],
  ['Chicken tamales', [['masa', 70], ['water', 60], ['oil', 15], ['chicken_meat', 60], ['salsa', 20]], ['tamales de pollo'], 'serving (2)'],
  ['Huevos rancheros', [['corn_tortilla', 60], ['egg_fried', 100], ['salsa', 60], ['refried', 60], ['monterey', 15]], [], 'plate'],
  ['Chicken mole poblano', [['chicken_thigh', 170], ['dark_choc', 10], ['chili', 8], ['peanuts', 10], ['tomato', 40], ['onion', 20], ['oil', 10], ['rice', 150]], ['mole poblano'], 'plate'],
  ['Sopa de tortilla', [['corn_tortilla', 40], ['tomato', 80], ['chicken_stewed', 60], ['avocado', 30], ['monterey', 15], ['stock', 250]], ['tortilla soup'], 'bowl'],
  ['Elote', [['corn', 150], ['mayo', 12], ['parmesan', 10], ['chili_powder', 1], ['lime', 3]], ['mexican street corn'], 'cob'],
  ['Carne asada plate', [['flank', 170], ['rice', 150], ['pinto', 100], ['guacamole', 30], ['salsa', 30], ['corn_tortilla', 30]], ['carne asada platter'], 'plate'],
  ['Chicken flautas', [['corn_tortilla', 90], ['chicken_meat', 90], ['oil', 20], ['sour_cream', 20], ['lettuce', 15], ['salsa', 20]], ['taquitos'], 'serving (3)'],
  ['Sopes', [['masa', 60], ['water', 40], ['refried', 50], ['beef_mince', 50], ['lettuce', 15], ['sour_cream', 15], ['oil', 10]], [], 'serving (2)'],
  ['Tlayuda', [['flour_tortilla', 100], ['refried', 70], ['monterey', 50], ['beef_sirloin', 60], ['cabbage', 20], ['avocado', 30]], ['mexican pizza oaxaca'], 'tlayuda'],
  ['Molletes', [['roll', 80], ['refried', 70], ['monterey', 40], ['salsa', 30]], [], 'serving (2)'],
  ['Cochinita pibil', [['pork_shoulder', 170], ['oj', 30], ['lime', 10], ['onion', 30], ['corn_tortilla', 60]], ['pibil'], 'plate'],
  ['Chilaquiles rojos', [['corn_tortilla', 80], ['oil', 15], ['salsa', 80], ['egg_fried', 50], ['sour_cream', 15], ['monterey', 15]], ['chilaquiles'], 'plate'],
  ['Beef nachos', [['taco_shell', 80], ['beef_mince', 80], ['cheddar', 50], ['salsa', 40], ['sour_cream', 20], ['guacamole', 30]], ['nachos supreme'], 'plate'],
  ['Flan', [['milk', 80], ['egg', 30], ['sugar', 25]], ['flan mexicano', 'caramel custard'], 'slice'],
  ['Tres leches cake', [['flour', 30], ['egg', 25], ['sugar', 25], ['milk', 60], ['cream', 20]], ['pastel tres leches'], 'slice'],
];
for (const [n, items, al, u] of MX) serve(n, 'Mexican', items, al, u);

// ---------------- Caribbean & Latin America ----------------
const LA = [
  ['Jamaican curry chicken', 'Caribbean', [['chicken_thigh', 170], ['potato', 60], ['curry', 6], ['onion', 30], ['oil', 10], ['thyme', 1]], ['curry chicken jamaican']],
  ['Brown stew chicken', 'Caribbean', [['chicken_thigh', 170], ['brown_sugar', 8], ['onion', 30], ['tomato', 30], ['carrots', 30], ['oil', 10], ['soy', 8]], ['brown stew']],
  ['Stew peas with rice', 'Caribbean', [['kidney', 150], ['beef', 70], ['coconut_milk', 50], ['flour', 15], ['rice', 200]], ['jamaican stew peas'], 'plate'],
  ['Jerk pork', 'Caribbean', [['pork_shoulder', 170], ['chili', 8], ['onion', 20], ['soy', 8], ['brown_sugar', 5]], ['jerk pork jamaica']],
  ['Curry shrimp', 'Caribbean', [['shrimp', 150], ['curry', 5], ['coconut_milk', 50], ['onion', 30], ['oil', 10]], ['curry prawns caribbean']],
  ['Chicken roti (Trinidad)', 'Caribbean', [['flour', 90], ['split_peas', 30], ['chicken_thigh', 110], ['potato', 60], ['curry', 5], ['oil', 15], ['water', 40]], ['trini roti chicken'], 'roti'],
  ['Goat roti', 'Caribbean', [['flour', 90], ['split_peas', 30], ['goat', 110], ['potato', 60], ['curry', 5], ['oil', 15], ['water', 40]], ['curry goat roti'], 'roti'],
  ['Channa and aloo roti', 'Caribbean', [['flour', 90], ['split_peas', 30], ['chickpeas', 100], ['potato', 70], ['curry', 5], ['oil', 15], ['water', 40]], ['vegetarian roti trinidad'], 'roti'],
  ['Bake and saltfish', 'Caribbean', [['flour', 80], ['oil', 20], ['water', 40], ['salt_cod', 60], ['tomato', 30], ['onion', 20]], ['fry bake and saltfish'], 'serving'],
  ['Stew chicken with rice and peas', 'Caribbean', [['chicken_thigh', 150], ['brown_sugar', 6], ['onion', 25], ['oil', 8], ['rice', 150], ['kidney', 60], ['coconut_milk', 20]], ['trini stew chicken plate'], 'plate'],
  ['Callaloo', 'Caribbean', [['spinach', 150], ['okra', 50], ['coconut_milk', 60], ['onion', 30], ['butter', 5]], ['callaloo greens']],
  ['Cuban sandwich', 'Cuban', [['baguette', 100], ['pork_roast', 70], ['ham_slice', 40], ['swiss', 30], ['pickles', 20], ['mustard', 8], ['butter', 8]], ['cubano'], 'sandwich'],
  ['Picadillo with rice', 'Cuban', [['beef_mince', 130], ['tomato_canned', 60], ['olives', 15], ['raisins', 10], ['onion', 30], ['rice', 200]], ['cuban picadillo'], 'plate'],
  ['Arroz con gandules', 'Puerto Rican', [['rice', 250], ['kidney', 80], ['ham_slice', 30], ['olives', 10], ['oil', 12], ['tomato_paste', 10]], ['rice with pigeon peas'], 'plate'],
  ['Sancocho', 'Latin American', [['chicken_stewed', 120], ['corn', 60], ['yam', 80], ['cassava_cooked', 80], ['plantain', 60], ['stock', 300]], ['sancocho de gallina'], 'bowl'],
  ['Pastelón', 'Puerto Rican', [['plantain_fried', 150], ['beef_mince', 90], ['cheddar', 30], ['egg', 20], ['tomato_canned', 30]], ['plantain lasagna'], 'portion'],
  ['Diri ak pwa', 'Haitian', [['rice', 220], ['kidney', 100], ['oil', 12], ['onion', 20]], ['haitian rice and beans', 'diri kole'], 'plate'],
  ['Legim', 'Haitian', [['eggplant', 100], ['cabbage', 80], ['carrots', 50], ['beef', 70], ['spinach', 40], ['oil', 12]], ['haitian vegetable stew']],
  ['Bobó de camarão', 'Brazilian', [['shrimp', 130], ['cassava_cooked', 120], ['coconut_milk', 60], ['palm_oil', 10], ['tomato', 30], ['onion', 20]], ['shrimp bobo']],
  ['Strogonoff de frango', 'Brazilian', [['chicken_breast', 150], ['cream', 40], ['tomato_paste', 15], ['mushrooms', 40], ['rice', 180], ['fries', 50]], ['brazilian chicken stroganoff'], 'plate'],
  ['Frango à passarinho', 'Brazilian', [['chicken_fried', 180], ['garlic', 8], ['oil', 15]], ['brazilian fried chicken bites']],
  ['Pollo a la brasa with fries', 'Peruvian', [['chicken_leg', 220], ['fries', 150], ['lettuce', 30], ['mayo', 10]], ['peruvian roast chicken'], 'plate'],
  ...[['Beef', [['beef_mince', 60], ['onion', 15], ['egg_boiled', 10], ['olives', 5]]], ['Chicken', [['chicken_meat', 60], ['onion', 15]]], ['Cheese', [['mozzarella', 50]]]].map(([n, f]) => [`${n} empanadas`, 'Latin American', [['flour', 70], ['butter', 12], ['water', 25], ...f, ['egg', 8]], [`empanadas de ${n.toLowerCase()}`], 'serving (2)']),
  ['Arepa with cheese', 'Venezuelan / Colombian', [['masa', 80], ['water', 70], ['butter', 8], ['mozzarella', 50]], ['arepa de queso'], 'arepa'],
  ['Arepa reina pepiada', 'Venezuelan', [['masa', 80], ['water', 70], ['chicken_meat', 70], ['avocado', 40], ['mayo', 10]], ['reina pepiada'], 'arepa'],
  ['Arepa with shredded beef', 'Venezuelan', [['masa', 80], ['water', 70], ['beef_brisket', 80], ['tomato', 20], ['onion', 15]], ['arepa de carne mechada'], 'arepa'],
  ['Pabellón criollo', 'Venezuelan', [['rice', 180], ['black_beans', 120], ['beef_brisket', 110], ['plantain_fried', 80]], ['pabellon'], 'plate'],
  ['Ajiaco', 'Colombian', [['chicken_stewed', 110], ['potato', 150], ['corn', 60], ['cream', 20], ['avocado', 30], ['stock', 200]], ['ajiaco santafereno'], 'bowl'],
  ['Causa limeña', 'Peruvian', [['potato', 180], ['chicken_meat', 60], ['mayo', 15], ['avocado', 30], ['lime', 5], ['oil', 8]], ['causa'], 'portion'],
  ['Anticuchos', 'Peruvian', [['beef', 150], ['vinegar', 8], ['chili', 5], ['potato', 100], ['oil', 8]], ['peruvian beef skewers'], 'serving'],
  ['Chupe de camarones', 'Peruvian', [['shrimp', 110], ['potato', 100], ['milk', 80], ['rice', 40], ['corn', 40], ['egg', 30], ['stock', 150]], ['shrimp chowder peru'], 'bowl'],
  ['Arroz chaufa', 'Peruvian', [['rice', 280], ['chicken_thigh', 90], ['egg', 50], ['soy', 15], ['onion', 20], ['oil', 15]], ['chaufa', 'peruvian fried rice'], 'plate'],
  ['Tacu tacu', 'Peruvian', [['rice', 150], ['pinto', 120], ['oil', 15], ['egg_fried', 50], ['onion', 20]], [], 'plate'],
  ['Locro', 'Argentinian', [['pumpkin', 120], ['corn', 80], ['pinto', 70], ['beef', 60], ['chorizo', 20], ['stock', 150]], ['locro criollo'], 'bowl'],
  ['Carbonada', 'Argentinian', [['beef', 120], ['pumpkin', 80], ['potato', 70], ['corn', 50], ['tomato', 40], ['stock', 150]], ['carbonada criolla'], 'bowl'],
  ['Humitas', 'Andean', [['corn', 150], ['onion', 20], ['butter', 10], ['mozzarella', 20]], ['humita'], 'serving (2)'],
  ['Choripán', 'Argentinian', [['chorizo', 90], ['baguette', 70], ['parsley', 5], ['olive_oil', 8], ['vinegar', 3]], ['choripan'], 'sandwich'],
  ['Salteñas', 'Bolivian', [['flour', 70], ['butter', 12], ['beef', 50], ['potato', 30], ['peas', 15], ['egg_boiled', 10], ['stock', 20]], ['saltena'], 'serving (2)'],
  ['Ceviche', 'Peruvian', [['cod', 150], ['lime', 30], ['onion', 30], ['chili', 5], ['sweet_potato', 60], ['corn', 40]], ['ceviche peruano'], 'plate'],
  ['Feijão tropeiro', 'Brazilian', [['pinto', 150], ['bacon', 30], ['sausage', 30], ['egg', 30], ['kale', 30], ['cornmeal', 25]], ['tropeiro']],
  ['Pão com ovo', 'Brazilian', [['roll', 60], ['egg_fried', 50], ['butter', 8]], ['bread and egg brazil'], 'sandwich'],
  ['Brigadeiro', 'Brazilian', [['milk', 30], ['sugar', 15], ['dark_choc', 5], ['butter', 3]], ['brigadeiros'], 'serving (3)'],
];
for (const [n, cu, items, al, u] of LA) serve(n, cu, items, al, u);

// ---------------- Africa (beyond Nigeria) ----------------
const AF = [
  ['Kenyan beef stew with ugali', 'Kenyan', [['beef', 140], ['tomato', 60], ['onion', 30], ['carrots', 30], ['oil', 10], ['cornmeal', 80], ['water', 160]], ['ugali and beef stew', 'ugali nyama'], 'plate'],
  ['Kenyan chicken stew', 'Kenyan', [['chicken_thigh', 160], ['tomato', 70], ['onion', 30], ['potato', 60], ['oil', 10]], ['kuku kienyeji stew']],
  ['Chapati and beans', 'Kenyan', [['flour', 70], ['oil', 12], ['water', 35], ['kidney', 150], ['tomato', 40], ['onion', 20]], ['chapo beans'], 'plate'],
  ['Mandazi', 'East African', [['flour', 60], ['sugar', 10], ['coconut_milk', 25], ['oil', 15]], ['maandazi', 'swahili bun'], 'serving (2)'],
  ['Kachumbari', 'East African', [['tomato', 100], ['onion', 40], ['chili', 3], ['lime', 8], ['coriander', 3]], ['kenyan salsa salad']],
  ['Key wat', 'Ethiopian', [['beef', 150], ['onion', 80], ['butter', 15], ['paprika', 6], ['tomato_paste', 10]], ['key wot', 'spicy beef stew ethiopian']],
  ['Gomen', 'Ethiopian', [['kale', 150], ['onion', 30], ['oil', 10], ['garlic', 5]], ['ethiopian collard greens', 'gomen wat']],
  ['Beyaynetu', 'Ethiopian', [['red_lentils', 100], ['chickpea_flour', 30], ['kale', 60], ['cabbage', 60], ['potato', 40], ['oil', 25], ['flour', 120], ['water', 100]], ['ethiopian vegan platter', 'yetsom beyaynetu'], 'platter'],
  ['Tuo zaafi', 'Ghanaian', [['cornmeal', 100], ['water', 200], ['spinach', 80], ['palm_oil', 10], ['beef', 50]], ['TZ', 'tuo zafi with ayoyo'], 'plate'],
  ['Domoda', 'Gambian', [['beef', 120], ['peanut_butter', 40], ['tomato_paste', 20], ['pumpkin', 60], ['onion', 30], ['rice', 200]], ['gambian peanut stew'], 'plate'],
  ['Pap and wors', 'South African', [['cornmeal', 90], ['water', 180], ['sausage', 120], ['tomato', 50], ['onion', 30]], ['pap en wors', 'boerewors and pap'], 'plate'],
  ['Potjiekos', 'South African', [['lamb', 140], ['potato', 80], ['carrots', 50], ['pumpkin', 50], ['onion', 30], ['oil', 8]], ['potjie']],
  ['Sosaties', 'South African', [['lamb', 150], ['dates', 15], ['onion', 30], ['curry', 3], ['vinegar', 5]], ['sosatie skewers'], 'serving (2)'],
  ['Durban curry', 'South African', [['lamb', 150], ['potato', 80], ['tomato', 50], ['onion', 30], ['oil', 12], ['chili_powder', 4], ['curry', 4]], ['durban mutton curry']],
  ['Malva pudding', 'South African', [['flour', 30], ['sugar', 25], ['jam', 10], ['butter', 12], ['milk', 25], ['cream', 20]], ['malva'], 'portion'],
  ['Lamb tagine with prunes', 'Moroccan', [['lamb', 160], ['dates', 30], ['onion', 50], ['almonds', 10], ['cinnamon', 1], ['olive_oil', 10]], ['tajine lahm bel barkouk']],
  ['Kefta tagine', 'Moroccan', [['beef_mince', 140], ['tomato_canned', 120], ['egg', 50], ['onion', 30], ['olive_oil', 10], ['cumin', 2]], ['kefta mkaouara']],
  ['Vegetable tagine', 'Moroccan', [['chickpeas', 100], ['carrots', 60], ['zucchini', 60], ['sweet_potato', 60], ['tomato', 50], ['olive_oil', 12], ['raisins', 10]], ['vegan tagine']],
  ['Fish tagine', 'Moroccan', [['cod', 160], ['potato', 80], ['tomato', 60], ['green_pepper', 30], ['olive_oil', 12], ['lemon', 5]], ['tajine samak']],
  ['Couscous royale', 'Moroccan', [['couscous', 200], ['lamb', 70], ['chicken_thigh', 60], ['sausage', 30], ['chickpeas', 40], ['carrots', 40], ['zucchini', 40]], ['couscous royal'], 'plate'],
  ['Zaalouk', 'Moroccan', [['eggplant', 180], ['tomato', 80], ['olive_oil', 15], ['garlic', 5], ['cumin', 1]], ['zalouk']],
  ['Rfissa', 'Moroccan', [['chicken_thigh', 140], ['flour', 80], ['lentils', 40], ['onion', 50], ['butter', 15], ['stock', 80]], [], 'plate'],
  ['Hawawshi', 'Egyptian', [['pita', 100], ['beef_mince', 100], ['onion', 30], ['green_pepper', 20], ['oil', 8]], ['egyptian meat pita'], 'serving'],
  ['Fatta', 'Egyptian', [['rice', 180], ['pita', 50], ['lamb', 100], ['tomato_canned', 50], ['vinegar', 5], ['butter', 10], ['garlic', 5]], ['fattah egyptian'], 'plate'],
  ['Brik', 'Tunisian', [['phyllo', 30], ['egg', 50], ['tuna', 30], ['parsley', 3], ['oil', 15]], ['brik a l oeuf'], 'brik'],
  ['Lablabi', 'Tunisian', [['chickpeas', 200], ['bread', 40], ['olive_oil', 15], ['cumin', 2], ['egg_poached', 50], ['water', 150]], ['lablebi'], 'bowl'],
  ['Ojja', 'Tunisian', [['egg', 100], ['tomato_canned', 120], ['green_pepper', 40], ['sausage', 40], ['olive_oil', 12]], ['ojja merguez']],
  ['Sadza and beef stew', 'Zimbabwean', [['cornmeal', 100], ['water', 200], ['beef', 120], ['tomato', 50], ['onion', 25], ['oil', 8]], ['sadza nenyama'], 'plate'],
  ['Nshima with chicken', 'Zambian', [['cornmeal', 100], ['water', 200], ['chicken_stewed', 130], ['tomato', 40], ['kale', 40]], ['nsima with chicken'], 'plate'],
  ['Moambe chicken', 'Congolese', [['chicken_thigh', 170], ['palm_oil', 25], ['tomato', 40], ['onion', 30], ['peanut_butter', 15]], ['poulet moambe']],
  ['Attiéké with grilled fish', 'Ivorian', [['cassava_cooked', 200], ['fish', 150], ['tomato', 40], ['onion', 30], ['oil', 8]], ['attieke poisson', 'garba'], 'plate'],
  ['Kedjenou', 'Ivorian', [['chicken_thigh', 170], ['tomato', 60], ['eggplant', 50], ['onion', 30], ['chili', 5]], ['chicken kedjenou']],
  ['Suqaar', 'Somali', [['beef_sirloin', 150], ['onion', 30], ['green_pepper', 30], ['oil', 10], ['cumin', 2]], ['suqaar hilib']],
  ['Bariis iskukaris', 'Somali', [['rice', 280], ['lamb', 100], ['onion', 30], ['raisins', 10], ['oil', 15], ['cardamom', 1]], ['somali rice'], 'plate'],
  ['Zigni', 'Eritrean', [['beef', 150], ['onion', 60], ['tomato_paste', 15], ['paprika', 5], ['oil', 12]], ['tsebhi zigni']],
  ['Piri piri prawns', 'Mozambican', [['shrimp', 180], ['chili', 6], ['lemon', 10], ['butter', 12], ['garlic', 5]], ['camarão piri piri']],
  ['Matapa', 'Mozambican', [['spinach', 180], ['peanuts', 30], ['coconut_milk', 60], ['shrimp', 30]], ['cassava leaf stew mozambique']],
  ['Romazava', 'Malagasy', [['beef', 130], ['spinach', 120], ['tomato', 50], ['onion', 20], ['oil', 8], ['water', 120]], ['romazava stew'], 'bowl'],
  ['Muamba de galinha', 'Angolan', [['chicken_thigh', 170], ['palm_oil', 25], ['okra', 50], ['pumpkin', 50], ['onion', 20]], ['chicken muamba']],
  ['Isombe', 'Rwandan', [['spinach', 150], ['peanuts', 30], ['palm_oil', 15], ['eggplant', 40], ['onion', 20]], ['cassava leaves rwanda']],
  ['Mishkaki with chips', 'East African', [['beef_sirloin', 130], ['fries', 150], ['lemon', 5], ['oil', 5]], ['mshikaki and chips'], 'plate'],
];
for (const [n, cu, items, al, u] of AF) serve(n, cu, items, al, u);

// ---------------- Breakfasts, salads, soups and sweets from everywhere ----------------
const MISC = [
  ['Continental breakfast', 'International', [['croissant', 60], ['butter', 10], ['jam', 20], ['yogurt', 120], ['strawberries', 60]], ['hotel breakfast'], 'plate'],
  ['American breakfast', 'American', [['egg_scrambled', 100], ['bacon', 30], ['potato', 100], ['bread', 30], ['butter', 8]], ['bacon and eggs breakfast'], 'plate'],
  ['Turkish breakfast', 'Turkish', [['egg_boiled', 50], ['feta', 40], ['olives', 20], ['tomato', 50], ['cucumber', 50], ['bread', 60], ['honey', 10], ['butter', 8]], ['kahvalti'], 'plate'],
  ['Egg paratha', 'South Asian', [['flour', 70], ['egg', 50], ['oil', 15], ['water', 30], ['onion', 10]], ['anda paratha'], 'paratha'],
  ['Avocado toast', 'International', [['bread', 60], ['avocado', 70], ['lemon', 3], ['olive_oil', 5]], ['smashed avocado on toast'], 'serving (2 slices)'],
  ['Avocado toast with egg', 'International', [['bread', 60], ['avocado', 70], ['egg_poached', 50], ['olive_oil', 5]], ['avocado egg toast'], 'serving (2 slices)'],
  ['Greek yogurt with granola and berries', 'International', [['greek_yogurt', 170], ['granola', 40], ['strawberries', 60], ['honey', 10]], ['yogurt parfait', 'yogurt bowl'], 'bowl'],
  ['Overnight oats', 'International', [['oats', 50], ['milk', 120], ['yogurt', 50], ['banana', 50], ['honey', 8]], ['overnight oatmeal'], 'jar'],
  ['French toast', 'French / International', [['bread', 80], ['egg', 50], ['milk', 40], ['butter', 10], ['maple', 20]], ['pain perdu', 'eggy bread'], 'serving (2 slices)'],
  ['Porridge with banana and honey', 'International', [['oats', 50], ['milk', 200], ['banana', 60], ['honey', 10]], ['oatmeal with banana'], 'bowl'],
  ['Breakfast burrito', 'Mexican-American', [['flour_tortilla', 80], ['egg_scrambled', 100], ['potato', 60], ['cheddar', 20], ['salsa', 20], ['sausage', 30]], [], 'burrito'],
  ['Japanese breakfast', 'Japanese', [['rice', 150], ['salmon', 80], ['miso', 15], ['tofu', 30], ['egg', 50], ['laver', 2], ['water', 150]], ['washoku breakfast'], 'set'],
  ['Shakshuka with bread', 'Middle Eastern', [['egg', 100], ['tomato_canned', 150], ['red_pepper', 50], ['onion', 30], ['olive_oil', 10], ['bread', 60]], [], 'pan'],
  ['Smoked salmon bagel', 'International', [['bagel', 100], ['cream_cheese', 30], ['salmon', 50], ['capers', 3], ['onion', 10]], ['lox bagel', 'salmon and cream cheese bagel'], 'bagel'],
  ['Granola with milk', 'International', [['granola', 60], ['milk', 150]], [], 'bowl'],
  ['Greek salad with chicken', 'Greek', [['tomato', 80], ['cucumber', 80], ['feta', 40], ['olives', 15], ['onion', 20], ['olive_oil', 12], ['chicken_breast', 100]], ['chicken greek salad'], 'bowl'],
  ['Waldorf salad', 'American', [['apple', 100], ['celery_raw', 50], ['walnuts', 20], ['mayo', 25], ['lettuce', 40]], [], 'bowl'],
  ['Quinoa salad', 'International', [['quinoa', 150], ['cucumber', 50], ['tomato', 50], ['feta', 30], ['olive_oil', 10], ['lemon', 8], ['parsley', 5]], [], 'bowl'],
  ['Chicken salad', 'International', [['chicken_breast', 120], ['lettuce', 80], ['tomato', 50], ['cucumber', 50], ['olive_oil', 10]], ['grilled chicken salad'], 'bowl'],
  ['Tuna salad', 'International', [['tuna', 100], ['lettuce', 80], ['tomato', 50], ['corn', 30], ['egg_boiled', 50], ['olive_oil', 10]], ['tuna nicoise light'], 'bowl'],
  ['Pasta salad', 'International', [['pasta', 150], ['tomato', 40], ['cucumber', 30], ['mayo', 20], ['corn', 30]], [], 'bowl'],
  ['Kale and quinoa salad', 'International', [['kale_raw', 60], ['quinoa', 100], ['chickpeas', 60], ['avocado', 40], ['olive_oil', 10], ['lemon', 8]], ['kale salad'], 'bowl'],
  ['Salmon salad', 'International', [['salmon', 120], ['lettuce', 80], ['avocado', 40], ['cucumber', 40], ['olive_oil', 10]], [], 'bowl'],
  ['Tomato soup', 'International', [['tomato_canned', 250], ['onion', 30], ['butter', 8], ['cream', 20], ['stock', 60]], ['cream of tomato soup'], 'bowl'],
  ['Chicken noodle soup (homemade)', 'International', [['chicken_stewed', 80], ['egg_noodles', 80], ['carrots', 40], ['celery', 30], ['stock', 250]], [], 'bowl'],
  ['Butternut squash soup', 'International', [['butternut', 200], ['onion', 30], ['olive_oil', 8], ['cream', 20], ['stock', 120]], ['pumpkin soup'], 'bowl'],
  ['Pea and ham soup', 'British', [['split_peas', 150], ['ham_slice', 50], ['onion', 30], ['carrots', 30], ['water', 150]], [], 'bowl'],
  ['Cream of mushroom soup (homemade)', 'International', [['mushrooms', 150], ['onion', 30], ['butter', 10], ['cream', 40], ['stock', 150], ['flour', 8]], ['mushroom soup'], 'bowl'],
  ['Leek and potato soup', 'British', [['leeks', 100], ['potato', 120], ['butter', 10], ['milk', 50], ['stock', 150]], ['vichyssoise'], 'bowl'],
  ['Carrot and coriander soup', 'British', [['carrots', 180], ['onion', 30], ['coriander', 5], ['olive_oil', 8], ['stock', 150]], [], 'bowl'],
  ['Mulligatawny soup', 'Anglo-Indian', [['red_lentils', 60], ['chicken_stewed', 60], ['apple', 30], ['onion', 30], ['curry', 4], ['coconut_milk', 30], ['stock', 200]], ['mulligatawny'], 'bowl'],
  ['Chicken tortilla soup', 'Mexican', [['chicken_stewed', 80], ['tomato_canned', 100], ['black_beans', 60], ['corn', 40], ['corn_tortilla', 20], ['stock', 200]], [], 'bowl'],
  ['Baklava', 'Turkish / Middle Eastern', [['phyllo', 30], ['walnuts', 25], ['butter', 15], ['honey', 15], ['sugar', 10]], ['baklawa'], 'serving (2 pieces)'],
  ['Mochi', 'Japanese', [['sticky_rice', 50], ['sugar', 10], ['kidney', 20]], ['daifuku'], 'serving (2)'],
  ['Pavlova', 'Australian / New Zealand', [['meringue', 30], ['cream', 40], ['strawberries', 50], ['banana', 0]], [], 'slice'],
  ['Lamington', 'Australian', [['flour', 25], ['sugar', 15], ['egg', 10], ['butter', 8], ['dark_choc', 8]], [], 'piece'],
  ['Anzac biscuits', 'Australian / New Zealand', [['oats', 15], ['flour', 15], ['sugar', 10], ['butter', 10]], ['anzac cookies'], 'serving (2)'],
  ['Kheer with nuts', 'South Asian', [['milk', 200], ['rice', 40], ['sugar', 20], ['almonds', 10], ['raisins', 8]], [], 'bowl'],
  ['Rice pudding', 'International', [['milk', 200], ['rice_short', 40], ['sugar', 15]], [], 'bowl'],
];
for (const [n, cu, items, al, u] of MISC) serve(n, cu, items, al, u);

RECIPES.push(...NEW);
console.error(`recipes-global: ${added} international dishes added, ${skipped} skipped as already in the database`);
export { RECIPES };
