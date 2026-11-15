import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadFoodDb, searchFoods } from './foods';

beforeAll(async () => {
  const json = JSON.parse(readFileSync('public/data/foods.json', 'utf8'));
  (globalThis as { fetch: unknown }).fetch = async () => ({ ok: true, json: async () => json });
  await loadFoodDb();
}, 30_000);

const DISHES = 'jollof|fried rice|ogbono|banga|ofada|asaro|yam porridge|beans porridge|ewa agoyin|gizdodo|asun|nkwobi|abacha|edikang|afang|banku|kenkey|fufu|kelewele|red red|shito|groundnut soup|peanut soup|light soup|palm nut soup|kontomire|yassa|thieboudienne|mafe|attieke|alloco|chakalaka|bobotie|biltong|bunny chow|boerewors|pap|nyama choma|pilau|mandazi|chapati|matoke|githeri|irio|samosa|injera|doro wat|shiro|kitfo|tibs|tagine|harira|couscous|shakshuka|koshari|ful medames|falafel|hummus|baba ganoush|tabbouleh|fattoush|shawarma|kebab|kofta|mansaf|kabsa|biryani|butter chicken|tikka|korma|vindaloo|rogan josh|palak paneer|paneer|chana masala|rajma|dal|dosa|idli|sambar|paratha|naan|roti|pakora|bhaji|haleem|nihari|karahi|pulao|momo|fried noodles|chow mein|lo mein|kung pao|sweet and sour|mapo tofu|dim sum|dumpling|bao|congee|peking duck|char siu|wonton|spring roll|pho|banh mi|bun cha|pad thai|green curry|red curry|massaman|tom yum|som tam|larb|nasi goreng|nasi lemak|rendang|satay|laksa|adobo|sinigang|lechon|pancit|lumpia|sushi|ramen|udon|soba|tempura|teriyaki|katsu|donburi|onigiri|miso soup|gyoza|okonomiyaki|bibimbap|bulgogi|kimchi|japchae|tteokbokki|kimbap|galbi|jerk|rice and peas|ackee|callaloo|doubles|curry goat|oxtail|festival|bammy|escovitch|pelau|griot|mofongo|arepa|empanada|tacos|burrito|enchilada|quesadilla|tamale|pozole|mole|chilaquiles|guacamole|feijoada|pao de queijo|moqueca|ceviche|lomo saltado|asado|chimichurri|paella|tortilla espanola|gazpacho|patatas bravas|pizza|lasagna|carbonara|bolognese|risotto|gnocchi|ravioli|minestrone|moussaka|souvlaki|gyro|spanakopita|pierogi|borscht|goulash|schnitzel|bratwurst|sauerkraut|fondue|crepe|croissant|ratatouille|coq au vin|bouillabaisse|quiche|fish and chips|full english|shepherd|cottage pie|sunday roast|yorkshire pudding|bangers|toad in the hole|cornish pasty|sausage roll|scotch egg|haggis|black pudding|baked beans|jacket potato|chicken tikka masala|ploughman|eton mess|sticky toffee|crumpet|scone|porridge|bagel|pancakes|waffles|mac and cheese|burger|hot dog|fried chicken|bbq ribs|meatloaf|chili con carne|clam chowder|caesar salad|poke|smoothie bowl'.split('|');

it('finds the large majority of popular world dishes', () => {
  const missing = DISHES.filter((d) => searchFoods(d, { limit: 1 }).length === 0);
  // Report what's still missing so it can be added (never silently).
  console.log(`${DISHES.length - missing.length}/${DISHES.length} world dishes found. Missing: ${missing.join(', ')}`);
  expect(missing.length / DISHES.length).toBeLessThan(0.1);
});

it('keeps the food database small enough for the offline cache (or the production build fails)', async () => {
  const { statSync } = await import('node:fs');
  const limit = Number(/maximumFileSizeToCacheInBytes:\s*(\d+)\s*\*\s*1024\s*\*\s*1024/.exec(readFileSync('vite.config.ts', 'utf8'))?.[1]) * 1024 * 1024;
  expect(limit).toBeGreaterThan(0);
  expect(statSync('public/data/foods.json').size).toBeLessThan(limit);
});
