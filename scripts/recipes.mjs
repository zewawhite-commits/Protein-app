/**
 * Standard recipes for world dishes that the official tables don't list as a dish.
 *
 * Every number still comes from an official record: each ingredient points at an exact
 * USDA (SR Legacy / FNDDS) or FAO/INFOODS West Africa record by name, and the dish's
 * values per 100 g are the weighted sum of those records divided by the cooked weight
 * (`yield`, which accounts for water lost or gained in cooking). Recipes follow common
 * home versions; the app shows the full ingredient list on every dish so it's checkable.
 *
 * ingredients: [exact record name, grams as added]
 * aliases: other names and spellings people search for (added to the searchable name)
 */
// ---------------------------------------------------------------------------
// West African household measures. Sources and reasoning: docs/portions.md.
// Soup ladle ≈ 150 ml (Kumasi soup study); rice/stew "cooking spoon" ≈ 100 g / 75 g (weight steps
// between 1–4 spoons in the Accra photographic food atlas, IFPRI 2022); moi moi milk tin ≈ 196 g
// (Fadupin 2009, Univ. of Ibadan: ½ milk tin = 98 g). Medium is listed first: it's the default.
const SWALLOW = [['1 medium wrap', 250], ['1 small wrap', 150], ['1 large wrap', 350]];
const SOUP_PORTIONS = [['1 medium portion', 250], ['1 small portion', 150], ['1 large portion', 350], ['1 ladle', 150], ['1 cooking spoon', 75]];
const RICE_DISH = [['1 medium plate', 300], ['1 small plate', 200], ['1 large plate', 400], ['1 cooking spoon', 100], ['1 cup', 200]];
const PLATE_DISH = [['1 medium plate', 300], ['1 small plate', 200], ['1 large plate', 400], ['1 cooking spoon', 100]];
const BOWL_SOUP = [['1 medium bowl', 350], ['1 small bowl', 250], ['1 large bowl', 450], ['1 ladle', 150]];

