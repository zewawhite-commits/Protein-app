/**
 * Real food photos from Unsplash (found once per food type by /api/photos, shown from
 * Unsplash's own links with the photographer credited on the Photo credits page).
 *
 * A food gets a photo by its dish (e.g. "Amala"), or else by its illustration key
 * (e.g. every banana record shares the banana photo).
 */
import { artFor } from './foodArt';
import { photoMust } from './photoQueries';

/** Dishes with a photo of their own, checked before the general illustration key. */
const DISH_RULES: [RegExp, string][] = [
  // Common foods that need their own photo (a whole roast chicken is wrong for "chicken breast").
  [/\bchicken\b.*\bbreast|\bbreast\b.*\bchicken/, 'chicken_breast'], [/\bchicken\b.*\bwings?\b|\bwings?\b.*\bchicken|^wings?\b/, 'chicken_wings'],
  [/\bchicken\b.*\bthighs?\b/, 'chicken_thigh_raw'], [/\bchicken\b.*\bdrumsticks?\b/, 'chicken_drumstick'], [/peanut butter|groundnut (paste|butter)/, 'peanut_butter'], [/cottage cheese/, 'cottage_cheese'],
  [/\balmonds?\b(?! (butter|oil|paste|milk|flour|meal|extract))/, 'almonds'], [/\bsalmon\b/, 'salmon'], [/\btuna\b/, 'tuna'], [/scrambled egg/, 'scrambled_eggs'], [/\begg\b.*\bfried|fried egg/, 'fried_egg'],
  [/\bjollof(?! (spaghetti|macaroni|pasta|fonio|couscous|beans))/, 'jollof'], [/\bfried rice\b/, 'fried_rice'], [/\begusi|\begushi/, 'egusi'], [/\bpounded yam|\bpoundo|\biyan\b/, 'pounded_yam'],
  [/\bamala/, 'amala'], [/\beba\b|gari swallow/, 'eba'], [/\bfufu|\bakpu\b|\bfoufou/, 'fufu'], [/\bsemovita|\bsemo\b|semolina (swallow|fufu)/, 'semovita'],
  [/\btuwo/, 'tuwo'], [/\bbanku/, 'banku'], [/\bkenkey/, 'kenkey'], [/\bugali|\bnsima|\bsadza/, 'ugali'], [/\binjera/, 'injera'],
  [/\bsuya\b|\bkilishi/, 'suya'], [/\bmoi ?moi|\bmoin|bean pudding/, 'moi_moi'], [/\bakara\b|\baccara|bean fritter/, 'akara'],
  [/\bpuff[- ]?puff|\bbofrot/, 'puff_puff'], [/\bchin ?chin/, 'chin_chin'], [/\befo riro|\befo\b/, 'efo_riro'], [/\bokra soup|\bokro soup/, 'okra_soup'],
  [/\bogbono|draw soup/, 'ogbono'], [/pepper ?soup/, 'pepper_soup'], [/\bbanga/, 'banga'], [/\bafang|\bokazi/, 'afang'], [/edikang/, 'edikang_ikong'],
  [/\bofada/, 'ofada'], [/\babacha|african salad/, 'abacha'], [/\bzobo|\bsobolo|\bbissap/, 'zobo'], [/\bwaakye/, 'waakye'], [/\bkelewele/, 'kelewele'],
  [/\bmasa\b|\bwaina/, 'masa'], [/\bboli\b|roasted plantain/, 'boli'], [/\bkuli ?kuli/, 'kuli_kuli'], [/\bshawarma/, 'shawarma'], [/\bmeat pie/, 'meat_pie'],
  [/beans porridge|\bewa riro/, 'beans_porridge'], [/yam porridge|\basaro|yam pottage/, 'yam_porridge'], [/ewa agoyin/, 'ewa_agoyin'], [/\basun\b/, 'asun'],
  [/^peppered snails?|\bigbin\b/, 'peppered_snail'], [/\bthieboudienne|\bjollof fish/, 'thieboudienne'], [/groundnut soup|peanut soup|\bmafe\b/, 'groundnut_soup'],
  [/\bogi\b|\bpap\b|\bakamu|\bkoko\b/, 'pap'], [/agege bread/, 'agege_bread'], [/\bdodo\b|plantain, (cooked|fried|ripe.*fried)|fried plantain|\balloco/, 'plantain'],
  [/\bhummus|\bhoumous/, 'hummus'], [/\bbiryani|\bbiriyani/, 'biryani'], [/\bpad thai/, 'pad_thai'], [/^pho\b/, 'pho'],
  [/^ramen\b/, 'ramen'], [/^lasagn/, 'lasagne'], [/\bspaghetti bolognese|spaghetti with meat sauce/, 'spaghetti_bolognese'], [/^mac(aroni)? (and|&|n) cheese/, 'mac_and_cheese'],
  [/^caesar salad/, 'caesar_salad'], [/^greek salad/, 'greek_salad'], [/^guacamole/, 'guacamole'], [/\bbutter chicken|murgh makhani/, 'butter_chicken'], [/tikka masala/, 'tikka_masala'],
  [/^paella/, 'paella'], [/^couscous\b/, 'couscous'], [/\bdoro wat|\bdoro wot/, 'doro_wat'], [/^shakshuka/, 'shakshuka'], [/^tagine|\btajine/, 'tagine'],
  [/^chili con carne|^chilli con carne/, 'chili_con_carne'], [/^gyoza|^potstickers?/, 'gyoza'], [/^bibimbap/, 'bibimbap'], [/^nasi goreng/, 'nasi_goreng'], [/^pierogi/, 'pierogi'],
  [/^moussaka/, 'moussaka'], [/^tabbouleh|^tabouli/, 'tabbouleh'], [/^miso soup/, 'miso_soup'], [/^tom yum/, 'tom_yum'], [/^jerk chicken/, 'jerk_chicken'],
  [/^yam\b|\byam, (cooked|boiled|tuber)/, 'yam'], [/\boats?\b|\boatmeal|\bporridge, oat/, 'oats'], [/\byogh?urt/, 'yogurt'], [/\btofu\b/, 'tofu'],
];

