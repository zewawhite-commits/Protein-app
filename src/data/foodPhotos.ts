/**
 * Real food photos from Unsplash (found once per food type by /api/photos, shown from
 * Unsplash's own links with the photographer credited on the Photo credits page).
 *
 * A food gets a photo by its dish (e.g. "Amala"), or else by its illustration key
 * (e.g. every banana record shares the banana photo).
 */
import { artFor } from './foodArt';

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

/** Which photo a food uses (a dish of its own, or its food type), or undefined for none. */
export function photoKeyFor(name: string, category?: string): string | undefined {
  const n = name.toLowerCase();
  for (const [re, key] of DISH_RULES) if (re.test(n)) return key;
  const art = artFor(name, category);
  return art === 'fork_and_knife_with_plate' ? undefined : art;
}

export interface FoodPhoto { url: string; author: string | null; authorUrl: string | null; page: string | null; color: string | null }

// Photos are asked for in small batches (all the foods on screen at once) and remembered on the
// phone for a week, so scrolling a list costs one request, not one per food.
const KEY = 'nutivili-photos-v1';
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
