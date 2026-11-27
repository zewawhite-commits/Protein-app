/**
 * More world dishes and the plates people actually eat (Nov 2026 global audit).
 * Same rules as recipes.mjs: every ingredient is an exact USDA / FAO record by name.
 *  - a(...)    a dish assembled from cooked records; its weight is the sum of what goes in.
 *  - plate(...) a combination plate built from other dishes in this list plus cooked records:
 *              each dish contributes its own ingredients in proportion, so it stays exact.
 * Leaves with no official record of their own (bitter leaf, eru) use the closest listed leaf,
 * named in the ingredient list so it's checkable.
 */
import { RECIPES, I } from './recipes.mjs';

const K = {
  ...Object.fromEntries(Object.entries(I).map(([k, v]) => [k, v])),
  wing: 'Chicken, broilers or fryers, wing, meat and skin, cooked, roasted',
  chicken_leg: 'Chicken, broilers or fryers, leg, meat and skin, cooked, roasted',
  chicken_meat: 'Chicken, broilers or fryers, meat only, cooked, roasted', chicken_stewed: 'Chicken, broilers or fryers, meat only, cooked, stewed',
  chicken_mince: 'Chicken, ground, crumbles, cooked, pan-browned', lamb_mince: 'Lamb, ground, cooked, broiled',
  lamb_shoulder: 'Lamb, shoulder, whole (arm and blade), separable lean and fat, trimmed to 1/4" fat, choice, cooked, braised',
  oxtail: 'Beef, oxtails', pork_belly: 'Pork, fresh, belly, raw', pork_tenderloin: 'Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted',
  veal: 'Veal, leg (top round), separable lean only, cooked, braised', liver: 'Beef, variety meats and by-products, liver, cooked, braised',
  catfish: 'Fish, catfish, channel, farmed, cooked, dry heat', mackerel: 'Fish, mackerel, Atlantic, cooked, dry heat',
  salmon: 'Fish, salmon, Atlantic, farmed, cooked, dry heat', cod: 'Fish, cod, Atlantic, cooked, dry heat',
  paneer: 'Cheese, paneer', mozzarella: 'Cheese, mozzarella, low moisture, part-skim', feta: 'Cheese, feta', cream_cheese: 'Cream cheese, regular, plain',
  cauliflower: 'Cauliflower, cooked, boiled, drained, without salt', sticky_rice: 'Rice, white, cooked, glutinous', mango: 'Mangos, raw',
  egg_noodles: 'Noodles, egg, cooked, enriched, with added salt', chow_mein_noodles: 'Noodles, chinese, chow mein',
  waterleaf: 'Waterleaf, leaves, fresh, boiled* (without salt), drained', taro: 'Taro, cooked, without salt', cocoyam: 'Cocoyam, tuber, yellow, boiled* (as part of a recipe)',
  sauerkraut: 'Sauerkraut, canned, solids and liquids', green_beans: 'Beans, snap, green, cooked, boiled, drained, without salt', spinach_raw: 'Spinach, raw',
  leeks: 'Leeks, (bulb and lower leaf-portion), cooked, boiled, drained, without salt', semolina: 'Semolina, enriched', sesame_oil: 'Oil, sesame, salad or cooking',
  oyster_sauce: 'Sauce, oyster, ready-to-serve', basil: 'Basil, fresh', coriander: 'Coriander (cilantro) leaves, raw', mint: 'Mint, leaves, raw', lime: 'Lime juice, raw',
  pumpkin: 'Pumpkin, cooked, boiled, drained, without salt', breadfruit: 'Breadfruit, raw', cassava_cooked: 'Cassava, cooked', hominy: 'Hominy, canned, white',
  pinto: 'Beans, pinto, mature seeds, cooked, boiled, without salt', red_lentils: 'Lentils, red, split, dried, boiled in unsalted water', phyllo: 'Phyllo dough',
  puff_pastry: 'Puff pastry, frozen, ready-to-bake, baked', mayo: 'Mayonnaise, regular', ketchup: 'Ketchup', kimchi: 'Kimchi',
  pak_choi: 'Cabbage, chinese (pak-choi), cooked, boiled, drained, without salt', sprouts_cooked: 'Bean sprouts, cooked', shiitake: 'Mushrooms, shiitake, cooked, without salt',
  coconut_milk2: 'Coconut milk, fresh or canned', tamarind: 'Tamarind', peanuts_oil: 'Peanuts, all types, oil-roasted, without salt', green_plantain: 'Plantains, green, boiled',
  corn_tortilla: 'Tortillas, ready-to-bake or -fry, corn', masa: 'Corn flour, masa, enriched, white', roll: 'Bread, roll, Mexican, bollilo',
  cabbage_cooked: 'Cabbage, cooked, boiled, drained, without salt', cucumber_peeled: 'Cucumber, peeled, raw', yogurt_low: 'Yogurt, plain, low fat',
  mash: 'Potatoes, mashed, home-prepared, whole milk and butter added', cottage: 'Cheese, cottage, creamed, large or small curd', sugar_white: 'Sugar, white',
  zucchini: 'Squash, summer, zucchini, includes skin, cooked, boiled, drained, without salt', celery: 'Celery, cooked, boiled, drained, without salt',
  couscous: 'Couscous, cooked', split_peas: 'Peas, split, mature seeds, cooked, boiled, without salt', eggplant_raw: 'Eggplant, raw', breadcrumbs: 'Breadcrumbs, white',
  ackee: 'Ackee, canned, drained', corn_raw: 'Corn, sweet, yellow, raw', vegemite: 'Spread, yeast, vegemite',
  avocado: 'Avocados, raw, all commercial varieties', quinoa: 'Quinoa, cooked', tempeh: 'Tempeh, cooked', portabella: 'Mushrooms, portabella, grilled',
  melon_seed: 'Melon seed, kernel only, dried, raw', veggie_patty: 'Veggie burger patty, no bun', soy_milk: 'Soy milk, unsweetened',
  turmeric: 'Spices, turmeric, ground', cumin: 'Spices, cumin seed',
};
const key = (dish, k) => { if (!K[k]) throw new Error(`${dish}: unknown ingredient key ${k}`); return K[k]; };