export const RECIPES = [
  // ---- West Africa
  {
    name: 'Egusi soup', aliases: ['egushi', 'melon seed soup', 'agushi'], cuisine: 'West African', yield: 1000,
    ingredients: [
      ['Melon seed, kernel only, dried, raw', 100], ['Oil, palm', 60],
      ['Beef, round, bottom round, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised', 250],
      ['Shrimp, dried', 20], ['Spinach, cooked, boiled, drained, without salt', 250], ['Onions, raw', 60],
      ['Peppers, hot chili, red, raw', 15], ['Tomatoes, red, ripe, raw, year round average', 100],
      ['Soup, stock, beef, home-prepared', 300], ['Salt, table', 5],
    ],
    portions: SOUP_PORTIONS,
  },
  {
    name: 'Jollof rice', aliases: ['jolof', 'party jollof', 'nigerian jollof'], cuisine: 'West African', yield: 1600,
    ingredients: [
      ['Rice, white, long-grain, regular, enriched, cooked', 1000], ['Tomatoes, red, ripe, raw, year round average', 300],
      ["Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program)", 60],
      ['Peppers, sweet, red, raw', 150], ['Onions, raw', 100], ['Peppers, hot chili, red, raw', 10],
      ['Oil, vegetable, soybean, refined', 80], ['Soup, stock, beef, home-prepared', 200], ['Salt, table', 6],
    ],
    portions: RICE_DISH,
  },
  {
    name: 'Moi moi', aliases: ['moin moin', 'moyin moyin', 'bean pudding'], cuisine: 'West African', yield: 800,
    ingredients: [
      ['Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, with salt', 500],
      ['Peppers, sweet, red, raw', 100], ['Onions, raw', 60], ['Oil, vegetable, soybean, refined', 50],
      ['Egg, whole, cooked, hard-boiled', 100], ['Shrimp, dried', 15],
    ],
    portions: [['1 wrap (milk-tin size)', 196], ['1 small wrap', 130]],
  },
  {
    name: 'Akara', aliases: ['bean fritters', 'koose', 'accara'], cuisine: 'West African', yield: 430,
    ingredients: [
      ['Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, with salt', 400],
      ['Onions, raw', 50], ['Peppers, hot chili, red, raw', 10], ['Oil, vegetable, soybean, refined', 60],
    ],
    portions: [['1 piece (ball)', 30], ['5 pieces', 150]],
  },
  {
    name: 'Suya', aliases: ['beef suya', 'kilishi', 'spicy grilled beef'], cuisine: 'West African', yield: 600,
    ingredients: [
      ['Beef, flank, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, broiled', 500],
      ['Peanuts, all types, dry-roasted, without salt', 50], ['Oil, vegetable, soybean, refined', 15],
      ['Onions, raw', 30], ['Peppers, hot chili, red, raw', 5], ['Salt, table', 4],
    ],
    portions: [['1 stick', 80], ['1 wrap (paper)', 200]],
  },
  {
    name: 'Pounded yam', aliases: ['iyan', 'fufu yam'], cuisine: 'West African', yield: 1000,
    ingredients: [['Yam, cooked, boiled, drained, or baked, without salt', 1000]],
    portions: SWALLOW,
  },
  {
    name: 'Eba', aliases: ['garri', 'gari swallow'], cuisine: 'West African', yield: 900,
    ingredients: [['Cassava, grated, from fermented white cassava, toasted without oil (white gari)', 300], ['Beverages, water, tap, drinking', 600]],
    portions: SWALLOW,
  },
  {
    name: 'Efo riro', aliases: ['efo', 'spinach stew', 'vegetable soup'], cuisine: 'West African', yield: 900,
    ingredients: [
      ['Spinach, cooked, boiled, drained, without salt', 500], ['Oil, palm', 60],
      ['Beef, round, bottom round, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised', 200],
      ['Peppers, sweet, red, raw', 150], ['Onions, raw', 60], ['Shrimp, dried', 20], ['Peppers, hot chili, red, raw', 10], ['Salt, table', 4],
    ],
    portions: SOUP_PORTIONS,
  },
  {
    name: 'Okra soup', aliases: ['okro soup', 'okra stew'], cuisine: 'West African', yield: 900,
    ingredients: [
      ['Okra, cooked, boiled, drained, without salt', 400], ['Oil, palm', 40],
      ['Beef, round, bottom round, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised', 200],
      ['Shrimp, dried', 20], ['Onions, raw', 50], ['Soup, stock, beef, home-prepared', 300], ['Peppers, hot chili, red, raw', 10], ['Salt, table', 4],
    ],
    portions: SOUP_PORTIONS,
  },
  {
    name: 'Goat pepper soup', aliases: ['pepper soup', 'peppersoup'], cuisine: 'West African', yield: 1100,
    ingredients: [
      ['Game meat, goat, cooked, roasted', 400], ['Soup, stock, beef, home-prepared', 800], ['Onions, raw', 50],
      ['Peppers, hot chili, red, raw', 15], ['Salt, table', 5],
    ],
    portions: BOWL_SOUP,
  },
  {
    name: 'Puff puff', aliases: ['puff-puff', 'bofrot', 'mandazi'], cuisine: 'West African', yield: 900,
    ingredients: [
      ['Wheat flour, white, all-purpose, enriched, unbleached', 500], ['Sugars, granulated', 80],
      ['Beverages, water, tap, drinking', 350], ['Oil, vegetable, soybean, refined', 120],
    ],
    portions: [['1 piece (ball)', 30], ['5 pieces', 150]],
  },
  {
    name: 'Chin chin', aliases: ['chinchin'], cuisine: 'West African', yield: 750,
    ingredients: [
      ['Wheat flour, white, all-purpose, enriched, unbleached', 500], ['Sugars, granulated', 100], ['Butter, salted', 60],
      ['Egg, whole, raw, fresh', 50], ['Milk, whole, 3.25% milkfat, with added vitamin D', 100], ['Oil, vegetable, soybean, refined', 80],
    ],
    portions: [['1 handful', 30], ['1 cup', 100]],
  },
  {
    name: 'Waakye', aliases: ['rice and beans', 'waakye rice'], cuisine: 'West African', yield: 900,
    ingredients: [
      ['Rice, white, long-grain, regular, enriched, cooked', 600],
      ['Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, with salt', 300],
    ],
    portions: RICE_DISH,
  },
  // ---- Caribbean
  {
    name: 'Rice and peas', aliases: ['caribbean rice and peas', 'jamaican rice'], cuisine: 'Caribbean', yield: 1300,
    ingredients: [
      ['Rice, white, long-grain, regular, enriched, cooked', 800], ['Beans, kidney, red, mature seeds, cooked, boiled, without salt', 300],
      ['Coconut milk, fresh or canned', 200], ['Onions, raw', 40], ['Thyme, dried', 2], ['Salt, table', 5],
    ],
    portions: [['1 plate', 300], ['1 cup', 200]],
  },
  {
    name: 'Ackee and saltfish', aliases: ['ackee', 'akee and saltfish', 'saltfish'], cuisine: 'Caribbean', yield: 900,
    ingredients: [
      ['Akee, fruit, raw', 400], ['Fish, cod, Atlantic, cooked, dry heat', 250], ['Salt, table', 3], ['Onions, raw', 80],
      ['Peppers, sweet, red, raw', 80], ['Oil, vegetable, soybean, refined', 30], ['Tomatoes, red, ripe, raw, year round average', 100],
    ],
    portions: [['1 plate', 250]],
  },
  {
    name: 'Curry goat', aliases: ['curried goat', 'goat curry'], cuisine: 'Caribbean', yield: 1200,
    ingredients: [
      ['Game meat, goat, cooked, roasted', 600], ['Potatoes, boiled, cooked in skin, flesh, without salt', 300], ['Onions, raw', 100],
      ['Spices, curry powder', 15], ['Oil, vegetable, soybean, refined', 40], ['Garlic, raw', 10],
      ['Soup, stock, beef, home-prepared', 300], ['Salt, table', 5],
    ],
    portions: [['1 plate', 300]],
  },
  {
    name: 'Jerk chicken', aliases: ['jerk'], cuisine: 'Caribbean', yield: 560,
    ingredients: [
      ['Chicken, broilers or fryers, thigh, meat only, cooked, roasted', 500], ['Oil, vegetable, soybean, refined', 15],
      ['Onions, raw', 30], ['Peppers, hot chili, red, raw', 10], ['Salt, table', 5],
    ],
    portions: [['1 thigh', 120], ['1 plate', 250]],
  },
  // ---- East & Southern Africa
  {
    name: 'Ugali', aliases: ['nshima', 'sadza', 'pap', 'posho', 'maize porridge'], cuisine: 'East African', yield: 900,
    ingredients: [['Cornmeal, degermed, enriched, white', 250], ['Beverages, water, tap, drinking', 750]],
    portions: [['1 serving', 250]],
  },
  {
    name: 'Sukuma wiki', aliases: ['sukuma', 'braised collard greens'], cuisine: 'East African', yield: 560,
    ingredients: [
      ['Collards, cooked, boiled, drained, without salt', 400], ['Onions, raw', 60], ['Tomatoes, red, ripe, raw, year round average', 100],
      ['Oil, vegetable, soybean, refined', 30], ['Salt, table', 3],
    ],
    portions: [['1 serving', 150]],
  },
  // ---- Britain
  {
    name: 'Fish and chips', aliases: ['fish & chips', 'chippy'], cuisine: 'British', yield: 520,
    ingredients: [
      ['Fish, cod, Atlantic, cooked, dry heat', 200], ['Wheat flour, white, all-purpose, enriched, unbleached', 60], ['Oil, vegetable, soybean, refined', 40],
      ['Potatoes, french fried, all types, salt added in processing, frozen, home-prepared, oven heated', 250],
    ],
    portions: [['1 portion', 520], ['Half portion', 260]],
  },
  {
    name: 'Full English breakfast', aliases: ['fry up', 'full breakfast', 'english breakfast'], cuisine: 'British', yield: 650,
    ingredients: [
      ['Egg, whole, cooked, fried', 100], ['Pork, cured, bacon, cooked, baked', 40], ['Sausage, pork and beef, fresh, cooked', 100],
      ['Beans, baked, canned, plain or vegetarian', 150], ['Mushrooms, white, cooked, boiled, drained, without salt', 80],
      ['Tomatoes, red, ripe, raw, year round average', 80], ['Bread, white', 40], ['Butter, salted', 10],
    ],
    portions: [['1 plate', 650]],
  },
  {
    name: 'Beans on toast', aliases: ['beans toast'], cuisine: 'British', yield: 290,
    ingredients: [['Beans, baked, canned, plain or vegetarian', 200], ['Bread, white', 80], ['Butter, salted', 10]],
    portions: [['1 plate', 290]],
  },
  // ---- Middle East, South & South-East Asia, Mexico
  {
    name: 'Chicken shawarma wrap', aliases: ['shawarma', 'shwarma', 'chicken wrap'], cuisine: 'Middle Eastern', yield: 350,
    ingredients: [
      ['Chicken, broilers or fryers, thigh, meat only, cooked, roasted', 200], ['Bread, pita', 60], ['Yogurt, plain, whole milk', 30],
      ['Onions, raw', 20], ['Tomatoes, red, ripe, raw, year round average', 40],
    ],
    portions: [['1 wrap', 350]],
  },
  {
    name: 'Lamb kofta kebab', aliases: ['kofta', 'kebab', 'kabob', 'shish kebab'], cuisine: 'Middle Eastern', yield: 520,
    ingredients: [['Lamb, ground, cooked, broiled', 500], ['Onions, raw', 40], ['Salt, table', 4]],
    portions: [['1 skewer', 100], ['1 plate', 250]],
  },
  {
    name: 'Shakshuka', aliases: ['eggs in tomato sauce'], cuisine: 'Middle Eastern', yield: 900,
    ingredients: [
      ['Egg, whole, raw, fresh', 250], ['Tomatoes, red, ripe, raw, year round average', 500], ['Peppers, sweet, red, raw', 150],
      ['Onions, raw', 80], ['Oil, vegetable, soybean, refined', 30], ['Salt, table', 4],
    ],
    portions: [['1 serving', 300]],
  },
  {
    name: 'Chicken tikka masala', aliases: ['tikka masala', 'chicken tikka', 'butter chicken'], cuisine: 'Indian', yield: 900,
    ingredients: [
      ['Chicken, broilers or fryers, breast, meat only, cooked, roasted', 400], ['Tomatoes, red, ripe, raw, year round average', 300],
      ['Yogurt, plain, whole milk', 150], ['Onions, raw', 100], ['Oil, vegetable, soybean, refined', 40], ['Garlic, raw', 10],
      ['Ginger root, raw', 10], ['Spices, curry powder', 10], ['Salt, table', 5],
    ],
    portions: [['1 serving', 300]],
  },
  {
    name: 'Dal', aliases: ['daal', 'dhal', 'lentil curry', 'tarka dal'], cuisine: 'Indian', yield: 830,
    ingredients: [
      ['Lentils, mature seeds, cooked, boiled, without salt', 600], ['Onions, raw', 80], ['Tomatoes, red, ripe, raw, year round average', 100],
      ['Oil, vegetable, soybean, refined', 30], ['Garlic, raw', 10], ['Spices, curry powder', 8], ['Salt, table', 5],
    ],
    portions: [['1 bowl', 250], ['1 cup', 200]],
  },
  {
    name: 'Nasi goreng', aliases: ['indonesian fried rice'], cuisine: 'Indonesian', yield: 970,
    ingredients: [
      ['Rice, white, long-grain, regular, enriched, cooked', 600], ['Egg, whole, cooked, fried', 100],
      ['Chicken, broilers or fryers, thigh, meat only, cooked, roasted', 150], ['Soy sauce', 30],
      ['Oil, vegetable, soybean, refined', 30], ['Onions, raw', 50], ['Peppers, hot chili, red, raw', 10],
    ],
    portions: [['1 plate', 350]],
  },
  {
    name: 'Beef tacos', aliases: ['tacos', 'taco'], cuisine: 'Mexican', yield: 640,
    ingredients: [
      ['Beef, ground, 80% lean meat / 20% fat, crumbles, cooked, pan-browned', 300], ['Tortillas, ready-to-bake or -fry, corn', 180],
      ['Tomatoes, red, ripe, raw, year round average', 100], ['Onions, raw', 40], ['Cheese, Cheddar', 20],
    ],
    portions: [['1 taco', 107], ['3 tacos', 320]],
  },
  // ---- Added 21 Nov 2026 (database audit: dishes people searched for that were missing)
  { name: 'Poutine', aliases: ['poutine fries'], cuisine: 'Canadian', yield: 550,
    ingredients: [['Potatoes, french fried, all types, salt not added in processing, frozen, oven-heated', 300], ['Cheese, Cheddar', 100], ['Gravy, beef, canned, ready-to-serve', 150]],
    portions: [['1 regular serving', 350], ['1 small serving', 250], ['1 large serving', 500]] },
  { name: 'Butter tart', aliases: ['butter tarts'], cuisine: 'Canadian', yield: 780,
    ingredients: [['Pie crust, standard-type, prepared from recipe, baked', 300], ['Butter, salted', 60], ['Sugars, brown', 200], ['Syrups, corn, light', 100], ['Egg, whole, raw, fresh', 100], ['Raisins', 100]],
    portions: [['1 tart', 65]] },
  { name: 'Baguette', aliases: ['french stick', 'french baguette'], cuisine: 'French', yield: 100,
    ingredients: [['Bread, French or Vienna', 100]],
    portions: [['1 slice (5 cm)', 30], ['1/4 baguette', 63], ['1 whole baguette', 250]] },
  { name: 'Ayran', aliases: ['ayran yogurt drink', 'doogh', 'lassi salted'], cuisine: 'Turkish', yield: 1003,
    ingredients: [['Yogurt, plain, whole milk', 500], ['Water, tap', 500], ['Salt, table', 3]],
    portions: [['1 glass', 250], ['1 small cup', 200]] },
  { name: 'Lahmacun', aliases: ['lahmajun', 'turkish pizza'], cuisine: 'Turkish', yield: 720,
    ingredients: [['Wheat flour, white, all-purpose, enriched, bleached', 250], ['Water, tap', 150], ['Oil, olive, salad or cooking', 15], ['Salt, table', 3], ['Lamb, ground, raw', 200], ['Onions, raw', 80], ['Tomatoes, red, ripe, raw, year round average', 120], ['Peppers, hot chili, red, raw', 15], ['Parsley, fresh', 15]],
    portions: [['1 piece', 180]] },
  { name: 'Kebab koobideh', aliases: ['koobideh', 'kubideh', 'kabab koobideh'], cuisine: 'Persian', yield: 425,
    ingredients: [['Lamb, ground, raw', 300], ['Beef, ground, 80% lean meat / 20% fat, raw', 200], ['Onions, raw', 100], ['Salt, table', 5]],
    portions: [['1 skewer', 100], ['2 skewers', 200]] },
  { name: 'Ghormeh sabzi', aliases: ['ghormeh sabzi stew', 'persian herb stew'], cuisine: 'Persian', yield: 1350,
    ingredients: [['Lamb, shoulder, arm, separable lean and fat, trimmed to 1/8" fat, choice, raw', 400], ['Beans, kidney, red, mature seeds, cooked, boiled, without salt', 250], ['Parsley, fresh', 150], ['Spinach, raw', 150], ['Leeks, (bulb and lower leaf-portion), raw', 100], ['Coriander (cilantro) leaves, raw', 50], ['Onions, raw', 150], ['Oil, olive, salad or cooking', 60], ['Limes, raw', 30], ['Water, tap', 600], ['Salt, table', 6]],
    portions: [['1 medium bowl', 300], ['1 small bowl', 200], ['1 large bowl', 400]] },
  { name: 'Tahdig', aliases: ['tah dig', 'crispy persian rice'], cuisine: 'Persian', yield: 670,
    ingredients: [['Rice, white, long-grain, regular, enriched, cooked', 600], ['Butter, salted', 40], ['Oil, olive, salad or cooking', 40], ['Yogurt, plain, whole milk', 60]],
    portions: [['1 piece', 100]] },
  { name: 'Mandi', aliases: ['chicken mandi', 'yemeni mandi'], cuisine: 'Arabian', yield: 1400,
    ingredients: [['Rice, white, long-grain, regular, enriched, cooked', 900], ['Chicken, broilers or fryers, dark meat, meat only, cooked, roasted', 400], ['Butter, salted', 20], ['Onions, raw', 60], ['Oil, olive, salad or cooking', 20]],
    portions: PLATE_DISH },
  { name: 'Molokhia', aliases: ['mulukhiyah', 'molokheya', 'jute leaf soup'], cuisine: 'Egyptian', yield: 1100,
    ingredients: [['Jute, potherb, cooked, boiled, drained, without salt', 500], ['Soup, stock, chicken, home-prepared', 600], ['Garlic, raw', 20], ['Oil, olive, salad or cooking', 20], ['Salt, table', 4]],
    portions: BOWL_SOUP },
  { name: 'Coxinha', aliases: ['coxinhas', 'brazilian chicken croquette'], cuisine: 'Brazilian', yield: 1150,
    ingredients: [['Wheat flour, white, all-purpose, enriched, bleached', 300], ['Soup, stock, chicken, home-prepared', 500], ['Butter, salted', 30], ['Chicken, broilers or fryers, breast, meat only, cooked, roasted', 300], ['Onions, raw', 50], ['Cream cheese, regular, plain', 80], ['Egg, whole, raw, fresh', 50], ['Oil, vegetable, soybean, refined', 120]],
    portions: [['1 coxinha', 70], ['1 small coxinha', 35]] },
  { name: 'Goi cuon', aliases: ['vietnamese fresh spring rolls', 'summer rolls', 'fresh spring roll'], cuisine: 'Vietnamese', yield: 575,
    ingredients: [['Rice paper', 40], ['Rice noodles, cooked', 200], ['Crustaceans, shrimp, cooked', 120], ['Pork, fresh, ground, cooked', 80], ['Lettuce, green leaf, raw', 60], ['Spearmint, fresh', 10], ['Carrots, raw', 65]],
    portions: [['1 roll', 72], ['2 rolls', 144]] },
];

