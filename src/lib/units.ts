/**
 * Food-specific measurements. A cup of rice and a cup of chicken don't weigh the same, so every
 * household measure comes from the food itself:
 *  - measures in the food's own record (USDA, FAO/INFOODS, UK, Australia…) are "verified":
 *    the agency weighed that measure of that food;
 *  - "(typical)" sizes and standard-recipe portions are "estimated" (a sensible reference size);
 *  - volume units (ml, L, tsp, tbsp, cup, glass, can, bottle) are only offered for liquids,
 *    oils and sauces, converted with that food type's density.
 * Where nothing reliable exists we don't invent a size: people weigh it in grams instead.
 */
import type { Food } from './types';

export interface Measure { label: string; grams: number; verified: boolean; volume?: boolean }

/** Density in g per ml for foods measured by volume. Only these food types get volume units. */
const DENSITY: [RegExp, number, string][] = [
  [/\b(oil|ghee)\b/i, 0.92, 'oil'],
  [/\b(honey|syrup|molasses|treacle)\b/i, 1.4, 'syrup'],
  [/\b(milk|kefir|buttermilk|cream|custard|yogh?urt drink|ayran)\b/i, 1.03, 'milk'],
  [/\b(juice|smoothie|shake|nectar|squash)\b/i, 1.04, 'juice'],
  [/\b(soda|cola|soft drink|lemonade|beer|cider|wine|zobo|kunu|chapman|tea|coffee|latte|water|drink|beverage)\b/i, 1.0, 'drink'],
  [/\b(soup|broth|stock|consomm[eé])\b/i, 1.0, 'soup'],
  [/\b(sauce|ketchup|mayonnaise|mayo|dressing|vinegar|soy sauce|gravy)\b/i, 1.05, 'sauce'],
];
/** Things that sound liquid but aren't (powders, mixes, solids made from milk). */
const NOT_LIQUID = /\b(powder|powdered|dry|dried|mix|bar|chocolate|cheese|butter|bread|cake|biscuit|cookie|candy|ice cream|solids|granules|leaves|bag)\b/i;

export function densityOf(food: Pick<Food, 'name' | 'category'>): { gPerMl: number; kind: string } | null {
  const text = `${food.name} ${food.category ?? ''}`;
  if (NOT_LIQUID.test(food.name)) return null;
  for (const [re, d, kind] of DENSITY) if (re.test(text)) return { gPerMl: d, kind };
  return null;
}

const VOLUMES: [string, number][] = [['1 tsp', 5], ['1 tbsp', 15], ['1 cup (240 ml)', 240], ['1 glass (250 ml)', 250], ['1 can (330 ml)', 330], ['1 bottle (500 ml)', 500], ['1 litre', 1000]];
/** Volume measures that suit each kind (no "bottle of oil" or "glass of ketchup"). */
const FOR_KIND: Record<string, string[]> = {
  oil: ['1 tsp', '1 tbsp', '1 cup (240 ml)'],
  syrup: ['1 tsp', '1 tbsp'],
  sauce: ['1 tsp', '1 tbsp', '1 cup (240 ml)'],
  milk: ['1 tbsp', '1 cup (240 ml)', '1 glass (250 ml)', '1 bottle (500 ml)', '1 litre'],
  juice: ['1 cup (240 ml)', '1 glass (250 ml)', '1 can (330 ml)', '1 bottle (500 ml)', '1 litre'],
  drink: ['1 cup (240 ml)', '1 glass (250 ml)', '1 can (330 ml)', '1 bottle (500 ml)', '1 litre'],
  soup: ['1 cup (240 ml)'],
};

/** Labels from source tables that confuse people; the weight is still available in grams. */
const UNHELPFUL = /linear inch|cubic inch|surface inch|yield from|excluding refuse|\bNFS\b|^1 oz\b|^1 lb\b|^1 fl oz/i;

