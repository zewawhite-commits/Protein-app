/**
 * Picks an illustration for every food, chosen from the food's name (and category as a
 * fallback). Illustration only — never used to identify a food or its nutrients.
 * Keys are file names in public/food: Microsoft's Fluent Emoji (flat style, MIT licence,
 * see public/food/LICENSE.txt), so the art is consistent, colourful and hand-made.
 */
type Rule = [RegExp, string];

/** Specific dishes first, then foods, then broad groups. */
const RULES: Rule[] = [
  // Dishes from around the world
  [/\bsushi|\bmaki\b|\bnigiri|onigiri/, 'sushi'],
  [/\bjollof|\bpaella|fried rice|\bpilau|\bpilaf|\bbiryani|\brisotto/, 'shallow_pan_of_food'],
  [/\bcurry|\bdal\b|\bdhal|\bkorma|\bmasala/, 'curry_rice'],
  [/\bramen|\bpho\b|\budon|\bsoba|noodle soup|\blaksa/, 'steaming_bowl'],
  [/\bspaghetti|\bpasta\b|\bmacaroni|\blasagn|\bnoodles?\b|\bpenne|\bfettuccin|\bpad thai|\bchow mein|\blo mein/, 'spaghetti'],
  [/\btaco|\bnachos?\b/, 'taco'],
  [/\bburrito|\bwrap\b|\bshawarma|\bquesadilla|\benchilada|\bfajita/, 'burrito'],
  [/burger/, 'hamburger'],
  [/\bpizza/, 'pizza'],
  [/\bhot ?dog|frankfurter/, 'hot_dog'],
  [/\bsandwich|\bsub\b|\bpanini|\bblt\b/, 'sandwich'],
  [/\bfalafel|\bakara|\bkosai|bean (fritter|cake)s?|\bpuff[- ]?puff/, 'falafel'],
  [/\bdumplings?|\bgyoza|\bpierogi|\bempanada|\bsamosa|\bmomo\b|\bwonton/, 'dumpling'],
  [/\bsuya\b|\bkebabs?\b|\bskewers?\b|\bsatay|\byakitori|\bbrochettes?/, 'oden'],
  [/\btamale/, 'tamale'],
  [/\bhummus|\bgyro|\bpita\b|stuffed flatbread/, 'stuffed_flatbread'],
  [/\binjera|\bchapati|\broti\b|\bnaan|\btortilla|\bflatbread|\bparatha|\barepa/, 'flatbread'],
  [/\bsoup|\bstew|\begusi|\bokra|\bokro|\bgumbo|\bchili\b|\bchilli|\bborscht|pepper ?soup|\bbroth|\bcasserole|\btagine|\bogbono|\bewedu|\bgbegiri|\bnsala|\bmiyan|\bofe\b|\bbanga|\bafang|\bsauce, |\bgoulash/, 'pot_of_food'],
  [/pounded yam|poundo|\bamala|\bsemovita|\bsemo\b|\btuwo|\bswallow|\bstarch \(urhobo|cocoyam fufu|\bfufu|\bfoufou|\beba\b|\bgarri|\bgari\b|\bbanku|\bugali|\bnsima|\bsadza|\bporridge|\boatmeal|\boats?\b|\bgrits|\bcongee|\bmuesli|\bgranola|\bcereal/, 'bowl_with_spoon'],
  [/\bsalad|\bcoleslaw/, 'green_salad'],
  [/\bbento|\bbibimbap|\bpoke\b|rice bowl|burrito bowl/, 'bento_box'],
  [/\bmoi[- ]?moi|\bmoin[- ]?moin|bean pudding|\bbeans?\b|\bcowpeas?|black-eyed|\blentils?|\bchickpeas?|\bgarbanzo|\bedamame|\bsoy ?beans?|\btofu|\btempeh/, 'beans'],
  // Oils and fats (before vegetables: "vegetable oil" isn't a vegetable)
  [/\boils?\b|\blard\b|\bshortening/, 'olive'],
  // Proteins
  [/protein (shake|powder|bar)|\bwhey\b|\bsmoothie|\bmilkshake/, 'cup_with_straw'],
  [/\beggs?\b|\bomelet|\bfrittata/, 'egg'],
  [/fried egg|scrambled/, 'cooking'],
  [/\bbacon/, 'bacon'],
  [/\bchicken|\bturkey|\bduck|\bpoultry|\bhen\b|\bquail|\bguinea fowl/, 'poultry_leg'],
  [/\bribs?\b|\blamb chop|\bgoat\b|\bmutton/, 'meat_on_bone'],
  [/\bbeef|\bsteak|\bpork|\blamb\b|\bveal|\bvenison|\bmeat\b|\bham\b|\bsausage|\bmince|\bground (beef|pork|lamb|turkey)/, 'cut_of_meat'],
  [/\bshrimps?|\bprawns?|\bcrayfish/, 'shrimp'],
  [/\blobster/, 'lobster'],
  [/\bcrab/, 'crab'],
  [/\bsquid|\bcalamari|\boctopus/, 'squid'],
  [/\boysters?|\bmussels?|\bclams?|\bscallops?|\bsnails?|\bwhelk/, 'oyster'],
  [/\bfish|\bsalmon|\btuna|\bcod\b|\bsardines?|\bmackerel|\btilapia|\bherring|\btrout|\bhake|\bhaddock|\bsnapper|\bcatfish|\bcroaker|\banchov|\bpollock|\bstockfish/, 'fish'],
  [/canned|tinned/, 'canned_food'],
  // Dairy
  [/\bcheese/, 'cheese_wedge'],
  [/\byogh?urt|\bkefir|\bskyr|\blabneh/, 'bowl_with_spoon'],
  [/\bmilk\b|\bmilk,|\bsoymilk|\boat milk|almond milk/, 'glass_of_milk'],
  [/\bbutter\b|\bmargarine|\bghee/, 'butter'],
  [/\bice cream|\bgelato|\bfrozen yogurt/, 'soft_ice_cream'],
  // Grains & bakery
  [/\brice\b/, 'cooked_rice'],
  [/\bbagel/, 'bagel'],
  [/\bcroissant|\bpastry|\bdanish/, 'croissant'],
  [/\bbaguette|\bfrench bread/, 'baguette_bread'],
  [/\bpancakes?|\bcrepes?|\bflapjack/, 'pancakes'],
  [/\bwaffle/, 'waffle'],
  [/\bpretzel/, 'pretzel'],
  [/\bbread|\btoast|\bbuns?\b|\brolls?\b|\bbrioche|\bmuffin, english/, 'bread'],
  [/\bpopcorn/, 'popcorn'],
  [/\bcrackers?|\brice cake/, 'rice_cracker'],
  // Fruit
  [/\bplantains?|\bdodo\b|\bbananas?/, 'banana'],
  [/\bgreen apple|\bgranny smith/, 'green_apple'],
  [/\bapples?\b|\bapplesauce/, 'red_apple'],
  [/\boranges?\b|\btangerines?|\bmandarins?|\bclementines?|\bsatsuma/, 'tangerine'],
  [/\blemons?\b|\blimes?\b/, 'lemon'],
  [/\bgrapes?\b|\braisins?/, 'grapes'],
  [/\bstrawberr/, 'strawberry'],
  [/\bblueberr|\bblackberr|\braspberr|\bberries/, 'blueberries'],
  [/\bwatermelon/, 'watermelon'],
  [/\bmelon|\bcantaloupe|\bhoneydew/, 'melon'],
  [/\bpineapple/, 'pineapple'],
  [/\bmangos?|\bmangoes/, 'mango'],
  [/\bpeach|\bnectarine|\bapricot/, 'peach'],
  [/\bpears?\b/, 'pear'],
  [/\bcherr/, 'cherries'],
  [/\bkiwi/, 'kiwi_fruit'],
  [/\bcoconut/, 'coconut'],
  [/\bavocado|\bguacamole/, 'avocado'],
  [/\bolives?\b/, 'olive'],
  // Vegetables
  [/\bsweet potato|\byams?\b|\bcassava|\btaro|\bcocoyam/, 'roasted_sweet_potato'],
  [/french fries|\bchips\b|\bfries\b/, 'french_fries'],
  [/\bpotato/, 'potato'],
  [/\btomato/, 'tomato'],
  [/\bcarrot/, 'carrot'],
  [/\bcorn\b|\bmaize|\bsweetcorn/, 'ear_of_corn'],
  [/\bbroccoli|\bcauliflower/, 'broccoli'],
  [/\bspinach|\bkale\b|\blettuce|\bcabbage|\bcollard|\bgreens\b|\bugu\b|\bbitter ?leaf|\bamaranth|\bleaves/, 'leafy_green'],
  [/\bcucumber|\bzucchini|\bcourgette/, 'cucumber'],
  [/\bhot pepper|\bchil(i|e)\b|\bjalape/, 'hot_pepper'],
  [/\bpeppers?\b|\bpaprika/, 'bell_pepper'],
  [/\bonions?\b|\bshallots?|\bleeks?/, 'onion'],
  [/\bgarlic/, 'garlic'],
  [/\bginger/, 'ginger_root'],
  [/\bmushroom/, 'mushroom'],
  [/\bpeas?\b|\bgreen beans|\bsnap beans|\bokra\b/, 'pea_pod'],
  // Nuts & seeds
  [/\bpeanuts?|\bgroundnuts?/, 'peanuts'],
  [/\balmonds?|\bcashews?|\bwalnuts?|\bpistachio|\bhazelnut|\bpecans?|\bnuts?\b|\bchestnut|\bseeds?\b/, 'chestnut'],
  // Sweets & drinks
  [/\bchocolate/, 'chocolate_bar'],
  [/\bcookies?|\bbiscuits?/, 'cookie'],
  [/\bdoughnut|\bdonut/, 'doughnut'],
  [/\bcupcake|\bmuffin/, 'cupcake'],
  [/\bcake\b|\bcheesecake|\bshortcake/, 'shortcake'],
  [/\bpie\b|\btart\b/, 'pie'],
  [/\bcand(y|ies)|\bsweets\b|\bgumm/, 'candy'],
  [/\bhoney|\bsyrup|\bjam\b/, 'honey_pot'],
  [/\bcoffee|\blatte|\bespresso|\bcappuccino|\bcocoa\b|hot chocolate/, 'hot_beverage'],
  [/\btea\b|\bmatcha/, 'teacup_without_handle'],
  [/bubble tea|\bboba/, 'bubble_tea'],
  [/\bbeer|\blager|\bale\b|\bstout/, 'beer_mug'],
  [/\bwine/, 'wine_glass'],
  [/\bcocktail|\bspirits?\b|\bvodka|\bwhisk|\bgin\b|\brum\b/, 'cocktail_glass'],
  [/\bjuice|\bsoda\b|\bsoft drink|\bcola\b|\bdrink|\bbeverage|\bwater\b/, 'beverage_box'],
  [/\bsalt\b|\bseasoning|\bspice|\ballspice|\bcinnamon|\bcumin|\bturmeric|\bnutmeg|\bpepper, black|\bcurry powder|\bvanilla/, 'salt'],
  [/\bsauce|\bketchup|\bdressing|\bmayonnaise|\bmayo\b|\bdip\b|\bsalsa|\bmustard|\bvinegar|\brelish|\bpickle|\bspread\b|\bgravy/, 'jar'],
  [/\bbrandy|\bliqueur|\bmartini|\bmargarita|\bmojito|\bdaiquiri|\bbloody mary|\bblack russian|\bwhite russian|\bsangria|\bpunch\b/, 'cocktail_glass'],
  [/\bsweetener|\bsugar\b|\bagave|\bmolasses|\btreacle/, 'honey_pot'],
  [/\bdessert|\bpudding|\bbarfi|\bburfi|\bhalwa|\bmochi|\bflan\b|\bmousse|\btiramisu|\bbaklava|\bjelly|\bgelatin/, 'custard'],
  [/\bcream\b|\bcreamer|\beggnog|\bdulce de leche|\bcustard|\bcr[eè]me br[uû]l[eé]e/, 'glass_of_milk'],
  [/\bcelery|\bchives|\beggplant|\baubergine|\basparagus|\bartichoke|\bbeets?\b|\bbeetroot|\bradish|\bturnip|\bsquash|\bpumpkin|\bvegetables?\b/, 'leafy_green'],
  [/\bcranberr|\bguava|\bpapaya|\bfig\b|\bfigs\b|\bdates?\b|\bplums?\b|\bprunes?|\bpomegranate|\bpassion fruit|\blychee|\bfruit/, 'grapes'],
  [/\bchutney|\bpaste\b/, 'jar'],
  [/\bhash browns?|\btater tots?/, 'french_fries'],
  [/\bcroutons?|\bstuffing/, 'bread'],
  [/\bchilaquiles|\bnachos/, 'taco'],
  [/\bfreezer pop|\bpopsicle|\bice pop|\bsorbet/, 'soft_ice_cream'],
  [/\bgimlet|\bgreyhound|\bfuzzy navel|\bglug|\bmulled|\bhighball|\bcollins|\bsour\b/, 'cocktail_glass'],
  [/\bsticks?\b|\bnuggets?|\bbites\b|\bfritters?|\bspring rolls?|\begg rolls?/, 'falafel'],
  [/\bherbs?\b|\bbasil|\bparsley|\bcoriander|\bcilantro|\bmint\b/, 'herb'],
];

/** Broad category fallbacks (USDA / FNDDS / FAO group names). */
const CATEGORY_RULES: Rule[] = [
  [/poultry|chicken|turkey/i, 'poultry_leg'],
  [/fish|seafood|shellfish/i, 'fish'],
  [/beef|pork|lamb|meat|sausage|game/i, 'cut_of_meat'],
  [/egg/i, 'egg'],
  [/cheese/i, 'cheese_wedge'],
  [/milk|dairy|yogurt/i, 'glass_of_milk'],
  [/soup|sauce|gravy|stew/i, 'pot_of_food'],
  [/rice/i, 'cooked_rice'],
  [/pasta|noodle/i, 'spaghetti'],
  [/bread|baked|tortilla/i, 'bread'],
  [/cereal|grain/i, 'bowl_with_spoon'],
  [/legume|bean|pulse/i, 'beans'],
  [/nut|seed/i, 'chestnut'],
  [/fruit/i, 'red_apple'],
  [/vegetable|starchy|root|tuber/i, 'carrot'],
  [/fast food|burger|pizza|sandwich/i, 'hamburger'],
  [/sweet|dessert|cake|cookie|candy|snack/i, 'cookie'],
  [/coffee|tea/i, 'hot_beverage'],
  [/alcohol|beer|wine/i, 'wine_glass'],
  [/beverage|drink|juice|water/i, 'beverage_box'],
  [/fat|oil/i, 'olive'],
  [/spice|herb/i, 'herb'],
  [/meal|entree|dish|mixed/i, 'fork_and_knife_with_plate'],
];

/** Icon key for a food. Always returns something. */
export function artFor(name: string, category?: string): string {
  const n = name.toLowerCase();
  for (const [re, art] of RULES) if (re.test(n)) return art;
  if (category) for (const [re, art] of CATEGORY_RULES) if (re.test(category)) return art;
  return 'fork_and_knife_with_plate';
}

const KEYS = new Set<string>(['fork_and_knife_with_plate', ...RULES.map(([, k]) => k), ...CATEGORY_RULES.map(([, k]) => k)]);

/** Web address of an illustration (served from public/food, cached for offline use). */
export const artUrl = (art: string) => `${import.meta.env.BASE_URL}food/${KEYS.has(art) ? art : 'fork_and_knife_with_plate'}.svg`;
/** Illustration for a food (always returns one). */
export const foodArtUrl = (name: string, category?: string) => artUrl(artFor(name, category));
export const hasIcon = (art: string) => KEYS.has(art);