/** Which photo a food uses (a dish of its own, or its food type), or undefined for none. */
// Foods that aren't simply "the food in the photo": mixed dishes, snacks, organ meats, brands…
// They get a plain tile rather than a photo of something else.
const NOT_PLAIN = /\b(with|and|&|sandwich|burger|pounder|pie|pies|soup|stew|curry|salad|sauce|gravy|dip|chips|crisps|crackers?|biscuits?|cookies?|snacks?|pudding|mix|cakes?|nuggets?|fingers?|sticks?|patty|patties|balls?|rolls?|wraps?|frozen|flavou?r(ed)?|baby food|infant|formula|liver|giblets?|gizzards?|hearts?|kidneys?|feet|neck|tongue|tripe|blood|substitute|imitation|powder|extract|juice|drink|spread|fast food|restaurant|caterpillar|insects?|larvae|split|nectar|crumbs?|breadcrumbs|deviled|quiche|cacciatore|beverage|paper|wrapper|fishcakes?|sausages?|separable|bacon bits|croutons?|stuffing|dumplings?|filling|topping|syrup|candied|canned in syrup|dressing|flour|creole|mixed|shake|beverage|beverages|confectionery|cereals?|muffins?|granola|candy|chocolate[- ]coated|covered)\b| or /;
const BRANDED = /\b[A-Z]{3,}\b/;

// These are ordinary foods, so they follow the same "is it plainly this food?" check as everything else.
const PLAIN_DISHES = new Set(['chicken_breast', 'chicken_wings', 'chicken_thigh_raw', 'chicken_drumstick', 'peanut_butter', 'cottage_cheese', 'almonds', 'salmon', 'tuna', 'scrambled_eggs', 'fried_egg', 'yam', 'oats', 'yogurt', 'tofu', 'plantain']);
// Cooking notes that don't change what the food looks like ("with skin", "fried in oil", "broilers or fryers").
const NOTES = /\b(with|without|in) (added )?(cooking spray|[a-z]+ oil|oil|butter|margarine|animal fat|fat|salt|skin|bone|added solution)\b|\b(meat|skin|bone|flesh) and (skin|bone|meat|fat)\b|broilers? or fryers?|\bns as to [a-z ]+|\bor (raw|cooked|frozen)\b/g;

// "Fish, salmon" / "Nuts, almonds": the main word is the food family, so the rest decides.
const PLAIN_HEADS = /^(fish|chicken|nuts|eggs?|seafood|poultry|beef|meat|spreads?)$/;
// Names whose last word is a different food from what it looks like.
const FALSE_FRIENDS = /^(cocoa|shea|almond|cashew|hazelnut|apple|honey|sunflower|seed|custard|cashew|star|prickly|balsam|mammie|sugar|rose|bitter|kung pao|mapo|atole|potato|banana|bread|sea|sweet corn) |\bnuts?$/;