/** Shorter, clearer names for source-table measure labels. */
export function tidyLabel(label: string): string {
  return label
    .replace(/\s*\(typical\)/i, '')
    .replace(/^1 oz cooked portion$/i, '1 cooked portion')
    .replace(/,\s*cooked,?\s*/i, ' cooked ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const isEstimated = (food: Pick<Food, 'source'>, label: string) =>
  /\(typical\)/i.test(label) || food.source === 'recipe' || food.source === 'custom';

export type FoodGroup =
  | 'rice_grains' | 'meat' | 'poultry' | 'fish' | 'seafood' | 'eggs' | 'beans' | 'pasta' | 'bread' | 'fruit' | 'vegetables'
  | 'tubers' | 'nuts' | 'dairy' | 'oils' | 'sauces' | 'soups' | 'salads' | 'cereals' | 'snacks' | 'desserts' | 'beverages'
  | 'protein_powder' | 'spreads' | 'mixed' | 'other';

export const GROUP_NAMES: Record<FoodGroup, string> = {
  rice_grains: 'Rice and grains', meat: 'Meat', poultry: 'Poultry', fish: 'Fish', seafood: 'Seafood', eggs: 'Eggs', beans: 'Beans and legumes',
  pasta: 'Pasta and noodles', bread: 'Bread and bakery', fruit: 'Fruit', vegetables: 'Vegetables', tubers: 'Tubers and roots', nuts: 'Nuts and seeds',
  dairy: 'Dairy', oils: 'Oils and fats', sauces: 'Sauces and condiments', soups: 'Soups and stews', salads: 'Salads', cereals: 'Cereals and breakfast',
  snacks: 'Snacks', desserts: 'Desserts and sweets', beverages: 'Drinks', protein_powder: 'Protein powders', spreads: 'Spreads', mixed: 'Meals and dishes', other: 'Food',
};

/** Which group a food belongs to, from its name and table category. Order matters: most specific first. */
const GROUP_RULES: [FoodGroup, RegExp][] = [
  ['mixed', /\b(dumplings?|gyoza|momos?|pierogi|wontons?|enchiladas?|fajitas?|tamales?|chilaquiles|poutine|chakalaka|bobotie|bunny chow|irio|mukimo|kitfo|koshari|baba gh?anoush|mansaf|kabsa|haleem|nihari|larb|nasi lemak|sinigang|pancit|okonomiyaki|kimbap|gimbap|doubles|bammy|festival|full english|chili(?! powder|, dried)|big mac|quarter pounder|mcmuffin|big breakfast|hotcakes|lean pockets)\b/i],
  ['protein_powder', /\b(protein powder|whey|casein|mass gainer|protein isolate|nutritional powder|powder mix)\b/i],
  ['oils', /^(oils?|butteroil|ghee|lard|shortening|margarine|animal fat|suet|drippings|fat,)\b|^[\w-]+( [\w-]+)? oil\b|\b(bacon grease|cooking spray)\b/i],
  ['spreads', /^(honey|jams?|marmalade|peanut butter|nut butter|almond butter|nutella|chocolate spread|syrup|glucose|agave|treacle|molasses|sugar)\b|\bspreads?\b/i],
  ['beverages', /\b(beverages?|drinks?|juices?|smoothies?|shakes?|tea|coffee|latte|soda|cola|beer|wine|spirits|cider|zobo|kunu|chapman|lemonade|nectar|formula|liquor|cocktails?|vodka|gin|rum|whiske?y|scotch|brandy|tequila|liqueur|martini|margarita|mojito|daiquiri|eggnog|ovaltine|mai tai|pina colada|sangria|cocoa drink|hot chocolate)\b|^water\b|\b(mineral|tap|coconut|sparkling|bottled) water\b/i],
  ['soups', /\b(soups?|stews?|broth|curry|curries|chowder|bisque|egusi|ogbono|efo riro|afang|banga|edikang|gbegiri|ewedu|wat|tagine|harira|gumbo|chili con carne)\b/i],
  ['salads', /\b(salads?|coleslaw|slaw|fattoush|tabbouleh)\b/i],
  ['eggs', /^(eggs?|egg white|egg yolk)\b|\b(omelet|omelette|scrambled eggs?|boiled eggs?|fried eggs?|poached eggs?)\b/i],
  ['poultry', /\b(chicken|turkey|duck|goose|quail|poultry|guinea fowl|hen)\b/i],
  ['seafood', /\b(shrimps?|prawns?|crabs?|lobsters?|mussels?|oysters?|clams?|scallops?|squid|octopus|crayfish|periwinkles?|snails?|whelks?|seafood|calamari|abalone|crustaceans?|mollusks?|escargot|jellyfish|shellfish)\b/i],
  ['fish', /\b(fish|salmon|tuna|cod|tilapia|catfish|mackerel|sardines?|herring|trout|haddock|hake|croaker|snapper|bass|anchov(y|ies)|pollock|carp|eel|stockfish|saltfish|fillets?|bream|shark|perch|mullet|basa|bassa|gemfish|milkfish|barramundi|whiting|flathead|sole|halibut|swordfish|kingfish|sprats?)\b/i],
  ['meat', /\b(beef|goat|lamb|mutton|pork|veal|ham|bacon|sausages?|suya|steaks?|mince|meat|liver|kidneys?|tripe|offal|venison|rabbit|kebabs?|kofta|burgers?|hot dogs?|frankfurt(er)?s?|salami|pepperoni|game meat|camel|kangaroo|emu|bison|buffalo|chorizo|brisket|meats|cold cuts|ribs|bologna|liverwurst|mortadella|pastrami|spam|prosciutto|pigeon|squab|crocodile|frog legs|turtle|jerky)\b/i],
  ['pasta', /\b(pasta|spaghetti|macaroni|penne|noodles?|ramen|udon|lasagn\w*|fusilli|vermicelli|couscous)\b/i],
  ['cereals', /\b(cereals?|granola|muesli|cornflakes|oats|oatmeal|porridge|pap|ogi|akamu|bran flakes)\b/i],
  ['rice_grains', /\b(rice|jollof|biryani|pilau|pilaf|risotto|quinoa|millet|sorghum|barley|bulgur|grains?|semolina|fufu|eba|garri|gari|amala|tuwo|banku|ugali|swallow|semo|kenkey|polenta|grits|teff|oat bran|sago|rye|amaranth|buckwheat|farro|spelt|wheat|corn meal|cornmeal|flour)\b/i],
  ['beans', /\b(beans?|lentils?|chickpeas?|peas|dal|dhal|cowpeas?|moi moi|akara|hummus|edamame|tofu|legumes?|soybeans?|pea|lupins?)\b/i],
  ['bread', /bread(?!fruit)|\b(toast|rolls?|buns?|bagels?|croissants?|baguettes?|naan|pitas?|chapatis?|roti|tortillas?|wraps?|muffins?|scones?|pikelets?|popovers?|phyllo|loa(f|ves)|pastr(y|ies)|pies?|pizzas?|puff puff|doughnuts?|donuts?|crepes?|pancakes?|waffles?)\b/i],
  ['fruit', /\b(fruits?|apples?|bananas?|oranges?|mangos?|mangoes|pineapples?|pawpaws?|papayas?|watermelons?|melons?|grapes?|\w*berr(y|ies)|avocados?|guavas?|pears?|peach(es)?|plums?|cherr(y|ies)|dates?|figs?|kiwis?|lemons?|limes?|coconuts?|tangerines?|raisins?|apricots?|pomegranates?|lychees?|tamarillos?|currants?|c?kumquats?|cumquats?|feijoas?|grapefruits?|kiwifruit|loquats?|mandarins?|quinces?|rhubarb|sultanas?|tangelos?|jambu|clementines?|satsumas?|tamarind|passionfruit|persimmons?|durian|rambutan|jackfruit|soursop|breadfruit|nectarines?|cranberr(y|ies))\b/i],
  ['snacks', /\b(chips|crisps|popcorn|pretzels?|crackers?|snacks?|plantain chips|trail mix|bars?|mozzarella sticks|nachos|hush puppies|croutons|fries|hash browns?)\b/i],
  ['desserts', /\b(cakes?|ice cream|puddings?|chocolates?|cand(y|ies)|desserts?|cookies?|biscuits?|brownies?|custard|tarts?|jelly|chin chin|sweets|lolly|lollies|yokan|fudge|toffee|sorbets?|popsicles?|ices|italian ice|snow cone|freezer pop|ice confection|sundaes?|caramels?|liquorice|licorice|meringues?|whipped topping|gelatin|marshmallows?)\b/i],
  ['nuts', /\b(nuts?|almonds?|cashews?|peanuts?|groundnuts?|walnuts?|pistachios?|pecans?|hazelnuts?|seeds?|tiger nuts?|kuli kuli)\b/i],
  ['dairy', /\b(milk|cheeses?|yogh?urts?|cream|kefir|butter|curd|wara|paneer|skyr|ayran|labneh)\b/i],
  ['tubers', /\b(potato(es)?|yams?|cassava|cocoyams?|taro|plantains?|tubers?|roots?)\b/i],
  ['vegetables', /\b(vegetables?|spinach|broccoli|carrots?|cabbage|tomato(es)?|lettuce|cucumbers?|peppers?|onions?|kale|okra|okro|garden eggs?|eggplants?|aubergines?|zucchini|courgettes?|pumpkins?|leaves|greens|mushrooms?|cauliflower|celery|asparagus|beets?|beetroot|radish(es)?|squash|bok choy|capsicum|choko|rocket|broccolini|celeriac|chicory|chill?ies|chill?i(?! con)|endive|fennel|garlic|gherkins?|kohlrabi|parsnips?|seaweed|nori|shallots?|silverbeet|chard|swede|turnips?|watercress|bamboo shoots?|mirepoix|olives?|cilantro|chives|snow peas?|sugar snap|sprouts?|artichokes?|leeks?|corn|sweetcorn)\b/i],
  ['sauces', /\b(sauces?|ketchup|mayonnaise|mayo|dressings?|vinegar|mustard|relish|chutney|salsa|gravy|pesto|shito|condiments?|herbs?|spices?|dill|mint|thyme|cloves|oregano|basil|parsley|coriander|cumin|turmeric|ginger|paprika|cinnamon|nutmeg|curry powder|seasoning|baking powder|baking soda|salt|yeast|rosemary|sage|marjoram|allspice|vanilla|gelatine|lecithin|psyllium|potash|cocoa powder|mirin|capers|stock cubes?|stock|bouillon)\b/i],
];
/** Dish words that decide the group wherever they appear ("Chicken curry" is a stew, "Apple juice" a drink). */
const DISH_FIRST: [FoodGroup, RegExp][] = [
  ['protein_powder', /\b(protein powder|whey|casein|mass gainer|protein isolate)\b/i],
  ['beverages', /\b(juices?|smoothies?|shakes?|nectar|latte|(almond|soy|oat|rice|coconut|cashew) milk|milkshake|drink mix)\b/i],
  ['sauces', /\b(salad dressing|dressing|salad oil)\b/i],
  ['soups', /\b(soups?|stews?|curry|curries|chowder|bisque|broth|gumbo|chili con carne)\b/i],
  ['salads', /\b(salads?|coleslaw|slaw)\b/i],
  ['bread', /\b(sandwich(es)?|burgers?|hamburgers?|cheeseburgers?|pizzas?|wraps?|burritos?|tacos?|quesadillas?)\b/i],
];

/**
 * Which of the 24 groups a food belongs to. Dish words first; otherwise the word that comes
 * first in the name wins ("Fish, tuna, in oil" is fish, "Nuts, almonds, oil roasted" is nuts),
 * then the database category.
 */
export function groupOf(food: Pick<Food, 'name' | 'category' | 'source'>): FoodGroup {
  const name = food.name;
  for (const [g, re] of DISH_FIRST) if (re.test(name)) return g;
  return firstMatch(name) ?? firstMatch(food.category ?? '') ?? ( food.source === 'recipe' ? 'mixed' : 'other');
}

function firstMatch(text: string): FoodGroup | null {
  let best: FoodGroup | null = null; let at = Infinity;
  for (const [g, re] of GROUP_RULES) { const m = re.exec(text); if (m && m.index < at) { at = m.index; best = g; } }
  return best;
}

/** Kinds of household unit, recognised from a measure's label. */
const KIND: [string, RegExp][] = [
  ['cup', /\bcups?\b/i], ['tbsp', /\b(tbsp|tablespoons?)\b/i], ['tsp', /\b(tsp|teaspoons?)\b/i], ['spoon', /\bspoon\b/i],
  ['bowl', /\bbowls?\b/i], ['plate', /\bplates?\b/i], ['ladle', /\bladles?\b/i], ['handful', /\bhandfuls?\b/i], ['scoop', /\bscoops?\b/i],
  ['glass', /\bglass(es)?\b/i], ['bottle', /\bbottles?\b/i], ['can', /\bcans?\b/i], ['litre', /\blitres?\b/i], ['packet', /\b(packet|pack|bag|sachet|bar|pouch)\b/i],
  ['tub', /\b(tub|pot|container|carton)\b/i], ['slice', /\bslices?\b/i], ['loaf', /\bloa(f|ves)\b/i], ['roll', /\b(roll|bun|bagel|muffin)\b/i],
  ['egg', /\b(egg|white|yolk)\b/i], ['fillet', /\bfillets?\b/i], ['whole', /\b(whole|fish)\b/i],
  ['poultry_part', /\b(breast|thigh|wing|drumstick|leg)\b/i], ['cut', /\b(steak|chop|cut|roast|rib|shank|link|patty)\b/i],
  ['half', /\b(half|halves|quarter|0\.5)\b/i], ['chunk', /\bchunks?\b/i],
  ['piece', /\b(piece|pieces|wrap|ball|stick|small|medium|large|extra large|jumbo|fruit|item|serving|portion)\b/i],
];
const kindOf = (label: string) => KIND.find(([, re]) => re.test(label))?.[0] ?? 'piece';

/** The units each group offers (your table). Grams (and oz/ml where it fits) are always there separately. */
const ALLOWED: Record<FoodGroup, string[] | null> = {
  rice_grains: ['cup', 'tbsp', 'spoon', 'bowl', 'plate', 'piece'],
  meat: ['piece', 'slice', 'cut', 'portion'],
  poultry: ['piece', 'poultry_part', 'slice'],
  fish: ['whole', 'fillet', 'slice', 'piece', 'cut'],
  seafood: ['piece', 'handful', 'cup'],
  eggs: ['egg', 'piece', 'cup'],
  beans: ['cup', 'tbsp', 'spoon', 'bowl', 'piece'],
  pasta: ['cup', 'handful', 'bowl', 'plate', 'packet'],
  bread: ['slice', 'piece', 'roll', 'loaf', 'half'],
  fruit: ['piece', 'whole', 'half', 'slice', 'cup', 'chunk'],
  vegetables: ['cup', 'handful', 'piece', 'whole', 'slice', 'half'],
  tubers: ['piece', 'whole', 'half', 'slice', 'chunk', 'cup'],
  nuts: ['handful', 'tbsp', 'tsp', 'cup', 'piece', 'packet'],
  dairy: ['cup', 'tbsp', 'tsp', 'slice', 'tub', 'piece', 'glass'],
  oils: ['tsp', 'tbsp', 'cup'],
  sauces: ['tsp', 'tbsp', 'cup', 'packet'],
  soups: ['cup', 'ladle', 'bowl', 'piece', 'spoon'],
  salads: ['cup', 'handful', 'bowl', 'plate'],
  cereals: ['cup', 'tbsp', 'bowl', 'piece', 'packet'],
  snacks: ['piece', 'handful', 'packet', 'cup'],
  desserts: ['piece', 'slice', 'scoop', 'cup', 'tbsp', 'packet'],
  beverages: ['cup', 'glass', 'bottle', 'can', 'litre', 'tbsp'],
  protein_powder: ['scoop', 'tbsp'],
  spreads: ['tsp', 'tbsp', 'piece', 'packet'],
  mixed: null, // dishes keep every serving their record has (plate, bowl, wrap, ladle…)
  other: null,
};

/**
 * Standard reference sizes, used only when the food's own record has nothing of that kind.
 * Always marked estimated. Sources: Accra photographic food atlas (IFPRI 2022) for serving spoons;
 * Kumasi soup study for the 150 ml ladle; NHS 5-a-day (80 g vegetable/fruit portion); USDA FNDDS
 * typical servings (85 g cooked meat/fish portion, 28 g nut handful = 1 oz, 30 g cereal); protein
 * powder scoops as printed on common labels (~30 g).
 */
const REFERENCE: Partial<Record<FoodGroup, [string, number][]>> = {
  rice_grains: [['1 serving spoon', 100], ['1 medium bowl', 250], ['1 medium plate', 300]],
  beans: [['1 serving spoon', 75], ['1 medium bowl', 250]],
  pasta: [['1 medium bowl', 250], ['1 medium plate', 300]],
  meat: [['1 portion', 85]],
  fish: [['1 portion', 85]],
  seafood: [['1 portion', 85]],
  vegetables: [['1 portion (80 g)', 80]],
  fruit: [['1 portion (80 g)', 80]],
  nuts: [['1 handful', 28]],
  snacks: [['1 handful', 28]],
  soups: [['1 ladle', 150], ['1 medium bowl', 350]],
  salads: [['1 medium bowl', 150], ['1 side plate', 100]],
  cereals: [['1 bowl (dry cereal)', 40]],
  protein_powder: [['1 scoop', 30]],
  poultry: [['1 portion', 85]],
  spreads: [['1 tbsp', 20], ['1 tsp', 7]],
  sauces: [['1 tbsp', 15], ['1 tsp', 5]],
  beverages: [['1 glass (250 ml)', 250]],
};

/** Reference sizes that depend on what the food is within its group (all marked estimated). */
function referenceFor(group: FoodGroup, name: string): [string, number][] {
  const n = name.toLowerCase();
  switch (group) {
    case 'bread': return /bread|toast|loa(f|ves)/.test(n) ? [['1 slice', 30]] : [['1 piece', 60]];
    case 'tubers': return [['1 medium piece', 150], ['1 chunk', 50]];
    case 'dairy': return /cheese/.test(n) ? [['1 slice', 20]] : /yogh?urt|skyr|curd/.test(n) ? [['1 tub', 150]] : /milk|kefir/.test(n) ? [['1 glass (250 ml)', 258]] : [['1 tbsp', 15]];
    case 'desserts': return /ice cream|sorbet|gelato/.test(n) ? [['1 scoop', 65]] : [['1 piece', 50]];
    case 'eggs': return /^eggs?\b/.test(n) && !/omelet|scrambl|sandwich|salad|dish/.test(n) ? [['1 egg', 50]] : [['1 portion', 120]];
    default: return REFERENCE[group] ?? [];
  }
}

/**
 * All the useful measures for one food, by its group: its own record's measures (verified),
 * tablespoons/teaspoons/half cups worked out from its own cup, the group's reference sizes
 * (estimated) where the record has none of that kind, then volume units for liquids.
 * Units a group doesn't use (a cup of chicken) are left out; grams always remain.
 */
export function measuresFor(food: Food): Measure[] {
  const group = groupOf(food);
  const allowed = ALLOWED[group];
  const out: Measure[] = [];
  const seen = new Set<string>();
  const push = (m: Measure) => { const k = m.label.toLowerCase(); if (seen.has(k) || !(m.grams > 0)) return; seen.add(k); out.push(m); };
  const own: Measure[] = [];
  for (const p of food.portions ?? []) {
    if (!(p.grams > 0) || UNHELPFUL.test(p.label)) continue;
    const label = tidyLabel(p.label);
    own.push({ label, grams: p.grams, verified: !isEstimated(food, p.label) });
    // "0.5 breast" or "2 scoop" in the record → also offer one of it (same weighing, so still verified).
    const many = /^(\d+(?:\.\d+)?) ([a-z][\w-]*)(.*)$/i.exec(label);
    const q = many ? Number(many[1]) : 1;
    if (many && q !== 1 && q > 0 && q <= 12 && !/^(oz|g|fl|ml|lb)$/i.test(many[2])) own.push({ label: `1 ${many[2].replace(/s$/, '')}${many[3]}`, grams: Math.round((p.grams / q) * 10) / 10, verified: !isEstimated(food, p.label) });
  }
  const fits = (label: string) => !allowed || allowed.includes(kindOf(label)) || (allowed.includes('portion') && /\b(portion|serving)\b/i.test(label));
  for (const m of own) if (fits(m.label)) push(m);
  // Nothing in the record fits this group's units? Keep the record's own measures rather than none.
  if (!out.length) for (const m of own) push(m);
  // Spoon sizes from the food's own cup (1 cup = 16 tbsp = 48 tsp), for groups measured that way.
  const cup = own.find((m) => /^1 cup\b/i.test(m.label) && !/chopped|diced|sliced|shredded|pieces/i.test(m.label));
  if (cup && allowed) {
    if (allowed.includes('tbsp') && !out.some((m) => kindOf(m.label) === 'tbsp')) push({ label: '1 tbsp', grams: Math.round((cup.grams / 16) * 10) / 10, verified: cup.verified });
    if (allowed.includes('tsp') && !out.some((m) => kindOf(m.label) === 'tsp')) push({ label: '1 tsp', grams: Math.round((cup.grams / 48) * 10) / 10, verified: cup.verified });
    if (allowed.includes('cup') && !out.some((m) => /half cup|0\.5 cup|1\/2 cup/i.test(m.label))) push({ label: '½ cup', grams: Math.round((cup.grams / 2) * 10) / 10, verified: cup.verified });
  }
  // The group's reference sizes, only for kinds the record doesn't already have.
  for (const [label, grams] of referenceFor(group, food.name)) {
    const k = kindOf(label);
    const same = (x: string) => x === k || (k === 'egg' && x === 'piece');
    if (k !== 'piece' && out.some((m) => same(kindOf(m.label)))) continue;
    if (k === 'piece' && out.some((m) => /\b(portion|serving)\b/i.test(m.label))) continue;
    const d = densityOf(food);
    push({ label, grams: group === 'soups' && /ladle/.test(label) ? Math.round(grams * (d?.gPerMl ?? 1)) : grams, verified: false });
  }
  const d = densityOf(food);
  const liquidGroup = ['beverages', 'oils', 'sauces', 'soups', 'dairy', 'spreads', 'other'].includes(group);
  if (d && liquidGroup) {
    for (const [label, ml] of VOLUMES) {
      if (!FOR_KIND[d.kind].includes(label)) continue;
      const core = label.replace(/\s*\(.*\)/, '').replace(/^1 /, '');
      if ([...seen].some((s) => s.replace(/^1 /, '').startsWith(core))) continue; // the record's own cup/tbsp wins
      push({ label, grams: Math.round(ml * d.gPerMl * 10) / 10, verified: false, volume: true });
    }
  }
  return out;
}

/** Short name for a unit button: "1 medium drumstick" → "medium drumstick", "1 cup (240 ml)" → "cup". */
export const unitName = (label: string) => label.replace(/^1\s+/, '').replace(/\s*\([^)]*\)?/g, '').replace(/,.*$/, '').trim();

/** Units a person can pick when creating a food, inferred from what kind of food it is. */
/** The units to offer for each group: the measurement table, in order (grams always last). */
export const GROUP_UNITS: Record<FoodGroup, string[]> = {
  rice_grains: ['cup', 'tbsp', 'serving spoon', 'bowl', 'plate'],
  meat: ['piece', 'slice', 'portion', 'cut', 'oz'],
  poultry: ['piece', 'breast', 'thigh', 'wing', 'drumstick', 'oz'],
  fish: ['fillet', 'whole fish', 'slice', 'piece', 'oz'],
  seafood: ['piece', 'handful', 'portion', 'oz'],
  eggs: ['egg', 'egg white', 'egg yolk'],
  beans: ['cup', 'tbsp', 'serving spoon', 'bowl'],
  pasta: ['cup', 'handful', 'bowl', 'plate'],
  bread: ['slice', 'piece', 'roll', 'loaf'],
  fruit: ['whole', 'half', 'quarter', 'slice', 'piece', 'cup'],
  vegetables: ['cup', 'handful', 'piece', 'whole'],
  tubers: ['whole', 'half', 'slice', 'chunk', 'piece'],
  nuts: ['handful', 'tbsp', 'tsp', 'cup', 'oz'],
  dairy: ['cup', 'tbsp', 'slice', 'tub', 'ml'],
  oils: ['tsp', 'tbsp', 'ml'],
  sauces: ['tsp', 'tbsp', 'cup', 'ml'],
  soups: ['ladle', 'bowl', 'cup', 'ml'],
  salads: ['cup', 'handful', 'bowl', 'plate'],
  cereals: ['bowl', 'cup', 'tbsp', 'serving'],
  snacks: ['piece', 'handful', 'packet', 'portion'],
  desserts: ['piece', 'slice', 'scoop', 'cup'],
  beverages: ['glass', 'cup', 'bottle', 'can', 'ml'],
  protein_powder: ['scoop', 'tbsp'],
  spreads: ['tsp', 'tbsp', 'portion'],
  mixed: ['plate', 'bowl', 'serving', 'piece'],
  other: ['serving', 'piece'],
};

/** Units to suggest for a food you create yourself, from the group its name puts it in. */
export function suggestedUnits(name: string, category = ''): string[] {
  return [...GROUP_UNITS[groupOf({ name, category, source: 'custom' } as Pick<Food, 'name' | 'category' | 'source'>)], 'g'];
}
