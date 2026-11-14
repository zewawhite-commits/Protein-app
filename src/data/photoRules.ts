/**
 * Which stock photo (src/data/photoLibrary.ts) best illustrates a food, judged from its name.
 * Only used as an illustration — never to identify a food or its nutrients.
 * Order matters: specific dishes first, then general foods.
 */
import { PHOTO_LIBRARY } from './photoLibrary';

const DISHES: [RegExp, string][] = [
  [/\bjollof\b/, 'jollof'],
  [/\bmoi[- ]?moi|\bmoin[- ]?moin|bean pudding/, 'moimoi'],
  [/\bakara\b|\bkosai\b|bean (fritter|cake)s?/, 'akara'],
  [/\begusi\b|melon seed soup/, 'egusi'],
  [/\bsuya\b|\bkebabs?\b|\bskewers?\b|\bbrochettes?\b/, 'suya'],
  [/pounded yam|\bfufu\b|\biyan\b|\bfoufou\b/, 'poundedyam'],
  [/\beba\b|\bgarri\b|\bgari\b/, 'eba'],
  [/fried rice/, 'friedrice'],
  [/\bokra\b|\bokro\b|\bgumbo\b/, 'okra'],
  [/pepper ?soup/, 'peppersoup'],
];

/** Things that are ingredients or extracts rather than the food itself. */
const NOT_THE_FOOD = /\b(broth|stock|bouillon|oil|fat|gravy|baby|babyfood|infant|flour|starch|sauce|seasoning|extract|powder(?! protein)|dehydrated|substitute|imitation|flavou?red? drink)\b/;

const FOODS: [RegExp, string][] = [
  [/protein (shake|powder|bar)|\bwhey\b|\bsmoothie/, 'shake'],
  [/plantains?\b|\bdodo\b|\balloco\b/, 'plantain'],
  [/sweet ?potato/, 'sweetpotato'],
  [/^yams?\b|\byams?\b/, 'yam'],
  [/\btilapia\b/, 'tilapia'],
  [/\bgoat\b/, 'goat'],
  [/\bsalmon\b/, 'salmon'],
  [/\btuna\b/, 'tuna'],
  [/\bsardines?\b/, 'sardine'],
  [/\bshrimps?\b|\bprawns?\b/, 'shrimp'],
  [/^fish\b|\b(catfish|mackerel|cod|croaker|herring|haddock|trout|snapper|hake|pollock)\b/, 'fish'],
  [/burger/, 'burger'],
  [/\bpizza\b/, 'pizza'],
  [/^chicken\b|\bchicken (breast|thigh|leg|wing|drumstick)/, 'chicken'],
  [/^turkey\b/, 'turkey'],
  [/\bsausages?\b|frankfurter|hot ?dog/, 'sausage'],
  [/^pork\b|pork chop/, 'pork'],
  [/^beef\b|\bsteak\b|\bbeef (steak|stew)/, 'beef'],
  [/^eggs?\b|\begg, whole|\bomelet|scrambled egg|boiled egg/, 'eggs'],
  [/cottage cheese/, 'cottage'],
  [/yogh?urt/, 'yogurt'],
  [/^cheese\b|\bcheese, (cheddar|mozzarella|swiss|parmesan|gouda|feta)/, 'cheese'],
  [/^milk\b/, 'milk'],
  [/\bspaghetti|\bmacaroni|\bpasta\b|\bnoodles?\b/, 'pasta'],
  [/^rice\b|\brice, (white|brown)|\bwhite rice|\bbrown rice/, 'rice'],
  [/^bread\b|\bbread, |\btoast\b/, 'bread'],
  [/\boat(s|meal)?\b|\bporridge, oat/, 'oats'],
  [/\blentils?\b/, 'lentils'],
  [/chickpeas?|garbanzo|\bhummus\b/, 'chickpeas'],
  [/\btofu\b/, 'tofu'],
  [/\bpeanuts?\b|\bgroundnuts?\b/, 'peanuts'],
  [/^beans?\b|\bbeans?, |cowpeas?\b|black-eyed peas|\bkidney beans|\bewa\b/, 'beans'],
  [/\balmonds?\b|\bcashews?\b|\bwalnuts?\b|\bmixed nuts\b/, 'almonds'],
  [/^potato(es)?\b|\bpotato(es)?, /, 'potato'],
  [/^bananas?\b/, 'banana'],
  [/^apples?\b/, 'apple'],
  [/^oranges?\b/, 'orange'],
  [/^avocados?\b/, 'avocado'],
  [/^spinach\b|\bspinach, /, 'spinach'],
  [/^broccoli\b/, 'broccoli'],
  [/\bsalad\b/, 'salad'],
];

export function photoKeyFor(name: string): string | undefined {
  const n = name.toLowerCase();
  for (const [re, key] of DISHES) if (re.test(n) && PHOTO_LIBRARY[key]) return key;
  if (NOT_THE_FOOD.test(n)) return undefined;
  for (const [re, key] of FOODS) if (re.test(n) && PHOTO_LIBRARY[key]) return key;
  return undefined;
}
