/**
 * Broad searches ("fish", "rice", "soup"…) show the actual varieties as one-tap choices, so people
 * pick exactly what they ate instead of answering questions. Each choice is just a more specific
 * search, so it works with every food in the database, including ones added later. These are
 * starting points, not a limit: the full results are always listed underneath.
 */
const V: Record<string, string[]> = {
  fish: ['Salmon', 'Catfish', 'Tilapia', 'Tuna', 'Cod', 'Mackerel', 'Sardines', 'Croaker', 'Hake', 'Trout', 'Haddock', 'Sea bass', 'Snapper', 'Herring', 'Smoked fish', 'Stockfish'],
  seafood: ['Shrimp', 'Prawns', 'Crab', 'Lobster', 'Mussels', 'Oysters', 'Squid', 'Octopus', 'Clams', 'Scallops', 'Crayfish', 'Seafood boil'],
  rice: ['White rice', 'Brown rice', 'Basmati rice', 'Jasmine rice|White rice long-grain', 'Jollof rice', 'Fried rice', 'Coconut rice', 'Ofada rice', 'Wild rice', 'Biryani', 'Pilau', 'Risotto', 'Rice and peas', 'Waakye', 'Nasi goreng'],
  soup: ['Egusi soup', 'Okra soup', 'Ogbono soup', 'Vegetable soup', 'Pepper soup', 'Banga soup', 'Afang soup', 'Groundnut soup', 'Light soup', 'Chicken noodle soup', 'Lentil soup', 'Tomato soup', 'Miso soup', 'Tom yum', 'Harira', 'Minestrone', 'Pho', 'Ramen'],
  chicken: ['Chicken breast', 'Chicken thigh', 'Chicken wings', 'Chicken drumstick', 'Fried chicken', 'Grilled chicken', 'Roast chicken', 'Chicken curry', 'Jerk chicken', 'Chicken shawarma', 'Chicken tikka masala', 'Peppered chicken'],
  beef: ['Beef steak', 'Minced beef', 'Beef stew', 'Roast beef', 'Suya', 'Corned beef', 'Beef burger', 'Bulgogi', 'Beef rendang', 'Tripe', 'Liver'],
  meat: ['Chicken', 'Beef', 'Goat meat', 'Lamb', 'Pork', 'Turkey', 'Duck', 'Assorted meat', 'Sausage', 'Bacon'],
  swallow: ['Eba', 'Pounded yam', 'Amala', 'Fufu', 'Semovita', 'Banku', 'Ugali', 'Tuwo shinkafa', 'Wheat swallow', 'Oat swallow', 'Plantain swallow'],
  bread: ['White bread', 'Wholemeal bread', 'Sourdough', 'Agege bread', 'Baguette', 'Pita bread', 'Naan', 'Chapati', 'Tortilla', 'Bagel', 'Croissant', 'Roti'],
  pasta: ['Spaghetti', 'Macaroni', 'Penne|Pasta cooked', 'Fusilli', 'Lasagne', 'Spaghetti bolognese', 'Mac and cheese', 'Carbonara'],
  noodles: ['Instant noodles', 'Ramen', 'Udon noodles', 'Rice noodles', 'Egg noodles', 'Pad thai', 'Chow mein', 'Pancit', 'Japchae'],
  beans: ['Black-eyed beans', 'Kidney beans', 'Black beans', 'Baked beans', 'Chickpeas', 'Lentils', 'Beans porridge', 'Ewa agoyin', 'Moi moi', 'Akara', 'Red red', 'Feijoada'],
  egg: ['Boiled egg', 'Fried egg', 'Scrambled egg', 'Omelette', 'Poached egg', 'Egg white', 'Egg yolk', 'Duck egg', 'Quail egg'],
  milk: ['Whole milk', 'Semi-skimmed milk', 'Skimmed milk', 'Evaporated milk', 'Condensed milk', 'Powdered milk', 'Soy milk', 'Almond milk', 'Oat milk', 'Coconut milk'],
  yam: ['Boiled yam', 'Fried yam', 'Pounded yam', 'Yam porridge', 'Amala'],
  plantain: ['Fried plantain', 'Boiled plantain', 'Roasted plantain', 'Plantain chips', 'Kelewele', 'Plantain swallow'],
  potato: ['Boiled potato', 'Mashed potato', 'Baked potato', 'Chips', 'French fries', 'Roast potatoes', 'Sweet potato', 'Potato salad'],
  juice: ['Orange juice', 'Apple juice', 'Pineapple juice', 'Mango juice', 'Zobo drink', 'Grape juice', 'Smoothie'],
  drink: ['Water', 'Tea', 'Coffee', 'Masala chai', 'Bubble tea', 'Horchata', 'Mango lassi', 'Thai iced tea', 'Moroccan mint tea', 'Hot chocolate', 'Cappuccino', 'Café latte', 'Matcha latte', 'Fresh orange juice', 'Lemonade', 'Sobolo', 'Zobo drink', 'Agua de jamaica', 'Coconut water', 'Sugarcane juice', 'Banana smoothie', 'Milkshake', 'Kefir drink', 'Teh tarik'],
  cheese: ['Cheddar', 'Mozzarella', 'Feta', 'Parmesan', 'Cottage cheese', 'Cream cheese', 'Halloumi', 'Goat cheese'],
  yogurt: ['Greek yoghurt', 'Plain yoghurt', 'Fruit yoghurt', 'Low-fat yoghurt', 'Ayran'],
  curry: ['Chicken curry', 'Goat curry', 'Thai red curry', 'Thai green curry', 'Massaman curry', 'Butter chicken', 'Chana masala', 'Dal', 'Katsu curry'],
  stew: ['Nigerian stew', 'Ofada stew', 'Beef stew', 'Chicken stew', 'Fish stew', 'Irish stew', 'Doro wat', 'Ghormeh sabzi', 'Kontomire stew'],
  salad: ['Green salad', 'Caesar salad', 'Greek salad', 'Coleslaw', 'Potato salad', 'Fattoush', 'Tabbouleh', 'Som tam'],
  fruit: ['Banana', 'Apple', 'Orange', 'Mango', 'Pineapple', 'Watermelon', 'Pawpaw', 'Grapes', 'Avocado', 'Strawberries', 'Guava', 'Dates'],
  oil: ['Olive oil', 'Vegetable oil', 'Palm oil', 'Coconut oil', 'Groundnut oil', 'Butter', 'Ghee'],
  nuts: ['Groundnuts', 'Almonds', 'Cashews', 'Walnuts', 'Tiger nuts', 'Pistachios', 'Kuli kuli', 'Peanut butter'],
  pork: ['Pork chop', 'Pork loin', 'Pork belly', 'Ham', 'Bacon', 'Pork sausage', 'Pulled pork', 'Pork ribs', 'Minced pork'],
  lamb: ['Lamb chop', 'Leg of lamb', 'Minced lamb', 'Lamb stew', 'Lamb kebab', 'Lamb curry'],
  goat: ['Goat meat', 'Goat curry', 'Goat pepper soup', 'Asun', 'Goat stew'],
  turkey: ['Turkey breast', 'Turkey drumstick', 'Turkey wing', 'Minced turkey', 'Turkey sausage', 'Roast turkey'],
  vegetables: ['Broccoli', 'Spinach', 'Carrots', 'Cabbage', 'Green beans', 'Peas', 'Sweetcorn', 'Tomatoes', 'Cucumber', 'Lettuce', 'Peppers', 'Onions', 'Mushrooms', 'Okra', 'Eggplant', 'Cauliflower', 'Kale', 'Zucchini'],
  breakfast: ['Oats', 'Cornflakes', 'Granola', 'Pancakes', 'Waffles', 'Toast', 'Scrambled egg', 'Pap', 'Bread and egg', 'Yoghurt', 'Muesli', 'Full English breakfast'],
  cereal: ['Cornflakes', 'Oats', 'Granola', 'Muesli', 'Bran flakes', 'Crisp rice cereal|Crisp rice', 'Shredded wheat', 'Pap'],
  porridge: ['Oatmeal', 'Pap', 'Beans porridge', 'Yam porridge', 'Rice porridge', 'Millet porridge'],
  snack: ['Crisps', 'Popcorn', 'Plantain chips', 'Chin chin', 'Puff puff', 'Peanuts', 'Crackers', 'Granola bar', 'Pretzels', 'Trail mix', 'Meat pie', 'Doughnut'],
  dessert: ['Ice cream', 'Tiramisu', 'Baklava', 'Gulab jamun', 'Mango sticky rice', 'Churros with chocolate', 'Flan', 'Tres leches cake', 'Pastel de nata', 'Crème brûlée', 'Chocolate mousse', 'Cheesecake', 'Brownie', 'Apple pie', 'Malva pudding', 'Pavlova', 'Mochi', 'Kheer', 'Halo-halo', 'Brigadeiro', 'Knafeh', 'Carrot cake', 'Vegan chocolate cake', 'Fruit salad'],
  cake: ['Chocolate cake', 'Sponge cake', 'Carrot cake', 'Cheesecake', 'Fruit cake', 'Cupcake', 'Pound cake', 'Banana bread'],
  sauce: ['Tomato sauce', 'Ketchup', 'Mayonnaise', 'Soy sauce', 'Hot sauce', 'Barbecue sauce', 'Pesto', 'Gravy', 'Salsa', 'Shito', 'Mustard'],
  spread: ['Peanut butter', 'Butter', 'Margarine', 'Jam', 'Honey', 'Chocolate spread', 'Cream cheese', 'Almond butter'],
  protein: ['Whey protein', 'Protein shake', 'Protein bar', 'Chicken breast', 'Eggs', 'Greek yoghurt', 'Tuna', 'Tofu', 'Lentils', 'Cottage cheese'],
  sandwich: ['Chicken sandwich', 'Egg sandwich', 'Tuna sandwich', 'Ham sandwich', 'Cheese sandwich', 'BLT|Bacon lettuce tomato sandwich', 'Club sandwich', 'Peanut butter sandwich'],
  pizza: ['Cheese pizza', 'Pepperoni pizza', 'Margherita pizza|Cheese pizza', 'Vegetable pizza', 'Meat pizza'],
  burger: ['Beef burger', 'Cheeseburger', 'Chicken burger', 'Veggie burger', 'Fish burger'],
  tea: ['Black tea', 'Green tea', 'Tea with milk', 'Herbal tea', 'Iced tea', 'Chai'],
  coffee: ['Black coffee', 'Latte', 'Cappuccino', 'Espresso', 'Iced coffee', 'Coffee with milk', 'Mocha'],
  smoothie: ['Banana smoothie', 'Strawberry smoothie', 'Mango smoothie', 'Green smoothie', 'Protein smoothie', 'Smoothie bowl'],
  seeds: ['Chia seeds', 'Flaxseeds', 'Pumpkin seeds', 'Sunflower seeds', 'Sesame seeds', 'Egusi seeds', 'Hemp seeds'],
  dumplings: ['Gyoza', 'Momo', 'Pierogi', 'Wontons', 'Bao'],
  vegan: ['Tofu scramble', 'Buddha bowl', 'Lentil soup', 'Bean chili', 'Vegetable curry with coconut', 'Chana masala', 'Dal', 'Falafel wrap', 'Vegan jollof rice', 'Vegan moi moi', 'Vegan egusi soup', 'Ewa agoyin and dodo', 'Vegetable fried rice', 'Tofu pad thai', 'Mujadara', 'Black bean tacos', 'Ratatouille', 'Lentil bolognese', 'Tempeh stir-fry', 'Avocado cucumber sushi'],
  vegetarian: ['Palak paneer', 'Mushroom risotto', 'Vegetable lasagne', 'Vegetable thali', 'Bean and cheese burrito', 'Shakshuka', 'Menemen', 'Paneer tikka', 'Vegetable biryani', 'Gado gado', 'Veggie burger', 'Mac and cheese'],
  indian: ['Chicken korma', 'Chicken tikka masala', 'Butter chicken', 'Lamb rogan josh', 'Chicken jalfrezi', 'Chicken biryani', 'Dal tadka', 'Chana masala', 'Palak paneer', 'Masala dosa', 'Tandoori chicken', 'Aloo gobi'],
  thai: ['Pad thai with chicken', 'Thai green curry with chicken', 'Thai red curry with beef', 'Massaman curry', 'Pad krapow with pork', 'Tom yum', 'Tom kha gai', 'Pad see ew with chicken', 'Drunken noodles with chicken', 'Som tam', 'Mango sticky rice'],
  chinese: ['Sweet and sour chicken', 'Kung pao chicken', 'Chicken chow mein', 'Special fried rice', 'Beef and broccoli', 'Black bean beef', 'Mapo tofu', 'Char siu pork with rice', 'Pork and chive dumplings', 'Hot and sour soup', 'Wonton soup'],
  japanese: ['Chicken teriyaki with rice', 'Chicken katsu curry', 'Salmon sushi roll', 'California roll', 'Shoyu ramen', 'Miso soup', 'Gyudon', 'Chicken karaage', 'Salmon poke bowl', 'Gyoza', 'Okonomiyaki'],
  korean: ['Beef bibimbap', 'Bulgogi', 'Kimchi fried rice', 'Japchae', 'Korean fried chicken', 'Kimchi jjigae', 'Dak galbi', 'Kimbap', 'Tteokbokki'],
  mexican: ['Chicken tacos', 'Carne asada tacos', 'Al pastor tacos', 'Chicken burrito', 'Chicken enchiladas', 'Cheese quesadilla', 'Chicken fajitas', 'Huevos rancheros', 'Chilaquiles rojos', 'Pozole rojo', 'Guacamole'],
  italian: ['Spaghetti carbonara', 'Spaghetti bolognese', 'Margherita pizza', 'Lasagne', 'Fettuccine alfredo', 'Penne arrabbiata', 'Pasta al pesto', 'Mushroom risotto', 'Chicken parmigiana', 'Minestrone', 'Tiramisu'],
  'middle eastern': ['Chicken shawarma wrap', 'Falafel wrap', 'Hummus', 'Shish tawook plate', 'Lamb kofta with rice', 'Kabsa', 'Mandi', 'Tabbouleh', 'Fattoush', 'Shakshuka', 'Baklava'],
  caribbean: ['Jerk chicken', 'Rice and peas with jerk chicken', 'Curry goat', 'Ackee and saltfish', 'Brown stew chicken', 'Oxtail and rice', 'Chicken roti (Trinidad)', 'Doubles', 'Cuban sandwich', 'Arroz con gandules'],
  british: ['Fish and chips', 'Full English breakfast', 'Shepherd’s pie', 'Sunday roast', 'Bangers and mash', 'Jacket potato with cheese', 'Cornish pasty', 'Toad in the hole', 'Beans on toast', 'Sticky toffee pudding'],
  american: ['Cheeseburger', 'Fried chicken with fries', 'Mac and cheese', 'BBQ ribs', 'Pulled pork sandwich', 'Philly cheesesteak', 'Chicken Caesar salad', 'Pancakes with bacon and syrup', 'Buffalo wings', 'Jambalaya'],
  african: ['Jollof rice', 'Egusi soup', 'Injera', 'Doro wat', 'Ugali', 'Bobotie', 'Thieboudienne', 'Waakye', 'Lamb tagine with prunes', 'Koshari', 'Ndolé', 'Pap and wors'],
  'latin american': ['Feijoada', 'Arroz con pollo', 'Beef empanadas', 'Arepa reina pepiada', 'Lomo saltado', 'Ceviche', 'Pollo a la brasa with fries', 'Pabellón criollo', 'Bandeja paisa', 'Churrasco'],
  wrap: ['Chicken wrap', 'Shawarma', 'Burrito', 'Tacos', 'Falafel sandwich', 'Gyro'],
};
const ALIAS: Record<string, string> = {
  fishes: 'fish', rices: 'rice', soups: 'soup', meats: 'meat', breads: 'bread', noodle: 'noodles', bean: 'beans', eggs: 'egg', drinks: 'drink',
  yogurts: 'yogurt', yoghurt: 'yogurt', yoghurts: 'yogurt', curries: 'curry', stews: 'stew', salads: 'salad', fruits: 'fruit', oils: 'oil', nut: 'nuts',
  potatoes: 'potato', swallows: 'swallow', juices: 'juice', plantains: 'plantain', okro: 'okra', 'sea food': 'seafood', vegetable: 'vegetables', 'plant based': 'vegan', 'indian food': 'indian', 'thai food': 'thai', 'chinese food': 'chinese', 'japanese food': 'japanese', 'korean food': 'korean', 'mexican food': 'mexican', 'italian food': 'italian', 'arabic': 'middle eastern', 'arab': 'middle eastern', 'lebanese': 'middle eastern', 'jamaican': 'caribbean', 'english': 'british', 'uk': 'british', 'usa': 'american', 'african food': 'african', 'latin': 'latin american', 'plant-based': 'vegan', veggie: 'vegetarian', 'vegan food': 'vegan', 'vegetarian food': 'vegetarian', veg: 'vegetables', veggies: 'vegetables', cereals: 'cereal', snacks: 'snack', desserts: 'dessert', sweets: 'dessert', cakes: 'cake', sauces: 'sauce', spreads: 'spread', 'protein powder': 'protein', sandwiches: 'sandwich', pizzas: 'pizza', burgers: 'burger', smoothies: 'smoothie', seed: 'seeds', dumpling: 'dumplings', wraps: 'wrap', goat: 'goat', 'goat meat': 'goat', 'pork meat': 'pork',
};

