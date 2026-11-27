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
  drink: ['Water', 'Tea', 'Coffee', 'Zobo drink', 'Kunu', 'Chapman', 'Soft drink', 'Orange juice', 'Milkshake', 'Beer', 'Wine'],
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
  dessert: ['Ice cream', 'Chocolate cake', 'Cheesecake', 'Brownie', 'Apple pie', 'Rice pudding', 'Custard', 'Fruit salad', 'Cookies', 'Doughnut', 'Chocolate'],
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
  wrap: ['Chicken wrap', 'Shawarma', 'Burrito', 'Tacos', 'Falafel sandwich', 'Gyro'],
};
const ALIAS: Record<string, string> = {
  fishes: 'fish', rices: 'rice', soups: 'soup', meats: 'meat', breads: 'bread', noodle: 'noodles', bean: 'beans', eggs: 'egg', drinks: 'drink',
  yogurts: 'yogurt', yoghurt: 'yogurt', yoghurts: 'yogurt', curries: 'curry', stews: 'stew', salads: 'salad', fruits: 'fruit', oils: 'oil', nut: 'nuts',
  potatoes: 'potato', swallows: 'swallow', juices: 'juice', plantains: 'plantain', okro: 'okra', 'sea food': 'seafood', vegetable: 'vegetables', veg: 'vegetables', veggies: 'vegetables', cereals: 'cereal', snacks: 'snack', desserts: 'dessert', sweets: 'dessert', cakes: 'cake', sauces: 'sauce', spreads: 'spread', 'protein powder': 'protein', sandwiches: 'sandwich', pizzas: 'pizza', burgers: 'burger', smoothies: 'smoothie', seed: 'seeds', dumpling: 'dumplings', wraps: 'wrap', goat: 'goat', 'goat meat': 'goat', 'pork meat': 'pork',
};

/** "Label|search" lets a choice use the closest real record (e.g. jasmine rice → long-grain white rice). */
export function varietiesFor(query: string): { group: string; options: { label: string; q: string; note?: string }[] } | null {
  const k = query.trim().toLowerCase();
  const key = ALIAS[k] ?? k;
  if (!V[key]) return null;
  return { group: key, options: V[key].map((o) => { const [label, q] = o.split('|'); return { label, q: q ?? label, ...(q ? { note: `closest record: ${q.toLowerCase()}` } : {}) }; }) };
}
