/**
 * Global search audit: does the FIRST result match what a person typed? Common, alternative and
 * regional names and spellings across world cuisines. Opt-in (it's an audit, failures are findings):
 *   SEARCH_AUDIT=1 npx vitest run scripts/search-audit.test.ts   → docs/search-audit.json
 */
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { loadFoodDb, searchFoods } from '../src/lib/foods';

const Q: [string, string, RegExp][] = [
  // Africa
  ['Nigeria', 'jollof rice', /jollof/i], ['Nigeria', 'egusi soup', /egusi/i], ['Nigeria', 'pounded yam', /pounded yam/i], ['Nigeria', 'moi moi', /moi moi/i], ['Nigeria', 'suya', /suya/i], ['Nigeria', 'akara', /akara/i], ['Nigeria', 'eba', /^eba/i], ['Nigeria', 'efo riro', /efo/i], ['Nigeria', 'ogbono soup', /ogbono/i], ['Nigeria', 'puff puff', /puff puff/i], ['Nigeria', 'chin chin', /chin chin/i], ['Nigeria', 'zobo', /zobo/i],
  ['Ghana', 'waakye', /waakye/i], ['Ghana', 'banku', /banku/i], ['Ghana', 'kenkey', /kenkey/i], ['Ghana', 'kelewele', /kelewele/i], ['Ghana', 'light soup', /light soup/i], ['Ghana', 'red red', /red red/i],
  ['Kenya', 'ugali', /ugali/i], ['Kenya', 'sukuma wiki', /sukuma|kale|collard/i], ['Kenya', 'chapati', /chapati/i], ['Kenya', 'githeri', /githeri|maize.*beans|beans.*maize/i], ['Kenya', 'nyama choma', /goat|beef|nyama/i], ['Kenya', 'mandazi', /mandazi|puff puff|doughnut/i],
  ['Ethiopia', 'injera', /injera/i], ['Ethiopia', 'doro wat', /doro wat/i], ['Ethiopia', 'shiro', /shiro/i], ['Ethiopia', 'tibs', /tibs|beef/i],
  ['South Africa', 'bobotie', /bobotie/i], ['South Africa', 'pap', /pap|ogi|maize porridge|ugali/i], ['South Africa', 'biltong', /jerky|biltong/i], ['South Africa', 'boerewors', /sausage|boerewors/i], ['South Africa', 'chakalaka', /chakalaka/i],
  ['Egypt', 'koshari', /koshari|kushari/i], ['Egypt', 'ful medames', /ful|fava|broad bean/i], ['Egypt', 'falafel', /falafel/i], ['Egypt', 'molokhia', /molokhia|jute/i],
  // Europe
  ['UK', 'fish and chips', /fish and chips|fish.*chips/i], ['UK', 'baked beans', /baked beans|beans, baked/i], ['UK', 'crumpet', /crumpet/i], ['UK', 'shepherds pie', /shepherd/i], ['UK', 'scone', /scone/i], ['UK', 'porridge', /oats.*cooked|porridge/i], ['UK', 'sausage roll', /sausage roll/i], ['UK', 'yorkshire pudding', /yorkshire/i], ['UK', 'full english breakfast', /english breakfast|bacon|sausage|egg/i],
  ['France', 'croissant', /croissant/i], ['France', 'baguette', /baguette|french bread/i], ['France', 'ratatouille', /ratatouille/i], ['France', 'crepe', /crepe|pancake/i], ['France', 'quiche', /quiche/i],
  ['Italy', 'spaghetti bolognese', /bolognese|spaghetti.*meat|spaghetti/i], ['Italy', 'lasagne', /lasagn/i], ['Italy', 'risotto', /risotto/i], ['Italy', 'pizza margherita', /pizza/i], ['Italy', 'tiramisu', /tiramisu/i], ['Italy', 'mozzarella', /mozzarella/i], ['Italy', 'pesto', /pesto/i],
  ['Spain', 'paella', /paella/i], ['Spain', 'tortilla espanola', /tortilla|omelet|spanish/i], ['Spain', 'gazpacho', /gazpacho/i], ['Spain', 'chorizo', /chorizo/i],
  ['Germany', 'bratwurst', /bratwurst|sausage/i], ['Germany', 'sauerkraut', /sauerkraut/i], ['Germany', 'pretzel', /pretzel/i], ['Germany', 'schnitzel', /schnitzel|cutlet|breaded/i],
  ['Mediterranean', 'hummus', /hummus/i], ['Mediterranean', 'greek salad', /greek salad|salad, greek/i], ['Mediterranean', 'feta', /feta/i], ['Mediterranean', 'olive oil', /olive oil|oil, olive/i], ['Mediterranean', 'moussaka', /moussaka/i],
  // Asia
  ['India', 'chicken tikka masala', /tikka masala/i], ['India', 'dal', /dal|dhal|lentil/i], ['India', 'naan', /naan/i], ['India', 'biryani', /biryani/i], ['India', 'samosa', /samosa/i], ['India', 'paneer', /paneer/i], ['India', 'idli', /idli/i], ['India', 'dosa', /dosa/i], ['India', 'chana masala', /chana|chickpea/i], ['India', 'ghee', /ghee/i],
  ['China', 'fried rice', /fried rice|rice, fried/i], ['China', 'chow mein', /chow mein/i], ['China', 'dumplings', /dumpling/i], ['China', 'kung pao chicken', /kung pao/i], ['China', 'sweet and sour pork', /sweet and sour/i], ['China', 'bok choy', /bok choy|pak.?choi|cabbage, chinese/i], ['China', 'tofu', /tofu/i],
  ['Japan', 'sushi', /sushi/i], ['Japan', 'ramen', /ramen/i], ['Japan', 'miso soup', /miso/i], ['Japan', 'tempura', /tempura/i], ['Japan', 'edamame', /edamame|soybeans, green/i], ['Japan', 'udon', /udon/i],
  ['Korea', 'kimchi', /kimchi/i], ['Korea', 'bibimbap', /bibimbap/i], ['Korea', 'bulgogi', /bulgogi/i],
  ['Thailand', 'pad thai', /pad thai/i], ['Thailand', 'green curry', /green curry|curry, green|thai curry/i], ['Thailand', 'tom yum', /tom yum/i],
  ['Vietnam', 'pho', /pho\b/i], ['Vietnam', 'banh mi', /banh mi/i], ['Vietnam', 'spring roll', /spring roll/i],
  ['Philippines', 'adobo', /adobo/i], ['Philippines', 'lumpia', /lumpia|spring roll/i], ['Philippines', 'pancit', /pancit|noodle/i], ['Philippines', 'sinigang', /sinigang/i],
  // Middle East
  ['Lebanon', 'tabbouleh', /tabbouleh|tabouli/i], ['Lebanon', 'shawarma', /shawarma/i], ['Lebanon', 'baba ganoush', /baba|eggplant dip/i], ['Lebanon', 'fattoush', /fattoush/i],
  ['Turkey', 'doner kebab', /doner|kebab/i], ['Turkey', 'baklava', /baklava/i], ['Turkey', 'lahmacun', /lahmacun/i], ['Turkey', 'ayran', /ayran|yogurt drink/i],
  ['Saudi', 'kabsa', /kabsa/i], ['Saudi', 'dates', /dates/i], ['Saudi', 'mandi', /mandi/i],
  ['Iran', 'tahdig', /tahdig|rice/i], ['Iran', 'kebab koobideh', /koobideh|kebab/i], ['Iran', 'ghormeh sabzi', /ghormeh/i],
  // North America
  ['US', 'cheeseburger', /cheeseburger/i], ['US', 'mac and cheese', /macaroni.*cheese|mac/i], ['US', 'pancakes', /pancake/i], ['US', 'bagel', /bagel/i], ['US', 'peanut butter', /peanut butter/i], ['US', 'hot dog', /hot dog|frankfurter/i], ['US', 'bbq ribs', /ribs/i], ['US', 'apple pie', /apple pie|pie, apple/i], ['US', 'french fries', /french fries/i], ['US', 'oatmeal', /oats.*cooked|oatmeal/i],
  ['Canada', 'poutine', /poutine/i], ['Canada', 'maple syrup', /maple syrup|syrups?, maple/i], ['Canada', 'butter tart', /butter tart/i],
  ['Mexico', 'tacos', /taco/i], ['Mexico', 'burrito', /burrito/i], ['Mexico', 'guacamole', /guacamole/i], ['Mexico', 'quesadilla', /quesadilla/i], ['Mexico', 'tamale', /tamale/i], ['Mexico', 'enchilada', /enchilada/i], ['Mexico', 'tortilla', /tortilla/i],
  ['Caribbean', 'jerk chicken', /jerk/i], ['Caribbean', 'rice and peas', /rice and peas|rice.*beans/i], ['Caribbean', 'ackee and saltfish', /ackee/i], ['Caribbean', 'plantain', /plantain/i], ['Caribbean', 'roti', /roti/i],
  // South America
  ['Brazil', 'feijoada', /feijoada/i], ['Brazil', 'pao de queijo', /p[aã]o de queijo|cheese bread/i], ['Brazil', 'acai bowl', /acai/i], ['Brazil', 'coxinha', /coxinha/i],
  ['Colombia', 'arepa', /arepa/i], ['Colombia', 'bandeja paisa', /bandeja/i], ['Colombia', 'empanada', /empanada/i],
  ['Peru', 'ceviche', /ceviche/i], ['Peru', 'lomo saltado', /lomo saltado/i], ['Peru', 'quinoa', /quinoa/i],
  // Everyday basics and variations
  ['Basics', 'chicken breast', /chicken.*breast|breast.*chicken/i], ['Basics', 'boiled egg', /egg.*boiled|hard-boiled/i], ['Basics', 'white rice', /rice, white.*cooked/i], ['Basics', 'brown rice', /rice, brown/i], ['Basics', 'salmon', /salmon/i], ['Basics', 'banana', /^banana/i], ['Basics', 'apple', /^apple/i], ['Basics', 'whole milk', /milk, whole/i], ['Basics', 'greek yogurt', /greek/i], ['Basics', 'avocado', /avocado/i], ['Basics', 'broccoli', /broccoli/i], ['Basics', 'sweet potato', /sweet potato/i],
  ['Spelling', 'yoghurt', /yog(h)?urt/i], ['Spelling', 'chilli', /chil+i/i], ['Spelling', 'aubergine', /eggplant|aubergine/i], ['Spelling', 'courgette', /zucchini|courgette|squash/i], ['Spelling', 'chickpeas', /chickpea/i], ['Spelling', 'brocoli', /broccoli/i], ['Spelling', 'spagetti', /spaghetti|pasta/i], ['Spelling', 'avacado', /avocado/i],
];

it.skipIf(!process.env.SEARCH_AUDIT)('global search audit', async () => {
  (globalThis as unknown as { fetch: unknown }).fetch = async () => new Response(readFileSync('public/data/foods.json', 'utf8'));
  await loadFoodDb();
  const rows = Q.map(([region, q, re]) => { const top = searchFoods(q, {}).slice(0, 3).map((f) => f.name); return { region, q, first: top[0] ?? null, ok: !!top[0] && re.test(top[0]), inTop3: top.some((n) => re.test(n)), top }; });
  writeFileSync('docs/search-audit.json', JSON.stringify({ total: rows.length, firstOk: rows.filter((r) => r.ok).length, top3Ok: rows.filter((r) => r.inTop3).length, rows }, null, 1));
  console.log(rows.filter((r) => r.ok).length, '/', rows.length);
}, 120000);
