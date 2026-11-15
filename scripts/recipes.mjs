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
    portions: [['1 bowl', 300], ['1 ladle', 150]],
  },
  {
    name: 'Jollof rice', aliases: ['jolof', 'party jollof'], cuisine: 'West African', yield: 1600,
    ingredients: [
      ['Rice, white, long-grain, regular, enriched, cooked', 1000], ['Tomatoes, red, ripe, raw, year round average', 300],
      ["Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program)", 60],
      ['Peppers, sweet, red, raw', 150], ['Onions, raw', 100], ['Peppers, hot chili, red, raw', 10],
      ['Oil, vegetable, soybean, refined', 80], ['Soup, stock, beef, home-prepared', 200], ['Salt, table', 6],
    ],
    portions: [['1 plate', 350], ['1 cup', 200]],
  },
  {
    name: 'Moi moi', aliases: ['moin moin', 'moyin moyin', 'bean pudding'], cuisine: 'West African', yield: 800,
    ingredients: [
      ['Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, with salt', 500],
      ['Peppers, sweet, red, raw', 100], ['Onions, raw', 60], ['Oil, vegetable, soybean, refined', 50],
      ['Egg, whole, cooked, hard-boiled', 100], ['Shrimp, dried', 15],
    ],
    portions: [['1 wrap', 150]],
  },
  {
    name: 'Akara', aliases: ['bean fritters', 'koose', 'accara'], cuisine: 'West African', yield: 430,
    ingredients: [
      ['Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, with salt', 400],
      ['Onions, raw', 50], ['Peppers, hot chili, red, raw', 10], ['Oil, vegetable, soybean, refined', 60],
    ],
    portions: [['1 ball', 30], ['5 balls', 150]],
  },
  {
    name: 'Suya', aliases: ['beef suya', 'kilishi', 'spicy grilled beef'], cuisine: 'West African', yield: 600,
    ingredients: [
      ['Beef, flank, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, broiled', 500],
      ['Peanuts, all types, dry-roasted, without salt', 50], ['Oil, vegetable, soybean, refined', 15],
      ['Onions, raw', 30], ['Peppers, hot chili, red, raw', 5], ['Salt, table', 4],
    ],
    portions: [['1 stick', 100], ['1 serving', 200]],
  },
  {
    name: 'Pounded yam', aliases: ['iyan', 'fufu yam'], cuisine: 'West African', yield: 1000,
    ingredients: [['Yam, cooked, boiled, drained, or baked, without salt', 1000]],
    portions: [['1 wrap', 250], ['1 small wrap', 150]],
  },
  {
    name: 'Eba', aliases: ['garri', 'gari swallow'], cuisine: 'West African', yield: 900,
    ingredients: [['Cassava, grated, from fermented white cassava, toasted without oil (white gari)', 300], ['Beverages, water, tap, drinking', 600]],
    portions: [['1 wrap', 250], ['1 small wrap', 150]],
  },
  {
    name: 'Efo riro', aliases: ['efo', 'spinach stew', 'vegetable soup'], cuisine: 'West African', yield: 900,
    ingredients: [
      ['Spinach, cooked, boiled, drained, without salt', 500], ['Oil, palm', 60],
      ['Beef, round, bottom round, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised', 200],
      ['Peppers, sweet, red, raw', 150], ['Onions, raw', 60], ['Shrimp, dried', 20], ['Peppers, hot chili, red, raw', 10], ['Salt, table', 4],
    ],
    portions: [['1 bowl', 250]],
  },
  {
    name: 'Okra soup', aliases: ['okro soup', 'okra stew'], cuisine: 'West African', yield: 900,
    ingredients: [
      ['Okra, cooked, boiled, drained, without salt', 400], ['Oil, palm', 40],
      ['Beef, round, bottom round, steak, separable lean and fat, trimmed to 0" fat, all grades, cooked, braised', 200],
      ['Shrimp, dried', 20], ['Onions, raw', 50], ['Soup, stock, beef, home-prepared', 300], ['Peppers, hot chili, red, raw', 10], ['Salt, table', 4],
    ],
    portions: [['1 bowl', 250]],
  },
  {
    name: 'Goat pepper soup', aliases: ['pepper soup', 'peppersoup'], cuisine: 'West African', yield: 1100,
    ingredients: [
      ['Game meat, goat, cooked, roasted', 400], ['Soup, stock, beef, home-prepared', 800], ['Onions, raw', 50],
      ['Peppers, hot chili, red, raw', 15], ['Salt, table', 5],
    ],
    portions: [['1 bowl', 350]],
  },
  {
    name: 'Puff puff', aliases: ['puff-puff', 'bofrot', 'mandazi'], cuisine: 'West African', yield: 900,
    ingredients: [
      ['Wheat flour, white, all-purpose, enriched, unbleached', 500], ['Sugars, granulated', 80],
      ['Beverages, water, tap, drinking', 350], ['Oil, vegetable, soybean, refined', 120],
    ],
    portions: [['1 ball', 30], ['5 balls', 150]],
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
    portions: [['1 plate', 350]],
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
];