/** A dish assembled from cooked records: weight = what goes in. */
const a = (name, cuisine, ingredients, portions, aliases = []) => {
  const ing = ingredients.map(([k, g]) => [key(name, k), g]);
  return { name, cuisine, aliases, portions, yield: ing.reduce((s, [, g]) => s + g, 0), ingredients: ing };
};
/** A dish with a cooked weight different from its raw weight (water lost or taken up). */
const c = (name, cuisine, yieldG, ingredients, portions, aliases = []) => ({ name, cuisine, aliases, portions, yield: yieldG, ingredients: ingredients.map(([k, g]) => [key(name, k), g]) });

const byName = () => new Map(RECIPES.map((r) => [r.name, r]));
/** A plate made of other dishes (by name) and cooked records (by key), each by the grams on the plate. */
const plate = (name, cuisine, parts, portions, aliases = []) => {
  const dishes = byName();
  const ing = [];
  let total = 0;
  for (const [part, g] of parts) {
    const dish = dishes.get(part);
    if (dish) { for (const [rec, rg] of dish.ingredients) ing.push([rec, Math.round(((rg * g) / dish.yield) * 10) / 10]); }
    else ing.push([key(name, part), g]);
    total += g;
  }
  // The same record from two dishes is listed once.
  const merged = new Map();
  for (const [rec, g] of ing) merged.set(rec, Math.round(((merged.get(rec) ?? 0) + g) * 10) / 10);
  return { name, cuisine, aliases, portions, yield: total, ingredients: [...merged.entries()] };
};

const PLATE = [['1 medium plate', 450], ['1 small plate', 300], ['1 large plate', 600]];
const DISH = [['1 medium plate', 300], ['1 small plate', 200], ['1 large plate', 400]];
const BOWL = [['1 medium bowl', 350], ['1 small bowl', 250], ['1 large bowl', 450]];
const SOUP = [['1 medium portion', 250], ['1 small portion', 150], ['1 large portion', 350], ['1 ladle', 150]];
const PIECE = (g, label = 'piece') => [[`1 ${label}`, g]];