// ---------------------------------------------------------------------------
// More world dishes. Short ingredient keys → exact official record names.
const I = {
  rice: 'Rice, white, long-grain, regular, enriched, cooked', rice_short: 'Rice, white, short-grain, enriched, cooked',
  palm_oil: 'Oil, palm', oil: 'Oil, vegetable, soybean, refined', olive_oil: 'Oil, olive, salad or cooking', butter: 'Butter, salted',
  beef: 'Beef, round, bottom round, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised',
  beef_sirloin: 'Beef, top sirloin, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, broiled',
  beef_brisket: 'Beef, brisket, flat half, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised',
  beef_mince: 'Beef, ground, 85% lean meat / 15% fat, crumbles, cooked, pan-browned',
  beef_mince_raw: "Beef, ground, 85% lean meat / 15% fat, raw (Includes foods for USDA's Food Distribution Program)",
  tripe: 'Beef, variety meats and by-products, tripe, cooked, simmered', goat: 'Game meat, goat, cooked, roasted',
  lamb: 'Lamb, leg, whole (shank and sirloin), separable lean and fat, trimmed to 1/4" fat, choice, cooked, roasted',
  chicken_thigh: 'Chicken, broilers or fryers, thigh, meat only, cooked, roasted', chicken_breast: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
  drumstick: 'Chicken, broilers or fryers, drumstick, meat and skin, cooked, roasted', gizzard: 'Chicken, gizzard, all classes, cooked, simmered',
  duck: 'Duck, domesticated, meat and skin, cooked, roasted',
  pork_loin: 'Pork, fresh, loin, blade (roasts), bone-in, separable lean and fat, cooked, roasted',
  pork_shoulder: 'Pork, fresh, shoulder, (Boston butt), blade (steaks), separable lean and fat, cooked, braised',
  pork_mince: 'Pork, ground, 72% lean / 28% fat, cooked, crumbles', ribs: 'Pork, fresh, spareribs, separable lean and fat, cooked, braised',
  bacon: 'Pork, cured, bacon, cooked, baked', sausage: 'Pork sausage', ham: 'Pork, cured, ham -- water added, rump, bone-in, separable lean and fat, heated, roasted',
  fish: 'Fish, tilapia, cooked, dry heat', salt_cod: 'Fish, cod, Atlantic, dried and salted', tuna: 'Fish, tuna, light, canned in water, without salt, drained solids',
  shrimp: 'Crustaceans, shrimp, cooked', dried_shrimp: 'Shrimp, dried',
  egg: 'Egg, whole, raw, fresh', egg_boiled: 'Egg, whole, cooked, hard-boiled', egg_fried: 'Egg, whole, cooked, fried',
  milk: 'Milk, whole, 3.25% milkfat, with added vitamin D', yogurt: 'Yogurt, plain, whole milk', greek_yogurt: 'Yogurt, Greek, plain, lowfat',
  cream: 'Cream, fluid, heavy whipping', cheddar: 'Cheese, Cheddar', parmesan: 'Cheese, parmesan, grated', tofu: 'Tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)',
  cowpeas: 'Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, without salt',
  kidney: 'Beans, kidney, red, mature seeds, cooked, boiled, without salt', black_beans: 'Beans, black turtle, mature seeds, cooked, boiled, without salt',
  chickpeas: 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt', fava: 'Broadbeans (fava beans), mature seeds, cooked, boiled, without salt',
  lentils: 'Lentils, mature seeds, cooked, boiled, without salt', baked_beans: 'Beans, baked, canned, plain or vegetarian', chickpea_flour: 'Chickpea flour (besan)',
  peanut_butter: "Peanut Butter, smooth (Includes foods for USDA's Food Distribution Program)", peanuts: 'Peanuts, all types, dry-roasted, without salt', tahini: 'Seeds, sesame butter, tahini, from roasted and toasted kernels (most common type)',
  onion: 'Onions, raw', tomato: 'Tomatoes, red, ripe, raw, year round average', tomato_canned: 'Tomatoes, red, ripe, canned, packed in tomato juice',
  tomato_paste: "Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program)",
  red_pepper: 'Peppers, sweet, red, raw', green_pepper: 'Peppers, sweet, green, raw', chili: 'Peppers, hot chili, red, raw', garlic: 'Garlic, raw', ginger: 'Ginger root, raw',
  spinach: 'Spinach, cooked, boiled, drained, without salt', kale: 'Kale, cooked, boiled, drained, without salt', cocoyam_leaves: 'Cocoyam, leaves, fresh, boiled* (without salt), drained',
  okra: 'Okra, cooked, boiled, drained, without salt', cabbage: 'Cabbage, raw', carrots: 'Carrots, cooked, boiled, drained, without salt', peas: 'Peas, green, frozen, cooked, boiled, drained, without salt',
  corn: 'Corn, sweet, yellow, cooked, boiled, drained, without salt', eggplant: 'Eggplant, cooked, boiled, drained, with salt', mushrooms: 'Mushrooms, white, cooked, boiled, drained, without salt',
  lettuce: 'Lettuce, cos or romaine, raw', cucumber: 'Cucumber, with peel, raw', parsley: 'Parsley, fresh', bean_sprouts: 'Mung beans, mature seeds, sprouted, raw', lemongrass: 'Lemon grass (citronella), raw',
  papaya: 'Papayas, raw', strawberries: 'Strawberries, raw', banana: 'Bananas, raw', apple: "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)", dates: 'Dates, medjool',
  yam: 'Yam, cooked, boiled, drained, or baked, without salt', cassava: 'Cassava, raw', plantain_fried: 'Plantain, cooked with oil', plantain: 'Plantain, cooked, no added fat',
  sweet_potato: 'Sweet potato, cooked, boiled, without skin', potato: 'Potatoes, boiled, cooked in skin, flesh, without salt', potato_baked: 'Potatoes, baked, flesh and skin, without salt',
  potato_roast: 'Potato, roasted, from fresh, peel eaten, fat added, NS as to fat type', fries: 'Potatoes, french fried, all types, salt added in processing, frozen, home-prepared, oven heated',
  flour: 'Wheat flour, white, all-purpose, enriched, unbleached', cornmeal: 'Cornmeal, degermed, enriched, white', tapioca: 'Tapioca, pearl, dry', bulgur: 'Bulgur, cooked',
  pasta: 'Pasta, cooked', rice_noodles: 'Rice noodles, cooked', bread: 'Bread, white', wholemeal: 'Bread, whole-wheat, commercially prepared', pita: 'Bread, pita, white, enriched',
  baguette: 'Bread, French or Vienna', flour_tortilla: 'Tortillas, ready-to-bake or -fry, flour, refrigerated', yorkshire: 'Yorkshire pudding, made with semi-skimmed milk, homemade',
  laver: 'Seaweed, laver, raw', miso: 'Miso', soy: 'Soy sauce', fish_sauce: 'Fish sauce', vinegar: 'Vinegar', lemon: 'Lemon juice, raw', honey: 'Honey',
  sugar: 'Sugars, granulated', brown_sugar: 'Sugars, brown', curry: 'Spices, curry powder', paprika: 'Spices, paprika', thyme: 'Thyme, dried',
  coconut_milk: 'Nuts, coconut milk, canned (liquid expressed from grated meat and water)', stock: 'Soup, stock, beef, home-prepared', water: 'Beverages, water, tap, drinking',
  gravy: 'Gravy, beef', bbq: 'Sauce, barbecue', meringue: 'Meringues', granola: 'Cereals ready-to-eat, granola, homemade', salt: 'Salt, table',
};
const d = (name, cuisine, yieldG, ingredients, portions, aliases = []) => ({
  name, cuisine, yield: yieldG, aliases, portions,
  ingredients: ingredients.map(([k, g]) => { if (!I[k]) throw new Error(`${name}: unknown ingredient key ${k}`); return [I[k], g]; }),
});
const BOWL = [['1 bowl', 300]], PLATE = [['1 plate', 350]];

