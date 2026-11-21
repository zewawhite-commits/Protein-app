/**
 * Voice question sweep: for 100 everyday foods, what the app asks and how many grams "one" means.
 * Opt-in audit: VOICE_SWEEP=1 npx vitest run scripts/voice-sweep.test.ts → docs/voice-sweep.md
 */
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { loadFoodDb, searchFoods } from '../src/lib/foods';
import { gramsFor, parseAmount, questionFor } from '../src/lib/describe';

const FOODS = ['chocolate cake', 'cake', 'cheesecake', 'muffin', 'croissant', 'bagel', 'white bread', 'toast', 'pancakes', 'waffle', 'doughnut', 'cookie', 'apple pie', 'banana', 'apple', 'orange', 'mango', 'grapes', 'strawberries', 'watermelon', 'pineapple', 'avocado', 'boiled egg', 'fried egg', 'scrambled eggs', 'omelette', 'bacon', 'sausage', 'chicken breast', 'chicken wings', 'steak', 'burger', 'cheeseburger', 'pizza', 'hot dog', 'french fries', 'salmon', 'tuna', 'rice', 'pasta', 'spaghetti bolognese', 'noodles', 'oatmeal', 'cereal', 'granola', 'yogurt', 'milk', 'coffee', 'tea', 'orange juice', 'coke', 'beer', 'wine', 'protein shake', 'peanut butter', 'butter', 'olive oil', 'honey', 'sugar', 'cheese', 'almonds', 'chocolate bar', 'crisps', 'popcorn', 'ice cream', 'salad', 'soup', 'sushi', 'ramen', 'curry', 'naan', 'samosa', 'dal', 'biryani', 'fried rice', 'dumplings', 'tacos', 'burrito', 'quesadilla', 'hummus', 'falafel', 'shawarma', 'kebab', 'jollof rice', 'egusi soup', 'eba', 'pounded yam', 'moi moi', 'akara', 'puff puff', 'suya', 'plantain', 'beans', 'yam', 'chin chin', 'meat pie', 'indomie', 'garri', 'zobo', 'malt'];

it.skipIf(!process.env.VOICE_SWEEP)('voice questions for 100 foods', async () => {
  (globalThis as unknown as { fetch: unknown }).fetch = async () => new Response(readFileSync('public/data/foods.json', 'utf8'));
  await loadFoodDb();
  const rows: string[] = ['| Said | Food found | Question | "one" = | Check |', '|---|---|---|---|---|'];
  let bad = 0;
  for (const said of FOODS) {
    const f = searchFoods(said, {})[0];
    if (!f) { rows.push(`| ${said} | NOT FOUND | | | ✗ |`); bad++; continue; }
    const { q, unit } = questionFor(f, said);
    const a = parseAmount('one');
    const g = a.qty == null ? null : gramsFor(f, a.qty, a.unit ?? unit, a.size)?.grams ?? null;
    const odd = !q || g == null || g < 1 || g > 900 || (/cake|bread|toast|pie|cookie|muffin|croissant|bagel|egg|banana|apple|orange/.test(said) && /bowl|plate|ladle|wrap/i.test(q));
    if (odd) bad++;
    rows.push(`| ${said} | ${f.name.slice(0, 45)} | ${q.replace(/\|/g, '/')} | ${g == null ? '—' : `${Math.round(g)} g`} | ${odd ? '✗' : '✓'} |`);
  }
  writeFileSync('docs/voice-sweep.md', ['# Voice question sweep', '', `${FOODS.length - bad} of ${FOODS.length} look right.`, '', ...rows, ''].join('\n'));
  console.log(rows.join('\n'));
  console.log(FOODS.length - bad, '/', FOODS.length);
}, 120000);