/**
 * Broad groups whose checked photo shows one particular kind: only foods of that kind use it.
 * (The beef photo is a grilled steak, so ground or corned beef get a plain tile instead.)
 */
const ONLY: Record<string, { yes: RegExp; no?: RegExp }> = {
  // The photo is a grilled steak: not braised, stewed, pot-roasted, country-fried or a roast joint.
  cut_of_meat: { yes: /\b(steak|sirloin|rib ?eye|tenderloin|t-bone|porterhouse|strip loin|flank|rump|skirt|filet mignon)\b/, no: /\b(ground|mince|corned|cured|jerky|raw|braised|braising|stewed|slow cooked|pot-roasted|casseroled|country fried|chicken fried|cube|joint)\b/ },
  poultry_leg: { yes: /\b(roast(ed)?|rotisserie)\b.*\b(chicken|whole)|\bwhole\b.*\broast/ },
  // The checked photos: grilled whole fish; raw salmon fillet; grilled chicken breast; raw thighs/legs; cooked prawns.
  // The photo is a whole fried fish: only fried fish, not fillets of cod or steamed and grilled fish.
  fish: { yes: /\bfried\b/, no: /\b(raw|dried|dry|salted|smoked|canned|pickled|roe|paste|oil|fingers?|sticks?|cakes?|balls?|frozen|ns as to|gefilte|surimi|cod|haddock|pollock|flounder|halibut|swordfish|shark|eel|anchovy|escovitch|batter|breaded)\b/ },
  // The photo is a raw salmon fillet: not smoked slices, and not rock salmon (dogfish).
  salmon: { yes: /\b(raw|fresh|fillet)\b/, no: /\b(cooked|baked|grilled|fried|broiled|canned|steamed|poached|roasted|microwaved|dry heat|smoked|lox|gravlax|rock salmon|dogfish)\b/ },
  // The photo is grilled, sliced breast: not raw, stewed or casseroled.
  chicken_breast: { yes: /./, no: /\b(raw|uncooked|breaded|coated|fried|batter|deli|sliced|luncheon|canned|stewed|casseroled|poached|boiled)\b/ },
  chicken_thigh_raw: { yes: /\braw\b/, no: /\b(fried|coated|cooked|roasted|baked|stewed|grilled|from raw)\b/ },
  // The photo is raw drumsticks.
  chicken_drumstick: { yes: /\braw\b/, no: /\b(fried|coated|cooked|roasted|baked|broiled|stewed|grilled|rotisserie|sauteed|from raw)\b/ },
  shrimp: { yes: /./, no: /\b(raw|dried|dry|canned|paste|breaded|fried|kung pao)\b/ },
  cooked_rice: { yes: /\bwhite\b.*\b(cooked|boiled|steamed)\b|\b(cooked|boiled|steamed)\b.*\bwhite\b/, no: /\b(raw|uncooked|dry|flour|brown|wild|red|yellow|fried|beverage|cakes?)\b/ },
  potato: { yes: /\braw\b/, no: /\b(flour|flakes|powder|dehydrated|chips|fries)\b/ },
  egg: { yes: /\bwhole\b|^eggs?, (chicken|hen)(, raw|, boiled|, hard)/, no: /\b(white|yolk|dried|dry|powder|substitute|omelet|fried|scrambled|baked|poached|pickled|duck|goose|quail|turkey|deviled)\b/ },
  leafy_green: { yes: /^spinach\b.*\braw\b/, no: /\b(cooked|boiled|frozen|canned|creamed|souffle|dip)\b/ },
  hot_beverage: { yes: /^coffee\b/, no: /\b(latte|mocha|cappuccino|macchiato|iced|frappe|cafe|con leche|with|creamer|liqueur|powder|dry|not reconstituted|irish|cuban|turkish|lightened|milk|sweetened)\b/ },
  pea_pod: { yes: /\b(green|garden)\b.*\bpeas?\b|^peas?, (green|garden|fresh|frozen)/, no: /\b(pigeon|split|dried|dry|mature|yellow|snow|snap|edible-podded|chick|black-eyed|cowpea|canned|sprouted|flour|soup)\b/ },
  yogurt: { yes: /\b(plain|natural|greek|unflavou?red)\b/, no: /\b(fruit|flavou?r(ed|s)?|vanilla|strawberry|frozen|drink|liquid|chocolate|honey|coffee|lemon|banana|berry|peach|cereal)\b/ },
  bell_pepper: { yes: /\b(sweet|bell|capsicum)\b/, no: /\b(hot|chil[ie]|jalapeno|serrano|dried|stuffed|black|pasilla|cooked|boiled|sauteed|fried|canned|roasted|frozen|pickled)\b/ },
  teacup_without_handle: { yes: /^tea\b/, no: /\b(hibiscus|rooibos|iced|bubble|long island|milk|chai|sweetened|instant|powder|bottled|dry|leaves|lemon|ready-to-drink|kombucha|green|herbal|chamomile|matcha|mint|fruit)\b/ },
  // The photo is fried wings: only fried or coated wings.
  chicken_wings: { yes: /\b(fried|coated|"wings", plain)\b|"wings"/, no: /\b(raw|glazed|barbecued?|bbq|buffalo|sauce|teriyaki|honey|frozen|marinated|stewed|casseroled|lean flesh)\b/ },
  mushroom: { yes: /\b(white|button|common|agaricus)\b/, no: /\b(cooked|boiled|fried|canned|dried|shiitake|oyster|enoki|portabell?a|chanterelle|morel|maitake|jew|asian|straw|stuffed|sauteed|microwaved|grilled)\b/ },
  wine_glass: { yes: /\bred\b/, no: /\b(white|rose|sparkling|fortified|non-?alcoholic|cooking|cooked|dessert|port|sherry)\b/ },
  red_apple: { yes: /\b(raw|fresh|red|eating)\b/, no: /\b(dried|baked|juice|sauce|canned|cooked|stewed|green|granny|peeled|without skin|flesh only|crab|rose|star|custard|cashew|sugar|mammie|wax|chips|sweet apple)\b/ },
  onion: { yes: /\braw\b/, no: /\b(red|spring|green|pearl|cooked|fried|dried|powder|rings?|welsh|young|scallion|shallot|pickled|sweet)\b/ },
  tuna: { yes: /\b(fresh|steak|fillet|yellowfin|bluefin|skipjack|albacore)\b/, no: /\b(canned|raw|salad|smoked|dried|sushi|sauce|cream)\b/ },
  broccoli: { yes: /\b(raw|fresh)\b/, no: /\b(cooked|boiled|frozen|steamed|fried|raab|chinese|leaves|stalks|purple)\b/ },
  carrot: { yes: /\b(raw|fresh)\b/, no: /\b(cooked|boiled|canned|juice|frozen|microwaved|baby|dehydrated)\b/ },
  tomato: { yes: /\b(raw|fresh|ripe)\b/, no: /\b(cooked|boiled|paste|canned|sun-?dried|green|yellow|puree|juice|sauce|stewed|fried|orange)\b/ },
  banana: { yes: /\b(raw|fresh|ripe|flesh)\b|^bananas?, raw/, no: /\b(baked|chips?|dried|bread|unripe|green|split|dehydrated|powder)\b/ },
  yam: { yes: /\braw\b/, no: /\b(boiled|cooked|flour|pounded|fried|porridge|roasted|baked|chips)\b/ },
  peanuts: { yes: /./, no: /\b(butter|oil|flour|candy|honey|chocolate|coated|covered|boiled|paste)\b/ },
  pear: { yes: /\b(raw|fresh)\b/, no: /\b(dried|canned|juice|prickly|balsam|asian|nashi|cooked|stewed|syrup)\b/ },
  butter: { yes: /^butter\b/, no: /\b(peanut|shea|cocoa|honey|almond|garlic|ghee|clarified|spread|oil|substitute)\b/ },
  avocado: { yes: /./, no: /\b(oil|dip|guacamole|dressing)\b/ },
  cucumber: { yes: /./, no: /\b(pickled|cooked|sea|salad)\b/ },
  mango: { yes: /\b(raw|fresh|ripe|peeled|flesh)\b/, no: /\b(dried|juice|nectar|unripe|green|canned|pickle|chutney)\b/ },
  pineapple: { yes: /./, no: /\b(canned|juice|dried|syrup|candied)\b/ },
  oats: { yes: /\b(raw|rolled|dry|uncooked|flakes)\b|^oats$/, no: /\b(cooked|porridge|milk|bran|swallow|fufu|instant|beverage|bread|muffin|cereal|flour)\b/ },
  bagel: { yes: /./, no: /\b(sandwich|cream cheese|chips)\b/ },
  pancakes: { yes: /./, no: /\b(potato|frozen|mix|syrup|scotch|crepes?|fruit|chocolate)\b/ },
  croissant: { yes: /./, no: /\b(chocolate|apple|cheese|ham|almond|egg|fruit)\b/ },
  jollof: { yes: /rice|^jollof|jolof/, no: /\b(spaghetti|macaroni|pasta|beans|native|palm oil)\b/ },
  grapes: { yes: /./, no: /\b(green|white|raisins?|juice|jelly|jam|leaves|sultana)\b/ },
  strawberry: { yes: /./, no: /\b(dried|jam|frozen|syrup|shake|juice|yogh?urt|ice cream)\b/ },
  watermelon: { yes: /./, no: /\b(seeds?|juice|rind|kernel)\b/ },
  blueberries: { yes: /./, no: /\b(dried|frozen|canned|muffin|juice|syrup|sweetened)\b/ },
  lemon: { yes: /\b(raw|fresh|peeled)\b/, no: /\b(peel|juice|sole|curd|zest|grass|pickled|preserved)\b/ },
  coconut: { yes: /\b(flesh|fresh|raw|meat)\b/, no: /\b(water|cream|milk|oil|dried|desiccated|sugar|flour|candy)\b/ },
  kiwi_fruit: { yes: /./, no: /\b(dried|juice|canned)\b/ },
  peach: { yes: /\b(raw|fresh|flesh)\b/, no: /\b(canned|dried|dehydrated|melba|nectar|juice|syrup|frozen)\b/ },
  // Checked in the full photo audit: each photo only on foods that look like it.
  beans: { yes: /\b(dry|dried)\b|mature seeds, raw/, no: /\b(from dried|fresh|green|snap|string|yardlong|winged|sprout(ed)?|baked|re-?fried|canned|cooked|boiled|in pod|fruit|fermented|pickled|runner|balor|papri|cluster|sword|fried|immature|soya|soy|locust|velvet|jack|ground bean|chick)\b/ },
  cheese_wedge: { yes: /\b(cheddar|colby|gouda|edam|emmental|gruyere|swiss|monterey|jack|muenster|havarti|jarlsberg|leicester|gloucester|cheshire|derby|wensleydale|lancashire|fontina|tilsit|brick|caraway|port (de|du) salut|port salut|provolone|hard, average|parmesan, (hard|fresh)|romano)\b/, no: /\b(cottage|cream|ricotta|mascarpone|quark|fet+a|mozzarella|bocconcini|paneer|hal+oumi|blue|roquefort|stilton|dolcelatte|brie|camembert|goats?|spreadable|process(ed)?|pasteurized|head cheese|cauliflower|queso|neufchatel|gjetost|grated|shredded|sliced|rind|alternative|white|american|blend|reduced|low|fat free|nonfat|half fat|less fat|sage)\b/ },
  bread: { yes: /^bread\b/, no: /\b(fruit(ed)?|raisin|cinnamon|banana|zucchini|pumpkin|sweet potato|nut|onion|garlic|brioche|pitta|pita|puri|pan dulce|coffee|dough|boston|damper|vegetable|potato|toasted|soda|cuban|native)\b/ },
  pizza: { yes: /\b(cheese|tomato|margherita)\b/, no: /\b(dessert|mexican|white pizza|no cheese|fish|gluten-free|school|chicken|ham|pineapple|supreme|pepperoni|meat|sausage|vegetable)\b/ },
  almonds: { yes: /^(nuts, )?almonds?\b/, no: /\b(chicken|butter|oil|paste|milk|flour|meal|extract)\b/ },
  fried_egg: { yes: /\begg\b/, no: /\beggplant\b/ },
  chocolate_bar: { yes: /\bchocolate\b/, no: /\b(white|liquid|cooking|compound|baking|mexican)\b/ },
  cherries: { yes: /\b(raw|fresh|sweet|sour)\b/, no: /\b(dried|maraschino|glace|candied|canned|west indian|acerola)\b/ },
  popcorn: { yes: /./, no: /\b(caramel|kettle|cheese|chocolate)\b/ },
  doughnut: { yes: /./, no: /\b(custard|jelly|jam|cream|crullers?|filled|chocolate)\b/ },
  hot_dog: { yes: /\bbun\b/, no: /\bno bun\b/ },
  tofu: { yes: /^tofu\b/, no: /\b(fried|mapo|sauce|skin)\b/ },
  glass_of_milk: { yes: /^milk\b/, no: /\b(malted|fermented|soy|soya|almond|oat|rice|coconut|goat|shake|chocolate|evaporated|condensed|powder|dried|dry|buttermilk|human)\b/ },
};
const onlyOk = (key: string, n: string) => { const o = ONLY[key]; return !o || (o.yes.test(n) && !o.no?.test(n)); };