RECIPES.push(
  // West Africa
  // The everyday red stew served with rice, yam and beans (meat counted separately, as people serve it).
  d('Nigerian stew', 'West African', 900, [['tomato', 600], ['red_pepper', 300], ['chili', 30], ['onion', 150], ['oil', 120], ['tomato_paste', 70], ['salt', 5]], [['1 medium portion', 150], ['1 small portion', 100], ['1 large portion', 220], ['1 cooking spoon', 75]], ['tomato stew', 'obe ata', 'red stew', 'obe', 'rice and stew stew']),
  d('Ofada stew', 'West African', 650, [['green_pepper', 250], ['palm_oil', 100], ['beef', 300], ['tripe', 150], ['onion', 100], ['chili', 30], ['salt', 4]], [['1 serving', 150]], ['ayamase', 'designer stew']),
  d('Yam porridge', 'West African', 950, [['yam', 600], ['palm_oil', 40], ['tomato', 150], ['red_pepper', 80], ['onion', 60], ['dried_shrimp', 15], ['spinach', 50], ['salt', 4]], PLATE_DISH, ['asaro', 'yam pottage']),
  d('Beans porridge', 'West African', 820, [['cowpeas', 600], ['palm_oil', 40], ['tomato', 100], ['red_pepper', 60], ['onion', 50], ['dried_shrimp', 10], ['salt', 4]], PLATE_DISH, ['ewa riro', 'beans and plantain']),
  d('Ewa agoyin', 'West African', 760, [['cowpeas', 600], ['palm_oil', 80], ['onion', 100], ['chili', 20], ['salt', 4]], BOWL, ['agoyin beans']),
  d('Gizdodo', 'West African', 850, [['plantain_fried', 300], ['gizzard', 250], ['tomato', 150], ['red_pepper', 100], ['onion', 60], ['oil', 40], ['salt', 3]], [['1 serving', 250]], ['gizzard and plantain']),
  d('Asun', 'West African', 600, [['goat', 500], ['onion', 80], ['chili', 20], ['oil', 20], ['salt', 4]], [['1 serving', 150]], ['spicy goat meat']),
  d('Edikang ikong', 'West African', 1000, [['spinach', 350], ['kale', 200], ['palm_oil', 80], ['beef', 250], ['salt_cod', 40], ['dried_shrimp', 20], ['onion', 50], ['chili', 10], ['salt', 4]], SOUP_PORTIONS, ['edikaikong', 'vegetable soup']),
  d('Banku', 'West African', 1000, [['cornmeal', 300], ['cassava', 200], ['water', 700]], [['1 ball', 250]], ['akple']),
  d('Kelewele', 'West African', 410, [['plantain_fried', 400], ['ginger', 10], ['chili', 5], ['salt', 2]], [['1 serving', 150]], ['spicy fried plantain']),
  d('Red red', 'West African', 950, [['cowpeas', 500], ['palm_oil', 50], ['tomato', 150], ['onion', 60], ['chili', 10], ['plantain_fried', 250], ['salt', 4]], PLATE_DISH, ['redred', 'beans stew with plantain']),
  d('Shito', 'West African', 450, [['oil', 300], ['dried_shrimp', 100], ['onion', 200], ['chili', 50], ['garlic', 20], ['ginger', 20]], [['1 tbsp', 15]], ['black pepper sauce', 'shitor']),
  d('Groundnut soup', 'West African', 1600, [['peanut_butter', 150], ['tomato', 300], ['onion', 100], ['chicken_thigh', 500], ['stock', 800], ['chili', 10], ['salt', 5]], BOWL, ['peanut soup', 'nkate nkwan', 'maafe soup']),
  d('Light soup', 'West African', 1800, [['chicken_thigh', 500], ['tomato', 400], ['onion', 150], ['chili', 20], ['stock', 1000], ['ginger', 10], ['salt', 5]], BOWL_SOUP, ['ghana light soup', 'pepper soup ghana']),
  d('Kontomire stew', 'West African', 800, [['cocoyam_leaves', 400], ['palm_oil', 60], ['tomato', 150], ['onion', 80], ['egg_boiled', 100], ['salt_cod', 50]], BOWL, ['palava sauce', 'kontomire']),
  d('Thieboudienne', 'West African', 1500, [['rice', 600], ['fish', 400], ['tomato_paste', 60], ['oil', 60], ['onion', 100], ['carrots', 150], ['cabbage', 150], ['eggplant', 100], ['salt', 6]], PLATE, ['ceebu jen', 'thieb', 'senegalese fish and rice']),
  d('Mafe', 'West African', 1400, [['beef', 400], ['peanut_butter', 150], ['tomato_paste', 50], ['onion', 100], ['sweet_potato', 200], ['carrots', 100], ['stock', 500], ['oil', 20], ['salt', 5]], BOWL, ['maafe', 'peanut stew', 'domoda']),
  // Southern & East Africa
  d('Chakalaka', 'Southern African', 1000, [['baked_beans', 400], ['onion', 100], ['red_pepper', 150], ['carrots', 150], ['tomato', 200], ['oil', 30], ['curry', 8], ['chili', 10]], [['1 serving', 150]]),
  d('Bobotie', 'Southern African', 650, [['beef_mince', 300], ['bread', 50], ['milk', 150], ['egg', 100], ['onion', 100], ['curry', 10], ['oil', 15], ['sugar', 10]], [['1 serving', 250]]),
  d('Bunny chow', 'Southern African', 690, [['bread', 200], ['beef', 200], ['potato', 150], ['onion', 50], ['oil', 15], ['curry', 8], ['tomato', 80]], [['Quarter loaf', 690]], ['bunny']),
  d('Pilau', 'East African', 1250, [['rice', 800], ['beef', 300], ['onion', 100], ['oil', 40], ['garlic', 10], ['curry', 8], ['salt', 6]], PLATE, ['pilau rice', 'pilaf']),
  d('Matoke', 'East African', 1050, [['plantain', 600], ['tomato', 150], ['onion', 80], ['beef', 200], ['oil', 30], ['salt', 4]], BOWL, ['matooke', 'green banana stew']),
  d('Githeri', 'East African', 980, [['corn', 400], ['kidney', 400], ['onion', 60], ['tomato', 100], ['oil', 20], ['salt', 4]], BOWL, ['corn and beans']),
  d('Irio', 'East African', 870, [['potato', 400], ['peas', 200], ['corn', 150], ['spinach', 100], ['butter', 20], ['salt', 3]], [['1 serving', 250]], ['mukimo']),
  d('Doro wat', 'East African', 1100, [['drumstick', 600], ['onion', 400], ['butter', 60], ['egg_boiled', 200], ['paprika', 15], ['chili', 15], ['tomato_paste', 30]], [['1 serving', 300]], ['doro wot', 'ethiopian chicken stew']),
  d('Shiro', 'East African', 850, [['chickpea_flour', 150], ['water', 600], ['oil', 40], ['onion', 100], ['tomato', 100], ['garlic', 10], ['salt', 4]], BOWL, ['shiro wat', 'chickpea stew']),
  d('Tibs', 'East African', 600, [['beef_sirloin', 400], ['onion', 100], ['red_pepper', 80], ['butter', 20], ['chili', 10], ['garlic', 10]], [['1 serving', 250]], ['tibbs', 'beef tibs']),
  d('Kitfo', 'East African', 535, [['beef_mince_raw', 500], ['butter', 30], ['chili', 5]], [['1 serving', 200]]),
  // North Africa & Middle East
  d('Chicken tagine', 'North African', 1300, [['chicken_thigh', 600], ['onion', 150], ['tomato', 200], ['chickpeas', 200], ['carrots', 150], ['olive_oil', 30], ['dates', 60], ['salt', 5]], [['1 serving', 350]], ['tagine', 'tajine']),
  d('Harira', 'North African', 1900, [['lentils', 200], ['chickpeas', 200], ['tomato', 400], ['lamb', 200], ['onion', 100], ['pasta', 100], ['olive_oil', 20], ['stock', 800], ['parsley', 20], ['salt', 6]], BOWL),
  d('Koshari', 'North African', 1450, [['rice', 300], ['lentils', 300], ['pasta', 300], ['chickpeas', 100], ['tomato_canned', 300], ['onion', 150], ['oil', 50], ['vinegar', 10], ['salt', 5]], PLATE, ['kushari', 'koshary']),
  d('Ful medames', 'Middle Eastern', 560, [['fava', 500], ['olive_oil', 30], ['lemon', 20], ['garlic', 10], ['salt', 4]], BOWL, ['foul', 'ful', 'fava bean stew']),
  d('Baba ganoush', 'Middle Eastern', 600, [['eggplant', 500], ['tahini', 60], ['lemon', 30], ['olive_oil', 20], ['garlic', 8]], [['2 tbsp', 30]], ['baba ghanoush', 'mutabal']),
  d('Fattoush', 'Middle Eastern', 790, [['lettuce', 200], ['tomato', 200], ['cucumber', 200], ['pita', 60], ['olive_oil', 40], ['lemon', 30], ['parsley', 20], ['onion', 40], ['salt', 3]], [['1 bowl', 250]]),
  d('Mansaf', 'Middle Eastern', 1500, [['lamb', 500], ['yogurt', 400], ['rice', 600], ['butter', 30]], PLATE),
  d('Kabsa', 'Middle Eastern', 1750, [['drumstick', 600], ['rice', 800], ['tomato', 200], ['onion', 100], ['oil', 40], ['carrots', 100], ['curry', 10], ['salt', 6]], PLATE, ['machboos', 'majboos']),
  d('Souvlaki', 'Greek', 790, [['pork_loin', 400], ['olive_oil', 20], ['lemon', 20], ['pita', 120], ['greek_yogurt', 80], ['cucumber', 60], ['onion', 30], ['tomato', 60]], [['1 wrap', 260]], ['gyros wrap', 'tzatziki wrap']),
  // South Asia
  d('Chana masala', 'Indian', 1050, [['chickpeas', 600], ['tomato', 300], ['onion', 150], ['oil', 40], ['garlic', 10], ['ginger', 10], ['curry', 10], ['salt', 6]], BOWL, ['chole', 'chickpea curry']),
  d('Rajma', 'Indian', 1050, [['kidney', 600], ['tomato', 300], ['onion', 150], ['oil', 40], ['garlic', 10], ['ginger', 10], ['curry', 8], ['salt', 6]], BOWL, ['rajma masala', 'kidney bean curry']),
  d('Chicken karahi', 'Pakistani', 1000, [['chicken_thigh', 600], ['tomato', 400], ['oil', 60], ['garlic', 15], ['ginger', 15], ['chili', 15], ['salt', 6]], [['1 serving', 300]], ['karahi', 'kadai chicken']),
  d('Haleem', 'Pakistani', 1200, [['beef', 400], ['lentils', 200], ['bulgur', 300], ['oil', 50], ['onion', 100], ['ginger', 10], ['garlic', 10], ['curry', 8], ['water', 300], ['salt', 5]], BOWL, ['daleem', 'khichda']),
  d('Nihari', 'Pakistani', 1300, [['beef_brisket', 600], ['oil', 60], ['flour', 30], ['onion', 100], ['ginger', 15], ['garlic', 15], ['curry', 10], ['stock', 600], ['salt', 6]], BOWL),
  d('Vegetable pulao', 'Indian', 1050, [['rice', 800], ['peas', 150], ['onion', 100], ['oil', 40], ['salt', 5]], PLATE, ['pulao', 'pulav', 'pilau rice']),
  d('Momo', 'Nepali', 880, [['flour', 300], ['water', 150], ['beef_mince', 200], ['cabbage', 150], ['onion', 60], ['garlic', 5], ['ginger', 5], ['soy', 15]], [['1 momo', 30], ['10 momos', 300]], ['momos', 'dumplings nepali']),
  // East & South-East Asia
  d('Mapo tofu', 'Chinese', 900, [['tofu', 500], ['pork_mince', 150], ['oil', 30], ['chili', 15], ['garlic', 10], ['soy', 20], ['stock', 200]], BOWL),
  d('Peking duck', 'Chinese', 460, [['duck', 300], ['flour_tortilla', 100], ['cucumber', 60]], [['1 serving', 230]], ['roast duck pancakes', 'crispy duck']),
  d('Char siu', 'Chinese', 560, [['pork_loin', 500], ['honey', 40], ['soy', 30], ['brown_sugar', 20]], [['1 serving', 150]], ['chinese bbq pork', 'cha siu']),
  d('Banh mi', 'Vietnamese', 265, [['baguette', 100], ['pork_loin', 100], ['carrots', 30], ['cucumber', 30], ['chili', 5]], [['1 sandwich', 265]], ['vietnamese sandwich']),
  d('Bun cha', 'Vietnamese', 630, [['pork_mince', 200], ['rice_noodles', 300], ['lettuce', 50], ['fish_sauce', 20], ['sugar', 15], ['lemon', 15], ['carrots', 30]], [['1 bowl', 630]]),
  d('Thai red curry', 'Thai', 950, [['chicken_thigh', 400], ['coconut_milk', 400], ['curry', 15], ['red_pepper', 100], ['fish_sauce', 20], ['sugar', 10], ['oil', 15]], BOWL, ['red curry', 'gaeng phed']),
  d('Massaman curry', 'Thai', 1250, [['beef', 400], ['coconut_milk', 400], ['potato', 300], ['peanuts', 40], ['onion', 80], ['curry', 15], ['fish_sauce', 20], ['sugar', 15]], BOWL, ['massaman']),
  d('Tom yum', 'Thai', 1600, [['shrimp', 300], ['stock', 1000], ['mushrooms', 150], ['lemongrass', 30], ['chili', 15], ['fish_sauce', 30], ['lemon', 30], ['tomato', 100]], BOWL, ['tom yum goong', 'tom yam']),
  d('Som tam', 'Thai', 400, [['papaya', 300], ['tomato', 50], ['peanuts', 20], ['fish_sauce', 15], ['lemon', 15], ['sugar', 10], ['chili', 5]], [['1 plate', 200]], ['papaya salad']),
  d('Larb', 'Thai', 630, [['pork_mince', 400], ['onion', 50], ['fish_sauce', 30], ['lemon', 30], ['chili', 10], ['lettuce', 100]], [['1 serving', 200]], ['laab', 'larb moo']),
  d('Beef rendang', 'Indonesian', 900, [['beef', 600], ['coconut_milk', 400], ['onion', 100], ['chili', 30], ['garlic', 15], ['ginger', 15], ['lemongrass', 20], ['sugar', 10], ['salt', 6]], [['1 serving', 200]], ['rendang']),
  d('Nasi lemak', 'Malaysian', 1070, [['rice', 600], ['coconut_milk', 150], ['egg_boiled', 100], ['peanuts', 40], ['cucumber', 60], ['dried_shrimp', 20], ['chili', 20], ['oil', 30], ['onion', 50]], [['1 plate', 350]]),
  d('Laksa', 'Malaysian', 1850, [['rice_noodles', 400], ['coconut_milk', 400], ['stock', 600], ['shrimp', 200], ['tofu', 100], ['bean_sprouts', 100], ['curry', 15], ['chili', 10], ['oil', 15]], [['1 bowl', 500]], ['curry laksa']),
  d('Sinigang', 'Filipino', 1800, [['ribs', 400], ['tomato', 200], ['onion', 100], ['okra', 100], ['spinach', 100], ['stock', 1000], ['fish_sauce', 20], ['lemon', 30]], BOWL, ['sinigang na baboy']),
  d('Pancit', 'Filipino', 930, [['rice_noodles', 400], ['chicken_thigh', 200], ['cabbage', 150], ['carrots', 80], ['soy', 30], ['oil', 20], ['onion', 50]], PLATE, ['pancit bihon', 'pansit']),
  d('Chicken katsu', 'Japanese', 300, [['chicken_breast', 200], ['flour', 25], ['egg', 30], ['oil', 30], ['salt', 2]], [['1 cutlet', 150]], ['katsu', 'tonkatsu', 'katsu curry']),
  d('Oyakodon', 'Japanese', 628, [['rice_short', 300], ['chicken_thigh', 150], ['egg', 100], ['onion', 50], ['soy', 20], ['sugar', 8]], [['1 bowl', 628]], ['donburi', 'chicken and egg rice bowl']),
  d('Onigiri', 'Japanese', 122, [['rice_short', 100], ['tuna', 20], ['laver', 1], ['salt', 1]], [['1 rice ball', 120]], ['rice ball', 'omusubi']),
  d('Miso soup', 'Japanese', 855, [['miso', 40], ['tofu', 100], ['laver', 5], ['water', 700], ['onion', 10]], [['1 bowl', 250]]),
  d('Gyoza', 'Japanese', 560, [['flour', 120], ['water', 60], ['pork_mince', 200], ['cabbage', 150], ['garlic', 5], ['ginger', 5], ['soy', 15], ['oil', 20]], [['1 gyoza', 25], ['6 gyoza', 150]], ['potstickers', 'jiaozi']),
  d('Okonomiyaki', 'Japanese', 700, [['flour', 150], ['egg', 100], ['cabbage', 300], ['water', 150], ['bacon', 40], ['oil', 15]], [['1 pancake', 350]]),
  d('Bulgogi', 'Korean', 650, [['beef_sirloin', 500], ['soy', 50], ['sugar', 20], ['onion', 80], ['garlic', 10], ['oil', 15]], [['1 serving', 200]], ['korean bbq beef']),
  d('Japchae', 'Korean', 740, [['rice_noodles', 300], ['beef_sirloin', 150], ['spinach', 100], ['carrots', 80], ['onion', 60], ['soy', 30], ['sugar', 10], ['oil', 20]], [['1 plate', 300]], ['chapchae', 'glass noodles']),
  d('Kimbap', 'Korean', 700, [['rice_short', 400], ['laver', 10], ['egg_fried', 100], ['carrots', 60], ['spinach', 60], ['ham', 60], ['oil', 10]], [['1 roll', 230]], ['gimbap']),
  // Caribbean & Latin America
  d('Doubles', 'Caribbean', 650, [['flour', 200], ['water', 100], ['oil', 40], ['chickpeas', 300], ['curry', 8], ['onion', 40]], [['1 doubles', 160]], ['trini doubles']),
  d('Jamaican festival', 'Caribbean', 450, [['cornmeal', 150], ['flour', 150], ['sugar', 30], ['milk', 100], ['oil', 50]], [['1 festival', 60]], ['festival dumpling']),
  d('Bammy', 'Caribbean', 450, [['cassava', 500], ['coconut_milk', 50], ['oil', 20]], [['1 bammy', 120]]),
  d('Escovitch fish', 'Caribbean', 800, [['fish', 500], ['oil', 40], ['vinegar', 60], ['onion', 100], ['carrots', 60], ['red_pepper', 60], ['chili', 10]], [['1 fish', 300]], ['escoveitch fish']),
  d('Pelau', 'Caribbean', 1650, [['chicken_thigh', 500], ['rice', 700], ['cowpeas', 200], ['coconut_milk', 150], ['brown_sugar', 20], ['oil', 20], ['onion', 60], ['carrots', 60]], PLATE),
  d('Griot', 'Caribbean', 680, [['pork_shoulder', 600], ['oil', 40], ['lemon', 30], ['onion', 50]], [['1 serving', 200]], ['griyo', 'haitian fried pork']),
  d('Mofongo', 'Caribbean', 580, [['plantain_fried', 500], ['bacon', 60], ['garlic', 15], ['olive_oil', 20], ['salt', 3]], [['1 serving', 290]]),
  d('Feijoada', 'Latin American', 1150, [['black_beans', 600], ['sausage', 200], ['pork_shoulder', 200], ['bacon', 50], ['onion', 100], ['garlic', 10], ['salt', 6]], BOWL),
  d('Pão de queijo', 'Latin American', 520, [['tapioca', 250], ['parmesan', 120], ['milk', 125], ['oil', 60], ['egg', 100]], [['1 cheese bread', 25]], ['pao de queijo', 'brazilian cheese bread']),
  d('Moqueca', 'Latin American', 1350, [['fish', 600], ['coconut_milk', 400], ['tomato', 200], ['onion', 100], ['red_pepper', 100], ['palm_oil', 30], ['lemon', 20], ['salt', 5]], BOWL, ['brazilian fish stew']),
  d('Lomo saltado', 'Latin American', 1450, [['beef_sirloin', 400], ['onion', 150], ['tomato', 200], ['fries', 250], ['soy', 30], ['oil', 20], ['vinegar', 15], ['rice', 400]], PLATE),
  d('Chimichurri', 'Latin American', 233, [['parsley', 60], ['olive_oil', 120], ['vinegar', 30], ['garlic', 15], ['chili', 5], ['salt', 3]], [['1 tbsp', 15]]),
  // Europe & Britain
  d('Spanish omelette', 'Spanish', 900, [['potato', 500], ['olive_oil', 60], ['egg', 300], ['onion', 150], ['salt', 4]], [['1 slice', 150]], ['tortilla espanola', 'tortilla de patatas']),
  d('Patatas bravas', 'Spanish', 650, [['potato_roast', 500], ['tomato_canned', 150], ['olive_oil', 20], ['chili', 5], ['garlic', 5], ['salt', 3]], [['1 tapas portion', 150]]),
  d('Cottage pie', 'British', 1400, [['beef_mince', 400], ['potato', 600], ['butter', 30], ['milk', 60], ['onion', 100], ['carrots', 100], ['gravy', 200]], [['1 portion', 350]]),
  d('Sunday roast', 'British', 630, [['beef_sirloin', 150], ['potato_roast', 200], ['carrots', 80], ['peas', 80], ['yorkshire', 40], ['gravy', 80]], [['1 plate', 630]], ['roast dinner', 'roast beef dinner']),
  d('Bangers and mash', 'British', 635, [['sausage', 150], ['potato', 300], ['butter', 15], ['milk', 30], ['gravy', 80], ['peas', 60]], [['1 plate', 635]], ['bangers', 'sausage and mash']),
  d('Jacket potato with beans and cheese', 'British', 500, [['potato_baked', 300], ['baked_beans', 150], ['cheddar', 40], ['butter', 10]], [['1 potato', 500]], ['jacket potato', 'baked potato']),
  d('Ploughman’s lunch', 'British', 380, [['wholemeal', 80], ['cheddar', 60], ['apple', 100], ['ham', 50], ['butter', 10], ['lettuce', 30], ['tomato', 50]], [['1 plate', 380]], ['ploughmans']),
  d('Eton mess', 'British', 390, [['strawberries', 200], ['meringue', 40], ['cream', 150]], [['1 glass', 195]]),
  d('Sticky toffee pudding', 'British', 1000, [['dates', 150], ['flour', 175], ['brown_sugar', 275], ['butter', 200], ['egg', 100], ['milk', 50], ['cream', 150]], [['1 portion', 150]], ['sticky toffee']),
  d('Mac and cheese', 'American', 1200, [['pasta', 600], ['cheddar', 200], ['milk', 400], ['butter', 40], ['flour', 30]], [['1 bowl', 300]], ['macaroni cheese', 'mac n cheese']),
  d('BBQ ribs', 'American', 560, [['ribs', 500], ['bbq', 100]], [['Half rack', 280]], ['barbecue ribs', 'spare ribs']),
  d('Smoothie bowl', 'American', 375, [['banana', 120], ['strawberries', 100], ['greek_yogurt', 100], ['granola', 40], ['honey', 15]], [['1 bowl', 375]], ['acai bowl', 'açaí bowl']),
);