import { COUNTRY_DISHES as COUNTRIES } from '@/data/countryDishes';

/** Every country and territory: its name or nationality ("ghana", "ghanaian food") shows its dishes. */
const COUNTRY: Record<string, { name: string; dishes: string[] }> = {};
for (const [country, v] of Object.entries(COUNTRIES)) {
  const entry = { name: country, dishes: v.dishes };
  for (const k of [country, v.demonym, `${v.demonym} food`, `${country} food`, country.replace(/^the /i, '')]) COUNTRY[k.toLowerCase()] = entry;
}
COUNTRY['usa'] = COUNTRY['us'] = COUNTRY['america'] = COUNTRY['united states of america'];
COUNTRY['uk'] = COUNTRY['britain'] = COUNTRY['england'] = COUNTRY['united kingdom'];
COUNTRY['ivory coast'] = COUNTRY["côte d'ivoire"];
COUNTRY['turkey'] = COUNTRY['türkiye'];
COUNTRY['drc'] = COUNTRY['congo'] = COUNTRY['democratic republic of the congo'];

/** "Label|search" lets a choice use the closest real record (e.g. jasmine rice → long-grain white rice). */
export function varietiesFor(query: string): { group: string; options: { label: string; q: string; note?: string }[] } | null {
  const k = query.trim().toLowerCase();
  const key = ALIAS[k] ?? k;
  if (!V[key]) {
    const c = COUNTRY[k] ?? COUNTRY[k.replace(/ (food|dishes|cuisine)$/, '')];
    return c ? { group: `${c.name} dish`, options: c.dishes.slice(0, 24).map((d) => ({ label: d, q: d })) } : null;
  }
  return { group: key, options: V[key].map((o) => { const [label, q] = o.split('|'); return { label, q: q ?? label, ...(q ? { note: `closest record: ${q.toLowerCase()}` } : {}) }; }) };
}