/** Which photo a food uses, or undefined for a plain tile. Only when we're sure it shows this food. */
export function photoKeyFor(name: string, category?: string): string | undefined {
  const n = name.toLowerCase();
  if (BRANDED.test(name) || /\b(fast foods?|restaurant|breaded|breading|nuggets?|sandwich(es)?|burger|luncheon|deli|baby food|infant|as ingredient)\b/.test(n)) return undefined;
  const plain = !NOT_PLAIN.test(n.replace(NOTES, ' '));
  // The food's main name: "Bread, wheat" → "bread"; "Jollof rice (party jollof)" → "jollof rice".
  const main = n.split(/[,(:*]/)[0].trim();
  for (const [re, key] of DISH_RULES) {
    if (PLAIN_DISHES.has(key)) { if (re.test(n)) return plain && (re.test(main) || PLAIN_HEADS.test(main)) && onlyOk(key, n) ? key : undefined; continue; }
    // Named dishes: only when the dish is the food itself, not "fufu of plantain with palm oil".
    if (re.test(main)) return / of | with |\*/.test(n.split('(')[0]) || !onlyOk(key, n) ? undefined : key;
  }
  if (!plain) return undefined;
  const art = artFor(name, category);
  if (art === 'fork_and_knife_with_plate') return undefined;
  // The main word must be what the photo shows: "White fish" → fish, but "Lemon sole", "Bitter gourd",
  // "Corn nuts" or "Plantains" don't borrow the lemon, melon, corn or banana photo.
  if (FALSE_FRIENDS.test(main)) return undefined;
  const head = main.split(/\s+/).pop() ?? '';
  const must = photoMust(art);
  return must.some((w) => new RegExp(`^${w}(e?s)?$`).test(head)) && onlyOk(art, n) ? art : undefined;
}

export interface FoodPhoto { url: string; author: string | null; authorUrl: string | null; page: string | null; color: string | null }

// Photos are asked for in small batches (all the foods on screen at once) and remembered on the
// phone for a week, so scrolling a list costs one request, not one per food.
const KEY = 'nutivili-photos-v4';
const WEEK = 7 * 864e5;
type Cached = { p: FoodPhoto | null; t: number };
let cache: Record<string, Cached> = {};
try { cache = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* storage blocked */ }
const listeners = new Map<string, Set<() => void>>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
const inFlight = new Set<string>();

function save() { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* full or blocked */ } }
function flush() {
  timer = undefined;
  const keys = [...queue].filter((k) => !inFlight.has(k)).slice(0, 40);
  queue = new Set();
  if (!keys.length) return;
  keys.forEach((k) => inFlight.add(k));
  fetch(`/api/photos?keys=${encodeURIComponent(keys.join(','))}`)
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : { photos: {} }))
    .then((d: { photos?: Record<string, FoodPhoto | null>; pending?: boolean }) => {
      const now = Date.now();
      for (const k of keys) {
        if (k in (d.photos ?? {})) cache[k] = { p: d.photos![k], t: now };
        // Not looked up yet (the server finds a few at a time): ask again soon.
        else cache[k] = { p: null, t: now - WEEK + 60_000 };
        listeners.get(k)?.forEach((f) => f());
      }
      save();
    })
    .catch(() => undefined)
    .finally(() => keys.forEach((k) => inFlight.delete(k)));
}

export function photoFor(key: string | undefined): FoodPhoto | null | undefined {
  if (!key) return null;
  const c = cache[key];
  if (c && Date.now() - c.t < WEEK) return c.p;
  queue.add(key);
  if (!timer) timer = setTimeout(flush, 60);
  return c?.p ?? undefined;
}

export function subscribePhoto(key: string, f: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(f);
  return () => { listeners.get(key)?.delete(f); };
}

/** An Unsplash image at the size it's shown (their CDN resizes and crops). */
/** Unsplash resizes on request; other hosts (Wikimedia, Flickr) get their own fixed-size file as is. */
export const sizedPhoto = (url: string, px: number) => (/^https:\/\/images\.unsplash\.com\//.test(url) ? `${url}${url.includes('?') ? '&' : '?'}w=${px}&h=${px}&fit=crop&crop=entropy&auto=format&q=70` : url);