RECIPES.push(
  {
    name: 'Galbi', cuisine: 'Korean', yield: 650, aliases: ['kalbi', 'korean short ribs'],
    ingredients: [['Beef, chuck, short ribs, boneless, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised', 500], ['Soy sauce', 50], ['Sugars, brown', 25], ['Onions, raw', 50], ['Garlic, raw', 10], ['Oil, vegetable, soybean, refined', 15]],
    portions: [['1 serving', 200]],
  },
  {
    name: 'Udon noodles', cuisine: 'Japanese', yield: 1000, aliases: ['udon'],
    ingredients: [['Wheat flour, white, all-purpose, enriched, unbleached', 300], ['Beverages, water, tap, drinking', 140], ['Salt, table', 10]],
    portions: [['1 portion (cooked)', 250]],
  },
);

// Regional versions of the same dish: ingredients and oil differ, so the nutrition does too.
RECIPES.push(
  {
    name: 'Jollof rice, Ghanaian style', cuisine: 'Ghanaian', yield: 1650, aliases: ['ghana jollof', 'ghanaian jollof', 'jollof ghana'],
    ingredients: [
      ['Rice, white, long-grain, regular, enriched, cooked', 1000], ['Tomatoes, red, ripe, raw, year round average', 200],
      ["Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program)", 100],
      ['Onions, raw', 150], ['Peppers, sweet, red, raw', 80], ['Peppers, hot chili, red, raw', 10], ['Carrots, raw', 60],
      ['Peas, green, frozen, cooked, boiled, drained, without salt', 60], ['Oil, vegetable, soybean, refined', 60],
      ['Soup, stock, chicken, home-prepared', 250], ['Salt, table', 6],
    ],
    portions: RICE_DISH,
  },
  {
    name: 'Fried rice, Nigerian style', cuisine: 'Nigerian', yield: 1650, aliases: ['naija fried rice', 'party fried rice', 'nigerian fried rice'],
    ingredients: [
      ['Rice, white, long-grain, parboiled, enriched, cooked', 1000], ['Carrots, raw', 100], ['Peas, green, frozen, cooked, boiled, drained, without salt', 100],
      ['Peppers, sweet, green, raw', 80], ['Corn, sweet, yellow, frozen, kernels cut off cob, boiled, drained, without salt', 80], ['Onions, raw', 80],
      ['Beef, variety meats and by-products, liver, cooked, braised', 100], ['Spices, curry powder', 6], ['Spices, thyme, dried', 2],
      ['Oil, vegetable, soybean, refined', 80], ['Soup, stock, chicken, home-prepared', 150], ['Salt, table', 6],
    ],
    portions: RICE_DISH,
  },
  {
    name: 'Native jollof (palm oil rice)', cuisine: 'Nigerian', yield: 1550, aliases: ['concoction rice', 'palm oil jollof', 'iwuk edesi', 'palm oil rice'],
    ingredients: [
      ['Rice, white, long-grain, regular, enriched, cooked', 1000], ['Oil, palm', 80], ['Onions, raw', 100], ['Peppers, hot chili, red, raw', 10],
      ['Shrimp, dried', 30], ['Spinach, cooked, boiled, drained, without salt', 150], ['Soup, stock, beef, home-prepared', 200], ['Salt, table', 6],
    ],
    portions: RICE_DISH,
  },
);