// ---- Single dishes still missing from the database
RECIPES.push(
  // Africa
  c('Ndolé', 'Cameroonian', 900, [['spinach', 400], ['peanuts', 150], ['beef', 200], ['dried_shrimp', 30], ['onion', 60], ['garlic', 10], ['oil', 50], ['salt', 4]], SOUP, ['ndole', 'bitterleaf and peanut stew', 'ndolé (bitter leaf shown as spinach, closest record)']),
  c('Eru soup', 'Cameroonian', 900, [['waterleaf', 400], ['spinach', 150], ['palm_oil', 120], ['beef', 200], ['dried_shrimp', 30], ['salt', 4]], SOUP, ['eru', 'okazi soup cameroon', 'eru and waterleaf']),
  c('Achu yellow soup', 'Cameroonian', 700, [['palm_oil', 120], ['beef', 250], ['tripe', 100], ['stock', 300], ['chili', 10], ['salt', 4]], SOUP, ['yellow soup', 'achu soup']),
  c('Koki', 'Cameroonian', 750, [['cowpeas', 500], ['palm_oil', 80], ['cocoyam_leaves', 100], ['chili', 10], ['salt', 4]], PIECE(150), ['koki beans', 'koki corn']),
  c('Yassa chicken', 'Senegalese', 900, [['chicken_thigh', 500], ['onion', 400], ['lemon', 60], ['oil', 50], ['chili', 10], ['salt', 5]], DISH, ['poulet yassa', 'chicken yassa']),
  a('Taameya', 'Egyptian', [['fava', 300], ['parsley', 30], ['onion', 40], ['oil', 60], ['salt', 3]], PIECE(25), ['egyptian falafel', 'ta\'ameya']),
  c('Mahshi', 'Egyptian', 900, [['rice', 400], ['tomato', 200], ['onion', 80], ['parsley', 30], ['zucchini', 300], ['oil', 40], ['salt', 4]], DISH, ['stuffed vegetables', 'mahshi kousa']),
  c('Pastilla', 'Moroccan', 600, [['chicken_meat', 250], ['phyllo', 150], ['egg', 100], ['onion', 80], ['butter', 40], ['sugar', 20]], PIECE(150, 'slice'), ['bastilla', 'b\'stilla']),
  a('Msemen', 'Moroccan', [['flour', 300], ['semolina', 60], ['oil', 40], ['butter', 20], ['water', 180], ['salt', 4]], PIECE(80), ['rghaif', 'moroccan pancake']),
  c('Chorba', 'Algerian', 1400, [['lamb', 200], ['tomato', 200], ['chickpeas', 150], ['onion', 80], ['pasta', 150], ['oil', 30], ['stock', 800], ['salt', 5]], BOWL, ['chorba frik', 'shorba']),
  c('Chakhchoukha', 'Algerian', 1200, [['flour', 300], ['lamb', 250], ['chickpeas', 150], ['tomato', 200], ['onion', 80], ['oil', 40], ['stock', 400], ['salt', 5]], DISH, ['chakhchoukha', 'chekhchoukha']),
  a('Mhajeb', 'Algerian', [['semolina', 250], ['tomato', 150], ['onion', 80], ['oil', 40], ['water', 150], ['salt', 3]], PIECE(120), ['mahjouba']),
  a('Mishkaki', 'Tanzanian', [['beef_sirloin', 400], ['oil', 15], ['lemon', 20], ['garlic', 10], ['ginger', 10], ['salt', 3]], PIECE(80, 'skewer'), ['beef skewers', 'mshikaki']),
  a('Chips mayai', 'Tanzanian', [['fries', 200], ['egg_fried', 120], ['oil', 10]], [['1 plate', 330]], ['zege', 'chipsi mayai', 'chips omelette']),
  a('Rolex', 'Ugandan', [['egg_fried', 120], ['cabbage', 40], ['tomato', 40], ['onion', 20], ['flour', 100], ['oil', 20], ['water', 40]], PIECE(360), ['rolled eggs chapati', 'uganda rolex']),
  c('Luwombo', 'Ugandan', 700, [['chicken_stewed', 400], ['peanuts', 100], ['tomato', 100], ['onion', 60], ['stock', 150], ['salt', 4]], DISH, ['chicken luwombo']),
  c('Vetkoek', 'South African', 900, [['flour', 500], ['water', 300], ['oil', 120], ['sugar', 20], ['salt', 5]], PIECE(90), ['fat cakes', 'magwinya']),
  c('Misir wat', 'Ethiopian', 900, [['red_lentils', 600], ['onion', 150], ['oil', 60], ['tomato_paste', 30], ['paprika', 15], ['garlic', 10], ['salt', 4]], DISH, ['misir wot', 'red lentil stew']),
  c('Omo tuo', 'Ghanaian', 1000, [['sticky_rice', 1000]], [['1 ball', 250]], ['rice balls', 'omotuo']),
  // South Asia
  a('Paneer tikka', 'Indian', [['paneer', 300], ['yogurt', 80], ['red_pepper', 60], ['onion', 50], ['oil', 15], ['curry', 8], ['lemon', 10]], DISH, ['paneer tikka kebab']),
  c('Aloo gobi', 'Indian', 850, [['potato', 400], ['cauliflower', 350], ['onion', 80], ['tomato', 80], ['oil', 40], ['curry', 8], ['salt', 4]], DISH, ['aloo gobhi', 'potato cauliflower curry']),
  c('Pav bhaji', 'Indian', 900, [['potato', 400], ['cauliflower', 100], ['peas', 100], ['tomato', 150], ['onion', 80], ['butter', 50], ['curry', 10], ['bread', 240]], [['1 plate (bhaji + 2 pav)', 350]], ['pao bhaji']),
  a('Seekh kebab', 'Pakistani', [['lamb_mince', 400], ['onion', 50], ['coriander', 10], ['chili', 5], ['ginger', 5], ['garlic', 5], ['salt', 3]], PIECE(60, 'kebab'), ['sheekh kebab']),
  a('Chapli kebab', 'Pakistani', [['beef_mince', 400], ['onion', 60], ['tomato', 60], ['egg', 50], ['oil', 40], ['coriander', 10], ['salt', 3]], PIECE(110, 'kebab'), ['peshawari kebab']),
  c('Bhuna khichuri', 'Bangladeshi', 1100, [['rice', 600], ['red_lentils', 300], ['oil', 50], ['onion', 100], ['ginger', 10], ['salt', 5]], DISH, ['khichuri', 'bhuna khichdi']),
  a('Panta bhat', 'Bangladeshi', [['rice', 400], ['water', 150], ['onion', 20], ['chili', 5], ['salt', 2]], DISH, ['pantabhat', 'fermented rice']),
  // East & South-East Asia
  c('Baozi', 'Chinese', 800, [['flour', 400], ['pork_mince', 250], ['water', 200], ['soy', 20], ['ginger', 10], ['sugar', 15]], PIECE(90, 'bun'), ['bao', 'steamed pork bun', 'char siu bao', 'pork bun']),
  a('Yakitori', 'Japanese', [['chicken_thigh', 400], ['soy', 40], ['sugar', 20]], PIECE(40, 'skewer'), ['chicken skewers japanese']),
  c('Kimchi jjigae', 'Korean', 1000, [['kimchi', 300], ['pork_mince', 150], ['tofu', 200], ['onion', 50], ['stock', 400], ['sesame_oil', 10]], BOWL, ['kimchi stew', 'kimchi chigae']),
  a('Korean fried chicken', 'Korean', [['wing', 500], ['flour', 50], ['oil', 40], ['honey', 40], ['soy', 25], ['chili', 10], ['garlic', 10]], [['1 serving (6 pieces)', 220]], ['yangnyeom chicken', 'kfc korean']),
  a('Pad kra pao', 'Thai', [['chicken_mince', 200], ['rice', 250], ['egg_fried', 50], ['basil', 10], ['oyster_sauce', 15], ['fish_sauce', 10], ['oil', 15], ['chili', 5]], [['1 plate', 555]], ['pad krapow', 'thai basil chicken', 'kaprao']),
  a('Khao pad', 'Thai', [['rice', 300], ['egg', 50], ['chicken_breast', 80], ['onion', 30], ['fish_sauce', 10], ['oil', 15]], [['1 plate', 485]], ['thai fried rice', 'khao phat']),
  a('Mango sticky rice', 'Thai', [['sticky_rice', 150], ['mango', 150], ['coconut_milk', 60], ['sugar', 15]], [['1 serving', 375]], ['khao niao mamuang']),
  a('Com tam', 'Vietnamese', [['rice', 250], ['pork_loin', 120], ['egg_fried', 50], ['cucumber', 40], ['fish_sauce', 15], ['sugar', 5]], [['1 plate', 480]], ['broken rice', 'com tam suon']),
  a('Gado gado', 'Indonesian', [['cabbage_cooked', 80], ['green_beans', 80], ['sprouts_cooked', 60], ['potato', 100], ['egg_boiled', 50], ['tofu', 80], ['peanut_butter', 50], ['water', 40]], [['1 plate', 540]], ['gado-gado', 'indonesian salad with peanut sauce']),
  a('Mie goreng', 'Indonesian', [['egg_noodles', 300], ['chicken_breast', 80], ['cabbage', 50], ['egg', 50], ['soy', 25], ['oil', 20]], [['1 plate', 525]], ['mee goreng', 'indonesian fried noodles']),
  c('Soto ayam', 'Indonesian', 1300, [['chicken_stewed', 250], ['rice_noodles', 200], ['egg_boiled', 100], ['sprouts_cooked', 80], ['stock', 700], ['oil', 15], ['ginger', 10]], BOWL, ['soto', 'indonesian chicken soup']),
  c('Nasi uduk', 'Indonesian', 1000, [['rice', 900], ['coconut_milk', 150]], DISH, ['coconut rice indonesian']),
  a('Roti canai', 'Malaysian', [['flour', 300], ['oil', 40], ['egg', 30], ['water', 130], ['sugar', 10], ['salt', 4]], PIECE(90), ['roti prata', 'paratha malaysian']),
  a('Char kway teow', 'Malaysian', [['rice_noodles', 300], ['shrimp', 80], ['egg', 50], ['sprouts_cooked', 50], ['soy', 25], ['oil', 25]], [['1 plate', 530]], ['char kuey teow', 'fried flat noodles']),
  a('Sisig', 'Filipino', [['pork_shoulder', 250], ['bacon', 50], ['onion', 60], ['egg', 50], ['chili', 10], ['lemon', 15], ['soy', 15]], DISH, ['pork sisig']),
  c('Arroz caldo', 'Filipino', 1200, [['rice', 400], ['chicken_stewed', 200], ['ginger', 20], ['egg_boiled', 50], ['stock', 600], ['oil', 15]], BOWL, ['chicken rice porridge', 'lugaw']),
  // Middle East & Turkey
  c('Kibbeh', 'Lebanese', 800, [['bulgur', 300], ['lamb_mince', 350], ['onion', 100], ['oil', 60], ['salt', 4]], PIECE(60), ['kubba', 'kibbe']),
  a('Manakish', 'Lebanese', [['pita', 200], ['olive_oil', 30], ['thyme', 15], ['tahini', 5]], PIECE(250), ['manakeesh', 'zaatar bread', 'manaqish']),
  c('Maqluba', 'Palestinian', 1600, [['rice', 700], ['chicken_meat', 400], ['eggplant', 300], ['cauliflower', 200], ['oil', 60], ['onion', 80]], DISH, ['maqlouba', 'upside down rice']),
  a('Menemen', 'Turkish', [['egg', 150], ['tomato', 200], ['green_pepper', 80], ['olive_oil', 20], ['salt', 2]], [['1 pan (for one)', 450]], ['turkish scrambled eggs']),
  a('Chelo kebab', 'Iranian', [['rice', 300], ['beef_mince', 200], ['onion', 30], ['butter', 15], ['tomato', 100]], [['1 plate', 645]], ['chelow kabab', 'kebab with rice']),
  a('Musakhan', 'Palestinian', [['chicken_meat', 300], ['pita', 200], ['onion', 200], ['olive_oil', 50], ['salt', 3]], [['1 serving', 375]], ['msakhan']),
  c('Knafeh', 'Middle Eastern', 900, [['phyllo', 300], ['mozzarella', 300], ['butter', 120], ['sugar', 150], ['water', 100]], PIECE(120, 'slice'), ['kunafa', 'kanafeh']),
  // Europe
  c('Bacalhau à Brás', 'Portuguese', 900, [['salt_cod', 250], ['fries', 300], ['egg', 200], ['onion', 100], ['olive_oil', 50]], DISH, ['bacalhau', 'bacalhau a bras', 'salt cod with eggs and potatoes']),
  a('Pastel de nata', 'Portuguese', [['puff_pastry', 300], ['egg', 120], ['milk', 300], ['sugar', 150], ['flour', 30], ['cream', 50]], PIECE(60, 'tart'), ['pasteis de nata', 'portuguese custard tart']),
  c('Bigos', 'Polish', 1200, [['sauerkraut', 600], ['sausage', 200], ['pork_shoulder', 250], ['onion', 100], ['mushrooms', 100], ['tomato_paste', 30]], BOWL, ['hunter\'s stew']),
  a('Stamppot', 'Dutch', [['mash', 500], ['kale', 200], ['sausage', 150]], DISH, ['boerenkool stamppot', 'hutspot']),
  // Americas
  a('Buffalo wings', 'American', [['wing', 400], ['butter', 30], ['chili', 15], ['vinegar', 10]], [['1 serving (6 wings)', 190]], ['hot wings', 'chicken wings buffalo']),
  c('Arroz con pollo', 'Latin American', 1500, [['rice', 800], ['chicken_thigh', 400], ['red_pepper', 100], ['peas', 100], ['onion', 80], ['tomato', 100], ['oil', 40]], DISH, ['chicken and rice latin', 'arroz con pollo']),
  a('Milanesa', 'Argentinian', [['beef_sirloin', 150], ['breadcrumbs', 30], ['egg', 25], ['oil', 20]], PIECE(200), ['milanesa de carne', 'breaded steak']),
  c('Ají de gallina', 'Peruvian', 1000, [['chicken_stewed', 400], ['milk', 250], ['bread', 100], ['parmesan', 30], ['onion', 80], ['oil', 40], ['peanuts', 30], ['chili', 20]], DISH, ['aji de gallina']),
  c('Pastel de choclo', 'Chilean', 1200, [['corn', 600], ['beef_mince', 300], ['onion', 150], ['chicken_meat', 100], ['egg_boiled', 50], ['butter', 30], ['sugar', 10]], DISH, ['corn pie chile']),
  c('Cazuela', 'Chilean', 1600, [['beef', 300], ['potato', 300], ['pumpkin', 200], ['corn', 150], ['rice', 100], ['stock', 600]], BOWL, ['cazuela de vacuno', 'cazuela de ave']),
  a('Churrasco', 'Brazilian', [['beef_sirloin', 300], ['salt', 3]], PIECE(200, 'portion'), ['picanha', 'brazilian grilled beef', 'asado (grilled beef)']),
  c('Ropa vieja', 'Cuban', 1000, [['beef_brisket', 500], ['red_pepper', 150], ['onion', 100], ['tomato_canned', 200], ['olive_oil', 30], ['garlic', 10]], DISH, ['shredded beef cuban']),
  c('Moros y cristianos', 'Cuban', 1300, [['rice', 800], ['black_beans', 400], ['onion', 60], ['oil', 30], ['garlic', 10]], DISH, ['moros', 'black beans and rice cuban']),
  a('Mangú', 'Dominican', [['green_plantain', 400], ['butter', 30], ['onion', 50], ['vinegar', 10]], DISH, ['mangu', 'mashed plantain']),
  // Oceania
  a('Kokoda', 'Fijian', [['fish', 300], ['coconut_milk', 150], ['lime', 60], ['onion', 40], ['tomato', 60], ['chili', 5]], [['1 bowl', 300]], ['fijian ceviche', 'kokoda fish']),
  a('Lovo', 'Fijian', [['pork_shoulder', 300], ['chicken_meat', 300], ['taro', 400], ['cassava_cooked', 300], ['coconut_milk', 100]], PLATE, ['earth oven feast', 'umu']),
  a('Hangi', 'New Zealand Māori', [['pork_shoulder', 300], ['chicken_meat', 300], ['potato', 300], ['sweet_potato', 300], ['pumpkin', 200], ['cabbage_cooked', 100]], PLATE, ['hāngī', 'umu kai']),
  a('Vegemite toast', 'Australian', [['bread', 60], ['butter', 8], ['vegemite', 5]], [['1 slice', 70]], ['vegemite on toast']),
);

