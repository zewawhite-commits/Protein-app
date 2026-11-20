/**
 * Real food photos (Wikimedia Commons, free licences), shown instead of the illustration
 * when we have a good one. Credits for every photo are listed on the Photo credits page.
 *
 * A food gets a photo by its dish (e.g. "Amala"), or else by its illustration key
 * (e.g. every banana record shares the banana photo).
 */
import { artFor } from './foodArt';
import { PHOTOS } from './foodPhotos.gen';
export { PHOTOS };

/** Dishes with a photo of their own, checked before the general illustration key. */
const DISH_RULES: [RegExp, string][] = [
  [/\bjollof/, 'jollof'], [/\bfried rice\b/, 'fried_rice'], [/\begusi|\begushi/, 'egusi'], [/\bpounded yam|\bpoundo|\biyan\b/, 'pounded_yam'],
  [/\bamala/, 'amala'], [/\beba\b|gari swallow/, 'eba'], [/\bfufu|\bakpu\b|\bfoufou/, 'fufu'], [/\bsemovita|\bsemo\b|semolina (swallow|fufu)/, 'semovita'],
  [/\btuwo/, 'tuwo'], [/\bbanku/, 'banku'], [/\bkenkey/, 'kenkey'], [/\bugali|\bnsima|\bsadza/, 'ugali'], [/\binjera/, 'injera'],
  [/\bsuya\b|\bkilishi/, 'suya'], [/\bmoi ?moi|\bmoin|bean pudding/, 'moi_moi'], [/\bakara\b|\baccara|bean fritter/, 'akara'],
  [/\bpuff[- ]?puff|\bbofrot/, 'puff_puff'], [/\bchin ?chin/, 'chin_chin'], [/\befo riro|\befo\b/, 'efo_riro'], [/\bokra soup|\bokro soup/, 'okra_soup'],
  [/\bogbono|draw soup/, 'ogbono'], [/pepper ?soup/, 'pepper_soup'], [/\bbanga/, 'banga'], [/\bafang|\bokazi/, 'afang'], [/edikang/, 'edikang_ikong'],
  [/\bofada/, 'ofada'], [/\babacha|african salad/, 'abacha'], [/\bzobo|\bsobolo|\bbissap/, 'zobo'], [/\bwaakye/, 'waakye'], [/\bkelewele/, 'kelewele'],
  [/\bmasa\b|\bwaina/, 'masa'], [/\bboli\b|roasted plantain/, 'boli'], [/\bkuli ?kuli/, 'kuli_kuli'], [/\bshawarma/, 'shawarma'], [/\bmeat pie/, 'meat_pie'],
  [/beans porridge|\bewa riro/, 'beans_porridge'], [/yam porridge|\basaro|yam pottage/, 'yam_porridge'], [/ewa agoyin/, 'ewa_agoyin'], [/\basun\b/, 'asun'],
  [/\bsnail/, 'peppered_snail'], [/\bthieboudienne|\bjollof fish/, 'thieboudienne'], [/groundnut soup|peanut soup|\bmafe\b/, 'groundnut_soup'],
  [/\bogi\b|\bpap\b|\bakamu|\bkoko\b/, 'pap'], [/agege bread/, 'agege_bread'], [/\bdodo\b|plantain, (cooked|fried|ripe.*fried)|fried plantain|\balloco/, 'plantain'],
  [/^yam\b|\byam, (cooked|boiled|tuber)/, 'yam'], [/\boats?\b|\boatmeal|\bporridge, oat/, 'oats'], [/\byogh?urt/, 'yogurt'], [/\btofu\b/, 'tofu'],
];

/** The photo for a food, or undefined to show the illustration. */
export function photoFor(name: string, category?: string): string | undefined {
  const n = name.toLowerCase();
  for (const [re, key] of DISH_RULES) if (re.test(n) && PHOTOS[key]) return `/food-photos/${key}.jpg`;
  const art = artFor(name, category);
  return art !== 'fork_and_knife_with_plate' && PHOTOS[art] ? `/food-photos/${art}.jpg` : undefined;
}
