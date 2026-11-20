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
  [/\bchicken\b.*\b(thigh|drumstick|leg)s?\b/, 'chicken_thigh'], [/peanut butter|groundnut (paste|butter)/, 'peanut_butter'], [/cottage cheese/, 'cottage_cheese'],
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
  [/^yam\b|\byam, (cooked|boiled|tuber)/, 'yam'], [/\boats?\b|\boatmeal|\bporridge, oat/, 'oats'], [/\byogh?urt/, 'yogurt'], [/\btofu\b/, 'tofu'],
];

/** Which photo a food uses (a dish of its own, or its food type), or undefined for none. */
// Foods that aren't simply "the food in the photo": mixed dishes, snacks, organ meats, brands…
// They get a plain tile rather than a photo of something else.
const NOT_PLAIN = /\b(with|and|&|sandwich|burger|pounder|pie|pies|soup|stew|curry|salad|sauce|gravy|dip|chips|crisps|crackers?|biscuits?|cookies?|snacks?|pudding|mix|cakes?|nuggets?|fingers?|sticks?|patty|patties|balls?|rolls?|wraps?|frozen|flavou?r(ed)?|baby food|infant|formula|liver|giblets?|gizzards?|hearts?|kidneys?|feet|neck|tongue|tripe|blood|substitute|imitation|powder|extract|juice|drink|spread|fast food|restaurant|caterpillar|insects?|larvae|split|nectar|crumbs?|breadcrumbs|deviled|quiche|cacciatore|beverage|paper|wrapper|fishcakes?|sausages?|separable|bacon bits|croutons?|stuffing|dumplings?|filling|topping|syrup|candied|canned in syrup|dressing|flour|creole|mixed|shake|beverage|beverages|confectionery|cereals?|muffins?|granola|candy|chocolate[- ]coated|covered)\b| or /;
const BRANDED = /\b[A-Z]{3,}\b/;

// These are ordinary foods, so they follow the same "is it plainly this food?" check as everything else.
const PLAIN_DISHES = new Set(['chicken_breast', 'chicken_wings', 'chicken_thigh', 'peanut_butter', 'cottage_cheese', 'almonds', 'salmon', 'tuna', 'scrambled_eggs', 'fried_egg', 'yam', 'oats', 'yogurt', 'tofu', 'plantain']);
// Cooking notes that don't change what the food looks like ("with skin", "fried in oil", "broilers or fryers").
const NOTES = /\b(with|without|in) (added )?(cooking spray|[a-z]+ oil|oil|butter|margarine|animal fat|fat|salt|skin|bone|added solution)\b|\b(meat|skin|bone|flesh) and (skin|bone|meat|fat)\b|broilers? or fryers?|\bns as to [a-z ]+|\bor (raw|cooked|frozen)\b/g;

// "Fish, salmon" / "Nuts, almonds": the main word is the food family, so the rest decides.
const PLAIN_HEADS = /^(fish|chicken|nuts|eggs?|seafood|poultry|beef|meat|spreads?)$/;
// Names whose last word is a different food from what it looks like.
const FALSE_FRIENDS = /^(cocoa|shea|almond|cashew|hazelnut|apple|honey|sunflower|seed|custard|cashew|star|prickly|balsam|mammie|sugar|rose|bitter|kung pao|mapo|atole|potato|banana|bread|sea|sweet corn) |\bnuts?$/;

/** Which photo a food uses, or undefined for a plain tile. Only when we're sure it shows this food. */
export function photoKeyFor(name: string, category?: string): string | undefined {
  const n = name.toLowerCase();
  if (BRANDED.test(name) || /\b(fast foods?|restaurant|breaded|breading|nuggets?|sandwich(es)?|burger|luncheon|deli|baby food|infant|as ingredient)\b/.test(n)) return undefined;
  const plain = !NOT_PLAIN.test(n.replace(NOTES, ' '));
  // The food's main name: "Bread, wheat" → "bread"; "Jollof rice (party jollof)" → "jollof rice".
  const main = n.split(/[,(:*]/)[0].trim();
  for (const [re, key] of DISH_RULES) {
    if (PLAIN_DISHES.has(key)) { if (re.test(n)) return plain && (re.test(main) || PLAIN_HEADS.test(main)) ? key : undefined; continue; }
    // Named dishes: only when the dish is the food itself, not "fufu of plantain with palm oil".
    if (re.test(main)) return / of | with |\*/.test(n.split('(')[0]) ? undefined : key;
  }
  if (!plain) return undefined;
  const art = artFor(name, category);
  if (art === 'fork_and_knife_with_plate') return undefined;
  // The main word must be what the photo shows: "White fish" → fish, but "Lemon sole", "Bitter gourd",
  // "Corn nuts" or "Plantains" don't borrow the lemon, melon, corn or banana photo.
  if (FALSE_FRIENDS.test(main)) return undefined;
  const head = main.split(/\s+/).pop() ?? '';
  const must = photoMust(art);
  return must.some((w) => new RegExp(`^${w}(e?s)?$`).test(head)) ? art : undefined;
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
export const sizedPhoto = (url: string, px: number) => `${url}${url.includes('?') ? '&' : '?'}w=${px}&h=${px}&fit=crop&crop=entropy&auto=format&q=70`;