// ---- Plates people actually eat: a main with its sides. Built from the dishes above and cooked records.
RECIPES.push(
  // Nigeria / West Africa
  plate('Jollof rice with chicken', 'West African', [['Jollof rice', 300], ['drumstick', 120]], PLATE, ['jollof and chicken', 'chicken jollof']),
  plate('Jollof rice with chicken and plantain', 'West African', [['Jollof rice', 300], ['drumstick', 120], ['plantain_fried', 100]], PLATE, ['jollof chicken and dodo', 'jollof with dodo']),
  plate('Fried rice with chicken', 'West African', [['Fried rice, Nigerian style', 300], ['drumstick', 120]], PLATE, ['nigerian fried rice and chicken']),
  plate('Rice and stew with chicken', 'West African', [['rice', 300], ['Nigerian stew', 120], ['drumstick', 120]], PLATE, ['white rice and stew with chicken']),
  plate('Rice and stew with fish', 'West African', [['rice', 300], ['Nigerian stew', 120], ['catfish', 120]], PLATE, ['white rice and stew with fish', 'rice and fish stew']),
  plate('Rice and stew with beef', 'West African', [['rice', 300], ['Nigerian stew', 120], ['beef', 100]], PLATE, ['white rice and stew with meat', 'rice and stew']),
  plate('Rice and stew with egg', 'West African', [['rice', 300], ['Nigerian stew', 120], ['egg_boiled', 50]], PLATE, ['rice and egg stew']),
  plate('Beans and fried plantain', 'West African', [['Beans porridge', 300], ['plantain_fried', 120]], PLATE, ['beans and dodo', 'ewa and dodo']),
  plate('Ofada rice and ayamase', 'West African', [['rice', 300], ['Ofada stew', 150]], PLATE, ['ofada rice and stew', 'ofada and designer stew']),
  plate('Yam and egg sauce', 'West African', [['yam', 300], ['egg_fried', 100], ['tomato', 60], ['oil', 10]], PLATE, ['boiled yam and egg', 'yam and egg']),
  plate('Pounded yam and egusi soup', 'West African', [['Pounded yam', 250], ['Egusi soup', 250]], PLATE, ['pounded yam and egusi', 'iyan and egusi']),
  plate('Eba and okra soup', 'West African', [['Eba', 250], ['Okra soup', 250]], PLATE, ['garri and okra', 'eba and okro']),
  plate('Eba and egusi soup', 'West African', [['Eba', 250], ['Egusi soup', 250]], PLATE, ['garri and egusi']),
  plate('Amala and ewedu', 'West African', [['Amala', 250], ['Ewedu soup', 150], ['Nigerian stew', 100]], PLATE, ['amala ewedu and gbegiri', 'abula']),
  plate('Fufu and light soup', 'West African', [['Fufu', 250], ['Light soup', 300]], PLATE, ['fufu with light soup']),
  plate('Fufu and egusi soup', 'West African', [['Fufu', 250], ['Egusi soup', 250]], PLATE, ['fufu and egusi']),
  plate('Semovita and ogbono soup', 'West African', [['Semovita', 250], ['Ogbono soup', 250]], PLATE, ['semo and ogbono']),
  plate('Achu and yellow soup', 'Cameroonian', [['cocoyam', 250], ['Achu yellow soup', 200]], PLATE, ['achu', 'achu with yellow soup']),
  plate('Banku and tilapia', 'West African', [['Banku', 300], ['fish', 200], ['Shito', 20]], PLATE, ['banku and grilled tilapia']),
  plate('Waakye with egg and fish', 'West African', [['Waakye', 350], ['egg_boiled', 50], ['fish', 100], ['Shito', 20]], PLATE, ['waakye special']),
  // Asia
  plate('Chicken fried rice', 'Chinese', [['rice', 300], ['chicken_breast', 100], ['egg', 50], ['peas', 40], ['soy', 15], ['oil', 15]], PLATE, ['chinese chicken fried rice']),
  plate('Egg fried rice', 'Chinese', [['rice', 300], ['egg', 100], ['peas', 40], ['onion', 20], ['soy', 10], ['oil', 15]], PLATE, ['egg fried rice chinese']),
  plate('Shrimp fried rice', 'Chinese', [['rice', 300], ['shrimp', 100], ['egg', 50], ['peas', 40], ['soy', 15], ['oil', 15]], PLATE, ['prawn fried rice']),
  plate('Chicken biryani', 'Indian', [['rice', 350], ['chicken_thigh', 150], ['yogurt', 30], ['onion', 40], ['oil', 20], ['curry', 5]], PLATE, ['biryani with chicken', 'hyderabadi biryani']),
  plate('Lamb biryani', 'Indian', [['rice', 350], ['lamb', 150], ['yogurt', 30], ['onion', 40], ['oil', 20], ['curry', 5]], PLATE, ['mutton biryani', 'biryani with lamb', 'goat biryani']),
  plate('Rice and curry', 'Sri Lankan', [['rice', 300], ['Dal', 150], ['chicken_thigh', 100], ['coconut_milk', 30]], PLATE, ['sri lankan rice and curry']),
  plate('Chicken shawarma rice', 'Middle Eastern', [['rice', 250], ['chicken_thigh', 150], ['tahini', 20], ['tomato', 40], ['cucumber', 40], ['lettuce', 20]], PLATE, ['shawarma plate', 'shawarma rice bowl', 'chicken shawarma plate']),
  plate('Falafel plate', 'Middle Eastern', [['Taameya', 150], ['pita', 60], ['tahini', 20], ['tomato', 40], ['cucumber', 40]], PLATE, ['falafel with pita']),
  plate('Nasi kandar', 'Malaysian', [['rice', 300], ['chicken_thigh', 120], ['Dal', 80], ['egg_boiled', 50]], PLATE, ['nasi kandar rice']),
  // Europe / Americas / Caribbean
  plate('Fish and chips with mushy peas', 'British', [['Fish and chips', 450], ['split_peas', 100]], PLATE, ['fish chips and peas']),
  plate('Rice and peas with jerk chicken', 'Caribbean', [['Rice and peas', 300], ['Jerk chicken', 180]], PLATE, ['jerk chicken with rice and peas', 'rice and peas with chicken']),
  plate('Rice and peas with curry goat', 'Caribbean', [['Rice and peas', 300], ['Curry goat', 200]], PLATE, ['curry goat with rice and peas']),
  plate('Oxtail and rice', 'Caribbean', [['Rice and peas', 300], ['oxtail', 150], ['onion', 20], ['tomato', 30]], PLATE, ['oxtail with rice and peas', 'jamaican oxtail']),
  plate('Spaghetti with meatballs', 'Italian-American', [['pasta', 300], ['beef_mince', 150], ['tomato_canned', 150], ['parmesan', 10], ['olive_oil', 10]], PLATE, ['spaghetti and meatballs']),
  plate('Burrito bowl', 'Mexican', [['rice', 200], ['black_beans', 120], ['chicken_breast', 120], ['corn', 50], ['tomato', 50], ['cheddar', 20], ['lettuce', 30]], PLATE, ['chicken burrito bowl']),
  plate('Rice, beans and steak', 'Brazilian', [['rice', 250], ['black_beans', 150], ['beef_sirloin', 150], ['fries', 80]], PLATE, ['prato feito', 'pf', 'arroz feijao e bife']),
);