// More regional dishes (East/Central Africa, Latin America, South Asia, Eastern Europe, Middle East).
RECIPES.push(
  { name: 'Nyama choma (grilled goat)', cuisine: 'Kenyan', yield: 900, aliases: ['nyama choma', 'grilled goat', 'roast goat'], ingredients: [[I.goat, 1000], [I.salt, 8], [I.lemon, 20]], portions: [['1 portion', 250]] },
  {
    name: 'Pondu (cassava leaf stew)', cuisine: 'Congolese', yield: 1000, aliases: ['saka saka', 'sombe', 'mpondu', 'cassava leaves'],
    ingredients: [['Cassava, leaves, fresh, boiled* (without salt), drained', 600], [I.palm_oil, 60], [I.onion, 100], [I.garlic, 10], [I.green_pepper, 60], [I.dried_shrimp, 20], [I.salt, 5]],
    portions: [['1 bowl', 300]],
  },
  { name: 'Kottu roti', cuisine: 'Sri Lankan', yield: 900, aliases: ['kottu', 'koththu', 'kothu roti'], ingredients: [['Bread, chapati or roti, plain, commercially prepared', 400], [I.egg_fried, 100], [I.chicken_thigh, 200], [I.cabbage, 100], [I.carrots, 60], [I.onion, 60], [I.oil, 40], [I.curry, 6]], portions: [['1 plate', 400]] },
  { name: 'Gallo pinto', cuisine: 'Costa Rican', yield: 900, aliases: ['gallopinto', 'rice and beans costa rica', 'nicaraguan rice and beans'], ingredients: [[I.rice, 500], [I.black_beans, 350], [I.onion, 60], [I.red_pepper, 40], [I.oil, 25], [I.salt, 4]], portions: [['1 plate', 250], ['1 cup', 180]] },
  {
    name: 'Bandeja paisa', cuisine: 'Colombian', yield: 1000, aliases: ['bandeja', 'paisa platter'],
    ingredients: [[I.rice, 250], [I.kidney, 200], [I.beef_mince, 120], ['Pork, belly joint, roasted, lean and fat', 100], [I.egg_fried, 60], [I.plantain_fried, 100], ['Avocados, raw, all commercial varieties', 70], [I.cornmeal, 40], [I.oil, 20]],
    portions: [['1 platter', 800]],
  },
  {
    name: 'Acarajé', cuisine: 'Brazilian (Bahian)', yield: 600, aliases: ['acaraje', 'akara bahia', 'black-eyed pea fritters'],
    ingredients: [[I.cowpeas, 400], [I.onion, 60], [I.palm_oil, 80], [I.dried_shrimp, 40], [I.salt, 4]],
    portions: [['1 fritter', 120]],
  },
  {
    name: 'Pelmeni', cuisine: 'Russian', yield: 1150, aliases: ['pelmeny', 'russian dumplings'],
    ingredients: [[I.flour, 350], [I.egg, 50], [I.water, 150], [I.beef_mince_raw, 250], [I.pork_mince, 150], [I.onion, 80], [I.salt, 6]],
    portions: [['1 plate (about 20)', 300]],
  },
  { name: 'Dolma (stuffed vine leaves)', cuisine: 'Middle Eastern', yield: 900, aliases: ['dolmades', 'dolmeh', 'yaprak sarma', 'warak enab', 'stuffed grape leaves'], ingredients: [['Grape leaves, canned', 150], [I.rice, 450], [I.onion, 100], [I.olive_oil, 60], [I.lemon, 40], [I.tomato, 100], [I.parsley, 20], [I.salt, 5]], portions: [['1 piece', 30], ['6 pieces', 180]] },
);

