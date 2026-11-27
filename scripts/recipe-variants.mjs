/**
 * The versions of each dish that people actually cook: the same dish with another protein
 * (jollof rice with chicken → with beef, goat, fish, shrimp), a vegetarian version and a vegan version.
 * Every version is a real ingredient list (same grams, one swap), so its numbers come from the same
 * USDA / FAO records as the original. A version is only made when the swap is plain and safe:
 * desserts and drinks keep their recipe, and a vegan version is dropped if any animal ingredient is left.
 */

// Same words the app uses to decide what is vegetarian / vegan (src/lib/goals.ts).
const MEAT = /\b(chicken|beef|pork|lamb|turkey|veal|ham|bacon|sausages?|duck|goat|mutton|venison|rabbit|liver|tripe|kidneys?|gizzards?|oxtails?|suya|meats?|lard|gelatin|gelatine|pepperoni|salami|chorizo|frankfurters?|hot dogs?|bologna|pastrami|jerky|game|quail|goose|pigeon|snail|stock, (beef|chicken)|broth, (beef|chicken)|bone broth)\b/i;
const FISH = /\b(fish|salmon|tuna|shrimps?|prawns?|crustaceans|mollusks|cod|sardines?|catfish|tilapia|mackerel|anchov(y|ies)|crabs?|lobsters?|oysters?|mussels?|clams?|scallops?|squid|octopus|crayfish|periwinkles?|herring|trout|haddock|hake|croaker|stockfish|seafood|calamari|worcestershire|caesar dressing|dashi|bonito)\b/i;
const ANIMAL = /\b(eggs?|milk|cheeses?|yogh?urts?|whey|casein|cream|butter|honey|ghee|mayonnaise|paneer|custard|kefir|buttermilk|lactose|pesto|mayo|meringues?|lassi|tzatziki|labneh|ricotta|mozzarella|feta|parmesan)\b/i;
const PLANT_ALIKE = /\b(peanut|almond|cashew|nut|seed|shea|cocoa|apple|soy|soya|sunflower|groundnut|sesame)\s+butter\b|\b(coconut|soy|soya|almond|oat|rice|cashew|hemp|pea)\s+(milk|cream|yogh?urt|cheese)\b|\byogh?urt, (coconut|soy|almond)( milk)?\b|\bcheese substitute\b|\bvegan mayonnaise\b|\bmeatless\b|\bveggie\b|\bvegan\b|\bcream of tartar\b|\bplant-based\b|\b(non-?dairy|dairy-free)\b/gi;
const clean = (s) => s.replace(PLANT_ALIKE, ' ');

const P = {
  tofu: 'Tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)',
  lentils: 'Lentils, mature seeds, cooked, boiled, without salt',
  paneer: 'Cheese, paneer',
  vegPatty: 'Veggie burger patty, no bun',
  vegBroth: 'Soup, vegetable broth, ready to serve',
  mushroomGravy: 'Gravy, mushroom, canned',
  soyMilk: 'Soy milk, unsweetened',
  coconutMilk: 'Nuts, coconut milk, canned (liquid expressed from grated meat and water)',
  coconutYogurt: 'Yogurt, coconut milk',
  oil: 'Oil, vegetable, soybean, refined',
  vegCheese: 'Cheese substitute, mozzarella',
  vegMayo: 'Vegan mayonnaise',
};