// ---- Vegan and vegetarian dishes from around the world (no meat stock or fish sauce hidden inside).
RECIPES.push(
  // Vegan
  c('Vegan jollof rice', 'West African', 1550, [['rice', 1000], ['tomato', 300], ['tomato_paste', 60], ['red_pepper', 150], ['onion', 100], ['chili', 15], ['oil', 80], ['curry', 5], ['thyme', 3], ['water', 200], ['salt', 6]], [['1 medium plate', 300], ['1 small plate', 200], ['1 large plate', 400], ['1 cooking spoon', 100]], ['vegan jollof', 'vegetarian jollof', 'meatless jollof']),
  c('Vegan moi moi', 'West African', 900, [['cowpeas', 600], ['red_pepper', 100], ['onion', 60], ['oil', 60], ['water', 150], ['salt', 4]], [['1 wrap', 150]], ['vegan moin moin', 'moimoi without egg']),
  c('Vegan egusi soup with mushrooms', 'West African', 900, [['melon_seed', 100], ['palm_oil', 60], ['mushrooms', 250], ['spinach', 250], ['onion', 60], ['tomato', 100], ['chili', 15], ['water', 250], ['salt', 5]], [['1 medium portion', 250], ['1 small portion', 150], ['1 large portion', 350], ['1 ladle', 150]], ['vegan egusi', 'vegetarian egusi']),
  c('Vegan efo riro', 'West African', 700, [['spinach', 400], ['palm_oil', 50], ['mushrooms', 150], ['red_pepper', 80], ['onion', 50], ['chili', 10], ['salt', 4]], [['1 medium portion', 200], ['1 ladle', 150]], ['vegan efo', 'vegetable soup vegan']),
  a('Vegetable fried rice', 'Chinese', [['rice', 300], ['peas', 50], ['carrots', 50], ['onion', 30], ['soy', 15], ['oil', 15]], [['1 plate', 460]], ['veg fried rice', 'vegan fried rice']),
  a('Tofu stir-fry with rice', 'East Asian', [['rice', 250], ['tofu', 150], ['pak_choi', 80], ['red_pepper', 50], ['soy', 20], ['sesame_oil', 10], ['ginger', 5]], [['1 plate', 565]], ['tofu stir fry', 'vegan stir fry']),
  a('Tofu pad thai', 'Thai', [['rice_noodles', 250], ['tofu', 120], ['sprouts_cooked', 50], ['peanuts', 20], ['soy', 20], ['tamarind', 15], ['sugar', 10], ['oil', 15], ['lime', 10]], [['1 plate', 510]], ['vegan pad thai', 'vegetarian pad thai']),
  c('Vegetable curry with coconut', 'South Asian', 1000, [['potato', 300], ['cauliflower', 200], ['peas', 100], ['tomato', 150], ['onion', 80], ['coconut_milk', 200], ['oil', 30], ['curry', 10], ['salt', 4]], [['1 medium bowl', 300]], ['vegan curry', 'veg curry', 'mixed vegetable curry']),
  plate('Vegetable biryani', 'Indian', [['rice', 350], ['peas', 50], ['carrots', 50], ['cauliflower', 50], ['onion', 40], ['oil', 20], ['curry', 5]], [['1 plate', 565]], ['veg biryani', 'vegan biryani']),
  c('Lentil soup', 'Middle Eastern', 1300, [['red_lentils', 500], ['onion', 100], ['carrots', 100], ['olive_oil', 30], ['cumin', 5], ['lemon', 20], ['water', 550], ['salt', 5]], [['1 medium bowl', 350]], ['shorbat adas', 'mercimek çorbası', 'vegan lentil soup']),
  c('Bean chili', 'American', 1200, [['kidney', 400], ['black_beans', 300], ['tomato_canned', 400], ['onion', 100], ['red_pepper', 100], ['oil', 30], ['chili', 10], ['cumin', 5]], [['1 medium bowl', 350]], ['vegan chili', 'vegetarian chili', 'three bean chili']),
  a('Lentil bolognese', 'Italian', [['pasta', 300], ['lentils', 150], ['tomato_canned', 150], ['onion', 30], ['carrots', 30], ['olive_oil', 10]], [['1 plate', 670]], ['vegan bolognese', 'lentil spaghetti']),
  c('Ratatouille', 'French', 1000, [['eggplant_raw', 300], ['zucchini', 300], ['red_pepper', 200], ['tomato', 300], ['onion', 100], ['olive_oil', 50], ['garlic', 10]], [['1 medium bowl', 250]], ['ratatouille provencale']),
  a('Tofu scramble', 'Vegan', [['tofu', 200], ['onion', 30], ['red_pepper', 40], ['spinach', 30], ['turmeric', 2], ['oil', 10]], [['1 serving', 312]], ['vegan scrambled eggs', 'scrambled tofu']),
  a('Buddha bowl', 'Vegan', [['quinoa', 150], ['chickpeas', 100], ['sweet_potato', 120], ['kale', 60], ['avocado', 50], ['tahini', 20]], [['1 bowl', 500]], ['vegan bowl', 'grain bowl']),
  a('Black bean tacos', 'Mexican', [['corn_tortilla', 90], ['black_beans', 120], ['tomato', 40], ['onion', 20], ['lettuce', 20], ['avocado', 40], ['lime', 5]], [['1 serving (3 tacos)', 335]], ['vegan tacos', 'bean tacos']),
  c('Mujadara', 'Middle Eastern', 1000, [['lentils', 400], ['rice', 400], ['onion', 200], ['olive_oil', 50], ['cumin', 5], ['salt', 5]], [['1 plate', 300]], ['mujaddara', 'lentils and rice']),
  a('Tempeh stir-fry with rice', 'Indonesian', [['rice', 250], ['tempeh', 120], ['green_beans', 80], ['soy', 20], ['oil', 15], ['chili', 5]], [['1 plate', 490]], ['tempeh goreng', 'vegan tempeh']),
  a('Avocado cucumber sushi roll', 'Japanese', [['rice_short', 150], ['avocado', 40], ['cucumber', 30], ['laver', 3], ['vinegar', 10], ['sugar', 5]], [['1 roll (8 pieces)', 238]], ['vegan sushi', 'veggie maki', 'avocado roll']),
  a('Veggie burger plate', 'American', [['veggie_patty', 100], ['bread', 60], ['lettuce', 20], ['tomato', 30], ['fries', 120]], [['1 plate', 330]], ['veggie burger and chips']),
  plate('Ewa agoyin and dodo', 'West African', [['Ewa agoyin', 300], ['plantain_fried', 120]], [['1 plate', 420]], ['agoyin beans and plantain', 'vegan beans and plantain']),
  plate('Red red with plantain', 'West African', [['Red red', 350], ['plantain_fried', 100]], [['1 plate', 450]], ['red red and kelewele']),
  plate('Falafel wrap', 'Middle Eastern', [['Taameya', 120], ['pita', 70], ['tahini', 20], ['tomato', 30], ['cucumber', 30], ['lettuce', 20]], [['1 wrap', 290]], ['falafel sandwich vegan', 'falafel pita']),
  // Vegetarian (eggs or dairy)
  c('Palak paneer', 'Indian', 800, [['spinach', 450], ['paneer', 200], ['onion', 60], ['tomato', 60], ['cream', 30], ['oil', 25], ['curry', 5]], [['1 medium bowl', 250]], ['saag paneer', 'spinach paneer']),
  c('Mushroom risotto', 'Italian', 1100, [['rice_short', 700], ['mushrooms', 250], ['parmesan', 40], ['butter', 30], ['onion', 60], ['olive_oil', 15], ['water', 100]], [['1 plate', 350]], ['risotto ai funghi', 'vegetarian risotto']),
  a('Vegetable lasagne', 'Italian', [['pasta', 300], ['zucchini', 150], ['spinach', 100], ['tomato_canned', 200], ['mozzarella', 100], ['parmesan', 20], ['olive_oil', 15]], [['1 portion', 300]], ['veggie lasagna', 'vegetarian lasagne']),
  a('Bean and cheese burrito', 'Mexican', [['flour_tortilla', 80], ['pinto', 120], ['cheddar', 30], ['rice', 60], ['tomato', 30]], [['1 burrito', 320]], ['vegetarian burrito']),
  plate('Vegetable thali', 'Indian', [['rice', 200], ['Dal', 150], ['Aloo gobi', 120], ['Chana masala', 120], ['yogurt', 50]], [['1 thali', 640]], ['veg thali', 'vegetarian thali']),
);

export { RECIPES, K };