// ---------------------------------------------------------------------------
// Nigerian swallows and the soups eaten with them. Full record names (USDA / FAO West Africa).
// Leaves with no official record of their own (oha, bitter leaf, okazi) use the closest
// listed leaf, named in the ingredients so it's checkable.
const n = (name, yieldG, ingredients, portions, aliases = []) => ({ name, cuisine: 'West African', yield: yieldG, aliases, portions, ingredients });
const WATER = 'Beverages, water, tap, drinking', PALM = 'Oil, palm', STOCK = 'Soup, stock, beef, home-prepared', SALT = 'Salt, table';
const BEEF = I.beef, CRAY = 'Shrimp, dried', STOCKFISH = 'Fish, cod, Atlantic, dried and salted', ONION = 'Onions, raw', CHILI = 'Peppers, hot chili, red, raw';
const IRU = 'African locust bean, fermented (soumbala)', CATFISH = 'Catfish, fillet, boiled* (as part of a recipe)', COCOYAM = 'Cocoyam, tuber, white, boiled* (without salt), drained';
// How these are really served (see docs/portions.md): swallows by the wrap, soups by the ladle
// or as a small / medium / large portion with the swallow — never counted in bowls.
const WRAP = SWALLOW, SOUP = SOUP_PORTIONS;

RECIPES.push(
  // Swallows: flour (or tuber) stirred into hot water; values per 100 g of the cooked swallow.
  n('Amala', 900, [['Yam, tuber, flour, from white yam tuber', 300], [WATER, 650]], WRAP, ['amala isu', 'elubo', 'yam flour swallow', 'oka']),
  n('Amala lafun', 900, [['Cassava, flour, from fermented white cassava (alibo/elubo/lafun)', 300], [WATER, 650]], WRAP, ['lafun', 'white amala', 'alubo', 'cassava amala']),
  n('Fufu', 900, [['Cassava, fermented paste from white cassava flour (wet fufu)', 1000]], WRAP, ['akpu', 'cassava fufu', 'loi loi', 'santana', 'nigerian fufu']),
  n('Semovita', 900, [['Semolina, enriched', 300], [WATER, 650]], WRAP, ['semo', 'semolina swallow', 'semolina fufu']),
  n('Wheat swallow', 900, [['Wheat flour, wholemeal, unfortified', 300], [WATER, 650]], WRAP, ['wheat meal', 'wheat fufu', 'alkama']),
  n('Tuwo shinkafa', 950, [['Rice, white, short-grain, enriched, cooked', 1000]], WRAP, ['tuwon shinkafa', 'rice swallow', 'tuwo rice']),
  n('Tuwo masara', 900, [['Maize, white, refined flour (special), unfortified', 300], [WATER, 650]], WRAP, ['tuwon masara', 'corn swallow', 'maize swallow', 'tuwo']),
  n('Tuwo dawa', 900, [['Sorghum, flour, degermed', 300], [WATER, 650]], WRAP, ['tuwon dawa', 'sorghum swallow', 'guinea corn swallow']),
  n('Starch (Urhobo)', 930, [['Tapioca, pearl, dry', 250], [PALM, 30], [WATER, 700]], WRAP, ['usi', 'ukodo starch', 'owho starch', 'cassava starch swallow', 'starch and banga']),
  n('Oat swallow', 750, [['Oats, rolled, raw', 200], [WATER, 600]], WRAP, ['oatmeal swallow', 'oats fufu']),
  n('Plantain swallow', 900, [['Plantain, unripe, pale flesh, flour', 300], [WATER, 650]], WRAP, ['plantain amala', 'elubo ogede', 'plantain fufu', 'unripe plantain flour']),
  n('Cocoyam fufu', 1000, [[COCOYAM, 1000]], WRAP, ['ede', 'pounded cocoyam', 'ji abana']),
  n('Poundo yam', 900, [['Yam, tuber, flour, from white yam tuber', 300], [WATER, 650]], WRAP, ['poundo', 'pounded yam flour', 'iyan flour', 'instant pounded yam']),

  // Soups
  n('Ogbono soup', 1000, [['Dikanut, kernel, dried, raw', 100], [PALM, 60], [BEEF, 250], [STOCKFISH, 50], [CRAY, 20], ['Spinach, cooked, boiled, drained, without salt', 100], [ONION, 40], [CHILI, 10], [STOCK, 400], [SALT, 5]], SOUP, ['ogbono', 'draw soup', 'apon', 'oro soup']),
  n('Banga soup', 1100, [['Oil palm, fruit, raw', 300], [WATER, 300], [BEEF, 200], [CATFISH, 200], [CRAY, 20], [ONION, 50], [CHILI, 10], [STOCK, 300], [SALT, 5]], SOUP, ['ofe akwu', 'palm nut soup', 'abak atama', 'banga stew']),
  n('Afang soup', 1000, [['Waterleaf, leaves, fresh, boiled* (as part of a recipe)', 350], ['Amaranth leaves, cooked, boiled, drained, without salt', 150], [PALM, 80], [BEEF, 250], [STOCKFISH, 50], [CRAY, 25], [ONION, 40], [CHILI, 10], [STOCK, 200], [SALT, 5]], SOUP, ['afang', 'okazi soup', 'ukazi soup']),
  n('Oha soup', 1000, [[COCOYAM, 100], [PALM, 60], [BEEF, 250], [STOCKFISH, 50], [CRAY, 20], ['Amaranth leaves, cooked, boiled, drained, without salt', 150], [IRU, 10], [CHILI, 10], [STOCK, 400], [SALT, 5]], SOUP, ['ofe oha', 'ora soup', 'ofe ora']),
  n('Bitterleaf soup', 1000, [[COCOYAM, 100], [PALM, 60], [BEEF, 250], [STOCKFISH, 50], [CRAY, 20], ['Bitter melon, horseradish, jute, or radish leaves, cooked', 150], [CHILI, 10], [STOCK, 400], [SALT, 5]], SOUP, ['ofe onugbu', 'onugbu soup', 'bitter leaf soup']),
  n('Ofe nsala', 1000, [[CATFISH, 400], ['Yam, cooked, boiled, drained, or baked, without salt', 100], [CRAY, 20], [ONION, 40], [CHILI, 15], [STOCK, 500], [SALT, 5]], SOUP, ['nsala', 'white soup', 'nsala soup', 'catfish pepper soup']),
  n('Ewedu soup', 600, [['Jute mallow (bush-okra), leaves, fresh, boiled* (as part of a recipe)', 400], [IRU, 15], [CRAY, 10], [WATER, 200], [SALT, 3]], SOUP, ['ewedu', 'jute leaf soup', 'ewedu and gbegiri']),
  n('Gbegiri', 750, [[I.cowpeas, 400], [PALM, 40], [CRAY, 15], [IRU, 10], [CHILI, 10], [STOCK, 300], [SALT, 4]], SOUP, ['gbegiri soup', 'bean soup', 'abula']),
  n('Miyan kuka', 800, [['Baobab, leaves, dried', 50], [BEEF, 200], [CRAY, 15], [IRU, 10], [I.oil, 30], [ONION, 50], [CHILI, 10], [STOCK, 500], [SALT, 4]], SOUP, ['kuka soup', 'baobab leaf soup', 'miyan kuka soup']),
  n('Miyan taushe', 1000, [['Pumpkin, cooked, boiled, drained, without salt', 300], ['Spinach, cooked, boiled, drained, without salt', 150], ['Groundnut flour, with fat', 50], [BEEF, 200], [PALM, 30], [ONION, 40], [CHILI, 10], [STOCK, 300], [SALT, 4]], SOUP, ['taushe', 'pumpkin soup']),
  n('Ofe owerri', 1100, [[COCOYAM, 100], ['Waterleaf, leaves, fresh, boiled* (as part of a recipe)', 200], ['Pumpkin leaves, cooked, boiled, drained, without salt', 150], [PALM, 60], [BEEF, 250], [STOCKFISH, 60], ['Snail, cooked', 100], [CRAY, 20], [STOCK, 300], [SALT, 5]], SOUP, ['owerri soup', 'ofe owerri soup']),
  n('Fisherman soup', 1000, [[CATFISH, 300], [I.shrimp, 150], ['Snail, cooked', 100], [PALM, 50], [ONION, 50], [CHILI, 15], ['Pumpkin leaves, cooked, boiled, drained, without salt', 100], [STOCK, 300], [SALT, 5]], SOUP, ['seafood okra', 'fishermans soup', 'rivers fisherman soup']),
  n('Atama soup', 1050, [['Oil palm, fruit, raw', 250], [WATER, 250], [BEEF, 200], [STOCKFISH, 50], [CRAY, 20], ['Waterleaf, leaves, fresh, boiled* (as part of a recipe)', 150], [CHILI, 10], [STOCK, 300], [SALT, 5]], SOUP, ['abak atama', 'atama']),

  // Other Nigerian favourites
  n('Nigerian fried rice', 1500, [[I.rice, 1000], [I.carrots, 120], [I.peas, 100], [I.green_pepper, 60], [ONION, 60], ['Chicken, liver, all classes, cooked, simmered', 80], [I.oil, 70], [I.curry, 6], [I.thyme, 2], [STOCK, 150], [SALT, 6]], [['1 plate', 350], ['1 cup', 200]], ['party fried rice', 'naija fried rice']),
  n('Abacha (African salad)', 700, [['Cassava, tuber, white flesh, dried', 250], [PALM, 60], [IRU, 30], [CRAY, 20], [ONION, 50], [CHILI, 10], [WATER, 250], [SALT, 4]], PLATE_DISH, ['abacha', 'african salad', 'abacha ncha']),
  n('Masa', 600, [['Rice, white, short-grain, enriched, cooked', 400], [I.sugar, 40], [I.oil, 40], [WATER, 150]], [['1 piece', 40], ['5 pieces', 200]], ['waina', 'rice cake', 'masa rice cakes']),
  n('Boli (roasted plantain)', 1000, [['Plantain, ripe, ivory flesh, raw', 1050]], [['1 plantain', 180]], ['bole', 'roasted plantain', 'boli and fish']),
);