// Protein groups by ingredient key, and what each can honestly become.
const GROUPS = {
  chicken: ['chicken_breast', 'chicken_thigh', 'chicken_leg', 'chicken_meat', 'chicken_stewed', 'drumstick'],
  beef: ['beef', 'beef_brisket', 'beef_sirloin', 'flank', 'pot_roast', 'shank'],
  goat: ['goat'],
  lamb: ['lamb', 'lamb_chops', 'lamb_shoulder', 'lamb_leg'],
  pork: ['pork_loin', 'pork_shoulder', 'pork_tenderloin', 'pork_roast'],
  turkey: ['turkey'],
  fish: ['fish', 'catfish', 'cod', 'mackerel', 'salmon', 'tuna_steak', 'haddock', 'trout'],
  shrimp: ['shrimp'],
};
const MINCE = { beef: 'beef_mince', chicken: 'chicken_mince', lamb: 'lamb_mince', turkey: 'turkey_mince', pork: 'pork_mince' };
const PIECE = { chicken: 'chicken_thigh', beef: 'beef', goat: 'goat', lamb: 'lamb', pork: 'pork_shoulder', turkey: 'turkey', fish: 'fish', shrimp: 'shrimp' };
const SWAPS = { chicken: ['beef', 'goat', 'fish', 'shrimp'], beef: ['chicken', 'goat', 'lamb'], goat: ['chicken', 'beef', 'lamb'], lamb: ['beef', 'chicken', 'goat'], pork: ['chicken', 'beef'], turkey: ['chicken'], fish: ['shrimp', 'chicken'], shrimp: ['fish', 'chicken'] };
const MINCE_SWAPS = { beef: ['chicken', 'lamb', 'turkey'], chicken: ['beef', 'turkey'], lamb: ['beef', 'chicken'], turkey: ['chicken', 'beef'], pork: ['chicken', 'beef'] };
const WORD = { chicken: /\bchicken\b/i, beef: /\bbeef\b/i, goat: /\bgoat\b/i, lamb: /\b(lamb|mutton)\b/i, pork: /\bpork\b/i, turkey: /\bturkey\b/i, fish: /\bfish\b/i, shrimp: /\b(shrimp|prawns?)\b/i };
const ANY_PROTEIN_WORD = /\b(chicken|beef|goat|lamb|mutton|pork|turkey|fish|shrimp|prawns?|salmon|tuna|cod|duck|crab|steak|meatballs?|sausages?|bacon|ham|seafood|lobster|octopus|squid|meat|camel|veal|rabbit)\b/gi;
// Dish names that already mean one meat in another language: never put a different meat in them.
const NAMED_MEAT = /\b(doro|pollo|poulet|frango|galinha|dak|gai|ayam|murgh|murg|djaj|dajaj|kuku|nyama|carne|boeuf|bœuf|gosht|ghosht|keema|kheema|ika|pescado|poisson|peixe|camar[aã]o|cerdo|porco|lech[oó]n|kambing|kuzu|agneau|cordero|mbuzi|bulgogi|galbi|tonkatsu|katsu|yakitori|carnitas|barbacoa|asado|churrasco|biltong|kilishi|suya|shawarma|gyros?|doner|souvlaki|kofta|kebab|jerk|tandoori|tikka|adobo|lechon|rendang|satay|sate|bistek|tapa|nihari|haleem|vindaloo|rogan|chili con carne|bacalhau|bacalao|tonkotsu|kazy|sv[ií]čkov[aá]|saltimbocca|bitoque|brochettes?|schnitzel|cutlets?|chops?|ribs|wings?|roast|stifado|souse)\b/i;
const GENERIC = /\b(stew|soup|curry|rice|sauce|stir.?fry|noodles?|pasta|spaghetti|salad|sandwich|wrap|bowl|tacos?|burrito|skewers|plate|porridge|biryani|pilaf|pilau|plov|pulao|tagine|casserole|fajitas?|quesadilla|fried rice|jollof|egusi|ogbono|okra|pepper soup|dumplings?|empanadas?|samosas?|lasagn[ae]|risotto|paella|chowder|broth|gumbo|jambalaya|pie|pot|hotpot)\b/i;
const SOUTH_ASIAN = /Indian|Pakistani|Bangladeshi|Nepali|Sri Lankan|Bhutanese|Maldivian/;

/** One dish → its versions. `names` holds every name already used (lowercase) and is updated. */
export function variantsOf(r, K, names) {
  Object.assign(P, { maple: K.maple, soy: K.soy, riceNoodles: K.rice_noodles, potato: K.potato, oil: K.oil, tofu: K.tofu, lentils: K.lentils, paneer: K.paneer, vegPatty: K.veggie_patty, soyMilk: K.soy_milk, coconutMilk: K.coconut_milk });
  if (/International (dessert|drink)|Spice blend/.test(r.cuisine) || /^(vegan|vegetarian)\b/i.test(r.name) || /alcohol/i.test(r.name)) return [];
  const keyOf = new Map(Object.entries(K).map(([k, v]) => [v, k]));
  const items = r.ingredients.map(([name, g]) => ({ name, g, key: keyOf.get(name) }));
  if (items.some((i) => !i.key)) return [];
  const out = [];
  const add = (name, ingredients, kind) => {
    const lc = name.toLowerCase();
    if (names.has(lc)) return;
    names.add(lc);
    const total = ingredients.reduce((s, [, g]) => s + g, 0);
    const scale = total / r.ingredients.reduce((s, [, g]) => s + g, 0);
    out.push({ ...r, name, aliases: kind === 'vegan' ? ['plant-based'] : [], ingredients, yield: Math.round(r.yield * scale), kind, of: r.name,
      portions: r.portions.map(([l, g]) => [l, Math.round(g * scale)]) });
  };
  const titleRest = (s) => (/^[A-Z][a-z]/.test(s) && !/^[A-Z][a-z]+\b.*\b[A-Z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

  // ---- main protein ----
  let main = null;
  for (const i of items) {
    for (const [grp, keys] of Object.entries(GROUPS)) if (keys.includes(i.key) && (!main || i.g > main.g)) main = { ...i, grp, mince: false };
    for (const [grp, key] of Object.entries(MINCE)) if (i.key === key && (!main || i.g > main.g)) main = { ...i, grp, mince: true };
  }
  const proteinWords = (r.name.match(ANY_PROTEIN_WORD) ?? []).map((w) => w.toLowerCase());
  const nameHasMain = main && WORD[main.grp].test(r.name);

  // ---- other proteins ----
  if (main && main.g >= 40 && !NAMED_MEAT.test(r.name) && !/\b(brisket|sirloin|tenderloin|loin|shank|thighs?|breasts?|fillets?|oxtail|mince)\b/i.test(r.name) && new Set(proteinWords).size <= 1 && (nameHasMain || (!proteinWords.length && GENERIC.test(r.name)))) {
    for (const to of (main.mince ? MINCE_SWAPS : SWAPS)[main.grp] ?? []) {
      const key = main.mince ? MINCE[to] : PIECE[to];
      if (!key || !K[key]) continue;
      const ingredients = items.map((i) => (i === items.find((x) => x.name === main.name) ? [K[key], i.g] : [i.name, i.g]));
      const word = to === 'shrimp' ? 'shrimp' : to;
      const [, stem, tail = ''] = /^(.*?)((?:, [A-Z][^,]*)?)$/.exec(r.name);
      const name = nameHasMain ? r.name.replace(WORD[main.grp], (m) => (m[0] === m[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word)) : `${stem}${/ with /i.test(stem) ? ' and ' : ' with '}${word}${tail}`;
      add(name, ingredients, 'protein');
    }
  }

  // ---- vegan and vegetarian ----
  const savoury = !items.some((i) => ['sugar', 'icing_sugar', 'condensed', 'jam', 'nutella', 'marshmallow'].includes(i.key) && i.g >= 15);
  const baked = items.some((i) => ['flour', 'rice_flour', 'semolina'].includes(i.key)) && items.some((i) => /^egg/.test(i.key));
  const NEVER = ['pancake', 'waffle', 'pie_crust', 'puff_pastry', 'croissant', 'yorkshire', 'sponge', 'granola', 'meringue', 'gelatine', 'ice_cream', 'choc_ice_cream', 'condensed', 'nutella', 'marshmallow', 'pesto', 'shortbread', 'cream_cheese', 'english_muffin', 'naan', 'naan_ww'];
  const hasAnimal = items.some((i) => MEAT.test(i.name) || FISH.test(clean(i.name)) || ANIMAL.test(clean(i.name)));
  const nameBlocks = ANIMAL.test(clean(r.name)) || /\b(halloumi|shown as|skyr|ayran|dahi|raita|lassi|kefir|labneh)\b/i.test(r.name) || /\b(bacon|ham|sausages?|meatballs?|steak|duck|crab|salmon|tuna|cod|liver|tripe|oxtail|ribs|wings?|drumsticks?|nuggets|burger)\b/i.test(r.name);
  if (!hasAnimal || !savoury || nameBlocks || NAMED_MEAT.test(r.name) || items.some((i) => NEVER.includes(i.key))) return out;

  const build = (vegan) => {
    const res = [];
    for (const i of items) {
      const k = i.key;
      const isMeat = Object.values(GROUPS).flat().includes(k) || ['wing', 'chicken_fried', 'gizzard', 'liver', 'tripe', 'oxtail', 'crab', 'clams', 'mussels', 'squid', 'tuna', 'tuna_raw', 'salmon_raw', 'sardine', 'kipper', 'herring', 'smoked_salmon', 'salt_cod', 'duck', 'duck_meat', 'veal', 'veal_loin', 'ribs', 'pork_belly'].includes(k);
      if (isMeat) res.push([vegan || !SOUTH_ASIAN.test(r.cuisine) ? P.tofu : P.paneer, i.g]);
      else if (Object.values(MINCE).includes(k)) res.push([P.lentils, i.g]);
      else if (['sausage', 'beef_patty'].includes(k)) res.push([P.vegPatty, i.g]);
      else if (['bacon', 'ham', 'ham_slice', 'chorizo', 'pepperoni', 'dried_shrimp'].includes(k)) { if (i.g > 30) res.push([P.tofu, i.g]); }
      else if (k === 'stock') res.push([P.vegBroth, i.g]);
      else if (k === 'gravy') res.push([P.mushroomGravy, i.g]);
      else if (['fish_sauce', 'oyster_sauce', 'worcestershire'].includes(k)) res.push([P.soy, i.g]);
      else if (!vegan) res.push([i.name, i.g]);
      else if (['milk', 'evaporated', 'buttermilk', 'kefir'].includes(k)) res.push([P.soyMilk, i.g]);
      else if (['cream', 'whipped', 'sour_cream'].includes(k)) res.push([P.coconutMilk, i.g]);
      else if (['yogurt', 'yogurt_low', 'greek_yogurt', 'greek_yogurt_full'].includes(k)) res.push([P.coconutYogurt, i.g]);
      else if (['butter', 'ghee'].includes(k)) res.push([P.oil, Math.round(i.g * 0.8)]);
      else if (['paneer', 'halloumi', 'cottage'].includes(k)) res.push([P.tofu, i.g]);
      else if (['cheddar', 'mozzarella', 'feta', 'parmesan', 'swiss', 'gouda', 'monterey', 'provolone', 'goat_cheese', 'blue_cheese', 'ricotta'].includes(k)) { if (i.g > 40) return null; res.push([P.vegCheese, i.g]); }
      else if (k === 'mayo') res.push([P.vegMayo, i.g]);
      else if (/^egg(_boiled|_fried|_scrambled|_poached|_white)?$/.test(k)) { if (baked) return null; res.push([P.tofu, i.g]); }
      else if (k === 'egg_noodles') res.push([P.riceNoodles, i.g]);
      else if (k === 'honey') res.push([P.maple, i.g]);
      else if (k === 'mash') res.push([P.potato, i.g]);
      else res.push([i.name, i.g]);
    }
    const text = clean(res.map(([n]) => n).join('; '));
    if (MEAT.test(text) || FISH.test(text)) return null;
    if (vegan && ANIMAL.test(text)) return null;
    return res;
  };
  const sub = main ? (main.mince ? 'lentil' : 'tofu') : null;
  const plantName = (prefix, subWord) => {
    let n = r.name;
    if (nameHasMain && subWord) n = n.replace(WORD[main.grp], subWord);
    else if (proteinWords.length) return null; // a name like "Chicken and shrimp curry" has no honest plant version name
    // Any meat or fish word left in the name ("okra soup with tofu and beef") → no honest name.
    if (new RegExp(ANY_PROTEIN_WORD.source, 'i').test(n) || MEAT.test(n) || FISH.test(n)) return null;
    return `${prefix} ${titleRest(n)}`;
  };
  // A dish that is mostly meat or fish and isn't named after it (brochettes, kazy...) has no honest plant version.
  const meatShare = items.filter((i) => MEAT.test(i.name) || FISH.test(i.name)).reduce((t, i) => t + i.g, 0) / items.reduce((t, i) => t + i.g, 0);
  if (meatShare >= 0.35 && !nameHasMain) return out;
  const hadMeat = items.some((i) => MEAT.test(i.name) || FISH.test(clean(i.name)));
  const vegan = build(true);
  if (vegan) { const n = plantName('Vegan', sub); if (n) add(n, vegan, 'vegan'); }
  const veg = build(false);
  // Only worth its own entry when it differs from the vegan one (keeps dairy or eggs).
  if (veg && hadMeat && ANIMAL.test(clean(veg.map(([n]) => n).join('; ')))) {
    const n = plantName('Vegetarian', main && !main.mince && SOUTH_ASIAN.test(r.cuisine) ? 'paneer' : sub);
    if (n) add(n, veg, 'vegetarian');
  }
  return out;
}