// Nigerian drinks, snacks and street food.
RECIPES.push(
  n('Zobo drink', 1000, [['Beverages, tea, hibiscus, brewed', 900], ['Sugars, granulated', 80], ['Pineapple, raw, all varieties', 80], ['Ginger root, raw', 10]], [['1 glass', 250], ['1 bottle', 500]], ['zobo', 'sobolo', 'bissap', 'hibiscus drink', 'roselle drink']),
  n('Kunu', 1000, [['Pearl millet, flour (bran removed)', 100], ['Sugars, granulated', 70], ['Ginger root, raw', 10], [WATER, 850]], [['1 glass', 250], ['1 bottle', 500]], ['kunu zaki', 'kunun gyada', 'millet drink', 'fura drink']),
  n('Chapman', 1000, [['Beverages, carbonated, orange', 400], ['Beverages, carbonated, lemon-lime soda, no caffeine', 400], ['Sugars, granulated', 30], ['Cucumber, with peel, raw', 40], ['Lemon juice, raw', 30], [WATER, 100]], [['1 glass', 350]], ['chapman drink', 'nigerian chapman']),
  n('Fura da nono', 1000, [['Millet dough (tchobal/fura), from decorticated millet only, cooked', 250], ['Milk, cow, whole, fermented', 650], ['Sugars, granulated', 40], [WATER, 60]], [['1 calabash', 400], ['1 cup', 250]], ['fura', 'nono', 'fura and nono', 'fermented milk with millet']),
  n('Kuli kuli', 450, [['Groundnut flour, partially defatted', 420], [I.oil, 40], [CHILI, 5], [SALT, 3]], [['1 handful', 30], ['1 stick', 15]], ['kulikuli', 'groundnut cake', 'peanut snack']),
  n('Agidi', 1000, [['Maize dough, fermented (tô), from decorticated white maize only, cooked', 1000]], [['1 wrap', 150]], ['eko', 'agidi white', 'akamu solid', 'maize pudding']),
  n('Coconut rice', 1450, [[I.rice, 1000], [I.coconut_milk, 300], [I.red_pepper, 60], [ONION, 50], [CRAY, 15], [I.oil, 30], [SALT, 5]], [['1 plate', 350]], ['nigerian coconut rice', 'rice and coconut']),
  n('Fried yam', 1000, [['Yam, tuber, deep fried in unfortified vegetable oil*', 1000]], [['5 pieces', 200], ['1 piece', 40]], ['yam chips', 'dundu', 'fried yam and pepper sauce']),
  n('Peppered snail', 600, [['Snail, cooked', 500], [I.oil, 40], [I.red_pepper, 60], [CHILI, 15], [ONION, 40], [SALT, 3]], [['1 plate', 200], ['1 snail', 30]], ['snail pepper soup', 'peppered snails', 'igbin']),
  n('Isi ewu', 900, [['Goat meat, lean, stewed* (as part of a recipe)', 700], [PALM, 70], [IRU, 20], [ONION, 40], [CHILI, 15], [SALT, 5]], [['1 bowl', 300]], ['goat head pepper', 'isi-ewu']),
  n('Nkwobi', 900, [[I.tripe, 600], [PALM, 80], [IRU, 25], [ONION, 50], [CHILI, 15], [SALT, 5]], [['1 bowl', 300]], ['nkwobi cow foot', 'spicy cow foot']),
  n('Dambu nama', 1000, [['Beef jerky', 1000]], [['1 handful', 40]], ['dambun nama', 'shredded beef', 'dambu']),
  n('Okpa', 1000, [['Bambara groundnut, dry, raw', 400], [PALM, 70], [CHILI, 10], [SALT, 5], [WATER, 600]], [['1 wrap', 250]], ['okpa di oku', 'bambara nut pudding']),
  n('Fish roll', 700, [[I.flour, 350], [I.butter, 80], [I.sugar, 30], ['Fish, mackerel, jack, canned, drained solids', 150], [ONION, 20], [CHILI, 5], [I.oil, 60], [SALT, 4], [WATER, 80]], [['1 roll', 70]], ['nigerian fish roll', 'small chops fish roll']),
);

// ---- Meal combinations people actually order (added Nov 2026). Same method: exact records, cooked yield.
{
  const OKRA = 'Okra, cooked, boiled, drained, without salt', PALM_OIL = 'Oil, palm', STK = 'Soup, stock, beef, home-prepared';
  const base = [[OKRA, 400], [PALM_OIL, 40], ['Shrimp, dried', 20], ['Onions, raw', 50], [STK, 300], ['Peppers, hot chili, red, raw', 10], ['Salt, table', 4]];
  const okra = (name, protein, aliases) => ({ name, cuisine: 'West African', yield: 900 + protein.reduce((s, [, g]) => s + g, 0) - 200, aliases, portions: SOUP_PORTIONS, ingredients: [...base, ...protein] });
  const BEEF = 'Beef, round, bottom round, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised';
  RECIPES.push(
    okra('Okra soup with chicken', [['Chicken, broilers or fryers, thigh, meat only, cooked, roasted', 200]], ['okro soup with chicken', 'chicken okra soup']),
    okra('Okra soup with beef', [[BEEF, 200]], ['okro soup with beef', 'beef okra soup']),
    okra('Okra soup with assorted meat', [[BEEF, 100], ['Beef, variety meats and by-products, tripe, cooked, simmered', 70], ['Beef, variety meats and by-products, liver, cooked, braised', 30]], ['okro soup with assorted meat', 'okra soup assorted', 'okro assorted meat', 'okra soup with shaki']),
    okra('Okra soup with fish', [[CATFISH, 200]], ['okro soup with fish', 'fish okra soup', 'okra soup with catfish']),
    okra('Okra soup with beef and fish', [[BEEF, 100], [CATFISH, 100]], ['okro soup with beef and fish']),
    okra('Okra soup with seafood', [['Crustaceans, shrimp, cooked', 120], ['Crustaceans, crab, blue, cooked, moist heat', 80], [CATFISH, 60]], ['okro soup with seafood', 'seafood okra soup', 'seafood okro']),
    okra('Okra soup with chicken and beef', [['Chicken, broilers or fryers, thigh, meat only, cooked, roasted', 100], [BEEF, 100]], ['okro soup with chicken and beef']),
    {
      name: 'Seafood boil', aliases: ['cajun seafood boil', 'low country boil', 'shrimp boil', 'crab boil'], cuisine: 'American (Southern)', yield: 1650,
      ingredients: [
        ['Crustaceans, shrimp, cooked', 400], ['Crustaceans, crab, blue, cooked, moist heat', 300],
        ['Corn, sweet, yellow, cooked, boiled, drained, with salt', 300], ['Potatoes, boiled, cooked without skin, flesh, with salt', 400],
        ['Sausage, Polish, pork and beef, smoked', 150], ['Butter, salted', 60], ['Garlic, raw', 15], ['Salt, table', 8],
      ],
      portions: [['1 medium plate', 450], ['1 small plate', 300], ['1 large plate', 650], ['1 bag (restaurant)', 900]],
    },
  );
}

export { I };
