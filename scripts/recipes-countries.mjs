/**
 * Country by country (all 195 countries plus territories with their own food culture).
 * Each country lists its dishes: ones already in the database (by name) and new ones built
 * here from official records (one serving each; ingredients "key:grams"). The list is written
 * to src/data/countryDishes.json so searching a country shows its dishes.
 * Desserts and drinks are non-alcoholic; vegan / vegetarian versions are their own dishes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { RECIPES, K as BASE } from './recipes-global.mjs';

const K = {
  ...BASE,
  millet: 'Millet, cooked', barley: 'Barley, pearled, cooked', buckwheat: 'Buckwheat groats, roasted, cooked', rye_bread: 'Bread, rye',
  herring: 'Fish, herring, Atlantic, cooked, dry heat', kipper: 'Fish, herring, Atlantic, kippered', smoked_salmon: 'Fish, salmon, chinook, smoked',
  sardine: 'Fish, sardine, Atlantic, canned in oil, drained solids with bone', trout: 'Fish, trout, rainbow, farmed, cooked, dry heat', haddock: 'Fish, haddock, cooked, dry heat',
  black_tea: 'Beverages, tea, black, brewed, prepared with tap water', coffee: 'Beverages, coffee, brewed, prepared with tap water', green_tea: 'Beverages, tea, green, brewed, regular',
  coconut_water: 'Coconut water', roselle: 'Roselle, raw', cocoa_powder: 'Cocoa, dry powder, unsweetened', rice_flour: 'Rice flour, white', pistachio: 'Pistachio nuts, NFS',
  hazelnut: 'Hazelnuts', coconut_meat: 'Nuts, coconut meat, raw', condensed: 'Milk, canned, condensed, sweetened', evaporated: 'Milk, canned, evaporated, with added vitamin A',
  gelatine: 'Gelatine', guava: 'Guava, raw', passion: 'Passionfruit, raw', lychee: 'Litchis, raw', watermelon: 'Watermelon, raw', blueberries: 'Blueberries, raw',
  raspberries: 'Raspberries, raw', cherries: 'Cherries, raw', peach: 'Peaches, yellow, raw', pear: 'Pears, raw', figs: 'Figs, raw', prunes: 'Plums, dried (prunes), uncooked',
  apricot_dried: 'Apricots, dried', amaranth: 'Amaranth grain, cooked', teff: 'Teff, cooked', fonio: 'Fonio, white, whole grains, raw', sorghum: 'Sorghum, grain, uncooked',
  kefir: 'Kefir', ice_cream: 'Ice creams, vanilla', choc_ice_cream: 'Ice creams, chocolate', sorbet: 'Sorbet', sponge: 'Cake, sponge', shortbread: 'Shortbread',
  molasses: 'Molasses', ripe_plantain: 'Plantains, yellow, baked', lamb_leg: 'Lamb, leg joint, roasted, lean', sugarcane: 'Sugar cane beverage', breadfruit_cooked: 'Breadfruit, cooked', dill: 'Dill weed, fresh',
  hummus: 'Hummus, home prepared', edamame: 'Edamame, cooked', chia: 'Chia seeds', rice_cake: 'Rice cake', cornflakes: 'Cereal, corn flakes, plain',
  halloumi: 'Cheese, Halloumi', cantaloupe: 'Melons, cantaloupe, raw', grapes: 'Grapes, american type (slip skin), raw', kiwi: 'Kiwifruit, green, raw',
  orange: 'Oranges, raw, all commercial varieties', popcorn: 'Snacks, popcorn, air-popped', marshmallow: 'Marshmallows', nutella: 'Chocolate-flavored hazelnut spread', egg_white: 'Egg, white, cooked, no added fat', root_beer: 'Beverages, carbonated, root beer',
};

const norm = (n) => n.toLowerCase().split(' (')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const dbNames = JSON.parse(readFileSync(new URL('../public/data/foods.json', import.meta.url), 'utf8')).foods.filter((r) => r[10] !== 'r').map((r) => r[1]);
const known = new Map([...dbNames.map((n) => [norm(n), n]), ...RECIPES.map((r) => [norm(r.name), r.name])]);
const NEW = [];
const preferred = [];
const made = new Map(); // shown names of dishes built here, so 'X (y)' and 'X, y' are not made twice
const coverage = {};
const missingRefs = [];

/** One country: its demonym and dishes. "=Name" = already in the database; otherwise [name, "key:g ...", "alias; alias", unit]. */
/** Word-set key ("Cake, chocolate" = "Chocolate cake"), so a new everyday dish never shadows a real measured record. */
const wkey = (n) => norm(n.replace(/,/g, ' ')).split(' ').filter(Boolean).sort().join(' ');
const realByWords = new Map();
for (const n of dbNames) { const segs = n.split(' (')[0].split(', '); for (const k of [wkey(segs.join(' ')), wkey(segs.slice(0, 2).join(' '))]) if (k && !realByWords.has(k)) realByWords.set(k, n); }
const PREFER_REAL = new Set();
const KEEP_OURS = new Set(['Scrambled eggs', 'Mashed potatoes', 'Chicken nuggets', 'Potato salad', 'Rice salad', 'Chocolate milk', 'Potato wedges', 'Chicken and vegetable soup', 'Chicken rice soup', 'Mushroom soup']);

function C(country, demonym, dishes, region) {
  const list = (coverage[country] ??= { demonym, region, dishes: [] });
  for (const d of dishes) {
    if (typeof d === 'string') {
      const name = d.slice(1);
      const hit = known.get(norm(name));
      if (hit) list.dishes.push(hit.split(' (')[0]); else missingRefs.push(`${country}: ${name}`);
      continue;
    }
    const [rawName, spec, aliases = '', unit = 'serving'] = d;
    const name = rawName.replace(/\s*\(([^)]+)\)/g, ', $1'); // brackets are read as other names by the app
    const real = PREFER_REAL.has(rawName) ? realByWords.get(wkey(rawName)) : undefined;
    if (real) { list.dishes.push(real.split(' (')[0]); preferred.push(`${rawName} -> ${real}`); continue; }
    const seen = known.get(norm(rawName)) ?? made.get(norm(name));
    if (seen) { list.dishes.push(seen.split(' (')[0]); continue; }
    const ingredients = spec.trim().split(/\s+/).map((t) => { const [k, g] = t.split(':'); if (!K[k]) throw new Error(`${country} / ${name}: unknown key ${k}`); return [K[k], Number(g)]; });
    const total = ingredients.reduce((s, [, g]) => s + g, 0);
    const al = [...aliases.split(';').map((x) => x.trim()).filter(Boolean)];
    NEW.push({ name, cuisine: demonym, aliases: al, yield: total, ingredients,
      portions: [[`1 ${unit}`, Math.round(total)], [`1 small ${unit}`, Math.round(total * 0.7)], [`1 large ${unit}`, Math.round(total * 1.35)]] });
    known.set(norm(rawName), name);
    made.set(norm(name), name);
    list.dishes.push(name);
  }
}

// ======================= AFRICA (54) =======================
const AF = 'Africa';
C('Algeria', 'Algerian', ['=Chorba', '=Chakhchoukha', '=Mhajeb', '=Couscous royale', ['Garantita', 'chickpea_flour:80 water:150 oil:15 egg:20 salt:2', 'karantika; calentica', 'slice'], ['Dolma (Algerian)', 'zucchini:200 beef_mince:80 rice:40 tomato_canned:80 onion:20 oil:10', 'dolma djazairia'], ['Makroudh', 'semolina:60 dates:40 oil:20 honey:15', 'makrout', 'serving (2)'], ['Shakshouka (Algerian)', 'egg:100 tomato:150 red_pepper:60 onion:30 olive_oil:12', 'chakchouka']], AF);
C('Angola', 'Angolan', ['=Muamba de galinha', ['Funge', 'cassava_cooked:250 water:50', 'funje; cassava porridge', 'portion'], ['Calulu', 'fish:150 okra:60 spinach:60 tomato:50 palm_oil:15 onion:20', 'kalulu fish stew'], ['Mufete', 'fish:180 cowpeas:120 sweet_potato:100 plantain:80 palm_oil:10', 'grilled fish with beans angola', 'plate'], ['Cocada amarela', 'coconut_meat:60 sugar:30 egg:20', 'angolan coconut pudding', 'portion']], AF);
C('Benin', 'Beninese', [['Amiwo', 'cornmeal:100 tomato_paste:20 tomato:50 onion:20 oil:15 chicken_thigh:100 water:150', 'red corn paste with chicken', 'plate'], ['Pâte with gboma sauce', 'cornmeal:100 water:200 spinach:100 palm_oil:15 fish:80', 'akassa; gboma dessi', 'plate'], ['Kuli-kuli (Benin)', 'peanuts:50 oil:5', 'peanut crunch', 'portion'], ['Ago glain', 'crab:150 tomato:60 onion:20 palm_oil:15', 'crab sauce benin'], '=Akara'], AF);
C('Botswana', 'Botswanan', [['Seswaa with pap', 'beef_brisket:150 salt:2 cornmeal:100 water:200', 'seswaa; chotlho', 'plate'], ['Bogobe jwa lerotse', 'sorghum:60 pumpkin:120 water:150', 'sorghum with melon'], ['Magwinya (Botswana)', 'flour:60 oil:15 sugar:5 water:35', 'fat cakes', 'serving (2)'], ['Morogo with pap', 'spinach:150 onion:20 tomato:40 oil:8 cornmeal:90 water:180', 'wild spinach and pap', 'plate']], AF);
C('Burkina Faso', 'Burkinabè', [['Tô with okra sauce', 'millet:200 okra:100 palm_oil:10 dried_shrimp:5 water:100', 'to; saghbo', 'plate'], ['Riz gras', 'rice:250 tomato_paste:20 beef:80 carrots:30 oil:15', 'fat rice burkina', 'plate'], ['Babenda', 'spinach:120 millet:60 peanuts:20 fish:40', 'babenda leaves'], ['Poulet bicyclette', 'chicken_leg:200 oil:8 chili:3', 'grilled free-range chicken']], AF);
C('Burundi', 'Burundian', [['Boko boko harees', 'chicken_stewed:120 bulgur:150 butter:10', 'burundi wheat and chicken'], ['Beans and plantain (Burundi)', 'kidney:180 plantain:120 palm_oil:10 onion:20', 'ibiharage; burundi beans', 'plate'], ['Ndagala', 'dried_shrimp:0 sardine:100 tomato:50 onion:20 oil:10', 'small fried fish lake tanganyika'], ['Isombe (Burundi)', 'spinach:150 peanuts:25 palm_oil:12 eggplant:40', 'cassava leaves burundi']], AF);
C('Cabo Verde', 'Cape Verdean', [['Cachupa', 'corn:150 kidney:80 pork_shoulder:60 sausage:30 sweet_potato:60 cabbage:40 water:100', 'katxupa; cape verde stew', 'bowl'], ['Pastel com diablo dentro', 'flour:60 tuna:50 onion:15 oil:20', 'cape verdean tuna pastry', 'serving (2)'], ['Buzio', 'clams:150 onion:30 tomato:40 oil:10', 'cape verde conch stew'], ['Pudim de leite (Cabo Verde)', 'milk:80 egg:30 sugar:25', 'cape verde flan', 'slice']], AF);
C('Cameroon', 'Cameroonian', ['=Ndolé', '=Eru soup', '=Achu and yellow soup', '=Koki', ['Poulet DG', 'chicken_thigh:150 plantain_fried:120 carrots:40 green_beans:40 tomato:40 oil:12', 'poulet directeur general', 'plate'], ['Beignets haricots', 'flour:60 oil:15 sugar:5 water:30 kidney:100', 'puff puff and beans cameroon', 'plate']], AF);
C('Central African Republic', 'Central African', [['Gozo with ngunza', 'cassava_cooked:200 spinach:120 palm_oil:12 peanuts:15', 'cassava paste with cassava leaves', 'plate'], ['Kanda ti nyma', 'beef_mince:120 onion:20 rice:150 tomato:40 oil:8', 'meatballs car', 'plate'], ['Makara', 'flour:60 oil:15 sugar:8 water:30', 'car fritters', 'serving (3)']], AF);
C('Chad', 'Chadian', [['Boule with okra sauce', 'millet:200 okra:90 beef:60 oil:10', 'la boule; aiysh', 'plate'], ['Daraba', 'okra:120 eggplant:60 sweet_potato:60 peanut_butter:20 tomato:40', 'chadian vegetable stew'], ['Jarret de boeuf', 'shank:160 onion:30 tomato:40 oil:8', 'chadian beef shank stew']], AF);
C('Comoros', 'Comorian', [['Langouste à la vanille', 'shrimp:160 butter:12 cream:30', 'lobster vanilla comoros'], ['Mataba', 'spinach:150 coconut_milk:60 fish:60', 'cassava leaves in coconut'], ['Pilao (Comoros)', 'rice:250 beef:80 onion:30 oil:12 cardamom:1', 'comorian pilau', 'plate']], AF);
C('Republic of the Congo', 'Congolese', ['=Pondu (cassava leaf stew)', '=Moambe chicken', ['Saka-saka', 'spinach:150 palm_oil:15 peanut_butter:20 dried_shrimp:5', 'saka saka'], ['Poisson salé', 'salt_cod:120 tomato:60 onion:20 oil:12', 'congo salted fish']], AF);
C('Democratic Republic of the Congo', 'Congolese (DRC)', ['=Pondu (cassava leaf stew)', '=Moambe chicken', ['Fufu with liboke fish', 'cassava_cooked:200 fish:150 tomato:40 onion:20 chili:3', 'liboke; fish in leaves', 'plate'], ['Makayabu', 'salt_cod:120 spinach:80 palm_oil:12 onion:20', 'salted fish drc'], ['Chikwanga', 'cassava_cooked:250', 'kwanga; cassava bread', 'portion']], AF);
C("Côte d'Ivoire", 'Ivorian', ['=Attiéké with grilled fish', '=Kedjenou', ['Aloco with egg', 'plantain_fried:200 egg_boiled:50 chili:3 onion:15', 'alloco', 'plate'], ['Sauce graine', 'palm_oil:30 chicken_thigh:120 tomato:40 onion:20 water:100', 'palm nut soup ivory coast'], ['Garba', 'cassava_cooked:200 fish:120 oil:20 chili:5 onion:20', 'attieke garba', 'plate']], AF);
C('Djibouti', 'Djiboutian', [['Skoudehkaris', 'rice:250 lamb:100 tomato:50 onion:30 oil:12 cardamom:1', 'djibouti rice with lamb', 'plate'], ['Fah-fah', 'goat:120 potato:80 kale:40 water:250', 'djiboutian soup', 'bowl'], ['Laxoox (Djibouti)', 'flour:70 water:80 oil:8', 'lahoh; canjeero', 'serving (2)']], AF);
C('Egypt', 'Egyptian', ['=Koshari', '=Ful medames', '=Taameya', '=Molokhia', '=Mahshi', '=Hawawshi', '=Fatta', ['Feteer meshaltet', 'flour:80 butter:30 water:30 honey:10', 'egyptian pastry', 'slice'], ['Om ali', 'puff_pastry:40 milk:120 sugar:20 cream:20 almonds:10 raisins:8', 'egyptian bread pudding', 'bowl'], ['Karkadeh', 'roselle:10 sugar:20 water:250', 'hibiscus tea egypt', 'glass']], AF);
C('Equatorial Guinea', 'Equatoguinean', [['Succotash (Equatorial Guinea)', 'corn:100 kidney:80 tomato:40 onion:20 oil:10', 'equatorial guinea corn and beans'], ['Pepesoup', 'fish:150 chili:5 onion:20 tomato:40 water:250', 'pepper soup equatorial guinea', 'bowl'], ['Chicken in peanut sauce (Equatorial Guinea)', 'chicken_thigh:150 peanut_butter:30 tomato:40 onion:20', 'pollo con salsa de cacahuete']], AF);
C('Eritrea', 'Eritrean', ['=Zigni', '=Injera, Ethiopian bread', '=Shiro', ['Ful (Eritrea)', 'fava:200 tomato:30 onion:20 oil:10 chili:2', 'eritrean ful'], ['Kicha fit-fit', 'flour:80 butter:15 chili_powder:2 yogurt:30', 'kitcha fitfit']], AF);
C('Eswatini', 'Swazi', [['Sishwala with beef stew', 'cornmeal:100 water:200 beef:120 tomato:40 onion:20', 'emasi; swazi porridge', 'plate'], ['Umncweba', 'beef:60 salt:1', 'swazi dried meat', 'portion'], ['Emasi emabele', 'sorghum:60 yogurt:150', 'sour milk with sorghum', 'bowl']], AF);
C('Ethiopia', 'Ethiopian', ['=Injera, Ethiopian bread', '=Doro wat', '=Shiro', '=Tibs', '=Kitfo', '=Misir wat', '=Key wat', '=Gomen', '=Beyaynetu', ['Firfir', 'flour:120 water:80 butter:15 chili_powder:3 onion:30 tomato:30', 'fitfit; injera firfir'], ['Atkilt wat', 'cabbage:120 potato:100 carrots:60 onion:30 oil:12 turmeric:1', 'ethiopian cabbage potato carrot'], ['Ethiopian coffee', 'coffee:120 sugar:5', 'buna', 'cup']], AF);
C('Gabon', 'Gabonese', [['Nyembwe chicken', 'chicken_thigh:160 palm_oil:30 onion:20 tomato:30', 'poulet nyembwe'], ['Atanga with bread', 'bread:60 butter:0 avocado:60', 'safou with bread'], ['Gabonese fish with bananas', 'fish:150 plantain:120 tomato:40 oil:10', 'poisson braisé gabon', 'plate']], AF);
C('The Gambia', 'Gambian', ['=Domoda', ['Benachin', 'rice:250 fish:100 tomato_paste:20 onion:30 oil:15 carrots:30', 'gambian jollof', 'plate'], ['Superkanja', 'okra:150 fish:80 palm_oil:15 onion:20', 'okra soup gambia'], ['Chere', 'millet:200 milk:80 sugar:10', 'gambian couscous']], AF);
C('Ghana', 'Ghanaian', ['=Waakye', '=Banku', '=Kelewele', '=Red red', '=Light soup', '=Groundnut soup', '=Kontomire stew', '=Omo tuo', '=Tuo zaafi', '=Jollof rice, Ghanaian style', '=Fufu and light soup', '=Banku and tilapia', '=Waakye with egg and fish', '=Red red with plantain', ['Kenkey with fried fish and shito', 'cornmeal:200 water:150 fish:120 oil:15 chili:5', 'kenkey and fish', 'plate'], ['Ampesi with kontomire', 'yam:150 plantain:120 spinach:100 palm_oil:15 egg_boiled:50', 'ampesi', 'plate'], ['Hausa koko with koose', 'millet:150 water:150 sugar:10 cowpeas:60 oil:15', 'koko and koose', 'bowl'], ['Sobolo', 'roselle:10 sugar:25 ginger:5 water:250', 'ghana hibiscus drink', 'glass']], AF);
C('Guinea', 'Guinean', [['Riz sauce arachide', 'rice:250 peanut_butter:30 chicken_thigh:100 tomato:40 onion:20', 'guinea peanut sauce rice', 'plate'], ['Fouti', 'eggplant:100 okra:80 rice:200 palm_oil:10', 'guinea eggplant okra', 'plate'], ['Konkoe', 'fish:150 tomato:40 onion:20 oil:10 chili:3', 'guinea smoked fish stew']], AF);
C('Guinea-Bissau', 'Bissau-Guinean', [['Caldo de mancarra', 'chicken_thigh:150 peanut_butter:30 tomato:40 onion:20 rice:200', 'peanut stew guinea-bissau', 'plate'], ['Jollof (Guinea-Bissau)', 'rice:250 fish:100 tomato_paste:20 oil:15', 'jollof bissau', 'plate'], ['Cashew fruit juice', 'apple:150 sugar:10 water:100', 'caju juice', 'glass']], AF);
C('Kenya', 'Kenyan', ['=Ugali', '=Sukuma wiki', '=Nyama choma (grilled goat)', '=Githeri', '=Irio', '=Pilau', '=Chapati and beans', '=Mandazi', '=Kachumbari', '=Kenyan beef stew with ugali', '=Kenyan chicken stew', '=Mishkaki with chips', ['Mukimo', 'potato:150 peas:50 corn:40 spinach:50 butter:5', 'kenyan mash'], ['Kenyan chai', 'black_tea:150 milk:100 sugar:10 ginger:2', 'chai ya maziwa', 'cup']], AF);
C('Lesotho', 'Basotho', [['Papa with moroho', 'cornmeal:100 water:200 spinach:120 onion:20 oil:8', 'pap and greens lesotho', 'plate'], ['Lesotho chicken stew', 'chicken_thigh:150 tomato:50 potato:60 onion:20 oil:8'], ['Likhobe', 'sorghum:60 kidney:100 water:150', 'samp and beans lesotho']], AF);
C('Liberia', 'Liberian', [['Palm butter soup', 'palm_oil:35 chicken_thigh:120 fish:40 onion:20 water:150 rice:200', 'liberian palm butter', 'plate'], ['Cassava leaf soup (Liberia)', 'spinach:150 palm_oil:20 chicken_thigh:80 fish:40 rice:200', 'potato greens liberia', 'plate'], ['Liberian jollof', 'rice:250 chicken_thigh:80 sausage:30 tomato_paste:20 oil:15', 'jollof liberia', 'plate'], ['Kanyan', 'peanuts:40 rice_flour:20 sugar:10', 'liberian peanut candy', 'serving (2)']], AF);
C('Libya', 'Libyan', [['Bazeen', 'barley:200 lamb:100 tomato_paste:20 potato:60 egg_boiled:50', 'libyan barley dough', 'plate'], ['Sharba libiya', 'lamb:80 tomato_paste:20 chickpeas:50 pasta:40 water:250 mint:2', 'libyan soup', 'bowl'], ['Usban', 'lamb:120 rice:80 parsley:5 onion:20', 'libyan stuffed sausage'], ['Asida', 'flour:60 butter:15 honey:20 water:100', 'libyan sweet dough', 'bowl']], AF);
C('Madagascar', 'Malagasy', ['=Romazava', ['Ravitoto', 'spinach:150 pork_shoulder:100 garlic:5 oil:8 rice:200', 'cassava leaves with pork', 'plate'], ['Akoho sy voanio', 'chicken_thigh:150 coconut_milk:80 tomato:40 onion:20 rice:200', 'chicken in coconut milk madagascar', 'plate'], ['Mofo gasy', 'rice_flour:60 sugar:10 coconut_milk:30', 'malagasy rice cakes', 'serving (2)']], AF);
C('Malawi', 'Malawian', [['Nsima with chambo', 'cornmeal:100 water:200 fish:150 tomato:40 oil:8', 'chambo fish and nsima', 'plate'], ['Kondowole', 'cassava_cooked:200 water:50', 'cassava nsima'], ['Ndiwo', 'spinach:150 peanuts:20 tomato:40 onion:20', 'malawi greens relish']], AF);
C('Mali', 'Malian', [['Tigadèguèna', 'peanut_butter:40 beef:120 tomato:50 onion:20 rice:200', 'maafe mali', 'plate'], ['Tô (Mali)', 'millet:200 okra:80 dried_shrimp:5', 'malian to'], ['Fakoye', 'lamb:120 spinach:80 onion:20 oil:8', 'mali herb stew'], ['Djouka', 'fonio:80 peanut_butter:20 water:150', 'fonio with peanuts']], AF);
C('Mauritania', 'Mauritanian', [['Thieboudienne (Mauritania)', 'rice:250 fish:150 tomato_paste:20 carrots:40 cabbage:40 oil:15', 'ceebu jen mauritania', 'plate'], ['Méchoui', 'lamb:180 butter:10 cumin:1', 'mauritanian roast lamb'], ['Lakh', 'millet:100 yogurt:100 sugar:10', 'millet yogurt pudding', 'bowl']], AF);
C('Mauritius', 'Mauritian', [['Dholl puri', 'flour:80 split_peas:40 oil:10 water:30', 'dhal puri', 'serving (2)'], ['Rougaille', 'tomato:150 sausage:80 onion:30 oil:10 ginger:3', 'mauritian rougaille'], ['Mine frite', 'egg_noodles:220 chicken_thigh:80 soy:15 oil:15 cabbage:40', 'mauritian fried noodles', 'plate'], ['Gateau piment', 'split_peas:80 oil:15 chili:3', 'chili cakes', 'serving (4)']], AF);
C('Morocco', 'Moroccan', ['=Chicken tagine', '=Harira', '=Pastilla', '=Msemen', '=Lamb tagine with prunes', '=Kefta tagine', '=Vegetable tagine', '=Fish tagine', '=Couscous royale', '=Zaalouk', '=Rfissa', ['Moroccan mint tea', 'green_tea:200 mint:3 sugar:15', 'atay', 'glass'], ['Bissara', 'fava:200 olive_oil:15 cumin:2 garlic:5 water:100', 'fava bean soup morocco', 'bowl'], ['Sellou', 'flour:30 almonds:15 sesame:10 butter:10 honey:10', 'sfouf', 'portion']], AF);
C('Mozambique', 'Mozambican', ['=Piri piri prawns', '=Matapa', ['Galinha à zambeziana', 'chicken_leg:200 coconut_milk:60 lime:10 chili:3', 'zambezi chicken'], ['Xima with fish', 'cornmeal:100 water:200 fish:150 tomato:40', 'mozambique xima', 'plate'], ['Prego roll', 'beef_sirloin:100 roll:80 garlic:3 chili:2', 'prego', 'sandwich']], AF);
C('Namibia', 'Namibian', [['Kapana', 'beef_sirloin:150 chili:3 onion:20', 'namibian street grilled beef'], ['Oshifima with beef stew', 'millet:200 beef:100 tomato:40', 'oshifima', 'plate'], ['Potjie (Namibia)', 'lamb:130 potato:80 carrots:40 pumpkin:40', 'namibian potjiekos'], ['Vetkoek with mince', 'flour:70 oil:15 water:40 beef_mince:70 onion:15', 'vetkoek and mince', 'serving']], AF);
C('Niger', 'Nigerien', [['Dambou', 'millet:150 spinach:60 peanuts:20 onion:20 oil:10', 'niger dambou'], ['Djerma stew', 'beef:120 tomato:50 peanut_butter:20 onion:20 rice:200', 'niger peanut stew', 'plate'], ['Kilishi (Niger)', 'beef:60 peanuts:10 chili:2', 'dried spiced beef niger', 'portion']], AF);
C('Nigeria', 'Nigerian', ['=Jollof rice', '=Egusi soup', '=Pounded yam', '=Efo riro', '=Moi moi', '=Akara', '=Suya', '=Goat pepper soup', '=Ofada stew', '=Nigerian fried rice', '=Abacha (African salad)', '=Vegan jollof rice', '=Vegan moi moi', '=Vegan egusi soup with mushrooms', '=Vegan efo riro', '=Ewa agoyin and dodo', '=Zobo drink', '=Chapman', '=Puff puff', '=Chin chin', ['Yam porridge (vegan)', 'yam:300 palm_oil:20 tomato:60 red_pepper:40 onion:30 spinach:40', 'vegan asaro; yam pottage vegan', 'plate'], ['Beans porridge (vegan)', 'cowpeas:300 palm_oil:20 tomato:50 onion:30 red_pepper:30', 'vegan ewa riro', 'plate']], AF);
C('Rwanda', 'Rwandan', ['=Isombe', ['Brochettes with chips', 'goat:150 fries:150 onion:15', 'rwandan brochettes', 'plate'], ['Ibihaza', 'pumpkin:200 kidney:80 onion:20 oil:8', 'pumpkin and beans rwanda'], ['Ugali with beans (Rwanda)', 'cornmeal:100 water:200 kidney:150', 'ubugali n ibishyimbo', 'plate']], AF);
C('São Tomé and Príncipe', 'São Toméan', [['Calulu (São Tomé)', 'fish:150 spinach:80 okra:50 palm_oil:15 tomato:40', 'calulu sao tome'], ['Banana pão', 'plantain:150 fish:120 oil:10', 'fish with breadfruit and banana', 'plate'], ['Molho no fogo', 'fish:150 palm_oil:15 spinach:60', 'sao tome fish sauce stew']], AF);
C('Senegal', 'Senegalese', ['=Thieboudienne', '=Yassa chicken', '=Mafe', ['Thiéré with mbuum', 'millet:200 spinach:60 kidney:60 beef:60', 'thiere', 'plate'], ['Pastels (Senegal)', 'flour:60 fish:50 onion:15 oil:20', 'senegalese fish pastels', 'serving (3)'], ['Bissap', 'roselle:10 sugar:25 water:250 mint:1', 'senegal hibiscus juice', 'glass'], ['Thiakry', 'millet:80 yogurt:150 sugar:15 raisins:10', 'degue senegal', 'bowl']], AF);
C('Seychelles', 'Seychellois', [['Octopus curry', 'squid:150 coconut_milk:80 curry:4 onion:20 rice:200', 'seychelles octopus curry', 'plate'], ['Ladob', 'ripe_plantain:150 coconut_milk:100 sugar:15', 'seychelles banana dessert', 'bowl'], ['Grilled fish creole', 'fish:170 tomato:50 onion:20 chili:3 oil:8', 'poisson creole']], AF);
C('Sierra Leone', 'Sierra Leonean', [['Cassava leaf stew', 'spinach:180 palm_oil:20 fish:60 beef:50 rice:200', 'cassava leaves sierra leone', 'plate'], ['Groundnut stew (Sierra Leone)', 'peanut_butter:40 chicken_thigh:120 tomato:40 rice:200', 'groundnut soup salone', 'plate'], ['Fry fry', 'fish:100 plantain_fried:100 bread:40', 'sierra leone street fry', 'plate'], ['Kanya (Sierra Leone)', 'peanuts:40 rice_flour:20 sugar:12', 'kanyah', 'serving (2)']], AF);
C('Somalia', 'Somali', ['=Suqaar', '=Bariis iskukaris', ['Canjeero', 'flour:70 water:90 oil:5', 'laxoox; lahoh', 'serving (2)'], ['Somali spiced tea', 'black_tea:200 milk:60 sugar:10 cardamom:1 cinnamon:1', 'shaah', 'cup'], ['Sambusa (Somali)', 'flour:60 beef_mince:50 onion:15 oil:20', 'sambuusa', 'serving (2)']], AF);
C('South Africa', 'South African', ['=Bobotie', '=Bunny chow', '=Chakalaka', '=Pap and wors', '=Potjiekos', '=Sosaties', '=Durban curry', '=Malva pudding', '=Vetkoek', ['Chakalaka and pap (vegan)', 'cornmeal:100 water:200 kidney:80 carrots:40 tomato:50 green_pepper:30 oil:10', 'vegan pap and chakalaka', 'plate'], ['Koeksister', 'flour:40 oil:15 sugar:25 water:15', 'koeksisters', 'serving (2)'], ['Rooibos tea', 'black_tea:250', 'red bush tea', 'cup']], AF);
C('South Sudan', 'South Sudanese', [['Kisra with mullah', 'sorghum:80 water:120 okra:60 beef:60 tomato:30', 'kisra; mullah stew', 'plate'], ['Ful sudani', 'peanuts:40 spinach:100 onion:20', 'peanut greens south sudan'], ['Wal-wal', 'sorghum:80 milk:100 sugar:10', 'sorghum balls', 'bowl']], AF);
C('Sudan', 'Sudanese', [['Ful sudani (beans)', 'fava:200 oil:12 cumin:2 bread:60', 'sudanese ful', 'plate'], ['Kisra with mulah', 'sorghum:80 water:120 beef:80 okra:60 tomato:40', 'kissra', 'plate'], ['Gurasa', 'flour:80 water:60 oil:8', 'sudanese pancake bread', 'serving'], ['Aseeda', 'millet:150 butter:10', 'asida sudan']], AF);
C('Tanzania', 'Tanzanian', ['=Chips mayai', '=Mishkaki', '=Pilau', '=Ugali', ['Ndizi nyama', 'plantain:200 beef:120 tomato:40 coconut_milk:40', 'bananas with beef tanzania'], ['Zanzibar pizza', 'flour:60 egg:50 beef_mince:50 onion:15 oil:15', 'zanzibar street pizza', 'piece'], ['Urojo', 'potato:100 chickpeas:50 tamarind:10 egg_boiled:50 water:200', 'zanzibar mix soup', 'bowl']], AF);
C('Togo', 'Togolese', [['Fufu with groundnut soup (Togo)', 'yam:250 peanut_butter:35 chicken_thigh:100 tomato:40', 'togolese fufu', 'plate'], ['Akoume with gboma', 'cornmeal:100 water:200 spinach:100 palm_oil:15 fish:60', 'akume', 'plate'], ['Ablo', 'rice_flour:80 sugar:5 water:60', 'togolese steamed rice cakes', 'serving (3)']], AF);
C('Tunisia', 'Tunisian', ['=Brik', '=Lablabi', '=Ojja', ['Couscous with fish (Tunisia)', 'couscous:200 fish:150 tomato_paste:20 carrots:40 olive_oil:15', 'kosksi bel hout', 'plate'], ['Mloukhia (Tunisia)', 'spinach:150 beef:100 olive_oil:20', 'tunisian mloukhia'], ['Tunisian tuna sandwich', 'baguette:100 tuna:60 egg_boiled:30 olives:15 olive_oil:10 potato:40', 'casse-croute tunisien', 'sandwich']], AF);
C('Uganda', 'Ugandan', ['=Rolex', '=Luwombo', '=Matoke', ['Posho and beans', 'cornmeal:100 water:200 kidney:150 tomato:30', 'posho', 'plate'], ['Katogo', 'plantain:200 beef:80 tomato:40 onion:20', 'matoke and offal']], AF);
C('Zambia', 'Zambian', ['=Nshima with chicken', ['Ifisashi', 'spinach:150 peanuts:30 tomato:30 onion:20', 'zambian greens in peanut sauce'], ['Kapenta with nshima', 'sardine:80 tomato:50 onion:20 oil:8 cornmeal:100 water:200', 'kapenta', 'plate'], ['Chikanda', 'peanuts:40 water:40', 'african polony', 'portion']], AF);
C('Zimbabwe', 'Zimbabwean', ['=Sadza and beef stew', ['Muriwo une dovi', 'spinach:150 peanut_butter:25 tomato:30 onion:20', 'greens with peanut butter'], ['Dovi', 'chicken_thigh:150 peanut_butter:30 tomato:40 onion:20', 'zimbabwe peanut stew'], ['Mazondo', 'beef:150 tomato:40 onion:20', 'cow trotters stew zimbabwe']], AF);

// ======================= ASIA (48) =======================
const AS = 'Asia';
C('Afghanistan', 'Afghan', [['Kabuli pulao', 'rice:280 lamb:120 carrots:50 raisins:20 almonds:10 oil:15', 'qabuli palaw', 'plate'], ['Mantu (Afghan)', 'flour:80 beef_mince:80 onion:20 yogurt:50 tomato_paste:10 split_peas:20', 'afghan dumplings', 'plate'], ['Bolani', 'flour:80 potato:80 onion:15 oil:15 water:40', 'afghan stuffed flatbread', 'piece'], ['Qorma-e-sabzi', 'lamb:120 spinach:150 onion:30 oil:15', 'afghan spinach stew']], AS);
C('Armenia', 'Armenian', [['Khorovats', 'pork_shoulder:180 onion:30', 'armenian barbecue'], ['Harissa (Armenian)', 'barley:150 chicken_stewed:100 butter:10', 'armenian wheat porridge'], ['Lavash wrap', 'flour_tortilla:80 cheddar:30 cucumber:30 tomato:30 parsley:5', 'armenian lavash', 'wrap'], ['Ghapama', 'pumpkin:200 rice:80 raisins:15 apricot_dried:15 honey:10 butter:10', 'stuffed pumpkin armenia']], AS);
C('Azerbaijan', 'Azerbaijani', [['Plov (Azerbaijani)', 'rice:250 lamb:100 apricot_dried:15 raisins:10 butter:15 saffron:0.1', 'shah plov', 'plate'], ['Dolma (Azerbaijani)', 'cabbage_cooked:100 lamb_mince:80 rice:40 yogurt:30', 'yarpaq dolmasi'], ['Qutab', 'flour:70 spinach:60 butter:10 water:30', 'gutab', 'serving (2)'], ['Dushbara', 'flour:60 lamb_mince:50 stock:250 mint:1', 'azerbaijani dumpling soup', 'bowl']], AS);
C('Bahrain', 'Bahraini', [['Chicken machboos (Bahrain)', 'rice:260 chicken_thigh:150 tomato:40 onion:30 oil:15 cardamom:1', 'machbous dajaj bahrain', 'plate'], ['Muhammar', 'rice:250 dates:30 sugar:10 butter:10', 'bahraini sweet rice', 'plate'], ['Balaleet', 'rice_noodles:150 sugar:15 butter:10 egg:50 cardamom:1', 'sweet vermicelli with omelette', 'plate']], AS);
C('Bangladesh', 'Bangladeshi', ['=Bhuna khichuri', '=Panta bhat', '=Shorshe ilish', '=Beef bhuna (Bangladeshi)', '=Chicken rezala', ['Bharta platter', 'eggplant:100 potato:100 mustard:5 onion:20 oil:10 rice:200', 'vorta bhaat', 'plate'], ['Fuchka', 'flour:40 oil:15 potato:50 chickpeas:30 tamarind:10', 'phuchka', 'plate (6)']], AS);
C('Bhutan', 'Bhutanese', [['Ema datshi', 'chili:60 cheddar:60 onion:20 tomato:30 butter:5 rice:200', 'chilli cheese bhutan', 'plate'], ['Kewa datshi', 'potato:150 cheddar:50 chili:10', 'potato cheese bhutan'], ['Red rice with phaksha paa', 'rice:200 pork_shoulder:100 chili:10', 'bhutanese pork', 'plate']], AS);
C('Brunei', 'Bruneian', [['Ambuyat', 'tapioca:60 water:200', 'sago starch brunei', 'bowl'], ['Nasi katok', 'rice:200 chicken_fried:100 chili:10 oil:5', 'brunei rice with fried chicken', 'plate'], ['Beef rendang (Brunei)', 'beef:150 coconut_milk:60 chili:5 onion:20', 'rendang brunei']], AS);
C('Cambodia', 'Cambodian', [['Fish amok', 'fish:150 coconut_milk:80 egg:20 curry:3 lemongrass:5 rice:200', 'amok trey', 'plate'], ['Lok lak', 'beef_sirloin:150 lime:10 black_pepper:1 rice:200 lettuce:30 tomato:30', 'beef lok lak', 'plate'], ['Kuy teav', 'rice_noodles:220 pork_shoulder:80 shrimp:30 stock:300 sprouts_cooked:30', 'khmer noodle soup', 'bowl'], ['Num banh chok', 'rice_noodles:220 fish:60 coconut_milk:40 cucumber:30', 'khmer noodles', 'bowl']], AS);
C('China', 'Chinese', ['=Kung pao chicken', '=Mapo tofu', '=Peking duck', '=Char siu', '=Xiaolongbao', '=Hot and sour soup', '=Dan dan noodles', '=Chicken congee', ['Tomato and egg stir-fry', 'tomato:200 egg:100 oil:12 sugar:5 rice:200', 'xihongshi chao jidan', 'plate'], ['Jianbing', 'flour:60 egg:50 onion:10 hoisin:15 oil:10 water:50', 'chinese crepe', 'piece'], ['Ma po eggplant', 'eggplant:200 garlic:5 soy:15 chili:5 oil:15', 'yu xiang qiezi; fish-fragrant aubergine'], ['Mapo tofu (vegan)', 'tofu:200 soy:15 chili:6 mushrooms:50 oil:12', 'vegan mapo tofu']], AS);
C('Cyprus', 'Cypriot', [['Souvla', 'lamb:180 lemon:5 oregano:1', 'cypriot souvla'], ['Halloumi with salad', 'feta:100 tomato:60 cucumber:60 olive_oil:10', 'grilled halloumi cyprus'], ['Koupepia', 'cabbage_cooked:100 rice:50 beef_mince:70 tomato_canned:50', 'cypriot stuffed vine leaves'], ['Kolokasi', 'taro:200 pork_shoulder:80 tomato_canned:60 olive_oil:10', 'taro stew cyprus']], AS);
C('Georgia', 'Georgian', [['Khachapuri', 'flour:100 mozzarella:70 feta:30 egg:50 butter:10 water:50', 'adjarian khachapuri', 'piece'], ['Khinkali', 'flour:100 beef_mince:60 pork_ground:40 onion:15 water:50', 'georgian dumplings', 'serving (5)'], ['Lobio', 'kidney:200 onion:30 walnuts:15 coriander:5 oil:8', 'georgian bean stew'], ['Badrijani nigvzit', 'eggplant:150 walnuts:30 garlic:3 oil:10', 'eggplant walnut rolls']], AS);
C('India', 'Indian', ['=Chicken biryani', '=Butter chicken with naan', '=Chicken tikka masala', '=Dal', '=Chana masala', '=Palak paneer', '=Masala dosa', '=Idli sambar', '=Aloo gobi', '=Rajma chawal', '=Chole bhature', '=Pav bhaji', '=Poha', '=Upma', '=Vegetable biryani', '=Vegetable thali', '=Mango lassi', '=Kheer', '=Gulab jamun', ['Masala chai', 'black_tea:150 milk:100 sugar:10 ginger:2 cardamom:1', 'chai', 'cup'], ['Vada pav', 'potato:100 chickpea_flour:30 oil:20 bread:60 chili:3', 'wada pav', 'piece'], ['Pongal', 'rice:150 red_lentils:60 ghee:10 black_pepper:1', 'ven pongal']], AS);
C('Indonesia', 'Indonesian', ['=Nasi goreng', '=Beef rendang', '=Gado gado', '=Mie goreng', '=Soto ayam', '=Nasi uduk', '=Ayam penyet', '=Nasi campur', '=Chicken satay', '=Tempeh stir-fry with rice', ['Tempeh goreng', 'tempeh:150 oil:15 garlic:3', 'fried tempeh'], ['Es teler', 'avocado:60 coconut_meat:40 condensed:30 water:100', 'indonesian fruit cocktail drink', 'glass']], AS);
C('Iran', 'Iranian', ['=Kebab koobideh', '=Ghormeh sabzi', '=Tahdig', '=Joojeh kabab', '=Fesenjan', '=Kuku sabzi', '=Ash reshteh', '=Dizi', '=Khoresh gheymeh', '=Zereshk polo ba morgh', ['Sholeh zard', 'rice:80 sugar:30 water:150 saffron:0.1 almonds:5', 'saffron rice pudding', 'bowl'], ['Doogh', 'yogurt:150 water:100 mint:1', 'persian yogurt drink', 'glass']], AS);
C('Iraq', 'Iraqi', [['Masgouf', 'fish:200 tomato:40 onion:20 oil:8', 'iraqi grilled fish'], ['Quzi', 'lamb:150 rice:250 almonds:10 raisins:10 oil:15', 'qoozi', 'plate'], ['Kubba halab', 'rice:100 beef_mince:60 oil:20', 'iraqi rice kubba', 'serving (2)'], ['Dolma (Iraqi)', 'cabbage_cooked:80 eggplant:60 rice:60 beef_mince:50 tomato_paste:10', 'iraqi dolma'], ['Tepsi baytinijan', 'eggplant:150 beef_mince:80 tomato:60 potato:60 oil:15', 'iraqi eggplant casserole']], AS);
C('Israel', 'Israeli', ['=Shakshuka', '=Falafel', ['Sabich', 'pita:90 eggplant:80 egg_boiled:50 tahini:20 tomato:30 cucumber:30', 'sabich sandwich', 'pita'], ['Jachnun', 'flour:80 butter:25 water:30', 'yemenite jewish pastry', 'piece'], ['Israeli salad', 'tomato:100 cucumber:100 onion:20 olive_oil:10 lemon:8', 'salat katzutz']], AS);
C('Japan', 'Japanese', ['=Salmon sushi roll', '=Shoyu ramen', '=Miso soup', '=Gyudon', '=Chicken katsu curry', '=Onigiri', '=Okonomiyaki', '=Gyoza', '=Chicken teriyaki with rice', '=Agedashi tofu', ['Tamagoyaki', 'egg:100 sugar:5 soy:3 oil:5', 'japanese rolled omelette'], ['Matcha latte', 'green_tea:100 milk:150 sugar:8', 'matcha', 'cup'], ['Inari sushi', 'rice_short:120 tofu:40 sugar:8 soy:5', 'inarizushi', 'serving (3)']], AS);
C('Jordan', 'Jordanian', ['=Mansaf', ['Maqluba (Jordan)', 'rice:250 chicken_meat:100 eggplant:60 cauliflower:60 oil:15', 'jordanian maqluba', 'plate'], ['Zarb', 'lamb:120 chicken_meat:80 potato:80 carrots:40', 'bedouin barbecue'], ['Knafeh nabulsieh', 'phyllo:40 mozzarella:50 butter:15 sugar:20', 'jordan knafeh', 'slice']], AS);
C('Kazakhstan', 'Kazakh', [['Beshbarmak', 'pasta:150 lamb:150 onion:30 stock:50', 'beshbarmaq', 'plate'], ['Kazy', 'beef:80', 'horse sausage (shown as beef)'], ['Baursak', 'flour:60 oil:15 milk:20 sugar:5', 'baursaki', 'serving (4)'], ['Kuyrdak', 'lamb:120 liver:40 potato:80 onion:20 oil:10', 'kazakh fry']], AS);
C('Kuwait', 'Kuwaiti', [['Machboos laham', 'rice:260 lamb:140 tomato:40 onion:30 oil:15', 'kuwaiti meat machboos', 'plate'], ['Mutabbaq samak', 'rice:250 fish:150 onion:20 oil:15', 'kuwaiti fish rice', 'plate'], ['Gers ogaily', 'flour:40 sugar:20 egg:20 butter:10 cardamom:1', 'kuwaiti cake', 'slice']], AS);
C('Kyrgyzstan', 'Kyrgyz', [['Lagman', 'pasta:200 beef:100 green_pepper:40 tomato:40 onion:20 oil:10', 'laghman', 'bowl'], ['Plov (Kyrgyz)', 'rice:250 lamb:100 carrots:60 oil:20', 'kyrgyz plov', 'plate'], ['Manty (Kyrgyz)', 'flour:90 lamb_mince:80 onion:30', 'kyrgyz manti', 'serving (4)'], ['Boorsok', 'flour:50 oil:12 milk:20', 'kyrgyz fried dough', 'serving (4)']], AS);
C('Laos', 'Lao', ['=Larb', ['Sticky rice with jaew', 'sticky_rice:200 tomato:30 chili:5 fish_sauce:5', 'khao niao', 'serving'], ['Tam mak hoong', 'papaya:150 tomato:30 lime:10 fish_sauce:10 chili:5 peanuts:10', 'lao papaya salad'], ['Khao piak sen', 'rice_noodles:220 chicken_stewed:90 stock:300', 'lao chicken noodle soup', 'bowl']], AS);
C('Lebanon', 'Lebanese', ['=Kibbeh', '=Manakish', '=Fattoush', '=Hummus with lamb', '=Spinach fatayer', '=Sambousek', '=Muhammara', ['Tabbouleh (Lebanese)', 'parsley:60 bulgur:30 tomato:60 onion:15 olive_oil:15 lemon:10', 'tabouleh lebanese'], ['Mujaddara (Lebanese)', 'lentils:150 rice:120 onion:60 olive_oil:15', 'mjadra'], ['Lebanese hummus', 'chickpeas:150 tahini:30 lemon:10 olive_oil:10 garlic:3', 'hummus bi tahini', 'portion']], AS);
C('Malaysia', 'Malaysian', ['=Nasi lemak', '=Laksa', '=Roti canai', '=Char kway teow', '=Nasi kandar', '=Mee rebus', '=Nasi lemak with fried chicken', ['Teh tarik', 'black_tea:150 condensed:30 evaporated:20', 'pulled tea', 'cup'], ['Cendol', 'coconut_milk:80 rice_flour:20 brown_sugar:20 water:100', 'chendol', 'bowl']], AS);
C('Maldives', 'Maldivian', [['Mas huni with roshi', 'tuna:80 coconut_meat:40 onion:15 lime:5 flour:60 water:30', 'mas huni', 'plate'], ['Garudhiya', 'tuna_steak:120 water:250 rice:200 lime:5', 'maldivian fish soup', 'plate'], ['Hedhikaa', 'tuna:50 flour:30 oil:15 coconut_meat:15', 'maldivian short eats', 'serving (3)']], AS);
C('Mongolia', 'Mongolian', [['Buuz', 'flour:90 lamb_mince:90 onion:20', 'mongolian dumplings', 'serving (4)'], ['Khuushuur', 'flour:90 beef_mince:80 onion:20 oil:20', 'mongolian fried pastry', 'serving (2)'], ['Tsuivan', 'pasta:200 beef:80 carrots:30 cabbage:30 oil:10', 'mongolian noodle stir fry', 'plate'], ['Suutei tsai', 'green_tea:150 milk:100 salt:1', 'mongolian milk tea', 'cup']], AS);
C('Myanmar', 'Burmese', [['Mohinga', 'rice_noodles:200 catfish:80 chickpea_flour:15 lemongrass:5 stock:250', 'burmese fish noodle soup', 'bowl'], ['Lahpet thoke', 'cabbage:60 tomato:40 peanuts:20 sesame:5 green_tea:20 oil:10', 'tea leaf salad'], ['Shan noodles', 'rice_noodles:220 chicken_thigh:80 tomato:40 peanuts:10 oil:10', 'shan khauk swe', 'bowl'], ['Ohn no khao swe', 'egg_noodles:200 chicken_stewed:80 coconut_milk:80 chickpea_flour:10', 'burmese coconut noodle soup', 'bowl']], AS);
C('Nepal', 'Nepali', ['=Dal bhat', '=Thukpa', '=Momo (momos, dumplings nepali)', ['Sel roti', 'rice_flour:60 sugar:10 oil:15 milk:20', 'nepali rice doughnut', 'piece'], ['Aloo tama', 'potato:120 bamboo:60 black_beans:60 tomato:40 oil:8', 'nepali potato bamboo curry'], ['Chatamari', 'rice_flour:60 egg:30 beef_mince:40 onion:15', 'newari rice crepe', 'piece']], AS);
C('North Korea', 'North Korean', [['Pyongyang naengmyeon', 'soba:220 beef:60 egg_boiled:25 cucumber:20 stock:300', 'cold noodles pyongyang', 'bowl'], ['Injogogi bap', 'tofu:150 rice:200 chili:3 soy:10', 'tofu rice north korea', 'plate'], ['Kimchi (North Korean)', 'cabbage:150 chili:5 garlic:3', 'baek kimchi']], AS);
C('Oman', 'Omani', [['Shuwa', 'lamb:180 chili_powder:3 garlic:5 vinegar:5', 'omani slow-roasted lamb'], ['Majboos (Omani)', 'rice:260 chicken_thigh:140 tomato:40 onion:30 oil:15', 'omani majboos', 'plate'], ['Omani halwa', 'sugar:40 cornstarch:20 ghee:15 almonds:5 cardamom:1', 'halwa omani', 'portion'], ['Mashuai', 'fish:180 rice:220 lime:10', 'kingfish with rice oman', 'plate']], AS);
C('Pakistan', 'Pakistani', ['=Chicken karahi', '=Haleem', '=Nihari', '=Seekh kebab', '=Chapli kebab', '=Chicken handi', '=Aloo keema', '=Daal chawal', '=Chicken pulao', ['Sajji', 'chicken_leg:220 rice:150 salt:2', 'balochi sajji', 'plate'], ['Halwa puri', 'flour:80 oil:20 semolina:40 sugar:25 ghee:10 chickpeas:80', 'pakistani breakfast', 'plate'], ['Pakistani doodh patti', 'black_tea:100 milk:150 sugar:10', 'doodh patti chai', 'cup']], AS);
C('Palestine', 'Palestinian', ['=Musakhan', '=Maqluba', ['Palestinian falafel', 'chickpeas:150 parsley:20 onion:20 oil:30 garlic:5', 'falafel palestinian', 'serving (5)'], ['Fattet hummus', 'chickpeas:120 pita:60 yogurt:100 tahini:15 olive_oil:10', 'fatteh palestinian', 'bowl'], ['Knafeh (Palestinian)', 'phyllo:40 mozzarella:50 butter:15 sugar:20', 'kunafa nablusia', 'slice']], AS);
C('Philippines', 'Filipino', ['=Chicken adobo', '=Pork adobo', '=Pork sinigang', '=Kare-kare', '=Pancit canton', '=Chicken tinola', '=Lechon kawali', '=Lumpia shanghai', '=Chicken inasal', '=Tapsilog', ['Halo-halo', 'ice_cream:60 evaporated:40 sugar:15 kidney:30 banana:40 water:60', 'halo halo', 'glass'], ['Ginataang gulay', 'pumpkin:120 green_beans:60 coconut_milk:80 onion:20', 'vegetables in coconut milk']], AS);
C('Qatar', 'Qatari', [['Machboos (Qatar)', 'rice:260 lamb:130 tomato:40 onion:30 oil:15', 'qatari machboos', 'plate'], ['Harees', 'barley:150 chicken_stewed:100 butter:10', 'harees qatar', 'bowl'], ['Thareed', 'bread:60 lamb:100 potato:60 zucchini:40 tomato:40 water:150', 'tharid', 'bowl'], ['Luqaimat', 'flour:50 oil:15 honey:20 sesame:3', 'luqaimat dumplings', 'serving (5)']], AS);
C('Saudi Arabia', 'Saudi', ['=Kabsa', '=Lamb kabsa', '=Mandi', '=Chicken mandi', ['Jareesh', 'barley:150 chicken_stewed:80 yogurt:50 butter:10', 'jarish', 'bowl'], ['Mutabbaq', 'flour:60 egg:50 beef_mince:50 onion:15 oil:15', 'saudi stuffed pancake', 'piece'], ['Arabic coffee with dates', 'coffee:80 dates:30 cardamom:1', 'gahwa and dates', 'serving']], AS);
C('Singapore', 'Singaporean', ['=Hainanese chicken rice', '=Chilli crab', '=Hokkien mee', ['Kaya toast with eggs', 'bread:60 coconut_milk:15 sugar:15 egg:30 butter:10 egg_poached:50', 'kaya toast', 'set'], ['Bak kut teh', 'pork_shoulder:150 garlic:10 black_pepper:2 stock:300 rice:150', 'pork rib soup', 'bowl'], ['Singapore laksa', 'rice_noodles:200 shrimp:50 tofu:30 coconut_milk:100 stock:200 curry:4', 'katong laksa', 'bowl']], AS);
C('South Korea', 'Korean', ['=Bulgogi', '=Beef bibimbap', '=Kimchi fried rice', '=Japchae', '=Kimbap', '=Kimchi jjigae', '=Sundubu jjigae', '=Dak galbi', '=Korean fried chicken', '=Samgyetang', ['Tteokbokki', 'rice_short:150 sriracha:25 sugar:8 stock:80 onion:15', 'spicy rice cakes', 'serving'], ['Hotteok', 'flour:60 brown_sugar:15 peanuts:5 oil:10', 'korean sweet pancake', 'piece']], AS);
C('Sri Lanka', 'Sri Lankan', ['=Kottu roti', '=Chicken kottu', '=Egg hoppers', '=Lamprais', '=Fish ambul thiyal', '=Rice and curry', ['Pol sambol', 'coconut_meat:60 chili:5 onion:15 lime:5', 'coconut sambol', 'portion'], ['Parippu', 'red_lentils:150 coconut_milk:60 onion:20 oil:5', 'sri lankan dhal curry']], AS);
C('Syria', 'Syrian', [['Syrian kibbeh', 'bulgur:80 lamb_mince:100 onion:20 oil:15 pistachio:5', 'kibbeh halabieh', 'serving (3)'], ['Shish barak', 'flour:70 beef_mince:60 yogurt:120 mint:1', 'syrian dumplings in yogurt'], ['Fatteh (Syrian)', 'chickpeas:120 pita:60 yogurt:100 tahini:15', 'fatteh shamieh', 'bowl'], ['Muhammara (Aleppo)', 'red_pepper:100 walnuts:30 breadcrumbs:15 olive_oil:15', 'aleppo muhammara', 'portion (100 g)'], ['Halawet el jibn', 'semolina:40 mozzarella:40 sugar:25 cream:20', 'syrian cheese rolls', 'serving (2)']], AS);
C('Tajikistan', 'Tajik', [['Oshi palov', 'rice:250 lamb:110 carrots:70 chickpeas:30 oil:20', 'tajik plov', 'plate'], ['Qurutob', 'bread:80 yogurt:120 onion:30 tomato:40 cucumber:40 oil:10', 'qurutob', 'bowl'], ['Sambusa (Tajik)', 'flour:70 lamb_mince:60 onion:20 butter:10', 'tajik samsa', 'serving (2)']], AS);
C('Thailand', 'Thai', ['=Pad thai with chicken', '=Thai green curry with chicken', '=Tom yum', '=Tom kha gai', '=Som tam', '=Massaman curry', '=Pad krapow with pork', '=Mango sticky rice', '=Khao man gai', '=Moo ping', '=Tofu pad thai', ['Thai iced tea', 'black_tea:200 condensed:30 evaporated:20', 'cha yen', 'glass'], ['Khao soi', 'egg_noodles:200 chicken_thigh:100 coconut_milk:100 curry:5 stock:150', 'northern thai curry noodles', 'bowl']], AS);
C('Timor-Leste', 'Timorese', [['Ikan pepes (Timor)', 'fish:160 chili:5 tomato:30 lime:5', 'timorese grilled fish'], ['Batar daan', 'corn:120 pumpkin:80 kidney:60 water:80', 'corn pumpkin mung bean stew'], ['Tukir', 'lamb:150 garlic:5 tamarind:5', 'timor slow-cooked meat']], AS);
C('Türkiye', 'Turkish', ['=Lahmacun', '=Adana kebab', '=Iskender kebab', '=Doner kebab wrap', '=Menemen', '=Cheese pide', '=Manti', '=Imam bayildi', '=Kisir', '=Mercimek kofte', '=Cheese borek', '=Baklava', '=Turkish breakfast', ['Turkish tea', 'black_tea:100 sugar:5', 'çay', 'glass'], ['Simit', 'flour:90 sesame:10 molasses:8 water:40', 'turkish sesame bagel', 'piece'], ['Mercimek çorbası', 'red_lentils:120 onion:30 carrots:30 butter:10 water:200', 'turkish lentil soup', 'bowl']], AS);
C('Turkmenistan', 'Turkmen', [['Palaw (Turkmen)', 'rice:250 lamb:110 carrots:60 oil:20', 'turkmen plov', 'plate'], ['Ishlekli', 'flour:100 lamb_mince:80 onion:20 butter:10', 'turkmen meat pie', 'slice'], ['Unash', 'pasta:120 kidney:80 tomato:40 water:200', 'turkmen noodle soup', 'bowl']], AS);
C('United Arab Emirates', 'Emirati', [['Al harees', 'barley:150 chicken_stewed:100 butter:10', 'harees uae', 'bowl'], ['Machboos (Emirati)', 'rice:260 chicken_thigh:140 tomato:40 oil:15', 'emirati machboos', 'plate'], ['Luqaimat (Emirati)', 'flour:50 oil:15 dates:15 sesame:3', 'emirati date syrup dumplings', 'serving (5)'], ['Khameer', 'flour:70 dates:15 sugar:5 water:40', 'emirati bread', 'piece']], AS);
C('Uzbekistan', 'Uzbek', ['=Plov', ['Samsa', 'flour:80 lamb_mince:70 onion:30 butter:10', 'uzbek samsa', 'serving (2)'], ['Shurpa', 'lamb:120 potato:80 carrots:40 tomato:40 water:250', 'uzbek lamb soup', 'bowl'], ['Lagman (Uzbek)', 'pasta:200 beef:100 green_pepper:40 tomato:40 oil:10', 'uzbek laghman', 'bowl']], AS);
C('Vietnam', 'Vietnamese', ['=Beef pho', '=Chicken pho', '=Banh mi', '=Bun cha', '=Bun bo hue', '=Bun thit nuong', '=Com tam', '=Bo luc lac', '=Ca kho to', '=Canh chua', '=Goi cuon', '=Tofu banh mi', ['Ca phe sua da', 'coffee:100 condensed:30', 'vietnamese iced coffee', 'glass'], ['Banh xeo', 'rice_flour:60 coconut_milk:40 shrimp:40 pork_shoulder:30 sprouts_cooked:30 oil:15', 'vietnamese crepe', 'piece']], AS);
C('Yemen', 'Yemeni', ['=Mandi', '=Chicken mandi', ['Saltah', 'lamb:80 potato:80 tomato:50 fenugreek:15 stock:100', 'saltah yemen', 'bowl'], ['Fahsa', 'lamb:120 tomato:40 stock:80 fenugreek:10', 'yemeni lamb stew'], ['Bint al sahn', 'flour:60 butter:20 egg:15 honey:20', 'honey cake yemen', 'slice'], ['Shafut', 'yogurt:120 bread:40 cucumber:20 mint:1', 'yemeni yogurt bread']], AS);

// ======================= EUROPE (44) =======================
const EUR = 'Europe';
C('Albania', 'Albanian', [['Tavë kosi', 'lamb:130 yogurt:120 egg:30 rice:30 butter:10', 'baked lamb with yogurt'], ['Byrek', 'phyllo:70 spinach:80 feta:40 butter:15', 'albanian burek', 'slice'], ['Fërgesë', 'red_pepper:100 tomato:80 feta:60 olive_oil:10', 'fergese'], ['Flija', 'flour:60 cream:40 butter:15 water:40', 'flia', 'slice']], EUR);
C('Andorra', 'Andorran', [['Escudella', 'chicken_thigh:80 sausage:50 chickpeas:60 potato:60 cabbage:50 pasta:30 water:200', 'escudella i carn dolla', 'bowl'], ['Trinxat', 'potato:150 cabbage_cooked:100 bacon:25 olive_oil:8', 'andorran trinxat'], ['Crema catalana (Andorra)', 'milk:120 egg:25 sugar:20 cornstarch:8', 'crema catalana', 'bowl']], EUR);
C('Austria', 'Austrian', ['=Wiener schnitzel', ['Tafelspitz', 'pot_roast:170 potato:120 carrots:40 stock:80', 'boiled beef austria', 'plate'], ['Kaiserschmarrn', 'flour:60 egg:60 milk:80 sugar:15 butter:15 raisins:10', 'shredded pancake', 'portion'], ['Apfelstrudel', 'phyllo:40 apple:100 sugar:15 butter:12 raisins:10 cinnamon:1', 'apple strudel', 'slice'], ['Sachertorte', 'dark_choc:25 flour:20 butter:20 sugar:20 egg:20 jam:10', 'sacher cake', 'slice']], EUR);
C('Belarus', 'Belarusian', [['Draniki', 'potato:150 egg:20 flour:10 onion:15 oil:15 sour_cream:30', 'potato pancakes belarus', 'serving (3)'], ['Machanka with blini', 'pork_shoulder:100 sausage:40 sour_cream:40 flour:50 milk:80 egg:20', 'machanka', 'plate'], ['Kalduny', 'potato:120 pork_ground:60 onion:15', 'belarusian dumplings', 'serving']], EUR);
C('Belgium', 'Belgian', [['Moules-frites', 'mussels:250 fries:150 butter:10 onion:20 celery_raw:20', 'mussels and fries', 'plate'], ['Carbonnade flamande', 'beef:160 onion:60 brown_sugar:10 mustard:5 bread:20', 'flemish beef stew'], ['Belgian waffle', 'flour:50 milk:50 egg:20 butter:15 sugar:15', 'liege waffle', 'piece'], ['Stoemp', 'potato:150 carrots:60 butter:10 sausage:80', 'belgian mash with sausage', 'plate']], EUR);
C('Bosnia and Herzegovina', 'Bosnian', [['Ćevapi', 'beef_mince:150 onion:30 pita:80', 'cevapcici bosnia', 'serving (10)'], ['Burek (Bosnian)', 'phyllo:80 beef_mince:70 onion:20 oil:15', 'bosnian meat burek', 'slice'], ['Begova čorba', 'chicken_stewed:100 carrots:30 celery:20 cream:20 water:250', 'bey soup', 'bowl'], ['Tufahija', 'apple:150 walnuts:20 sugar:20 cream:20', 'bosnian stuffed apple', 'piece']], EUR);
C('Bulgaria', 'Bulgarian', [['Shopska salad', 'tomato:100 cucumber:80 red_pepper:40 feta:40 onion:15 olive_oil:10', 'shopska salata'], ['Banitsa', 'phyllo:70 feta:50 egg:30 yogurt:30 butter:10', 'banica', 'slice'], ['Kavarma', 'pork_shoulder:150 onion:40 mushrooms:40 tomato:40 oil:10', 'bulgarian kavarma'], ['Tarator', 'yogurt:150 cucumber:80 walnuts:10 dill:2 water:80', 'cold cucumber soup', 'bowl']], EUR);
C('Croatia', 'Croatian', [['Peka', 'lamb:120 potato:120 carrots:40 olive_oil:10', 'croatian peka'], ['Crni rižot', 'rice_short:220 squid:100 olive_oil:15 onion:20', 'black risotto', 'plate'], ['Štrukli', 'flour:60 cottage:80 egg:20 cream:30 butter:10', 'zagorski strukli', 'portion'], ['Pašticada', 'beef:160 prunes:15 tomato:40 onion:30 gnocchi:150', 'dalmatian beef stew', 'plate']], EUR);
C('Czechia', 'Czech', [['Svíčková', 'pot_roast:150 cream:40 carrots:40 bread:80', 'beef sirloin in cream sauce', 'plate'], ['Vepřo knedlo zelo', 'pork_roast:140 bread:80 sauerkraut:100', 'pork dumplings sauerkraut', 'plate'], ['Smažený sýr', 'cheddar:100 breadcrumbs:20 egg:20 oil:15 fries:120', 'fried cheese czech', 'plate'], ['Trdelník', 'flour:60 sugar:15 butter:10 cinnamon:1 walnuts:5', 'trdlo', 'piece']], EUR);
C('Denmark', 'Danish', [['Smørrebrød with herring', 'rye_bread:60 herring:60 onion:15 butter:8', 'danish open sandwich', 'serving (2)'], ['Frikadeller', 'pork_ground:100 beef_mince:40 egg:15 breadcrumbs:10 oil:10 potato:150', 'danish meatballs', 'plate'], ['Stegt flæsk med persillesovs', 'bacon:80 potato:200 milk:80 flour:8 butter:8 parsley:5', 'pork belly with parsley sauce', 'plate'], ['Danish pastry', 'puff_pastry:60 sugar:10 butter:5 jam:10', 'wienerbrød', 'piece']], EUR);
C('Estonia', 'Estonian', [['Verivorst (Estonia)', 'sausage:120 barley:60 potato:100 jam:15', 'estonian sausage plate', 'plate'], ['Mulgipuder', 'potato:150 barley:60 bacon:20 onion:15', 'potato barley mash'], ['Kama with kefir', 'kefir:200 barley:20 oats:15 sugar:8', 'kama', 'bowl']], EUR);
C('Finland', 'Finnish', [['Karjalanpiirakka', 'rye_bread:40 rice:60 milk:40 butter:10 egg:20', 'karelian pasties', 'serving (2)'], ['Lohikeitto', 'salmon:100 potato:100 cream:40 leeks:30 water:150', 'finnish salmon soup', 'bowl'], ['Poronkäristys', 'beef:150 butter:10 mash:180', 'sautéed reindeer (shown as beef)', 'plate'], ['Korvapuusti', 'flour:50 butter:15 sugar:12 milk:20 cinnamon:1', 'finnish cinnamon bun', 'piece']], EUR);
C('France', 'French', ['=Quiche lorraine', '=Croque monsieur', '=Croque madame', '=Ratatouille', '=Cassoulet', '=Bouillabaisse', '=Steak frites', '=Salade niçoise', '=French onion soup', '=Crème brûlée', '=Ham and cheese crêpe', ['Croissant with coffee', 'croissant:60 coffee:150 milk:30', 'petit dejeuner', 'set'], ['Tarte tatin', 'pie_crust:40 apple:100 sugar:20 butter:12', 'upside-down apple tart', 'slice'], ['Pain au chocolat', 'puff_pastry:60 dark_choc:12', 'chocolatine', 'piece']], EUR);
C('Germany', 'German', ['=Pork schnitzel', '=Chicken schnitzel', '=Bratwurst with sauerkraut', '=Currywurst with fries', '=Sauerbraten', '=Beef rouladen', '=Käsespätzle', '=German potato salad', '=Kartoffelpuffer', ['Black Forest cake (alcohol-free)', 'sponge:50 cream:40 cherries:30 dark_choc:10 sugar:10', 'schwarzwälder kirschtorte', 'slice'], ['Brezel with butter', 'flour:90 water:50 butter:10 salt:2', 'pretzel bavarian', 'piece'], ['Maultaschen', 'pasta:120 pork_ground:50 spinach:40 onion:15 stock:150', 'swabian dumplings', 'bowl']], EUR);
C('Greece', 'Greek', ['=Moussaka', '=Pastitsio', '=Spanakopita', '=Beef stifado', '=Keftedes', '=Fasolada', '=Gemista', '=Chicken souvlaki pita', '=Pork gyros plate', '=Tzatziki', '=Greek salad with chicken', ['Horiatiki', 'tomato:120 cucumber:100 feta:60 olives:20 onion:20 olive_oil:15', 'greek village salad'], ['Loukoumades', 'flour:50 honey:25 oil:15 cinnamon:1 water:30', 'greek honey doughnuts', 'serving (5)'], ['Galaktoboureko', 'phyllo:30 milk:100 semolina:20 sugar:25 egg:20 butter:10', 'greek custard pie', 'slice']], EUR);
C('Holy See (Vatican City)', 'Vatican', [['Fettuccine alla papalina', 'pasta:250 ham_slice:40 cream:40 egg:30 parmesan:15 peas:30', 'papal fettuccine', 'plate'], ['Saltimbocca alla romana', 'veal_loin:150 ham_slice:30 butter:10', 'roman saltimbocca'], ['Supplì', 'rice_short:100 marinara:30 mozzarella:25 breadcrumbs:15 oil:15', 'roman rice croquettes', 'serving (2)']], EUR);
C('Hungary', 'Hungarian', ['=Hungarian goulash', '=Chicken paprikash', ['Lángos', 'flour:80 oil:20 sour_cream:30 cheddar:30 garlic:3 water:40', 'hungarian fried bread', 'piece'], ['Töltött káposzta', 'cabbage_cooked:120 pork_ground:80 rice:50 sauerkraut:60 sour_cream:30', 'hungarian stuffed cabbage', 'serving (2)'], ['Dobos torte', 'sponge:50 dark_choc:15 butter:15 sugar:15', 'dobos cake', 'slice']], EUR);
C('Iceland', 'Icelandic', [['Plokkfiskur', 'haddock:120 potato:120 milk:40 butter:10 onion:20', 'icelandic fish stew'], ['Kjötsúpa', 'lamb:110 potato:80 carrots:40 cabbage:40 water:250', 'icelandic lamb soup', 'bowl'], ['Skyr with berries', 'greek_yogurt:170 blueberries:60 sugar:5', 'skyr', 'bowl'], ['Rúgbrauð with smoked salmon', 'rye_bread:60 smoked_salmon:50 butter:8', 'icelandic rye bread', 'serving']], EUR);
C('Ireland', 'Irish', [['Irish stew', 'lamb:130 potato:150 carrots:50 onion:30 water:100', 'irish lamb stew', 'bowl'], ['Colcannon', 'potato:200 cabbage_cooked:60 butter:15 milk:30', 'irish colcannon'], ['Boxty', 'potato:150 flour:30 milk:40 butter:10', 'irish potato pancake', 'serving (2)'], ['Irish breakfast', 'sausage:80 bacon:40 egg_fried:50 tomato:50 baked_beans:80 bread:30', 'full irish', 'plate'], ['Irish soda bread', 'flour:60 buttermilk:40 butter:5', 'soda bread', 'slice']], EUR);
C('Italy', 'Italian', ['=Spaghetti carbonara', '=Margherita pizza', '=Lasagne, homemade', '=Penne arrabbiata', '=Pasta al pesto', '=Fettuccine alfredo', '=Mushroom risotto', '=Chicken parmigiana', '=Eggplant parmigiana', '=Minestrone', '=Caprese salad', '=Tiramisu', '=Panna cotta', '=Spaghetti marinara', '=Vegetable lasagne', '=Vegetarian pizza', ['Pasta e fagioli', 'pasta:80 kidney:120 tomato_canned:60 olive_oil:10 onion:15 water:150', 'pasta fazool', 'bowl'], ['Cannoli', 'flour:30 ricotta:50 sugar:15 oil:10 dark_choc:5', 'sicilian cannoli', 'serving (2)'], ['Gelato (vanilla)', 'ice_cream:120', 'italian gelato', 'scoop (2)'], ['Affogato (alcohol-free)', 'ice_cream:70 coffee:40', 'affogato al caffè', 'serving']], EUR);
C('Latvia', 'Latvian', [['Grey peas with bacon', 'split_peas:180 bacon:30 onion:20', 'pelēkie zirņi ar speķi'], ['Sklandrausis', 'rye_bread:40 potato:50 carrots:50 sugar:10 butter:8', 'latvian carrot pie', 'piece'], ['Rasols', 'potato:100 beets:60 herring:40 sour_cream:40 pickles:20', 'latvian potato salad']], EUR);
C('Liechtenstein', 'Liechtenstein', [['Käsknöpfle', 'flour:100 egg:50 milk:30 swiss:50 onion:30 butter:10', 'liechtenstein cheese dumplings', 'plate'], ['Ribel', 'cornmeal:80 milk:150 butter:10 sugar:5', 'liechtenstein corn dish', 'bowl'], ['Hafalaab', 'flour:60 bacon:40 cabbage_cooked:60 water:150', 'liechtenstein dumpling soup', 'bowl']], EUR);
C('Lithuania', 'Lithuanian', [['Cepelinai', 'potato:200 pork_ground:60 sour_cream:30 bacon:15', 'zeppelins lithuania', 'serving (2)'], ['Šaltibarščiai', 'kefir:200 beets:80 cucumber:40 egg_boiled:25 dill:2', 'cold beet soup', 'bowl'], ['Kugelis', 'potato:200 bacon:30 egg:20 milk:30 onion:20', 'potato pudding'], ['Šakotis', 'flour:20 egg:25 butter:15 sugar:15', 'tree cake', 'slice']], EUR);
C('Luxembourg', 'Luxembourgish', [['Judd mat Gaardebounen', 'ham_slice:120 fava:150 potato:100 cream:20', 'smoked pork with broad beans', 'plate'], ['Gromperekichelcher', 'potato:150 onion:20 egg:20 flour:10 oil:15', 'luxembourg potato fritters', 'serving (3)'], ['Bouneschlupp', 'green_beans:150 potato:80 bacon:20 cream:20 water:150', 'green bean soup', 'bowl']], EUR);
C('Malta', 'Maltese', [['Pastizzi', 'puff_pastry:60 ricotta:40 peas:20', 'maltese pastizzi', 'serving (2)'], ['Rabbit stew (Maltese)', 'chicken_thigh:150 tomato_canned:80 potato:80 peas:30 olive_oil:10', 'stuffat tal-fenek (shown with chicken)'], ['Ftira', 'bread:100 tuna:50 tomato:40 olives:10 capers:5 olive_oil:10', 'maltese ftira', 'sandwich'], ['Timpana', 'pasta:150 beef_mince:70 egg:25 puff_pastry:40 marinara:60', 'maltese pasta pie', 'slice']], EUR);
C('Moldova', 'Moldovan', [['Mămăligă with cheese', 'cornmeal:100 water:200 feta:50 sour_cream:30', 'mamaliga', 'plate'], ['Plăcinte', 'flour:70 cottage:60 butter:10 egg:15', 'moldovan pies', 'piece'], ['Zeamă', 'chicken_stewed:100 pasta:40 carrots:30 onion:20 water:250', 'moldovan chicken soup', 'bowl'], ['Sarmale (Moldova)', 'cabbage_cooked:100 pork_ground:70 rice:40 sour_cream:30', 'moldovan cabbage rolls', 'serving (3)']], EUR);
C('Monaco', 'Monégasque', [['Barbagiuan', 'flour:50 spinach:50 ricotta:30 oil:15', 'monaco fritters', 'serving (3)'], ['Socca', 'chickpea_flour:60 water:100 olive_oil:10', 'chickpea pancake', 'serving'], ['Stocafi', 'salt_cod:120 tomato:80 olives:15 olive_oil:12', 'monaco stockfish stew']], EUR);
C('Montenegro', 'Montenegrin', [['Njeguški pršut plate', 'ham_slice:60 feta:40 olives:15 bread:40', 'montenegrin prosciutto', 'plate'], ['Kačamak', 'cornmeal:80 potato:80 feta:40 butter:15 water:150', 'kacamak'], ['Crni rižot (Montenegro)', 'rice_short:220 squid:100 olive_oil:15', 'black risotto montenegro', 'plate']], EUR);
C('Netherlands', 'Dutch', ['=Stamppot', ['Bitterballen', 'beef:50 flour:15 butter:10 breadcrumbs:15 oil:15', 'dutch bitterballen', 'serving (5)'], ['Erwtensoep', 'split_peas:150 sausage:50 potato:50 carrots:30 water:150', 'snert; dutch pea soup', 'bowl'], ['Poffertjes', 'flour:50 milk:60 egg:15 butter:10 icing_sugar:10', 'mini dutch pancakes', 'serving (10)'], ['Stroopwafel', 'flour:20 butter:8 sugar:10 molasses:8', 'syrup waffle', 'piece'], ['Haring with onions', 'herring:100 onion:20 pickles:15', 'hollandse nieuwe']], EUR);
C('North Macedonia', 'Macedonian', [['Tavče gravče', 'kidney:200 onion:30 red_pepper:20 oil:15 paprika:2', 'macedonian baked beans'], ['Ajvar with bread', 'red_pepper:100 eggplant:40 oil:15 bread:60', 'ajvar', 'serving'], ['Pastrmajlija', 'flour:100 pork_shoulder:60 egg:25 water:50', 'macedonian meat pie', 'slice']], EUR);
C('Norway', 'Norwegian', [['Fårikål', 'lamb:150 cabbage_cooked:150 black_pepper:1 potato:120', 'mutton and cabbage', 'plate'], ['Kjøttkaker', 'beef_mince:130 potato:150 gravy:60 peas:40', 'norwegian meatcakes', 'plate'], ['Laks with potatoes', 'salmon:160 potato:150 butter:10 dill:2', 'norwegian salmon', 'plate'], ['Brunost on bread', 'bread:40 cheddar:20 butter:5', 'brown cheese sandwich', 'slice'], ['Skillingsbolle', 'flour:50 butter:15 sugar:12 milk:20 cinnamon:1', 'norwegian cinnamon bun', 'piece']], EUR);
C('Poland', 'Polish', ['=Bigos', '=Gołąbki', '=Potato pierogi', ['Żurek', 'rye_bread:20 sausage:60 egg_boiled:50 potato:60 water:250 sour_cream:20', 'sour rye soup', 'bowl'], ['Kotlet schabowy', 'pork_tenderloin:150 breadcrumbs:20 egg:15 oil:15 potato:150 cabbage:60', 'polish pork cutlet', 'plate'], ['Placki ziemniaczane', 'potato:150 egg:20 flour:10 oil:15 sour_cream:20', 'polish potato pancakes', 'serving (3)'], ['Pączki', 'flour:50 sugar:10 egg:10 oil:15 jam:15', 'polish doughnuts', 'piece']], EUR);
C('Portugal', 'Portuguese', ['=Bacalhau à Brás', '=Pastel de nata', '=Piri piri chicken', '=Francesinha', '=Caldo verde', '=Bitoque', ['Bifana', 'pork_shoulder:100 roll:80 garlic:3 mustard:5', 'portuguese pork sandwich', 'sandwich'], ['Arroz de marisco', 'rice:200 shrimp:60 mussels:50 crab:40 tomato:50 olive_oil:12 water:100', 'seafood rice portugal', 'plate'], ['Grilled sardines (Portuguese)', 'sardine:150 potato:150 olive_oil:10 red_pepper:40', 'sardinhas assadas', 'plate']], EUR);
C('Romania', 'Romanian', [['Sarmale', 'cabbage_cooked:100 pork_ground:80 rice:40 sour_cream:30', 'romanian cabbage rolls', 'serving (3)'], ['Mici', 'beef_mince:100 pork_ground:50 garlic:5 mustard:10 bread:40', 'mititei', 'serving (4)'], ['Ciorbă de burtă', 'tripe:120 sour_cream:40 egg:15 vinegar:5 water:250', 'tripe soup romania', 'bowl'], ['Papanași', 'cottage:80 flour:30 egg:20 oil:15 sour_cream:30 jam:20', 'romanian doughnuts', 'serving']], EUR);
C('Russia', 'Russian', ['=Beef stroganoff', '=Blini', '=Shashlik', '=Borscht', ['Pelmeni with sour cream', 'flour:90 beef_mince:50 pork_ground:40 onion:15 sour_cream:30', 'russian pelmeni', 'serving (15)'], ['Olivier salad', 'potato:100 carrots:30 peas:30 egg_boiled:30 pickles:20 ham_slice:40 mayo:30', 'russian salad', 'portion'], ['Shchi', 'cabbage:120 potato:60 carrots:30 beef:50 sour_cream:20 water:250', 'cabbage soup', 'bowl'], ['Syrniki (Russian)', 'cottage:150 egg:25 flour:25 sugar:10 oil:12', 'tvorog pancakes', 'serving (3)']], EUR);
C('San Marino', 'Sammarinese', [['Torta Tre Monti', 'flour:20 butter:12 sugar:12 dark_choc:10 hazelnut:5', 'three towers cake', 'slice'], ['Piadina', 'flour:70 olive_oil:8 water:35 ham_slice:30 mozzarella:30', 'piadina romagnola', 'piece'], ['Nidi di rondine', 'pasta:150 ham_slice:30 mozzarella:40 marinara:60', 'swallow nests pasta', 'portion']], EUR);
C('Serbia', 'Serbian', [['Ćevapčići', 'beef_mince:150 onion:30 bread:60', 'cevapi serbia', 'serving (10)'], ['Pljeskavica', 'beef_mince:150 pork_ground:30 onion:20 bread:70', 'serbian burger', 'sandwich'], ['Sarma (Serbian)', 'cabbage_cooked:100 pork_ground:70 rice:40', 'serbian cabbage rolls', 'serving (3)'], ['Karađorđeva šnicla', 'pork_tenderloin:150 cream_cheese:40 breadcrumbs:20 oil:15', 'karadjordje schnitzel']], EUR);
C('Slovakia', 'Slovak', [['Bryndzové halušky', 'potato:120 flour:60 feta:60 bacon:20', 'potato dumplings with sheep cheese', 'plate'], ['Kapustnica', 'sauerkraut:150 sausage:50 mushrooms:20 sour_cream:20 water:200', 'slovak cabbage soup', 'bowl'], ['Lokše', 'potato:100 flour:30 butter:10', 'slovak potato flatbread', 'piece']], EUR);
C('Slovenia', 'Slovenian', [['Kranjska klobasa', 'sausage:150 sauerkraut:80 mustard:10 bread:40', 'carniolan sausage', 'plate'], ['Jota', 'sauerkraut:120 kidney:100 potato:60 bacon:20 water:200', 'slovenian bean soup', 'bowl'], ['Potica', 'flour:40 walnuts:20 sugar:15 butter:10 milk:15', 'slovenian nut roll', 'slice']], EUR);
C('Spain', 'Spanish', ['=Seafood paella', '=Chicken paella', '=Mixed paella', '=Gambas al ajillo', '=Albóndigas', '=Gazpacho', '=Ham croquetas', '=Fabada asturiana', '=Patatas bravas', '=Spanish omelette', '=Churros with chocolate', ['Pisto', 'zucchini:100 red_pepper:60 tomato:80 onion:30 olive_oil:15', 'spanish ratatouille'], ['Pan con tomate', 'baguette:60 tomato:50 olive_oil:10', 'pa amb tomaquet', 'serving'], ['Pulpo a la gallega', 'squid:150 potato:100 olive_oil:12 paprika:2', 'galician octopus']], EUR);
C('Sweden', 'Swedish', ['=Swedish meatballs', ['Gravlax with potatoes', 'smoked_salmon:80 potato:150 mustard:10 dill:2', 'gravad lax', 'plate'], ['Raggmunk', 'potato:150 flour:20 milk:50 egg:20 bacon:30 jam:15', 'swedish potato pancakes', 'serving'], ['Kanelbulle', 'flour:50 butter:15 sugar:12 milk:20 cinnamon:1', 'swedish cinnamon bun', 'piece'], ['Ärtsoppa', 'split_peas:150 ham_slice:40 onion:20 water:200', 'swedish pea soup', 'bowl']], EUR);
C('Switzerland', 'Swiss', ['=Rösti', ['Cheese fondue (alcohol-free)', 'swiss:120 gouda:60 bread:100 cornstarch:5 milk:60', 'fondue', 'serving'], ['Raclette', 'swiss:100 potato:200 pickles:30 onion:20', 'swiss raclette', 'plate'], ['Zürcher Geschnetzeltes', 'veal_loin:150 mushrooms:50 cream:50 butter:10', 'zurich veal in cream'], ['Birchermüesli', 'oats:50 yogurt:100 apple:60 milk:50 hazelnut:10', 'bircher muesli', 'bowl']], EUR);
C('Ukraine', 'Ukrainian', ['=Borscht', '=Chicken kiev', '=Varenyky with potato', '=Syrniki', ['Holubtsi', 'cabbage_cooked:100 pork_ground:70 rice:40 tomato_canned:50 sour_cream:20', 'ukrainian cabbage rolls', 'serving (3)'], ['Deruny', 'potato:150 onion:20 egg:20 flour:10 oil:15 sour_cream:30', 'ukrainian potato pancakes', 'serving (3)'], ['Banosh', 'cornmeal:80 sour_cream:60 feta:40 bacon:15 water:100', 'hutsul cornmeal', 'plate']], EUR);
C('United Kingdom', 'British', ['=Fish and chips', '=Full English breakfast', '=Sunday roast', '=Shepherd’s pie', '=Cottage pie', '=Bangers and mash', '=Beans on toast', '=Cornish pasty', '=Toad in the hole', '=Steak and kidney pie', '=Chicken and mushroom pie', '=Jacket potato with cheese', '=Kedgeree', '=Sticky toffee pudding', '=Apple crumble', '=Eton mess', ['Scones with jam and cream', 'flour:60 butter:15 milk:25 sugar:8 jam:20 cream:25', 'cream tea', 'serving (2)'], ['Victoria sponge', 'sponge:70 jam:15 cream:20', 'victoria sandwich', 'slice'], ['English breakfast tea with milk', 'black_tea:220 milk:30', 'cuppa', 'cup'], ['Haggis, neeps and tatties', 'lamb_mince:120 oats:30 carrots:80 potato:150 butter:10', 'haggis (shown with lamb and oats)', 'plate'], ['Welsh cawl', 'lamb:110 potato:100 leeks:40 carrots:40 water:200', 'cawl', 'bowl']], EUR);

// ======================= NORTH & CENTRAL AMERICA, CARIBBEAN (23) =======================
const NA = 'North America & Caribbean';
C('Antigua and Barbuda', 'Antiguan', [['Fungee and pepperpot', 'cornmeal:80 okra:40 water:150 beef:80 spinach:60 pumpkin:50 eggplant:40', 'antigua national dish', 'plate'], ['Ducana', 'sweet_potato:120 coconut_meat:30 flour:20 sugar:10', 'antiguan sweet potato dumpling', 'piece'], ['Saltfish with chop up', 'salt_cod:80 eggplant:80 spinach:60 okra:30 oil:10', 'antigua saltfish']], NA);
C('The Bahamas', 'Bahamian', [['Conch salad', 'squid:120 tomato:40 onion:20 green_pepper:20 lime:15', 'bahamian conch salad (shown with squid)'], ['Cracked conch with fries', 'squid:130 flour:20 oil:20 fries:120', 'cracked conch', 'plate'], ['Peas and rice (Bahamian)', 'rice:200 split_peas:60 bacon:15 tomato_paste:10', 'bahamian peas n rice', 'plate'], ['Guava duff', 'guava:80 flour:40 butter:15 sugar:20', 'bahamian guava duff', 'slice']], NA);
C('Barbados', 'Barbadian', [['Cou-cou and flying fish', 'cornmeal:80 okra:50 water:150 fish:130 tomato:40 onion:20', 'bajan cou cou', 'plate'], ['Macaroni pie', 'pasta:150 cheddar:50 egg:20 milk:40 mustard:3', 'bajan macaroni pie', 'slice'], ['Fish cakes (Bajan)', 'salt_cod:60 flour:40 onion:10 oil:20', 'bajan fishcakes', 'serving (4)'], ['Pudding and souse', 'sweet_potato:150 pork_shoulder:100 lime:10 cucumber:30 onion:15', 'bajan pudding and souse', 'plate']], NA);
C('Belize', 'Belizean', [['Rice and beans with stew chicken', 'rice:200 kidney:80 coconut_milk:30 chicken_thigh:130 onion:20', 'belize stew chicken', 'plate'], ['Hudut', 'fish:150 coconut_milk:100 plantain:150', 'garifuna hudut', 'plate'], ['Fry jacks', 'flour:60 oil:15 water:35', 'belize fry jacks', 'serving (2)'], ['Garnaches', 'corn_tortilla:60 refried:50 cheddar:20 cabbage:20 oil:10', 'belizean garnaches', 'serving (3)']], NA);
C('Canada', 'Canadian', ['=Poutine', '=Butter tart', '=Tourtière', ['Nanaimo bar', 'dark_choc:15 butter:15 icing_sugar:20 coconut_meat:10', 'nanaimo', 'piece'], ['Peameal bacon sandwich', 'pork_tenderloin:100 roll:80 mustard:5', 'back bacon sandwich', 'sandwich'], ['Montreal-style bagel with cream cheese', 'bagel:90 cream_cheese:30', 'montreal bagel', 'bagel'], ['Pancakes with maple syrup', 'pancake:150 maple:40 butter:8', 'canadian pancakes', 'plate']], NA);
C('Costa Rica', 'Costa Rican', ['=Gallo pinto', ['Casado', 'rice:180 black_beans:100 chicken_thigh:100 plantain_fried:60 cabbage:40', 'costa rican casado', 'plate'], ['Olla de carne', 'beef:120 potato:80 yam:60 corn:60 carrots:40 water:250', 'costa rica beef soup', 'bowl'], ['Arroz con leche (Costa Rica)', 'rice:80 milk:150 sugar:20 cinnamon:1', 'rice pudding costa rica', 'bowl']], NA);
C('Cuba', 'Cuban', ['=Ropa vieja', '=Moros y cristianos', '=Cuban sandwich', '=Picadillo with rice', ['Lechón asado', 'pork_roast:170 oj:20 garlic:5', 'cuban roast pork'], ['Tostones', 'plantain_fried:150 salt:1', 'fried green plantains'], ['Yuca con mojo', 'cassava_cooked:200 olive_oil:15 garlic:5 lime:10', 'cuban yuca'], ['Batido de mamey', 'papaya:150 milk:150 sugar:15', 'mamey shake cuba', 'glass']], NA);
C('Dominica', 'Dominican (Dominica)', [['Callaloo soup (Dominica)', 'spinach:150 okra:50 coconut_milk:60 crab:40 water:150', 'dominica callaloo', 'bowl'], ['Bakes and saltfish (Dominica)', 'flour:80 oil:20 salt_cod:60 tomato:30', 'dominica bakes', 'plate'], ['Provisions with stew chicken', 'yam:100 taro:100 plantain:80 chicken_thigh:120', 'dominica provisions', 'plate']], NA);
C('Dominican Republic', 'Dominican', ['=Mangú', ['La bandera', 'rice:200 kidney:100 chicken_thigh:120 lettuce:30 tomato:30', 'dominican flag lunch', 'plate'], ['Los tres golpes', 'plantain:150 sausage:60 egg_fried:50 cheddar:30 onion:20', 'mangu con los tres golpes', 'plate'], ['Sancocho dominicano', 'chicken_stewed:80 pork_shoulder:50 yam:80 cassava_cooked:80 plantain:60 corn:50 water:200', 'dominican sancocho', 'bowl'], ['Habichuelas con dulce', 'kidney:100 milk:100 sweet_potato:50 sugar:25 coconut_milk:30', 'sweet cream of beans', 'bowl']], NA);
C('El Salvador', 'Salvadoran', [['Pupusas de queso', 'masa:90 water:60 mozzarella:50 cabbage:30', 'cheese pupusas', 'serving (2)'], ['Pupusas revueltas', 'masa:90 water:60 pork_shoulder:40 refried:40 mozzarella:30', 'pupusas', 'serving (2)'], ['Yuca frita con chicharrón', 'cassava_cooked:180 pork_shoulder:60 cabbage:40 oil:15', 'yuca con chicharron', 'plate'], ['Sopa de pata', 'beef:100 corn:60 yam:60 cassava_cooked:60 water:250', 'salvadoran soup', 'bowl']], NA);
C('Grenada', 'Grenadian', [['Oil down', 'breadfruit_cooked:150 salt_cod:50 coconut_milk:80 spinach:40 chicken_thigh:60', 'grenada oil down', 'plate'], ['Lambie souse', 'squid:120 lime:10 cucumber:30 onion:15', 'conch souse grenada'], ['Nutmeg ice cream', 'ice_cream:100 cinnamon:0.5', 'grenadian ice cream', 'scoop (2)']], NA);
C('Guatemala', 'Guatemalan', [['Pepián', 'chicken_thigh:150 tomato:60 pumpkin:20 sesame:5 chili:5 rice:150', 'pepian de pollo', 'plate'], ['Jocón', 'chicken_thigh:150 green_pepper:40 coriander:10 rice:150', 'green chicken stew', 'plate'], ['Kak’ik', 'turkey:150 tomato:60 chili:5 water:200', 'turkey soup guatemala', 'bowl'], ['Rellenitos', 'plantain:120 black_beans:40 sugar:10 oil:10', 'plantain with beans dessert', 'serving (2)']], NA);
C('Haiti', 'Haitian', ['=Griot', '=Diri ak pwa', '=Legim', ['Soup joumou', 'pumpkin:150 beef:80 pasta:40 potato:50 cabbage:30 water:200', 'haitian pumpkin soup', 'bowl'], ['Pikliz with fried plantain', 'cabbage:60 carrots:30 vinegar:10 chili:3 plantain_fried:120', 'bannann peze ak pikliz', 'plate'], ['Akasan', 'cornmeal:40 milk:200 sugar:15 cinnamon:1', 'haitian corn drink', 'glass']], NA);
C('Honduras', 'Honduran', [['Baleadas', 'flour_tortilla:80 refried:60 cheddar:25 sour_cream:20', 'honduran baleada', 'serving (2)'], ['Plato típico', 'beef_sirloin:120 rice:150 refried:80 plantain_fried:60 sour_cream:20', 'honduran typical plate', 'plate'], ['Sopa de caracol', 'squid:120 coconut_milk:100 cassava_cooked:60 plantain:60 water:150', 'conch soup honduras', 'bowl']], NA);
C('Jamaica', 'Jamaican', ['=Jerk chicken', '=Ackee and saltfish', '=Curry goat', '=Rice and peas', '=Brown stew chicken', '=Stew peas with rice', '=Jamaican curry chicken', '=Escovitch fish', '=Jamaican festival', '=Bammy', '=Callaloo', ['Jamaican beef patty', 'flour:60 butter:15 beef_mince:60 onion:10 curry:2', 'beef patty', 'patty'], ['Ital stew', 'kidney:100 pumpkin:80 sweet_potato:60 carrots:40 coconut_milk:80', 'rastafarian ital stew (vegan)'], ['Sorrel drink', 'roselle:10 ginger:5 sugar:25 water:250', 'jamaican sorrel (alcohol-free)', 'glass']], NA);
C('Mexico', 'Mexican', ['=Chicken tacos', '=Al pastor tacos', '=Carne asada tacos', '=Chicken enchiladas', '=Cheese quesadilla', '=Pozole rojo', '=Chicken mole poblano', '=Huevos rancheros', '=Chilaquiles rojos', '=Cochinita pibil', '=Elote', '=Flan', '=Tres leches cake', ['Horchata', 'rice:40 milk:100 water:150 sugar:20 cinnamon:1', 'agua de horchata', 'glass'], ['Agua de jamaica', 'roselle:8 sugar:20 water:250', 'hibiscus water', 'glass'], ['Bean and vegetable tacos', 'corn_tortilla:90 black_beans:100 red_pepper:40 onion:20 salsa:30 avocado:30', 'vegan tacos mexico', 'serving (3)'], ['Champurrado', 'masa:25 milk:200 dark_choc:15 sugar:10', 'mexican chocolate atole', 'cup']], NA);
C('Nicaragua', 'Nicaraguan', ['=Gallo pinto', ['Nacatamal', 'masa:100 pork_shoulder:60 rice:20 potato:30 tomato:20 oil:10', 'nicaraguan tamal', 'piece'], ['Vigorón', 'cassava_cooked:150 pork_shoulder:60 cabbage:60 tomato:20 vinegar:5', 'vigoron', 'plate'], ['Indio viejo', 'beef:100 masa:30 tomato:40 onion:20 oj:20', 'nicaraguan beef stew']], NA);
C('Panama', 'Panamanian', [['Sancocho panameño', 'chicken_stewed:120 yam:120 corn:40 coriander:5 water:250', 'panama sancocho', 'bowl'], ['Arroz con pollo (Panama)', 'rice:220 chicken_thigh:110 peas:30 red_pepper:20 oil:12', 'panamanian chicken rice', 'plate'], ['Carimañolas', 'cassava_cooked:120 beef_mince:50 oil:15', 'cassava fritters panama', 'serving (2)'], ['Patacones', 'plantain_fried:150 salt:1', 'panama tostones']], NA);
C('Saint Kitts and Nevis', 'Kittitian', [['Stewed saltfish with spicy plantain', 'salt_cod:80 tomato:50 onion:20 oil:10 plantain:150 coconut_meat:30', 'st kitts national dish', 'plate'], ['Goat water', 'goat:120 tomato:50 breadfruit_cooked:60 water:250', 'kittitian goat stew', 'bowl'], ['Coconut dumplings', 'flour:60 coconut_meat:30 water:30', 'st kitts dumplings', 'serving']], NA);
C('Saint Lucia', 'Saint Lucian', [['Green fig and saltfish', 'banana:200 salt_cod:80 onion:20 oil:10', 'saint lucia national dish', 'plate'], ['Bouyon', 'kidney:60 beef:60 yam:60 flour:30 water:250', 'saint lucian soup', 'bowl'], ['Accra (Saint Lucia)', 'salt_cod:50 flour:40 oil:15', 'saltfish fritters', 'serving (4)']], NA);
C('Saint Vincent and the Grenadines', 'Vincentian', [['Roasted breadfruit and jackfish', 'breadfruit_cooked:200 fish:150 oil:10 lime:5', 'vincy national dish', 'plate'], ['Callaloo soup (Saint Vincent)', 'spinach:150 okra:40 coconut_milk:50 water:150', 'vincentian callaloo', 'bowl'], ['Buljol', 'salt_cod:80 tomato:40 onion:20 olive_oil:10 bread:50', 'saltfish buljol', 'plate']], NA);
C('Trinidad and Tobago', 'Trinidadian', ['=Doubles', '=Pelau', '=Chicken roti, Trinidad', '=Goat roti', '=Channa and aloo roti', '=Bake and saltfish', '=Stew chicken with rice and peas', ['Bake and shark', 'flour:80 oil:20 fish:120 lettuce:20 tomato:20', 'bake n shark', 'sandwich'], ['Trini macaroni pie', 'pasta:150 cheddar:50 egg:20 evaporated:40', 'macaroni pie trinidad', 'slice'], ['Sorrel (Trinidad)', 'roselle:10 sugar:25 cinnamon:1 water:250', 'trini sorrel', 'glass']], NA);
C('United States of America', 'American', ['=Cheeseburger', '=Mac and cheese', '=BBQ ribs', '=Pulled pork sandwich', '=Fried chicken with fries', '=Philly cheesesteak', '=Chicken Caesar salad', '=Jambalaya', '=Buffalo wings', '=Pancakes with bacon and syrup', '=Eggs Benedict', '=New York cheesecake', '=Apple pie', '=Chocolate brownie', ['Peanut butter and jelly sandwich (homemade)', 'bread:70 peanut_butter:30 jam:20', 'pb&j', 'sandwich'], ['Vegan Buddha burger', 'veggie_patty:100 burger_bun:60 lettuce:15 tomato:20 avocado:30', 'plant-based burger', 'burger'], ['Milkshake (vanilla)', 'ice_cream:120 milk:150', 'vanilla shake', 'glass'], ['Iced coffee with milk', 'coffee:200 milk:60 sugar:8', 'american iced coffee', 'glass']], NA);

// ======================= SOUTH AMERICA (12) =======================
const SA = 'South America';
C('Argentina', 'Argentinian', ['=Milanesa', '=Locro', '=Carbonada', '=Choripán', '=Beef empanadas', '=Churrasco', ['Asado plate', 'flank:150 sausage:50 parsley:5 olive_oil:8 tomato:40 lettuce:30', 'argentine asado', 'plate'], ['Provoleta', 'provolone:100 oregano:0.5 olive_oil:5', 'grilled provolone'], ['Alfajores', 'flour:30 cornstarch:20 butter:15 condensed:20 coconut_meat:5', 'dulce de leche cookies', 'serving (2)'], ['Mate', 'green_tea:250', 'yerba mate', 'cup']], SA);
C('Bolivia', 'Bolivian', ['=Salteñas', ['Silpancho', 'beef_sirloin:120 breadcrumbs:20 rice:150 potato:100 egg_fried:50 tomato:30', 'bolivian silpancho', 'plate'], ['Pique a lo macho', 'beef_sirloin:120 sausage:50 fries:120 egg_boiled:30 tomato:30 chili:5', 'bolivian pique', 'plate'], ['Sopa de maní', 'peanuts:40 beef:60 potato:60 pasta:30 water:250', 'peanut soup bolivia', 'bowl'], ['Api morado with pastel', 'cornmeal:40 sugar:20 water:200 cinnamon:1 flour:30 oil:10', 'purple corn drink with pastry', 'set']], SA);
C('Brazil', 'Brazilian', ['=Feijoada', '=Pão de queijo', '=Coxinha', '=Moqueca', '=Acarajé', '=Bobó de camarão', '=Strogonoff de frango', '=Feijão tropeiro', '=Brigadeiro', '=Rice, beans and steak', ['Açaí bowl', 'blueberries:100 banana:60 granola:30 honey:10', 'acai na tigela (shown with berries)', 'bowl'], ['Pastel de feira', 'flour:60 beef_mince:50 oil:20', 'brazilian pastel', 'piece'], ['Caipirinha-style limeade (alcohol-free)', 'lime:40 sugar:20 water:200', 'limonada suíça', 'glass'], ['Vegan feijoada', 'black_beans:200 sweet_potato:80 mushrooms:60 kale:40 onion:20 oil:10 rice:150', 'feijoada vegana', 'plate']], SA);
C('Chile', 'Chilean', ['=Pastel de choclo', '=Cazuela', ['Completo', 'sausage:60 roll:70 avocado:40 tomato:30 mayo:20', 'chilean hot dog', 'hot dog'], ['Porotos granados', 'pinto:150 corn:80 pumpkin:80 onion:20 basil:3', 'chilean bean stew'], ['Sopaipillas', 'flour:50 pumpkin:30 oil:15', 'chilean pumpkin fritters', 'serving (2)'], ['Mote con huesillo', 'barley:60 apricot_dried:40 sugar:20 water:200', 'chilean peach drink', 'glass']], SA);
C('Colombia', 'Colombian', ['=Bandeja paisa', '=Ajiaco', '=Arepa with cheese', ['Sancocho colombiano', 'chicken_stewed:100 yam:80 plantain:80 corn:50 cassava_cooked:60 water:200', 'colombian sancocho', 'bowl'], ['Arepa de huevo', 'masa:70 egg:50 oil:15 beef_mince:20', 'egg arepa', 'piece'], ['Lechona', 'pork_roast:150 rice:100 peas:30', 'colombian stuffed pork', 'plate'], ['Changua', 'milk:200 egg_poached:50 bread:30 onion:5', 'colombian milk egg soup', 'bowl']], SA);
C('Ecuador', 'Ecuadorian', [['Encebollado', 'tuna_steak:120 cassava_cooked:100 onion:30 tomato:30 water:200', 'ecuador fish soup', 'bowl'], ['Llapingachos', 'potato:150 cheddar:30 peanut_butter:15 egg_fried:50 sausage:40', 'ecuadorian potato patties', 'plate'], ['Bolón de verde', 'plantain:150 cheddar:30 butter:8', 'plantain dumpling ecuador', 'piece'], ['Ceviche ecuatoriano', 'shrimp:150 tomato:60 lime:20 onion:20 oj:20', 'ecuador shrimp ceviche', 'bowl']], SA);
C('Guyana', 'Guyanese', [['Guyanese pepperpot', 'beef:150 cinnamon:1 brown_sugar:8 chili:3 onion:20 bread:60', 'pepper pot guyana', 'plate'], ['Cook-up rice', 'rice:220 split_peas:60 coconut_milk:60 chicken_thigh:80', 'guyanese cook up', 'plate'], ['Metemgee', 'cassava_cooked:100 plantain:80 yam:60 coconut_milk:80 salt_cod:40', 'metemgee', 'bowl'], ['Guyanese roti and curry', 'flour:90 oil:15 water:40 chicken_thigh:120 curry:5 potato:50', 'guyana roti', 'plate']], SA);
C('Paraguay', 'Paraguayan', [['Sopa paraguaya', 'cornmeal:60 cheddar:40 onion:30 milk:50 egg:20 butter:10', 'paraguayan cornbread', 'slice'], ['Chipa', 'tapioca:50 cheddar:30 egg:15 butter:8 milk:15', 'paraguay cheese bread', 'serving (2)'], ['Bori bori', 'chicken_stewed:100 cornmeal:40 cheddar:20 water:250', 'chicken dumpling soup paraguay', 'bowl'], ['Tereré', 'green_tea:250 mint:1', 'cold yerba mate', 'cup']], SA);
C('Peru', 'Peruvian', ['=Lomo saltado', '=Ceviche', '=Ají de gallina', '=Causa limeña', '=Anticuchos', '=Arroz chaufa', '=Pollo a la brasa with fries', '=Tacu tacu', '=Chupe de camarones', ['Papa a la huancaína', 'potato:180 cheddar:30 evaporated:30 chili:5 egg_boiled:25', 'huancaina potatoes'], ['Chicha morada', 'pineapple:40 sugar:20 water:200 cinnamon:1', 'purple corn drink', 'glass'], ['Quinoa stew (vegan)', 'quinoa:180 potato:60 pumpkin:60 peas:30 onion:20 oil:8', 'quinoa atamalada vegan']], SA);
C('Suriname', 'Surinamese', [['Pom', 'taro:150 chicken_thigh:100 oj:20 tomato:30 butter:10', 'surinamese pom', 'slice'], ['Moksi alesi', 'rice:200 kidney:60 salt_cod:40 chicken_thigh:50 oil:10', 'mixed rice suriname', 'plate'], ['Roti kip (Suriname)', 'flour:90 split_peas:30 chicken_thigh:110 potato:60 curry:5 oil:12', 'surinamese roti', 'plate']], SA);
C('Uruguay', 'Uruguayan', [['Chivito', 'beef_sirloin:100 ham_slice:30 mozzarella:30 egg_fried:50 bread:80 lettuce:20 tomato:20 mayo:15', 'uruguay chivito', 'sandwich'], ['Asado uruguayo', 'flank:180 sausage:40 bread:30', 'uruguayan barbecue', 'plate'], ['Torta frita', 'flour:60 oil:15 water:30 sugar:5', 'uruguayan fried bread', 'piece']], SA);
C('Venezuela', 'Venezuelan', ['=Pabellón criollo', '=Arepa reina pepiada', '=Arepa with shredded beef', ['Cachapa', 'corn:120 flour:20 mozzarella:50 butter:10', 'corn pancake with cheese', 'piece'], ['Tequeños', 'flour:40 mozzarella:40 oil:15', 'cheese sticks venezuela', 'serving (4)'], ['Hallaca', 'masa:80 pork_shoulder:40 chicken_thigh:30 raisins:5 olives:5 oil:10', 'venezuelan tamal', 'piece']], SA);

// ======================= OCEANIA (14) =======================
const OC = 'Oceania';
C('Australia', 'Australian', ['=Vegemite toast', '=Lamington', '=Pavlova', '=Anzac biscuits', '=Avocado toast', ['Aussie meat pie', 'pie_crust:80 beef_mince:90 gravy:40 onion:15', 'australian meat pie', 'pie'], ['Chicken parmy with chips', 'chicken_fried:160 marinara:60 mozzarella:40 fries:150', 'parma; parmi', 'plate'], ['Barramundi with salad', 'fish:170 lettuce:50 tomato:40 olive_oil:10 lemon:5', 'grilled barramundi', 'plate'], ['Flat white', 'coffee:60 milk:120', 'australian flat white', 'cup']], OC);
C('Fiji', 'Fijian', ['=Kokoda', '=Lovo', ['Rourou', 'spinach:150 coconut_milk:80 onion:20', 'taro leaves in coconut fiji'], ['Fijian fish curry', 'fish:150 curry:5 coconut_milk:60 tomato:40 rice:200', 'fiji indian fish curry', 'plate'], ['Cassava cake (Fiji)', 'cassava_cooked:100 coconut_milk:40 sugar:20', 'fijian cassava pudding', 'slice']], OC);
C('Kiribati', 'I-Kiribati', [['Te bua toro', 'fish:150 coconut_milk:60 rice:200', 'kiribati fish in coconut', 'plate'], ['Palusami (Kiribati)', 'spinach:120 coconut_milk:80 onion:15', 'coconut wrapped greens'], ['Breadfruit chips', 'breadfruit_cooked:150 oil:15', 'kiribati breadfruit fries']], OC);
C('Marshall Islands', 'Marshallese', [['Coconut crab with rice', 'crab:150 coconut_milk:50 rice:200', 'marshall islands crab', 'plate'], ['Bwiro', 'breadfruit_cooked:150', 'preserved breadfruit', 'portion'], ['Fish with breadfruit', 'tuna_steak:150 breadfruit_cooked:150 coconut_milk:40', 'marshallese fish plate', 'plate']], OC);
C('Federated States of Micronesia', 'Micronesian', [['Pohnpei taro and fish', 'taro:150 fish:150 coconut_milk:40', 'micronesia taro fish', 'plate'], ['Kelaguen (Micronesia)', 'chicken_meat:120 lemon:15 coconut_meat:30 onion:15', 'micronesian kelaguen'], ['Breadfruit in coconut', 'breadfruit_cooked:180 coconut_milk:60', 'micronesian breadfruit']], OC);
C('Nauru', 'Nauruan', [['Coconut fish', 'fish:150 coconut_milk:60 lime:10', 'nauru coconut fish'], ['Nauruan fried rice', 'rice:250 egg:50 sausage:40 soy:10 oil:15', 'nauru fried rice', 'plate'], ['Noddy bird with rice (shown as chicken)', 'chicken_thigh:150 rice:200', 'nauru bird and rice', 'plate']], OC);
C('New Zealand', 'New Zealander', ['=Hangi', ['Pāua fritters', 'squid:100 egg:30 flour:20 oil:15', 'paua fritters (shown with squid)', 'serving (2)'], ['Kiwi meat pie', 'pie_crust:80 beef_mince:90 cheddar:20 gravy:30', 'mince and cheese pie', 'pie'], ['Hokey pokey ice cream', 'ice_cream:100 sugar:10', 'hokey pokey', 'scoop (2)'], ['Kūmara and lamb roast', 'lamb_leg:150 sweet_potato:150 carrots:40 gravy:40', 'nz roast lamb', 'plate']], OC);
C('Palau', 'Palauan', [['Taro with fish (Palau)', 'taro:150 fish:150 coconut_milk:40', 'palauan taro', 'plate'], ['Ulkoll', 'tapioca:60 coconut_milk:40 sugar:10', 'palau tapioca pudding', 'bowl'], ['Palauan fish soup', 'fish:120 coconut_milk:50 water:250', 'palau fish soup', 'bowl']], OC);
C('Papua New Guinea', 'Papua New Guinean', [['Mumu', 'pork_shoulder:120 sweet_potato:120 spinach:60 coconut_milk:40', 'png earth oven', 'plate'], ['Sago with fish', 'tapioca:70 fish:120 water:100', 'png sago', 'plate'], ['Kaukau with greens', 'sweet_potato:200 spinach:80 coconut_milk:40', 'sweet potato png (vegan)']], OC);
C('Samoa', 'Samoan', [['Oka', 'fish:150 coconut_milk:80 lime:15 cucumber:30 onion:15', 'samoan raw fish'], ['Palusami', 'spinach:120 coconut_milk:100 onion:15', 'samoan palusami (vegan)'], ['Sapasui', 'rice_noodles:200 beef:80 soy:15 cabbage:40 oil:10', 'samoan chop suey', 'plate'], ['Panipopo', 'flour:50 coconut_milk:50 sugar:15 butter:8', 'samoan coconut buns', 'serving (2)']], OC);
C('Solomon Islands', 'Solomon Islander', [['Poi (Solomon Islands)', 'taro:200 coconut_milk:40', 'solomon taro pudding'], ['Fish in coconut (Solomons)', 'fish:150 coconut_milk:70 onion:15 rice:200', 'solomon fish curry', 'plate'], ['Cassava pudding (Solomons)', 'cassava_cooked:120 coconut_milk:40 sugar:15', 'solomon cassava pudding', 'slice']], OC);
C('Tonga', 'Tongan', [['Ota ika', 'fish:150 coconut_milk:80 lime:15 tomato:30 onion:15', 'tongan raw fish'], ['Lu pulu', 'beef:120 spinach:100 coconut_milk:80 onion:15', 'tongan corned beef in taro leaves'], ['Faikakai topai', 'flour:50 coconut_milk:50 brown_sugar:20', 'tongan dumplings', 'serving']], OC);
C('Tuvalu', 'Tuvaluan', [['Pulaka with fish', 'taro:180 fish:120 coconut_milk:40', 'tuvalu swamp taro', 'plate'], ['Tuvalu coconut tuna', 'tuna_steak:150 coconut_milk:60 lime:10', 'tuvaluan tuna'], ['Fekei', 'taro:120 coconut_meat:30 sugar:10', 'tuvalu pudding', 'portion']], OC);
C('Vanuatu', 'Ni-Vanuatu', [['Laplap', 'yam:150 cassava_cooked:80 coconut_milk:60 pork_shoulder:60', 'vanuatu national dish', 'portion'], ['Simboro', 'cassava_cooked:120 spinach:40 coconut_milk:50', 'vanuatu leaf parcels', 'serving'], ['Tuluk', 'cassava_cooked:120 pork_ground:60 coconut_milk:30', 'vanuatu tuluk', 'piece']], OC);

// ======================= TERRITORIES & DISTINCT FOOD MARKETS =======================
const TE = 'Territories';
C('Taiwan', 'Taiwanese', [['Beef noodle soup', 'egg_noodles:220 beef:120 pak_choi:40 soy:15 stock:350', 'niu rou mian', 'bowl'], ['Lu rou fan', 'rice:220 pork_ground:100 soy:15 egg_boiled:30 sugar:5', 'braised pork rice', 'bowl'], ['Bubble tea', 'black_tea:200 milk:60 tapioca:30 sugar:20', 'boba milk tea', 'glass'], ['Gua bao', 'flour:60 pork_shoulder:60 peanuts:10 sugar:5 pickles:10', 'taiwanese pork bun', 'piece']], TE);
C('Kosovo', 'Kosovar', [['Flija (Kosovo)', 'flour:60 cream:40 butter:15 water:40', 'kosovo flia', 'slice'], ['Pite', 'phyllo:70 beef_mince:60 onion:20 butter:15', 'kosovar pie', 'slice'], ['Tavë prizreni', 'lamb:120 eggplant:60 tomato:50 green_pepper:30 olive_oil:10', 'prizren casserole']], TE);
C('Cook Islands', 'Cook Islands', [['Ika mata', 'fish:150 coconut_milk:80 lime:15 tomato:30 cucumber:30', 'cook islands raw fish'], ['Rukau', 'spinach:150 coconut_milk:80', 'taro leaves in coconut (vegan)'], ['Poke (Cook Islands)', 'banana:150 tapioca:30 coconut_milk:40', 'cook islands banana pudding', 'portion']], TE);
C('Niue', 'Niuean', [['Takihi', 'taro:120 papaya:100 coconut_milk:60', 'niue takihi', 'portion'], ['Niue fish in coconut', 'fish:150 coconut_milk:60 lime:10'], ['Uga with rice (shown as crab)', 'crab:150 coconut_milk:40 rice:200', 'coconut crab niue', 'plate']], TE);
C('Hong Kong', 'Hong Kong', [['Wonton noodles', 'egg_noodles:200 shrimp:60 pork_ground:30 stock:300', 'hong kong wonton mein', 'bowl'], ['Pineapple bun with butter', 'flour:60 sugar:15 butter:15 egg:10', 'bolo bao', 'piece'], ['Hong Kong milk tea', 'black_tea:180 evaporated:50 sugar:10', 'silk stocking tea', 'cup'], ['Egg tart (Hong Kong)', 'pie_crust:30 egg:30 milk:40 sugar:12', 'dan tat', 'piece'], ['Cheung fun', 'rice_flour:60 water:80 shrimp:40 soy:10', 'rice noodle rolls', 'serving']], TE);
C('Macau', 'Macanese', [['Minchi', 'beef_mince:100 pork_ground:40 potato:80 soy:10 egg_fried:50 rice:150', 'macanese minchi', 'plate'], ['Portuguese egg tart (Macau)', 'puff_pastry:30 egg:25 milk:40 cream:15 sugar:12', 'pastel de nata macau', 'piece'], ['Pork chop bun', 'pork_tenderloin:100 roll:70 soy:5', 'zhu pa bao', 'sandwich']], TE);
C('Puerto Rico', 'Puerto Rican', ['=Arroz con gandules', '=Pastelón', ['Mofongo con camarones', 'plantain_fried:200 shrimp:100 garlic:5 olive_oil:10', 'shrimp mofongo', 'plate'], ['Alcapurrias', 'banana:80 taro:40 beef_mince:50 oil:15', 'puerto rican fritters', 'serving (2)'], ['Coquito-style coconut drink (alcohol-free)', 'coconut_milk:80 condensed:40 evaporated:60 cinnamon:1', 'coquito sin alcohol', 'glass']], TE);
C('Greenland', 'Greenlandic', [['Suaasat', 'lamb:120 barley:40 onion:20 water:250', 'greenlandic soup (shown with lamb)', 'bowl'], ['Greenland halibut with potatoes', 'fish:160 potato:150 butter:10', 'kalaalit fish', 'plate'], ['Musk ox stew (shown as beef)', 'beef:150 potato:80 carrots:40 gravy:40', 'greenland stew']], TE);
C('French Polynesia', 'Tahitian', [['Poisson cru', 'fish:150 coconut_milk:80 lime:15 cucumber:30 tomato:30', 'tahitian raw fish'], ['Tahitian fish with taro', 'fish:150 taro:150 coconut_milk:30', 'tahiti fish and taro', 'plate'], ['Po’e', 'banana:120 tapioca:30 coconut_milk:40 sugar:10', 'tahitian fruit pudding', 'portion']], TE);
C('Guam', 'Chamorro', [['Chicken kelaguen', 'chicken_meat:130 lemon:15 coconut_meat:30 onion:15 chili:3', 'kelaguen mannok'], ['Red rice (Chamorro)', 'rice:250 tomato_paste:5 oil:8 onion:15', 'hineksa agaga', 'plate'], ['Chamorro BBQ plate', 'chicken_leg:150 pork_shoulder:60 rice:200 soy:10', 'guam barbecue', 'plate']], TE);
C('Aruba', 'Aruban', [['Keshi yena', 'cheddar:60 gouda:40 chicken_meat:80 olives:10 raisins:5 tomato:30', 'stuffed cheese aruba'], ['Pastechi', 'flour:60 beef_mince:50 cheddar:20 oil:20', 'aruban pastechi', 'piece'], ['Funchi', 'cornmeal:80 water:150 butter:8', 'aruban cornmeal']], TE);
C('Curaçao', 'Curaçaoan', [['Stoba', 'goat:150 papaya:60 onion:20 tomato:30', 'curacao goat stew'], ['Funchi with fish', 'cornmeal:80 water:150 fish:130', 'curacao funchi', 'plate'], ['Keshi yena (Curaçao)', 'gouda:100 chicken_meat:80 tomato:30 olives:10', 'curacao stuffed cheese']], TE);
C('Bermuda', 'Bermudian', [['Bermuda fish chowder', 'fish:120 tomato_canned:80 potato:60 onion:20 carrots:20 water:200', 'bermudian chowder', 'bowl'], ['Codfish and potatoes', 'salt_cod:100 potato:200 banana:60 avocado:40 tomato:40', 'bermuda sunday breakfast', 'plate'], ['Fish sandwich (Bermuda)', 'fish:120 bread:80 cabbage:30 mayo:15', 'bermuda fish sandwich', 'sandwich']], TE);
C('New Caledonia', 'New Caledonian', [['Bougna', 'chicken_thigh:120 yam:100 sweet_potato:80 banana:60 coconut_milk:60', 'kanak bougna', 'portion'], ['Venison curry (shown as beef)', 'beef:150 curry:5 coconut_milk:50 rice:200', 'new caledonia curry', 'plate'], ['Coconut crab salad', 'crab:120 lettuce:50 lime:10 coconut_milk:20', 'new caledonian crab salad']], TE);
C('Réunion', 'Réunionese', [['Rougail saucisse', 'sausage:120 tomato:100 onion:30 ginger:3 rice:200', 'reunion rougail', 'plate'], ['Cari poulet', 'chicken_thigh:150 tomato:60 turmeric:2 onion:30 rice:200', 'reunion chicken curry', 'plate'], ['Samoussas (Réunion)', 'flour:50 beef_mince:40 onion:15 oil:20', 'reunion samosas', 'serving (3)']], TE);
C('Martinique', 'Martinican', [['Colombo de poulet', 'chicken_thigh:150 curry:5 eggplant:40 potato:60 rice:200', 'martinique colombo', 'plate'], ['Accras de morue', 'salt_cod:50 flour:40 oil:15 chili:2', 'cod fritters', 'serving (4)'], ['Féroce d’avocat', 'avocado:100 salt_cod:40 cassava_cooked:40 chili:3', 'martinique feroce']], TE);
C('Guadeloupe', 'Guadeloupean', [['Bokit', 'flour:70 oil:15 water:35 salt_cod:40 tomato:20', 'guadeloupe bokit', 'sandwich'], ['Court-bouillon de poisson', 'fish:160 tomato:60 onion:20 lime:10 water:100', 'guadeloupe fish stew'], ['Blaff', 'fish:150 lime:15 onion:15 water:200', 'guadeloupe blaff', 'bowl']], TE);
C('Western Sahara', 'Sahrawi', [['Sahrawi couscous', 'couscous:200 lamb:100 carrots:40 zucchini:40 chickpeas:30', 'sahrawi couscous', 'plate'], ['Sahrawi tea', 'green_tea:150 mint:2 sugar:15', 'atay sahrawi', 'glass'], ['Camel meat stew (shown as beef)', 'beef:150 onion:30 tomato:40 oil:10', 'sahrawi meat stew']], TE);

// ======================= DESSERTS & DRINKS FROM EVERYWHERE (no alcohol) =======================
C('Worldwide desserts', 'International dessert', [['Chocolate mousse', 'dark_choc:40 cream:50 egg:20 sugar:10', 'mousse au chocolat', 'pot'], ['Crêpe Suzette (alcohol-free)', 'flour:30 milk:60 egg:20 butter:10 oj:30 sugar:10', 'orange crepes', 'serving'], ['Profiteroles', 'flour:30 butter:20 egg:30 cream:40 dark_choc:15', 'cream puffs', 'serving (4)'], ['Carrot cake', 'flour:30 carrots:30 sugar:20 oil:15 egg:15 cream_cheese:20 walnuts:5', 'carrot cake with frosting', 'slice'], ['Red velvet cake', 'flour:35 sugar:25 butter:15 egg:15 buttermilk:20 cream_cheese:20 cocoa_powder:3', 'red velvet', 'slice'], ['Fruit salad', 'apple:60 banana:60 strawberries:50 pineapple:50', 'mixed fruit salad', 'bowl'], ['Mango sorbet', 'mango:100 sugar:20 water:30', 'mango sorbet', 'scoop (2)'], ['Bread and butter pudding', 'bread:50 milk:80 egg:25 butter:10 sugar:12 raisins:10', 'bread pudding', 'portion'], ['Cinnamon roll', 'flour:60 butter:15 sugar:15 milk:25 cinnamon:1 cream_cheese:10', 'cinnamon bun', 'piece'], ['Granola bar (homemade)', 'granola:30 butter:5 sugar:15', 'cereal bar homemade', 'piece'], ['Coconut macaroons', 'coconut_meat:40 sugar:15 egg:10', 'macaroons', 'serving (2)'], ['Banana bread', 'flour:35 banana:40 sugar:15 butter:10 egg:10', 'banana loaf', 'slice'], ['Lemon tart', 'pie_crust:40 lemon:15 egg:25 sugar:20 butter:10', 'tarte au citron', 'slice'], ['Pecan pie', 'pie_crust:40 walnuts:25 sugar:25 butter:10 egg:15', 'pecan tart', 'slice'], ['Mochi ice cream', 'sticky_rice:30 ice_cream:40 sugar:5', 'mochi ice', 'serving (2)'], ['Halva', 'tahini:40 sugar:30', 'tahini halva', 'portion'], ['Dulce de leche crepes', 'flour:30 milk:60 egg:20 condensed:30', 'panqueques con dulce de leche', 'serving'], ['Sweet potato pie', 'pie_crust:40 sweet_potato:80 sugar:15 milk:30 egg:15 cinnamon:1', 'soul food sweet potato pie', 'slice'], ['Vegan chocolate cake', 'flour:40 sugar:25 oil:15 cocoa_powder:8 water:40 vinegar:2', 'plant-based chocolate cake', 'slice'], ['Coconut rice pudding (vegan)', 'rice:60 coconut_milk:120 sugar:15', 'vegan rice pudding', 'bowl']], 'Worldwide');
C('Worldwide drinks', 'International drink', [['Fresh orange juice', 'oj:250', 'freshly squeezed orange juice', 'glass'], ['Lemonade (homemade)', 'lemon:40 sugar:25 water:200', 'fresh lemonade', 'glass'], ['Iced tea (homemade)', 'black_tea:250 lemon:10 sugar:15', 'sweet tea', 'glass'], ['Hot chocolate', 'milk:220 cocoa_powder:10 sugar:15', 'hot cocoa', 'cup'], ['Cappuccino', 'coffee:60 milk:120', 'cappuccino', 'cup'], ['Café latte', 'coffee:60 milk:200', 'latte', 'cup'], ['Americano', 'coffee:240', 'black coffee americano', 'cup'], ['Espresso', 'coffee:40', 'espresso shot', 'cup'], ['Green smoothie', 'spinach:40 banana:80 apple:60 water:150', 'green juice smoothie', 'glass'], ['Banana smoothie', 'banana:120 milk:200 honey:10', 'banana shake', 'glass'], ['Strawberry smoothie', 'strawberries:120 yogurt:100 milk:100 honey:8', 'strawberry shake', 'glass'], ['Mango smoothie', 'mango:120 yogurt:100 milk:100', 'mango shake', 'glass'], ['Protein shake with milk', 'milk:250 banana:60 peanut_butter:15', 'homemade protein shake', 'glass'], ['Coconut water (fresh)', 'coconut_water:300', 'young coconut water', 'glass'], ['Watermelon juice (fresh)', 'watermelon:300', 'agua de sandia', 'glass'], ['Sugarcane juice', 'sugarcane:250', 'ganne ka ras; caldo de cana', 'glass'], ['Ginger beer (homemade, alcohol-free)', 'ginger:15 sugar:25 lemon:10 water:250', 'ginger drink', 'glass'], ['Tamarind drink', 'tamarind:30 sugar:25 water:250', 'agua de tamarindo', 'glass'], ['Passion fruit juice', 'passion:60 sugar:20 water:200', 'maracuya juice', 'glass'], ['Guava juice', 'guava:120 sugar:15 water:150', 'guava nectar homemade', 'glass'], ['Lychee drink', 'lychee:100 sugar:10 water:150', 'lychee juice', 'glass'], ['Golden milk', 'milk:220 turmeric:2 honey:8 ginger:2', 'turmeric latte', 'cup'], ['Soy milk tea', 'black_tea:150 soy_milk:100 sugar:8', 'vegan milk tea', 'cup'], ['Kefir drink', 'kefir:250', 'kefir', 'glass'], ['Lassi (sweet)', 'yogurt:150 water:100 sugar:15', 'sweet lassi', 'glass'], ['Salt lassi', 'yogurt:150 water:100 cumin:1', 'namkeen lassi', 'glass'], ['Ayran (homemade)', 'yogurt:150 water:100 salt:1', 'turkish yogurt drink', 'glass']], 'Worldwide');

// ======================= MORE AMERICAN (USA) =======================
C('United States of America', 'American', [
  // Southern & soul food
  ['Fried chicken, collard greens and mac and cheese', 'chicken_fried:180 kale:100 pasta:100 cheddar:40 milk:30 butter:10', 'soul food plate', 'plate'],
  ['Smothered pork chops', 'pork_tenderloin:170 gravy:80 onion:30 flour:10 oil:10', 'southern smothered chops'],
  ['Chicken fried steak with gravy', 'beef_sirloin:150 flour:25 egg:20 oil:20 milk:80 butter:10', 'country fried steak', 'plate'],
  ['Shrimp po’ boy', 'shrimp:120 flour:20 oil:20 baguette:100 lettuce:20 tomato:20 mayo:15', 'po boy sandwich', 'sandwich'],
  ['Red beans and rice', 'kidney:180 sausage:50 rice:200 onion:20 celery_raw:15 green_pepper:15', 'new orleans red beans', 'plate'],
  ['Dirty rice', 'rice:220 beef_mince:60 liver:30 onion:20 green_pepper:20 celery_raw:15 oil:10', 'cajun dirty rice', 'plate'],
  ['Chicken and dumplings', 'chicken_stewed:130 flour:60 milk:40 butter:15 carrots:30 celery:20 stock:200', 'southern chicken and dumplings', 'bowl'],
  ['Hoppin’ John', 'cowpeas:160 rice:180 bacon:20 onion:20', 'hoppin john', 'plate'],
  ['Collard greens with smoked turkey', 'kale:200 turkey:60 onion:20 vinegar:5', 'southern collards'],
  ['Cornbread', 'cornmeal:50 flour:25 buttermilk:50 egg:15 butter:15 sugar:8', 'southern cornbread', 'slice'],
  ['Hush puppies (homemade)', 'cornmeal:50 flour:15 buttermilk:30 oil:20 onion:10', 'hushpuppies', 'serving (5)'],
  ['Fried catfish with fries', 'catfish:160 cornmeal:25 oil:20 fries:150', 'southern fried catfish', 'plate'],
  ['Candied yams', 'sweet_potato:200 brown_sugar:25 butter:15 cinnamon:1', 'candied sweet potatoes'],
  ['Banana pudding', 'banana:80 milk:100 sugar:20 egg:15 cornstarch:8 shortbread:20 whipped:20', 'southern banana pudding', 'bowl'],
  ['Peach cobbler', 'peach:150 flour:40 butter:20 sugar:30 milk:30', 'peach cobbler', 'portion'],
  ['Pecan pie (Southern)', 'pie_crust:40 walnuts:25 brown_sugar:25 butter:12 egg:15', 'southern pecan pie', 'slice'],
  ['Biscuits with honey butter', 'flour:70 butter:25 buttermilk:40 honey:10', 'buttermilk biscuits', 'serving (2)'],
  ['Shrimp boil (homemade)', 'shrimp:200 corn:150 potato:150 sausage:60 butter:20', 'lowcountry boil', 'plate'],
  // Cajun & Creole
  ['Crawfish étouffée', 'shrimp:150 butter:20 flour:15 onion:30 celery_raw:20 green_pepper:20 rice:200', 'etouffee', 'plate'],
  ['Seafood gumbo', 'shrimp:80 crab:50 okra:60 flour:15 oil:15 onion:30 rice:150 stock:200', 'creole seafood gumbo', 'bowl'],
  ['Blackened salmon with rice', 'salmon:160 paprika:3 butter:10 rice:200', 'cajun blackened salmon', 'plate'],
  ['Muffuletta', 'bread:120 ham_slice:40 provolone:30 olives:30 olive_oil:10', 'muffuletta sandwich', 'sandwich'],
  ['Beignets', 'flour:60 oil:20 sugar:8 icing_sugar:15 milk:25 egg:10', 'new orleans beignets', 'serving (3)'],
  // BBQ
  ['Smoked brisket with sides', 'beef_brisket:170 bbq:30 bread:30 potato:100 mayo:15 cabbage:60', 'texas bbq plate', 'plate'],
  ['Pulled pork plate', 'pork_roast:150 bbq:30 cabbage:60 mayo:10 baked_beans:120 bread:30', 'carolina bbq plate', 'plate'],
  ['Baby back ribs with corn', 'ribs:250 bbq:40 corn:120 butter:8', 'bbq ribs and corn', 'plate'],
  ['Burnt ends', 'beef_brisket:150 bbq:35 brown_sugar:8', 'kansas city burnt ends'],
  ['Smoked chicken with mac and cheese', 'chicken_leg:200 pasta:120 cheddar:40 milk:30 butter:8', 'bbq chicken plate', 'plate'],
  ['Baked beans with bacon', 'baked_beans:200 bacon:20 brown_sugar:10', 'bbq baked beans'],
  ['Coleslaw (creamy)', 'cabbage:120 carrots_raw:30 mayo:30 vinegar:5 sugar:5', 'creamy coleslaw', 'portion'],
  ['Potato salad (American)', 'potato:180 mayo:35 egg_boiled:30 celery_raw:15 mustard:5 pickles:10', 'classic potato salad', 'portion'],
  // Tex-Mex
  ['Texas chili', 'beef:170 tomato_canned:80 onion:30 chili_powder:5 cumin:2', 'chili con carne texas', 'bowl'],
  ['Beef fajita plate', 'flank:150 red_pepper:50 onion:40 flour_tortilla:90 rice:120 refried:80 guacamole:30', 'tex-mex fajitas', 'plate'],
  ['Cheese enchiladas with chili gravy', 'corn_tortilla:90 cheddar:70 gravy:60 onion:15 rice:120 refried:80', 'tex-mex enchiladas', 'plate'],
  ['Breakfast tacos', 'flour_tortilla:80 egg_scrambled:100 potato:50 bacon:20 cheddar:20 salsa:20', 'texas breakfast tacos', 'serving (2)'],
  ['Queso dip with chips', 'monterey:80 milk:30 tomato:30 chili:5 taco_shell:60', 'chile con queso', 'serving'],
  ['Frito pie', 'taco_shell:60 beef:80 kidney:40 tomato_canned:40 cheddar:30 onion:10', 'walking taco', 'bowl'],
  // Diner & classics
  ['Classic diner breakfast', 'egg_fried:100 bacon:30 potato:120 bread:60 butter:10 jam:15', 'two eggs any style', 'plate'],
  ['Buttermilk pancakes', 'pancake:150 butter:10 maple:40', 'pancake stack', 'stack (3)'],
  ['Waffles with fried chicken and syrup', 'waffle:90 chicken_fried:120 maple:30', 'chicken and waffles diner', 'plate'],
  ['Western omelette', 'egg:150 ham_slice:40 green_pepper:30 onion:20 cheddar:25 butter:8', 'denver omelette'],
  ['Corned beef hash with eggs', 'beef_brisket:100 potato:150 onion:20 egg_fried:100 oil:10', 'hash and eggs', 'plate'],
  ['Patty melt', 'beef_patty:110 rye_bread:70 swiss:30 onion:40 butter:10', 'patty melt', 'sandwich'],
  ['Grilled cheese and tomato soup', 'bread:70 cheddar:40 butter:10 tomato_canned:200 cream:20', 'grilled cheese with tomato soup', 'meal'],
  ['Meatball sub', 'beef_mince:120 roll:100 marinara:80 mozzarella:30', 'meatball sandwich', 'sandwich'],
  ['Chicken pot pie (homemade)', 'chicken_meat:100 peas:30 carrots:30 milk:60 butter:15 flour:10 pie_crust:60', 'pot pie', 'pie'],
  ['Pot roast with vegetables', 'pot_roast:170 potato:100 carrots:60 onion:30 gravy:40', 'sunday pot roast', 'plate'],
  ['Salisbury steak', 'beef_mince:150 onion:30 gravy:80 mash:180', 'salisbury steak dinner', 'plate'],
  ['Turkey club wrap', 'flour_tortilla:80 turkey:70 bacon:15 lettuce:20 tomato:20 mayo:12', 'turkey wrap', 'wrap'],
  ['Chicken salad sandwich', 'bread:70 chicken_meat:90 mayo:25 celery_raw:15', 'chicken salad on bread', 'sandwich'],
  ['Egg salad sandwich', 'bread:70 egg_boiled:100 mayo:25 mustard:3', 'egg mayo sandwich', 'sandwich'],
  ['BLT (homemade)', 'bread:70 bacon:30 lettuce:20 tomato:40 mayo:15', 'bacon lettuce tomato', 'sandwich'],
  ['Hot dog with mustard and onions', 'sausage:60 burger_bun:50 mustard:8 onion:10', 'classic hot dog', 'hot dog'],
  ['Corn dog', 'sausage:60 cornmeal:30 flour:15 oil:15 milk:15', 'corndog', 'piece'],
  ['Chicken nuggets (homemade)', 'chicken_breast:120 breadcrumbs:25 egg:15 oil:15', 'homemade nuggets', 'serving (6)'],
  ['Onion rings', 'onion:100 flour:25 breadcrumbs:15 oil:20 milk:20', 'beer-free onion rings', 'serving'],
  ['Loaded baked potato', 'potato_baked:250 cheddar:30 bacon:15 sour_cream:30 onion:5', 'loaded potato', 'potato'],
  ['Clam chowder (New England)', 'clams:80 potato:80 milk:150 cream:30 bacon:15 onion:20 butter:8', 'new england chowder', 'bowl'],
  ['Lobster bisque-style crab soup', 'crab:80 cream:60 milk:100 tomato_paste:10 butter:10', 'crab bisque', 'bowl'],
  ['Fish tacos (Baja-style)', 'cod:120 flour:15 oil:12 corn_tortilla:90 cabbage:30 mayo:15 lime:5', 'baja fish tacos usa', 'serving (3)'],
  ['Cobb salad with ranch', 'lettuce:120 chicken_breast:90 bacon:20 egg_boiled:50 avocado:40 blue_cheese:20 mayo:20 buttermilk:10', 'cobb with ranch', 'bowl'],
  ['Wedge salad', 'iceberg:150 blue_cheese:25 bacon:15 tomato:30 mayo:15', 'iceberg wedge'],
  ['Taco salad', 'lettuce:100 beef_mince:90 cheddar:25 tomato:40 taco_shell:30 sour_cream:20 salsa:20', 'tex-mex taco salad', 'bowl'],
  ['Chicken caesar wrap', 'flour_tortilla:80 chicken_breast:90 lettuce:30 parmesan:10 mayo:15', 'caesar wrap', 'wrap'],
  ['Mac and cheese (baked)', 'pasta:180 cheddar:60 milk:80 butter:15 flour:8 breadcrumbs:10', 'baked macaroni and cheese', 'portion'],
  ['Green bean casserole', 'green_beans:150 mushrooms:40 cream:30 milk:30 onion:15 oil:5', 'thanksgiving green beans'],
  ['Mashed potatoes and gravy', 'mash:200 gravy:60', 'mash and gravy'],
  ['Stuffing (homemade)', 'bread:60 butter:15 celery_raw:20 onion:20 stock:60', 'thanksgiving stuffing', 'portion'],
  ['Pumpkin pie', 'pie_crust:40 pumpkin:80 evaporated:40 sugar:20 egg:15 cinnamon:1', 'thanksgiving pumpkin pie', 'slice'],
  // Regional
  ['Hawaiian plate lunch', 'rice:250 chicken_thigh:120 teriyaki:20 pasta:80 mayo:20', 'plate lunch with mac salad', 'plate'],
  ['Loco moco', 'rice:250 beef_patty:110 egg_fried:50 gravy:60', 'hawaiian loco moco', 'plate'],
  ['Kalua pork with rice', 'pork_roast:150 cabbage:40 rice:220', 'kalua pig', 'plate'],
  ['Spam musubi (shown as ham)', 'rice_short:120 ham_slice:50 soy:8 sugar:4 laver:2', 'musubi', 'piece'],
  ['Huli huli chicken', 'chicken_thigh:180 pineapple:20 soy:15 brown_sugar:10 ginger:3', 'hawaiian grilled chicken'],
  ['Chicago deep-dish pizza', 'flour:110 butter:15 mozzarella:90 marinara:80 italian_sausage:40', 'deep dish', 'slice (2)'],
  ['New York-style pizza slice', 'flour:80 water:45 mozzarella:50 marinara:40 olive_oil:5', 'ny pizza', 'slice'],
  ['Italian beef sandwich', 'beef_sirloin:110 roll:100 green_pepper:30 stock:40', 'chicago italian beef', 'sandwich'],
  ['Cincinnati chili spaghetti', 'pasta:200 beef_mince:100 tomato_canned:60 cheddar:30 cinnamon:1 chili_powder:3', 'cincinnati chili', 'plate'],
  ['Hot chicken (Nashville)', 'chicken_fried:180 chili_powder:5 oil:15 bread:30 pickles:15', 'nashville hot chicken', 'plate'],
  ['Philly roast pork sandwich', 'pork_roast:110 roll:100 provolone:30 spinach:40', 'roast pork italian', 'sandwich'],
  ['Maryland crab cake sandwich', 'crab:110 breadcrumbs:15 mayo:15 egg:10 burger_bun:60 oil:10', 'crab cake sandwich', 'sandwich'],
  ['Pastrami on rye', 'beef_brisket:120 rye_bread:70 mustard:10 pickles:20', 'new york pastrami sandwich', 'sandwich'],
  ['Bagel with lox and cream cheese', 'bagel:100 smoked_salmon:50 cream_cheese:30 onion:10 capers:3', 'lox bagel nyc', 'bagel'],
  ['Philly cheesesteak with fries', 'beef_sirloin:120 roll:90 provolone:40 onion:40 oil:8 fries:120', 'cheesesteak meal', 'meal'],
  ['Southwest chicken bowl', 'rice:180 chicken_breast:120 black_beans:80 corn:50 salsa:30 avocado:30 sour_cream:15', 'southwest bowl', 'bowl'],
  ['Poke bowl (Hawaiian)', 'rice_short:200 tuna_raw:110 soy:15 sesame_oil:5 onion:10 avocado:30', 'ahi poke hawaii', 'bowl'],
  ['Clam bake plate', 'clams:150 shrimp:80 corn:120 potato:150 butter:20', 'new england clambake', 'plate'],
  // Health / gym staples
  ['Chicken, rice and broccoli', 'chicken_breast:150 rice:200 broccoli:100 olive_oil:5', 'meal prep chicken rice broccoli', 'container'],
  ['Turkey chili', 'turkey_mince:150 kidney:100 tomato_canned:100 onion:30 chili_powder:4', 'lean turkey chili', 'bowl'],
  ['Egg white omelette with spinach', 'egg_white:150 spinach:50 mushrooms:40 oil:5 tomato:30', 'egg white veggie omelette'],
  ['Protein pancakes', 'oats:50 egg:50 banana:60 greek_yogurt:50', 'oat banana protein pancakes', 'stack'],
  ['Greek yogurt bowl with berries', 'greek_yogurt:200 blueberries:60 granola:30 honey:8', 'protein yogurt bowl', 'bowl'],
  ['Salmon quinoa bowl', 'salmon:140 quinoa:150 avocado:40 cucumber:40 spinach_raw:30 olive_oil:8', 'healthy salmon bowl', 'bowl'],
  ['Tuna salad lettuce wraps', 'tuna:100 mayo:15 celery_raw:15 lettuce:60', 'low carb tuna wraps', 'serving'],
  // Drinks & sweets
  ['Sweet tea (Southern)', 'black_tea:300 sugar:25', 'southern sweet tea', 'glass'],
  ['Root beer float (alcohol-free)', 'ice_cream:70 root_beer:250', 'root beer float', 'glass'],
  ['Chocolate milkshake', 'choc_ice_cream:120 milk:150', 'chocolate shake', 'glass'],
  ['Strawberry milkshake', 'ice_cream:110 strawberries:60 milk:150', 'strawberry shake', 'glass'],
  ['Pumpkin spice latte', 'coffee:60 milk:200 pumpkin:20 sugar:15 cinnamon:1', 'psl', 'cup'],
  ['Chocolate chip cookies', 'flour:30 butter:15 sugar:15 egg:8 dark_choc:12', 'homemade cookies', 'serving (2)'],
  ['Blueberry muffin', 'flour:45 sugar:18 butter:12 egg:12 milk:20 blueberries:25', 'muffin', 'muffin'],
  ['Cinnamon apple pie à la mode', 'pie_crust:40 apple:90 sugar:20 butter:8 cinnamon:1 ice_cream:60', 'apple pie with ice cream', 'serving'],
  ['Key lime pie', 'pie_crust:40 condensed:50 lime:15 egg:15', 'florida key lime pie', 'slice'],
  ['Strawberry shortcake', 'flour:40 butter:15 sugar:15 milk:20 strawberries:80 whipped:30', 'shortcake', 'serving'],
  ['S’mores', 'shortbread:30 dark_choc:15 sugar:10', 'smores', 'serving (2)'],
  ['Funnel cake', 'flour:50 milk:40 egg:15 oil:20 icing_sugar:15', 'fair funnel cake', 'piece'],
], 'North America & Caribbean');

// ======================= MORE DISHES FOR SMALLER FOOD CULTURES (Africa) =======================
C('Botswana', 'Botswanan', [['Beef stew with samp', 'beef:120 corn:120 kidney:60 tomato:30', 'samp and beef', 'plate'], ['Vegetable morogo', 'spinach:150 tomato:40 onion:20 oil:8', 'morogo vegan'], ['Diphaphata', 'flour:70 water:35 oil:5', 'botswana muffins', 'serving (2)']], AF);
C('Burkina Faso', 'Burkinabè', [['Ragout d’igname', 'yam:200 beef:80 tomato:50 onion:20 oil:10', 'yam stew burkina'], ['Gonre', 'cowpeas:150 oil:10 chili:3', 'bean cakes burkina', 'serving'], ['Zoom-koom', 'millet:40 ginger:5 sugar:20 water:250 lemon:5', 'millet ginger drink', 'glass']], AF);
C('Burundi', 'Burundian', [['Mukeke', 'fish:170 tomato:40 onion:20 oil:10 rice:180', 'lake tanganyika perch', 'plate'], ['Burundi chapati', 'flour:70 oil:12 water:35', 'chapati burundi', 'piece'], ['Burundi peanut sauce with cassava', 'cassava_cooked:200 peanuts:30 tomato:40', 'cassava with peanuts (vegan)', 'plate']], AF);
C('Cabo Verde', 'Cape Verdean', [['Cachupa refogada', 'corn:150 kidney:80 egg_fried:50 sausage:40 oil:10', 'fried cachupa breakfast', 'plate'], ['Djagacida', 'corn:150 kidney:100 onion:20 oil:10', 'corn and beans cabo verde (vegan)'], ['Canja de galinha', 'chicken_stewed:120 rice:80 water:250 onion:15', 'cape verde chicken rice soup', 'bowl']], AF);
C('Central African Republic', 'Central African', [['Kanda', 'beef_mince:120 peanut_butter:20 tomato:40 rice:150', 'kanda meatballs peanut', 'plate'], ['Chicken in palm butter (CAR)', 'chicken_thigh:150 palm_oil:20 onion:20 cassava_cooked:150', 'poulet sauce graine', 'plate'], ['Ngago', 'cassava_cooked:250', 'cassava loaf', 'portion']], AF);
C('Chad', 'Chadian', [['Kissar with meat sauce', 'sorghum:80 water:120 beef:80 tomato:40 onion:20', 'kisra chad', 'plate'], ['Bouillie', 'millet:60 milk:150 sugar:10 peanuts:10', 'chadian porridge', 'bowl'], ['Karkanji', 'roselle:10 sugar:25 ginger:3 water:250', 'chad hibiscus drink', 'glass']], AF);
C('Comoros', 'Comorian', [['Mkatra foutra', 'flour:70 coconut_milk:40 sugar:5', 'comorian coconut bread', 'piece'], ['Ntrovi ya nazi', 'fish:150 coconut_milk:80 banana:120', 'fish with green banana coconut', 'plate'], ['Comorian pea curry', 'split_peas:150 coconut_milk:60 curry:3', 'pois au coco (vegan)']], AF);
C('Republic of the Congo', 'Congolese', [['Liboke de poisson', 'fish:170 tomato:40 onion:20 chili:3', 'fish in leaves congo'], ['Mbika', 'peanuts:40 fish:60 spinach:60', 'squash seed paste congo'], ['Chikwangue with grilled fish', 'cassava_cooked:200 fish:150 chili:3', 'kwanga and fish', 'plate']], AF);
C('Djibouti', 'Djiboutian', [['Yetakelt wat (Djibouti)', 'carrots:80 potato:80 green_beans:60 onion:20 oil:10', 'djibouti vegetable stew (vegan)'], ['Djibouti fish with rice', 'fish:160 rice:220 tomato:40 onion:20 cumin:1', 'poisson yemeni djibouti', 'plate'], ['Halwo (Djibouti)', 'sugar:40 cornstarch:20 butter:15 cardamom:1', 'djiboutian halwa', 'portion']], AF);
C('Equatorial Guinea', 'Equatoguinean', [['Fish in banana leaves (Equatorial Guinea)', 'fish:170 tomato:40 onion:20 chili:3', 'fish in leaves'], ['Plantain with peanut sauce', 'plantain:200 peanut_butter:30 tomato:30', 'plátano con cacahuete (vegan)'], ['Tortilla de yuca', 'cassava_cooked:150 egg:50 oil:10', 'cassava omelette']], AF);
C('Eswatini', 'Swazi', [['Sitfubi', 'milk:200 cornmeal:30', 'swazi milk porridge', 'bowl'], ['Swazi chicken stew', 'chicken_thigh:150 tomato:50 potato:60 onion:20 oil:8'], ['Tinkhobe', 'corn:200 salt:1', 'boiled maize', 'cob']], AF);
C('Gabon', 'Gabonese', [['Poulet au coco (Gabon)', 'chicken_thigh:150 coconut_milk:80 tomato:30 rice:180', 'gabon coconut chicken', 'plate'], ['Folon with fish', 'spinach:150 fish:80 peanut_butter:20', 'gabonese greens'], ['Manioc with smoked fish', 'cassava_cooked:200 fish:120', 'gabon cassava fish', 'plate']], AF);
C('The Gambia', 'Gambian', [['Afra', 'beef_sirloin:150 onion:30 mustard:5 bread:60', 'gambian grilled meat', 'plate'], ['Plasas', 'spinach:150 palm_oil:20 fish:60 beef:40 rice:200', 'gambian plasas', 'plate'], ['Wonjo', 'roselle:10 sugar:25 mint:1 water:250', 'gambian hibiscus', 'glass']], AF);
C('Guinea', 'Guinean', [['Poulet yassa (Guinea)', 'chicken_thigh:150 onion:80 lemon:10 mustard:5 rice:200', 'guinea yassa', 'plate'], ['Kansiyé', 'beef:120 peanut_butter:30 tomato:40 rice:200', 'guinean peanut beef', 'plate'], ['Tô with leaf sauce (Guinea)', 'fonio:80 water:150 spinach:100 palm_oil:12', 'fonio guinea (vegan)', 'plate']], AF);
C('Guinea-Bissau', 'Bissau-Guinean', [['Siga', 'shrimp:130 okra:60 palm_oil:15 rice:200', 'bissau shrimp okra', 'plate'], ['Caldo de chabeu', 'palm_oil:30 fish:120 rice:200 onion:20', 'palm oil fish stew', 'plate'], ['Bissau rice and beans', 'rice:200 cowpeas:120 oil:10', 'arroz com feijão bissau (vegan)', 'plate']], AF);
C('Lesotho', 'Basotho', [['Motoho', 'sorghum:60 water:200', 'fermented sorghum porridge', 'bowl'], ['Lesotho beef stew with papa', 'beef:130 tomato:40 onion:20 cornmeal:90 water:180', 'nama papa', 'plate'], ['Chakalaka, Lesotho', 'kidney:100 carrots:50 tomato:50 green_pepper:30 oil:10', 'chakalaka basotho (vegan)']], AF);
C('Liberia', 'Liberian', [['Pepper soup (Liberia)', 'chicken_stewed:120 chili:6 onion:20 water:250', 'liberian pepper soup', 'bowl'], ['Liberian rice bread', 'rice_flour:50 banana:40 sugar:15 oil:10 egg:15', 'rice bread', 'slice'], ['Check rice', 'rice:220 okra:60 spinach:40 palm_oil:10', 'jollof check rice (vegan)', 'plate']], AF);
C('Libya', 'Libyan', [['Libyan couscous with lamb', 'couscous:200 lamb:110 chickpeas:40 pumpkin:50 onion:20', 'kusksi libyan', 'plate'], ['Mbatten', 'potato:150 beef_mince:60 egg:20 breadcrumbs:15 oil:15', 'libyan stuffed potato', 'serving'], ['Libyan imbakbaka', 'pasta:200 lamb:80 tomato_paste:20 chickpeas:30', 'mbakbaka', 'plate']], AF);
C('Madagascar', 'Malagasy', [['Henan-kisoa sy tsaramaso', 'pork_shoulder:120 kidney:100 tomato:30 rice:200', 'pork with beans madagascar', 'plate'], ['Koba', 'peanuts:30 rice_flour:40 banana:40 sugar:15', 'malagasy peanut cake', 'slice'], ['Lasary voatabia', 'tomato:120 onion:20 vinegar:5 rice:200', 'tomato relish with rice (vegan)', 'plate']], AF);
C('Malawi', 'Malawian', [['Malawi chicken curry', 'chicken_thigh:150 curry:4 tomato:40 rice:200', 'nkhuku curry', 'plate'], ['Mandasi', 'flour:60 sugar:10 oil:15 milk:20', 'malawi doughnuts', 'serving (2)'], ['Thobwa', 'millet:40 water:250 sugar:15', 'malawi millet drink', 'glass']], AF);
C('Mali', 'Malian', [['Riz au gras (Mali)', 'rice:250 beef:80 tomato_paste:20 oil:15', 'mali fat rice', 'plate'], ['Capitaine with fries', 'fish:170 fries:150 onion:20', 'nile perch mali', 'plate'], ['Ginger juice (Mali)', 'ginger:15 sugar:25 lemon:5 water:250', 'gnamakoudji', 'glass']], AF);
C('Mauritania', 'Mauritanian', [['Mauritanian couscous', 'couscous:200 lamb:100 carrots:40 zucchini:40', 'mauritanian kuskus', 'plate'], ['Maru we-llham', 'rice:250 lamb:100 onion:30 oil:12', 'rice and meat mauritania', 'plate'], ['Zrig', 'milk:150 water:100 sugar:15', 'camel-style milk drink (cow milk)', 'glass']], AF);
C('Mauritius', 'Mauritian', [['Bol renversé', 'rice:220 chicken_thigh:80 egg_fried:50 pak_choi:40 soy:10', 'upside down bowl', 'bowl'], ['Mauritian fish vindaye', 'fish:150 mustard:8 turmeric:2 vinegar:8 oil:10', 'vindaye poisson'], ['Alouda', 'milk:200 sugar:20 tapioca:15', 'mauritian milk drink', 'glass']], AF);
C('Namibia', 'Namibian', [['Mahangu porridge', 'millet:200 milk:50', 'oshifima porridge', 'bowl'], ['Braaivleis with pap', 'beef_sirloin:150 sausage:50 cornmeal:90 water:180', 'namibian braai', 'plate'], ['Namibian bean stew', 'kidney:150 tomato:50 onion:20 oil:8', 'vegan bean stew namibia']], AF);
C('Niger', 'Nigerien', [['Kopto', 'spinach:150 peanuts:25 onion:20', 'niger leaf salad'], ['Niger rice with tomato sauce', 'rice:250 tomato:60 beef:60 oil:12', 'riz sauce niger', 'plate'], ['Fura (Niger)', 'millet:60 yogurt:150 sugar:10', 'fura da nono niger', 'bowl']], AF);
C('Rwanda', 'Rwandan', [['Ugali with isombe', 'cornmeal:100 water:200 spinach:120 peanuts:20', 'ubugali isombe (vegan)', 'plate'], ['Rwandan goat brochettes', 'goat:150 onion:20', 'rwanda goat skewers'], ['Mandazi (Rwanda)', 'flour:60 sugar:10 oil:15 coconut_milk:20', 'rwandan mandazi', 'serving (2)']], AF);
C('São Tomé and Príncipe', 'São Toméan', [['Feijoada santomense', 'kidney:150 pork_shoulder:60 sausage:30 rice:150', 'sao tome feijoada', 'plate'], ['Fruta-pão frita', 'breadfruit_cooked:200 oil:15', 'fried breadfruit (vegan)'], ['Cacau drink', 'milk:200 cocoa_powder:10 sugar:12', 'sao tome hot cocoa', 'cup']], AF);
C('Seychelles', 'Seychellois', [['Seychelles chicken curry', 'chicken_thigh:150 coconut_milk:60 curry:4 rice:200', 'cari poulet seychelles', 'plate'], ['Breadfruit chips (Seychelles)', 'breadfruit_cooked:150 oil:15', 'seychelles breadfruit chips'], ['Lentil curry (Seychelles)', 'lentils:180 coconut_milk:60 curry:3 rice:180', 'cari lantiy (vegan)', 'plate']], AF);
C('Sierra Leone', 'Sierra Leonean', [['Okra soup (Sierra Leone)', 'okra:150 palm_oil:15 fish:60 beef:40 rice:200', 'okra sauce salone', 'plate'], ['Akara (Sierra Leone)', 'rice_flour:40 banana:50 sugar:8 oil:15', 'banana rice fritters', 'serving (3)'], ['Ginger beer (Sierra Leone, alcohol-free)', 'ginger:15 sugar:25 water:250', 'salone ginger drink', 'glass']], AF);
C('South Sudan', 'South Sudanese', [['Kudra', 'spinach:150 peanut_butter:25 onion:20', 'south sudan greens (vegan)'], ['Asida with meat stew', 'sorghum:80 water:150 beef:90 tomato:40', 'south sudan asida', 'plate'], ['Shaiyah', 'beef:150 onion:30 chili:3', 'south sudan fried meat']], AF);
C('Sudan', 'Sudanese', [['Shaiyah (Sudan)', 'lamb:150 onion:30 green_pepper:20 oil:10', 'sudanese fried lamb'], ['Tamia', 'chickpeas:150 parsley:15 oil:25 onion:20', 'sudanese falafel', 'serving (5)'], ['Karkadeh (Sudan)', 'roselle:10 sugar:20 water:250', 'sudan hibiscus', 'glass']], AF);
C('Togo', 'Togolese', [['Koklo meme', 'chicken_leg:200 chili:5 onion:20 oil:8', 'togo grilled chicken'], ['Gboma dessi', 'spinach:150 palm_oil:15 tomato:40 fish:60', 'togo spinach stew'], ['Djenkoume', 'cornmeal:100 tomato_paste:15 oil:12 water:150', 'red cornmeal togo (vegan)']], AF);
C('Zambia', 'Zambian', [['Village chicken stew', 'chicken_stewed:150 tomato:40 onion:20', 'zambian chicken'], ['Nshima with beans', 'cornmeal:100 water:200 kidney:150 tomato:30', 'nshima ifyumbu (vegan)', 'plate'], ['Vitumbuwa', 'flour:60 sugar:10 oil:15 water:30', 'zambian fritters', 'serving (3)']], AF);
C('Zimbabwe', 'Zimbabwean', [['Sadza with covo', 'cornmeal:100 water:200 kale:120 tomato:30 oil:8', 'sadza and greens (vegan)', 'plate'], ['Zimbabwean mushroom stew', 'mushrooms:180 tomato:40 onion:20 oil:8', 'zimbabwe mushroom stew'], ['Maputi', 'corn:60 oil:3', 'zimbabwe popcorn', 'portion'], ['Rupiza', 'split_peas:180 water:100', 'pea porridge zimbabwe']], AF);

// ======================= MORE DISHES (Asia) =======================
C('Afghanistan', 'Afghan', [['Ashak', 'flour:80 leeks:50 yogurt:60 beef_mince:40 water:40', 'afghan leek dumplings', 'plate'], ['Shorwa', 'lamb:100 potato:80 chickpeas:40 water:250', 'afghan soup', 'bowl'], ['Firni', 'milk:180 cornstarch:15 sugar:20 pistachio:5 cardamom:1', 'afghan milk pudding', 'bowl']], AS);
C('Armenia', 'Armenian', [['Tolma', 'cabbage_cooked:100 beef_mince:70 rice:40 yogurt:30', 'armenian dolma', 'serving'], ['Armenian lentil and apricot soup', 'red_lentils:120 apricot_dried:20 onion:20 water:200', 'vospov kofte soup'], ['Gata', 'flour:50 butter:20 sugar:20 milk:15', 'armenian sweet bread', 'slice']], AS);
C('Azerbaijan', 'Azerbaijani', [['Lula kebab (Azerbaijan)', 'lamb_mince:160 onion:20 bread:60', 'lyulya kabab', 'plate'], ['Piti', 'lamb:120 chickpeas:60 potato:60 water:200', 'azerbaijani lamb pot', 'bowl'], ['Pakhlava', 'phyllo:30 walnuts:25 honey:15 butter:10', 'azerbaijani baklava', 'serving (2)']], AS);
C('Bahrain', 'Bahraini', [['Mashkool', 'rice:250 onion:30 oil:12', 'bahraini white rice with onion (vegan)', 'plate'], ['Bahraini harees', 'barley:150 chicken_stewed:90 butter:10', 'harees bahrain', 'bowl'], ['Samboosa (Bahrain)', 'flour:60 beef_mince:50 onion:15 oil:20', 'bahraini samosa', 'serving (3)']], AS);
C('Bhutan', 'Bhutanese', [['Shamu datshi', 'mushrooms:150 cheddar:50 chili:10 butter:5', 'mushroom cheese bhutan'], ['Jasha maru', 'chicken_thigh:150 tomato:40 ginger:5 onion:20 rice:180', 'bhutanese spicy chicken', 'plate'], ['Hoentay', 'buckwheat:100 spinach:60 cheddar:30', 'buckwheat dumplings bhutan', 'serving']], AS);
C('Brunei', 'Bruneian', [['Kelupis', 'sticky_rice:150 coconut_milk:30', 'brunei glutinous rice parcels', 'serving'], ['Ayam penyet (Brunei)', 'chicken_fried:160 rice:200 chili:10', 'brunei smashed chicken', 'plate'], ['Kuih cincin', 'rice_flour:40 brown_sugar:20 oil:15', 'brunei ring cookies', 'serving (3)']], AS);
C('Cambodia', 'Cambodian', [['Bai sach chrouk', 'pork_shoulder:120 rice:220 cucumber:30 coconut_milk:15', 'pork and rice breakfast', 'plate'], ['Samlor korko', 'pumpkin:80 green_beans:60 eggplant:50 fish:60 rice:20 water:200', 'cambodian stirring soup', 'bowl'], ['Nom banh chok (vegan)', 'rice_noodles:220 cucumber:40 coconut_milk:50 lemongrass:5', 'vegan khmer noodles', 'bowl']], AS);
C('Cyprus', 'Cypriot', [['Sheftalia', 'pork_ground:150 onion:20 parsley:5 pita:60', 'cypriot sausage pita', 'serving'], ['Afelia', 'pork_shoulder:160 coriander_seed:3 potato:120', 'cypriot coriander pork', 'plate'], ['Loukoumades (Cyprus)', 'flour:50 honey:25 oil:15', 'cypriot honey puffs', 'serving (5)']], AS);
C('Georgia', 'Georgian', [['Mtsvadi', 'pork_shoulder:180 onion:30', 'georgian skewers'], ['Chakhokhbili', 'chicken_thigh:160 tomato:80 onion:40 coriander:5', 'georgian chicken stew'], ['Pkhali', 'spinach:120 walnuts:30 garlic:3 coriander:5', 'georgian spinach walnut (vegan)', 'portion'], ['Churchkhela', 'walnuts:30 raisins:25 flour:10 sugar:5', 'georgian candle sweet', 'piece']], AS);
C('Jordan', 'Jordanian', [['Galayet bandora', 'tomato:200 onion:30 olive_oil:15 chili:3 pita:60', 'tomato stew jordan (vegan)'], ['Jordanian falafel sandwich', 'pita:90 chickpeas:100 oil:20 tomato:30 tahini:15', 'falafel jordan', 'sandwich'], ['Shrak with labneh', 'flour:70 water:40 yogurt:60 olive_oil:8', 'jordanian bread with labneh', 'serving']], AS);
C('Kazakhstan', 'Kazakh', [['Plov (Kazakh)', 'rice:250 lamb:100 carrots:60 oil:20', 'kazakh palau', 'plate'], ['Samsa (Kazakh)', 'flour:80 lamb_mince:70 onion:30 butter:10', 'kazakh samsa', 'serving (2)'], ['Kurt', 'yogurt:60 salt:1', 'kurt (dried yogurt)', 'portion']], AS);
C('Kuwait', 'Kuwaiti', [['Murabyan', 'rice:250 shrimp:120 onion:20 oil:12', 'kuwaiti shrimp rice', 'plate'], ['Kuwaiti harees', 'barley:150 lamb:80 butter:10', 'harees kuwait', 'bowl'], ['Mutabbaq zubaidi', 'fish:170 rice:220 onion:20', 'pomfret rice kuwait', 'plate']], AS);
C('Kyrgyzstan', 'Kyrgyz', [['Ashlan-fu', 'rice_noodles:150 egg:30 vinegar:10 chili:3 water:200', 'kyrgyz cold noodles (vegetarian)', 'bowl'], ['Kuurdak', 'lamb:130 potato:80 onion:20 oil:10', 'kyrgyz fried meat'], ['Shorpo', 'lamb:100 potato:80 carrots:40 water:250', 'kyrgyz soup', 'bowl']], AS);
C('Laos', 'Lao', [['Or lam', 'beef:100 eggplant:60 green_beans:50 lemongrass:5 water:150', 'lao stew', 'bowl'], ['Khao jee pâté', 'baguette:100 pork_shoulder:50 carrots_raw:20 cucumber:20', 'lao baguette sandwich', 'sandwich'], ['Lao vegetable larb', 'mushrooms:150 rice:15 lime:10 mint:3 chili:3', 'vegan larb', 'portion']], AS);
C('Maldives', 'Maldivian', [['Mas riha', 'tuna_steak:150 coconut_milk:80 curry:4 rice:200', 'maldivian tuna curry', 'plate'], ['Bis keemiya', 'flour:50 egg:20 cabbage:30 tuna:30 oil:15', 'maldivian samosa', 'serving (2)'], ['Bondibai', 'rice:60 coconut_milk:100 sugar:20 cardamom:1', 'maldivian rice pudding', 'bowl']], AS);
C('Mongolia', 'Mongolian', [['Khorkhog', 'lamb:180 potato:80 carrots:40', 'mongolian stone-cooked lamb'], ['Bansh', 'flour:80 beef_mince:70 onion:15 water:200', 'mongolian dumplings in soup', 'bowl'], ['Guriltai shul', 'pasta:100 lamb:80 water:300', 'noodle soup mongolia', 'bowl']], AS);
C('Myanmar', 'Burmese', [['Burmese chicken curry', 'chicken_thigh:150 onion:50 tomato:30 oil:15 turmeric:2 rice:200', 'kyet thar hin', 'plate'], ['Burmese tofu salad', 'chickpea_flour:60 water:150 onion:15 peanuts:10 chili:2', 'tohu thoke (vegan)'], ['Mont lin ma yar', 'rice_flour:50 egg:20 onion:10 oil:10', 'husband and wife snack', 'serving']], AS);
C('North Korea', 'North Korean', [['Pyongyang onban', 'rice:220 chicken_stewed:80 mushrooms:30 stock:200', 'pyongyang warm rice soup', 'bowl'], ['Songpyeon', 'rice_flour:60 sesame:10 honey:8', 'korean half-moon rice cakes', 'serving (4)'], ['Bean sprout rice', 'rice:220 sprouts_cooked:80 soy:10 sesame_oil:5', 'kongnamul bap (vegan)', 'bowl']], AS);
C('Oman', 'Omani', [['Mashuai (Omani grilled fish)', 'fish:170 lemon:10 rice:200', 'omani kingfish', 'plate'], ['Omani mishkak', 'beef_sirloin:150 tamarind:5 chili:3', 'omani skewers'], ['Kahwa with dates (Oman)', 'coffee:80 cardamom:1 dates:30', 'omani coffee', 'serving']], AS);
C('Qatar', 'Qatari', [['Madrouba', 'rice:150 chicken_stewed:100 butter:10 water:150', 'qatari rice porridge', 'bowl'], ['Balaleet (Qatar)', 'rice_noodles:150 sugar:15 egg:50 butter:10', 'qatari sweet vermicelli', 'plate'], ['Karak tea', 'black_tea:150 evaporated:50 sugar:12 cardamom:1', 'karak chai', 'cup']], AS);
C('Tajikistan', 'Tajik', [['Kurutob vegetarian', 'bread:80 yogurt:120 tomato:40 cucumber:40 onion:20', 'tajik bread salad', 'bowl'], ['Shirchoy', 'black_tea:150 milk:100 butter:10', 'tajik milk tea', 'cup'], ['Mantu (Tajik)', 'flour:90 lamb_mince:80 onion:30', 'tajik dumplings', 'serving (4)']], AS);
C('Timor-Leste', 'Timorese', [['Ai-manas fish', 'fish:150 chili:5 lime:10 rice:200', 'timorese chili fish', 'plate'], ['Timorese corn soup', 'corn:120 pumpkin:60 spinach:40 water:200', 'batar da’an soup (vegan)', 'bowl'], ['Pork with tamarind (Timor)', 'pork_shoulder:150 tamarind:10 onion:20', 'timorese pork']], AS);
C('Turkmenistan', 'Turkmen', [['Dograma', 'bread:80 lamb:100 tomato:40 onion:20 water:150', 'turkmen bread soup', 'bowl'], ['Gutap', 'flour:80 spinach:60 butter:10', 'turkmen stuffed flatbread', 'piece'], ['Chorek', 'flour:90 water:50 oil:5', 'turkmen bread', 'portion']], AS);
C('United Arab Emirates', 'Emirati', [['Chabab', 'flour:50 egg:20 milk:40 sugar:8 cardamom:1', 'emirati pancakes', 'serving (2)'], ['Saloona', 'chicken_thigh:150 tomato:60 potato:60 zucchini:40', 'emirati stew'], ['Emirati shawarma plate', 'chicken_thigh:150 rice:200 tahini:15 pickles:15', 'uae shawarma plate', 'plate']], AS);
C('Uzbekistan', 'Uzbek', [['Manti (Uzbek)', 'flour:90 lamb_mince:80 onion:30 pumpkin:20', 'uzbek manti', 'serving (4)'], ['Uzbek non with tea', 'bread:100 green_tea:200', 'non bread', 'serving'], ['Chuchvara', 'flour:80 beef_mince:60 water:200 yogurt:30', 'uzbek dumpling soup', 'bowl']], AS);

// ======================= MORE DISHES (Europe) =======================
C('Albania', 'Albanian', [['Qofte', 'beef_mince:140 onion:20 mint:2 bread:40', 'albanian meatballs', 'serving (5)'], ['Jani me fasule', 'kidney:200 tomato_paste:15 onion:20 olive_oil:10', 'albanian bean soup (vegan)', 'bowl'], ['Trileçe', 'sponge:60 milk:60 condensed:30', 'albanian three milk cake', 'slice']], EUR);
C('Andorra', 'Andorran', [['Andorran trout', 'trout:170 ham_slice:20 olive_oil:8', 'trucha a la andorrana'], ['Andorran mushroom stew', 'mushrooms:180 potato:80 olive_oil:12 garlic:5', 'vegan bolets stew'], ['Coca de pa', 'flour:70 olive_oil:10 sugar:8 water:35', 'andorran flatbread', 'slice']], EUR);
C('Belarus', 'Belarusian', [['Babka (Belarus)', 'potato:200 bacon:30 onion:20 egg:15', 'potato babka', 'portion'], ['Belarusian borscht', 'beets:120 cabbage:50 potato:50 sour_cream:20 water:200', 'belarus borscht', 'bowl'], ['Kletski', 'potato:100 flour:20 water:200 onion:10', 'potato dumpling soup (vegan)', 'bowl']], EUR);
C('Belgium', 'Belgian', [['Vol-au-vent', 'puff_pastry:40 chicken_meat:80 mushrooms:40 cream:40 fries:100', 'belgian vol au vent', 'plate'], ['Chicons au gratin', 'ham_slice:40 swiss:30 milk:60 butter:10 flour:8 leeks:120', 'endive gratin (shown with leeks)'], ['Speculoos', 'flour:25 brown_sugar:12 butter:8 cinnamon:1', 'belgian spiced biscuits', 'serving (3)']], EUR);
C('Bosnia and Herzegovina', 'Bosnian', [['Bosanski lonac', 'beef:100 potato:80 cabbage:60 carrots:30 water:200', 'bosnian pot', 'bowl'], ['Sogan dolma', 'onion:150 beef_mince:70 rice:30', 'bosnian stuffed onions'], ['Pita krompiruša', 'phyllo:70 potato:100 onion:20 oil:15', 'bosnian potato pie (vegan)', 'slice']], EUR);
C('Bulgaria', 'Bulgarian', [['Kebapche', 'beef_mince:100 pork_ground:50 fries:120', 'bulgarian kebapche', 'plate'], ['Lyutenitsa on bread', 'red_pepper:80 tomato:40 eggplant:20 oil:10 bread:60', 'lutenica toast (vegan)', 'serving'], ['Bulgarian yogurt with honey', 'yogurt:200 honey:15 walnuts:10', 'kiselo mlyako', 'bowl']], EUR);
C('Croatia', 'Croatian', [['Ćevapi (Croatia)', 'beef_mince:150 onion:30 bread:60', 'croatian cevapi', 'serving (10)'], ['Fritule', 'flour:50 egg:15 sugar:10 oil:15 raisins:8', 'croatian doughnuts', 'serving (5)'], ['Brudet', 'fish:170 tomato_canned:80 onion:30 olive_oil:12', 'croatian fish stew']], EUR);
C('Czechia', 'Czech', [['Guláš (Czech)', 'beef:150 onion:50 paprika:4 bread:80', 'czech goulash with dumplings', 'plate'], ['Kulajda', 'potato:100 mushrooms:50 cream:40 egg_poached:50 dill:2 water:150', 'czech dill soup', 'bowl'], ['Ovocné knedlíky', 'flour:60 cottage:40 strawberries:60 butter:10 sugar:10', 'czech fruit dumplings', 'serving (3)']], EUR);
C('Denmark', 'Danish', [['Flæskesteg', 'pork_roast:160 potato:150 cabbage_cooked:60 gravy:40', 'danish roast pork', 'plate'], ['Rugbrød with avocado', 'rye_bread:60 avocado:50', 'danish rye with avocado (vegan)', 'serving'], ['Æbleskiver', 'flour:50 buttermilk:60 egg:15 butter:8 icing_sugar:8 jam:10', 'danish pancake balls', 'serving (5)']], EUR);
C('Estonia', 'Estonian', [['Kiluvõileib', 'rye_bread:60 sardine:40 egg_boiled:25 butter:8', 'sprat sandwich', 'serving (2)'], ['Seljanka (Estonia)', 'sausage:60 pickles:30 tomato_paste:15 olives:10 water:250', 'estonian solyanka', 'bowl'], ['Estonian beet salad', 'beets:120 potato:60 pickles:20 sour_cream:30', 'rosolje']], EUR);
C('Finland', 'Finnish', [['Kalakukko', 'rye_bread:80 fish:80 bacon:20', 'finnish fish pie', 'slice'], ['Mustikkapiirakka', 'flour:30 butter:12 sugar:15 blueberries:60 sour_cream:20', 'finnish blueberry pie', 'slice'], ['Pea soup (Finnish)', 'split_peas:160 ham_slice:40 water:200', 'hernekeitto', 'bowl']], EUR);
C('Holy See (Vatican City)', 'Vatican', [['Carciofi alla romana', 'olive_oil:15 mint:2 garlic:3 zucchini:150', 'roman-style vegetables (vegan)'], ['Cacio e pepe (Rome)', 'pasta:250 parmesan:35 black_pepper:2', 'roman cacio e pepe', 'plate'], ['Maritozzo', 'flour:50 sugar:10 butter:8 cream:40', 'roman cream bun', 'piece']], EUR);
C('Iceland', 'Icelandic', [['Pylsur', 'sausage:70 burger_bun:50 onion:20 ketchup:15 mustard:10', 'icelandic hot dog', 'hot dog'], ['Fish stew rye toast', 'haddock:100 potato:80 milk:40 rye_bread:40', 'plokkari with rye', 'plate'], ['Kleina', 'flour:40 sugar:10 butter:8 oil:12', 'icelandic doughnut', 'piece']], EUR);
C('Latvia', 'Latvian', [['Pīrāgi', 'flour:60 bacon:30 onion:15 butter:8', 'latvian bacon buns', 'serving (2)'], ['Latvian rye bread soup', 'rye_bread:60 raisins:10 sugar:10 cream:30 water:150', 'maizes zupa', 'bowl'], ['Kartupeļu pankūkas', 'potato:150 egg:20 flour:10 oil:15', 'latvian potato pancakes', 'serving (3)']], EUR);
C('Liechtenstein', 'Liechtenstein', [['Rösti with egg (Liechtenstein)', 'potato:200 butter:15 egg_fried:50', 'rösti mit spiegelei', 'plate'], ['Apple fritters (Liechtenstein)', 'apple:100 flour:30 milk:30 egg:15 oil:15', 'öpfelchüachli', 'serving'], ['Liechtenstein vegetable soup', 'carrots:60 potato:80 leeks:40 water:250', 'gemüsesuppe (vegan)', 'bowl']], EUR);
C('Lithuania', 'Lithuanian', [['Kibinai', 'flour:70 lamb_mince:60 onion:15 butter:10', 'lithuanian pastries', 'serving (2)'], ['Balandėliai', 'cabbage_cooked:100 pork_ground:70 rice:40', 'lithuanian cabbage rolls', 'serving (3)'], ['Lithuanian mushroom soup', 'mushrooms:150 potato:80 sour_cream:20 water:200', 'grybų sriuba', 'bowl']], EUR);
C('Luxembourg', 'Luxembourgish', [['Kniddelen', 'flour:100 egg:30 milk:40 bacon:20 butter:10', 'luxembourg dumplings', 'plate'], ['Luxembourg pork pie', 'pie_crust:60 pork_ground:80 onion:15', 'luxembourg meat pie', 'slice'], ['Quetschentaart', 'pie_crust:40 sugar:15 apricot_dried:20 apple:50', 'luxembourg plum tart (shown with apple)', 'slice']], EUR);
C('Malta', 'Maltese', [['Ħobż biż-żejt', 'bread:80 tomato:40 tuna:40 olives:10 capers:5 olive_oil:10', 'maltese bread with oil', 'serving'], ['Lampuki pie', 'fish:100 spinach:50 olives:10 pie_crust:70', 'maltese fish pie', 'slice'], ['Kapunata', 'eggplant:100 red_pepper:60 tomato:60 capers:5 olive_oil:12', 'maltese ratatouille (vegan)']], EUR);
C('Moldova', 'Moldovan', [['Moldovan placinta with pumpkin', 'flour:70 pumpkin:80 sugar:10 oil:10', 'placinte cu dovleac (vegan)', 'piece'], ['Chicken with mamaliga', 'chicken_thigh:150 cornmeal:80 water:150 sour_cream:30', 'moldovan chicken mamaliga', 'plate'], ['Moldovan zama', 'chicken_stewed:100 pasta:40 water:250 lemon:5', 'zeama', 'bowl']], EUR);
C('Monaco', 'Monégasque', [['Pissaladière', 'flour:70 onion:80 olives:15 olive_oil:12', 'onion tart monaco', 'slice'], ['Fougasse monégasque', 'flour:50 sugar:15 butter:10 almonds:8', 'sweet fougasse', 'piece'], ['Pan bagnat', 'bread:100 tuna:50 egg_boiled:30 tomato:40 olives:10 olive_oil:10', 'nice sandwich', 'sandwich']], EUR);
C('Montenegro', 'Montenegrin', [['Cicvara', 'cornmeal:60 feta:60 butter:20 water:100', 'montenegrin cheese polenta'], ['Montenegrin lamb in milk', 'lamb:150 milk:100 potato:80', 'jagnjetina u mlijeku'], ['Popara', 'bread:60 milk:150 butter:10 feta:20', 'montenegrin bread porridge', 'bowl']], EUR);
C('North Macedonia', 'Macedonian', [['Ohrid trout', 'trout:170 olive_oil:8 lemon:5 potato:100', 'ohrid trout plate', 'plate'], ['Selsko meso', 'pork_shoulder:130 mushrooms:50 onion:30 feta:20', 'village meat'], ['Macedonian shopska with tavce', 'tomato:80 cucumber:60 feta:30 kidney:100', 'macedonian lunch plate', 'plate']], EUR);
C('Romania', 'Romanian', [['Mămăligă cu brânză și smântână', 'cornmeal:100 water:200 feta:50 sour_cream:40', 'romanian polenta', 'plate'], ['Zacuscă on bread', 'eggplant:80 red_pepper:60 onion:20 oil:12 bread:60', 'zacusca (vegan)', 'serving'], ['Cozonac', 'flour:50 sugar:12 walnuts:12 butter:8 milk:20', 'romanian sweet bread', 'slice']], EUR);
C('San Marino', 'Sammarinese', [['Cappelletti in brodo', 'pasta:120 ricotta:20 chicken_stewed:30 stock:300', 'san marino pasta soup', 'bowl'], ['Pasta e ceci (San Marino)', 'pasta:80 chickpeas:120 olive_oil:10 water:150', 'vegan pasta and chickpeas', 'bowl'], ['Bustrengo', 'flour:30 cornmeal:20 apple:40 raisins:10 sugar:15 milk:30', 'sammarinese cake', 'slice']], EUR);
C('Serbia', 'Serbian', [['Gibanica', 'phyllo:70 feta:50 egg:30 yogurt:30 oil:10', 'serbian cheese pie', 'slice'], ['Pasulj', 'kidney:200 sausage:40 onion:20 paprika:2', 'serbian bean stew', 'bowl'], ['Ajvar and bread (Serbia)', 'red_pepper:100 eggplant:40 oil:15 bread:60', 'serbian ajvar (vegan)', 'serving']], EUR);
C('Slovakia', 'Slovak', [['Segedínsky guláš', 'pork_shoulder:130 sauerkraut:120 sour_cream:30 bread:60', 'szekely goulash', 'plate'], ['Parené buchty', 'flour:70 milk:30 jam:20 butter:10 sugar:8', 'slovak steamed buns', 'serving (2)'], ['Šošovicová polievka', 'lentils:150 potato:50 vinegar:5 water:200', 'slovak lentil soup (vegan)', 'bowl']], EUR);
C('Slovenia', 'Slovenian', [['Štruklji', 'flour:60 cottage:80 egg:20 butter:10', 'slovenian rolled dumplings', 'portion'], ['Ričet', 'barley:120 kidney:60 sausage:30 water:200', 'slovenian barley stew', 'bowl'], ['Kremšnita', 'puff_pastry:40 milk:80 cream:40 sugar:15 egg:15', 'bled cream cake', 'slice']], EUR);

// ======================= MORE DISHES (Americas, Caribbean, Oceania, territories) =======================
C('Antigua and Barbuda', 'Antiguan', [['Antiguan pepperpot (vegan)', 'spinach:100 pumpkin:80 eggplant:60 okra:40 kidney:60', 'vegetable pepperpot'], ['Antiguan black pineapple', 'pineapple:200', 'antigua black pineapple', 'portion'], ['Johnny cakes', 'flour:60 butter:10 milk:25 oil:15', 'antiguan fried dumplings', 'serving (2)']], NA);
C('The Bahamas', 'Bahamian', [['Bahamian stew fish', 'fish:160 tomato_paste:15 onion:30 celery_raw:15 flour:10 oil:10', 'stew fish'], ['Johnnycake (Bahamas)', 'flour:60 butter:15 milk:30 sugar:8', 'bahamian johnnycake', 'slice'], ['Bahamian mac and cheese', 'pasta:150 cheddar:60 evaporated:50 egg:20', 'baked macaroni bahamas', 'slice']], NA);
C('Barbados', 'Barbadian', [['Bajan fried flying fish', 'fish:150 flour:15 oil:12 lime:5', 'flying fish cutter', 'serving'], ['Bajan rice and peas', 'rice:220 split_peas:60 coconut_milk:30', 'bajan peas n rice (vegan)', 'plate'], ['Conkies', 'cornmeal:40 pumpkin:40 coconut_meat:20 sugar:15 raisins:8', 'bajan conkies', 'piece']], NA);
C('Belize', 'Belizean', [['Escabeche (Belize)', 'chicken_stewed:120 onion:80 vinegar:10 water:200 corn_tortilla:60', 'belizean onion soup', 'bowl'], ['Salbutes', 'corn_tortilla:60 chicken_meat:60 cabbage:20 tomato:20 oil:10', 'belizean salbutes', 'serving (3)'], ['Belize coconut rice and beans (vegan)', 'rice:200 kidney:80 coconut_milk:40', 'vegan rice and beans belize', 'plate']], NA);
C('Costa Rica', 'Costa Rican', [['Chifrijo', 'rice:120 kidney:80 pork_shoulder:60 tomato:40 avocado:30 taco_shell:20', 'costa rican chifrijo', 'bowl'], ['Arroz con pollo (Costa Rica)', 'rice:220 chicken_thigh:100 peas:30 carrots:30 oil:12', 'costa rica chicken rice', 'plate'], ['Agua dulce', 'brown_sugar:25 water:250', 'costa rican sugar drink', 'cup']], NA);
C('Dominica', 'Dominican (Dominica)', [['Dominica fish broth', 'fish:120 potato:60 carrots:30 water:250 lime:5', 'fish broth dominica', 'bowl'], ['Coconut bread (Dominica)', 'flour:60 coconut_meat:25 sugar:15 butter:10', 'dominica coconut bread', 'slice'], ['Dasheen and saltfish', 'taro:200 salt_cod:80 onion:20 oil:10', 'dominica dasheen', 'plate']], NA);
C('El Salvador', 'Salvadoran', [['Pupusas de frijol con queso', 'masa:90 water:60 refried:50 mozzarella:30 cabbage:30', 'bean and cheese pupusas', 'serving (2)'], ['Panes con pollo', 'roll:100 chicken_meat:90 tomato:40 lettuce:20', 'salvadoran chicken sandwich', 'sandwich'], ['Quesadilla salvadoreña', 'rice_flour:30 cheddar:30 sour_cream:20 sugar:20 egg:15', 'salvadoran cheese cake', 'slice']], NA);
C('Grenada', 'Grenadian', [['Grenadian callaloo soup', 'spinach:150 okra:40 coconut_milk:50 water:150', 'callaloo grenada (vegan)', 'bowl'], ['Grenada stew chicken', 'chicken_thigh:150 brown_sugar:6 tomato:30 rice:200', 'grenadian stew chicken', 'plate'], ['Grenadian bakes', 'flour:60 oil:15 water:30 sugar:3', 'fried bakes', 'serving (2)']], NA);
C('Guatemala', 'Guatemalan', [['Hilachas', 'beef:130 tomato:60 potato:60 rice:150', 'shredded beef guatemala', 'plate'], ['Chuchitos', 'masa:70 chicken_meat:40 salsa:20 oil:8', 'guatemalan tamales', 'serving (2)'], ['Frijoles volteados with plantain', 'black_beans:150 plantain_fried:100 sour_cream:20', 'guatemalan breakfast beans', 'plate']], NA);
C('Honduras', 'Honduran', [['Pollo con tajadas', 'chicken_fried:160 plantain_fried:120 cabbage:40 sour_cream:15', 'chicken with plantain chips', 'plate'], ['Catrachitas', 'taco_shell:40 refried:60 cheddar:20', 'honduran bean tostadas', 'serving'], ['Honduran beans and rice (vegan)', 'kidney:150 rice:180 oil:10', 'casamiento honduras', 'plate']], NA);
C('Nicaragua', 'Nicaraguan', [['Quesillo', 'corn_tortilla:60 mozzarella:60 sour_cream:30 onion:15 vinegar:3', 'nicaraguan quesillo', 'serving'], ['Nicaraguan tres leches', 'sponge:60 condensed:30 evaporated:30 milk:30', 'pío quinto-style cake', 'slice'], ['Baho', 'beef:120 plantain:120 cassava_cooked:100', 'nicaraguan steamed beef', 'plate']], NA);
C('Panama', 'Panamanian', [['Ropa vieja (Panama)', 'beef_brisket:140 tomato:60 red_pepper:40 rice:180', 'panamanian ropa vieja', 'plate'], ['Hojaldras', 'flour:60 oil:20 sugar:5 water:30', 'panamanian fried bread', 'piece'], ['Raspao', 'sugar:25 condensed:20 water:150', 'panama shaved ice', 'cup']], NA);
C('Saint Kitts and Nevis', 'Kittitian', [['Kittitian conkies', 'cornmeal:40 pumpkin:40 coconut_meat:20 sugar:15', 'st kitts conkies', 'piece'], ['Saltfish cakes (St Kitts)', 'salt_cod:50 flour:40 oil:15', 'kittitian fishcakes', 'serving (4)'], ['Coconut tart (St Kitts)', 'pie_crust:40 coconut_meat:40 sugar:20', 'kittitian coconut tart', 'slice']], NA);
C('Saint Lucia', 'Saint Lucian', [['Saint Lucian bakes', 'flour:60 oil:15 water:30', 'lucian bakes', 'serving (2)'], ['Lambi (Saint Lucia)', 'squid:150 tomato:40 onion:20 oil:10 rice:180', 'lucian conch stew (shown with squid)', 'plate'], ['Cocoa tea (Saint Lucia)', 'milk:200 cocoa_powder:10 sugar:12 cinnamon:1', 'lucian cocoa tea', 'cup']], NA);
C('Saint Vincent and the Grenadines', 'Vincentian', [['Vincentian souse', 'pork_shoulder:120 cucumber:40 lime:15 onion:15', 'vincy souse'], ['Arrowroot cookies (SVG)', 'cornstarch:30 flour:15 butter:10 sugar:12', 'vincentian arrowroot biscuits', 'serving (3)'], ['Vincy pelau', 'rice:220 chicken_thigh:100 kidney:50 brown_sugar:5 coconut_milk:20', 'vincentian pelau', 'plate']], NA);
C('Ecuador', 'Ecuadorian', [['Seco de pollo', 'chicken_thigh:150 tomato:50 oj:20 rice:180 plantain_fried:60', 'ecuadorian chicken stew', 'plate'], ['Locro de papa', 'potato:200 milk:80 cheddar:30 avocado:30', 'ecuadorian potato soup', 'bowl'], ['Humitas (Ecuador)', 'corn:150 cheddar:20 butter:10', 'ecuadorian humitas', 'serving (2)']], SA);
C('Guyana', 'Guyanese', [['Guyanese chow mein', 'egg_noodles:220 chicken_thigh:80 cabbage:40 carrots:30 soy:15 oil:12', 'guyana chowmein', 'plate'], ['Dhal and rice (Guyana)', 'split_peas:150 rice:200 oil:8', 'guyanese dhal rice (vegan)', 'plate'], ['Guyanese cheese roll', 'puff_pastry:40 cheddar:30', 'cheese roll guyana', 'serving (2)']], SA);
C('Paraguay', 'Paraguayan', [['Mbejú', 'tapioca:60 cheddar:30 milk:30 butter:10', 'paraguayan starch cake', 'piece'], ['Vori vori', 'chicken_stewed:100 cornmeal:40 cheddar:20 water:250', 'paraguay vori vori', 'bowl'], ['Asado paraguayo', 'beef_sirloin:170 cassava_cooked:120', 'paraguayan barbecue with mandioca', 'plate']], SA);
C('Suriname', 'Surinamese', [['Bami', 'egg_noodles:220 chicken_thigh:80 cabbage:40 soy:15 oil:12', 'surinamese bami', 'plate'], ['Saoto soup', 'chicken_stewed:100 rice_noodles:80 sprouts_cooked:40 egg_boiled:30 stock:250', 'saoto', 'bowl'], ['Bara', 'red_lentils:80 flour:30 oil:15', 'surinamese bara (vegan)', 'serving (3)']], SA);
C('Uruguay', 'Uruguayan', [['Pascualina', 'pie_crust:60 spinach:80 egg:30 ricotta:30', 'uruguayan spinach pie', 'slice'], ['Milanesa napolitana', 'beef_sirloin:150 breadcrumbs:20 egg:15 oil:15 ham_slice:20 mozzarella:30 marinara:40', 'milanesa a la napolitana', 'plate'], ['Uruguayan mate with bizcochos', 'green_tea:250 croissant:40', 'mate y bizcochos', 'set']], SA);
C('Kiribati', 'I-Kiribati', [['Kiribati fried fish and rice', 'fish:150 oil:10 rice:200', 'kiribati fish rice', 'plate'], ['Kiribati pumpkin coconut soup', 'pumpkin:150 coconut_milk:80 water:100', 'vegan pumpkin soup kiribati', 'bowl']], OC);
C('Marshall Islands', 'Marshallese', [['Marshallese breadfruit pancakes', 'breadfruit_cooked:100 flour:30 coconut_milk:30 oil:10', 'jaankun', 'serving (3)'], ['Marshallese chicken and rice', 'chicken_thigh:150 soy:10 rice:200', 'marshall islands chicken plate', 'plate']], OC);
C('Federated States of Micronesia', 'Micronesian', [['Pohnpei fish soup', 'fish:120 coconut_milk:50 water:250', 'micronesian fish soup', 'bowl'], ['Micronesian banana pudding', 'banana:150 coconut_milk:50 tapioca:20', 'chuukese banana dessert', 'portion']], OC);
C('Nauru', 'Nauruan', [['Nauru coconut prawns', 'shrimp:150 coconut_milk:60 rice:180', 'nauru coconut shrimp', 'plate'], ['Nauru coconut water', 'coconut_water:300', 'nauru coconut water', 'glass']], OC);
C('Palau', 'Palauan', [['Palauan sashimi', 'tuna_raw:120 soy:10 lime:5', 'palau tuna sashimi', 'serving'], ['Palau taro with coconut (vegan)', 'taro:200 coconut_milk:50', 'vegan taro palau']], OC);
C('Papua New Guinea', 'Papua New Guinean', [['Kokoda (PNG)', 'fish:150 coconut_milk:70 lime:15 onion:15', 'png kokoda'], ['PNG chicken pot', 'chicken_thigh:150 sweet_potato:100 coconut_milk:50 spinach:40', 'chicken mumu style', 'plate'], ['Saksak', 'tapioca:60 banana:60 coconut_milk:30', 'png sago dumplings (vegan)', 'portion']], OC);
C('Samoa', 'Samoan', [['Sapasui with chicken', 'rice_noodles:200 chicken_thigh:80 soy:15 cabbage:40 oil:10', 'samoan chop suey chicken', 'plate'], ['Fa’alifu fa’i', 'banana:200 coconut_milk:80', 'green bananas in coconut cream (vegan)', 'plate'], ['Koko Samoa', 'cocoa_powder:15 sugar:15 water:200', 'samoan cocoa drink', 'cup']], OC);
C('Solomon Islands', 'Solomon Islander', [['Solomon fish and chips', 'fish:150 flour:15 oil:15 fries:120', 'honiara fish and chips', 'plate'], ['Slippery cabbage soup', 'spinach:150 coconut_milk:60 water:150', 'solomon greens soup (vegan)', 'bowl']], OC);
C('Tonga', 'Tongan', [['Tongan sipi', 'lamb:150 sweet_potato:120 coconut_milk:30', 'tongan mutton plate', 'plate'], ['Lu pulu (vegan version)', 'spinach:150 coconut_milk:80 onion:20 taro:100', 'vegan lu', 'plate']], OC);
C('Tuvalu', 'Tuvaluan', [['Tuvalu fish curry', 'tuna_steak:150 curry:4 coconut_milk:60 rice:180', 'tuvaluan curry', 'plate'], ['Tuvalu coconut drink', 'coconut_water:250 sugar:5', 'kaleve-style coconut drink', 'glass']], OC);
C('Vanuatu', 'Ni-Vanuatu', [['Vanuatu beef and rice', 'beef_sirloin:150 rice:200 soy:8', 'santo beef plate', 'plate'], ['Laplap (vegan)', 'yam:150 cassava_cooked:80 coconut_milk:60 banana:50', 'vegan laplap', 'portion']], OC);
C('Taiwan', 'Taiwanese', [['Three-cup chicken', 'chicken_thigh:170 sesame_oil:10 soy:15 basil:5 ginger:5 sugar:5', 'san bei ji'], ['Taiwanese popcorn chicken', 'chicken_fried:150 cornstarch:15 basil:3 oil:15', 'yan su ji'], ['Oyster omelette (shown with shrimp)', 'egg:100 shrimp:50 tapioca:15 pak_choi:30 oil:12', 'o-a-chian'], ['Taro balls dessert', 'taro:100 tapioca:30 sugar:20 water:150', 'yu yuan (vegan)', 'bowl']], TE);
C('Kosovo', 'Kosovar', [['Kosovo bean stew', 'kidney:200 onion:20 paprika:2 oil:10', 'pasul (vegan)', 'bowl'], ['Kosovar qebapa', 'beef_mince:150 onion:20 bread:60', 'qebapa', 'serving (10)'], ['Kosovo baklava', 'phyllo:30 walnuts:25 butter:12 sugar:15', 'bakllava', 'serving (2)']], TE);
C('Cook Islands', 'Cook Islands', [['Cook Islands curry chicken', 'chicken_thigh:150 coconut_milk:60 curry:4 rice:180', 'rarotonga chicken curry', 'plate'], ['Cook Islands taro and fish', 'taro:150 fish:120 coconut_milk:30', 'cook islands plate', 'plate']], TE);
C('Niue', 'Niuean', [['Niue chicken and taro', 'chicken_thigh:150 taro:150 coconut_milk:30', 'niue plate', 'plate'], ['Niue papaya pudding (vegan)', 'papaya:150 coconut_milk:50 tapioca:15', 'niue pawpaw dessert', 'portion']], TE);
C('Macau', 'Macanese', [['African chicken (Macau)', 'chicken_leg:200 peanut_butter:20 coconut_milk:30 chili:3 paprika:2', 'galinha à africana'], ['Serradura', 'cream:80 condensed:30 shortbread:20', 'sawdust pudding', 'cup'], ['Macanese curry crab', 'crab:150 curry:4 coconut_milk:50 rice:180', 'macau curry crab', 'plate']], TE);
C('Greenland', 'Greenlandic', [['Greenlandic shrimp sandwich', 'shrimp:80 rye_bread:60 mayo:15 egg_boiled:25', 'greenland shrimp open sandwich', 'serving'], ['Kalaalimernit fish soup', 'cod:120 potato:60 milk:80 water:150', 'greenland fish soup', 'bowl']], TE);
C('French Polynesia', 'Tahitian', [['Chicken fafa', 'chicken_thigh:150 spinach:100 coconut_milk:60', 'tahitian chicken with taro leaves'], ['Tahitian vanilla fish', 'fish:160 cream:30 butter:10 rice:180', 'poisson à la vanille', 'plate']], TE);
C('Guam', 'Chamorro', [['Chamorro chicken kadon', 'chicken_thigh:150 coconut_milk:60 onion:20 rice:180', 'kadon pika', 'plate'], ['Titiyas', 'flour:60 coconut_milk:30 sugar:8 butter:8', 'chamorro flatbread', 'piece'], ['Finadene with rice', 'soy:15 vinegar:10 onion:20 chili:3 rice:220', 'chamorro sauce rice (vegan)', 'plate']], TE);
C('Aruba', 'Aruban', [['Aruban pan bati', 'cornmeal:40 flour:30 milk:40 sugar:5 oil:8', 'aruba pancake bread', 'piece'], ['Aruban fish creole', 'fish:160 tomato:60 onion:20 green_pepper:20 oil:10 rice:150', 'aruba creole fish', 'plate']], TE);
C('Curaçao', 'Curaçaoan', [['Sopi di galiña', 'chicken_stewed:120 potato:60 carrots:30 water:250', 'curacao chicken soup', 'bowl'], ['Pastechi (Curaçao)', 'flour:60 cheddar:30 oil:20', 'curacao cheese pastechi', 'piece'], ['Kadushi soup', 'zucchini:150 water:200 onion:20', 'cactus soup (shown with zucchini, vegan)', 'bowl']], TE);
C('Bermuda', 'Bermudian', [['Bermuda fish cakes', 'salt_cod:60 potato:80 oil:15 onion:10', 'bermudian fishcakes', 'serving (2)'], ['Bermuda cassava pie', 'cassava_cooked:120 chicken_meat:60 egg:20 sugar:10 butter:10', 'bermudian cassava pie', 'slice']], TE);
C('New Caledonia', 'New Caledonian', [['Kanak yam with coconut', 'yam:200 coconut_milk:60', 'kanak yam (vegan)'], ['Prawns New Caledonia style', 'shrimp:160 butter:10 garlic:5 rice:180', 'crevettes bleues', 'plate']], TE);
C('Réunion', 'Réunionese', [['Rougail morue', 'salt_cod:100 tomato:100 onion:30 oil:12 rice:200', 'reunion salt cod rougail', 'plate'], ['Carry lentilles', 'lentils:180 tomato:40 onion:20 turmeric:2 rice:180', 'reunion lentil curry (vegan)', 'plate'], ['Bouchons', 'flour:50 pork_ground:60 soy:8', 'reunion steamed dumplings', 'serving (5)']], TE);
C('Martinique', 'Martinican', [['Fish blaff (Martinique)', 'fish:160 lime:15 onion:15 water:200', 'martinique blaff', 'bowl'], ['Christophine gratin', 'zucchini:200 milk:50 swiss:30 butter:10', 'chayote gratin (shown with zucchini)'], ['Martinique coconut flan', 'condensed:50 coconut_milk:60 egg:30', 'flan coco', 'slice']], TE);
C('Guadeloupe', 'Guadeloupean', [['Colombo de cabri', 'goat:150 curry:5 potato:60 rice:180', 'goat colombo', 'plate'], ['Guadeloupe chicken fricassee', 'chicken_thigh:150 tomato:40 onion:20 oil:10 rice:180', 'fricassée de poulet', 'plate'], ['Sorbet coco (Guadeloupe)', 'coconut_milk:100 sugar:20 condensed:20', 'coconut sorbet', 'scoop (2)']], TE);
C('Western Sahara', 'Sahrawi', [['Sahrawi lentil stew', 'lentils:180 tomato:40 onion:20 olive_oil:10', 'vegan lentils sahrawi', 'bowl'], ['Sahrawi bread with dates', 'bread:80 dates:30', 'sahrawi bread', 'serving']], TE);


// ======================= EVERYDAY FOOD (not tied to any country) =======================
/** Lines "Name | key:g ... | aliases; ... | unit". */
function L(country, demonym, region, text) {
  C(country, demonym, text.trim().split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    const [n, s, a = '', u = 'serving'] = l.split('|').map((x) => x.trim());
    // ":0" amounts and "_alt" keys were left out on purpose (ingredient not in the tables).
    const spec = s.split(/\s+/).filter((t) => t && !/:0$/.test(t) && !/_alt:/.test(t)).join(' ');
    // Names with a "(country)" note, and ones whose closest record is a different form (dry, frozen), stay as built here.
    if (!n.includes('(') && !KEEP_OURS.has(n)) PREFER_REAL.add(n);
    return [n, spec, a, u || 'serving'];
  }), region);
}
const WW = 'Worldwide';
L('Worldwide salads', 'Salad', WW, `
Garden salad | lettuce:80 tomato:50 cucumber:50 carrots_raw:30 olive_oil:10 vinegar:5 | green salad; side salad | bowl
Mixed green salad with vinaigrette | lettuce:60 arugula:20 spinach_raw:20 olive_oil:12 vinegar:5 mustard:2 | mixed leaves salad | bowl
Chicken salad bowl | chicken_breast:120 lettuce:80 tomato:50 cucumber:40 olive_oil:10 lemon:5 | grilled chicken salad | bowl
Chicken avocado salad | chicken_breast:110 avocado:70 lettuce:60 tomato:40 lime:5 olive_oil:8 | avocado chicken salad | bowl
Tuna salad bowl | tuna:100 lettuce:70 tomato:50 cucumber:40 egg_boiled:50 olive_oil:10 | tuna green salad | bowl
Tuna mayo salad | tuna:100 mayo:25 onion:15 celery_raw:20 | tuna salad spread | portion
Egg salad | egg_boiled:120 mayo:20 mustard:3 celery_raw:15 | egg mayo | portion
Salmon salad | salmon:120 lettuce:70 cucumber:40 avocado:40 lemon:5 olive_oil:8 | grilled salmon salad | bowl
Shrimp salad | shrimp:120 lettuce:70 tomato:40 avocado:40 lime:5 olive_oil:8 | prawn salad | bowl
Steak salad | beef_sirloin:120 arugula:50 lettuce:40 tomato:40 parmesan:10 olive_oil:10 balsamic:5 | beef salad | bowl
Quinoa salad | quinoa:150 cucumber:50 tomato:50 red_pepper:30 parsley:5 olive_oil:10 lemon:8 | quinoa bowl salad | bowl
Chickpea salad | chickpeas:150 cucumber:50 tomato:50 onion:15 parsley:5 olive_oil:10 lemon:8 | chickpea salad bowl | bowl
Lentil salad | lentils:150 tomato:40 cucumber:40 onion:15 parsley:5 olive_oil:10 vinegar:5 | lentil salad bowl | bowl
Bean salad | kidney:80 black_beans:80 corn_canned:40 red_pepper:30 onion:15 olive_oil:10 vinegar:8 | three bean salad | bowl
Pasta salad | pasta:150 tomato:40 cucumber:30 red_pepper:30 olives:15 olive_oil:12 vinegar:5 | cold pasta salad | bowl
Potato salad | potato:180 mayo:30 onion:15 celery_raw:15 mustard:3 | creamy potato salad | portion
Coleslaw | cabbage:120 carrots_raw:30 mayo:25 vinegar:5 sugar:3 | slaw | portion
Macaroni salad | pasta:150 mayo:35 celery_raw:15 onion:10 | mac salad | portion
Rice salad | rice:150 corn_canned:30 peas:30 red_pepper:30 olive_oil:10 vinegar:5 | cold rice salad | bowl
Cucumber tomato salad | cucumber:100 tomato:100 onion:20 olive_oil:10 vinegar:5 | tomato cucumber salad | bowl
Tomato and mozzarella salad | tomato:150 mozzarella:60 basil:3 olive_oil:10 balsamic:5 | tomato mozzarella | plate
Spinach salad | spinach_raw:80 strawberries:50 walnuts:15 feta:20 olive_oil:10 balsamic:5 | spinach strawberry salad | bowl
Kale salad | kale_raw:80 apple:50 walnuts:15 parmesan:10 olive_oil:10 lemon:8 | massaged kale salad | bowl
Beet and goat cheese salad | beets:120 goat_cheese:30 arugula:40 walnuts:15 olive_oil:10 balsamic:5 | beetroot salad | bowl
Avocado salad | avocado:120 tomato:60 onion:15 lime:8 coriander:3 | avocado tomato salad | bowl
Corn salad | corn_canned:150 red_pepper:40 onion:15 lime:8 olive_oil:8 coriander:3 | sweetcorn salad | bowl
Broccoli salad | broccoli:120 raisins:15 onion:15 mayo:20 bacon:15 | broccoli crunch salad | portion
Carrot salad | carrots_raw:150 raisins:15 lemon:8 olive_oil:8 | grated carrot salad | portion
Fruit and nut salad | apple:60 banana:60 walnuts:15 raisins:10 honey:8 | fruit salad with nuts | bowl
Couscous salad | couscous:150 cucumber:40 tomato:40 mint:3 olive_oil:10 lemon:8 | couscous bowl salad | bowl
Orzo salad | pasta:150 feta:30 tomato:40 cucumber:40 olives:15 olive_oil:10 lemon:5 | orzo feta salad | bowl
Noodle salad | rice_noodles:150 carrots_raw:30 cucumber:40 peanuts:15 soy:10 lime:8 sesame_oil:5 | cold noodle salad | bowl
Tofu salad | tofu:120 lettuce:60 cucumber:40 carrots_raw:30 sesame:5 soy:8 sesame_oil:5 | tofu salad bowl | bowl
Grilled vegetable salad | zucchini:80 eggplant:80 red_pepper:60 olive_oil:12 balsamic:5 | roasted veg salad | bowl
Egg and avocado salad | egg_boiled:100 avocado:70 lettuce:40 lemon:5 | avocado egg salad | bowl
Turkey salad | turkey:110 lettuce:70 tomato:40 cucumber:40 olive_oil:10 | turkey green salad | bowl
Ham and cheese salad | ham_slice:60 cheddar:30 lettuce:70 tomato:40 egg_boiled:50 mayo:10 | chef salad | bowl
Cobb salad | chicken_breast:90 bacon:15 egg_boiled:50 avocado:40 blue_cheese:15 lettuce:80 tomato:40 | cobb | bowl
Waldorf salad | apple:100 celery_raw:40 walnuts:20 mayo:20 raisins:10 | waldorf | bowl
Taco salad | beef_mince:100 lettuce:80 tomato:40 cheddar:25 sour_cream:20 salsa:30 corn_tortilla:20 | taco salad bowl | bowl
Pesto pasta salad | pasta:150 pesto:20 tomato:40 mozzarella:30 | pesto salad | bowl
Watermelon feta salad | watermelon:200 feta:30 mint:3 olive_oil:5 | watermelon salad | bowl
Mango salad | mango:120 cucumber:50 red_pepper:30 lime:8 chili:2 coriander:3 | mango cucumber salad | bowl
Cabbage salad | cabbage:150 carrots_raw:30 olive_oil:10 vinegar:8 | cabbage carrot salad | bowl
Vegan power salad | quinoa:100 chickpeas:80 kale_raw:40 avocado:50 tahini:15 lemon:8 | vegan salad bowl | bowl
Burrata salad | mozzarella:80 tomato:120 basil:3 olive_oil:10 | burrata tomato | plate
Seafood salad | shrimp:60 squid:50 mussels:40 lettuce:40 lemon:10 olive_oil:10 | mixed seafood salad | bowl
`);
L('Worldwide breakfast', 'Breakfast', WW, `
Oatmeal with milk | oats:50 milk:200 | porridge with milk; oats with milk | bowl
Oatmeal with water | oats:50 water:250 | plain porridge; oats with water | bowl
Oatmeal with banana | oats:50 milk:200 banana:80 | banana oats; banana porridge | bowl
Oatmeal with berries | oats:50 milk:200 blueberries:50 strawberries:40 | berry oats; berry porridge | bowl
Oatmeal with honey | oats:50 milk:200 honey:15 | honey porridge | bowl
Oatmeal with peanut butter | oats:50 milk:200 peanut_butter:20 banana:50 | peanut butter oats | bowl
Oatmeal with apple and cinnamon | oats:50 milk:200 apple:80 cinnamon:1 sugar:5 | apple cinnamon oats | bowl
Oatmeal with raisins | oats:50 milk:200 raisins:20 | raisin porridge | bowl
Chocolate oatmeal | oats:50 milk:200 cocoa_powder:8 sugar:8 banana:50 | chocolate porridge | bowl
Protein oats | oats:50 milk:200 greek_yogurt:100 blueberries:40 | high protein oatmeal | bowl
Savory oats with egg | oats:50 water:200 egg_fried:50 spinach:40 | savoury porridge | bowl
Overnight oats | oats:50 milk:120 yogurt:80 honey:10 | overnight oatmeal | jar
Overnight oats with berries | oats:50 milk:120 yogurt:80 strawberries:50 blueberries:30 | berry overnight oats | jar
Overnight oats with peanut butter and banana | oats:50 milk:120 peanut_butter:15 banana:60 | pb banana overnight oats | jar
Vegan overnight oats | oats:50 soy_milk:150 banana:60 maple:10 | plant-based overnight oats | jar
Baked oats | oats:50 egg:30 milk:80 banana:60 | baked oatmeal | portion
Granola with yogurt | granola:50 yogurt:150 | yogurt and granola | bowl
Granola with milk | granola:60 milk:200 | granola cereal with milk | bowl
Yogurt parfait | greek_yogurt:150 granola:30 strawberries:50 honey:8 | parfait | cup
Yogurt with fruit | yogurt:150 banana:50 strawberries:50 | fruit yogurt bowl | bowl
Greek yogurt with honey and nuts | greek_yogurt:170 honey:12 walnuts:15 | yogurt honey walnuts | bowl
Muesli with milk | oats:40 raisins:10 almonds:10 apple:30 milk:200 | bircher muesli | bowl
Plain bagel | bagel:100 | bagel | bagel
Bagel with cream cheese | bagel:100 cream_cheese:30 | cream cheese bagel | bagel
Bagel with butter | bagel:100 butter:10 | buttered bagel | bagel
Bagel with peanut butter | bagel:100 peanut_butter:25 | peanut butter bagel | bagel
Bagel with egg and cheese | bagel:100 egg_fried:50 cheddar:20 | egg cheese bagel | bagel
Bagel with bacon, egg and cheese | bagel:100 bacon:20 egg_fried:50 cheddar:20 | bec bagel | bagel
Bagel with smoked salmon and cream cheese | bagel:100 smoked_salmon:50 cream_cheese:25 capers:3 onion:10 | lox bagel; bagel and lox | bagel
Bagel with avocado | bagel:100 avocado:60 tomato:20 | avocado bagel | bagel
Bagel with ham and cheese | bagel:100 ham_slice:40 swiss:20 | ham cheese bagel | bagel
Bagel with hummus | bagel:100 hummus:50 cucumber:20 | hummus bagel | bagel
Toast with butter | bread:60 butter:10 | buttered toast | serving (2 slices)
Toast with jam | bread:60 butter:8 jam:20 | jam toast | serving (2 slices)
Toast with peanut butter | bread:60 peanut_butter:30 | peanut butter toast | serving (2 slices)
Toast with peanut butter and banana | bread:60 peanut_butter:25 banana:60 | pb banana toast | serving (2 slices)
Avocado toast | bread:60 avocado:70 lemon:3 | smashed avocado toast | serving (2 slices)
Avocado toast with egg | bread:60 avocado:60 egg_poached:50 | avo egg toast | serving (2 slices)
Eggs on toast | bread:60 egg_fried:100 butter:5 | fried eggs on toast | plate
Scrambled eggs on toast | bread:60 egg_scrambled:120 butter:5 | scrambled egg toast | plate
Beans on toast | bread:60 baked_beans:200 butter:5 | baked beans on toast | plate
Cheese on toast | bread:60 cheddar:40 | cheese toastie open | serving (2 slices)
Mushrooms on toast | bread:60 mushrooms:120 butter:10 garlic:3 | garlic mushrooms on toast | plate
Wholemeal toast with butter | wholemeal:60 butter:10 | brown toast | serving (2 slices)
French toast | bread:70 egg:50 milk:40 butter:10 | eggy bread | serving (2 slices)
French toast with syrup | bread:70 egg:50 milk:40 butter:10 maple:20 | french toast and maple syrup | serving (2 slices)
Pancakes with syrup | pancake:150 maple:30 butter:10 | pancakes and syrup | stack (3)
Pancakes with berries | pancake:150 blueberries:50 strawberries:40 maple:15 | berry pancakes | stack (3)
Banana pancakes | pancake:150 banana:80 maple:15 | banana pancake stack | stack (3)
Protein pancakes | oats:40 egg:60 banana:60 greek_yogurt:50 | oat banana pancakes | stack (3)
Waffles with syrup | waffle:120 maple:30 butter:10 | waffles and syrup | serving (2)
Waffles with fruit and cream | waffle:120 strawberries:60 whipped:20 | fruit waffles | serving (2)
Scrambled eggs | egg_scrambled:150 | scrambled eggs | serving
Fried eggs | egg_fried:100 | fried egg | serving (2)
Boiled eggs | egg_boiled:100 | hard boiled eggs | serving (2)
Poached eggs | egg_poached:100 | poached egg | serving (2)
Cheese omelette | egg:120 cheddar:30 butter:8 | cheese omelet | omelette
Vegetable omelette | egg:120 onion:20 red_pepper:30 tomato:30 spinach:20 oil:5 | veggie omelet | omelette
Ham and cheese omelette | egg:120 ham_slice:30 cheddar:25 butter:8 | ham cheese omelet | omelette
Mushroom omelette | egg:120 mushrooms:50 butter:8 | mushroom omelet | omelette
Spinach and feta omelette | egg:120 spinach:40 feta:25 oil:5 | spinach feta omelet | omelette
Egg white omelette | egg_white:150 spinach:30 tomato:30 oil:3 | egg white omelet | omelette
Breakfast burrito | flour_tortilla:70 egg_scrambled:100 cheddar:25 potato:60 salsa:30 | egg burrito | burrito
Breakfast sandwich | english_muffin:60 egg_fried:50 cheddar:20 ham_slice:25 | egg muffin sandwich | sandwich
Egg and cheese sandwich | bread:60 egg_fried:50 cheddar:20 | egg cheese sandwich | sandwich
Bacon and eggs | bacon:30 egg_fried:100 | eggs and bacon | plate
Sausage and eggs | sausage:80 egg_fried:100 | eggs and sausage | plate
Full breakfast plate | egg_fried:100 bacon:30 sausage:60 baked_beans:100 bread:30 tomato:50 mushrooms:40 | big breakfast; fry up | plate
Breakfast potatoes | potato:200 onion:20 red_pepper:20 oil:10 | home fries | portion
Hash browns | potato:120 oil:12 | hash brown | serving (2)
Croissant with butter and jam | croissant:60 butter:8 jam:15 | croissant breakfast | croissant
Ham and cheese croissant | croissant:60 ham_slice:30 swiss:20 | croissant sandwich | croissant
English muffin with butter | english_muffin:60 butter:8 | toasted muffin | muffin
Cornflakes with milk | cornflakes:30 milk:200 | cereal with milk | bowl
Rice porridge, sweet | rice:150 milk:150 sugar:10 | sweet rice porridge | bowl
Cornmeal porridge | cornmeal:50 milk:200 sugar:10 | cornmeal mush | bowl
Semolina porridge | semolina:50 milk:200 sugar:10 | cream of wheat | bowl
Quinoa breakfast bowl | quinoa:120 milk:100 banana:60 honey:8 | quinoa porridge | bowl
Chia pudding | chia:30 milk:200 honey:10 | chia seed pudding | jar
Smoothie bowl with granola | banana:100 strawberries:80 yogurt:100 granola:30 | acai style bowl | bowl
Breakfast bowl with eggs and avocado | egg_fried:100 avocado:60 black_beans:80 rice:100 salsa:20 | egg avocado bowl | bowl
Tofu scramble | tofu:150 onion:20 red_pepper:30 spinach:30 turmeric:1 oil:8 | vegan scrambled tofu | serving
Vegan breakfast plate | tofu:100 baked_beans:100 mushrooms:60 bread:30 avocado:40 tomato:40 | plant-based breakfast | plate
Peanut butter and jelly toast | bread:60 peanut_butter:20 jam:15 | pb and j toast | serving (2 slices)
Cottage cheese with fruit | cottage:150 pineapple:60 | cottage cheese bowl | bowl
`);
L('Worldwide lunch and dinner', 'Everyday meal', WW, `
Grilled chicken with rice and vegetables | chicken_breast:150 rice:180 broccoli:80 carrots:50 olive_oil:5 | chicken rice and veg | plate
Grilled chicken with sweet potato | chicken_breast:150 sweet_potato:180 green_beans:80 olive_oil:5 | chicken and sweet potato | plate
Grilled chicken with salad | chicken_breast:150 lettuce:60 tomato:50 cucumber:40 olive_oil:10 | chicken and salad | plate
Grilled chicken with potatoes | chicken_breast:150 potato_roast:200 broccoli:80 | chicken and potatoes | plate
Chicken and broccoli | chicken_breast:150 broccoli:150 olive_oil:5 | chicken broccoli | plate
Chicken thighs with rice | chicken_thigh:160 rice:180 peas:50 | chicken thigh and rice | plate
Roast chicken dinner | chicken_meat:150 potato_roast:180 carrots:60 peas:50 gravy:50 | roast chicken plate | plate
Baked chicken drumsticks with rice | drumstick:200 rice:180 green_beans:60 | drumsticks and rice | plate
Chicken wings with fries | wing:180 fries:150 | wings and chips | plate
Chicken stir fry with rice | chicken_breast:130 broccoli:60 red_pepper:40 carrots:30 soy:12 oil:10 rice:180 | chicken stir-fry | plate
Beef stir fry with rice | flank:130 broccoli:60 red_pepper:40 onion:30 soy:12 oil:10 rice:180 | beef stir-fry | plate
Tofu stir fry with rice | tofu:150 broccoli:60 red_pepper:40 snow_peas:40 soy:12 oil:10 rice:180 | vegan stir fry | plate
Vegetable stir fry with noodles | egg_noodles:180 broccoli:60 carrots:40 cabbage:50 soy:12 oil:10 | veg noodles | plate
Shrimp stir fry with rice | shrimp:130 broccoli:60 snow_peas:40 garlic:5 soy:12 oil:10 rice:180 | prawn stir fry | plate
Steak with potatoes | beef_sirloin:200 potato_baked:200 butter:10 green_beans:60 | steak and potatoes | plate
Steak and fries | beef_sirloin:200 fries:150 | steak frites | plate
Steak with salad | beef_sirloin:180 lettuce:60 tomato:50 olive_oil:8 | steak salad plate | plate
Salmon with rice and vegetables | salmon:150 rice:180 asparagus:80 lemon:5 | salmon rice veg | plate
Salmon with potatoes | salmon:150 potato:200 green_beans:70 butter:8 | salmon and potatoes | plate
Baked fish with vegetables | cod:170 zucchini:80 tomato:60 olive_oil:10 lemon:5 | baked white fish | plate
Fish and rice | fish:160 rice:200 tomato:40 onion:20 oil:8 | fish with rice | plate
Tuna pasta | pasta:200 tuna:80 tomato_canned:80 olive_oil:8 onion:20 | tuna spaghetti | plate
Tuna pasta bake | pasta:180 tuna:80 cheddar:30 milk:60 corn_canned:30 | tuna bake | portion
Chicken pasta | pasta:200 chicken_breast:110 tomato_canned:80 olive_oil:8 garlic:3 | chicken penne | plate
Creamy chicken pasta | pasta:200 chicken_breast:110 cream:50 parmesan:15 garlic:3 | chicken alfredo style | plate
Spaghetti bolognese | pasta:200 beef_mince:100 tomato_canned:100 onion:20 carrots:20 olive_oil:8 | spag bol | plate
Spaghetti with meatballs | pasta:200 beef_mince:110 breadcrumbs:10 egg:10 marinara:100 parmesan:10 | meatball spaghetti | plate
Pasta with tomato sauce | pasta:220 marinara:120 parmesan:10 | pasta marinara | plate
Garlic butter pasta | pasta:220 butter:15 garlic:5 parmesan:10 | buttered pasta | plate
Pesto pasta | pasta:220 pesto:30 parmesan:10 | pasta with pesto | plate
Mac and cheese | pasta:200 cheddar:60 milk:80 butter:10 flour:8 | macaroni cheese | portion
Baked ziti | pasta:200 marinara:100 ricotta:50 mozzarella:40 | ziti bake | portion
Lasagna | pasta:120 beef_mince:90 marinara:90 ricotta:40 mozzarella:40 parmesan:8 | beef lasagne | portion
Vegetable lasagna | pasta:120 zucchini:60 spinach:50 marinara:90 ricotta:50 mozzarella:40 | veggie lasagne | portion
Vegan pasta with lentil sauce | pasta:200 red_lentils:100 tomato_canned:100 onion:20 olive_oil:8 | vegan bolognese | plate
Shrimp pasta | pasta:200 shrimp:110 garlic:5 olive_oil:12 parsley:3 | garlic prawn pasta | plate
Chicken curry with rice | chicken_thigh:150 curry:6 coconut_milk:60 onion:30 tomato:40 oil:10 rice:180 | chicken curry and rice | plate
Vegetable curry with rice | potato:80 cauliflower:80 peas:40 chickpeas:60 curry:6 coconut_milk:60 oil:10 rice:180 | veg curry | plate
Chickpea curry with rice | chickpeas:180 tomato_canned:100 onion:30 curry:6 oil:10 rice:180 | chickpea curry | plate
Lentil curry with rice | red_lentils:180 tomato:60 onion:30 curry:5 oil:10 rice:180 | lentil dal and rice | plate
Beef stew with potatoes | beef:150 potato:150 carrots:60 onion:30 gravy:60 | beef stew | bowl
Chicken stew | chicken_thigh:150 potato:100 carrots:60 celery:30 stock:150 | chicken casserole | bowl
Bean stew | kidney:150 tomato_canned:100 onion:30 carrots:40 olive_oil:8 | vegan bean stew | bowl
Chili con carne with rice | beef_mince:110 kidney:80 tomato_canned:100 onion:30 chili_powder:3 rice:180 | chili and rice | plate
Vegetarian chili | kidney:100 black_beans:80 corn_canned:40 tomato_canned:120 red_pepper:40 chili_powder:3 | veggie chili | bowl
Burrito bowl | rice:150 black_beans:80 chicken_breast:100 corn_canned:30 salsa:40 lettuce:30 cheddar:20 | chicken burrito bowl | bowl
Vegan burrito bowl | rice:150 black_beans:100 corn_canned:40 guacamole:40 salsa:40 lettuce:30 | bean burrito bowl | bowl
Poke bowl | tuna_raw:110 rice_short:180 avocado:40 cucumber:40 soy:10 sesame:3 | tuna poke bowl | bowl
Salmon poke bowl | salmon_raw:110 rice_short:180 avocado:40 edamame:40 soy:10 | salmon poke | bowl
Teriyaki chicken bowl | chicken_thigh:140 teriyaki:25 rice:180 broccoli:60 sesame:3 | teriyaki bowl | bowl
Rice and beans | rice:180 kidney:120 onion:15 oil:8 | beans and rice | plate
Rice and chicken | rice:200 chicken_meat:120 | chicken and rice | plate
Rice with fried egg | rice:200 egg_fried:50 soy:5 | egg and rice | plate
Egg fried rice | rice:220 egg:50 peas:30 carrots:20 soy:10 oil:10 | fried rice with egg | plate
Chicken fried rice | rice:220 chicken_breast:80 egg:30 peas:30 soy:10 oil:10 | chicken egg fried rice | plate
Shrimp fried rice | rice:220 shrimp:80 egg:30 peas:30 soy:10 oil:10 | prawn fried rice | plate
Vegetable fried rice | rice:220 peas:40 carrots:30 corn_canned:30 soy:10 oil:10 | veg fried rice | plate
Mashed potatoes with sausages | sausage:120 mash:200 gravy:60 | sausage and mash; bangers and mash | plate
Baked potato with beans and cheese | potato_baked:250 baked_beans:120 cheddar:30 | jacket potato beans cheese | potato
Baked potato with tuna | potato_baked:250 tuna:80 mayo:15 corn_canned:20 | jacket potato tuna | potato
Baked potato with chili | potato_baked:250 beef_mince:80 kidney:50 tomato_canned:60 | chili jacket potato | potato
Loaded baked potato | potato_baked:250 bacon:15 cheddar:30 sour_cream:30 | loaded potato | potato
Roast beef dinner | pot_roast:150 potato_roast:180 carrots:60 yorkshire:30 gravy:60 | sunday roast beef | plate
Pork chops with vegetables | pork_tenderloin:170 potato:150 green_beans:70 | pork chop dinner | plate
Lamb chops with potatoes | lamb_chops:160 potato_roast:180 peas:60 | lamb chop dinner | plate
Turkey dinner | turkey:150 mash:150 carrots:50 peas:40 gravy:60 | roast turkey plate | plate
Meatloaf with mashed potatoes | beef_mince:140 breadcrumbs:15 egg:15 ketchup:15 mash:180 | meatloaf dinner | plate
Shepherd-style pie | lamb_mince:120 carrots:30 peas:30 onion:20 gravy:50 mash:180 | mince and mash pie | portion
Chicken pot pie | chicken_meat:100 peas:30 carrots:30 pie_crust:60 milk:50 butter:10 | chicken pie | portion
Fish tacos | fish:120 corn_tortilla:60 cabbage:30 salsa:30 lime:5 | fish taco | serving (2)
Chicken tacos | chicken_breast:110 corn_tortilla:60 salsa:30 lettuce:20 cheddar:15 | chicken taco | serving (2)
Beef tacos | beef_mince:110 taco_shell:30 lettuce:20 cheddar:20 salsa:30 | ground beef tacos | serving (2)
Chicken quesadilla | flour_tortilla:70 chicken_breast:80 cheddar:40 red_pepper:20 | quesadilla | quesadilla
Cheese quesadilla | flour_tortilla:70 cheddar:60 | cheese quesadilla | quesadilla
Chicken fajitas | chicken_breast:130 red_pepper:50 onion:40 oil:8 flour_tortilla:70 sour_cream:20 | fajitas | serving (2)
Veggie burger meal | veggie_patty:90 burger_bun:60 lettuce:15 tomato:20 fries:120 | veggie burger and fries | meal
Cheeseburger with fries | beef_patty:110 burger_bun:60 cheddar:20 lettuce:15 tomato:20 ketchup:10 fries:150 | burger and fries | meal
Chicken burger | chicken_breast:120 flour:10 oil:10 burger_bun:60 lettuce:15 mayo:15 | chicken sandwich burger | burger
Grilled tofu with vegetables | tofu:180 broccoli:80 zucchini:60 soy:10 oil:8 | tofu and veg | plate
Tempeh bowl | tempeh:120 brown_rice:150 kale:50 carrots:30 soy:10 | tempeh rice bowl | bowl
Stuffed peppers | red_pepper:200 beef_mince:80 rice:60 tomato_canned:60 cheddar:20 | stuffed bell peppers | serving (2)
Vegan stuffed peppers | red_pepper:200 quinoa:80 black_beans:60 corn_canned:30 tomato_canned:60 | vegan stuffed bell peppers | serving (2)
Pizza margherita slice | flour:70 marinara:30 mozzarella:35 olive_oil:3 | cheese pizza slice | slice
Pepperoni pizza slice | flour:70 marinara:30 mozzarella:30 pepperoni:15 | pepperoni slice | slice
Vegetable pizza slice | flour:70 marinara:30 mozzarella:30 red_pepper:15 mushrooms:15 olives:5 | veggie pizza slice | slice
Chicken wrap | flour_tortilla:70 chicken_breast:100 lettuce:20 tomato:20 mayo:10 | grilled chicken wrap | wrap
Falafel wrap | flour_tortilla:70 chickpeas:80 oil:10 lettuce:20 tomato:20 tahini:15 | falafel roll | wrap
Tuna wrap | flour_tortilla:70 tuna:80 mayo:15 lettuce:20 | tuna roll | wrap
Turkey wrap | flour_tortilla:70 turkey:80 lettuce:20 tomato:20 mustard:5 | turkey roll up | wrap
Veggie wrap | flour_tortilla:70 hummus:40 lettuce:20 cucumber:30 red_pepper:30 | hummus veggie wrap | wrap
Halloumi wrap | flour_tortilla:70 halloumi:60 lettuce:20 tomato:30 | grilled halloumi wrap | wrap
`);
L('Worldwide soups', 'Soup', WW, `
Chicken noodle soup | chicken_meat:60 egg_noodles:60 carrots:30 celery:20 stock:250 | chicken soup with noodles | bowl
Chicken and vegetable soup | chicken_meat:70 potato:50 carrots:40 celery:20 peas:20 stock:250 | chicken veg soup | bowl
Tomato soup | tomato_canned:250 onion:20 olive_oil:8 cream:20 | cream of tomato soup | bowl
Vegetable soup | potato:60 carrots:50 celery:30 onion:20 green_beans:30 tomato_canned:80 stock:200 | mixed veg soup | bowl
Lentil soup | red_lentils:80 carrots:40 onion:30 cumin:1 olive_oil:8 water:250 | red lentil soup | bowl
Split pea soup | split_peas:80 carrots:30 onion:20 ham:30 water:250 | pea and ham soup | bowl
Mushroom soup | mushrooms:150 onion:20 butter:10 cream:40 stock:150 | cream of mushroom | bowl
Pumpkin soup | pumpkin:250 onion:20 coconut_milk:40 stock:100 | pumpkin squash soup | bowl
Butternut squash soup | butternut:250 onion:20 olive_oil:8 stock:150 | squash soup | bowl
Potato leek soup | potato:150 leeks:80 butter:10 milk:60 stock:150 | leek and potato soup | bowl
Broccoli cheddar soup | broccoli:120 cheddar:35 milk:100 butter:10 flour:8 stock:100 | broccoli cheese soup | bowl
Carrot ginger soup | carrots:200 ginger:5 onion:20 olive_oil:8 stock:150 | carrot soup | bowl
Bean soup | black_beans:150 onion:20 tomato:40 cumin:1 stock:200 | black bean soup | bowl
Minestrone-style vegetable soup | pasta:30 kidney:50 zucchini:40 carrots:30 tomato_canned:80 stock:200 | italian vegetable soup | bowl
Beef and vegetable soup | beef:90 potato:60 carrots:40 celery:20 tomato_canned:60 stock:200 | beef soup | bowl
Fish soup | fish:120 potato:60 tomato:50 onion:20 stock:200 | fish broth | bowl
Seafood soup | shrimp:60 mussels:50 squid:40 tomato:60 stock:200 | seafood chowder broth | bowl
Corn chowder | corn_canned:120 potato:80 milk:120 bacon:10 butter:8 | sweetcorn chowder | bowl
Clam chowder | clams:80 potato:80 milk:150 bacon:10 butter:8 flour:8 | new england chowder | bowl
Chicken rice soup | chicken_meat:60 rice:60 carrots:30 celery:20 stock:250 | chicken and rice soup | bowl
Egg drop soup | egg:50 stock:300 cornstarch:5 | egg flower soup | bowl
Miso soup with tofu | miso:15 tofu:50 wakame:3 water:250 | miso soup | bowl
Cauliflower soup | cauliflower:200 onion:20 milk:80 butter:8 | cream of cauliflower | bowl
Spinach soup | spinach:150 potato:60 onion:20 cream:20 stock:150 | green soup | bowl
Chickpea soup | chickpeas:150 tomato:60 onion:20 cumin:1 olive_oil:8 stock:200 | chickpea stew soup | bowl
Bone broth | stock:300 | beef bone broth | mug
`);
L('Worldwide sandwiches', 'Sandwich', WW, `
Ham sandwich | bread:70 ham_slice:50 butter:8 | ham sarnie | sandwich
Ham and cheese sandwich | bread:70 ham_slice:40 cheddar:25 butter:5 | ham cheese sandwich | sandwich
Cheese sandwich | bread:70 cheddar:40 butter:8 | cheese sarnie | sandwich
Grilled cheese sandwich | bread:70 cheddar:45 butter:12 | toasted cheese sandwich | sandwich
Chicken sandwich | bread:70 chicken_breast:80 lettuce:15 mayo:15 | chicken mayo sandwich | sandwich
Chicken salad sandwich | bread:70 chicken_meat:70 mayo:20 celery_raw:10 | chicken salad sarnie | sandwich
Turkey sandwich | bread:70 turkey:70 lettuce:15 tomato:20 mustard:5 | turkey sarnie | sandwich
Tuna sandwich | bread:70 tuna:70 mayo:20 | tuna mayo sandwich | sandwich
Egg mayo sandwich | bread:70 egg_boiled:60 mayo:15 | egg salad sandwich | sandwich
BLT sandwich | bread:70 bacon:25 lettuce:20 tomato:40 mayo:15 | bacon lettuce tomato | sandwich
Club sandwich | bread:100 chicken_breast:60 bacon:20 lettuce:20 tomato:30 mayo:15 | triple decker | sandwich
Roast beef sandwich | bread:70 pot_roast:70 lettuce:15 mustard:5 | beef sandwich | sandwich
Peanut butter and jelly sandwich | bread:70 peanut_butter:30 jam:25 | pb&j | sandwich
Peanut butter sandwich | bread:70 peanut_butter:35 | peanut butter sarnie | sandwich
Avocado sandwich | bread:70 avocado:70 tomato:30 lettuce:15 | avo sandwich | sandwich
Caprese sandwich | baguette:80 mozzarella:50 tomato:50 basil:3 pesto:10 | tomato mozzarella sandwich | sandwich
Veggie sandwich | bread:70 cucumber:30 tomato:30 lettuce:20 cheddar:20 mayo:10 | vegetable sandwich | sandwich
Vegan sandwich | bread:70 tofu:60 avocado:40 lettuce:20 tomato:30 | plant-based sandwich | sandwich
Bacon sandwich | bread:70 bacon:40 ketchup:10 | bacon butty | sandwich
Sausage sandwich | bread:70 sausage:80 ketchup:10 | sausage butty | sandwich
Egg sandwich | bread:70 egg_fried:50 butter:5 | fried egg sandwich | sandwich
Steak sandwich | baguette:90 beef_sirloin:100 onion:30 mustard:5 | steak sub | sandwich
Meatball sub | baguette:100 beef_mince:100 marinara:60 mozzarella:30 | meatball sandwich | sub
Tuna melt | bread:70 tuna:70 mayo:10 cheddar:30 | tuna melt sandwich | sandwich
Chicken panini | baguette:90 chicken_breast:80 mozzarella:30 pesto:10 | grilled chicken panini | panini
Hot dog | sausage:60 roll:50 ketchup:10 mustard:5 | frankfurter in bun | hot dog
Pulled pork sandwich | pork_shoulder:110 bbq:30 burger_bun:60 cabbage:20 | pulled pork bun | sandwich
Fish sandwich | fish:100 flour:10 oil:10 burger_bun:60 mayo:15 lettuce:10 | fish burger | sandwich
`);
L('Worldwide snacks and sides', 'Snack', WW, `
Apple with peanut butter | apple:150 peanut_butter:30 | apple slices pb | serving
Banana with peanut butter | banana:120 peanut_butter:25 | banana pb | serving
Celery with peanut butter | celery_raw:100 peanut_butter:30 | ants on a log | serving
Carrot sticks with hummus | carrots_raw:100 chickpeas:40 tahini:10 olive_oil:5 lemon:3 | veggie sticks and dip | serving
Cheese and crackers | cheddar:30 flour:20 butter:5 | crackers and cheese | serving
Trail mix | peanuts:20 almonds:15 raisins:20 dark_choc:10 | nuts and raisins mix | handful (65 g)
Mixed nuts | almonds:15 cashews:15 walnuts:15 | nut mix | handful (45 g)
Roasted chickpeas | chickpeas:100 olive_oil:5 paprika:1 | crunchy chickpeas | portion
Edamame with salt | edamame:150 salt:1 | salted edamame | bowl
Buttered popcorn | popcorn:30 butter:5 | popcorn | bowl
Garlic bread | baguette:60 butter:15 garlic:3 parsley:2 | garlic baguette | serving (2 slices)
Cheesy garlic bread | baguette:60 butter:12 garlic:3 mozzarella:30 | cheese garlic bread | serving (2 slices)
Onion rings | onion:100 flour:25 oil:20 | battered onion rings | portion
Sweet potato fries | sweet_potato:150 oil:12 | sweet potato chips | portion
Potato wedges | potato:200 oil:12 paprika:1 | wedges | portion
Roast potatoes | potato_roast:200 | roasties | portion
Mashed potatoes | mash:200 | mash | portion
Steamed vegetables | broccoli:60 carrots:50 green_beans:50 | mixed steamed veg | portion
Roasted vegetables | zucchini:60 red_pepper:60 onion:40 carrots:50 olive_oil:10 | roast veg | portion
Garlic green beans | green_beans:150 garlic:3 olive_oil:8 | sauteed green beans | portion
Corn on the cob with butter | corn:150 butter:10 | buttered corn | cob
Steamed rice | rice:180 | plain white rice | portion
Brown rice | brown_rice:180 | plain brown rice | portion
Buttered noodles | egg_noodles:180 butter:10 | butter noodles | portion
Chicken nuggets | chicken_breast:100 breadcrumbs:20 oil:15 | nuggets | serving (6)
Mozzarella sticks | mozzarella:80 breadcrumbs:20 oil:15 | cheese sticks | serving (4)
Nachos with cheese | corn_tortilla:60 oil:15 cheddar:40 salsa:30 | cheesy nachos | plate
Loaded nachos | corn_tortilla:60 oil:15 beef_mince:60 cheddar:40 sour_cream:20 salsa:30 guacamole:30 | supreme nachos | plate
Guacamole with tortilla chips | guacamole:80 corn_tortilla:50 oil:12 | chips and guac | serving
Salsa with tortilla chips | salsa:80 corn_tortilla:50 oil:12 | chips and salsa | serving
Deviled eggs | egg_boiled:100 mayo:15 mustard:3 paprika:1 | stuffed eggs | serving (4 halves)
Hard boiled egg snack | egg_boiled:50 salt:0.5 | boiled egg | egg
Yogurt with honey | yogurt:150 honey:12 | honey yogurt | pot
Rice cakes with peanut butter | rice_cake:20 peanut_butter:20 | rice cake pb | serving (2)
Energy balls | oats:30 peanut_butter:20 honey:10 dark_choc:8 | protein balls | serving (3)
Date and nut bites | dates:40 almonds:20 cocoa_powder:3 | vegan energy bites | serving (3)
Stuffed mushrooms | mushrooms:120 cream_cheese:25 breadcrumbs:10 parmesan:8 | stuffed mushroom caps | serving (4)
Spring rolls, vegetable | flour:40 cabbage:40 carrots:20 bean_sprouts:20 oil:12 | veg spring rolls | serving (3)
Chicken skewers | chicken_breast:120 olive_oil:5 lemon:5 | chicken kebab sticks | serving (2)
Fruit cup | pineapple:60 cantaloupe:60 grapes:50 | mixed fruit cup | cup
`);
L('Worldwide desserts', 'International dessert', WW, `
Chocolate cake | flour:35 sugar:30 butter:15 egg:15 cocoa_powder:8 milk:20 | chocolate sponge with frosting | slice
Vanilla cake | flour:40 sugar:30 butter:18 egg:18 milk:20 | vanilla sponge cake | slice
Chocolate fudge cake | flour:30 sugar:30 butter:18 egg:15 dark_choc:20 cocoa_powder:5 | fudge cake | slice
Lemon drizzle cake | flour:35 sugar:30 butter:18 egg:18 lemon:10 | lemon cake | slice
Coffee and walnut cake | flour:35 sugar:28 butter:20 egg:18 walnuts:10 coffee:10 | coffee cake | slice
Marble cake | flour:38 sugar:28 butter:18 egg:18 cocoa_powder:4 | marble pound cake | slice
Pound cake | flour:35 sugar:30 butter:25 egg:20 | butter pound cake | slice
Angel food cake | flour:20 sugar:30 egg_white:40 | angel cake | slice
Funfetti birthday cake | flour:38 sugar:32 butter:18 egg:18 icing_sugar:20 | birthday cake | slice
Strawberry shortcake | sponge:60 strawberries:80 whipped:30 sugar:8 | strawberry cream cake | portion
Black forest cake | sponge:60 cherries:40 cream:40 dark_choc:10 sugar:8 | chocolate cherry cake (alcohol-free) | slice
Pineapple upside-down cake | flour:30 sugar:25 butter:15 egg:15 pineapple:50 | upside down cake | slice
Upside-down apple cake | flour:30 sugar:25 butter:15 egg:15 apple:60 | apple cake | slice
Plain cheesecake | cream_cheese:80 sugar:20 egg:15 butter:10 flour:15 | baked cheesecake | slice
Strawberry cheesecake | cream_cheese:75 sugar:20 egg:12 butter:10 flour:15 strawberries:40 | berry cheesecake | slice
Chocolate cheesecake | cream_cheese:75 sugar:22 egg:12 butter:10 flour:15 dark_choc:20 | choc cheesecake | slice
No-bake cheesecake | cream_cheese:70 cream:30 sugar:20 butter:12 flour:18 | fridge cheesecake | slice
Chocolate brownie | dark_choc:25 butter:20 sugar:25 egg:15 flour:15 | brownie | piece
Blondie | butter:20 brown_sugar:28 egg:15 flour:25 | blondie bar | piece
Chocolate chip cookies | flour:30 butter:15 sugar:18 dark_choc:12 egg:5 | choc chip cookies | serving (2)
Oatmeal raisin cookies | oats:20 flour:15 butter:12 brown_sugar:15 raisins:12 egg:5 | oat cookies | serving (2)
Peanut butter cookies | peanut_butter:25 sugar:18 egg:8 flour:8 | pb cookies | serving (2)
Sugar cookies | flour:30 butter:15 sugar:18 egg:5 | butter cookies | serving (2)
Double chocolate cookies | flour:25 butter:15 sugar:18 cocoa_powder:6 dark_choc:12 egg:5 | chocolate cookies | serving (2)
Vegan cookies | flour:30 coconut_oil:12 sugar:18 dark_choc:10 soy_milk:8 | plant-based cookies | serving (2)
Snickerdoodles | flour:30 butter:15 sugar:20 cinnamon:1 egg:5 | cinnamon sugar cookies | serving (2)
Chocolate cupcake | flour:25 sugar:20 butter:15 egg:10 cocoa_powder:5 icing_sugar:20 | choc cupcake | cupcake
Vanilla cupcake | flour:28 sugar:20 butter:15 egg:12 icing_sugar:20 | cupcake with frosting | cupcake
Blueberry muffin | flour:45 sugar:20 oil:12 egg:12 milk:20 blueberries:25 | blueberry muffin | muffin
Chocolate chip muffin | flour:45 sugar:22 oil:12 egg:12 milk:20 dark_choc:15 | choc chip muffin | muffin
Banana muffin | flour:40 banana:40 sugar:18 oil:10 egg:10 | banana muffin | muffin
Bran-style oat muffin | oats:30 flour:25 brown_sugar:15 oil:10 egg:10 milk:25 raisins:10 | oat muffin | muffin
Apple pie | pie_crust:50 apple:90 sugar:15 butter:8 cinnamon:1 | apple pie slice | slice
Cherry pie | pie_crust:50 cherries:90 sugar:18 cornstarch:5 | cherry pie slice | slice
Blueberry pie | pie_crust:50 blueberries:90 sugar:15 cornstarch:5 | blueberry pie slice | slice
Pumpkin pie | pie_crust:45 pumpkin:80 condensed:30 egg:15 cinnamon:1 | pumpkin pie slice | slice
Key lime pie | pie_crust:40 condensed:50 egg:15 lime:15 | lime pie | slice
Lemon meringue pie | pie_crust:40 lemon:15 sugar:25 egg:25 butter:8 meringue:10 | lemon meringue | slice
Banana cream pie | pie_crust:40 banana:50 milk:60 sugar:15 egg:10 whipped:20 | banana pie | slice
Chocolate pie | pie_crust:40 dark_choc:25 milk:60 sugar:15 egg:10 | chocolate cream pie | slice
Peach cobbler | peach:120 flour:25 sugar:20 butter:12 milk:20 | peach crumble | portion
Apple crumble | apple:130 flour:25 butter:15 sugar:18 oats:10 | apple crisp | portion
Berry crumble | blueberries:60 raspberries:60 flour:25 butter:15 sugar:18 | mixed berry crisp | portion
Rice pudding | rice:80 milk:150 sugar:15 cinnamon:1 | creamy rice pudding | bowl
Bread pudding with custard | bread:50 milk:80 egg:25 sugar:15 raisins:10 | bread pudding custard | portion
Chocolate pudding | milk:150 sugar:18 cocoa_powder:8 cornstarch:10 | choc pudding | cup
Vanilla pudding | milk:150 sugar:18 egg:10 cornstarch:10 | vanilla custard pudding | cup
Banana pudding | banana:60 milk:100 sugar:15 egg:10 sponge:20 whipped:15 | banana pudding cup | cup
Caramel custard | milk:100 egg:35 sugar:25 | creme caramel; flan | portion
Crème brûlée | cream:80 egg:25 sugar:18 | creme brulee | ramekin
Panna cotta | cream:90 milk:30 sugar:15 gelatine:2 | panna cotta | pot
Tiramisu (alcohol-free) | sponge:40 coffee:30 cream_cheese:40 cream:30 sugar:12 egg:10 cocoa_powder:2 | tiramisu | portion
Trifle (alcohol-free) | sponge:40 strawberries:40 jam:15 milk:60 egg:10 sugar:10 whipped:20 | english trifle | bowl
Eton mess | meringue:15 strawberries:80 whipped:40 | strawberries cream meringue | bowl
Pavlova | meringue:25 whipped:40 strawberries:40 kiwi:30 passion:10 | pavlova slice | slice
Fruit tart | pie_crust:40 milk:40 egg:10 sugar:10 strawberries:40 kiwi:20 | fresh fruit tart | slice
Chocolate tart | pie_crust:40 dark_choc:35 cream:30 | chocolate ganache tart | slice
Custard tart | pie_crust:40 milk:60 egg:20 sugar:12 | egg custard tart | tart
Jam tarts | pie_crust:40 jam:25 | jam tart | serving (2)
Doughnut, glazed | flour:45 sugar:15 oil:15 milk:15 icing_sugar:10 | glazed donut | doughnut
Doughnut, jam-filled | flour:45 sugar:12 oil:15 milk:15 jam:20 | jelly doughnut | doughnut
Chocolate doughnut | flour:45 sugar:15 oil:15 milk:15 dark_choc:15 | chocolate donut | doughnut
Churros with chocolate | flour:50 water:50 oil:20 sugar:10 dark_choc:20 milk:30 | churros | serving (4)
Waffles with ice cream | waffle:100 ice_cream:60 maple:10 | waffle sundae | serving
Crepes with chocolate spread | flour:30 milk:60 egg:20 nutella:30 | nutella crepes | serving (2)
Crepes with lemon and sugar | flour:30 milk:60 egg:20 lemon:10 sugar:10 | lemon sugar pancakes | serving (2)
Crepes with strawberries and cream | flour:30 milk:60 egg:20 strawberries:60 whipped:20 | strawberry crepes | serving (2)
Ice cream sundae | ice_cream:120 dark_choc:15 whipped:15 cherries:10 peanuts:10 | sundae | sundae
Brownie with ice cream | dark_choc:20 butter:15 sugar:20 egg:12 flour:12 ice_cream:60 | brownie sundae | serving
Milkshake, vanilla | ice_cream:100 milk:200 | vanilla shake | glass
Milkshake, chocolate | choc_ice_cream:100 milk:200 | chocolate shake | glass
Milkshake, strawberry | ice_cream:100 milk:180 strawberries:60 | strawberry shake | glass
Frozen yogurt with fruit | yogurt:150 sugar:15 strawberries:40 | froyo | cup
Fruit sorbet | sorbet:120 | sorbet | scoop (2)
Chocolate mousse cake | sponge:30 dark_choc:30 cream:40 sugar:8 | mousse cake | slice
Chocolate lava cake | dark_choc:30 butter:20 egg:25 sugar:15 flour:8 | molten chocolate cake | cake
Sticky toffee pudding | dates:30 flour:30 butter:15 brown_sugar:25 egg:12 cream:20 | toffee pudding | portion
Carrot cake muffin | flour:35 carrots:30 sugar:18 oil:12 egg:12 walnuts:5 | carrot muffin | muffin
Scone with jam and cream | flour:50 butter:12 sugar:8 milk:20 jam:15 cream:20 | cream tea scone | scone
Shortbread biscuits | shortbread:40 | shortbread | serving (2)
Flapjack | oats:35 butter:15 brown_sugar:15 honey:8 | oat bar | bar
Rocky road | dark_choc:30 marshmallow:10 shortbread:15 butter:8 | rocky road bar | piece
Chocolate truffles | dark_choc:30 cream:15 cocoa_powder:2 | truffles | serving (3)
Fudge | condensed:30 sugar:15 butter:8 | vanilla fudge | piece (2)
Caramel popcorn | popcorn:25 sugar:15 butter:8 | toffee popcorn | bowl
Baked apple | apple:180 brown_sugar:10 butter:5 raisins:10 cinnamon:1 | stuffed baked apple | apple
Poached pears | pear:180 sugar:15 cinnamon:1 water:50 | poached pear | serving
Chocolate covered strawberries | strawberries:100 dark_choc:25 | dipped strawberries | serving (5)
Fruit with yogurt dip | strawberries:60 apple:60 yogurt:60 honey:8 | fruit and dip | serving
Jelly with fruit | gelatine:3 sugar:15 water:100 strawberries:40 | fruit jelly | cup
Lemon bars | flour:25 butter:15 sugar:25 egg:15 lemon:10 | lemon squares | piece
Millionaire's shortbread | shortbread:20 condensed:20 butter:8 dark_choc:15 | caramel shortbread | piece
Cinnamon sugar toast | bread:60 butter:10 sugar:8 cinnamon:1 | cinnamon toast | serving (2 slices)
Nutella toast | bread:60 nutella:30 | chocolate spread toast | serving (2 slices)
Coconut cake | flour:30 sugar:28 butter:15 egg:15 coconut_meat:20 | coconut sponge | slice
Pistachio cake | flour:30 sugar:25 butter:15 egg:15 pistachio:15 | pistachio sponge | slice
Almond cake | almonds:35 sugar:25 egg:20 butter:10 | flourless almond cake | slice
Flourless chocolate cake | dark_choc:35 butter:15 egg:25 sugar:15 | gluten-free chocolate cake | slice
Matcha-style green tea cake | flour:35 sugar:25 butter:15 egg:15 green_tea:5 | green tea cake | slice
Honey cake | flour:35 honey:25 butter:12 egg:15 sour_cream:20 | honey layer cake | slice
Date squares | dates:50 oats:25 flour:15 butter:15 brown_sugar:10 | date bars | piece
Vegan brownie | flour:20 sugar:25 coconut_oil:15 cocoa_powder:12 soy_milk:20 | plant-based brownie | piece
Vegan banana bread | flour:35 banana:50 sugar:15 oil:10 | egg-free banana loaf | slice
Vegan chocolate mousse | tofu:100 dark_choc:30 maple:10 | silken tofu mousse | pot
Vegan ice cream with berries | coconut_milk:100 sugar:15 blueberries:40 | dairy-free ice cream | scoop (2)
Vegan apple crumble | apple:130 flour:25 coconut_oil:12 sugar:18 oats:10 | dairy-free apple crisp | portion
Vegan cheesecake | cashews:50 coconut_milk:30 sugar:15 dates:15 almonds:15 lemon:5 | cashew cheesecake | slice
Vegan rice pudding | rice:80 soy_milk:150 sugar:15 cinnamon:1 | dairy-free rice pudding | bowl
Peanut butter chocolate bar | peanut_butter:25 dark_choc:20 oats:15 | pb chocolate bar | bar
`);
L('Worldwide drinks', 'International drink', WW, `
Chocolate milk | milk:250 cocoa_powder:8 sugar:12 | choc milk | glass
Strawberry milk | milk:250 strawberries:60 sugar:10 | strawberry milk drink | glass
Iced coffee | coffee:180 milk:80 sugar:10 | iced latte | glass
Mocha | coffee:60 milk:180 cocoa_powder:6 sugar:10 | cafe mocha | cup
Flat white | coffee:60 milk:120 | flat white coffee | cup
Coffee with milk and sugar | coffee:200 milk:40 sugar:8 | white coffee | cup
Tea with milk and sugar | black_tea:220 milk:30 sugar:8 | builders tea; milk tea | cup
Chai latte | black_tea:120 milk:150 sugar:12 cinnamon:1 cardamom:1 ginger:2 | spiced tea latte | cup
Green tea with honey | green_tea:250 honey:10 | honey green tea | cup
Lemon ginger tea | water:250 lemon:10 ginger:5 honey:10 | ginger lemon honey | cup
Iced lemon tea | black_tea:250 lemon:10 sugar:20 | lemon iced tea | glass
Apple juice (fresh) | apple:350 | pressed apple juice | glass
Carrot juice | carrots_raw:350 | fresh carrot juice | glass
Pineapple juice (fresh) | pineapple:300 | fresh pineapple juice | glass
Mixed fruit juice | apple:120 oj:100 pineapple:80 | fruit punch homemade | glass
Berry smoothie | strawberries:60 blueberries:60 raspberries:40 yogurt:100 milk:100 | mixed berry smoothie | glass
Peanut butter banana smoothie | banana:100 peanut_butter:20 milk:250 | pb banana shake | glass
Oat smoothie | oats:30 banana:80 milk:250 honey:8 | breakfast smoothie | glass
Vegan smoothie | banana:100 strawberries:60 soy_milk:200 | dairy-free smoothie | glass
Avocado smoothie | avocado:80 milk:200 sugar:12 | avocado shake | glass
Pineapple coconut smoothie | pineapple:120 coconut_milk:80 water:100 | coconut pineapple smoothie | glass
Spinach banana smoothie | spinach_raw:40 banana:100 milk:200 | green banana smoothie | glass
Chocolate protein smoothie | milk:250 banana:80 cocoa_powder:6 greek_yogurt:100 | chocolate high protein smoothie | glass
Sparkling lemonade | lemon:30 sugar:25 water:250 | fizzy lemonade | glass
Mint lemonade | lemon:30 mint:3 sugar:25 water:250 | mint lemon drink | glass
Fruit punch (alcohol-free) | oj:100 pineapple:80 sugar:10 water:100 | party punch | glass
Hot milk with honey | milk:250 honey:12 | warm honey milk | cup
`);

// ======================= MORE DISHES PER COUNTRY (everyday and lesser-known) =======================
L('Algeria', 'Algerian', AF, `
Rechta | pasta:180 chicken_thigh:100 chickpeas:40 turnip_alt:0 onion:20 | | plate
Berkoukes | couscous:150 lamb:70 tomato:60 zucchini:40 chickpeas:30 | algerian pearl pasta stew | bowl
Bourek (Algerian) | phyllo:40 beef_mince:50 egg:15 onion:15 oil:15 | algerian bourek | serving (2)
Tlitli | pasta:180 chicken_thigh:100 tomato_paste:15 chickpeas:30 onion:20 | algerian orzo with chicken | plate
`);
L('Angola', 'Angolan', AF, `
Moamba de peixe | fish:160 palm_oil:20 okra:50 onion:20 tomato:40 | angolan fish palm stew | bowl
Feijão de óleo de palma | kidney:180 palm_oil:15 onion:20 | palm oil beans | bowl
Kizaka | spinach:150 peanut_butter:25 palm_oil:10 onion:15 | cassava leaf stew | bowl
`);
L('Benin', 'Beninese', AF, `
Wagasi frit | cottage:100 oil:10 | fried wagashi cheese | portion
Akpan | cornmeal:50 water:100 milk:80 sugar:15 | fermented corn yogurt drink | cup
Klaklou | ripe_plantain:120 flour:10 oil:12 | plantain fritters benin | serving (4)
`);
L('Botswana', 'Batswana', AF, `
Phane with pap | beef:60 tomato:40 onion:20 oil:8 cornmeal:90 water:180 | mopane worms with pap | plate
Mabele porridge | sorghum:60 water:200 milk:50 | sorghum porridge | bowl
Dikgobe | sorghum:60 cowpeas:60 water:150 | samp and beans botswana | bowl
`);
L('Cameroon', 'Cameroonian', AF, `
Mbongo tchobi | fish:160 palm_oil:12 onion:20 tomato:30 | black pepper fish stew | bowl
Sanga | corn:100 spinach:100 palm_oil:12 | corn and leaves cameroon | bowl
Kwacoco bible | cocoyam:150 spinach:60 palm_oil:12 fish:40 | cocoyam pudding | portion
Okok | spinach:150 peanut_butter:30 cassava_cooked:100 | eru with peanut | plate
Soya (Cameroonian suya) | beef:150 peanuts:10 chili_powder:3 onion:20 | cameroon beef skewers | serving
`);
L("Côte d'Ivoire", 'Ivorian', AF, `
Foutou banane with sauce claire | plantain:200 cassava_cooked:80 fish:100 tomato:50 water:150 | foutou | plate
Sauce gombo (Ivorian) | okra:120 fish:80 palm_oil:15 onion:20 | okra sauce ivory coast | bowl
Placali | cassava_cooked:250 | cassava paste ivory coast | portion
`);
L('Egypt', 'Egyptian', AF, `
Bamia (Egyptian) | okra:150 beef:100 tomato_canned:100 onion:20 garlic:3 | okra stew egypt | bowl
Feteer with honey | flour:70 butter:25 honey:20 | egyptian pie with honey | slice
Basbousa | semolina:40 sugar:25 butter:12 yogurt:20 coconut_meat:8 | semolina cake | piece
Roz bel laban | rice:60 milk:150 sugar:15 | egyptian rice pudding | bowl
Mesaka'a | eggplant:200 tomato:80 onion:20 oil:15 | egyptian moussaka | portion
Kofta with tahini | beef_mince:150 onion:20 parsley:3 tahini:20 | egyptian kofta | plate
`);
L('Ethiopia', 'Ethiopian', AF, `
Genfo | flour:80 butter:15 chili_powder:2 water:120 | ethiopian porridge | bowl
Dulet | liver:80 beef_mince:50 tripe:40 onion:30 butter:10 chili:3 | minced tripe liver | portion
Tegabino shiro | chickpea_flour:60 onion:30 oil:15 garlic:3 water:150 | thick shiro | bowl
Ayib with gomen | cottage:80 kale:120 oil:8 | cottage cheese with greens | plate
Kik alicha | split_peas:160 onion:30 turmeric:1 oil:10 | yellow split pea stew | bowl
Fasolia (Ethiopian) | green_beans:150 carrots:60 onion:30 oil:10 | green beans and carrots | portion
`);
L('Ghana', 'Ghanaian', AF, `
Tatale | ripe_plantain:150 flour:20 onion:10 oil:15 | plantain pancakes | serving (3)
Aprapransa | cornmeal:80 palm_oil:20 crab:60 fish:40 kidney:40 | palm nut corn dish | bowl
Etor | yam:200 palm_oil:20 egg_boiled:50 peanuts:15 | mashed yam with palm oil | plate
Abenkwan | palm_oil:30 chicken_thigh:120 tomato:40 onion:20 water:150 | palm nut soup | bowl
Ga kenkey with pepper and fish | cornmeal:200 fish:100 tomato:40 chili:5 onion:15 | ga kenkey | plate
Nkatenkwan | peanut_butter:40 chicken_thigh:120 tomato:40 onion:20 water:150 | groundnut soup with chicken | bowl
Oto | yam:200 palm_oil:15 egg_boiled:50 onion:10 | mashed yam oto | plate
`);
L('Kenya', 'Kenyan', AF, `
Matoke (Kenyan) | green_plantain:200 tomato:50 onion:20 oil:10 beef:60 | green banana stew | bowl
Mukimo | potato:150 peas:50 corn:40 spinach:40 | mashed potato with greens | portion
Kachumbari | tomato:100 onion:30 coriander:3 lime:5 chili:2 | kenyan salsa salad | portion
Mandazi | flour:60 sugar:10 coconut_milk:20 oil:15 | kenyan doughnuts | serving (2)
Omena with ugali | sardine:80 tomato:40 onion:20 oil:10 cornmeal:100 water:200 | silver cyprinid | plate
Mutura | beef_mince:100 liver:20 onion:15 | kenyan sausage | portion
Kenyan chai | black_tea:150 milk:120 sugar:12 ginger:2 | chai ya maziwa | cup
`);
L('Nigeria', 'Nigerian', AF, `
Ofada rice with ayamase | rice:200 green_pepper:60 palm_oil:20 beef:60 egg_boiled:30 | designer stew | plate
Gizdodo | gizzard:100 plantain_fried:120 tomato:40 green_pepper:20 oil:10 | gizzard and plantain | plate
Nkwobi | goat:150 palm_oil:20 onion:10 | spicy cow foot | portion
Abacha | cassava_cooked:150 palm_oil:20 fish:40 onion:15 | african salad | plate
Ekuru | cowpeas:150 oil:10 | white moin moin | portion
Boli and fish | plantain:200 fish:120 oil:8 chili:3 | roasted plantain with fish | plate
Ofe akwu | palm_oil:30 chicken_thigh:100 onion:20 | banga stew igbo | bowl
Ukwa | kidney:200 palm_oil:10 | african breadfruit porridge | bowl
`);
L('Senegal', 'Senegalese', AF, `
Thiakry | millet:80 yogurt:120 sugar:15 raisins:10 | millet yogurt dessert | bowl
Pastels (Senegal) | flour:50 fish:50 onion:15 oil:20 | senegalese fish pastries | serving (3)
Soupou kandja | okra:150 fish:100 palm_oil:20 rice:200 | okra palm sauce with rice | plate
Ceebu yapp | rice:220 beef:110 onion:40 oil:15 | rice with meat senegal | plate
Lakh | millet:80 yogurt:100 sugar:10 | millet porridge with yogurt | bowl
`);
L('South Africa', 'South African', AF, `
Vetkoek with mince | flour:70 oil:20 beef_mince:80 onion:15 | fat cakes with mince | serving
Chakalaka and pap | baked_beans:100 carrots:40 red_pepper:30 onion:20 cornmeal:90 water:180 | chakalaka pap | plate
Malva pudding | flour:30 sugar:25 butter:12 jam:10 milk:30 cream:20 | malva | portion
Melktert | pie_crust:35 milk:80 sugar:15 egg:15 cinnamon:1 | milk tart | slice
Koeksisters | flour:40 oil:15 sugar:30 | koesister | serving (2)
Umngqusho | corn:100 kidney:80 onion:15 oil:5 | samp and beans | bowl
Sosaties | lamb:150 apricot_dried:20 onion:20 curry:3 | south african kebabs | serving (2)
`);
L('Tanzania', 'Tanzanian', AF, `
Mshikaki | beef:150 lemon:5 ginger:3 oil:5 | tanzanian beef skewers | serving (3)
Mchemsho | beef:100 potato:80 green_plantain:80 carrots:40 water:200 | tanzanian boiled stew | bowl
Wali wa nazi | rice:200 coconut_milk:60 | coconut rice | plate
Ndizi nyama | green_plantain:180 beef:90 tomato:50 onion:20 coconut_milk:30 | plantain with meat | bowl
Vitumbua | rice_flour:50 coconut_milk:40 sugar:10 oil:8 | rice coconut pancakes | serving (4)
`);
L('Uganda', 'Ugandan', AF, `
Luwombo | chicken_thigh:150 peanut_butter:20 tomato:40 onion:20 | ugandan steamed chicken | portion
Katogo | green_plantain:180 beef:80 tomato:40 onion:20 oil:8 | matoke with offal | bowl
Groundnut stew with matoke | peanut_butter:40 green_plantain:200 tomato:40 | g-nut sauce with matooke | plate
Malakwang | spinach:150 peanut_butter:30 | sour greens with peanut | portion
`);
L('Morocco', 'Moroccan', AF, `
Zaalouk | eggplant:200 tomato:80 garlic:3 olive_oil:15 cumin:1 | eggplant salad morocco | portion
Taktouka | red_pepper:120 tomato:100 olive_oil:12 garlic:3 | pepper tomato salad | portion
Rfissa | chicken_thigh:150 lentils:60 flour:60 butter:10 onion:30 | rfissa | plate
Seffa | couscous:180 butter:15 sugar:10 cinnamon:1 almonds:10 | sweet couscous | plate
Msemen | flour:70 semolina:15 butter:10 oil:8 | moroccan pancake | piece
Baghrir | semolina:50 flour:15 milk:60 butter:8 honey:15 | thousand hole pancakes | serving (2)
Bissara | fava:200 olive_oil:15 cumin:1 garlic:3 | fava bean soup | bowl
`);
L('Tunisia', 'Tunisian', AF, `
Lablabi | chickpeas:200 bread:40 egg:50 olive_oil:12 cumin:1 | chickpea soup tunisia | bowl
Kafteji | potato:80 zucchini:60 red_pepper:50 egg:50 oil:20 | fried vegetables with egg | plate
Fricassé | flour:60 oil:15 tuna:40 egg_boiled:25 olives:8 potato:30 | tunisian fried sandwich | sandwich
Mloukhia (Tunisian) | beef:120 olive_oil:20 spinach:50 | jute leaf stew | bowl
`);
L('Libya', 'Libyan', AF, `
Bazeen | flour:120 lamb:80 tomato_paste:20 potato:60 egg_boiled:30 | libyan barley dough | plate
Shorba Libya | lamb:70 pasta:40 chickpeas:30 tomato_paste:15 mint:2 | libyan soup | bowl
Usban | rice:60 lamb:60 liver:30 parsley:5 | libyan stuffed sausage | portion
`);
L('Sudan', 'Sudanese', AF, `
Kisra with mullah | sorghum:80 okra:60 beef:60 onion:20 oil:8 | kisra and stew | plate
Ful sudani | fava:200 oil:12 feta:20 cumin:1 | sudanese ful | bowl
Gurasa | flour:90 water:60 oil:5 | sudanese thick pancake | piece
Aseeda | flour:100 water:150 butter:10 | sudanese porridge | bowl
`);
L('Somalia', 'Somali', AF, `
Bariis iskukaris | rice:220 goat:100 onion:30 raisins:10 oil:12 | somali spiced rice | plate
Suqaar | beef:150 onion:30 green_pepper:30 oil:10 | somali beef cubes | portion
Sambusa (Somali) | flour:40 beef_mince:50 onion:15 oil:15 | somali samosa | serving (2)
Muufo | cornmeal:80 flour:20 water:60 | somali flatbread | piece
Xalwo | sugar:40 cornstarch:15 butter:15 cardamom:1 | somali halwa | portion
`);
L('Madagascar', 'Malagasy', AF, `
Romazava | beef:120 spinach:120 tomato:40 onion:20 water:200 | malagasy beef and greens | bowl
Ravitoto | pork_shoulder:100 spinach:150 coconut_milk:40 | cassava leaves with pork | bowl
Mofo gasy | rice_flour:60 sugar:10 milk:30 oil:8 | malagasy rice cakes | serving (3)
Koba | peanuts:30 rice_flour:30 banana:40 sugar:15 | malagasy peanut cake | slice
`);
L('Zimbabwe', 'Zimbabwean', AF, `
Sadza with nyama | cornmeal:110 water:220 beef:120 tomato:40 onion:20 | sadza and beef stew | plate
Muriwo unedovi | kale:150 peanut_butter:25 tomato:30 onion:15 | greens in peanut butter | portion
Dovi | peanut_butter:40 chicken_thigh:120 tomato:40 onion:20 | zimbabwe peanut stew | bowl
Mupunga unedovi | rice:200 peanut_butter:30 | rice with peanut butter | plate
`);
L('Zambia', 'Zambian', AF, `
Nshima with ifisashi | cornmeal:110 water:220 spinach:120 peanuts:25 | nshima and greens | plate
Kapenta with nshima | sardine:80 tomato:40 onion:20 oil:10 cornmeal:100 water:200 | kapenta | plate
Chikanda | peanuts:40 chili:2 | african polony | slice
`);
L('Mali', 'Malian', AF, `
Tiguadege na | peanut_butter:40 beef:100 tomato:40 onion:20 rice:200 | malian peanut stew | plate
Fakoye | goat:120 okra:40 onion:20 oil:10 | jute mallow lamb | bowl
Fonio salad | fonio:60 tomato:40 cucumber:40 onion:15 oil:8 lemon:5 | fonio grain salad | bowl
`);
L('Rwanda', 'Rwandan', AF, `
Isombe | spinach:150 peanut_butter:25 palm_oil:12 eggplant:40 | cassava leaves rwanda | bowl
Igisafuria | chicken_thigh:120 green_plantain:100 tomato:40 onion:20 | rwandan pot stew | bowl
Brochettes (Rwanda) | goat:150 onion:20 | goat skewers | serving (3)
`);
L('India', 'Indian', AS, `
Poha | rice:120 peanuts:15 onion:20 oil:8 turmeric:1 | flattened rice | plate
Upma | semolina:60 onion:20 oil:10 peas:20 | rava upma | bowl
Aloo paratha | flour:80 potato:80 butter:10 | potato stuffed flatbread | paratha
Paneer paratha | flour:80 paneer:50 butter:10 | paneer stuffed flatbread | paratha
Rajma chawal | kidney:180 tomato:50 onion:20 oil:10 rice:180 | rajma rice | plate
Kadhi chawal | yogurt:150 chickpea_flour:20 oil:8 rice:180 | kadhi rice | plate
Pav bhaji | potato:100 cauliflower:40 peas:30 tomato:50 butter:15 roll:80 | pav bhaji | plate
Vada pav | potato:100 chickpea_flour:25 oil:15 roll:60 | vada pav | serving
Bhindi masala | okra:180 onion:30 tomato:40 oil:12 | okra masala | portion
Baingan bharta | eggplant:250 onion:30 tomato:50 oil:12 | smoked eggplant mash | portion
Malai kofta | paneer:60 potato:50 cream:40 tomato:60 cashews:10 | malai kofta | portion
Egg curry (Indian) | egg_boiled:100 onion:40 tomato:60 oil:12 curry:3 | anda curry | portion
Fish curry (Kerala) | fish:160 coconut_milk:80 tamarind:5 curry:3 oil:8 | kerala fish curry | bowl
Uttapam | rice:80 lentils:30 onion:20 tomato:20 oil:8 | onion uttapam | piece
Pongal | rice:80 lentils:40 ghee:10 black_pepper:1 | ven pongal | bowl
Khichdi | rice:70 lentils:50 ghee:8 turmeric:1 | moong dal khichdi | bowl
Kheer | rice:40 milk:200 sugar:20 cardamom:1 almonds:5 | rice kheer | bowl
Gajar halwa | carrots:150 milk:100 sugar:25 ghee:10 | carrot halwa | portion
Besan ladoo | chickpea_flour:30 ghee:15 sugar:20 | besan laddu | serving (2)
Dhokla | chickpea_flour:60 yogurt:30 oil:5 | khaman dhokla | serving (4 pieces)
Masala chai | black_tea:120 milk:120 sugar:10 cardamom:1 ginger:2 | indian tea | cup
`);
L('Pakistan', 'Pakistani', AS, `
Aloo keema | beef_mince:110 potato:100 onion:30 tomato:40 oil:12 | mince and potato | portion
Daal chawal | lentils:180 rice:180 oil:10 onion:15 | lentils and rice | plate
Halwa puri | flour:80 oil:25 semolina:30 sugar:20 chickpeas:80 | halwa poori breakfast | plate
Chapli kebab | beef_mince:120 onion:20 tomato:20 oil:15 | peshawari kebab | serving (2)
Saag with makki roti | spinach:200 butter:15 cornmeal:80 | sarson ka saag | plate
`);
L('Bangladesh', 'Bangladeshi', AS, `
Bhuna khichuri | rice:80 lentils:50 beef:80 oil:12 | beef khichuri | plate
Shorshe ilish | fish:150 mustard:15 oil:12 | hilsa in mustard | portion
Aloo bhorta | potato:200 onion:15 oil:8 chili:3 | mashed potato bangladeshi | portion
Begun bhaja | eggplant:150 oil:20 turmeric:1 | fried eggplant | portion
Pitha (Bangladeshi) | rice_flour:60 coconut_meat:20 sugar:15 | rice cake pitha | serving (2)
`);
L('Sri Lanka', 'Sri Lankan', AS, `
Pol sambol | coconut_meat:60 onion:15 chili:3 lime:5 | coconut relish | portion
Parippu | red_lentils:150 coconut_milk:50 onion:15 turmeric:1 | sri lankan dhal | bowl
String hoppers with curry | rice_flour:80 water:60 chicken_thigh:100 coconut_milk:40 | idiyappam | plate
Wattalappam | coconut_milk:80 egg:30 sugar:25 | coconut custard | portion
`);
L('Nepal', 'Nepali', AS, `
Sel roti | rice_flour:60 sugar:15 oil:15 | nepali rice doughnut | piece
Aloo tama | potato:100 bamboo:60 black_eyed_alt:0 kidney:50 | potato bamboo shoot curry | bowl
Gundruk soup | spinach:80 tomato:30 onion:15 water:200 | fermented greens soup | bowl
Chatamari | rice_flour:60 egg:30 chicken_mince:40 | nepali rice crepe | piece
`);
L('China', 'Chinese', AS, `
Tomato and egg stir fry | tomato:200 egg:100 oil:12 sugar:5 | fanqie chao dan | plate
Congee with century egg | rice:60 water:300 egg:40 | pidan shourou zhou | bowl
Mapo eggplant | eggplant:200 pork_mince:40 oil:15 soy:10 | yu xiang qiezi | plate
Dan dan noodles | egg_noodles:180 pork_mince:50 peanut_butter:10 soy:10 chili:3 | dan dan mian | bowl
Scallion pancake | flour:70 oil:15 onion:15 | cong you bing | pancake
Steamed fish with ginger | fish:170 ginger:5 soy:10 oil:8 onion:10 | qing zheng yu | plate
Dry fried green beans | green_beans:180 pork_mince:30 oil:15 garlic:3 | gan bian si ji dou | plate
Hot and sour soup | tofu:60 mushrooms:30 egg:25 vinegar:10 soy:8 stock:250 | suan la tang | bowl
Zhajiang noodles | egg_noodles:180 pork_mince:70 soy:15 cucumber:30 | fried sauce noodles | bowl
Lanzhou beef noodle soup | egg_noodles:180 beef:70 stock:300 | lamian | bowl
Rou jia mo | flour:80 pork_belly:70 | chinese hamburger | piece
Jianbing | flour:50 egg:50 oil:8 hoisin:10 | chinese crepe | piece
Tangyuan | sticky_rice:60 sesame:10 sugar:15 | sweet rice balls | bowl
Egg tart (Chinese) | puff_pastry:30 egg:20 milk:20 sugar:10 | dan tat | tart
`);
L('Japan', 'Japanese', AS, `
Oyakodon | chicken_thigh:100 egg:60 onion:30 soy:10 rice_short:200 | chicken egg rice bowl | bowl
Gyudon | beef:100 onion:40 soy:12 sugar:5 rice_short:200 | beef rice bowl | bowl
Katsu curry | pork_loin:120 breadcrumbs:20 oil:15 curry:8 rice_short:200 | japanese curry with cutlet | plate
Omurice | rice_short:180 chicken_thigh:50 ketchup:20 egg:80 | omelette rice | plate
Tamagoyaki | egg:100 sugar:5 soy:3 oil:3 | rolled omelette | serving
Nikujaga | beef:80 potato:150 carrots:40 onion:30 soy:12 sugar:8 | meat and potato stew | bowl
Okonomiyaki | flour:50 cabbage:100 egg:50 pork_belly:30 mayo:10 | japanese savory pancake | pancake
Onigiri with salmon | rice_short:120 salmon:25 laver:2 | rice ball salmon | serving (1)
Zaru soba | soba:200 soy:15 | cold soba | plate
Chawanmushi | egg:60 stock:120 shrimp:20 | savory egg custard | cup
Dorayaki | flour:40 egg:20 sugar:15 kidney:40 | red bean pancake | piece
`);
L('South Korea', 'Korean', AS, `
Kimchi fried rice | rice:220 kimchi:60 pork_belly:30 egg_fried:50 oil:8 | kimchi bokkeumbap | plate
Japchae | rice_noodles:120 beef:50 spinach:40 carrots:20 soy:12 sesame_oil:8 | glass noodles stir fry | plate
Doenjang jjigae | tofu:80 zucchini:50 potato:40 miso:20 water:250 | soybean paste stew | bowl
Gimbap | rice_short:180 laver:3 egg:30 carrots:20 spinach:20 ham_slice:20 | kimbap | roll
Dakgalbi | chicken_thigh:150 cabbage:60 sweet_potato:50 chili_powder:4 | spicy stir fried chicken | plate
Kimchi pancake | flour:50 kimchi:80 oil:12 | kimchijeon | pancake
Gyeran-jjim | egg:100 water:60 | steamed egg | bowl
Sundubu jjigae | tofu:150 egg:50 shrimp:30 chili_powder:5 water:200 | soft tofu stew | bowl
Hotteok | flour:50 brown_sugar:15 peanuts:5 oil:8 | sweet korean pancake | piece
`);
L('Thailand', 'Thai', AS, `
Pad krapow with egg | chicken_mince:120 basil:5 oil:10 soy:8 rice:200 egg_fried:50 | holy basil stir fry | plate
Khao man gai | chicken_breast:130 rice:200 ginger:3 | thai chicken rice | plate
Khao pad | rice:220 egg:40 onion:20 fish_sauce:8 oil:10 | thai fried rice | plate
Pad see ew | rice_noodles:200 chicken_breast:80 broccoli:60 soy:15 egg:30 oil:10 | pad siew | plate
Larb gai | chicken_mince:130 lime:10 fish_sauce:8 mint:3 onion:15 | thai minced chicken salad | portion
Tom kha gai | chicken_breast:100 coconut_milk:120 mushrooms:30 lime:5 | coconut chicken soup | bowl
Khao soi | egg_noodles:150 chicken_thigh:100 coconut_milk:100 curry:6 | northern curry noodles | bowl
Mango sticky rice | sticky_rice:120 mango:120 coconut_milk:40 sugar:10 | khao niao mamuang | plate
Thai iced tea | black_tea:200 condensed:30 milk:30 | cha yen | glass
`);
L('Vietnam', 'Vietnamese', AS, `
Com tam | rice:200 pork_loin:100 egg_fried:50 fish_sauce:8 | broken rice with pork | plate
Bun bo Hue | rice_noodles:180 beef:80 stock:300 lemongrass:5 | hue beef noodle soup | bowl
Bun thit nuong | rice_noodles:150 pork_loin:100 lettuce:30 peanuts:10 fish_sauce:10 | grilled pork vermicelli | bowl
Goi cuon | rice_noodles:40 shrimp:40 pork_loin:30 lettuce:20 | fresh spring rolls | serving (2)
Ca kho to | fish:160 fish_sauce:10 sugar:8 | caramelised fish clay pot | portion
Banh xeo | rice_flour:50 coconut_milk:30 shrimp:40 pork_belly:30 bean_sprouts:40 oil:12 | vietnamese crepe | piece
Che ba mau | kidney:50 coconut_milk:40 sugar:20 tapioca:10 | three color dessert | glass
Ca phe sua da | coffee:100 condensed:25 | vietnamese iced coffee | glass
`);
L('Philippines', 'Filipino', AS, `
Tapsilog | beef:100 rice:200 egg_fried:50 garlic:3 | tapa garlic rice egg | plate
Longsilog | sausage:100 rice:200 egg_fried:50 | longganisa rice egg | plate
Bistek tagalog | beef:150 onion:40 soy:15 lemon:10 | filipino beef steak | portion
Pancit canton | egg_noodles:180 chicken_breast:60 cabbage:40 carrots:20 soy:12 | stir fried noodles | plate
Arroz caldo | rice:60 chicken_thigh:80 ginger:5 stock:250 | chicken rice porridge | bowl
Ginataang kalabasa | pumpkin:150 green_beans:50 shrimp:50 coconut_milk:80 | squash in coconut milk | bowl
Turon | banana:80 flour:15 brown_sugar:12 oil:12 | banana spring roll | serving (2)
Leche flan | egg:40 condensed:50 milk:30 sugar:10 | filipino flan | slice
Ube halaya | taro:100 condensed:40 butter:8 | purple yam jam | portion
Champorado | sticky_rice:60 cocoa_powder:10 sugar:20 milk:50 | chocolate rice porridge | bowl
`);
L('Indonesia', 'Indonesian', AS, `
Nasi uduk | rice:200 coconut_milk:40 egg_fried:50 peanuts:15 | coconut rice indonesia | plate
Bakso | beef_mince:100 rice_noodles:80 stock:250 | meatball soup | bowl
Soto ayam | chicken_breast:90 rice_noodles:60 egg_boiled:30 turmeric:1 stock:250 | chicken turmeric soup | bowl
Tempeh goreng | tempeh:120 oil:15 | fried tempeh | portion
Tahu telur | tofu:100 egg:60 oil:15 peanut_butter:15 soy:10 | tofu omelette | plate
Pisang goreng | banana:120 flour:25 oil:15 | fried banana | serving (2)
Martabak manis | flour:60 sugar:15 butter:15 dark_choc:15 peanuts:10 | sweet thick pancake | slice (2)
`);
L('Malaysia', 'Malaysian', AS, `
Roti canai with dhal | flour:80 ghee:15 lentils:100 | roti canai | plate
Mee goreng mamak | egg_noodles:180 tofu:40 egg:30 ketchup:15 soy:10 oil:12 | mamak fried noodles | plate
Nasi kandar | rice:200 chicken_thigh:100 curry:5 egg_boiled:30 | penang rice and curry | plate
Char kway teow (Malaysian) | rice_noodles:200 shrimp:50 egg:30 bean_sprouts:30 soy:10 oil:15 | fried flat noodles | plate
Kuih lapis | rice_flour:30 coconut_milk:40 sugar:20 tapioca:10 | layer cake | serving (2)
Teh tarik | black_tea:180 condensed:30 | pulled tea | cup
`);
L('Singapore', 'Singaporean', AS, `
Kaya toast with soft-boiled eggs | bread:60 butter:10 jam:20 egg_boiled:100 | kaya toast set | serving
Bak kut teh | ribs:150 garlic:5 stock:300 rice:150 | pork rib soup | bowl
Carrot cake (Singapore) | rice_flour:80 egg:40 oil:12 soy:5 | chai tow kway | plate
Fish soup bee hoon | fish:120 rice_noodles:100 stock:300 | fish noodle soup | bowl
`);
L('Iran', 'Iranian', AS, `
Ash reshteh | pasta:50 kidney:40 chickpeas:40 lentils:30 spinach:60 yogurt:20 | herb noodle soup | bowl
Kashk-e bademjan | eggplant:200 yogurt:40 onion:20 oil:15 walnuts:10 | eggplant dip | portion
Zereshk polo ba morgh | rice:200 chicken_thigh:130 raisins:15 saffron:0.1 butter:8 | barberry rice with chicken | plate
Kuku sabzi | egg:100 spinach:60 parsley:10 walnuts:10 oil:10 | herb frittata | slice
Sholeh zard | rice:50 sugar:30 saffron:0.1 almonds:5 water:150 | saffron rice pudding | bowl
`);
L('Türkiye', 'Turkish', AS, `
Menemen | egg:100 tomato:100 green_pepper:40 olive_oil:10 | turkish scrambled eggs | plate
Mercimek çorbası | red_lentils:80 onion:20 carrots:30 butter:8 water:250 | turkish lentil soup | bowl
Karnıyarık | eggplant:200 beef_mince:70 tomato:50 onion:20 oil:15 | stuffed eggplant | portion
Kuru fasulye with rice | kidney:180 tomato_paste:15 onion:20 oil:10 rice:150 | turkish beans and rice | plate
Simit | flour:80 sesame:10 molasses:8 | turkish sesame ring | piece
Sütlaç | rice:30 milk:180 sugar:20 | turkish rice pudding | bowl
Çılbır | egg_poached:100 yogurt:100 butter:10 chili_powder:1 | poached eggs in yogurt | plate
Lahmacun | flour:70 beef_mince:50 tomato:30 onion:15 | turkish flatbread with mince | piece
`);
L('Lebanon', 'Lebanese', AS, `
Manakish za'atar | flour:80 olive_oil:15 sesame:5 oregano:3 | zaatar flatbread | piece
Fatteh with chickpeas | pita:50 chickpeas:120 yogurt:100 tahini:10 olive_oil:5 | lebanese fatteh | bowl
Mujadara | lentils:150 rice:100 onion:50 olive_oil:15 | lentils and rice with onions | plate
Kibbeh | bulgur:50 beef_mince:70 onion:20 oil:15 | fried kibbeh | serving (3)
Halloumi and tomato | halloumi:80 tomato:60 olive_oil:5 | grilled halloumi | plate
Mouhalabieh | milk:150 sugar:15 cornstarch:12 pistachio:5 | milk pudding | cup
`);
L('Israel', 'Israeli', AS, `
Sabich | pita:70 eggplant:80 egg_boiled:50 tahini:15 tomato:30 | sabich pita | sandwich
Israeli salad | tomato:100 cucumber:100 onion:15 olive_oil:10 lemon:5 | chopped salad | bowl
Jachnun | flour:80 butter:25 sugar:5 | yemeni rolled pastry | piece
Malabi | milk:150 sugar:15 cornstarch:12 coconut_meat:5 | rose milk pudding | cup
`);
L('Saudi Arabia', 'Saudi', AS, `
Mutabbaq | flour:60 beef_mince:50 egg:30 onion:15 oil:15 | stuffed pan bread | piece
Jareesh | bulgur:80 chicken_meat:60 yogurt:40 onion:15 butter:8 | crushed wheat porridge | bowl
Saleeg | rice:200 milk:100 chicken_meat:100 butter:10 | creamy rice with chicken | plate
Luqaimat | flour:40 oil:15 dates:20 sugar:10 | sweet dumplings with date syrup | serving (5)
`);
L('Iraq', 'Iraqi', AS, `
Tashreeb | bread:60 chickpeas:60 chicken_meat:80 stock:200 | bread soaked in broth | bowl
Masgouf | fish:200 tomato:40 onion:20 | grilled carp | portion
Kahi with geymar | flour:60 butter:20 cream:30 honey:15 | iraqi pastry with cream | serving
Timman bagilla | rice:200 fava:60 dill:5 lamb:80 | rice with fava beans and dill | plate
`);
L('Afghanistan', 'Afghan', AS, `
Bolani | flour:70 potato:60 onion:10 oil:15 | stuffed flatbread | piece
Shorwa | lamb:90 potato:80 chickpeas:30 tomato:30 water:250 | afghan soup | bowl
Firni | milk:150 sugar:15 cornstarch:10 pistachio:5 cardamom:1 | afghan milk pudding | cup
`);
L('Uzbekistan', 'Uzbek', AS, `
Lagman | egg_noodles:180 beef:80 red_pepper:40 tomato:40 onion:20 | uzbek noodles | bowl
Shashlik (Uzbek) | lamb:160 onion:30 | lamb skewers | serving (2)
Shurpa | lamb:90 potato:80 carrots:40 tomato:30 water:250 | uzbek lamb soup | bowl
`);
L('Kazakhstan', 'Kazakh', AS, `
Baursak | flour:60 oil:15 milk:20 sugar:5 | fried dough kazakh | serving (4)
Kuyrdak | lamb:120 liver:40 potato:80 onion:30 oil:10 | fried offal and meat | plate
Kazakh pilaf | rice:180 lamb:90 carrots:50 onion:30 oil:15 | palau | plate
`);
L('Mongolia', 'Mongolian', AS, `
Khuushuur | flour:60 lamb_mince:60 onion:15 oil:20 | fried meat pastry | serving (2)
Tsuivan | egg_noodles:180 beef:80 cabbage:40 carrots:30 oil:10 | mongolian fried noodles | plate
Suutei tsai | green_tea:150 milk:100 salt:1 | mongolian milk tea | cup
`);
L('Myanmar', 'Burmese', AS, `
Tea leaf salad | cabbage:80 tomato:40 peanuts:20 sesame:5 green_tea:5 oil:8 lime:5 | lahpet thoke | bowl
Shan noodles | rice_noodles:180 chicken_mince:70 tomato:40 peanuts:10 | shan khao swe | bowl
Burmese chicken curry | chicken_thigh:150 onion:40 tomato:30 oil:15 turmeric:1 | kyet thar hin | portion
`);
L('Cambodia', 'Cambodian', AS, `
Bai sach chrouk | pork_loin:110 rice:200 cucumber:30 | pork and rice | plate
Kuy teav | rice_noodles:180 pork_loin:60 shrimp:30 stock:300 | phnom penh noodle soup | bowl
Nom banh chok | rice_noodles:180 fish:60 coconut_milk:40 cucumber:30 | khmer noodles | bowl
`);
L('Laos', 'Lao', AS, `
Khao piak sen | rice_noodles:180 chicken_meat:80 stock:300 | lao chicken noodle soup | bowl
Or lam | beef:80 eggplant:60 green_beans:40 lemongrass:3 water:200 | lao stew | bowl
Mok pa | fish:150 coconut_milk:30 lemongrass:3 | steamed fish in banana leaf | portion
`);
L('Taiwan', 'Taiwanese', AS, `
Lu rou fan | pork_belly:80 soy:12 sugar:5 rice:200 | braised pork rice | bowl
Taiwanese beef noodle soup | egg_noodles:180 shank:100 soy:15 stock:300 | niu rou mian | bowl
Scallion egg pancake | flour:50 egg:50 onion:10 oil:10 | dan bing | piece
Bubble milk tea | black_tea:200 milk:60 sugar:20 tapioca:30 | boba tea | glass
`);
L('Hong Kong', 'Hong Kong', TE, `
Hong Kong milk tea | black_tea:200 evaporated:40 sugar:10 | silk stocking tea | cup
Pineapple bun with butter | flour:60 sugar:15 butter:15 egg:10 | bolo bao | bun
Macaroni soup with ham | pasta:100 ham_slice:40 egg_fried:50 stock:250 | hk breakfast macaroni | bowl
`);
L('United Kingdom', 'British', EUR, `
Bubble and squeak | potato:150 cabbage_cooked:80 butter:10 | fried leftover veg | portion
Toad in the hole | sausage:120 flour:30 egg:25 milk:60 oil:8 | sausages in batter | portion
Cottage pie | beef_mince:120 carrots:30 onion:20 gravy:50 mash:180 | beef and mash pie | portion
Ploughman's lunch | bread:60 cheddar:50 pickles:20 apple:60 ham_slice:30 | ploughmans | plate
Jacket potato with cheese | potato_baked:250 cheddar:40 butter:8 | baked potato cheese | potato
Cheese and onion pasty | puff_pastry:80 cheddar:40 onion:20 potato:30 | cheese pasty | pasty
Sausage roll | puff_pastry:50 sausage:50 | sausage roll | roll
Scotch egg | egg_boiled:50 sausage:50 breadcrumbs:15 oil:10 | scotch egg | egg
Crumpets with butter | flour:50 butter:10 | crumpets | serving (2)
Welsh rarebit | bread:60 cheddar:45 milk:15 mustard:3 worcestershire:2 | cheese on toast welsh | serving
Kedgeree | rice:180 haddock:80 egg_boiled:50 curry:2 butter:10 | kedgeree | plate
Spotted dick with custard | flour:40 butter:15 sugar:15 raisins:20 milk:80 egg:10 | spotted dick | portion
Victoria sponge | flour:35 sugar:30 butter:25 egg:20 jam:15 cream:15 | victoria sandwich | slice
Treacle tart | pie_crust:40 molasses:30 breadcrumbs:15 lemon:3 | treacle tart | slice
`);
L('Ireland', 'Irish', EUR, `
Colcannon | potato:200 cabbage_cooked:60 butter:15 milk:30 | irish mash with cabbage | portion
Boxty | potato:150 flour:25 milk:30 butter:10 | irish potato pancake | serving (2)
Coddle | sausage:100 bacon:30 potato:120 onion:30 water:150 | dublin coddle | bowl
Soda bread with butter | flour:60 buttermilk:40 butter:10 | irish soda bread | slice (2)
Barmbrack | flour:40 raisins:20 sugar:12 egg:10 black_tea:20 | tea brack | slice
`);
L('France', 'French', EUR, `
Croque monsieur | bread:70 ham_slice:40 swiss:30 milk:30 butter:8 | ham cheese toastie french | sandwich
Croque madame | bread:70 ham_slice:40 swiss:30 milk:30 butter:8 egg_fried:50 | croque with egg | sandwich
Quiche lorraine | pie_crust:50 egg:40 cream:40 bacon:25 swiss:15 | quiche | slice
Ratatouille | eggplant:80 zucchini:80 red_pepper:60 tomato:80 olive_oil:15 | ratatouille | portion
Soupe à l'oignon | onion:150 butter:10 stock:250 bread:30 swiss:30 | french onion soup | bowl
Gratin dauphinois | potato:200 cream:50 milk:30 garlic:3 | potato gratin | portion
Salade niçoise | tuna:80 egg_boiled:50 green_beans:50 potato:60 olives:15 tomato:50 olive_oil:10 | nicoise salad | bowl
Hachis parmentier | beef_mince:110 mash:180 swiss:15 | french cottage pie | portion
Pain perdu | bread:70 egg:50 milk:50 sugar:10 butter:10 | french toast | serving
Clafoutis | cherries:100 egg:30 milk:60 flour:15 sugar:15 | cherry clafoutis | portion
Madeleines | flour:25 butter:20 sugar:20 egg:15 | madeleine cakes | serving (3)
Pain au chocolat | croissant:60 dark_choc:10 | chocolate croissant | pastry
Tarte tatin | puff_pastry:40 apple:100 sugar:20 butter:12 | upside down apple tart | slice
`);
L('Germany', 'German', EUR, `
Käsespätzle | flour:80 egg:40 swiss:50 onion:30 butter:10 | cheese spaetzle | plate
Kartoffelsalat | potato:200 onion:20 vinegar:10 oil:10 | german potato salad | portion
Frikadellen | beef_mince:70 pork_mince:50 breadcrumbs:15 egg:15 onion:15 oil:10 | german meat patties | serving (2)
Rouladen | beef:150 bacon:15 pickles:15 onion:15 mustard:5 gravy:50 | beef rolls | portion
Kartoffelpuffer with applesauce | potato:150 egg:20 flour:10 oil:20 apple:80 | potato pancakes | serving (3)
Leberkäse roll | pork_mince:100 roll:60 mustard:5 | leberkaese semmel | sandwich
Linsensuppe | lentils:150 potato:60 carrots:30 sausage:40 water:200 | german lentil soup | bowl
Bienenstich | flour:40 sugar:20 butter:15 milk:40 almonds:10 honey:5 | bee sting cake | slice
Apfelstrudel | phyllo:30 apple:100 sugar:15 raisins:10 butter:10 breadcrumbs:5 | apple strudel | slice
Pfannkuchen | flour:40 milk:80 egg:40 butter:8 | german pancakes | pancake
`);
L('Italy', 'Italian', EUR, `
Pasta e fagioli | pasta:60 kidney:100 tomato_canned:80 olive_oil:10 stock:150 | pasta and beans | bowl
Cacio e pepe | pasta:220 parmesan:30 black_pepper:2 butter:5 | cheese and pepper pasta | plate
Pasta aglio e olio | pasta:220 olive_oil:20 garlic:6 chili:2 | garlic oil spaghetti | plate
Penne arrabbiata | pasta:220 tomato_canned:120 olive_oil:10 chili:3 garlic:3 | spicy penne | plate
Gnocchi with tomato sauce | gnocchi:200 marinara:100 parmesan:10 | gnocchi pomodoro | plate
Eggplant parmigiana | eggplant:200 marinara:100 mozzarella:50 parmesan:15 olive_oil:15 | melanzane alla parmigiana | portion
Chicken cacciatore | chicken_thigh:160 tomato_canned:100 red_pepper:40 onion:30 olive_oil:10 | hunters chicken | portion
Saltimbocca | veal:130 ham_slice:20 sage_alt:0 butter:10 | | portion
Arancini | rice_short:100 mozzarella:20 breadcrumbs:15 oil:15 | fried rice balls | serving (2)
Bruschetta | baguette:60 tomato:80 olive_oil:10 basil:3 garlic:2 | tomato bruschetta | serving (2)
Panzanella | bread:60 tomato:120 cucumber:50 onion:15 olive_oil:15 | bread salad | bowl
Frittata | egg:150 potato:50 onion:20 parmesan:10 olive_oil:8 | italian omelette | slice
Affogato | ice_cream:80 coffee:40 | ice cream with espresso | cup
Cannoli | flour:30 oil:10 ricotta:50 sugar:15 dark_choc:5 | sicilian cannoli | serving (2)
Zeppole | flour:40 egg:20 oil:15 sugar:10 | italian doughnuts | serving (3)
`);
L('Spain', 'Spanish', EUR, `
Patatas bravas | potato:200 oil:20 tomato:40 paprika:1 | spicy potatoes | portion
Croquetas de jamón | ham:30 milk:60 flour:20 butter:10 breadcrumbs:15 oil:12 | ham croquettes | serving (4)
Pisto | zucchini:100 red_pepper:60 tomato:100 onion:30 olive_oil:15 | spanish ratatouille | portion
Lentejas | lentils:180 chorizo:30 carrots:30 potato:50 | spanish lentil stew | bowl
Pan con tomate | baguette:60 tomato:50 olive_oil:10 | tomato bread | serving (2)
Salmorejo | tomato:250 bread:40 olive_oil:20 egg_boiled:20 ham:10 | cold tomato soup | bowl
Pollo al ajillo | chicken_thigh:180 garlic:8 olive_oil:15 | garlic chicken | portion
Arroz con leche (Spanish) | rice:50 milk:180 sugar:18 cinnamon:1 lemon:2 | spanish rice pudding | bowl
Torrijas | bread:60 milk:60 egg:30 sugar:15 oil:15 cinnamon:1 | spanish french toast | serving (2)
`);
L('Portugal', 'Portuguese', EUR, `
Bacalhau à Brás | salt_cod:100 potato:100 egg:50 onion:30 olive_oil:15 olives:10 | cod with eggs and potatoes | plate
Caldo verde | potato:150 kale:60 chorizo:20 olive_oil:10 water:200 | kale potato soup | bowl
Bifana | pork_loin:100 roll:70 garlic:3 | pork sandwich portugal | sandwich
Arroz de pato | rice:180 duck_meat:100 chorizo:20 | duck rice | plate
Bolo de arroz | flour:20 rice_flour:20 sugar:20 butter:12 egg:15 | rice muffin portugal | cake
`);
L('Greece', 'Greek', EUR, `
Spanakopita | phyllo:50 spinach:80 feta:40 egg:15 olive_oil:10 | spinach pie | slice
Gemista | tomato:200 rice:60 onion:20 olive_oil:15 | stuffed tomatoes and peppers | serving (2)
Fasolakia | green_beans:200 tomato_canned:80 potato:60 olive_oil:15 | greek green beans | portion
Briam | potato:100 zucchini:100 eggplant:60 tomato:60 olive_oil:20 | greek roasted vegetables | portion
Gigantes plaki | fava:200 tomato_canned:80 olive_oil:15 | baked giant beans | portion
Kolokithokeftedes | zucchini:150 feta:30 flour:20 egg:15 oil:15 | zucchini fritters | serving (3)
Loukoumades | flour:40 oil:15 honey:20 cinnamon:1 | greek honey doughnuts | serving (5)
Galaktoboureko | phyllo:30 semolina:20 milk:80 sugar:25 egg:15 butter:10 | custard pie | piece
Yogurt with honey and walnuts (Greek) | greek_yogurt_full:170 honey:15 walnuts:15 | yiaourti me meli | bowl
`);
L('Poland', 'Polish', EUR, `
Kotlet schabowy | pork_loin:150 breadcrumbs:20 egg:15 oil:15 | polish pork cutlet | portion
Placki ziemniaczane | potato:150 egg:20 flour:15 oil:20 | potato pancakes polish | serving (3)
Gołąbki | cabbage_cooked:120 beef_mince:70 rice:50 tomato_canned:60 | cabbage rolls | serving (2)
Żurek | sausage:50 egg_boiled:50 potato:60 rye_bread:20 water:250 | sour rye soup | bowl
Naleśniki with cheese | flour:40 milk:80 egg:30 cottage:60 sugar:8 | polish crepes | serving (2)
Pączki | flour:50 sugar:12 egg:10 oil:15 jam:15 | polish doughnut | doughnut
`);
L('Russia', 'Russian', EUR, `
Syrniki | cottage:120 flour:20 egg:20 sugar:10 oil:10 | cottage cheese pancakes | serving (3)
Olivier salad | potato:100 carrots:30 peas:30 egg_boiled:30 ham:30 mayo:30 pickles:15 | russian salad | portion
Kasha with butter | buckwheat:180 butter:10 | buckwheat porridge | bowl
Shchi | cabbage:150 potato:60 carrots:30 beef:60 water:250 | cabbage soup | bowl
Pelmeni | flour:60 pork_mince:40 beef_mince:40 sour_cream:20 | russian dumplings | serving (12)
Blini with sour cream | flour:40 milk:80 egg:20 butter:8 sour_cream:30 | russian pancakes | serving (3)
Medovik | flour:35 honey:20 sugar:15 butter:12 sour_cream:30 | honey cake | slice
`);
L('Ukraine', 'Ukrainian', EUR, `
Holubtsi | cabbage_cooked:120 pork_mince:70 rice:50 tomato_canned:60 | ukrainian cabbage rolls | serving (2)
Deruny | potato:150 egg:20 flour:15 oil:20 sour_cream:20 | ukrainian potato pancakes | serving (3)
Nalysnyky | flour:40 milk:80 egg:30 cottage:60 | ukrainian crepes | serving (2)
Kapusniak | sauerkraut:100 potato:60 carrots:30 pork_loin:50 water:250 | sauerkraut soup | bowl
`);
L('Hungary', 'Hungarian', EUR, `
Lángos | flour:80 oil:20 sour_cream:30 cheddar:20 garlic:2 | fried flatbread | piece
Lecsó | red_pepper:150 tomato:100 onion:30 sausage:40 oil:10 | pepper stew | portion
Túrós csusza | pasta:180 cottage:80 sour_cream:30 bacon:15 | pasta with cottage cheese | plate
Paprikás krumpli | potato:250 sausage:50 onion:30 paprika:3 oil:10 | paprika potatoes | bowl
Somlói galuska | sponge:60 dark_choc:15 cream:30 walnuts:10 raisins:10 | hungarian trifle | portion
`);
L('Netherlands', 'Dutch', EUR, `
Hutspot | potato:180 carrots:80 onion:40 butter:10 | dutch mash | portion
Erwtensoep | split_peas:100 sausage:40 carrots:30 potato:40 water:250 | dutch pea soup | bowl
Kroket | beef:40 flour:15 butter:10 milk:40 breadcrumbs:15 oil:12 | dutch croquette | piece
Poffertjes | flour:40 milk:50 egg:10 butter:10 icing_sugar:8 | mini pancakes | serving (10)
Hagelslag sandwich | bread:60 butter:8 dark_choc:20 | chocolate sprinkles bread | serving
`);
L('Belgium', 'Belgian', EUR, `
Carbonnade (alcohol-free) | beef:160 onion:60 brown_sugar:5 mustard:5 bread:20 stock:150 | belgian beef stew | bowl
Belgian waffle with strawberries | waffle:110 strawberries:60 whipped:20 icing_sugar:5 | brussels waffle | waffle
Speculoos | flour:20 brown_sugar:12 butter:8 cinnamon:1 | spice biscuits | serving (3)
`);
L('Sweden', 'Swedish', EUR, `
Pyttipanna | potato:180 beef:60 onion:30 egg_fried:50 oil:10 | swedish hash | plate
Kanelbulle | flour:45 butter:15 sugar:12 milk:20 cinnamon:1 | cinnamon bun swedish | bun
Ärtsoppa with pancakes | split_peas:100 pork_shoulder:40 water:250 pancake:60 jam:15 | pea soup thursday | meal
Raggmunk | potato:150 flour:20 egg:20 milk:40 bacon:20 oil:10 | potato pancakes with bacon | serving
Prinsesstårta | sponge:40 cream:40 milk:30 jam:10 sugar:15 | princess cake | slice
`);
L('Norway', 'Norwegian', EUR, `
Fiskesuppe | fish:120 salmon:40 carrots:30 cream:40 stock:200 | norwegian fish soup | bowl
Fårikål | lamb:160 cabbage:150 black_pepper:1 water:100 | lamb in cabbage | bowl
Lefse | potato:60 flour:30 butter:10 sugar:5 | norwegian potato flatbread | piece
Brunost on bread | bread:40 butter:5 cheddar:20 | brown cheese sandwich | serving
`);
L('Denmark', 'Danish', EUR, `
Smørrebrød with egg and shrimp | rye_bread:50 butter:5 egg_boiled:50 shrimp:40 mayo:10 | open sandwich | piece
Frikadeller | pork_mince:120 onion:20 egg:15 flour:10 oil:10 | danish meatballs | serving (3)
Æbleskiver | flour:40 milk:50 egg:15 butter:8 jam:15 | danish pancake balls | serving (5)
Danish pastry | puff_pastry:60 sugar:10 jam:10 | wienerbrod | pastry
`);
L('Finland', 'Finnish', EUR, `
Karjalanpiirakka | rye_bread:30 rice:50 milk:30 butter:5 egg_boiled:20 | karelian pie | serving (2)
Lohikeitto | salmon:120 potato:80 cream:40 dill:2 stock:150 | salmon soup | bowl
Mustikkapiirakka | flour:35 butter:15 sugar:15 blueberries:50 sour_cream:20 | blueberry pie finnish | slice
`);
L('Switzerland', 'Swiss', EUR, `
Rösti | potato:200 butter:15 | swiss potato cake | portion
Älplermagronen | pasta:150 potato:80 swiss:40 cream:30 onion:20 | alpine macaroni | plate
Zürcher Geschnetzeltes | veal:140 mushrooms:50 cream:50 onion:20 | zurich veal | portion
Bircher muesli | oats:50 apple:60 yogurt:100 milk:50 honey:8 | swiss muesli | bowl
`);
L('Austria', 'Austrian', EUR, `
Kaiserschmarrn | flour:50 milk:80 egg:50 sugar:10 butter:10 raisins:10 | shredded pancake | plate
Tafelspitz | beef:180 potato:150 carrots:40 stock:100 | boiled beef | plate
Germknödel | flour:60 sugar:10 jam:15 butter:15 | sweet dumpling | dumpling
Sachertorte | flour:25 dark_choc:30 butter:18 sugar:20 egg:20 jam:10 | sacher cake | slice
`);
L('Czechia', 'Czech', EUR, `
Svíčková | beef:150 carrots:40 cream:50 flour:60 | beef sirloin in cream sauce with dumplings | plate
Bramboráky | potato:150 flour:20 egg:20 oil:20 garlic:2 | czech potato pancakes | serving (2)
Kolache | flour:50 sugar:12 butter:10 cottage:30 | kolache | serving (2)
`);
L('Romania', 'Romanian', EUR, `
Mămăligă with cheese and sour cream | cornmeal:90 water:200 feta:40 sour_cream:30 | romanian polenta | plate
Ciorbă de perișoare | beef_mince:80 rice:20 carrots:30 potato:40 tomato:40 water:250 | meatball sour soup | bowl
Papanași | cottage:80 flour:30 egg:20 oil:15 sour_cream:20 jam:15 | romanian doughnuts | serving (2)
`);
L('Bulgaria', 'Bulgarian', EUR, `
Banitsa | phyllo:50 feta:40 egg:30 yogurt:20 butter:10 | cheese pastry | slice
Shopska salad | tomato:100 cucumber:80 red_pepper:40 feta:30 olive_oil:8 | shopska | bowl
Tarator | yogurt:150 cucumber:80 walnuts:10 dill:2 water:60 | cold cucumber soup | bowl
`);
L('Serbia', 'Serbian', EUR, `
Pljeskavica | beef_mince:100 pork_mince:50 onion:20 roll:60 | serbian burger | serving
Gibanica | phyllo:50 feta:40 egg:30 sour_cream:20 oil:10 | cheese pie | slice
Prebranac | kidney:200 onion:40 paprika:2 oil:15 | baked beans serbian | portion
`);
L('Croatia', 'Croatian', EUR, `
Pašticada | beef:160 prunes:15 tomato_paste:10 gnocchi:150 | dalmatian beef stew | plate
Štrukli | flour:50 cottage:60 egg:15 cream:20 | cheese dumplings | portion
Black risotto | rice_short:180 squid:100 olive_oil:10 onion:20 | crni rizot | plate
`);
L('Georgia', 'Georgian', AS, `
Lobio | kidney:200 onion:20 coriander:5 walnuts:10 | georgian bean stew | bowl
Pkhali | spinach:150 walnuts:25 garlic:3 | spinach walnut pate | portion
Chakapuli | lamb:150 green_beans:30 parsley:5 | lamb and tarragon stew | bowl
Badrijani nigvzit | eggplant:150 walnuts:30 oil:15 garlic:3 | eggplant walnut rolls | serving (3)
`);
L('Armenia', 'Armenian', AS, `
Ghapama | pumpkin:200 rice:60 dates:15 apricot_dried:15 butter:10 honey:10 | stuffed pumpkin | portion
Harissa (Armenian porridge) | bulgur:80 chicken_meat:80 butter:10 water:150 | wheat and chicken porridge | bowl
Gata | flour:40 butter:20 sugar:15 | armenian sweet bread | slice
`);
L('Azerbaijan', 'Azerbaijani', AS, `
Qutab | flour:60 spinach:40 lamb_mince:30 butter:8 | stuffed flatbread | serving (2)
Dushbara | flour:40 lamb_mince:40 stock:250 | dumpling soup | bowl
Shah plov | rice:150 lamb:80 apricot_dried:15 raisins:10 butter:15 flour_tortilla:30 | crown pilaf | plate
`);
L('Jamaica', 'Jamaican', NA, `
Callaloo and saltfish | spinach:120 salt_cod:70 onion:20 tomato:30 oil:8 | callaloo with saltfish | plate
Jamaican fried dumplings | flour:70 oil:15 water:30 | johnny cakes | serving (2)
Boiled dumplings and green banana | flour:60 water:30 green_plantain:150 | hard food | plate
Jamaican oxtail with rice and peas | oxtail:200 kidney:60 rice:180 coconut_milk:30 onion:20 | oxtail plate | plate
Jamaican fried chicken | chicken_fried:200 | jamaican fried chicken | portion
Jerk pork | pork_shoulder:180 chili:3 onion:15 | jerk pork | portion
Pepper pot soup | spinach:100 beef:60 yam:60 coconut_milk:40 water:200 | jamaican pepperpot | bowl
Red pea soup | kidney:120 beef:50 yam:50 flour:20 water:250 | jamaican red pea soup | bowl
Chicken foot soup | chicken_meat:60 pumpkin:60 yam:50 carrots:30 flour:20 water:250 | jamaican chicken soup | bowl
Mackerel rundown | mackerel:120 coconut_milk:80 onion:20 tomato:30 | run down | portion
Steamed fish with okra | fish:180 okra:60 carrots:30 onion:20 | jamaican steamed fish | portion
Curry shrimp (Jamaican) | shrimp:150 curry:5 coconut_milk:40 onion:20 oil:8 | jamaican curry shrimp | portion
Cabbage and saltfish | cabbage_cooked:150 salt_cod:60 onion:20 oil:8 | steamed cabbage saltfish | plate
Ackee and callaloo (vegan) | ackee:120 spinach:100 onion:20 oil:10 | vegan ackee | plate
Jamaican coco bread | flour:80 butter:15 coconut_milk:30 sugar:5 | coco bread | bread
Hardo bread toast | bread:70 butter:10 | hard dough bread toast | serving (2 slices)
Bulla cake | flour:60 molasses:25 brown_sugar:15 ginger:2 | bulla | piece
Gizzada | pie_crust:30 coconut_meat:30 brown_sugar:15 | pinch me round | tart
Grater cake | coconut_meat:40 sugar:30 | coconut drops | piece
Jamaican sweet potato pudding | sweet_potato:100 coconut_milk:50 brown_sugar:20 flour:10 raisins:10 | sweet potato pone | slice
Jamaican rum-free fruit cake | flour:30 raisins:25 prunes:15 brown_sugar:20 butter:15 egg:15 molasses:5 | black cake (alcohol-free) | slice
Cornmeal porridge (Jamaican) | cornmeal:50 coconut_milk:60 milk:120 condensed:20 cinnamon:1 | jamaican cornmeal porridge | bowl
Peanut porridge | peanuts:40 oats:20 milk:150 condensed:20 | jamaican peanut punch porridge | bowl
Hominy porridge | hominy:150 milk:120 condensed:20 cinnamon:1 | jamaican hominy corn porridge | bowl
Carrot juice (Jamaican) | carrots_raw:250 condensed:25 milk:50 | jamaican carrot juice | glass
Peanut punch (alcohol-free) | peanut_butter:30 milk:250 condensed:20 | jamaican peanut drink | glass
`);
L('Trinidad and Tobago', 'Trinidadian', NA, `
Pelau | rice:200 chicken_thigh:100 kidney:50 brown_sugar:5 coconut_milk:30 | trini pelau | plate
Buss up shut with curry chicken | flour:80 oil:15 chicken_thigh:120 curry:5 | paratha roti and curry | plate
Aloo pie | flour:50 potato:60 oil:15 | trini aloo pie | pie
Bake and saltfish | flour:70 oil:15 salt_cod:60 tomato:30 onion:15 | fry bake and saltfish | serving
Pholourie | chickpea_flour:20 flour:30 oil:15 | split pea fritters | serving (6)
Sweet bread (Trinidad) | flour:50 coconut_meat:20 sugar:15 butter:10 raisins:10 | coconut sweet bread | slice
`);
L('Barbados', 'Barbadian', NA, `
Pudding and souse | sweet_potato:150 pork_shoulder:80 cucumber:30 lime:5 | bajan pudding and souse | plate
Macaroni pie (Bajan) | pasta:150 cheddar:40 egg:20 milk:40 | bajan macaroni pie | slice
Fish cakes (Bajan) | salt_cod:40 flour:40 oil:15 onion:10 | bajan fishcakes | serving (4)
`);
L('Haiti', 'Haitian', NA, `
Diri ak djon djon | rice:200 mushrooms:30 kidney:40 oil:8 | black mushroom rice | plate
Pikliz with fried plantain | cabbage:60 carrots_raw:20 vinegar:10 plantain_fried:150 | pikliz and bannann peze | plate
Soup joumou | pumpkin:150 beef:60 potato:40 pasta:20 cabbage:30 water:200 | haitian squash soup | bowl
Legim | eggplant:100 cabbage:80 spinach:60 beef:60 oil:10 | haitian vegetable stew | bowl
`);
L('Dominican Republic', 'Dominican', NA, `
Mangú with los tres golpes | green_plantain:200 salami_alt:0 cheddar:40 egg_fried:50 onion:20 oil:8 | mangu breakfast | plate
Sancocho (Dominican) | chicken_thigh:80 pork_shoulder:40 yam:60 plantain:60 corn:40 water:250 | dominican stew | bowl
La bandera | rice:200 kidney:100 chicken_stewed:100 lettuce:20 | dominican flag plate | plate
Habichuelas con dulce | kidney:80 coconut_milk:80 sweet_potato:40 sugar:25 milk:60 | sweet cream of beans | bowl
`);
L('Cuba', 'Cuban', NA, `
Picadillo (Cuban) | beef_mince:120 tomato_canned:60 olives:10 raisins:10 onion:20 rice:180 | cuban picadillo | plate
Vaca frita | flank:130 onion:40 lime:10 oil:10 rice:150 | fried shredded beef | plate
Moros y cristianos | rice:180 black_beans:100 onion:15 oil:8 | black beans and rice cuban | plate
Cuban sandwich | baguette:90 pork_roast:60 ham_slice:30 swiss:25 pickles:15 mustard:5 | cubano | sandwich
Tostones | green_plantain:150 oil:15 | twice fried plantain | portion
`);
L('Puerto Rico', 'Puerto Rican', TE, `
Mofongo | green_plantain:200 pork_belly:30 garlic:5 oil:12 | plantain mash with pork | portion
Pastelón | ripe_plantain:150 beef_mince:80 cheddar:30 egg:15 | plantain lasagna | portion
Arroz con gandules | rice:200 kidney:60 pork_shoulder:30 olives:10 | rice with pigeon peas | plate
Tembleque | coconut_milk:100 sugar:20 cornstarch:12 cinnamon:1 | coconut pudding | portion
`);
L('Mexico', 'Mexican', NA, `
Chilaquiles | corn_tortilla:80 oil:15 salsa:80 egg_fried:50 sour_cream:20 cheddar:15 | chilaquiles | plate
Huevos rancheros | corn_tortilla:50 egg_fried:100 salsa:80 refried:60 | ranchero eggs | plate
Enchiladas verdes | corn_tortilla:90 chicken_meat:80 salsa:80 sour_cream:20 cheddar:20 | green enchiladas | serving (3)
Chiles rellenos | green_pepper:150 monterey:50 egg:30 flour:10 oil:15 tomato:60 | stuffed peppers mexican | serving (2)
Tamales de pollo | masa:100 chicken_meat:50 salsa:30 oil:10 | chicken tamales | serving (2)
Pozole rojo | hominy:150 pork_shoulder:90 chili_powder:3 cabbage:20 water:250 | red pozole | bowl
Sopa de fideo | pasta:50 tomato:80 onion:15 oil:8 stock:250 | mexican noodle soup | bowl
Molletes | baguette:80 refried:60 cheddar:30 salsa:20 | bean and cheese toast | serving (2)
Elote | corn:150 mayo:15 feta:15 chili_powder:1 lime:5 | mexican street corn | cob
Tostadas de tinga | taco_shell:30 chicken_meat:80 tomato:40 onion:20 sour_cream:15 | chicken tinga tostadas | serving (2)
Arroz con leche (Mexican) | rice:50 milk:180 sugar:18 cinnamon:1 condensed:15 | mexican rice pudding | bowl
Conchas | flour:50 sugar:15 butter:10 egg:10 | mexican sweet bread | bun
Agua de horchata | rice:30 milk:100 sugar:20 cinnamon:1 water:150 | horchata | glass
Agua de jamaica | roselle:10 sugar:25 water:250 | hibiscus agua fresca | glass
`);
L('Guatemala', 'Guatemalan', NA, `
Pepián | chicken_thigh:150 tomato:60 sesame:5 squash_alt:0 rice:150 | guatemalan stew | plate
Rellenitos | ripe_plantain:120 black_beans:40 sugar:10 oil:10 | sweet plantain stuffed with beans | serving (2)
Chuchitos | masa:80 chicken_meat:40 tomato:30 | guatemalan tamales | serving (2)
`);
L('Honduras', 'Honduran', NA, `
Baleada | flour_tortilla:70 refried:60 sour_cream:20 cheddar:20 | honduran baleada | piece
Plato típico | beef:100 rice:150 refried:60 plantain_fried:60 avocado:30 cheddar:20 | honduran typical plate | plate
Sopa de caracol | clams:100 coconut_milk:100 yam:50 green_plantain:50 water:150 | conch soup | bowl
`);
L('El Salvador', 'Salvadoran', NA, `
Pupusas de queso | masa:120 mozzarella:40 cabbage:40 | cheese pupusas | serving (2)
Pupusas revueltas | masa:120 pork_shoulder:30 refried:30 mozzarella:30 | mixed pupusas | serving (2)
Yuca frita con chicharrón | cassava:150 oil:15 pork_belly:40 cabbage:30 | fried yuca | plate
`);
L('Costa Rica', 'Costa Rican', NA, `
Gallo pinto | rice:150 black_beans:100 onion:15 oil:8 egg_fried:50 | costa rican rice and beans | plate
Casado | rice:150 black_beans:80 chicken_breast:100 plantain_fried:60 lettuce:30 tomato:30 | costa rican plate | plate
Olla de carne | beef:100 potato:60 yam:50 corn:40 carrots:30 water:250 | costa rican beef soup | bowl
`);
L('Panama', 'Panamanian', NA, `
Sancocho panameño | chicken_thigh:120 yam:100 corn:40 onion:20 water:250 | panama chicken soup | bowl
Carimañolas | cassava:100 beef_mince:40 oil:15 | yuca fritters | serving (2)
Arroz con pollo (Panama) | rice:200 chicken_thigh:100 peas:30 red_pepper:30 oil:8 | panama chicken rice | plate
`);
L('Nicaragua', 'Nicaraguan', NA, `
Vigorón | cassava:150 pork_belly:40 cabbage:60 tomato:20 vinegar:5 | yuca with pork crackling | plate
Nacatamal | masa:120 pork_shoulder:60 rice:20 potato:20 | nicaraguan tamale | tamal
Indio viejo | beef:100 cornmeal:40 tomato:40 onion:20 oil:8 | nicaraguan beef porridge | bowl
`);
L('Canada', 'Canadian', NA, `
Bannock | flour:70 butter:10 milk:30 | indigenous frybread | piece
Split pea soup (Québec) | split_peas:100 ham:40 carrots:30 onion:20 water:250 | soupe aux pois | bowl
Pouding chômeur | flour:35 sugar:15 butter:10 maple:30 milk:20 | poor man's pudding | portion
Beaver tail pastry | flour:60 oil:15 sugar:15 cinnamon:1 | fried dough pastry | piece
Maple glazed salmon | salmon:160 maple:15 soy:5 | maple salmon | portion
Montreal smoked meat sandwich | rye_bread:70 beef_brisket:110 mustard:8 | smoked meat on rye | sandwich
Ginger beef | flank:120 cornstarch:15 oil:15 sugar:12 ginger:5 rice:150 | calgary ginger beef | plate
Donair | pita:70 beef_mince:110 tomato:30 onion:15 condensed:20 | halifax donair | wrap
Saskatoon berry pie | pie_crust:50 blueberries:90 sugar:15 | saskatoon pie | slice
Bacon and maple pancakes | pancake:150 bacon:30 maple:25 | canadian breakfast pancakes | plate
Fish and brewis | salt_cod:80 bread:80 pork_belly:20 | newfoundland fish and brewis | plate
Tarte au sucre | pie_crust:45 brown_sugar:30 cream:20 | sugar pie | slice
`);
L('United States of America', 'American', NA, `
Biscuits and gravy | flour:60 butter:15 buttermilk:30 sausage:40 milk:80 | biscuits with sausage gravy | plate
Chicken and waffles | chicken_fried:150 waffle:100 maple:25 | chicken waffles | plate
Grits with butter | cornmeal:50 water:200 butter:10 | southern grits | bowl
Corned beef hash | beef_brisket:80 potato:120 onion:20 egg_fried:50 oil:8 | hash with egg | plate
Sloppy joe | beef_mince:110 ketchup:25 onion:15 burger_bun:60 | sloppy joe | sandwich
Philly cheesesteak | baguette:100 beef_sirloin:100 provolone:30 onion:30 green_pepper:20 oil:5 | cheesesteak | sandwich
Reuben sandwich | rye_bread:70 beef_brisket:80 sauerkraut:30 swiss:25 mayo:10 | reuben | sandwich
Patty melt | rye_bread:70 beef_patty:110 swiss:25 onion:30 butter:8 | patty melt | sandwich
Chicken pot pie (American) | chicken_meat:100 peas:30 carrots:30 pie_crust:60 milk:50 | pot pie | portion
Tuna noodle casserole | egg_noodles:150 tuna:70 peas:30 milk:60 cheddar:20 | tuna casserole | portion
Green bean casserole | green_beans:150 mushrooms:30 milk:40 onion:15 oil:8 | thanksgiving green beans | portion
Sweet potato casserole | sweet_potato:150 brown_sugar:15 butter:10 marshmallow:10 | sweet potato with marshmallows | portion
Cornbread | cornmeal:40 flour:20 milk:30 egg:12 butter:10 sugar:8 | southern cornbread | piece
Jambalaya | rice:200 chicken_thigh:70 sausage:50 shrimp:40 tomato_canned:60 | cajun jambalaya | plate
Gumbo | chicken_thigh:70 sausage:50 shrimp:40 okra:50 flour:10 oil:10 rice:150 | louisiana gumbo | bowl
Red beans and rice | kidney:150 sausage:50 rice:180 onion:20 celery:20 | new orleans red beans | plate
Shrimp and grits | shrimp:120 cornmeal:50 milk:100 cheddar:20 butter:10 bacon:10 | low country shrimp grits | bowl
Chicken and dumplings | chicken_meat:100 flour:50 milk:30 carrots:30 stock:200 | southern dumplings | bowl
Buffalo chicken wrap | flour_tortilla:70 chicken_fried:90 lettuce:20 blue_cheese:10 | buffalo wrap | wrap
Lobster roll | crab:100 mayo:15 roll:60 butter:8 celery_raw:10 | lobster roll | roll
Clam bake plate | clams:120 potato:100 corn:100 sausage:40 butter:10 | new england clambake | plate
Tex-Mex fajita bowl | flank:120 rice:150 red_pepper:40 onion:30 guacamole:30 salsa:30 | fajita bowl | bowl
Hawaiian loco moco | rice:200 beef_patty:110 egg_fried:50 gravy:60 | loco moco | plate
Spam musubi | rice_short:100 ham_slice:40 laver:2 soy:5 | musubi | piece
Navajo frybread taco | flour:70 oil:20 beef_mince:60 kidney:40 lettuce:20 cheddar:15 | indian taco | piece
Boston baked beans | baked_beans:200 molasses:10 bacon:10 | baked beans boston | portion
Whoopie pie | flour:35 cocoa_powder:5 sugar:20 butter:12 marshmallow:15 | whoopie pie | piece
S'mores | dark_choc:15 marshmallow:15 shortbread:20 | smores | serving
Funnel cake | flour:50 milk:40 egg:15 oil:20 icing_sugar:10 | funnel cake | piece
Rice Krispie-style treat | marshmallow:20 butter:5 granola:15 | marshmallow cereal bar | bar
Apple cider donut | flour:45 sugar:18 oil:15 apple:20 cinnamon:1 | cider doughnut | doughnut
Boston cream pie | sponge:60 milk:40 egg:10 sugar:10 dark_choc:15 | boston cream | slice
Peanut butter and banana sandwich | bread:70 peanut_butter:30 banana:60 | elvis sandwich | sandwich
Root beer float | root_beer:250 ice_cream:80 | root beer float | glass
`);
L('Brazil', 'Brazilian', SA, `
Pão de queijo | cassava:0 tapioca:40 mozzarella:30 milk:20 egg:10 oil:8 | cheese bread brazil | serving (4)
Arroz e feijão | rice:180 black_beans:120 onion:10 oil:8 | rice and beans brazil | plate
Prato feito | rice:150 black_beans:100 beef:100 egg_fried:50 lettuce:20 fries:60 | brazilian plate lunch | plate
Moqueca de camarão | shrimp:160 coconut_milk:80 palm_oil:10 tomato:50 red_pepper:30 | shrimp moqueca | bowl
Escondidinho | cassava_cooked:180 beef:80 mozzarella:30 butter:8 | cassava mash with beef | portion
Tapioca crepe with cheese | tapioca:50 mozzarella:30 | tapioca brasileira | piece
Coxinha | flour:50 chicken_meat:40 cream_cheese:10 breadcrumbs:10 oil:15 | chicken croquette | piece
Açaí bowl with banana | banana:100 strawberries:60 granola:40 honey:10 | acai na tigela style | bowl
Brigadeiro | condensed:30 cocoa_powder:4 butter:4 | brazilian fudge balls | serving (3)
Quindim | egg:40 sugar:25 coconut_meat:15 | coconut custard | piece
Bolo de cenoura | flour:35 carrots:30 sugar:25 oil:15 egg:15 dark_choc:10 | carrot cake with chocolate | slice
`);
L('Argentina', 'Argentine', SA, `
Milanesa napolitana | beef:150 breadcrumbs:20 egg:15 oil:15 marinara:40 mozzarella:30 ham_slice:15 | milanesa a la napolitana | portion
Choripán | sausage:100 baguette:80 parsley:3 olive_oil:5 | chorizo sandwich | sandwich
Locro | corn:100 kidney:50 pumpkin:80 pork_shoulder:50 chorizo:20 water:200 | argentine stew | bowl
Provoleta | provolone:100 oregano:1 olive_oil:5 | grilled provolone | portion
Alfajores | flour:30 cornstarch:15 butter:12 condensed:25 coconut_meat:4 | dulce de leche cookies | serving (2)
Medialunas | croissant:50 sugar:5 | argentine croissants | serving (1)
`);
L('Peru', 'Peruvian', SA, `
Ají de gallina | chicken_meat:120 bread:20 milk:60 walnuts:10 potato:100 rice:120 | creamy chicken peru | plate
Causa limeña | potato:180 chicken_meat:60 avocado:40 mayo:15 lime:5 | layered potato | portion
Papa a la huancaína | potato:200 feta:30 milk:40 egg_boiled:25 oil:10 | potatoes in cheese sauce | portion
Tacu tacu | rice:150 kidney:100 oil:12 egg_fried:50 | rice and bean cake | plate
Arroz chaufa | rice:220 chicken_breast:80 egg:30 soy:12 oil:10 | peruvian fried rice | plate
Picarones | sweet_potato:50 flour:40 oil:15 molasses:15 | peruvian doughnuts | serving (3)
Suspiro limeño | condensed:50 egg:20 meringue:8 | caramel meringue dessert | cup
Chicha morada (alcohol-free) | corn:30 pineapple:40 sugar:20 water:250 | purple corn drink | glass
`);
L('Colombia', 'Colombian', SA, `
Bandeja paisa | rice:150 kidney:100 beef_mince:70 pork_belly:40 egg_fried:50 plantain_fried:60 avocado:30 | paisa platter | plate
Ajiaco | chicken_breast:100 potato:150 corn:60 cream:20 avocado:30 | colombian chicken potato soup | bowl
Arepa with cheese | masa:90 mozzarella:30 butter:5 | arepa con queso | arepa
Changua | milk:200 egg_poached:50 bread:30 onion:5 | milk and egg soup | bowl
Pandebono | cassava:0 tapioca:30 cornmeal:15 feta:30 egg:10 | cheese bread colombia | serving (2)
Buñuelos | flour:20 cornstarch:10 feta:25 egg:10 oil:15 | colombian cheese fritters | serving (2)
`);
L('Venezuela', 'Venezuelan', SA, `
Arepa reina pepiada | masa:90 chicken_meat:60 avocado:40 mayo:10 | chicken avocado arepa | arepa
Pabellón criollo | rice:150 black_beans:100 flank:100 plantain_fried:60 | venezuelan national plate | plate
Cachapa | corn:120 flour:15 sugar:8 butter:8 mozzarella:40 | corn pancake with cheese | piece
Tequeños | flour:40 feta:40 oil:15 | cheese sticks venezuela | serving (4)
Hallaca | masa:100 beef:40 pork_shoulder:30 olives:10 raisins:8 | christmas tamal | piece
`);
L('Chile', 'Chilean', SA, `
Pastel de choclo | corn:180 beef_mince:80 chicken_meat:40 onion:30 egg_boiled:20 sugar:5 | corn pie | portion
Porotos granados | kidney:150 corn:60 pumpkin:80 onion:20 oil:8 | bean corn squash stew | bowl
Sopaipillas | flour:40 pumpkin:30 oil:15 | pumpkin fritters | serving (3)
Completo | sausage:60 roll:60 avocado:40 tomato:30 mayo:15 | chilean hot dog | hot dog
Leche asada | milk:120 egg:35 sugar:20 | baked milk custard | portion
`);
L('Ecuador', 'Ecuadorian', SA, `
Encebollado | tuna_steak:100 cassava_cooked:80 onion:40 tomato:20 lime:5 water:200 | fish and yuca soup | bowl
Llapingachos | potato:180 mozzarella:30 oil:12 egg_fried:50 | potato patties | plate
Bolón de verde | green_plantain:180 cheddar:30 butter:10 | green plantain ball | piece
`);
L('Bolivia', 'Bolivian', SA, `
Salteña | flour:60 butter:10 beef:40 potato:20 peas:10 | bolivian empanada | piece
Silpancho | beef:120 breadcrumbs:15 rice:150 potato:80 egg_fried:50 | bolivian breaded steak | plate
Sopa de maní | peanuts:30 beef:60 potato:60 pasta:20 water:250 | peanut soup | bowl
`);
L('Uruguay', 'Uruguayan', SA, `
Chivito | roll:80 beef_sirloin:100 ham_slice:20 mozzarella:25 egg_fried:50 lettuce:15 mayo:10 | uruguayan steak sandwich | sandwich
Torta frita | flour:60 oil:15 | fried dough uruguay | piece
Chajá | sponge:50 meringue:10 peach:40 cream:30 | meringue peach cake | slice
`);
L('Paraguay', 'Paraguayan', SA, `
Sopa paraguaya | cornmeal:50 cheddar:30 onion:20 milk:40 egg:15 oil:10 | paraguayan corn bread | slice
Chipa | tapioca:40 cheddar:20 egg:10 butter:8 | paraguayan cheese bread | serving (2)
Mbejú | tapioca:50 cheddar:30 milk:20 butter:8 | cassava starch cake | piece
`);
L('Guyana', 'Guyanese', SA, `
Pepperpot (Guyanese) | beef:150 molasses:5 cinnamon:1 chili:2 | guyana pepperpot | bowl
Cook-up rice | rice:200 kidney:60 coconut_milk:50 chicken_thigh:60 | guyanese cook up | plate
Metemgee | cassava_cooked:80 green_plantain:80 coconut_milk:80 salt_cod:40 flour:20 | mettagee | bowl
`);
L('Suriname', 'Surinamese', SA, `
Pom | taro:150 chicken_thigh:100 oj:10 onion:15 | surinamese casserole | portion
Bara | split_peas:30 flour:40 oil:15 | surinamese fritters | serving (2)
Moksi alesi | rice:200 salt_cod:50 kidney:50 oil:10 | mixed rice suriname | plate
`);
L('Australia', 'Australian', OC, `
Smashed avo with feta | bread:60 avocado:70 feta:20 lemon:3 | smashed avocado | serving
Sausage sizzle | sausage:80 bread:30 onion:20 ketchup:10 | snag in bread | serving
Chiko-style roll | flour:40 cabbage:30 beef_mince:20 barley:10 oil:15 | fried veg roll | roll
Fairy bread | bread:40 butter:8 sugar:8 | sprinkles bread | serving (2 slices)
Damper | flour:70 butter:10 milk:30 | bush bread | slice
Lamb roast dinner | lamb_leg:150 potato_roast:150 peas:50 pumpkin:60 gravy:50 | aussie roast lamb | plate
Prawn cocktail | shrimp:100 lettuce:30 mayo:15 ketchup:10 | prawn cocktail | glass
Vanilla slice | puff_pastry:30 milk:80 sugar:15 cornstarch:10 icing_sugar:10 | custard square | piece
Caramel slice | shortbread:20 condensed:25 butter:8 dark_choc:12 | millionaire slice aussie | piece
Weet-Bix-style cereal with milk | oats:35 milk:200 banana:50 | wheat biscuit breakfast | bowl
Milo drink | milk:250 cocoa_powder:10 sugar:10 | malted chocolate milk | glass
Iced coffee (Australian) | coffee:100 milk:150 ice_cream:40 | aussie iced coffee | glass
`);
L('New Zealand', 'New Zealander', OC, `
Hāngī | pork_shoulder:100 chicken_thigh:80 potato:100 sweet_potato:80 pumpkin:60 | earth oven feast | plate
Kiwi mince on toast | beef_mince:110 onion:20 gravy:40 bread:60 | savoury mince | plate
Whitebait fritter | fish:60 egg:50 flour:10 butter:10 | whitebait patty | fritter
Hokey pokey ice cream | ice_cream:120 sugar:10 | honeycomb ice cream | scoop (2)
Afghan biscuits | flour:25 butter:18 sugar:12 cocoa_powder:5 granola:10 | chocolate cornflake biscuit | serving (2)
Pineapple lumps-style chocolate | dark_choc:20 sugar:15 pineapple:10 | chocolate pineapple chew | serving
`);
L('Fiji', 'Fijian', OC, `
Kokoda | fish:120 coconut_milk:60 lime:15 tomato:30 onion:15 | fijian ceviche | bowl
Rourou | spinach:150 coconut_milk:60 onion:15 | taro leaves in coconut | portion
Fijian curry with roti | chicken_thigh:120 curry:5 potato:60 flour:60 oil:10 | fiji indian curry | plate
`);
L('Samoa', 'Samoan', OC, `
Palusami | spinach:120 coconut_milk:80 onion:15 | taro leaves coconut cream | portion
Oka | tuna_raw:120 coconut_milk:50 lime:10 cucumber:30 | samoan raw fish | bowl
Panipopo | flour:50 sugar:15 butter:10 coconut_milk:50 | coconut buns | bun
`);
L('Tonga', 'Tongan', OC, `
Lu pulu | beef:100 spinach:100 coconut_milk:60 onion:15 | corned beef in taro leaves | portion
Ota ika | fish:120 coconut_milk:60 lime:10 tomato:30 | tongan raw fish | bowl
`);
L('Papua New Guinea', 'Papua New Guinean', OC, `
Mumu | pork_shoulder:100 sweet_potato:120 taro:80 spinach:50 | earth oven pork | plate
Sago with coconut | tapioca:60 coconut_milk:60 sugar:10 | sago pudding png | bowl
Kaukau with greens | sweet_potato:200 spinach:80 coconut_milk:40 | sweet potato and greens | plate
`);
L('Solomon Islands', 'Solomon Islander', OC, `
Poi (Solomon Islands) | taro:200 coconut_milk:40 | pounded taro | portion
Fish in coconut milk | fish:150 coconut_milk:80 onion:15 | solomon fish coconut | bowl
`);
L('Vanuatu', 'Ni-Vanuatu', OC, `
Lap lap | yam:150 coconut_milk:60 chicken_thigh:60 | vanuatu pudding | portion
Tuluk | cassava_cooked:120 pork_mince:50 coconut_milk:30 | cassava pork parcel | piece
`);
L('Kiribati', 'I-Kiribati', OC, `
Te bua toro | breadfruit:150 coconut_milk:40 | breadfruit in coconut | portion
Kiribati raw tuna | tuna_raw:120 coconut_milk:40 lime:10 | ika mata | bowl
`);
L('Marshall Islands', 'Marshallese', OC, `
Bwiro with fish | breadfruit:150 fish:100 coconut_milk:30 | breadfruit paste with fish | plate
Coconut crab with rice | crab:120 rice:150 coconut_milk:30 | marshallese crab | plate
`);
L('Federated States of Micronesia', 'Micronesian', OC, `
Pounded taro with coconut | taro:180 coconut_milk:40 | micronesian taro | portion
Grilled reef fish with breadfruit | fish:160 breadfruit:120 | fish and breadfruit | plate
`);
L('Palau', 'Palauan', OC, `
Ulkoy | taro:100 flour:20 fish:40 oil:15 | palauan taro fritters | serving (3)
Palauan fish soup | fish:120 onion:20 ginger:3 water:250 | fish broth palau | bowl
`);
L('Nauru', 'Nauruan', OC, `
Coconut fish (Nauru) | fish:150 coconut_milk:60 lime:8 | nauru coconut fish | portion
Nauruan fried rice | rice:200 egg:30 ham_slice:30 soy:8 oil:10 | island fried rice | plate
`);
L('Tuvalu', 'Tuvaluan', OC, `
Pulaka with coconut | taro:180 coconut_milk:40 | swamp taro | portion
Tuvalu tuna with rice | tuna_steak:120 rice:180 coconut_milk:20 | fresh tuna and rice | plate
`);
L('Cook Islands', 'Cook Islander', TE, `
Ika mata (Cook Islands) | fish:120 coconut_milk:60 lime:10 cucumber:30 tomato:20 | cook islands raw fish | bowl
Poke (banana pudding) | banana:120 tapioca:20 coconut_milk:40 | banana arrowroot pudding | portion
`);
L('Niue', 'Niuean', TE, `
Takihi | taro:120 papaya:80 coconut_milk:40 | niue taro papaya bake | portion
Niue coconut crab | crab:150 coconut_milk:30 | uga | portion
`);
L('French Polynesia', 'Tahitian', TE, `
Poisson cru | tuna_raw:120 coconut_milk:60 lime:10 cucumber:30 tomato:20 | tahitian raw fish | bowl
Po'e | banana:120 tapioca:20 coconut_milk:40 sugar:10 | tahitian fruit pudding | portion
`);
L('Guam', 'Chamorro', TE, `
Chicken kelaguen | chicken_meat:120 lemon:15 coconut_meat:15 onion:15 chili:2 | kelaguen | portion
Red rice (Guam) | rice:200 oil:8 | hineksa agaga | plate
Kadon pika | chicken_thigh:150 coconut_milk:50 soy:10 onion:20 | spicy chicken stew guam | bowl
`);
L('New Caledonia', 'New Caledonian', TE, `
Bougna | yam:120 sweet_potato:80 chicken_thigh:100 coconut_milk:60 | kanak bougna | portion
Salade tahitienne (New Caledonia) | tuna_raw:100 coconut_milk:50 lime:10 cucumber:30 | raw tuna salad | bowl
`);
L('Greenland', 'Greenlandic', TE, `
Suaasat | lamb:120 rice:40 onion:20 water:250 | greenland soup | bowl
Greenland shrimp sandwich | rye_bread:50 shrimp:60 mayo:10 butter:5 | prawn open sandwich | piece
`);
// ---- two or three more for every remaining country ----
const X = (country, demonym, region, text) => L(country, demonym, region, text);
X('Albania', 'Albanian', EUR, `
Fërgesë | red_pepper:100 tomato:80 cottage:60 butter:10 | peppers with cottage cheese | portion
Tavë kosi | lamb:120 yogurt:120 egg:30 rice:20 butter:10 | baked lamb with yogurt | portion
Byrek me spinaq | phyllo:50 spinach:80 feta:30 olive_oil:10 | spinach burek | slice
`);
X('Andorra', 'Andorran', EUR, `
Trinxat | potato:150 cabbage_cooked:100 bacon:20 olive_oil:8 | cabbage potato cake | portion
Escudella | beef:60 chicken_meat:50 chickpeas:40 pasta:30 potato:40 water:250 | andorran stew | bowl
`);
X('Antigua and Barbuda', 'Antiguan', NA, `
Fungee and pepperpot | cornmeal:80 okra:40 spinach:80 beef:60 pumpkin:40 | fungi pepperpot | plate
Ducana | sweet_potato:120 coconut_meat:30 flour:20 sugar:10 | sweet potato dumpling | piece
Saltfish and chop-up | salt_cod:60 eggplant:80 spinach:60 okra:30 oil:8 | antigua breakfast | plate
`);
X('Aruba', 'Aruban', TE, `
Keshi yena | cheddar:60 chicken_meat:80 olives:10 raisins:8 tomato:30 | stuffed cheese | portion
Pan bati | cornmeal:40 flour:30 milk:40 sugar:5 oil:5 | aruban pancake | piece
`);
X('Bahrain', 'Bahraini', AS, `
Muhammar | rice:200 dates:20 sugar:10 butter:10 cardamom:1 | sweet rice bahrain | plate
Gabout | flour:60 lamb:80 tomato:40 onion:20 | stuffed dumplings stew | bowl
`);
X('Belarus', 'Belarusian', EUR, `
Draniki | potato:150 egg:20 flour:10 oil:20 sour_cream:20 | potato pancakes belarus | serving (3)
Machanka with pancakes | pork_shoulder:80 sausage:40 sour_cream:30 flour:40 milk:60 | meat gravy with blini | plate
Kalduny | potato:80 pork_mince:50 flour:20 | potato dumplings with meat | serving (3)
`);
X('Belize', 'Belizean', NA, `
Belizean stew chicken with rice and beans | chicken_stewed:150 rice:180 kidney:60 coconut_milk:30 | rice and beans belize | plate
Fry jacks | flour:60 oil:15 | belizean fried dough | serving (2)
Hudut | fish:150 coconut_milk:100 green_plantain:150 | garifuna fish and plantain | bowl
`);
X('Bermuda', 'Bermudian', TE, `
Bermuda fish chowder | fish:120 tomato:60 potato:50 onion:20 water:200 | fish chowder | bowl
Codfish and potatoes | salt_cod:100 potato:150 banana:60 avocado:40 egg_boiled:25 | bermuda sunday breakfast | plate
`);
X('Bhutan', 'Bhutanese', AS, `
Kewa datshi | potato:150 cheddar:40 chili:5 butter:8 | potato and cheese | portion
Shamu datshi | mushrooms:150 cheddar:40 chili:5 butter:8 | mushroom cheese | portion
Red rice (Bhutanese) | brown_rice:200 | bhutan red rice | portion
`);
X('Bosnia and Herzegovina', 'Bosnian', EUR, `
Burek (Bosnian) | phyllo:60 beef_mince:60 onion:20 oil:10 | bosnian meat pie | slice
Begova čorba | chicken_meat:80 carrots:30 celery:20 okra:20 sour_cream:20 water:250 | bey's soup | bowl
Klepe | flour:50 beef_mince:50 yogurt:40 butter:8 | bosnian dumplings | serving
`);
X('Brunei', 'Bruneian', AS, `
Ambuyat | tapioca:80 water:200 | sago starch dish | portion
Nasi katok | rice:180 chicken_fried:100 chili:5 | brunei rice and chicken | plate
`);
X('Burkina Faso', 'Burkinabè', AF, `
Zoom-koom | millet:40 water:200 sugar:15 ginger:3 | millet ginger drink | glass
Benga | cowpeas:200 oil:10 onion:20 | burkina beans | bowl
`);
X('Burundi', 'Burundian', AF, `
Bugali with beans | cassava_cooked:200 kidney:120 palm_oil:8 | ubugali | plate
Burundian brochettes | goat:150 onion:20 green_plantain:100 | brochettes with plantain | plate
`);
X('Cabo Verde', 'Cape Verdean', AF, `
Cachupa refogada | corn:120 kidney:60 egg_fried:50 sausage:30 oil:8 | fried cachupa breakfast | plate
Xerém | cornmeal:80 fish:80 water:150 | cape verde corn porridge | bowl
`);
X('Central African Republic', 'Central African', AF, `
Ngukassa | cassava_cooked:150 peanuts:20 | cassava with peanuts | portion
Koko leaf stew | spinach:150 peanut_butter:25 fish:50 | koko leaves car | bowl
`);
X('Chad', 'Chadian', AF, `
Kissar with stew | sorghum:70 water:60 beef:60 okra:40 | chadian flatbread | plate
Bouillie | millet:50 milk:100 sugar:12 water:100 | chadian millet porridge | bowl
`);
X('Comoros', 'Comorian', AF, `
Ntrovi ya nazi | green_plantain:180 coconut_milk:60 fish:60 | plantain in coconut milk | bowl
Ladu | rice_flour:40 sugar:15 | comorian rice sweet | serving (2)
`);
X('Curaçao', 'Curaçaoan', TE, `
Stoba (Curaçao) | goat:150 tomato:40 onion:20 potato:60 | curacao stew | bowl
Funchi | cornmeal:80 water:180 butter:8 | curacao polenta | portion
`);
X('Cyprus', 'Cypriot', EUR, `
Halloumi with watermelon | halloumi:60 watermelon:200 mint:2 | summer halloumi | plate
Koupepia | grape_alt:0 rice:60 beef_mince:60 tomato:40 | cypriot stuffed vine leaves | serving (5)
Kolokasi | taro:200 pork_shoulder:80 tomato:60 celery:20 | taro stew | bowl
`);
X('Democratic Republic of the Congo', 'Congolese (DRC)', AF, `
Madesu | kidney:200 palm_oil:12 onion:20 tomato:30 | congolese beans | bowl
Ntaba | goat:150 onion:20 chili:2 | grilled goat | portion
Lituma | ripe_plantain:200 peanuts:15 | mashed plantain balls | portion
`);
X('Djibouti', 'Djiboutian', AF, `
Banana fritters (Djibouti) | banana:100 flour:30 oil:15 sugar:5 | djibouti banana fritters | serving (3)
Cambaabur | flour:60 water:60 sugar:5 | djiboutian pancakes | serving (2)
`);
X('Dominica', 'Dominican (Dominica)', NA, `
Callaloo soup (Dominica) | spinach:120 okra:40 coconut_milk:60 crab:40 water:150 | dominica callaloo | bowl
Bakes and saltfish (Dominica) | flour:70 oil:15 salt_cod:60 onion:15 | dominica bakes | serving
`);
X('Equatorial Guinea', 'Equatoguinean', AF, `
Fish with cassava leaves | fish:150 spinach:100 palm_oil:12 | equatorial guinea fish stew | bowl
Plantain fufu with peanut soup | plantain:200 peanut_butter:30 chicken_thigh:80 | plantain fufu | plate
`);
X('Eritrea', 'Eritrean', AF, `
Tsebhi dorho | chicken_leg:150 egg_boiled:50 onion:50 butter:15 chili_powder:3 | eritrean chicken stew | bowl
Hilbet | fava:60 lentils:40 oil:10 garlic:3 | lentil fava paste | portion
Ga'at | flour:80 butter:15 chili_powder:2 yogurt:40 | eritrean porridge | bowl
`);
X('Estonia', 'Estonian', EUR, `
Mulgipuder | potato:150 barley:60 pork_belly:30 onion:20 | potato barley porridge | bowl
Kama with kefir | oats:20 barley:15 kefir:200 sugar:8 | kama drink | glass
Kiluvõileib | rye_bread:50 butter:5 sardine:30 egg_boiled:25 | sprat sandwich | piece
`);
X('Eswatini', 'Swazi', AF, `
Sidvudvu | pumpkin:150 cornmeal:50 butter:8 | pumpkin porridge | bowl
Tinkhobe | corn:200 salt:1 | boiled corn kernels | portion
`);
X('Gabon', 'Gabonese', AF, `
Poulet au nyembwe with rice | chicken_thigh:150 palm_oil:20 rice:180 | gabon chicken with rice | plate
Odika fish | fish:150 peanut_butter:20 onion:20 | wild mango sauce fish | portion
`);
X('Grenada', 'Grenadian', NA, `
Oil down | breadfruit:150 salt_cod:40 chicken_thigh:60 spinach:40 coconut_milk:100 | grenada national dish | bowl
Grenadian nutmeg ice cream | ice_cream:120 sugar:5 | nutmeg ice cream | scoop (2)
`);
X('Guadeloupe', 'Guadeloupean', TE, `
Colombo de cabri | goat:160 curry:5 potato:60 rice:180 | goat colombo | plate
Blanc-manger coco | coconut_milk:100 milk:40 sugar:20 gelatine:2 | coconut panna cotta | portion
`);
X('Guinea', 'Guinean', AF, `
Kansiyé | peanut_butter:40 chicken_thigh:120 tomato:40 rice:180 | guinea peanut chicken | plate
Fouti | rice:180 okra:60 eggplant:40 palm_oil:12 | guinean okra rice | plate
`);
X('Guinea-Bissau', 'Bissau-Guinean', AF, `
Caldo de mancarra | peanut_butter:40 chicken_thigh:120 rice:180 | bissau peanut stew | plate
Jollof de peixe | rice:220 fish:100 tomato_paste:20 oil:15 | bissau fish rice | plate
`);
X('Holy See (Vatican City)', 'Vatican', EUR, `
Saltimbocca alla romana | veal:130 ham_slice:20 butter:10 | roman veal | portion
Supplì | rice_short:100 mozzarella:20 tomato_canned:30 breadcrumbs:15 oil:15 | roman rice croquettes | serving (2)
`);
X('Iceland', 'Icelandic', EUR, `
Plokkfiskur | haddock:150 potato:120 milk:60 butter:10 onion:20 | icelandic fish stew | plate
Kjötsúpa | lamb:120 potato:60 carrots:40 cabbage:30 water:250 | icelandic lamb soup | bowl
Skyr with berries | greek_yogurt:170 blueberries:50 sugar:5 | skyr bowl | bowl
Kleinur | flour:40 sugar:10 butter:5 oil:12 | icelandic twisted doughnut | serving (2)
`);
X('Jordan', 'Jordanian', AS, `
Galayet bandora | tomato:200 olive_oil:15 onion:20 chili:2 | tomato stew jordan | portion
Maqluba | rice:180 chicken_thigh:100 eggplant:80 cauliflower:60 oil:15 | upside down rice | plate
Knafeh | phyllo:40 mozzarella:40 sugar:20 butter:12 pistachio:5 | jordanian kunafa | portion
`);
X('Kosovo', 'Kosovar', EUR, `
Flija | flour:60 cream:30 butter:15 yogurt:30 | layered crepe pie | slice
Pite me mish | phyllo:60 beef_mince:60 onion:20 oil:10 | meat pie kosovo | slice
`);
X('Kuwait', 'Kuwaiti', AS, `
Murabyan | rice:200 shrimp:120 onion:30 oil:12 | kuwaiti shrimp rice | plate
Balaleet | pasta:100 sugar:20 egg:50 butter:10 saffron:0.1 | sweet vermicelli with omelette | plate
`);
X('Kyrgyzstan', 'Kyrgyz', AS, `
Ashlan-fu | rice_noodles:150 egg:30 vinegar:15 starch_alt:0 chili:2 | cold noodle soup | bowl
Kuurdak | lamb:150 potato:100 onion:30 oil:10 | kyrgyz fried meat | plate
Boorsok | flour:60 oil:15 milk:20 | kyrgyz fried bread | serving (4)
`);
X('Latvia', 'Latvian', EUR, `
Pelēkie zirņi ar speķi | split_peas:150 bacon:30 onion:20 | grey peas with bacon | portion
Rupjmaize kārtojums | rye_bread:40 whipped:40 jam:15 | rye bread dessert | cup
Sklandrausis | rye_bread:30 potato:40 carrots:40 sugar:10 butter:8 | latvian carrot pie | piece
`);
X('Lesotho', 'Basotho', AF, `
Papa le moroho | cornmeal:110 water:220 spinach:120 onion:15 | pap and greens lesotho | plate
Likhobe | sorghum:60 kidney:60 water:150 | lesotho beans and sorghum | bowl
`);
X('Liberia', 'Liberian', AF, `
Liberian pepper soup | goat:120 chili:5 onion:20 water:250 | pepper soup liberia | bowl
Potato greens with rice | sweet_potato:0 spinach:150 palm_oil:20 fish:50 rice:180 | liberian potato greens | plate
Liberian rice bread | rice_flour:40 banana:40 sugar:15 oil:10 | rice bread | slice
`);
X('Liechtenstein', 'Liechtensteiner', EUR, `
Käsknöpfle | flour:80 egg:40 swiss:50 onion:30 butter:10 | cheese dumplings liechtenstein | plate
Ribel | cornmeal:80 milk:150 butter:12 | liechtenstein cornmeal | bowl
`);
X('Lithuania', 'Lithuanian', EUR, `
Cepelinai | potato:200 pork_mince:50 sour_cream:30 bacon:10 | potato zeppelins | serving (2)
Šaltibarščiai | beets:100 kefir:200 cucumber:40 egg_boiled:25 dill:2 | cold beet soup | bowl
Kugelis | potato:200 bacon:20 egg:20 milk:30 onion:20 | potato pudding | slice
`);
X('Luxembourg', 'Luxembourgish', EUR, `
Judd mat Gaardebounen | pork_shoulder:150 fava:150 potato:100 | smoked pork with broad beans | plate
Bouneschlupp | green_beans:120 potato:80 bacon:20 sausage:30 water:200 | green bean soup | bowl
Gromperekichelcher | potato:150 onion:20 egg:15 flour:10 oil:20 | potato fritters lux | serving (3)
`);
X('Macau', 'Macanese', TE, `
Minchi | beef_mince:80 pork_mince:40 potato:60 soy:10 rice:180 egg_fried:50 | macanese minced meat | plate
Pork chop bun | pork_loin:100 roll:70 | zhu pa bao | sandwich
Serradura | cream:60 condensed:30 shortbread:20 | sawdust pudding | cup
`);
X('Malawi', 'Malawian', AF, `
Nsima with chambo | cornmeal:110 water:220 fish:150 tomato:40 | nsima and chambo | plate
Kondowole | cassava_cooked:250 | cassava nsima | portion
Mandasi (Malawi) | flour:60 sugar:10 oil:15 milk:20 | malawi doughnuts | serving (2)
`);
X('Maldives', 'Maldivian', AS, `
Garudhiya with rice | tuna_steak:120 water:300 rice:180 lime:5 | fish broth maldives | plate
Mas huni | tuna:80 coconut_meat:40 onion:15 lime:5 | tuna coconut salad | portion
Bis keemiya | flour:40 cabbage:40 egg_boiled:20 tuna:20 oil:15 | maldivian samosa | serving (2)
`);
X('Malta', 'Maltese', EUR, `
Ftira | bread:80 tuna:50 tomato:40 olives:10 capers:3 olive_oil:8 | maltese sandwich | sandwich
Timpana | pasta:120 beef_mince:60 marinara:50 egg:15 puff_pastry:40 | baked macaroni pie | slice
Imqaret | semolina:40 dates:30 oil:15 | date pastries | serving (2)
`);
X('Martinique', 'Martinican', TE, `
Chiquetaille de morue | salt_cod:80 onion:20 lime:10 olive_oil:10 | salt cod salad | portion
Féroce d'avocat | avocado:100 salt_cod:40 cassava:0 flour:20 chili:2 | avocado and cod | portion
`);
X('Mauritania', 'Mauritanian', AF, `
Mahfe | rice:200 lamb:100 onion:30 oil:12 | mauritanian meat rice | plate
Couscous with dates (Mauritania) | couscous:150 dates:30 milk:80 | sweet couscous dates | bowl
`);
X('Mauritius', 'Mauritian', AF, `
Dholl puri with curry | flour:70 split_peas:30 oil:10 kidney:80 tomato:30 | dholl puri | serving (2)
Gateau piment | split_peas:60 oil:15 chili:3 | chili cakes | serving (5)
Mine frit | egg_noodles:180 chicken_breast:60 cabbage:40 soy:10 oil:12 | mauritian fried noodles | plate
Rougaille (Mauritian) | sausage:100 tomato:120 onion:30 rice:180 | mauritian rougaille | plate
`);
X('Moldova', 'Moldovan', EUR, `
Plăcintă with cheese | flour:60 cottage:60 egg:15 oil:10 | moldovan pie | piece
Zeamă | chicken_meat:80 pasta:40 carrots:30 onion:20 water:250 | sour chicken soup | bowl
Sarmale (Moldovan) | cabbage_cooked:120 pork_mince:60 rice:40 sour_cream:20 | moldovan cabbage rolls | serving (3)
`);
X('Monaco', 'Monégasque', EUR, `
Barbagiuan | flour:40 spinach:40 ricotta:30 oil:12 | monaco fritters | serving (3)
Socca | chickpea_flour:60 olive_oil:12 water:80 | chickpea pancake | portion
Fougasse monégasque | flour:50 sugar:10 butter:10 almonds:5 | sweet monaco bread | slice
`);
X('Montenegro', 'Montenegrin', EUR, `
Kačamak | cornmeal:60 potato:60 feta:30 butter:12 | cornmeal potato mash | bowl
Njeguški steak | pork_loin:150 ham_slice:20 cheddar:20 | stuffed steak | portion
`);
X('Mozambique', 'Mozambican', AF, `
Matapa | spinach:150 peanuts:30 coconut_milk:60 shrimp:30 | cassava leaf peanut stew | bowl
Frango à zambeziana | chicken_thigh:180 coconut_milk:60 lime:10 | zambezi chicken | portion
Xima with fish | cornmeal:110 water:220 fish:120 tomato:40 | mozambique xima | plate
`);
X('Namibia', 'Namibian', AF, `
Kapana | beef:150 chili:2 onion:20 | street grilled beef | portion
Oshifima with spinach | millet:200 spinach:100 oil:8 | mahangu porridge | plate
Potjiekos | beef:120 potato:80 carrots:40 pumpkin:40 onion:20 | pot stew namibia | bowl
`);
X('Niger', 'Nigerien', AF, `
Dambou | couscous:180 spinach:60 peanuts:20 oil:8 | moringa couscous | plate
Kilishi | beef:40 peanuts:10 chili_powder:2 | spiced dried beef | portion (40 g)
Fura | millet:60 yogurt:150 sugar:10 | millet with sour milk | bowl
`);
X('North Korea', 'North Korean', AS, `
Pyongyang naengmyeon | soba:180 beef:50 egg_boiled:25 cucumber:30 stock:250 | cold buckwheat noodles | bowl
Injogogi bap | tofu:100 rice:150 chili_powder:3 soy:10 | tofu rice | plate
Onban | rice:200 chicken_meat:60 mushrooms:30 stock:250 | warm rice soup | bowl
`);
X('North Macedonia', 'Macedonian', EUR, `
Tavče gravče | kidney:200 onion:40 paprika:2 oil:15 | baked beans macedonia | portion
Pastrmajlija | flour:80 pork_loin:60 egg:25 butter:10 | macedonian meat pie | slice
Ajvar on bread | bread:50 red_pepper:60 eggplant:30 oil:10 | ajvar toast | serving
`);
X('Oman', 'Omani', AS, `
Shuwa | lamb:180 garlic:3 cumin:1 rice:150 | slow cooked lamb | plate
Omani halwa | sugar:40 cornstarch:15 ghee:15 almonds:5 cardamom:1 | omani sweet | portion
Mashuai | fish:150 lemon:8 rice:180 | grilled kingfish with rice | plate
`);
X('Palestine', 'Palestinian', AS, `
Musakhan | chicken_leg:180 onion:60 olive_oil:20 flour_tortilla:70 | sumac chicken flatbread | serving
Maftoul | couscous:150 chicken_meat:80 chickpeas:50 onion:20 | palestinian couscous | plate
Ka'ak | flour:70 sesame:8 | jerusalem sesame bread | ring
`);
X('Qatar', 'Qatari', AS, `
Harees | bulgur:100 chicken_meat:80 butter:10 water:150 | wheat porridge | bowl
Thareed | bread:60 lamb:80 potato:50 zucchini:40 tomato:40 water:200 | bread and meat stew | bowl
`);
X('Republic of the Congo', 'Congolese', AF, `
Liboke de poisson | fish:160 tomato:40 onion:20 chili:2 | fish steamed in leaves | portion
Mbika | melon_seed:60 fish:30 | pumpkin seed paste | portion
`);
X('Réunion', 'Réunionese', TE, `
Rougail morue | salt_cod:80 tomato:100 onion:30 rice:180 | salt cod rougail | plate
Bonbons piment | split_peas:60 oil:15 chili:3 | reunion chili fritters | serving (5)
`);
X('Saint Kitts and Nevis', 'Kittitian', NA, `
Stewed saltfish with dumplings | salt_cod:80 tomato:40 onion:20 flour:60 | kittitian stewed saltfish | plate
Goat water | goat:120 tomato:40 flour:10 water:250 | kittitian goat stew | bowl
`);
X('Saint Lucia', 'Saint Lucian', NA, `
Green fig and saltfish | green_plantain:180 salt_cod:70 onion:20 oil:8 | st lucia national dish | plate
Bouyon | kidney:60 beef:60 yam:60 flour:20 water:250 | st lucian soup | bowl
`);
X('Saint Vincent and the Grenadines', 'Vincentian', NA, `
Roasted breadfruit and jackfish | breadfruit:180 fish:120 oil:8 | vincy national dish | plate
Vincy callaloo soup | spinach:120 coconut_milk:50 okra:30 water:150 | callaloo soup svg | bowl
`);
X('San Marino', 'Sammarinese', EUR, `
Torta Tre Monti | shortbread:40 dark_choc:20 hazelnut:8 | three towers cake | slice
Piadina with ham and cheese | flour:70 olive_oil:8 ham_slice:30 mozzarella:30 | piadina | piece
`);
X('Seychelles', 'Seychellois', AF, `
Kari koko | fish:150 coconut_milk:80 curry:4 rice:180 | seychelles coconut curry | plate
Ladob | banana:120 coconut_milk:80 sugar:15 | banana in coconut milk | bowl
`);
X('Sierra Leone', 'Sierra Leonean', AF, `
Cassava leaf stew | spinach:150 palm_oil:20 fish:60 peanut_butter:15 | sierra leone cassava leaves | bowl
Groundnut soup with rice (Sierra Leone) | peanut_butter:40 chicken_thigh:100 rice:180 | peanut soup salone | plate
Kanya | peanuts:30 rice_flour:20 sugar:15 | peanut rice bar | piece
`);
X('Slovakia', 'Slovak', EUR, `
Bryndzové halušky | potato:150 flour:50 feta:50 bacon:15 | potato dumplings with sheep cheese | plate
Kapustnica | sauerkraut:120 sausage:50 mushrooms:20 water:250 | sauerkraut soup slovakia | bowl
Lokše | potato:80 flour:30 butter:8 | potato flatbread | piece
`);
X('Slovenia', 'Slovenian', EUR, `
Kranjska klobasa with sauerkraut | sausage:120 sauerkraut:100 mustard:5 | carniolan sausage | plate
Potica | flour:35 walnuts:20 sugar:15 butter:10 milk:15 | walnut roll | slice
Jota | sauerkraut:80 kidney:80 potato:60 water:250 | bean sauerkraut stew | bowl
`);
X('South Sudan', 'South Sudanese', AF, `
Kisra with okra (South Sudan) | sorghum:80 okra:80 beef:60 oil:8 | south sudan kisra | plate
Kajaik | fish:150 peanut_butter:20 onion:20 | dried fish stew | bowl
`);
X('Syria', 'Syrian', AS, `
Muhammara | red_pepper:120 walnuts:30 breadcrumbs:10 olive_oil:15 | red pepper walnut dip | portion
Fattet hummus | chickpeas:150 pita:40 yogurt:80 tahini:15 | syrian fatteh | bowl
Kibbeh labaniyeh | bulgur:50 beef_mince:60 yogurt:150 | kibbeh in yogurt | bowl
`);
X('São Tomé and Príncipe', 'Santomean', AF, `
Calulu (São Tomé) | fish:150 okra:60 eggplant:60 palm_oil:15 | sao tome calulu | bowl
Banana pão | ripe_plantain:150 flour:20 sugar:10 | banana bread sao tome | slice
`);
X('Tajikistan', 'Tajik', AS, `
Qurutob | flour_tortilla:70 yogurt:120 onion:30 tomato:40 oil:10 | bread with yogurt sauce | plate
Oshi palov | rice:180 lamb:90 carrots:60 oil:15 | tajik plov | plate
Sambusa (Tajik) | flour:50 lamb_mince:50 onion:20 oil:15 | tajik samsa | serving (2)
`);
X('The Bahamas', 'Bahamian', NA, `
Cracked conch with fries | clams:120 flour:20 oil:15 fries:120 | cracked conch | plate
Bahamian peas and rice | rice:200 kidney:60 bacon:15 tomato:30 | pigeon peas and rice | plate
Johnnycake (Bahamian) | flour:60 butter:10 milk:30 sugar:8 | bahamian johnny cake | slice
Guava duff | flour:50 guava:60 butter:10 sugar:15 | guava roll pudding | slice
`);
X('The Gambia', 'Gambian', AF, `
Yassa (Gambian) | chicken_leg:180 onion:80 lemon:15 oil:12 rice:180 | gambian yassa | plate
Mbahal | rice:200 peanuts:30 fish:60 oil:8 | peanut rice gambia | plate
`);
X('Timor-Leste', 'Timorese', AS, `
Ikan pepes | fish:150 chili:3 lemongrass:3 | fish in banana leaf | portion
Batar da'an | corn:120 pumpkin:100 kidney:60 | corn pumpkin stew | bowl
`);
X('Togo', 'Togolese', AF, `
Fufu with gboma dessi | yam:250 spinach:100 palm_oil:15 fish:60 | togo fufu and greens | plate
Ablo | cornmeal:60 rice_flour:20 sugar:8 | steamed corn cakes | serving (3)
Koklo meme | chicken_leg:180 chili:3 tomato:30 | togolese grilled chicken | portion
`);
X('Turkmenistan', 'Turkmen', AS, `
Dograma | bread:60 lamb:100 tomato:40 onion:20 stock:200 | bread and lamb soup | bowl
Ichlekli | flour:80 lamb_mince:70 onion:20 | turkmen meat pie | slice
`);
X('United Arab Emirates', 'Emirati', AS, `
Chebab | flour:50 egg:20 milk:40 sugar:8 cardamom:1 | emirati pancakes | serving (2)
Balaleet (Emirati) | pasta:100 sugar:20 egg:50 butter:10 | sweet noodles with egg | plate
Machboos | rice:200 chicken_thigh:120 tomato:40 onion:30 oil:12 | emirati spiced rice | plate
`);
X('Western Sahara', 'Sahrawi', TE, `
Sahrawi lamb stew | lamb:150 potato:60 onion:20 | sahrawi stew | bowl
Sahrawi flatbread | flour:80 water:50 oil:5 | sahrawi bread | piece
`);
X('Yemen', 'Yemeni', AS, `
Saltah | lamb:60 potato:60 fenugreek:3 tomato:40 egg:30 stock:150 | yemeni stew | bowl
Fahsa | lamb:120 tomato:40 fenugreek:3 onion:20 | lamb fahsa | bowl
Bint al sahn | flour:50 butter:20 egg:15 honey:20 | honey cake yemen | slice
Shafut | yogurt:150 flour_tortilla:40 cucumber:30 mint:2 | yogurt bread salad | bowl
`);


// ======================= SPICE BLENDS FROM AROUND THE WORLD (for building your own dishes) =======================
/** Blends made from the single-spice records; measured by the teaspoon. Spices with no record (sumac, star anise, nigella, grains of selim) are left out rather than guessed. */
Object.assign(K, {
  sp_allspice: 'Spices, allspice, ground', sp_anise: 'Spices, anise seed', sp_basil: 'Spices, basil, dried', sp_bay: 'Spices, bay leaf', sp_caraway: 'Spices, caraway seed',
  sp_cardamom: 'Spices, cardamom', sp_celery_seed: 'Spices, celery seed', sp_chili_powder: 'Spices, chili powder', sp_cinnamon: 'Spices, cinnamon, ground', sp_cloves: 'Spices, cloves, ground',
  sp_coriander: 'Spices, coriander seed', sp_cumin: 'Spices, cumin seed', sp_curry: 'Spices, curry powder', sp_fennel: 'Spices, fennel seed', sp_fenugreek: 'Spices, fenugreek seed',
  sp_garlic: 'Spices, garlic powder', sp_ginger: 'Spices, ginger, ground', sp_mace: 'Spices, mace, ground', sp_marjoram: 'Spices, marjoram, dried', sp_mustard: 'Spices, mustard seed, ground',
  sp_nutmeg: 'Spices, nutmeg, ground', sp_onion: 'Spices, onion powder', sp_oregano: 'Spices, oregano, dried', sp_paprika: 'Spices, paprika', sp_pepper: 'Spices, pepper, black',
  sp_cayenne: 'Spices, pepper, red or cayenne', sp_white_pepper: 'Spices, pepper, white', sp_rosemary: 'Spices, rosemary, dried', sp_sage: 'Spices, sage, ground', sp_tarragon: 'Spices, tarragon, dried',
  sp_thyme: 'Spices, thyme, dried', sp_turmeric: 'Spices, turmeric, ground', sp_dill: 'Spices, dill weed, dried', sp_parsley: 'Spices, parsley, dried',
  thyme_fresh: 'Thyme, fresh', crackers: 'Crackers, saltine', spring_onion: 'Onions, spring or scallions (includes tops and bulb), raw', calabash_nutmeg: 'Calabash nutmeg, seed, dried', soumbala: 'African locust bean, fermented (soumbala)',
});
const SPICE_PORTIONS = [['1 teaspoon', 2.5], ['1 tablespoon', 7]];
const PASTE_PORTIONS = [['1 teaspoon', 5], ['1 tablespoon', 15]];
function SPICES(text, portions) {
  const before = NEW.length;
  L('Worldwide spices and seasonings', 'Spice blend', WW, text);
  for (const r of NEW.slice(before)) r.portions = portions;
}
SPICES(`
Berbere spice blend | sp_cayenne:35 sp_paprika:25 sp_fenugreek:8 sp_coriander:8 sp_ginger:6 sp_cardamom:4 sp_cloves:2 sp_allspice:3 sp_pepper:5 sp_cinnamon:2 salt:2 | berbere; ethiopian spice | 100 g
Mitmita spice blend | sp_cayenne:60 sp_cardamom:15 sp_cloves:10 salt:15 | mitmita; ethiopian hot spice | 100 g
Jerk seasoning, dry | sp_allspice:20 sp_thyme:15 sp_cayenne:10 sp_garlic:12 sp_onion:12 brown_sugar:15 sp_pepper:6 sp_cinnamon:4 sp_nutmeg:3 salt:3 | jamaican jerk seasoning; jerk spice rub | 100 g
Suya spice | peanuts:50 sp_cayenne:15 sp_ginger:10 sp_garlic:8 sp_onion:8 sp_paprika:7 salt:2 | yaji; suya pepper; kuli kuli spice | 100 g
Ras el hanout spice blend | sp_cumin:15 sp_coriander:15 sp_ginger:12 sp_turmeric:10 sp_cinnamon:10 sp_pepper:8 sp_paprika:10 sp_cardamom:5 sp_allspice:5 sp_nutmeg:5 sp_cloves:5 | ras el hanout; moroccan spice | 100 g
Za'atar spice blend | sp_thyme:40 sesame:30 sp_oregano:15 sp_marjoram:10 salt:5 | zaatar; zatar; thyme sesame blend | 100 g
Baharat spice blend | sp_pepper:20 sp_cumin:15 sp_coriander:15 sp_cinnamon:10 sp_cloves:8 sp_paprika:15 sp_cardamom:7 sp_nutmeg:10 | baharat; seven spice; lebanese 7 spice | 100 g
Five-spice powder | sp_anise:30 sp_cinnamon:25 sp_fennel:25 sp_cloves:10 sp_pepper:10 | chinese five spice | 100 g
Cajun seasoning | sp_paprika:30 sp_garlic:15 sp_onion:15 sp_cayenne:10 sp_pepper:10 sp_oregano:8 sp_thyme:7 salt:5 | creole seasoning; cajun spice | 100 g
Italian seasoning | sp_oregano:25 sp_basil:25 sp_thyme:15 sp_rosemary:15 sp_marjoram:15 sp_sage:5 | italian herbs; mixed herbs | 100 g
Herbes de Provence | sp_thyme:30 sp_rosemary:20 sp_marjoram:20 sp_oregano:15 sp_basil:10 sp_tarragon:5 | provence herbs | 100 g
Chaat masala | sp_cumin:25 sp_coriander:20 sp_pepper:10 sp_ginger:10 salt:25 sp_cayenne:10 | chaat spice | 100 g
Tandoori masala | sp_paprika:30 sp_cumin:15 sp_coriander:15 sp_ginger:10 sp_garlic:10 sp_turmeric:5 sp_cayenne:5 sp_cardamom:5 sp_cinnamon:5 | tandoori spice | 100 g
Panch phoron | sp_cumin:25 sp_fennel:25 sp_fenugreek:25 sp_mustard:25 | bengali five seed | 100 g
Sambar powder | sp_coriander:30 sp_cayenne:20 sp_cumin:15 sp_fenugreek:10 sp_pepper:10 sp_mustard:5 sp_turmeric:5 red_lentils:5 | sambar masala | 100 g
Biryani masala | sp_coriander:20 sp_cumin:15 sp_cinnamon:12 sp_cardamom:12 sp_cloves:8 sp_pepper:10 sp_nutmeg:5 sp_mace:5 sp_bay:5 sp_ginger:8 | biryani spice | 100 g
Mixed spice | sp_cinnamon:40 sp_nutmeg:20 sp_allspice:20 sp_ginger:10 sp_cloves:10 | british mixed spice; pudding spice | 100 g
Shawarma spice blend | sp_cumin:20 sp_coriander:15 sp_paprika:20 sp_turmeric:10 sp_cinnamon:10 sp_pepper:10 sp_garlic:10 sp_cloves:5 | shawarma seasoning | 100 g
Adobo seasoning, dry | sp_garlic:30 sp_onion:15 sp_oregano:15 sp_pepper:10 sp_turmeric:5 salt:25 | latin adobo seasoning; all purpose seasoning | 100 g
Seafood seasoning | sp_celery_seed:30 sp_paprika:25 sp_mustard:10 sp_pepper:10 sp_cayenne:5 sp_bay:5 sp_ginger:5 sp_mace:5 salt:5 | old bay style; crab boil seasoning | 100 g
Dukkah | hazelnut:40 sesame:25 sp_coriander:15 sp_cumin:10 sp_pepper:5 salt:5 | duqqa; egyptian nut spice | 100 g
Pepper soup spice | calabash_nutmeg:40 sp_ginger:20 sp_cayenne:20 sp_cloves:10 sp_pepper:10 | nigerian pepper soup seasoning; ehuru blend | 100 g
Curry powder, Caribbean | sp_turmeric:30 sp_coriander:25 sp_cumin:15 sp_fenugreek:8 sp_allspice:7 sp_ginger:7 sp_pepper:5 sp_cayenne:3 | jamaican curry powder; trini curry | 100 g
Garam masala, Pakistani | sp_cumin:20 sp_coriander:20 sp_cardamom:15 sp_pepper:15 sp_cinnamon:10 sp_cloves:10 sp_nutmeg:5 sp_bay:5 | pakistani garam masala | 100 g
Chili lime seasoning | sp_chili_powder:50 sp_cayenne:10 sp_garlic:10 salt:30 | tajin style | 100 g
Taco spice mix, homemade | sp_chili_powder:35 sp_cumin:25 sp_paprika:15 sp_garlic:8 sp_onion:8 sp_oregano:5 salt:4 | homemade taco seasoning | 100 g
Barbecue dry rub | brown_sugar:30 sp_paprika:25 sp_garlic:10 sp_onion:10 sp_pepper:10 sp_chili_powder:10 salt:5 | bbq rub | 100 g
Steak seasoning | sp_pepper:35 sp_garlic:20 sp_onion:15 sp_coriander:10 sp_paprika:10 salt:10 | montreal style steak spice | 100 g
Pumpkin spice, homemade | sp_cinnamon:50 sp_ginger:20 sp_nutmeg:15 sp_cloves:10 sp_allspice:5 | pumpkin pie spice homemade | 100 g
Soumbala seasoning | soumbala:80 sp_cayenne:10 salt:10 | dawadawa; iru; netetu seasoning | 100 g
`, SPICE_PORTIONS);
SPICES(`
Harissa paste | chili:50 olive_oil:20 garlic:10 sp_cumin:5 sp_coriander:5 sp_caraway:5 salt:5 | harissa; north african chili paste | 100 g
Chimichurri | parsley:40 olive_oil:40 vinegar:10 garlic:5 sp_oregano:3 sp_cayenne:2 | chimichurri sauce | 100 g
Green seasoning, Caribbean | coriander:30 spring_onion:25 thyme_fresh:10 garlic:15 green_pepper:20 | trini green seasoning; bajan seasoning | 100 g
Jerk marinade, wet | onion:30 chili:15 sp_allspice:5 sp_thyme:3 soy:15 lime:10 brown_sugar:7 garlic:5 oil:10 | jerk paste | 100 g
Thai red curry paste | chili:35 onion:20 garlic:12 lemongrass:12 ginger:8 dried_shrimp:5 sp_coriander:4 sp_cumin:2 salt:2 | red curry paste | 100 g
Ginger garlic paste | ginger:50 garlic:45 oil:5 | adrak lehsun paste | 100 g
Niter kibbeh | butter:90 sp_fenugreek:2 sp_cumin:2 sp_cardamom:2 sp_turmeric:2 garlic:2 | ethiopian spiced butter | 100 g
Pepper mix, Nigerian | chili:40 red_pepper:40 onion:20 | ata lilo; blended pepper | 100 g
`, PASTE_PORTIONS);

// ======================= MORE BREAKFASTS AND SNACKS =======================
L('Worldwide breakfast', 'Breakfast', WW, `
Oatmeal with dates and walnuts | oats:50 milk:200 dates:20 walnuts:10 | date porridge | bowl
Oatmeal with mango | oats:50 milk:200 mango:80 | mango porridge | bowl
Oatmeal with almond butter | oats:50 milk:200 almonds:15 banana:50 | almond oats | bowl
Oatmeal with cocoa and peanut butter | oats:50 milk:200 cocoa_powder:6 peanut_butter:15 | chocolate pb oats | bowl
Oatmeal with pumpkin and spice | oats:50 milk:180 pumpkin:60 sp_cinnamon:1 maple:10 | pumpkin spice oats | bowl
Oatmeal with coconut milk | oats:50 coconut_milk:80 water:150 banana:50 | coconut porridge | bowl
Oatmeal with soy milk and berries | oats:50 soy_milk:200 blueberries:50 | vegan berry oats | bowl
Oatmeal with egg whites | oats:50 water:200 egg_white:100 blueberries:40 | egg white oats | bowl
Oatmeal with yogurt and honey | oats:50 milk:150 yogurt:80 honey:10 | yogurt porridge | bowl
Steel-cut oats with milk | oats:50 milk:150 water:100 | steel cut porridge | bowl
Overnight oats with mango and coconut | oats:50 coconut_milk:60 yogurt:80 mango:60 | tropical overnight oats | jar
Overnight oats with chocolate | oats:50 milk:120 cocoa_powder:6 yogurt:80 maple:10 | chocolate overnight oats | jar
Overnight oats with apple pie spice | oats:50 milk:120 apple:60 sp_cinnamon:1 yogurt:60 | apple pie overnight oats | jar
Overnight oats with chia and berries | oats:40 chia:10 milk:150 raspberries:50 | chia overnight oats | jar
Banana oat pancakes | oats:50 banana:80 egg:50 | 3 ingredient pancakes | stack (3)
Oat waffles | oats:40 flour:20 egg:30 milk:60 oil:5 | oatmeal waffles | serving (2)
Buttermilk pancakes | flour:60 buttermilk:100 egg:25 butter:10 sugar:8 | buttermilk pancake stack | stack (3)
Blueberry pancakes | flour:60 milk:90 egg:25 blueberries:50 butter:8 | blueberry pancake stack | stack (3)
Chocolate chip pancakes | flour:60 milk:90 egg:25 dark_choc:15 butter:8 | choc chip pancakes | stack (3)
Vegan pancakes | flour:60 soy_milk:100 oil:8 sugar:8 | egg-free pancakes | stack (3)
Cottage cheese pancakes | cottage:100 egg:50 oats:30 | high protein pancakes | stack (3)
Sweet potato pancakes | sweet_potato:100 egg:50 flour:20 | sweet potato flapjacks | stack (3)
Breakfast quesadilla | flour_tortilla:70 egg_scrambled:100 cheddar:25 salsa:20 | egg quesadilla | quesadilla
Breakfast tacos | corn_tortilla:60 egg_scrambled:100 cheddar:20 salsa:30 | egg tacos | serving (2)
Breakfast wrap with egg and spinach | flour_tortilla:70 egg_scrambled:100 spinach:30 feta:20 | spinach egg wrap | wrap
Egg muffins with vegetables | egg:150 red_pepper:30 spinach:20 onion:15 cheddar:15 | egg bites | serving (3)
Shakshuka with bread | egg:100 tomato_canned:150 red_pepper:40 onion:30 olive_oil:10 bread:60 | eggs in tomato sauce | plate
Green shakshuka | egg:100 spinach:100 kale:50 feta:20 olive_oil:10 | green eggs skillet | plate
Eggs and avocado on rye | rye_bread:60 egg_poached:100 avocado:60 | avocado eggs rye | plate
Smoked salmon and scrambled eggs | egg_scrambled:120 smoked_salmon:50 bread:40 | salmon eggs | plate
Turkey sausage and eggs | turkey_mince:80 egg_scrambled:100 | turkey breakfast | plate
Egg fried bread | bread:60 egg:50 oil:10 | eggy bread savory | serving (2 slices)
Steak and eggs | beef_sirloin:150 egg_fried:100 | steak eggs | plate
Hash with eggs and peppers | potato:150 red_pepper:40 onion:30 egg_fried:100 oil:10 | breakfast hash | plate
Sweet potato hash | sweet_potato:150 onion:30 egg_fried:100 oil:10 | sweet potato breakfast hash | plate
Avocado and tomato toast | bread:60 avocado:60 tomato:50 | avo tomato toast | serving (2 slices)
Ricotta toast with honey | bread:60 ricotta:60 honey:10 | ricotta honey toast | serving (2 slices)
Cream cheese and jam toast | bread:60 cream_cheese:30 jam:15 | cream cheese toast | serving (2 slices)
Hummus toast | bread:60 hummus:50 cucumber:30 | hummus on toast | serving (2 slices)
Banana toast with cinnamon | bread:60 banana:80 sp_cinnamon:1 honey:8 | banana cinnamon toast | serving (2 slices)
Tomato toast | bread:60 tomato:80 olive_oil:8 | tomato on toast | serving (2 slices)
Sardines on toast | bread:60 sardine:80 | sardine toast | plate
Peanut butter bagel with banana | bagel:100 peanut_butter:25 banana:60 | pb banana bagel | bagel
Bagel with egg and avocado | bagel:100 egg_fried:50 avocado:40 | avocado egg bagel | bagel
Bagel with turkey and cheese | bagel:100 turkey:50 swiss:20 | turkey bagel | bagel
Bagel with tuna | bagel:100 tuna:70 mayo:15 | tuna bagel | bagel
Cinnamon raisin bagel with butter | bagel:100 raisins:15 butter:10 | raisin bagel | bagel
Bagel with jam | bagel:100 jam:25 | jam bagel | bagel
Everything bagel with cream cheese | bagel:100 sesame:5 cream_cheese:30 | everything bagel | bagel
English muffin with peanut butter | english_muffin:60 peanut_butter:20 | pb english muffin | muffin
English muffin with egg | english_muffin:60 egg_fried:50 | egg muffin | muffin
Croissant with ham and egg | croissant:60 ham_slice:30 egg_fried:50 | breakfast croissant | croissant
Croissant with chocolate spread | croissant:60 nutella:20 | chocolate croissant spread | croissant
Granola with milk and banana | granola:50 milk:200 banana:60 | granola banana | bowl
Granola with yogurt and berries | granola:40 greek_yogurt:150 blueberries:40 strawberries:40 | berry granola bowl | bowl
Muesli with yogurt | oats:40 raisins:10 almonds:10 yogurt:150 | muesli yogurt | bowl
Cornflakes with banana | cornflakes:30 milk:200 banana:60 | cereal and banana | bowl
Bran-style cereal with milk | oats:30 raisins:15 milk:200 | bran cereal | bowl
Rice porridge with egg | rice:100 water:200 egg:50 soy:5 | savory rice porridge | bowl
Millet porridge | millet:150 milk:100 sugar:8 | millet breakfast porridge | bowl
Quinoa porridge with berries | quinoa:120 milk:120 blueberries:40 maple:8 | quinoa berry porridge | bowl
Buckwheat porridge with milk | buckwheat:150 milk:120 butter:5 | grechka with milk | bowl
Teff porridge | teff:150 milk:100 honey:8 | teff breakfast | bowl
Sorghum porridge | sorghum:50 water:200 milk:60 sugar:8 | sorghum breakfast porridge | bowl
Amaranth porridge | amaranth:150 milk:100 honey:8 | amaranth breakfast | bowl
Chia pudding with mango | chia:30 coconut_milk:60 milk:120 mango:60 | mango chia | jar
Chia pudding with berries | chia:30 milk:180 raspberries:40 honey:8 | berry chia pudding | jar
Greek yogurt with granola and honey | greek_yogurt:170 granola:30 honey:10 | yogurt granola honey | bowl
Skyr bowl with fruit | greek_yogurt:170 banana:50 strawberries:40 | high protein yogurt bowl | bowl
Cottage cheese with tomato and pepper | cottage:150 tomato:60 sp_pepper:0.5 | savory cottage cheese | bowl
Cottage cheese on toast | bread:60 cottage:100 | cottage cheese toast | serving (2 slices)
Fruit plate | apple:80 orange:100 banana:80 grapes:60 | breakfast fruit | plate
Papaya with lime | papaya:200 lime:5 | papaya breakfast | plate
Melon and yogurt | cantaloupe:150 yogurt:100 | melon yogurt | bowl
Grapefruit-style citrus bowl | orange:200 honey:5 | citrus breakfast bowl | bowl
Breakfast smoothie with oats | oats:30 banana:80 milk:200 peanut_butter:10 | oat breakfast shake | glass
Protein smoothie bowl | banana:100 greek_yogurt:150 blueberries:50 granola:20 | protein bowl | bowl
Tofu breakfast burrito | flour_tortilla:70 tofu:100 black_beans:50 salsa:30 avocado:30 | vegan breakfast burrito | burrito
Vegan banana oat muffins | oats:30 flour:20 banana:50 maple:10 oil:8 | egg-free oat muffins | muffin
Peanut butter oat bars | oats:40 peanut_butter:20 honey:10 | breakfast bars | bar
Breakfast cookies | oats:30 banana:40 raisins:10 peanut_butter:10 | oat cookies breakfast | serving (2)
Zucchini bread | flour:35 zucchini:30 sugar:18 oil:12 egg:12 | courgette loaf | slice
Pumpkin bread | flour:35 pumpkin:35 sugar:20 oil:12 egg:12 sp_cinnamon:1 | pumpkin loaf | slice
Cinnamon raisin toast | bread:60 raisins:10 butter:8 sp_cinnamon:1 | raisin toast | serving (2 slices)
Sausage biscuit | flour:50 butter:15 buttermilk:30 sausage:50 | breakfast biscuit sandwich | biscuit
Egg and cheese biscuit | flour:50 butter:15 buttermilk:30 egg_fried:50 cheddar:20 | egg cheese biscuit | biscuit
`);
L('Worldwide snacks and sides', 'Snack', WW, `
Hummus with pita | hummus:80 pita:60 | pita and hummus | serving
Hummus with vegetables | hummus:80 carrots_raw:60 cucumber:60 red_pepper:50 | crudites and hummus | serving
Tzatziki with pita | yogurt:80 cucumber:30 garlic:2 olive_oil:5 pita:60 | pita and tzatziki | serving
Baba ganoush with pita | eggplant:120 tahini:15 olive_oil:8 lemon:5 pita:60 | eggplant dip pita | serving
Guacamole with vegetables | guacamole:80 carrots_raw:60 cucumber:60 | veggie guac | serving
Cheese cubes | cheddar:40 | cheddar cubes | serving
Cheese and apple | cheddar:30 apple:120 | apple and cheese | serving
Cheese and grapes | cheddar:30 grapes:100 | grapes and cheese | serving
String cheese | mozzarella:28 | mozzarella stick snack | stick
Crackers with peanut butter | crackers:25 peanut_butter:20 | pb crackers | serving
Crackers with hummus | crackers:25 hummus:40 | crackers and hummus | serving
Rice cakes with avocado | rice_cake:20 avocado:50 | avocado rice cake | serving (2)
Rice cakes with cottage cheese | rice_cake:20 cottage:60 | cottage rice cake | serving (2)
Rice cake with chocolate spread | rice_cake:20 nutella:15 | chocolate rice cake | serving (2)
Almonds, handful | almonds:30 | almonds | handful (30 g)
Cashews, handful | cashews:30 | cashew nuts | handful (30 g)
Peanuts, handful | peanuts:30 | roasted peanuts | handful (30 g)
Walnuts, handful | walnuts:30 | walnut halves | handful (30 g)
Pistachios, handful | pistachio:30 | pistachio nuts | handful (30 g)
Spiced roasted nuts | almonds:15 cashews:15 peanuts:10 oil:3 sp_paprika:0.5 | spiced nuts | handful (43 g)
Dried fruit mix | raisins:20 apricot_dried:20 dates:20 | dried fruit | handful (60 g)
Dates with peanut butter | dates:40 peanut_butter:15 | stuffed dates | serving (3)
Dates with almonds | dates:40 almonds:10 | almond stuffed dates | serving (3)
Banana and nuts | banana:120 walnuts:15 | banana walnut snack | serving
Orange slices | orange:150 | orange | serving
Apple slices with cinnamon | apple:150 sp_cinnamon:0.5 | cinnamon apple | serving
Frozen grapes | grapes:150 | grapes snack | cup
Berries bowl | strawberries:80 blueberries:60 raspberries:40 | mixed berries | bowl
Fruit skewers | strawberries:50 pineapple:50 grapes:50 melon_seed:0 | fruit kebabs | serving (3)
Yogurt with berries | yogurt:150 blueberries:50 | berry yogurt | pot
Greek yogurt with honey | greek_yogurt:170 honey:12 | honey greek yogurt | pot
Kefir with fruit | kefir:200 strawberries:50 | kefir fruit | glass
Protein yogurt bowl with nuts | greek_yogurt:170 almonds:15 | yogurt and almonds | bowl
Hard boiled eggs with salt | egg_boiled:100 salt:0.5 | two boiled eggs | serving (2)
Egg and cheese snack plate | egg_boiled:50 cheddar:25 cucumber:50 | protein snack box | plate
Turkey roll-ups | turkey:60 cheddar:20 lettuce:10 | turkey cheese roll | serving (3)
Ham and cheese roll-ups | ham_slice:50 swiss:20 | ham roll ups | serving (3)
Tuna with crackers | tuna:80 crackers:25 | tuna crackers | serving
Edamame with chili | edamame:150 sp_cayenne:0.5 salt:1 | spicy edamame | bowl
Roasted seaweed snack | laver:5 sesame_oil:1 | seaweed snack | pack
Kale chips | kale_raw:60 olive_oil:5 salt:0.5 | baked kale crisps | bowl
Baked sweet potato chips | sweet_potato:120 oil:6 | sweet potato crisps | bowl
Plantain chips | green_plantain:100 oil:15 salt:1 | chifles; plantain crisps | bag
Cassava chips | cassava:100 oil:15 salt:1 | yuca chips | bag
Pita chips | pita:50 olive_oil:5 | baked pita crisps | serving
Homemade tortilla chips | corn_tortilla:60 oil:10 salt:1 | baked tortilla chips | serving
Air-popped popcorn | popcorn:25 | plain popcorn | bowl
Sweet and salty popcorn | popcorn:25 sugar:8 butter:5 salt:0.5 | kettle corn | bowl
Cinnamon popcorn | popcorn:25 butter:5 sugar:5 sp_cinnamon:0.5 | cinnamon sugar popcorn | bowl
Chocolate rice cakes | rice_cake:20 dark_choc:15 | chocolate topped rice cake | serving (2)
Dark chocolate squares | dark_choc:25 | dark chocolate | serving (25 g)
Chocolate almonds | almonds:20 dark_choc:15 | choc almonds | handful
Peanut butter balls | peanut_butter:30 oats:20 honey:10 | pb bites | serving (3)
Coconut energy balls | dates:30 coconut_meat:15 almonds:15 | coconut bliss balls | serving (3)
Protein bar, homemade | oats:30 peanut_butter:20 greek_yogurt:30 honey:10 | homemade protein bar | bar
Granola bites | granola:40 peanut_butter:10 | granola clusters | serving
Banana bread slice with butter | flour:35 banana:40 sugar:15 butter:15 egg:10 | buttered banana bread | slice
Toast with honey | bread:60 honey:15 butter:5 | honey toast | serving (2 slices)
Mini pizza on pita | pita:60 marinara:30 mozzarella:30 | pita pizza | piece
Cheese quesadilla snack | flour_tortilla:40 cheddar:30 | mini quesadilla | piece
Pigs in blankets | sausage:60 puff_pastry:30 | sausage rolls mini | serving (4)
Chicken wings, baked | wing:150 | baked wings | serving (5)
Spicy chicken bites | chicken_breast:100 flour:10 oil:8 sp_cayenne:1 | chicken bites | serving
Meatballs snack | beef_mince:100 breadcrumbs:10 egg:10 | cocktail meatballs | serving (5)
Shrimp skewers | shrimp:100 olive_oil:5 garlic:2 | grilled prawn skewers | serving (2)
Falafel with tahini | chickpeas:100 flour:10 oil:15 tahini:15 | falafel snack | serving (4)
Samosas, vegetable | flour:50 potato:60 peas:20 oil:15 | veg samosa | serving (2)
Spring rolls, chicken | flour:40 chicken_mince:40 cabbage:30 carrots:15 oil:12 | chicken spring rolls | serving (3)
Vegetable pakora | chickpea_flour:40 onion:40 spinach:20 potato:30 oil:15 | bhaji fritters | serving (4)
Corn fritters | corn_canned:80 flour:25 egg:20 oil:12 | sweetcorn fritters | serving (3)
Zucchini fritters | zucchini:120 flour:20 egg:20 feta:15 oil:12 | courgette fritters | serving (3)
Potato croquettes | potato:120 flour:10 egg:15 breadcrumbs:15 oil:12 | croquettes | serving (3)
Cheese straws | puff_pastry:40 cheddar:20 | cheese twists | serving (3)
Pretzels, soft | flour:80 butter:5 salt:1 | soft pretzel | pretzel
Bruschetta with mushrooms | baguette:60 mushrooms:60 olive_oil:8 garlic:2 | mushroom crostini | serving (2)
Caprese skewers | mozzarella:50 tomato:60 basil:2 balsamic:5 | caprese bites | serving (4)
Stuffed peppers with cheese | red_pepper:120 cream_cheese:40 | stuffed mini peppers | serving
Cucumber bites with cream cheese | cucumber:100 cream_cheese:30 | cucumber rounds | serving
Pickles | pickles:60 | dill pickles | serving
Olives | olives:40 | marinated olives | serving
Coconut chunks | coconut_meat:50 | fresh coconut | serving
Sugarcane sticks | sugarcane:150 | sugar cane | serving
Roasted corn | corn:150 | grilled corn | cob
Boiled peanuts | peanuts:60 water:40 salt:1 | salted boiled peanuts | serving
Roasted plantain | ripe_plantain:150 | roast plantain | serving
`);
// ---- breakfasts and snacks country by country ----
X('Nigeria', 'Nigerian', AF, `
Akara and ogi | cowpeas:120 oil:20 onion:15 cornmeal:40 water:200 sugar:8 | akara and pap; akara and akamu | plate
Bread and egg (Nigerian) | bread:80 egg:100 onion:15 tomato:20 oil:8 | bread and fried egg | plate
Yam and egg sauce | yam:250 egg:100 tomato:60 onion:20 oil:12 | boiled yam and egg | plate
Plantain and egg | plantain_fried:150 egg_scrambled:100 | dodo and egg | plate
Custard and akara | milk:150 cornstarch:20 sugar:10 cowpeas:100 oil:15 | custard with akara | plate
Moi moi and ogi | cowpeas:120 oil:12 red_pepper:20 cornmeal:40 water:200 | moin moin and pap; moi moi and akamu | plate
Agege bread with butter | bread:120 butter:10 | agege bread | serving (2 slices)
Bread and beans | bread:80 cowpeas:150 palm_oil:12 | ewa agoyin and bread | plate
Puff puff | flour:60 sugar:12 oil:20 water:35 | puff-puff | serving (4)
Chin chin | flour:50 sugar:12 butter:8 egg:8 oil:12 | chinchin | handful (50 g)
Plantain chips (Nigerian) | green_plantain:100 oil:15 | ipekere | bag
Kuli kuli | peanuts:50 oil:5 | groundnut cake | portion
Coconut candy | coconut_meat:50 sugar:25 | coconut sweet | serving (3)
Boiled groundnuts | peanuts:60 water:40 salt:1 | boiled peanuts nigeria | serving
Roasted corn and coconut | corn:150 coconut_meat:40 | corn and coconut | serving
Roasted corn and ube | corn:150 avocado:60 | corn and pear | serving
Meat pie (Nigerian) | flour:60 butter:20 beef_mince:40 potato:20 carrots:10 | nigerian meat pie | pie
Fish roll | flour:50 oil:15 sardine:30 | nigerian fish roll | roll
Sausage roll (Nigerian) | flour:50 butter:15 sausage:30 | gala style sausage roll | roll
Buns (Nigerian) | flour:60 sugar:12 oil:15 egg:10 | nigerian buns | serving (2)
Egg roll (Nigerian) | flour:50 oil:15 egg_boiled:50 sugar:5 | nigerian egg roll | roll
Zobo with pineapple | roselle:10 pineapple:60 sugar:20 water:250 | zobo drink | glass
Kunu | millet:40 ginger:3 sugar:15 water:250 | kunu zaki | glass
Tiger nut drink | coconut_meat:20 dates:20 water:250 | kunun aya | glass
`);
X('Ghana', 'Ghanaian', AF, `
Koko with bread | millet:40 water:250 sugar:12 bread:60 | hausa koko and bread | bowl
Tea bread with egg | bread:80 egg_fried:50 | ghana breakfast | plate
Oblayo | cornmeal:50 water:200 sugar:10 milk:50 | corn porridge ghana | bowl
Bofrot | flour:60 sugar:12 oil:20 | ghana doughnut | serving (3)
Plantain chips (Ghanaian) | green_plantain:100 oil:15 | chips ghana | bag
Nkate cake | peanuts:40 sugar:25 | peanut brittle ghana | piece
Kose | cowpeas:100 oil:15 onion:15 | koose | serving (4)
Ghana meat pie | flour:60 butter:20 beef_mince:40 onion:10 | ghana pie | pie
Roasted plantain with peanuts | ripe_plantain:150 peanuts:30 | kofi brokeman | serving
Asaana | corn:50 sugar:20 water:250 | caramelized corn drink | glass
`);
X('Kenya', 'Kenyan', AF, `
Mandazi with chai | flour:60 sugar:10 coconut_milk:20 oil:15 black_tea:150 milk:100 | chai and mandazi | serving
Uji | millet:40 water:250 sugar:10 lemon:3 | kenyan porridge | bowl
Smocha | flour:50 oil:10 sausage:50 tomato:20 onion:10 | chapati sausage roll | roll
Rolex (East African) | flour:60 oil:10 egg:100 cabbage:30 tomato:20 | chapati egg roll | roll
Bhajia | potato:150 chickpea_flour:25 oil:15 | kenyan potato bhajia | portion
Mutura snack | beef_mince:80 liver:20 onion:10 | street sausage | portion
Viazi karai | potato:150 chickpea_flour:20 oil:15 turmeric:1 | battered potatoes | portion
Roasted maize | corn:150 lemon:3 sp_cayenne:0.5 | mahindi choma | cob
Samosa (Kenyan) | flour:40 beef_mince:50 onion:15 oil:15 | kenyan samosa | serving (2)
`);
X('Ethiopia', 'Ethiopian', AF, `
Chechebsa | flour:80 butter:20 chili_powder:2 honey:10 | kita firfir | plate
Ful (Ethiopian) | fava:200 tomato:30 onion:20 butter:10 egg:50 | ethiopian ful breakfast | plate
Enkulal firfir | egg:120 tomato:40 onion:30 butter:10 chili:3 | ethiopian scrambled eggs | plate
Kolo | sorghum:40 peanuts:20 | roasted barley snack | handful
Dabo kolo | flour:40 oil:5 sugar:3 sp_cayenne:0.5 | ethiopian crunchy snack | handful
Sambusa (Ethiopian) | flour:40 lentils:50 onion:15 oil:15 | lentil sambusa | serving (2)
`);
X('South Africa', 'South African', AF, `
Mieliepap with milk and sugar | cornmeal:60 water:200 milk:80 sugar:10 | breakfast pap | bowl
Maltabella-style sorghum porridge | sorghum:50 water:200 milk:80 sugar:10 | sorghum breakfast | bowl
Rusks with coffee | flour:40 butter:12 sugar:10 buttermilk:15 coffee:200 milk:30 | beskuit | serving (2 rusks)
Boerewors roll | sausage:100 roll:70 onion:20 tomato:20 | boerie roll | roll
Vetkoek with apricot jam | flour:70 oil:20 jam:20 | vetkoek and jam | serving
Droëwors | beef:40 | dried sausage | portion (40 g)
Bunny chow, quarter | bread:150 chicken_thigh:100 potato:50 curry:4 oil:10 | quarter bunny | serving
`);
X('Jamaica', 'Jamaican', NA, `
Callaloo and boiled dumplings | spinach:120 onion:15 oil:8 flour:60 water:30 | jamaican breakfast callaloo | plate
Ackee and saltfish with fried dumplings | ackee:120 salt_cod:80 onion:20 oil:10 flour:70 | jamaican national breakfast | plate
Mackerel rundown with green banana | mackerel:100 coconut_milk:60 green_plantain:150 | rundown breakfast | plate
Liver and onions with dumplings | liver:120 onion:40 oil:8 flour:60 | jamaican liver breakfast | plate
Fried plantain and eggs | plantain_fried:150 egg_fried:100 | plantain breakfast | plate
Oats porridge (Jamaican) | oats:50 milk:150 condensed:20 sp_nutmeg:0.5 sp_cinnamon:0.5 | jamaican oats | bowl
Banana porridge (Jamaican) | green_plantain:100 milk:150 condensed:20 sp_nutmeg:0.5 | green banana porridge | bowl
Plantain porridge | green_plantain:100 milk:150 condensed:20 sp_cinnamon:0.5 | jamaican plantain porridge | bowl
Fried bread and butter | bread:80 butter:10 | hard dough fried | serving (2 slices)
Jamaican spice bun with cheese | flour:60 molasses:15 raisins:15 brown_sugar:10 cheddar:30 | bun and cheese | serving
Coconut drops | coconut_meat:40 brown_sugar:25 ginger:2 | jamaican coconut drops | piece
Tamarind balls | tamarind:30 sugar:25 | tambrin balls | serving (2)
Peanut drops | peanuts:30 brown_sugar:20 | jamaican peanut brittle | piece
Banana chips (Jamaican) | green_plantain:100 oil:15 | jamaican banana chips | bag
Toto | flour:40 coconut_meat:20 brown_sugar:20 butter:10 | jamaican coconut cake | piece
Coconut water with jelly | coconut_water:300 coconut_meat:40 | jelly coconut | coconut
`);
X('Trinidad and Tobago', 'Trinidadian', NA, `
Doubles with channa | flour:60 oil:15 chickpeas:80 curry:3 | trini doubles | serving
Sada roti with tomato choka | flour:80 water:40 tomato:100 onion:15 oil:8 | sada roti and choka | plate
Sada roti with baigan choka | flour:80 water:40 eggplant:150 oil:8 garlic:3 | roti and baigan choka | plate
Saheena | spinach:40 chickpea_flour:40 flour:15 oil:15 | dasheen fritters | serving (3)
Kurma (Trinidad) | flour:50 sugar:20 butter:10 | trini kurma sweet | serving
Tamarind ball (Trinidad) | tamarind:30 sugar:25 | trini tamarind ball | serving (2)
`);
X('Canada', 'Canadian', NA, `
Back bacon and eggs | pork_loin:80 egg_fried:100 bread:40 | peameal breakfast | plate
Maple oatmeal | oats:50 milk:200 maple:15 | maple porridge | bowl
Blueberry bannock | flour:60 butter:10 milk:30 blueberries:30 | berry bannock | piece
Maple butter tart | pie_crust:30 brown_sugar:20 butter:8 maple:10 egg:8 raisins:8 | mini butter tart | tart
Ketchup chips-style crisps | potato:80 oil:15 ketchup:5 | ketchup crisps homemade | bag
Timbit-style doughnut holes | flour:30 sugar:8 oil:10 | doughnut holes | serving (4)
`);
X('United States of America', 'American', NA, `
Bacon, egg and cheese sandwich | roll:70 bacon:20 egg_fried:50 cheddar:20 | bec sandwich; bodega breakfast | sandwich
Sausage, egg and cheese biscuit | flour:50 butter:15 buttermilk:30 sausage:50 egg_fried:50 cheddar:20 | sec biscuit | biscuit
Denver omelette | egg:120 ham:40 green_pepper:30 onion:20 cheddar:20 butter:8 | western omelet | omelette
Eggs Benedict | english_muffin:60 ham_slice:40 egg_poached:100 butter:20 egg:15 | eggs benny | plate
Eggs Florentine | english_muffin:60 spinach:60 egg_poached:100 butter:20 egg:15 | eggs florentine | plate
Breakfast skillet | potato:150 sausage:50 egg_fried:100 cheddar:25 onion:20 | skillet breakfast | plate
Grits and eggs | cornmeal:50 water:200 butter:10 egg_scrambled:100 | grits breakfast | plate
Cheese grits | cornmeal:50 water:180 cheddar:30 butter:10 | cheesy grits | bowl
Chicken biscuit | flour:50 butter:15 buttermilk:30 chicken_fried:80 | fried chicken biscuit | biscuit
Pop-tart-style toaster pastry | pie_crust:40 jam:20 icing_sugar:8 | toaster pastry | pastry
Peanut butter crackers | crackers:25 peanut_butter:20 | pb crackers sandwich | pack
Ants on a log with raisins | celery_raw:100 peanut_butter:30 raisins:15 | ants on a log | serving
Chex-style snack mix | cornflakes:25 peanuts:15 crackers:10 butter:8 worcestershire:2 | party mix | cup
Buffalo cauliflower bites | cauliflower:150 flour:15 oil:12 sp_cayenne:1 | cauliflower wings | serving
Jalapeño poppers | green_pepper:100 cream_cheese:40 cheddar:15 breadcrumbs:10 | poppers | serving (4)
Pigs in a blanket | sausage:60 flour:30 butter:10 | crescent dogs | serving (4)
Beef jerky snack | beef:40 soy:3 | jerky | bag (40 g)
`);
X('United Kingdom', 'British', EUR, `
Porridge with golden syrup | oats:50 milk:200 sugar:15 | scottish porridge syrup | bowl
Bacon roll | roll:70 bacon:40 ketchup:10 | bacon bap; bacon butty roll | roll
Sausage and egg muffin | english_muffin:60 sausage:50 egg_fried:50 | sausage egg muffin | muffin
Kippers on toast | kipper:120 bread:60 butter:8 | kippers breakfast | plate
Vegetarian fry-up | egg_fried:100 baked_beans:100 mushrooms:60 tomato:60 bread:30 | veggie full breakfast | plate
Marmite-style yeast spread on toast | bread:60 butter:8 vegemite:5 | yeast extract toast | serving (2 slices)
Hot cross bun with butter | flour:50 sugar:8 raisins:10 butter:15 | hot cross bun | bun
Teacake with butter | flour:50 sugar:8 raisins:10 butter:10 | toasted teacake | teacake
Digestive-style biscuits | flour:20 oats:5 butter:8 sugar:6 | digestive biscuits | serving (2)
Pork pie | pie_crust:60 pork_shoulder:50 | pork pie | pie
Cheese and pickle sandwich | bread:70 cheddar:40 pickles:20 | cheese pickle sarnie | sandwich
Crisp sandwich | bread:70 butter:8 potato:20 oil:8 | crisp butty | sandwich
`);
X('France', 'French', EUR, `
Tartine with butter and jam | baguette:80 butter:10 jam:20 | tartine beurre confiture | serving
Croissant and café au lait | croissant:60 coffee:150 milk:100 | french breakfast | serving
Pain aux raisins | croissant:60 raisins:15 milk:20 sugar:8 | raisin swirl | pastry
Chausson aux pommes | puff_pastry:60 apple:50 sugar:8 | apple turnover | pastry
Brioche with chocolate | flour:50 butter:15 egg:15 sugar:8 dark_choc:10 | pain brioche chocolat | serving
Œufs cocotte | egg:100 cream:30 butter:5 | baked eggs in cream | ramekin
Gougères | flour:20 butter:12 egg:20 swiss:15 | cheese puffs | serving (4)
`);
X('Spain', 'Spanish', EUR, `
Tostada con tomate y aceite | baguette:70 tomato:50 olive_oil:10 | spanish breakfast toast | serving
Churros con chocolate (breakfast) | flour:50 oil:20 sugar:8 milk:120 dark_choc:20 | churros breakfast | serving
Tortilla de patatas pintxo | potato:80 egg:40 onion:15 olive_oil:10 baguette:30 | tortilla pincho | piece
Magdalenas | flour:25 sugar:20 oil:12 egg:15 | spanish muffins | serving (2)
Jamón and cheese bocadillo | baguette:90 ham:40 swiss:20 | bocadillo | sandwich
`);
X('Italy', 'Italian', EUR, `
Cornetto with cappuccino | croissant:60 coffee:60 milk:120 | italian breakfast | serving
Fette biscottate with jam | bread:30 jam:20 | rusks with jam | serving (3)
Maritozzo | flour:50 sugar:10 butter:10 cream:40 | cream bun | bun
Focaccia slice | flour:70 olive_oil:15 salt:1 | focaccia | slice
Crostini with olive tapenade | baguette:50 olives:30 olive_oil:5 | olive crostini | serving (3)
Grissini with prosciutto | flour:30 olive_oil:5 ham:30 | breadsticks and ham | serving
`);
X('Germany', 'German', EUR, `
Brötchen with butter and jam | roll:60 butter:10 jam:20 | german breakfast roll | roll
Brötchen with cheese and ham | roll:60 butter:8 swiss:20 ham_slice:20 | belegtes brötchen | roll
Müsli with yogurt (German) | oats:40 almonds:10 raisins:10 yogurt:150 | german muesli | bowl
Quark with fruit | cottage:150 strawberries:60 honey:8 | quark bowl | bowl
Bauernfrühstück | potato:180 egg:100 bacon:20 onion:30 oil:10 | farmers breakfast | plate
Pretzel with butter | flour:80 butter:10 salt:1 | butterbrezel | pretzel
`);
X('Netherlands', 'Dutch', EUR, `
Ontbijtkoek | flour:30 rye_bread:10 sugar:20 sp_cinnamon:1 | dutch spice cake | slice
Uitsmijter | bread:60 egg_fried:100 ham_slice:30 cheddar:20 | open egg sandwich | plate
Stroopwafel | flour:20 butter:8 sugar:8 molasses:8 | syrup waffle | waffle
Bitterballen | beef:30 flour:12 butter:8 milk:30 breadcrumbs:12 oil:10 | dutch meatballs snack | serving (4)
`);
X('Poland', 'Polish', EUR, `
Twarożek on bread | rye_bread:60 cottage:100 spring_onion:10 | polish cottage cheese spread | serving
Jajecznica | egg:150 butter:10 onion:15 | polish scrambled eggs | plate
Owsianka | oats:50 milk:200 apple:50 | polish porridge | bowl
Obwarzanek | flour:80 sesame:5 | krakow bagel | ring
`);
X('Russia', 'Russian', EUR, `
Tvorog with sour cream | cottage:150 sour_cream:30 sugar:8 | tvorog breakfast | bowl
Buterbrod with cheese | bread:40 butter:8 cheddar:20 | russian open sandwich | piece
Semolina kasha | semolina:40 milk:200 sugar:10 butter:5 | mannaya kasha | bowl
Oladyi | flour:50 kefir:80 egg:15 oil:10 sugar:8 | russian pancakes | serving (4)
Pirozhki with potato | flour:50 potato:50 onion:10 oil:12 | potato pirozhki | serving (2)
Sushki | flour:40 sugar:5 | russian bread rings | serving (5)
`);
X('Türkiye', 'Turkish', AS, `
Turkish breakfast plate | bread:60 feta:40 olives:20 tomato:60 cucumber:60 egg_boiled:50 honey:10 | kahvalti | plate
Sucuklu yumurta | sausage:50 egg_fried:100 | sujuk and eggs | plate
Gözleme with cheese | flour:70 feta:40 spinach:20 butter:8 | turkish flatbread cheese | piece
Poğaça | flour:50 butter:12 feta:15 yogurt:10 | turkish pastry | piece
Açma | flour:50 butter:10 sugar:5 milk:15 | soft simit | piece
Leblebi | chickpeas:50 | roasted chickpeas turkish | handful
`);
X('Lebanon', 'Lebanese', AS, `
Labneh with olive oil and pita | yogurt:100 olive_oil:10 pita:60 | labneh breakfast | plate
Ka'ak with za'atar | flour:70 sesame:8 sp_thyme:2 olive_oil:8 | street ka'ak | piece
Foul and fatteh breakfast | fava:150 chickpeas:60 olive_oil:12 lemon:5 pita:40 | lebanese foul | bowl
Cheese manakish | flour:80 mozzarella:40 olive_oil:5 | jibneh manoushe | piece
`);
X('India', 'Indian', AS, `
Aloo poha with peanuts | rice:120 potato:40 peanuts:15 oil:8 turmeric:1 | batata poha | plate
Rava idli | semolina:60 yogurt:40 | semolina idli | serving (3)
Medu vada | lentils:100 oil:15 | urad vada | serving (2)
Masala dosa | rice:80 lentils:30 potato:80 oil:10 | masala dosai | dosa
Plain dosa with chutney | rice:80 lentils:30 oil:8 coconut_meat:20 | sada dosa | dosa
Besan chilla | chickpea_flour:50 onion:20 tomato:20 oil:8 | gram flour pancake | serving (2)
Moong dal chilla | lentils:100 onion:15 oil:8 | lentil crepe | serving (2)
Paneer bhurji with paratha | paneer:80 onion:20 tomato:30 oil:8 flour:60 butter:8 | paneer scramble | plate
Egg bhurji with pav | egg:100 onion:20 tomato:20 oil:8 roll:60 | anda bhurji | plate
Bread omelette | bread:60 egg:100 onion:15 oil:8 | indian bread omelette | serving
Sabudana khichdi | tapioca:60 potato:50 peanuts:15 ghee:8 | tapioca pearls breakfast | bowl
Thepla | flour:60 fenugreek:2 yogurt:15 oil:8 | methi thepla | serving (2)
Kachori | flour:50 lentils:30 oil:20 | dal kachori | serving (2)
Pani puri | flour:30 oil:10 potato:40 chickpeas:30 tamarind:10 | golgappa | serving (6)
Bhel puri | rice:40 potato:30 onion:15 tomato:15 peanuts:10 tamarind:10 | bhel | plate
Sev puri | flour:30 oil:10 potato:30 onion:10 tamarind:10 | sev puri | serving (6)
Aloo tikki | potato:120 breadcrumbs:10 oil:12 | potato patties | serving (2)
Dabeli | roll:60 potato:70 peanuts:10 tamarind:8 butter:5 | kutchi dabeli | serving
Murukku | rice_flour:30 chickpea_flour:10 oil:12 | chakli | handful
Masala peanuts | peanuts:40 chickpea_flour:10 oil:8 | spiced peanuts | handful
Banana chips (Kerala) | green_plantain:100 coconut_oil:20 | kerala chips | bag
`);
X('Pakistan', 'Pakistani', AS, `
Paratha with omelette | flour:80 ghee:15 egg:100 onion:15 | anda paratha | plate
Chana with puri | chickpeas:150 oil:30 flour:60 | chana puri | plate
Nihari-style breakfast with naan | beef:100 flour:10 ghee:15 naan:90 | nihari naan | plate
Lassi and paratha | yogurt:200 sugar:15 flour:80 ghee:15 | paratha lassi | serving
Dahi baray | lentils:80 oil:10 yogurt:100 tamarind:8 | dahi bhalla | serving (3)
Chana chaat | chickpeas:150 onion:20 tomato:30 tamarind:10 | chickpea chaat | bowl
Fruit chaat | apple:60 banana:60 orange:60 guava:40 sugar:5 | pakistani fruit chaat | bowl
Pakora (Pakistani) | chickpea_flour:40 onion:40 potato:30 oil:15 | pakoray | serving (4)
`);
X('China', 'Chinese', AS, `
Youtiao with soy milk | flour:50 oil:15 soy_milk:250 | fried dough and soy milk | serving
Baozi, pork | flour:60 pork_mince:40 cabbage:15 | pork bun | serving (2)
Baozi, vegetable | flour:60 cabbage:30 mushrooms:20 tofu:20 | veg bun | serving (2)
Mantou | flour:70 sugar:5 | steamed bun | bun
Shaobing | flour:70 sesame:5 oil:10 | sesame flatbread | piece
Tea eggs | egg_boiled:100 soy:5 black_tea:5 | cha ye dan | serving (2)
Rice noodle rolls | rice_flour:60 shrimp:40 soy:10 oil:5 | cheung fun | plate
Sesame balls | sticky_rice:40 kidney:20 sesame:8 oil:10 sugar:10 | jian dui | serving (3)
Spicy cucumber salad | cucumber:150 garlic:3 vinegar:8 sesame_oil:5 chili:2 | pai huang gua | plate
Roasted sweet potato (street) | sweet_potato:200 | kao hong shu | potato
`);
X('Japan', 'Japanese', AS, `
Japanese breakfast set | rice_short:150 salmon:60 miso:12 tofu:30 egg:50 | washoku breakfast | tray
Tamago kake gohan | rice_short:180 egg:50 soy:5 | egg on rice | bowl
Japanese toast with egg | bread:80 egg_fried:50 mayo:8 | tamago toast | serving
Onigiri with tuna mayo | rice_short:120 tuna:30 mayo:8 laver:2 | tuna mayo rice ball | serving (1)
Onigiri with pickled plum | rice_short:120 laver:2 salt:1 | umeboshi rice ball | serving (1)
Taiyaki | flour:40 egg:15 sugar:10 milk:20 kidney:30 | fish shaped cake | piece
Senbei | rice_flour:30 soy:3 | rice crackers | serving
Edamame (Japanese) | edamame:150 salt:1 | salted soybeans | bowl
`);
X('South Korea', 'Korean', AS, `
Gyeran-ppang | flour:40 egg:60 sugar:10 milk:20 | egg bread | piece
Tteokbokki snack cup | rice_short:120 chili_powder:5 sugar:8 fish:20 | rice cake snack | cup
Hotteok with seeds | flour:50 brown_sugar:15 sesame:5 peanuts:5 oil:8 | seed hotteok | piece
Korean corn dog | sausage:50 flour:40 oil:15 sugar:5 | korean hot dog | piece
Bungeoppang | flour:40 egg:15 sugar:10 kidney:30 | korean fish bread | piece
Gim snack | laver:5 sesame_oil:2 salt:0.5 | seasoned laver | pack
`);
X('Thailand', 'Thai', AS, `
Jok | rice:60 pork_mince:40 egg:50 ginger:3 water:250 | thai rice porridge | bowl
Patongo with pandan custard | flour:50 oil:15 milk:60 egg:15 sugar:15 | thai doughnuts | serving
Khao tom | rice:80 pork_mince:40 water:250 garlic:3 | thai rice soup | bowl
Moo ping with sticky rice | pork_loin:100 sticky_rice:120 soy:5 | grilled pork skewers | serving
Khanom krok | rice_flour:40 coconut_milk:50 sugar:10 | coconut pancakes | serving (6)
`);
X('Vietnam', 'Vietnamese', AS, `
Xoi ga | sticky_rice:180 chicken_meat:60 | sticky rice with chicken | plate
Banh mi op la | baguette:80 egg_fried:100 soy:3 | egg banh mi | serving
Banh cuon | rice_flour:60 pork_mince:40 mushrooms:10 | steamed rice rolls | plate
Che chuoi | banana:100 coconut_milk:60 tapioca:15 sugar:10 | banana coconut pudding | bowl
`);
X('Philippines', 'Filipino', AS, `
Pandesal with butter | flour:60 sugar:5 butter:10 | filipino bread rolls | serving (2)
Champorado with tuyo | sticky_rice:60 cocoa_powder:10 sugar:20 milk:50 sardine:30 | chocolate porridge and fish | bowl
Cornsilog | beef_brisket:80 rice:200 egg_fried:50 | corned beef rice egg | plate
Banana cue | banana:150 brown_sugar:20 oil:10 | caramelised banana skewer | serving
Kwek kwek | egg_boiled:60 flour:20 oil:10 | battered quail eggs | serving
Fishballs (Filipino) | fish:60 flour:20 oil:12 | street fishballs | serving (8)
Puto | rice_flour:40 sugar:10 milk:20 | steamed rice cakes | serving (3)
`);
X('Indonesia', 'Indonesian', AS, `
Bubur ayam | rice:60 chicken_meat:60 soy:5 water:250 egg_boiled:25 | chicken rice porridge | bowl
Lontong sayur | rice:150 coconut_milk:60 cabbage:40 egg_boiled:25 | rice cake curry | bowl
Kerupuk | tapioca:20 shrimp:5 oil:5 | shrimp crackers | serving
Klepon | rice_flour:40 brown_sugar:10 coconut_meat:10 | palm sugar rice balls | serving (5)
Lemper | sticky_rice:80 chicken_meat:30 coconut_milk:15 | sticky rice roll | serving (2)
`);
X('Mexico', 'Mexican', NA, `
Huevos a la mexicana | egg:120 tomato:50 onion:20 green_pepper:15 oil:8 corn_tortilla:50 | mexican scrambled eggs | plate
Huevos divorciados | egg_fried:100 salsa:60 corn_tortilla:50 refried:50 | divorced eggs | plate
Molletes con pico | baguette:80 refried:60 cheddar:30 tomato:30 onion:10 | molletes | serving (2)
Tamal with atole | masa:100 chicken_meat:40 milk:200 cornmeal:20 sugar:10 | guajolota style breakfast | serving
Atole | cornmeal:25 milk:200 sugar:15 sp_cinnamon:0.5 | atole de vainilla | cup
Champurrado | cornmeal:25 milk:200 dark_choc:20 sugar:10 | chocolate atole | cup
Esquites | corn:150 mayo:12 feta:10 lime:5 chili_powder:1 | corn cup | cup
Fruta con chile | mango:80 cucumber:60 watermelon:80 lime:5 chili_powder:1 | fruit cup with chili | cup
Pan dulce | flour:50 sugar:15 butter:10 egg:8 | mexican sweet bread | piece
`);
X('Brazil', 'Brazilian', SA, `
Pão na chapa | bread:60 butter:12 | buttered griddled bread | serving
Cuscuz nordestino | cornmeal:80 water:60 butter:8 egg_fried:50 | northeastern couscous | plate
Tapioca with coconut and condensed milk | tapioca:50 coconut_meat:15 condensed:20 | sweet tapioca crepe | piece
Misto quente | bread:70 ham_slice:30 mozzarella:30 butter:5 | ham cheese toastie brazil | sandwich
Pastel de feira | flour:50 oil:15 beef_mince:40 | brazilian fried pastry | piece
Pão de mel | flour:30 honey:15 dark_choc:15 | honey cake brazil | piece
`);
X('Colombia', 'Colombian', SA, `
Calentado | rice:150 kidney:80 egg_fried:50 masa:50 | colombian breakfast leftovers | plate
Huevos pericos with arepa | egg:100 tomato:30 spring_onion:10 oil:5 masa:80 | colombian eggs | plate
Almojábana | cornmeal:30 feta:30 egg:10 milk:10 | colombian cheese bun | piece
Arepa de huevo | masa:80 egg:50 oil:15 | egg arepa | piece
`);
X('Peru', 'Peruvian', SA, `
Pan con chicharrón | baguette:80 pork_belly:70 sweet_potato:40 onion:15 | chicharron sandwich | sandwich
Tamal peruano | masa:120 chicken_meat:40 olives:5 egg_boiled:15 | peruvian tamal | tamal
Quinoa con leche | quinoa:120 milk:150 sugar:12 sp_cinnamon:0.5 | quinoa milk porridge | bowl
Cancha | corn:50 oil:5 salt:1 | toasted corn | handful
`);
X('Argentina', 'Argentine', SA, `
Tostadas with dulce de leche | bread:60 condensed:25 | toast with dulce de leche | serving (2 slices)
Facturas | croissant:60 jam:10 | argentine pastries | pastry
Tostado de jamón y queso | bread:70 ham_slice:30 swiss:25 | argentine toastie | sandwich
`);
X('Australia', 'Australian', OC, `
Vegemite and cheese toast | bread:60 butter:5 vegemite:5 cheddar:20 | vegemite cheese | serving (2 slices)
Big brekkie | egg_fried:100 bacon:30 sausage:60 mushrooms:50 tomato:50 bread:40 avocado:40 | aussie big breakfast | plate
Bacon and egg roll | roll:70 bacon:30 egg_fried:50 bbq:10 | bacon egg roll | roll
Bircher muesli (Australian) | oats:50 apple:50 yogurt:100 oj:30 | aussie bircher | bowl
Banana bread with butter (café) | flour:40 banana:45 sugar:18 butter:20 egg:12 | cafe banana bread | slice
Sausage roll (Australian) | puff_pastry:60 sausage:60 | aussie sausage roll | roll
Tim Tam-style chocolate biscuit | flour:10 dark_choc:12 sugar:5 butter:3 | chocolate biscuit | biscuit
Anzac slice | oats:20 flour:15 coconut_meat:8 butter:10 sugar:10 molasses:5 | anzac bar | piece
`);
X('New Zealand', 'New Zealander', OC, `
Pikelets with jam and cream | flour:40 milk:40 egg:15 sugar:8 jam:15 cream:15 | kiwi pikelets | serving (3)
Mince and cheese pie | pie_crust:70 beef_mince:70 cheddar:25 gravy:30 | nz pie | pie
Kiwifruit snack | kiwi:150 | kiwifruit | serving (2)
`);
X('Morocco', 'Moroccan', AF, `
Harcha with honey | semolina:60 butter:12 milk:30 honey:15 | semolina flatbread | piece
Khlii with eggs | beef:40 egg:100 oil:8 | preserved meat eggs | plate
Amlou on bread | almonds:20 olive_oil:10 honey:10 bread:60 | almond argan spread | serving
Sfenj | flour:60 oil:20 sugar:5 | moroccan doughnut | piece
Mint tea with pastries | green_tea:150 mint:2 sugar:15 flour:20 almonds:10 honey:10 | atay and sweets | serving
`);
X('Egypt', 'Egyptian', AF, `
Egyptian breakfast plate | fava:150 pita:60 egg_boiled:50 feta:30 tomato:40 | ful breakfast set | plate
Eish baladi with tahini | pita:80 tahini:20 | bread and tahini | serving
Feteer with cheese | flour:70 butter:20 feta:40 | savory feteer | slice
Roasted sweet potato (Egyptian street) | sweet_potato:200 | batata | potato
Termes | fava:100 salt:1 | lupini beans | cup
`);
X('Iran', 'Iranian', AS, `
Noon o panir o gerdoo | pita:80 feta:40 walnuts:15 mint:3 | bread cheese walnuts | plate
Haleem (Iranian breakfast) | bulgur:80 turkey:60 sugar:10 butter:8 sp_cinnamon:0.5 | sweet wheat porridge | bowl
Adasi | lentils:200 onion:20 oil:8 | lentil breakfast soup | bowl
Nan-e berenji | rice_flour:30 sugar:15 butter:12 pistachio:3 | rice cookies | serving (3)
`);
X('Israel', 'Israeli', AS, `
Israeli breakfast | egg_fried:100 cucumber:60 tomato:60 cottage:60 bread:60 | israeli breakfast plate | plate
Bourekas with cheese | puff_pastry:60 feta:30 egg:10 | cheese bourekas | serving (2)
Rugelach | flour:30 butter:15 cream_cheese:10 sugar:10 dark_choc:10 | rugelach | serving (2)
Bamba-style peanut puffs | corn:25 peanut_butter:10 | peanut puffs | bag
`);
X('Vietnam', 'Vietnamese', AS, `
Banh bao | flour:60 pork_mince:40 egg_boiled:15 | vietnamese steamed bun | bun
`);
X('Greece', 'Greek', EUR, `
Bougatsa | phyllo:40 semolina:20 milk:80 sugar:15 butter:10 | custard pastry | piece
Koulouri | flour:80 sesame:8 | greek sesame bread ring | ring
Tiropita | phyllo:50 feta:50 egg:15 butter:10 | cheese pie | slice
Greek yogurt with walnuts and honey (breakfast) | greek_yogurt_full:200 walnuts:20 honey:15 | greek breakfast yogurt | bowl
`);
X('Sweden', 'Swedish', EUR, `
Knäckebröd with cheese | rye_bread:30 butter:5 cheddar:20 | crispbread and cheese | serving (2)
Filmjölk with muesli | yogurt:200 oats:30 raisins:10 | swedish sour milk breakfast | bowl
Kardemummabulle | flour:45 butter:15 sugar:12 milk:20 sp_cardamom:1 | cardamom bun | bun
`);


Object.assign(K, { mushroom_gravy: 'Gravy, mushroom, canned', veg_cheese: 'Cheese substitute, mozzarella', coconut_yogurt: 'Yogurt, coconut milk', veg_broth: 'Soup, vegetable broth, ready to serve', jackfruit: 'Jackfruit, raw', vegan_mayo: 'Vegan mayonnaise', oat_milk: 'Oat milk', almond_milk: 'Almond milk, unsweetened', seitan: 'Vital wheat gluten' });
// ======================= ROUND 3: PLANT DISHES, BREAKFASTS AND SNACKS (Americas, Oceania) =======================
X('Canada', 'Canadian', NA, `
Vegan poutine | fries:200 mushroom_gravy:100 veg_cheese:40 | dairy-free poutine | plate
Vegetarian tourtière | pie_crust:80 lentils:80 mushrooms:50 potato:40 onion:20 | lentil meat pie | slice
Vegan Nanaimo bar | dark_choc:15 coconut_oil:12 icing_sugar:20 coconut_meat:10 oats:10 | dairy-free nanaimo | piece
Maple baked beans | kidney:200 maple:20 onion:20 mustard:3 | quebec beans | portion
Wild rice salad | brown_rice:150 cranberry_alt:0 walnuts:15 celery_raw:30 olive_oil:10 | manitoba wild rice salad | bowl
Maple tofu with roasted vegetables | tofu:150 maple:15 soy:8 carrots:60 butternut:80 | maple glazed tofu | plate
Pea soup, vegan (Québec) | split_peas:100 carrots:30 onion:20 water:250 | soupe aux pois végane | bowl
Fiddlehead sauté | asparagus:150 butter:10 garlic:3 | fiddleheads | portion
Bannock with jam | flour:70 butter:10 milk:30 jam:20 | bannock and jam | piece
Maple walnut granola | oats:40 walnuts:15 maple:15 oil:5 | maple granola | serving
Montreal bagel with lox | bagel:90 smoked_salmon:50 cream_cheese:25 | montreal lox bagel | bagel
Caesar salad, Canadian-style kale | kale_raw:80 parmesan:15 olive_oil:12 lemon:8 bread:20 | kale caesar | bowl
Apple maple oatmeal | oats:50 milk:200 apple:60 maple:12 | maple apple porridge | bowl
Peanut butter and banana toast (Canadian café) | wholemeal:60 peanut_butter:25 banana:60 maple:5 | pb banana toast | serving
Maple popcorn | popcorn:25 maple:15 butter:5 | maple kettle corn | bowl
`);
X('Australia', 'Australian', OC, `
Vegan big brekkie | tofu:100 mushrooms:60 tomato:60 baked_beans:100 avocado:50 bread:40 | plant-based big breakfast | plate
Pumpkin and feta salad | pumpkin:200 feta:30 spinach_raw:40 walnuts:10 olive_oil:10 | roast pumpkin salad | bowl
Vegetable pasties | flour:70 butter:20 potato:40 carrots:20 peas:15 | aussie veggie pasty | pasty
Lentil shepherd's pie (Australian) | lentils:150 carrots:40 tomato_canned:60 mash:180 | vegetarian cottage pie | portion
Sweet potato and chickpea curry | sweet_potato:150 chickpeas:100 coconut_milk:60 curry:5 rice:150 | aussie veg curry | plate
Haloumi burger | halloumi:80 burger_bun:60 lettuce:15 tomato:20 | halloumi burger | burger
Acai bowl (Australian café) | banana:100 blueberries:80 granola:30 coconut_meat:10 | acai bowl aussie | bowl
Ricotta hotcakes | flour:50 ricotta:60 egg:30 milk:40 maple:20 | bills style hotcakes | stack (3)
Corn fritters with avocado | corn_canned:100 flour:30 egg:25 oil:12 avocado:50 | aussie corn fritters | plate
Vegemite scroll | flour:60 butter:10 vegemite:5 cheddar:20 | cheesymite scroll | scroll
Muesli bar | oats:25 honey:10 raisins:8 almonds:5 | aussie muesli bar | bar
Fruit toast with butter | bread:60 raisins:15 butter:10 | raisin toast aussie | serving (2 slices)
Iced vovo-style biscuit | flour:15 sugar:8 coconut_meat:4 jam:5 marshmallow:5 | iced biscuit | serving (2)
Golden gaytime-style ice cream | ice_cream:80 shortbread:15 sugar:5 | toffee crumb ice cream | stick
`);
X('New Zealand', 'New Zealander', OC, `
Kūmara and chickpea salad | sweet_potato:180 chickpeas:80 spinach_raw:30 olive_oil:10 | kumara salad | bowl
Vegetarian mince on toast | lentils:120 tomato_canned:60 onion:20 bread:60 | veggie savoury mince | plate
Vegan pavlova | sugar:40 coconut_milk:40 strawberries:50 kiwi:30 | aquafaba pavlova | slice
Cheese rolls (Southland) | bread:60 cheddar:30 milk:15 butter:8 | southland sushi | serving (2)
Kiwi breakfast bowl | kiwi:100 yogurt:150 granola:30 | kiwifruit yogurt bowl | bowl
Louise slice | flour:30 butter:12 sugar:15 jam:12 coconut_meat:10 egg_white:10 | louise cake | piece
`);
X('Brazil', 'Brazilian', SA, `
Feijoada vegana | black_beans:200 sweet_potato:60 tofu:60 kale:40 rice:150 | vegan feijoada | plate
Moqueca de banana | ripe_plantain:200 coconut_milk:80 palm_oil:10 tomato:50 red_pepper:40 rice:150 | plantain moqueca | plate
Couve à mineira | kale:150 garlic:4 oil:10 | brazilian collard greens | portion
Tropeiro de feijão | kidney:150 flour:30 egg:30 kale:40 oil:10 | feijao tropeiro vegetarian | plate
Salada de maionese | potato:150 carrots:30 peas:20 mayo:30 | brazilian potato salad | portion
Vitamina de abacate | avocado:80 milk:200 sugar:15 | avocado shake brazil | glass
Bolo de fubá | cornmeal:40 flour:15 sugar:25 oil:15 egg:15 milk:30 | cornmeal cake | slice
Pamonha | corn:150 sugar:15 milk:30 | sweet corn tamale | piece
Cocada | coconut_meat:50 sugar:30 | brazilian coconut sweet | piece
Pipoca doce | popcorn:25 sugar:15 | sweet popcorn brazil | bowl
Coxinha de jaca | flour:50 jackfruit:50 oil:15 breadcrumbs:10 | jackfruit coxinha | piece
`);
X('Argentina', 'Argentine', SA, `
Empanadas de humita | flour:50 butter:12 corn:50 onion:15 milk:15 | corn empanadas | serving (2)
Empanadas de verdura | flour:50 butter:12 spinach:50 ricotta:20 | spinach empanadas | serving (2)
Tarta de acelga | pie_crust:60 spinach:120 egg:30 cheddar:20 | chard tart | slice
Fainá | chickpea_flour:60 olive_oil:12 water:80 | chickpea flatbread | slice
Provoleta with salad | provolone:80 tomato:60 lettuce:30 olive_oil:5 | grilled provolone plate | plate
Vegan choripán | veggie_patty:90 baguette:80 parsley:3 olive_oil:5 | vegan chori | sandwich
Chipá (Argentine) | tapioca:40 cheddar:20 egg:10 | argentine cheese bread | serving (2)
Pastafrola | flour:40 butter:15 sugar:15 egg:10 jam:30 | quince tart | slice
Mate cocido with milk | green_tea:200 milk:50 sugar:8 | mate cocido | cup
`);
X('Peru', 'Peruvian', SA, `
Quinoa salad (Peruvian) | quinoa:150 tomato:40 cucumber:40 onion:15 lime:8 olive_oil:8 | ensalada de quinua | bowl
Solterito | fava:100 corn:60 feta:30 tomato:40 onion:15 olives:10 | arequipa salad | bowl
Ceviche de champiñones | mushrooms_raw:150 lime:20 onion:20 chili:3 sweet_potato:60 | mushroom ceviche | plate
Tallarines verdes | pasta:200 spinach:60 basil:10 milk:40 feta:25 | peruvian pesto pasta | plate
Ocopa | potato:200 peanuts:20 milk:40 feta:25 | potato in peanut sauce | portion
Rocoto relleno vegetariano | red_pepper:200 potato:50 cheddar:30 egg:20 milk:20 | stuffed rocoto vegetarian | portion
Mazamorra morada | corn:20 pineapple:40 apple:30 sugar:25 cornstarch:10 water:150 | purple corn pudding | bowl
Choclo con queso | corn:150 feta:40 | corn with cheese | plate
Alfajores peruanos | flour:30 cornstarch:15 butter:12 condensed:25 | peruvian alfajores | serving (2)
`);
X('Colombia', 'Colombian', SA, `
Arepa with avocado | masa:90 avocado:60 | arepa con aguacate | arepa
Patacones with hogao | green_plantain:150 oil:15 tomato:60 onion:20 | patacones | plate
Sopa de lentejas colombiana | lentils:150 potato:60 carrots:30 tomato:30 water:200 | colombian lentil soup | bowl
Frijoles con arroz (vegetarian) | kidney:150 rice:150 ripe_plantain:80 avocado:40 | colombian beans and rice | plate
Empanadas colombianas de papa | masa:60 potato:60 oil:15 | potato empanadas | serving (3)
Obleas con arequipe | flour:15 condensed:30 | wafer with dulce de leche | piece
Salpicón de frutas | papaya:60 watermelon:60 banana:40 pineapple:40 oj:60 | colombian fruit cocktail | cup
Aguapanela | brown_sugar:30 water:250 lime:5 | panela water | glass
Chocolate santafereño | milk:200 dark_choc:20 cheddar:20 | hot chocolate with cheese | cup
`);
X('Chile', 'Chilean', SA, `
Porotos con riendas | kidney:150 pasta:60 pumpkin:60 onion:20 oil:8 | beans with noodles | bowl
Pebre with bread | tomato:80 onion:20 coriander:5 olive_oil:8 bread:60 | pebre | serving
Humitas chilenas | corn:180 onion:20 basil:3 butter:8 | chilean humitas | serving (2)
Charquicán vegetariano | potato:150 pumpkin:100 corn:40 peas:30 egg_fried:50 | vegetarian charquican | plate
Calzones rotos | flour:40 sugar:10 oil:15 egg:10 icing_sugar:5 | chilean fried pastries | serving (3)
Mote con huesillo | barley:80 peach:100 sugar:25 water:150 | chilean peach drink | glass
Kuchen de manzana | flour:35 butter:15 sugar:20 apple:60 egg:10 | apple kuchen | slice
`);
X('Ecuador', 'Ecuadorian', SA, `
Locro de papa | potato:200 milk:80 feta:30 avocado:40 | ecuadorian potato soup | bowl
Tigrillo | green_plantain:150 egg:50 feta:30 oil:8 | plantain egg mash | plate
Humitas ecuatorianas | corn:150 feta:20 butter:8 egg:10 | ecuador humitas | serving (2)
Pan de yuca | tapioca:40 feta:30 egg:10 | yuca cheese bread | serving (3)
Colada morada (alcohol-free) | cornmeal:20 blueberries:50 pineapple:40 strawberries:30 sugar:25 water:150 | purple drink | glass
Chifles ecuatorianos | green_plantain:100 oil:15 | ecuador plantain chips | bag
`);
X('Bolivia', 'Bolivian', SA, `
Api with pastel | corn:30 sugar:20 sp_cinnamon:0.5 water:250 flour:40 oil:15 cheddar:15 | api morado | serving
Sopa de quinua | quinoa:80 potato:60 carrots:30 peas:20 water:250 | quinoa soup | bowl
Pique vegetariano | fries:150 egg_boiled:50 tomato:40 onion:20 green_pepper:20 | vegetarian pique | plate
Cuñapé | tapioca:40 cheddar:30 egg:10 | bolivian cheese bread | serving (3)
Llauchas | flour:50 cheddar:30 butter:8 | cheese pastry la paz | piece
`);
X('Venezuela', 'Venezuelan', SA, `
Arepa de dominó | masa:90 black_beans:60 feta:30 | domino arepa | arepa
Arepa vegana | masa:90 black_beans:50 avocado:40 ripe_plantain:50 | vegan arepa | arepa
Pabellón vegetariano | rice:150 black_beans:100 ripe_plantain:80 eggplant:80 oil:10 | vegetarian pabellon | plate
Empanada de queso | masa:60 feta:30 oil:15 | venezuelan cheese empanada | serving (2)
Bienmesabe | coconut_milk:60 egg:20 sugar:25 sponge:30 | coconut sponge dessert | portion
Chicha venezolana | rice:40 milk:150 condensed:25 sp_cinnamon:0.5 | rice milk drink | glass
`);
X('Uruguay', 'Uruguayan', SA, `
Pascualina | pie_crust:70 spinach:120 egg:40 ricotta:30 | spinach egg pie | slice
Bizcochos uruguayos | croissant:50 | uruguayan pastries | pastry
Martín fierro | cheddar:40 jam:30 | cheese and quince | serving
`);
X('Paraguay', 'Paraguayan', SA, `
Mbeyú with cocido | tapioca:50 cheddar:30 milk:40 green_tea:200 sugar:10 | breakfast mbeju | serving
Vori vori vegetariano | cornmeal:40 cheddar:30 pumpkin:60 water:250 | corn ball soup | bowl
Kivevé | pumpkin:200 cornmeal:20 cheddar:25 milk:40 sugar:10 | sweet pumpkin mash | portion
`);
X('Guyana', 'Guyanese', SA, `
Dhal and rice (Guyanese) | split_peas:120 rice:180 turmeric:1 oil:8 garlic:3 | guyana dal rice | plate
Bake and saltfish (Guyanese) | flour:70 oil:15 salt_cod:60 tomato:30 | guyanese bake | serving
Pine tart | puff_pastry:50 pineapple:50 sugar:15 | guyanese pine tart | tart
Vegan cook-up rice | rice:200 kidney:80 coconut_milk:50 spinach:30 pumpkin:40 | guyanese cook up vegan | plate
`);
X('Suriname', 'Surinamese', SA, `
Roti with potato and long beans | flour:80 oil:10 potato:80 green_beans:80 curry:3 | surinamese roti vegetarian | plate
Bakabana with peanut sauce | ripe_plantain:120 flour:25 oil:15 peanut_butter:20 | fried plantain peanut sauce | serving
Pindasoep vegan | peanut_butter:40 cassava_cooked:80 water:250 | peanut soup | bowl
`);
X('Fiji', 'Fijian', OC, `
Dhal soup with rice (Fiji) | red_lentils:100 rice:150 turmeric:1 garlic:3 oil:8 | fiji dhal | plate
Cassava with coconut cream | cassava_cooked:200 coconut_milk:60 | tavioka and lolo | plate
Bele with coconut | spinach:150 coconut_milk:60 onion:15 | fijian greens | portion
Babakau | flour:60 sugar:10 oil:15 | fijian fried bread | piece
Vakalolo | cassava_cooked:120 coconut_milk:40 brown_sugar:20 | fijian pudding | portion
`);
X('Samoa', 'Samoan', OC, `
Koko Samoa | cocoa_powder:15 sugar:15 water:250 | samoan cocoa | cup
Koko alaisa | rice:150 cocoa_powder:10 coconut_milk:40 sugar:15 | cocoa rice porridge | bowl
Fa'apapa | flour:50 coconut_meat:30 sugar:10 coconut_milk:20 | coconut bread | slice
Taro with coconut cream | taro:200 coconut_milk:60 | talo ma lu'au | plate
Vaisalo | coconut_meat:50 tapioca:20 water:150 sugar:10 | coconut porridge | bowl
`);
X('Tonga', 'Tongan', OC, `
Faikakai topai | flour:60 coconut_milk:40 brown_sugar:25 | dumplings in caramel coconut | serving
Manioke with coconut | cassava_cooked:200 coconut_milk:50 | tongan cassava | plate
Lu with vegetables | spinach:120 coconut_milk:60 onion:15 tomato:30 | vegetarian lu | portion
`);
X('Papua New Guinea', 'Papua New Guinean', OC, `
Kaukau and peanut sauce | sweet_potato:200 peanut_butter:25 | sweet potato peanut | plate
Saksak | tapioca:60 banana:60 coconut_milk:40 | sago dumplings | portion
Coconut rice (PNG) | rice:200 coconut_milk:60 | png coconut rice | plate
Kulau | coconut_water:300 | green coconut drink | coconut
`);
X('Solomon Islands', 'Solomon Islander', OC, `
Slippery cabbage with coconut | spinach:150 coconut_milk:60 | solomon greens | portion
Cassava pudding (Solomon) | cassava_cooked:150 coconut_milk:50 sugar:15 | solomon cassava pudding | portion
`);
X('Vanuatu', 'Ni-Vanuatu', OC, `
Banana lap lap | banana:150 cassava_cooked:60 coconut_milk:50 | sweet lap lap | portion
Nalot | taro:150 coconut_milk:40 | pounded taro vanuatu | portion
Island cabbage soup | spinach:120 coconut_milk:50 water:150 | vanuatu greens soup | bowl
`);
X('Kiribati', 'I-Kiribati', OC, `
Kiribati pandanus porridge | breadfruit:120 coconut_milk:40 sugar:10 | te tuae | bowl
Coconut toddy drink (alcohol-free) | coconut_water:250 sugar:10 | kamaimai | glass
`);
X('Marshall Islands', 'Marshallese', OC, `
Jukjuk | rice:150 coconut_meat:30 | coconut rice balls | serving (3)
Banana pancakes (Marshallese) | banana:80 flour:40 egg:20 oil:8 | marshallese pancakes | serving (3)
`);
X('Federated States of Micronesia', 'Micronesian', OC, `
Coconut breadfruit soup | breadfruit:150 coconut_milk:60 water:150 | micronesian soup | bowl
Banana and coconut pudding (Micronesia) | banana:120 coconut_milk:50 tapioca:15 | micronesian dessert | portion
`);
X('Palau', 'Palauan', OC, `
Tama | tapioca:40 coconut_milk:40 sugar:15 | palauan tapioca pudding | portion
Taro leaf soup (Palau) | spinach:120 coconut_milk:50 taro:60 water:150 | palau greens soup | bowl
`);
X('Nauru', 'Nauruan', OC, `
Coconut pancakes (Nauru) | flour:40 coconut_milk:40 sugar:8 oil:5 | nauru pancakes | serving (3)
Breadfruit chips | breadfruit:100 oil:15 | breadfruit crisps | bag
`);
X('Tuvalu', 'Tuvaluan', OC, `
Palusami (Tuvalu) | spinach:120 coconut_milk:70 onion:15 | tuvalu taro leaves | portion
Fekei | taro:150 coconut_milk:40 sugar:15 | tuvalu taro pudding | portion
`);
X('Cook Islands', 'Cook Islander', TE, `
Rukau | spinach:150 coconut_milk:60 onion:15 | taro leaves cook islands | portion
Mainese (Cook Islands) | potato:150 mayo:30 egg_boiled:25 | potato salad rarotonga | portion
`);
X('French Polynesia', 'Tahitian', TE, `
Firi firi | flour:50 coconut_milk:25 sugar:10 oil:15 | tahitian doughnuts | serving (2)
Uru with coconut cream | breadfruit:180 coconut_milk:50 | tahitian breadfruit | plate
`);
X('Guam', 'Chamorro', TE, `
Titiyas | flour:60 coconut_milk:30 sugar:10 butter:5 | chamorro flatbread | piece
Chamorro bonelos aga | banana:100 flour:30 oil:15 sugar:5 | banana doughnuts | serving (3)
Eggplant kelaguen-style salad | eggplant:150 lemon:15 coconut_meat:20 onion:15 | vegan kelaguen | portion
`);
X('New Caledonia', 'New Caledonian', TE, `
Vegetable bougna | yam:120 sweet_potato:80 taro:60 coconut_milk:60 | vegetarian bougna | portion
Pain coco | flour:50 coconut_meat:20 sugar:10 coconut_milk:20 | coconut bread caledonia | slice
`);
X('Niue', 'Niuean', TE, `
Nane pia | tapioca:40 coconut_milk:40 sugar:10 | arrowroot pudding | bowl
Pitako | breadfruit:150 coconut_milk:40 | niue breadfruit | portion
`);
// ---- round 3: Africa ----
X('Algeria', 'Algerian', AF, `
Kesra with olive oil | semolina:80 olive_oil:12 water:40 | algerian flatbread | wedge
Loubia | kidney:200 tomato:60 garlic:4 cumin:1 olive_oil:12 | algerian white bean stew | bowl
Mhadjeb with vegetables | semolina:70 tomato:60 onion:30 red_pepper:30 oil:10 | vegetable mahjouba | piece
Zlabia | flour:30 oil:15 sugar:30 | algerian honey fritter | serving (2)
`);
X('Angola', 'Angolan', AF, `
Feijão com banana | kidney:150 ripe_plantain:120 palm_oil:10 | beans and plantain angola | plate
Quiabos with funge | okra:120 tomato:40 palm_oil:10 cassava_cooked:200 | okra and funge | plate
Ginguba torrada | peanuts:40 | roasted peanuts angola | handful
`);
X('Benin', 'Beninese', AF, `
Atassi | rice:150 cowpeas:80 oil:8 | rice and beans benin | plate
Yovo doko | flour:60 sugar:12 oil:15 | benin doughnuts | serving (3)
`);
X('Botswana', 'Batswana', AF, `
Morogo wa dinawa | spinach:150 cowpeas:60 onion:15 oil:8 | beans leaves botswana | portion
Magwinya with jam | flour:60 oil:15 sugar:5 jam:15 | fat cakes and jam | serving (2)
`);
X('Burkina Faso', 'Burkinabè', AF, `
Gonré | cowpeas:150 oil:10 | bean cakes burkina | serving (3)
Bean fritters with chili (Burkina) | cowpeas:100 oil:15 chili:2 | samsa | serving (4)
`);
X('Burundi', 'Burundian', AF, `
Burundian bean stew with rice | kidney:180 tomato:40 onion:20 palm_oil:8 rice:150 | ibiharage na umuceri | plate
Fried sweet potato (Burundi) | sweet_potato:200 oil:15 | burundi street potato | portion
`);
X('Cabo Verde', 'Cape Verdean', AF, `
Cuscus de milho with milk | cornmeal:70 milk:150 honey:10 | cape verde cornmeal cake | bowl
Pastel de milho | cornmeal:50 oil:15 onion:10 | corn pastry cabo verde | serving (2)
`);
X('Cameroon', 'Cameroonian', AF, `
Koki beans with plantain | cowpeas:150 palm_oil:20 ripe_plantain:100 | koki corn and beans | plate
Puff puff and beans (vegan) | flour:60 oil:15 sugar:5 kidney:120 palm_oil:8 | accra banana beans | plate
Bobolo | cassava_cooked:200 | cassava stick | stick
Bouillie de maïs | cornmeal:50 water:200 sugar:12 peanuts:10 | corn pap cameroon | bowl
`);
X('Central African Republic', 'Central African', AF, `
Peanut stew with greens (CAR) | peanut_butter:35 spinach:100 tomato:40 rice:150 | car peanut greens | plate
Fried plantain with peanut sauce (CAR) | plantain_fried:150 peanut_butter:20 | car plantain | serving
`);
X('Chad', 'Chadian', AF, `
Mandazi tchadien | flour:60 sugar:10 oil:15 | chad doughnuts | serving (2)
Okra and peanut sauce with millet | okra:100 peanut_butter:25 millet:180 | chad okra boule | plate
`);
X('Comoros', 'Comorian', AF, `
Mkatra foutra | flour:70 coconut_milk:40 sugar:8 sesame:5 | comorian breakfast bread | piece
Cassava in coconut (Comoros) | cassava_cooked:200 coconut_milk:60 | mhogo wa nazi | bowl
`);
X('Democratic Republic of the Congo', 'Congolese (DRC)', AF, `
Mikate | flour:60 sugar:10 oil:15 | congolese doughnuts | serving (3)
Pondu with rice (vegan) | spinach:200 palm_oil:15 onion:20 peanut_butter:15 rice:150 | vegan pondu | plate
`);
X('Republic of the Congo', 'Congolese', AF, `
Beignets congolais | flour:60 sugar:10 oil:15 | congo beignets | serving (3)
Saka saka with rice (vegan) | spinach:150 palm_oil:15 peanut_butter:20 rice:150 | vegan saka saka | plate
`);
X('Djibouti', 'Djiboutian', AF, `
Djiboutian lentils with bread | lentils:180 onion:20 tomato:30 oil:8 bread:50 | djibouti lentils | plate
Sweet laxoox with honey | flour:70 water:80 honey:15 | sweet canjeero | serving (2)
`);
X('Equatorial Guinea', 'Equatoguinean', AF, `
Cassava with palm oil and greens | cassava_cooked:200 spinach:100 palm_oil:12 | equatorial greens | plate
Fried plantain (Equatorial Guinea) | plantain_fried:200 | platano frito | serving
`);
X('Eritrea', 'Eritrean', AF, `
Shiro tegamino | chickpea_flour:70 onion:30 oil:15 tomato:30 water:150 | eritrean shiro pot | bowl
Himbasha | flour:70 sugar:10 oil:10 sp_cardamom:1 | eritrean celebration bread | slice
`);
X('Eswatini', 'Swazi', AF, `
Incwancwa | cornmeal:60 water:250 sugar:10 | sour porridge | bowl
Emasi with pap | cornmeal:80 water:180 yogurt:150 | sour milk pap | bowl
`);
X('Gabon', 'Gabonese', AF, `
Gabonese peanut soup (vegan) | peanut_butter:40 tomato:50 spinach:60 water:200 | vegan peanut soup gabon | bowl
Banane pesée | plantain:200 oil:10 | boiled plantain gabon | serving
`);
X('The Gambia', 'Gambian', AF, `
Akara (Gambian) with bread | cowpeas:100 oil:15 bread:60 | gambian akara sandwich | serving
Monkey bread juice | yogurt:100 sugar:20 water:150 | baobab drink | glass
`);
X('Guinea', 'Guinean', AF, `
Fonio with peanut sauce | fonio:60 peanut_butter:30 tomato:40 | guinea fonio | plate
Guinean ginger juice | ginger:20 sugar:25 water:250 lemon:5 | gnamakoudji | glass
`);
X('Guinea-Bissau', 'Bissau-Guinean', AF, `
Bissau cashew snack | cashews:40 | roasted cashews bissau | handful
Arroz de coco | rice:200 coconut_milk:60 | coconut rice bissau | plate
`);
X('Lesotho', 'Basotho', AF, `
Motoho | sorghum:60 water:250 sugar:10 | fermented sorghum porridge | bowl
Lesotho bean salad | kidney:150 onion:15 tomato:30 oil:8 | basotho beans | portion
`);
X('Liberia', 'Liberian', AF, `
Liberian rice bread with butter | rice_flour:40 banana:40 sugar:15 oil:10 butter:8 | rice bread slice | slice
Plantain chips (Liberian) | green_plantain:100 oil:15 | liberian chips | bag
Kanyan | peanuts:30 rice_flour:20 sugar:15 | liberian peanut candy | piece
`);
X('Libya', 'Libyan', AF, `
Sfinz | flour:60 oil:20 | libyan doughnut | piece
Libyan chickpeas with cumin | chickpeas:180 olive_oil:10 cumin:1 lemon:5 | hummus mutabbal libya | bowl
`);
X('Madagascar', 'Malagasy', AF, `
Vary amin'anana | rice:80 spinach:80 water:200 | rice greens porridge | bowl
Mokary | rice_flour:50 coconut_milk:40 sugar:10 | malagasy rice cakes | serving (3)
Achards de légumes | cabbage:60 carrots_raw:40 green_beans:30 vinegar:10 oil:8 turmeric:1 | malagasy pickled veg | portion
`);
X('Malawi', 'Malawian', AF, `
Nsima with mpiru | cornmeal:110 water:220 spinach:120 tomato:30 | nsima and greens | plate
Phala | cornmeal:50 water:200 sugar:10 peanuts:15 | malawi porridge | bowl
`);
X('Mali', 'Malian', AF, `
Dégué | millet:60 yogurt:150 sugar:15 | millet yogurt mali | bowl
Malian bean fritters | cowpeas:100 oil:15 onion:10 | samsa mali | serving (4)
`);
X('Mauritania', 'Mauritanian', AF, `
Lakh with milk (Mauritania) | millet:60 milk:150 sugar:10 | mauritanian lakh | bowl
Zrig | yogurt:200 sugar:15 water:100 | mauritanian milk drink | glass
`);
X('Mauritius', 'Mauritian', AF, `
Farata with curry | flour:80 oil:12 kidney:80 curry:3 | mauritian farata | plate
Gâteau patate | sweet_potato:100 flour:20 coconut_meat:15 sugar:12 oil:12 | sweet potato cakes | serving (3)
Alouda | milk:200 tapioca:15 sugar:20 | mauritian milk drink | glass
`);
X('Mozambique', 'Mozambican', AF, `
Bolo polana | cashews:40 potato:40 sugar:25 butter:15 egg:15 | cashew potato cake | slice
Matapa with rice (vegan) | spinach:150 peanuts:30 coconut_milk:60 rice:150 | vegan matapa | plate
`);
X('Namibia', 'Namibian', AF, `
Oshifima with beans | millet:200 cowpeas:100 oil:5 | mahangu and beans | plate
Namibian vetkoek | flour:70 oil:20 | namibian fat cake | piece
`);
X('Niger', 'Nigerien', AF, `
Masa (Niger) | rice:80 sugar:8 oil:10 | rice cakes niger | serving (4)
Kopto salad | spinach:120 peanuts:25 onion:15 tomato:20 | moringa salad | bowl
`);
X('Rwanda', 'Rwandan', AF, `
Ibihaza | pumpkin:200 kidney:80 palm_oil:8 | pumpkin and beans | bowl
Akabanga-spiced beans | kidney:180 chili:3 oil:8 onion:15 | rwandan chili beans | bowl
Ikivuguto | yogurt:250 | rwandan fermented milk | glass
`);
X('São Tomé and Príncipe', 'Santomean', AF, `
Fried breadfruit (São Tomé) | breadfruit:150 oil:15 | fruta-pão frita | serving
Cocoa porridge | cornmeal:40 cocoa_powder:10 milk:150 sugar:15 | santomean cocoa porridge | bowl
`);
X('Senegal', 'Senegalese', AF, `
Ndambé | cowpeas:180 tomato:40 onion:20 oil:12 baguette:60 | bean sandwich senegal | sandwich
Fataya | flour:50 oil:15 beef_mince:40 onion:10 | senegalese fried pies | serving (3)
Bissap | roselle:10 sugar:25 water:250 mint:2 | senegalese hibiscus | glass
Bouye | yogurt:100 sugar:20 water:150 | baobab juice | glass
`);
X('Seychelles', 'Seychellois', AF, `
Breadfruit chips (Seychelles) | breadfruit:100 oil:15 | seychelles chips | bag
Lentil curry (Seychelles) | lentils:180 coconut_milk:40 curry:3 rice:150 | seychelles dal | plate
`);
X('Sierra Leone', 'Sierra Leonean', AF, `
Akara (Sierra Leone) | rice_flour:40 banana:50 sugar:10 oil:15 | rice akara salone | serving (4)
Ginger beer (Salone, alcohol-free) | ginger:20 sugar:25 water:250 | salone ginger beer | glass
`);
X('Somalia', 'Somali', AF, `
Canjeero with tea | flour:70 water:80 black_tea:200 sugar:10 | lahoh breakfast | serving
Bariis with vegetables | rice:200 carrots:40 peas:30 raisins:10 oil:12 | somali vegetable rice | plate
Somali shaah | black_tea:200 milk:50 sugar:12 sp_cardamom:0.5 | somali spiced tea | cup
`);
X('South Sudan', 'South Sudanese', AF, `
Asida | sorghum:80 water:200 | sorghum dough | portion
Bean stew with kisra (South Sudan) | kidney:150 sorghum:60 peanut_butter:20 | south sudan beans | plate
`);
X('Sudan', 'Sudanese', AF, `
Tamiya (Sudanese) | chickpeas:120 onion:15 oil:15 | sudanese falafel | serving (4)
Balila | chickpeas:180 oil:8 cumin:1 | boiled chickpeas sudan | bowl
Shai bil laban | black_tea:150 milk:100 sugar:12 | sudanese milk tea | cup
`);
X('Tanzania', 'Tanzanian', AF, `
Chipsi mayai | fries:150 egg:100 oil:8 | chips omelette | plate
Maharagwe | kidney:180 coconut_milk:50 onion:20 tomato:30 | tanzanian coconut beans | bowl
Mkate wa kumimina | rice_flour:50 coconut_milk:40 sugar:12 | zanzibar rice bread | slice
`);
X('Togo', 'Togolese', AF, `
Akassa with fried fish | cornmeal:100 water:150 fish:100 oil:10 | togo akassa | plate
Togolese peanut cookies | peanuts:30 flour:20 sugar:10 | kluiklui | serving
`);
X('Tunisia', 'Tunisian', AF, `
Bsissa | barley:50 sugar:15 olive_oil:8 water:100 | tunisian barley breakfast | bowl
Vegetable ojja | egg:100 tomato:100 red_pepper:50 olive_oil:10 | vegetable ojja | plate
Makroudh (Tunisian) | semolina:60 dates:40 oil:20 honey:15 | tunisian date cookie | serving (2)
`);
X('Uganda', 'Ugandan', AF, `
Rolex (Ugandan) | flour:60 oil:10 egg:100 tomato:30 cabbage:30 | ugandan rolex | roll
Kikomando | flour:70 oil:10 kidney:150 | chapati and beans | plate
Groundnut paste on bread | bread:60 peanut_butter:30 | g-nut paste bread | serving
`);
X('Zambia', 'Zambian', AF, `
Kalembula | spinach:150 peanuts:20 tomato:30 | sweet potato leaves | portion
Zambian fritters | flour:60 sugar:10 oil:15 | vitumbuwa | serving (3)
`);
X('Zimbabwe', 'Zimbabwean', AF, `
Bota | cornmeal:50 water:200 peanut_butter:20 sugar:8 | zimbabwe porridge | bowl
Maputi | corn:40 | popped maize | bowl
Mufushwa greens with sadza | kale:150 tomato:30 oil:8 cornmeal:110 water:220 | dried greens and sadza | plate
`);
X('Western Sahara', 'Sahrawi', TE, `
Sahrawi lentil stew | lentils:180 onion:20 tomato:30 oil:8 | sahrawi lentils | bowl
Dates with milk, Sahrawi | dates:40 milk:200 | dates and milk | serving
`);
// ---- round 3: Asia ----
X('Afghanistan', 'Afghan', AS, `
Sheer chai | green_tea:150 milk:120 sugar:10 sp_cardamom:0.5 | afghan milk tea | cup
Afghan breakfast eggs (tukhm-e-banjan-e-rumi) | egg:100 tomato:100 onion:20 oil:10 | eggs with tomato | plate
Kachalo bolani | flour:70 potato:80 oil:15 | potato bolani | piece
Banjan borani | eggplant:200 yogurt:80 tomato:40 oil:15 | eggplant with yogurt | portion
`);
X('Armenia', 'Armenian', AS, `
Lavash with cheese and herbs | flour:60 feta:40 parsley:10 | lavash breakfast | serving
Jingalov hats | flour:70 spinach:80 parsley:10 oil:8 | herb flatbread | piece
Gata with tea | flour:40 butter:20 sugar:15 black_tea:200 | gata and tea | serving
`);
X('Azerbaijan', 'Azerbaijani', AS, `
Kuku (Azerbaijani) | egg:100 spinach:60 parsley:10 oil:8 | herb omelette | slice
Gogal | flour:50 butter:15 sp_fennel:1 | turmeric pastry | piece
Shakarbura | flour:30 butter:12 almonds:15 sugar:15 | almond pastry | piece
`);
X('Bahrain', 'Bahraini', AS, `
Khubz with cheese and honey | pita:70 feta:30 honey:10 | bahraini breakfast | serving
Bahraini balaleet | pasta:100 sugar:20 egg:50 butter:10 | sweet vermicelli bahrain | plate
`);
X('Bangladesh', 'Bangladeshi', AS, `
Paratha and dal (Bangladeshi) | flour:80 ghee:12 lentils:120 | porota dal | plate
Chotpoti | chickpeas:120 potato:50 egg_boiled:25 tamarind:10 onion:15 | bangladeshi chaat | bowl
Fuchka | flour:30 oil:10 chickpeas:40 potato:30 tamarind:10 | bangladeshi pani puri | serving (6)
Shingara | flour:50 potato:60 peanuts:10 oil:15 | bengali samosa | serving (2)
Khichuri with egg | rice:80 lentils:50 egg_boiled:50 oil:10 | rainy day khichuri | plate
`);
X('Bhutan', 'Bhutanese', AS, `
Ema datshi | chili:120 cheddar:50 onion:20 butter:5 | chili cheese bhutan | portion
Suja | black_tea:150 butter:10 milk:50 salt:1 | butter tea | cup
Zaow | rice:60 butter:5 | fried rice snack bhutan | bowl
`);
X('Brunei', 'Bruneian', AS, `
Kuih cincin | rice_flour:40 brown_sugar:15 oil:12 | ring cookies | serving (3)
Pulut panggang | sticky_rice:100 coconut_milk:20 dried_shrimp:5 | grilled sticky rice | piece
`);
X('Cambodia', 'Cambodian', AS, `
Num banh chok samlor proher (vegetarian) | rice_noodles:180 coconut_milk:40 cucumber:30 green_beans:30 | khmer noodles vegetarian | bowl
Nom krok | rice_flour:40 coconut_milk:50 spring_onion:5 | khmer coconut cakes | serving (6)
Num pang | baguette:80 pickles:20 cucumber:20 tofu:40 | khmer sandwich | sandwich
`);
X('Georgia', 'Georgian', AS, `
Adjarian khachapuri | flour:90 mozzarella:60 feta:30 egg:50 butter:10 | boat khachapuri | piece
Imeruli khachapuri | flour:90 mozzarella:60 feta:30 | cheese bread | slice (2)
Mchadi | cornmeal:80 water:40 | corn cake georgia | piece
Lobiani | flour:90 kidney:80 onion:15 oil:8 | bean bread | slice (2)
Churchkhela-style nut sweet | walnuts:20 raisins:20 flour:5 | nut sweet | piece
`);
X('Hong Kong', 'Hong Kong', TE, `
French toast (Hong Kong) | bread:80 egg:40 peanut_butter:15 oil:15 maple:15 | hk french toast | serving
Egg waffle | flour:50 egg:30 sugar:15 milk:40 | gai daan zai | waffle
Cheung fun with sauce | rice_flour:60 soy:10 sesame:3 hoisin:10 | rice noodle roll street | plate
Curry fish balls | fish:80 flour:15 curry:3 | hk fishball | stick
`);
X('Iraq', 'Iraqi', AS, `
Kahi with date syrup | flour:60 butter:20 molasses:20 | iraqi pastry with dibis | serving
Bagila bil dihin | fava:150 bread:60 egg_fried:50 butter:10 | fava bread breakfast | plate
Iraqi falafel sandwich | chickpeas:100 oil:15 pita:70 tomato:20 pickles:10 | iraqi falafel | sandwich
`);
X('Jordan', 'Jordanian', AS, `
Jordanian falafel and hummus breakfast | chickpeas:100 oil:15 hummus:60 pita:70 | jordanian breakfast | plate
Mutabbal | eggplant:150 tahini:20 yogurt:20 lemon:5 | smoky eggplant dip | portion
Mujaddara (Jordanian) | lentils:150 bulgur:80 onion:50 olive_oil:15 | lentil bulgur | plate
`);
X('Kazakhstan', 'Kazakh', AS, `
Kazakh milk tea with baursak | black_tea:150 milk:80 flour:40 oil:10 | shai and baursak | serving
Pumpkin manty | flour:60 pumpkin:80 onion:15 butter:8 | pumpkin manty | serving (3)
`);
X('Kuwait', 'Kuwaiti', AS, `
Gers ogaily | flour:35 sugar:20 egg:20 sp_cardamom:0.5 sesame:3 | kuwaiti cake | slice
Nakhi | chickpeas:180 cumin:1 lemon:5 | kuwaiti chickpeas | bowl
`);
X('Kyrgyzstan', 'Kyrgyz', AS, `
Kattama | flour:70 butter:15 onion:20 | kyrgyz layered bread | piece
Samsa with pumpkin | flour:50 pumpkin:60 onion:15 butter:8 | pumpkin samsa | serving (2)
`);
X('Laos', 'Lao', AS, `
Khao niao with jaew | sticky_rice:150 tomato:40 chili:5 garlic:3 | sticky rice and dip | plate
Lao papaya salad (vegan) | papaya:150 tomato:30 lime:10 soy:8 chili:3 peanuts:10 | tam mak hoong vegan | plate
Khao jee sandwich, vegetarian | baguette:80 cucumber:30 carrots_raw:20 tofu:40 | lao baguette | sandwich
`);
X('Malaysia', 'Malaysian', AS, `
Nasi lemak (vegetarian) | rice:180 coconut_milk:40 peanuts:15 cucumber:30 egg_boiled:50 chili:5 | vegetarian nasi lemak | plate
Roti telur | flour:80 ghee:12 egg:50 | egg roti canai | piece
Kaya toast (Malaysian) | bread:60 butter:10 jam:20 | roti bakar kaya | serving
Apam balik | flour:50 sugar:15 peanuts:15 butter:8 | peanut pancake turnover | piece
Kuih keria | sweet_potato:80 flour:15 sugar:15 oil:12 | sweet potato doughnuts | serving (3)
Cucur udang | flour:50 shrimp:30 bean_sprouts:20 oil:15 | prawn fritters | serving (3)
`);
X('Maldives', 'Maldivian', AS, `
Roshi with mashuni | flour:70 tuna:50 coconut_meat:30 onion:10 | maldivian breakfast | plate
Gulha | flour:40 tuna:30 coconut_meat:15 oil:12 | fish balls maldives | serving (4)
Kulhi boakibaa | rice:60 tuna:50 coconut_meat:20 oil:8 | spicy fish cake | slice
`);
X('Mongolia', 'Mongolian', AS, `
Boortsog with milk tea | flour:50 oil:12 sugar:5 milk:150 green_tea:100 | boortsog breakfast | serving
Vegetable buuz | flour:60 cabbage:50 potato:30 onion:15 | veggie dumplings mongolia | serving (4)
`);
X('Myanmar', 'Burmese', AS, `
Mohinga (vegetarian) | rice_noodles:150 chickpea_flour:20 banana:0 onion:30 lemongrass:5 water:300 | vegetarian mohinga | bowl
Burmese tofu salad | chickpea_flour:60 cucumber:40 onion:15 peanuts:10 soy:5 | shan tofu salad | plate
Htamin jin | rice:180 tomato:60 potato:40 oil:10 | fermented rice balls | serving (3)
Mont lone yay paw | sticky_rice:60 brown_sugar:15 coconut_meat:10 | jaggery rice balls | serving (5)
`);
X('Nepal', 'Nepali', AS, `
Vegetable momo | flour:60 cabbage:60 carrots:20 onion:15 oil:5 | veg momo | serving (8)
Dal bhat (vegan) | lentils:150 rice:200 spinach:60 oil:8 | vegan dal bhat | plate
Chiura with yogurt | rice:60 yogurt:150 sugar:10 | beaten rice with curd | bowl
Aloo sandeko | potato:180 oil:10 chili:2 sesame:3 | nepali spiced potato | portion
Juju dhau | yogurt:200 sugar:10 | king curd | cup
`);
X('North Korea', 'North Korean', AS, `
Kimchi rice (North Korean) | rice:200 kimchi:60 sesame_oil:3 | north korean kimchi bap | plate
Potato pancakes (North Korean) | potato:150 oil:12 | gamja jeon north | serving (3)
`);
X('Oman', 'Omani', AS, `
Omani khubz ragag with egg | flour:40 egg:50 oil:5 | omani crepe bread | serving
Chickpea dango | chickpeas:180 lemon:5 | omani boiled chickpeas | bowl
Kahwa with dates | coffee:100 dates:30 sp_cardamom:0.5 | omani coffee | serving
`);
X('Palestine', 'Palestinian', AS, `
Zaatar and olive oil with bread | pita:70 olive_oil:15 sp_thyme:3 sesame:3 | zeit and zaatar | serving
Hummus msabaha | chickpeas:150 tahini:20 olive_oil:10 lemon:5 | warm whole chickpea hummus | bowl
Ka'ak with falafel | flour:70 sesame:8 chickpeas:60 oil:12 | jerusalem kaak falafel | sandwich
`);
X('Qatar', 'Qatari', AS, `
Qatari regag with cheese | flour:40 feta:30 oil:5 | regag cheese | serving
Khanfaroosh | flour:30 rice_flour:20 sugar:15 egg:15 oil:12 sp_cardamom:0.5 | qatari fritters | serving (3)
`);
X('Saudi Arabia', 'Saudi', AS, `
Ful with tamees | fava:180 olive_oil:10 cumin:1 flour:60 | saudi ful breakfast | plate
Shakshuka (Saudi) | egg:100 tomato:120 onion:20 oil:10 | saudi eggs tomato | plate
Masoob | bread:60 banana:100 honey:15 cream:20 | banana bread pudding saudi | bowl
Saudi coffee with dates | coffee:100 dates:30 sp_cardamom:0.5 | gahwa and dates | serving
`);
X('Singapore', 'Singaporean', AS, `
Chwee kueh | rice_flour:60 water:40 oil:8 radish_alt:0 | steamed rice cakes | serving (4)
Prata with curry | flour:80 ghee:12 lentils:80 | roti prata | plate
Ondeh ondeh | sticky_rice:40 brown_sugar:15 coconut_meat:10 | pandan balls | serving (5)
`);
X('Sri Lanka', 'Sri Lankan', AS, `
Kiribath with lunu miris | rice:180 coconut_milk:50 onion:15 chili:3 | milk rice | slice (2)
Pol roti | flour:60 coconut_meat:30 onion:10 | coconut roti | piece
Egg hoppers | rice_flour:60 coconut_milk:40 egg:50 | appa with egg | serving (2)
Vadai (Sri Lankan) | split_peas:80 onion:15 oil:15 | parippu vadai | serving (3)
Kokis | rice_flour:40 coconut_milk:20 oil:15 | sri lankan crisp cookie | serving (3)
`);
X('Syria', 'Syrian', AS, `
Syrian breakfast spread | pita:70 labneh_alt:0 yogurt:80 olives:20 tomato:40 olive_oil:8 | syrian breakfast | plate
Fatayer bi sabanekh | flour:60 spinach:80 onion:15 olive_oil:10 lemon:5 | spinach pies | serving (3)
Ma'amoul | semolina:40 butter:15 dates:25 | date cookies | serving (2)
`);
X('Taiwan', 'Taiwanese', AS, `
Taiwanese soy milk breakfast | soy_milk:300 flour:40 oil:12 | dou jiang and youtiao | serving
Fan tuan | sticky_rice:150 egg:30 flour:20 oil:10 | rice ball roll | roll
Taiwanese fried chicken cutlet | chicken_breast:150 flour:20 oil:20 | ji pai | piece
Pineapple cake (Taiwan) | flour:30 butter:15 sugar:10 pineapple:30 | feng li su | piece
`);
X('Tajikistan', 'Tajik', AS, `
Non with tea and jam | flour:80 black_tea:200 jam:20 | tajik breakfast | serving
Kurutob vegetarian | flour_tortilla:70 yogurt:100 tomato:60 onion:20 cucumber:40 oil:8 | vegetarian qurutob | plate
`);
X('Timor-Leste', 'Timorese', AS, `
Tukir | cassava_cooked:150 coconut_milk:40 | timor cassava | portion
Timorese coffee with bread | coffee:200 sugar:10 bread:60 | timor breakfast | serving
`);
X('Turkmenistan', 'Turkmen', AS, `
Chorek | flour:80 oil:5 | turkmen bread | piece
Pishme | flour:50 oil:15 sugar:5 | turkmen fried dough | serving (4)
`);
X('United Arab Emirates', 'Emirati', AS, `
Khameer | flour:60 sugar:10 milk:30 dates:20 | emirati bread | piece
Luqaimat with date syrup | flour:40 oil:15 molasses:20 sesame:3 | emirati sweet dumplings | serving (5)
Emirati breakfast with eggs and tomato | egg:100 tomato:80 onion:20 oil:8 pita:60 | emirati eggs | plate
`);
X('Uzbekistan', 'Uzbek', AS, `
Non with kaymak and honey | flour:80 cream:30 honey:15 | uzbek breakfast | serving
Samsa with pumpkin (Uzbek) | flour:60 pumpkin:80 onion:20 butter:8 | uzbek pumpkin samsa | serving (2)
Achichuk | tomato:150 onion:40 cucumber:50 | uzbek salad | portion
`);
X('Yemen', 'Yemeni', AS, `
Malawah | flour:80 butter:20 | yemeni flaky bread | piece
Ful Yemeni | fava:180 tomato:40 onion:20 oil:10 | yemeni ful | bowl
Shakshouka (Yemeni) | egg:100 tomato:100 green_pepper:30 oil:10 | yemeni eggs | plate
Yemeni tea with milk | black_tea:150 milk:80 sugar:12 sp_cardamom:0.5 | shai haleeb | cup
`);
// ---- round 3: Europe ----
X('Albania', 'Albanian', EUR, `
Petulla | flour:60 oil:15 feta:20 | albanian fried dough | serving (3)
Jani me fasule | kidney:200 onion:20 tomato_paste:10 oil:12 mint:2 | albanian bean soup | bowl
Trileçe | sponge:50 milk:60 condensed:20 cream:20 | tres leches albania | slice
`);
X('Andorra', 'Andorran', EUR, `
Coca de recapte | flour:60 red_pepper:40 eggplant:40 onion:20 olive_oil:10 | catalan vegetable flatbread | slice
Crema catalana | milk:120 egg:25 sugar:20 cornstarch:5 | catalan cream | ramekin
`);
X('Austria', 'Austrian', EUR, `
Semmel with butter and jam | roll:60 butter:10 jam:20 | austrian breakfast roll | roll
Käsekrainer | sausage:100 cheddar:15 roll:50 mustard:5 | cheese sausage | serving
Topfenstrudel | phyllo:30 cottage:80 sugar:15 egg:10 raisins:10 | quark strudel | slice
Liptauer on bread | rye_bread:50 cottage:60 butter:10 paprika:1 | liptauer spread | serving
Krautfleckerl | pasta:150 cabbage:120 onion:20 oil:10 | cabbage pasta | plate
Gemüselaibchen | potato:100 carrots:40 zucchini:40 egg:15 breadcrumbs:15 oil:12 | vegetable patties | serving (3)
`);
X('Belarus', 'Belarusian', EUR, `
Syrniki (Belarusian) | cottage:120 flour:20 egg:20 sugar:10 oil:10 | belarus cottage pancakes | serving (3)
Babka (potato) | potato:200 onion:20 egg:20 oil:10 | potato bake belarus | slice
Kholodnik | beets:100 kefir:200 cucumber:40 egg_boiled:25 | cold beet soup belarus | bowl
`);
X('Belgium', 'Belgian', EUR, `
Liège waffle | flour:50 butter:15 sugar:15 egg:10 | gaufre de liege | waffle
Belgian fries with mayonnaise | fries:200 mayo:30 | frites | cone
Chicons au gratin, vegetarian | celery:150 milk:80 cheddar:30 butter:8 flour:8 | endive gratin | portion
Pistolet with chocolate spread | roll:60 nutella:20 | belgian breakfast roll | roll
Stoemp | potato:180 carrots:50 leeks:40 butter:10 | belgian mash | portion
`);
X('Bosnia and Herzegovina', 'Bosnian', EUR, `
Sirnica | phyllo:60 cottage:60 egg:15 oil:10 | cheese pie bosnia | slice
Zeljanica | phyllo:60 spinach:80 cottage:30 oil:10 | spinach pie bosnia | slice
Krompiruša | phyllo:60 potato:80 onion:15 oil:10 | potato pie bosnia | slice
Bosnian coffee with lokum | coffee:60 sugar:15 | bosanska kafa | serving
`);
X('Bulgaria', 'Bulgarian', EUR, `
Mekitsi | flour:60 yogurt:20 oil:15 icing_sugar:5 | bulgarian fried dough | serving (2)
Kachamak | cornmeal:60 water:200 feta:30 butter:8 | bulgarian polenta | bowl
Lyutenitsa on bread | bread:60 red_pepper:50 tomato:30 oil:8 | lyutenitsa toast | serving
Gyuvech, vegetarian | potato:80 eggplant:60 red_pepper:50 tomato:60 okra:30 oil:12 | vegetable gyuvech | bowl
Boza | millet:40 sugar:20 water:250 | bulgarian millet drink | glass
`);
X('Croatia', 'Croatian', EUR, `
Burek sa sirom | phyllo:60 cottage:60 oil:12 | croatian cheese burek | slice
Fritule | flour:40 egg:10 raisins:10 oil:15 sugar:8 | croatian doughnuts | serving (5)
Blitva | spinach:150 potato:100 olive_oil:12 garlic:3 | chard and potatoes | portion
Zagorski štrukli | flour:50 cottage:60 cream:20 | baked cheese strukli | portion
`);
X('Cyprus', 'Cypriot', EUR, `
Halloumi and tomato breakfast | halloumi:60 tomato:60 cucumber:50 olives:15 bread:50 | cypriot breakfast | plate
Louvana | split_peas:150 onion:20 olive_oil:12 lemon:5 | yellow split pea puree | bowl
Pourgouri | bulgur:150 tomato:40 onion:20 olive_oil:10 | cypriot bulgur pilaf | plate
`);
X('Czechia', 'Czech', EUR, `
Smažený sýr | gouda:100 flour:10 egg:15 breadcrumbs:20 oil:15 fries:120 | fried cheese | plate
Chlebíček | baguette:30 potato:20 mayo:10 ham_slice:15 egg_boiled:15 | open sandwich czech | piece
Ovocné knedlíky | flour:60 cottage:30 strawberries:60 butter:10 sugar:10 | fruit dumplings | serving (3)
Bramborová polévka | potato:150 carrots:30 mushrooms:30 water:250 | czech potato soup | bowl
Koláče with poppy seed | flour:50 sugar:12 butter:10 milk:15 | czech poppy kolache | serving (2)
`);
X('Denmark', 'Danish', EUR, `
Rugbrød with cheese | rye_bread:50 butter:5 cheddar:25 | danish rye with cheese | piece
Smørrebrød with potato | rye_bread:50 butter:5 potato:60 mayo:10 onion:5 | potato open sandwich | piece
Risalamande | rice:60 milk:100 cream:40 almonds:10 sugar:10 | danish rice pudding | bowl
Øllebrød (alcohol-free) | rye_bread:80 water:150 sugar:15 milk:50 | rye bread porridge | bowl
`);
X('Estonia', 'Estonian', EUR, `
Hapukapsasupp | sauerkraut:120 potato:60 barley:20 water:250 | sauerkraut soup estonia | bowl
Kohuke | cottage:50 sugar:10 dark_choc:15 | curd snack bar | bar
Kringel | flour:50 butter:15 sugar:12 sp_cardamom:0.5 | estonian sweet braid | slice
`);
X('Finland', 'Finnish', EUR, `
Puuro with berries | oats:50 water:250 blueberries:50 butter:5 | finnish porridge | bowl
Korvapuusti | flour:45 butter:15 sugar:12 milk:20 sp_cinnamon:1 | slapped ear cinnamon bun | bun
Ruisleipä with cheese and cucumber | rye_bread:60 butter:5 cheddar:20 cucumber:30 | finnish rye breakfast | serving
Pinaattiletut | flour:40 milk:100 egg:30 spinach:50 butter:8 | spinach pancakes | serving (3)
`);
X('Hungary', 'Hungarian', EUR, `
Pogácsa | flour:50 butter:15 cheddar:15 sour_cream:10 | cheese scones hungary | serving (3)
Kakaós csiga | flour:50 butter:12 sugar:12 cocoa_powder:5 milk:20 | cocoa roll | piece
Főzelék with lentils | lentils:180 flour:8 oil:8 sour_cream:20 | lencsefozelek | bowl
Rakott krumpli, vegetarian | potato:200 egg_boiled:50 sour_cream:50 butter:8 | layered potatoes | portion
`);
X('Iceland', 'Icelandic', EUR, `
Hafragrautur | oats:50 water:250 milk:50 raisins:10 | icelandic porridge | bowl
Flatkaka with butter | rye_bread:50 butter:10 | icelandic flatbread | piece
Pönnukökur | flour:40 milk:100 egg:25 sugar:10 butter:8 | icelandic crepes | serving (3)
`);
X('Ireland', 'Irish', EUR, `
Irish porridge with honey | oats:50 milk:200 honey:12 | irish oatmeal | bowl
Vegetarian full Irish | egg_fried:100 potato:80 mushrooms:60 tomato:60 baked_beans:100 bread:40 | veggie full irish | plate
Potato farls | potato:120 flour:30 butter:8 | potato bread | serving (2)
Tayto-style cheese and onion crisps | potato:80 oil:15 cheddar:3 | crisps | bag
Irish brown bread with butter | wholemeal:60 buttermilk:20 butter:10 | wheaten bread | slice (2)
`);
X('Kosovo', 'Kosovar', EUR, `
Pite me spinaq | phyllo:60 spinach:80 cottage:30 oil:10 | kosovo spinach pie | slice
Llokuma | flour:60 yogurt:20 oil:15 | kosovo fried dough | serving (3)
`);
X('Latvia', 'Latvian', EUR, `
Pīrāgi, vegetarian | flour:50 butter:12 cabbage:50 onion:15 | cabbage pirags | serving (2)
Biezpiena sieriņš | cottage:50 sugar:10 dark_choc:15 | latvian curd snack | bar
Skābeņu zupa | spinach:120 potato:60 egg_boiled:25 sour_cream:20 water:200 | sorrel soup | bowl
`);
X('Liechtenstein', 'Liechtensteiner', EUR, `
Rösti with fried egg | potato:200 butter:15 egg_fried:50 | alpine rosti egg | plate
Apple strudel (Liechtenstein) | phyllo:30 apple:100 sugar:15 raisins:10 butter:10 | liechtenstein strudel | slice
`);
X('Lithuania', 'Lithuanian', EUR, `
Varškėčiai | cottage:120 flour:20 egg:20 sugar:10 oil:10 sour_cream:20 | lithuanian curd pancakes | serving (3)
Kibinai, vegetable | flour:60 butter:15 cabbage:50 mushrooms:30 | vegetable kibinai | piece
Šakotis | flour:20 butter:20 sugar:20 egg:40 | tree cake | slice
`);
X('Luxembourg', 'Luxembourgish', EUR, `
Quetschentaart | pie_crust:50 plum:100 sugar:15 | plum tart luxembourg | slice
Kniddelen | flour:60 egg:30 milk:40 butter:10 | luxembourg dumplings | plate
`);
X('Malta', 'Maltese', EUR, `
Pastizzi with ricotta | puff_pastry:60 ricotta:50 egg:5 | ricotta pastizzi | serving (2)
Pastizzi with peas | puff_pastry:60 peas:50 onion:10 curry:1 | pea pastizzi | serving (2)
Hobż biż-żejt | bread:80 tomato:50 olive_oil:12 capers:3 olives:10 | maltese bread with oil | serving
Kapunata | eggplant:100 red_pepper:60 tomato:80 capers:5 olive_oil:15 | maltese ratatouille | portion
`);
X('Moldova', 'Moldovan', EUR, `
Mămăligă with brânză | cornmeal:90 water:200 feta:40 | moldovan polenta and cheese | plate
Vărzări | flour:60 cabbage:80 oil:12 | moldovan cabbage pie | piece
`);
X('Monaco', 'Monégasque', EUR, `
Pan bagnat | baguette:100 tomato:50 egg_boiled:30 olives:15 olive_oil:12 lettuce:15 | nicoise sandwich | sandwich
Monaco vegetable stew | tomato:150 zucchini:80 olives:15 olive_oil:12 potato:80 | provencal vegetable stew | bowl
`);
X('Montenegro', 'Montenegrin', EUR, `
Priganice | flour:60 oil:15 honey:15 | montenegrin fritters with honey | serving (4)
Raštan | kale:150 potato:80 oil:10 | montenegrin kale stew | bowl
`);
X('North Macedonia', 'Macedonian', EUR, `
Mekici with feta | flour:60 yogurt:20 oil:15 feta:30 | macedonian fried dough cheese | serving (2)
Pindjur | red_pepper:100 eggplant:60 tomato:60 oil:15 garlic:3 | macedonian relish | portion
Gravče na tavče with bread | kidney:180 onion:30 oil:12 bread:50 | macedonian beans and bread | plate
`);
X('Norway', 'Norwegian', EUR, `
Brødskive with brown cheese and jam | bread:40 butter:5 cheddar:20 jam:10 | norwegian open sandwich | piece
Vafler (Norwegian) | flour:40 milk:60 egg:20 butter:10 sugar:8 jam:15 | norwegian waffles | serving (2)
Skillingsbolle | flour:45 butter:15 sugar:12 milk:20 sp_cinnamon:1 | bergen cinnamon bun | bun
Rømmegrøt | sour_cream:80 flour:15 milk:100 sugar:10 sp_cinnamon:0.5 | sour cream porridge | bowl
`);
X('Portugal', 'Portuguese', EUR, `
Pastel de nata | puff_pastry:30 milk:40 egg:15 sugar:12 | portuguese custard tart | tart
Torrada with butter | bread:80 butter:12 | portuguese toast | serving
Tosta mista | bread:70 ham_slice:30 cheddar:25 butter:5 | portuguese toastie | sandwich
Bolo do caco with garlic butter | flour:70 sweet_potato:20 butter:12 garlic:3 | madeira bread | piece
Sopa de legumes | potato:80 carrots:40 zucchini:40 onion:20 olive_oil:8 water:250 | portuguese vegetable soup | bowl
Feijoada vegetariana (Portuguese) | kidney:180 carrots:40 cabbage:40 tomato:40 rice:150 | portuguese bean stew veg | plate
`);
X('Romania', 'Romanian', EUR, `
Covrigi | flour:70 sesame:5 | romanian pretzels | piece
Zacuscă on bread | bread:60 eggplant:50 red_pepper:40 oil:10 | zacusca toast | serving
Plăcintă cu brânză | flour:60 cottage:60 oil:10 | romanian cheese pie | piece
Fasole bătută | kidney:180 olive_oil:12 garlic:3 onion:20 | romanian bean dip | portion
`);
X('San Marino', 'Sammarinese', EUR, `
Cassoni | flour:60 spinach:60 olive_oil:8 | filled flatbread san marino | piece
Bustrengo | cornmeal:30 flour:20 milk:60 apple:40 raisins:10 honey:10 | san marino cake | slice
`);
X('Serbia', 'Serbian', EUR, `
Kifle | flour:50 butter:10 milk:20 | serbian rolls | serving (2)
Proja | cornmeal:60 feta:25 egg:20 yogurt:30 oil:8 | serbian cornbread | slice
Ajvar with bread | bread:60 red_pepper:60 eggplant:30 oil:10 | ajvar sandwich | serving
Kačamak with yogurt | cornmeal:60 water:200 feta:20 yogurt:100 | serbian polenta | bowl
`);
X('Slovakia', 'Slovak', EUR, `
Šúľance with poppy seed | potato:150 flour:40 butter:10 sugar:10 | potato noodles sweet | plate
Pirohy | flour:60 potato:60 feta:20 butter:8 | slovak pierogi | serving (6)
Langoš (Slovak) | flour:80 oil:20 garlic:3 cheddar:20 | slovak langos | piece
`);
X('Slovenia', 'Slovenian', EUR, `
Ajdovi žganci | buckwheat:180 butter:10 | buckwheat spoonbread | bowl
Prekmurska gibanica | phyllo:40 cottage:40 apple:30 walnuts:15 sugar:15 butter:10 | layered cake | slice
Štruklji | flour:50 cottage:60 butter:10 | slovenian dumplings | portion
`);
X('Switzerland', 'Swiss', EUR, `
Zopf with butter and jam | flour:60 butter:15 milk:20 jam:15 | swiss braided bread | slice (2)
Raclette with potatoes | swiss:80 potato:200 pickles:20 | raclette | plate
Cheese fondue (alcohol-free) | swiss:100 bread:80 milk:40 cornstarch:5 | fondue moitie-moitie | serving
Basler Läckerli | flour:30 honey:20 almonds:10 | basel spice biscuits | serving (2)
`);
X('Ukraine', 'Ukrainian', EUR, `
Varenyky with potato | flour:60 potato:80 onion:20 oil:8 | potato dumplings ukraine | serving (8)
Varenyky with cherries | flour:60 cherries:80 sugar:10 sour_cream:20 | cherry varenyky | serving (8)
Pampushky with garlic | flour:60 oil:10 garlic:3 | garlic buns | serving (2)
Borscht, vegetarian | beets:120 cabbage:60 potato:60 carrots:30 kidney:40 water:250 | vegetarian borshch | bowl
Kasha with mushrooms | buckwheat:180 mushrooms:60 onion:20 oil:8 | buckwheat mushrooms | plate
`);
X('Holy See (Vatican City)', 'Vatican', EUR, `
Cornetto alla crema | croissant:60 milk:30 egg:10 sugar:8 | cream filled cornetto | pastry
Pizza bianca | flour:80 olive_oil:15 | roman white pizza | slice
`);
// ---- round 3: Caribbean and Central America ----
X('Antigua and Barbuda', 'Antiguan', NA, `
Antiguan black pineapple slices | pineapple:200 | black pineapple | serving
Johnny cakes (Antigua) | flour:60 butter:10 milk:25 oil:12 | antiguan johnny cakes | serving (2)
`);
X('Aruba', 'Aruban', TE, `
Pastechi with cheese | flour:50 oil:15 gouda:30 | aruban pastechi | piece
Funchi fries | cornmeal:80 water:150 oil:15 | fried funchi | portion
`);
X('Barbados', 'Barbadian', NA, `
Bajan salt bread with cheese | roll:70 cheddar:30 | salt bread and cheese | serving
Bajan coconut bread | flour:50 coconut_meat:25 sugar:15 butter:10 raisins:10 | barbados sweet bread | slice
Cou-cou | cornmeal:70 okra:60 water:150 butter:8 | bajan cou cou | portion
`);
X('Belize', 'Belizean', NA, `
Belizean powder buns | flour:50 sugar:15 butter:12 raisins:10 | powder bun | bun
Garnaches | corn_tortilla:40 oil:10 refried:50 cheddar:15 cabbage:20 | belize garnaches | serving (3)
Johnny cakes (Belizean) | flour:60 coconut_milk:20 butter:10 | belize johnny cakes | serving (2)
`);
X('Bermuda', 'Bermudian', TE, `
Bermuda Johnny bread | flour:60 butter:10 milk:30 sugar:5 | johnny bread | slice
Cassava pie (Bermudian, vegetarian) | cassava:120 egg:30 butter:15 sugar:20 | bermuda cassava pie | slice
`);
X('Costa Rica', 'Costa Rican', NA, `
Gallo pinto vegano | rice:150 black_beans:100 red_pepper:20 onion:15 oil:8 | vegan gallo pinto | plate
Tamal de elote | corn:150 milk:30 sugar:15 butter:8 | sweet corn tamal | piece
Arreglados | roll:60 kidney:40 cheddar:20 | costa rican snack sandwich | piece
Agua dulce | brown_sugar:30 water:250 milk:30 | costa rican sugar drink | cup
`);
X('Cuba', 'Cuban', NA, `
Tostada cubana with café con leche | bread:70 butter:12 coffee:60 milk:150 sugar:10 | cuban breakfast | serving
Congrí vegano | rice:180 black_beans:100 onion:15 green_pepper:20 oil:8 | vegan congri | plate
Yuca con mojo | cassava_cooked:200 olive_oil:15 garlic:5 lime:8 | yuca mojo | portion
Pastelito de guayaba | puff_pastry:60 guava:40 sugar:5 | guava pastry | pastry
Croqueta de queso | cheddar:30 milk:30 flour:15 breadcrumbs:10 oil:10 | cheese croquettes cuba | serving (3)
`);
X('Curaçao', 'Curaçaoan', TE, `
Pan dushi | flour:60 sugar:12 butter:10 | sweet bread curacao | roll
Kokada (Curaçao) | coconut_meat:40 sugar:25 | curacao coconut sweet | piece
`);
X('Dominica', 'Dominican (Dominica)', NA, `
Dominica bakes with cheese | flour:70 oil:15 cheddar:30 | fried bakes cheese | serving
Dasheen with coconut | taro:200 coconut_milk:50 | dominica dasheen | plate
`);
X('Dominican Republic', 'Dominican', NA, `
Mangú vegano | green_plantain:200 olive_oil:10 onion:40 vinegar:5 | vegan mangu | plate
Yaniqueques | flour:60 oil:20 | dominican johnny cakes | serving (2)
Locrio de berenjena | rice:200 eggplant:100 tomato_paste:15 oil:10 | eggplant rice | plate
Batida de lechosa | papaya:150 milk:150 sugar:15 | papaya shake | glass
`);
X('El Salvador', 'Salvadoran', NA, `
Pupusas de frijol | masa:120 refried:60 cabbage:40 | bean pupusas | serving (2)
Pupusas de loroco | masa:120 mozzarella:40 spinach:15 | loroco pupusas | serving (2)
Pastelitos salvadoreños de papa | masa:60 potato:50 oil:15 | potato pastelitos | serving (3)
Quesadilla salvadoreña | flour:40 cheddar:30 sugar:20 butter:12 egg:15 sour_cream:20 | salvadoran cheese cake | slice
`);
X('Grenada', 'Grenadian', NA, `
Grenadian bakes | flour:70 oil:15 | grenada bakes | serving (2)
Callaloo soup (Grenada, vegan) | spinach:120 okra:40 coconut_milk:60 pumpkin:40 water:150 | vegan callaloo soup | bowl
Nutmeg jam on bread | bread:60 jam:20 | grenada nutmeg jam toast | serving
`);
X('Guadeloupe', 'Guadeloupean', TE, `
Accras de légumes | flour:40 spinach:30 carrots:20 oil:15 | vegetable accras | serving (4)
Pain au beurre | flour:60 butter:15 sugar:10 | guadeloupe butter bread | slice
`);
X('Guatemala', 'Guatemalan', NA, `
Desayuno chapín | egg_scrambled:100 black_beans:80 plantain_fried:80 cheddar:20 corn_tortilla:50 | guatemalan breakfast | plate
Atol de elote | corn:100 milk:150 sugar:15 | corn drink | cup
Tostadas guatemaltecas | taco_shell:30 black_beans:50 tomato:40 onion:10 | guatemalan tostadas | serving (2)
Plátanos en mole | ripe_plantain:150 dark_choc:15 sesame:5 tomato:30 | plantains in mole | portion
`);
X('Haiti', 'Haitian', NA, `
Diri kole ak pwa | rice:180 kidney:100 oil:10 onion:15 | haitian rice and beans | plate
Akra (Haitian) | taro:100 flour:10 oil:15 | malanga fritters | serving (4)
Labouyi bannann | green_plantain:100 milk:150 sugar:15 sp_cinnamon:0.5 | plantain porridge haiti | bowl
Pen patat | sweet_potato:120 banana:40 coconut_milk:40 sugar:20 | sweet potato pudding haiti | slice
`);
X('Honduras', 'Honduran', NA, `
Baleada sencilla | flour_tortilla:70 refried:60 sour_cream:20 | simple baleada | piece
Baleada with egg and avocado | flour_tortilla:70 refried:60 egg_scrambled:50 avocado:40 sour_cream:15 | baleada especial | piece
Pastelitos de perro (vegetarian) | masa:60 potato:50 oil:15 | honduran pastelitos | serving (3)
`);
X('Martinique', 'Martinican', TE, `
Pain coco (Martinique) | flour:50 coconut_meat:20 sugar:12 butter:8 | martinique coconut bread | slice
Lentilles créoles | lentils:180 onion:20 tomato:30 thyme_fresh:2 oil:8 | creole lentils | bowl
`);
X('Nicaragua', 'Nicaraguan', NA, `
Gallo pinto nicaragüense | rice:150 kidney:100 onion:15 oil:10 | nicaraguan gallo pinto | plate
Quesillo | corn_tortilla:50 mozzarella:50 sour_cream:30 onion:10 | nicaraguan quesillo | serving
Rosquillas | cornmeal:40 feta:20 butter:10 egg:10 | corn cheese rings | serving (4)
`);
X('Panama', 'Panamanian', NA, `
Hojaldras | flour:60 oil:15 sugar:5 | panamanian fry bread | piece
Tortilla de maíz con queso blanco | masa:80 oil:10 feta:30 | panama corn tortilla breakfast | serving
Patacones panameños | green_plantain:150 oil:15 | panama tostones | serving
`);
X('Puerto Rico', 'Puerto Rican', TE, `
Pan sobao with butter | roll:70 butter:10 | puerto rican bread | roll
Mallorca | flour:50 butter:12 sugar:12 egg:10 icing_sugar:5 | sweet roll puerto rico | piece
Alcapurrias de yuca (vegetarian) | cassava:120 oil:15 | yuca fritters | serving (2)
Arroz con habichuelas | rice:180 kidney:100 tomato_paste:10 oil:8 | rice and beans puerto rico | plate
`);
X('Saint Kitts and Nevis', 'Kittitian', NA, `
Coconut dumplings (Kittitian) | flour:60 coconut_meat:15 water:30 | coconut dumplings | serving (3)
Spicy plantains (St Kitts) | plantain_fried:150 chili:2 | kittitian plantains | serving
`);
X('Saint Lucia', 'Saint Lucian', NA, `
Accra (Saint Lucia) | salt_cod:40 flour:40 oil:15 | saint lucia accra | serving (4)
Bakes and cocoa tea | flour:70 oil:15 cocoa_powder:10 milk:150 sugar:12 | st lucian breakfast | serving
`);
X('Saint Vincent and the Grenadines', 'Vincentian', NA, `
Vincy bakes | flour:70 oil:15 | vincentian bakes | serving (2)
Arrowroot biscuits | tapioca:20 flour:15 butter:8 sugar:8 | svg arrowroot cookies | serving (2)
`);
X('The Bahamas', 'Bahamian', NA, `
Bahamian grits breakfast | cornmeal:60 water:200 butter:10 egg_fried:50 | bahamian grits breakfast | plate
Coconut tart (Bahamian) | pie_crust:40 coconut_meat:30 sugar:20 | bahamian coconut tart | slice
`);
X('Trinidad and Tobago', 'Trinidadian', NA, `
Sweet bread and cocoa tea | flour:50 coconut_meat:20 sugar:15 butter:10 cocoa_powder:10 milk:150 | trini breakfast | serving
Channa and aloo | chickpeas:120 potato:100 curry:4 oil:10 | curry channa aloo | bowl
Vegan doubles | flour:60 oil:15 chickpeas:80 curry:3 tamarind:10 | doubles vegan | serving
Pumpkin talkari | pumpkin:200 oil:8 garlic:3 | pumpkin choka | portion
`);


/** Dishes from here on go to the second data file (public/data/foods-more.json): the main file is near its offline-cache limit. */
const LATER_FROM = NEW.length;
Object.assign(K, { cranberries: 'Cranberries, raw', nopales: 'Nopales, cooked, without salt', radish: 'Radish', chayote: 'Chayote, fruit, cooked, boiled, drained, without salt', jicama: 'Jicama, raw', tomatillo: 'Tomatillos, raw', green_chili: 'Peppers, hot chili, green, raw', squash_flowers: 'Pumpkin flowers, cooked, boiled, drained, without salt', cotija: 'Queso cotija', lard: 'Lard', guava_paste: 'Guava paste', epazote: 'Epazote, raw', summer_squash: 'Squash, summer, all varieties, cooked, boiled, drained, without salt' });
// ======================= ROUND 4: REGIONAL, FESTIVAL, STREET AND HOME DISHES — AMERICAS =======================
X('United States of America', 'American', NA, `
Hoppin' John with collards | cowpeas:150 rice:120 kale:80 onion:20 oil:8 | new year black-eyed peas | plate
Succotash | corn:100 fava:80 butter:8 onion:15 | southern succotash | portion
Fried green tomatoes | tomato:150 cornmeal:25 egg:15 oil:15 | fried green tomatoes | serving (4 slices)
Pimento cheese sandwich | bread:70 cheddar:40 mayo:15 red_pepper:15 | pimento cheese | sandwich
Tomato pie (Southern) | pie_crust:50 tomato:100 cheddar:30 mayo:15 | southern tomato pie | slice
Brunswick stew | chicken_meat:70 pork_shoulder:40 corn:40 fava:40 tomato_canned:80 | brunswick stew | bowl
Frogmore-style shrimp boil | shrimp:120 corn:100 potato:100 sausage:40 | low country boil | plate
Maque choux | corn:150 red_pepper:30 onion:20 butter:10 cream:20 | cajun corn | portion
Étouffée, crawfish-style shrimp | shrimp:130 butter:15 flour:10 onion:30 celery:20 rice:150 | etouffee | plate
Muffuletta | baguette:100 ham_slice:30 provolone:25 olives:25 olive_oil:8 | new orleans muffuletta | sandwich
Beignets | flour:50 sugar:8 milk:20 oil:15 icing_sugar:10 | new orleans beignets | serving (3)
Bread pudding with praline | bread:60 milk:80 egg:25 brown_sugar:20 walnuts:10 | praline bread pudding | portion
Chicago deep dish slice | flour:70 butter:10 mozzarella:60 marinara:50 sausage:30 | deep dish pizza | slice
Italian beef sandwich | baguette:90 beef:100 green_pepper:20 stock:30 | chicago italian beef | sandwich
Cincinnati chili | pasta:150 beef_mince:90 tomato_canned:60 cheddar:30 sp_cinnamon:0.5 | cincinnati chili spaghetti | plate
Hot brown | bread:60 turkey:80 bacon:15 milk:60 cheddar:25 tomato:30 | kentucky hot brown | plate
Burgoo | beef:50 chicken_meat:50 corn:40 potato:50 tomato_canned:60 water:150 | kentucky burgoo | bowl
Pierogi, Pittsburgh-style | flour:60 potato:60 cheddar:20 butter:10 onion:15 | pittsburgh pierogies | serving (6)
Scrapple | pork_shoulder:50 cornmeal:30 water:30 oil:8 | philadelphia scrapple | slice (2)
Soft pretzel, Philly | flour:80 salt:1 mustard:5 | philly pretzel | pretzel
Shoofly pie | pie_crust:40 molasses:30 flour:15 brown_sugar:15 butter:8 | pennsylvania dutch pie | slice
Chow-chow relish | cabbage:60 green_pepper:30 onion:20 vinegar:15 sugar:10 | chow chow | portion
New England boiled dinner | beef_brisket:120 cabbage:80 potato:100 carrots:50 | boiled dinner | plate
Clam cakes | clams:40 flour:40 milk:20 egg:10 oil:15 | rhode island clam cakes | serving (3)
Johnnycakes, Rhode Island | cornmeal:50 water:50 butter:8 | rhode island johnnycake | serving (2)
Fluffernutter sandwich | bread:70 peanut_butter:25 marshmallow:15 | fluffernutter | sandwich
Indian pudding | cornmeal:20 milk:150 molasses:20 sp_ginger:0.5 sp_cinnamon:0.5 | new england cornmeal pudding | bowl
Hotdish (tater tot) | beef_mince:80 potato:100 green_beans:50 milk:40 cheddar:20 | minnesota hotdish | portion
Juicy Lucy | beef_patty:120 cheddar:25 burger_bun:60 | jucy lucy burger | burger
Wild rice soup | brown_rice:60 chicken_meat:60 carrots:30 celery:20 cream:30 stock:200 | minnesota wild rice soup | bowl
Booyah | chicken_meat:70 beef:40 potato:50 cabbage:40 carrots:30 water:250 | wisconsin booyah | bowl
Cheese curds, fried | cheddar:60 flour:15 milk:15 oil:15 | wisconsin cheese curds | serving
Runza | flour:70 beef_mince:60 cabbage:50 onion:15 | nebraska runza | sandwich
Chislic | lamb:120 salt:1 | south dakota chislic | serving
Pasty, Michigan | flour:70 butter:20 beef:60 potato:50 onion:15 | yooper pasty | pasty
Coney dog | sausage:60 roll:50 beef_mince:40 onion:10 mustard:5 | detroit coney | hot dog
Green chile stew | pork_shoulder:100 green_pepper:80 potato:80 onion:20 water:200 | new mexico green chile stew | bowl
Navajo tacos, vegetarian | flour:70 oil:20 kidney:80 lettuce:20 cheddar:20 salsa:20 | frybread taco vegetarian | piece
Sopaipillas with honey | flour:50 oil:15 honey:15 | new mexico sopaipillas | serving (2)
Posole verde | hominy:150 chicken_meat:80 green_pepper:40 water:200 | green posole | bowl
Calabacitas | zucchini:150 corn:60 green_pepper:30 cheddar:20 oil:8 | new mexico squash | portion
Chimichanga | flour_tortilla:80 beef:80 kidney:30 oil:15 cheddar:20 | fried burrito | piece
Sonoran hot dog | sausage:60 roll:60 bacon:15 kidney:30 tomato:20 mayo:10 | arizona hot dog | hot dog
Indian fry bread with honey | flour:70 oil:20 honey:15 | frybread sweet | piece
Hatch chile cheeseburger | beef_patty:110 green_pepper:30 cheddar:20 burger_bun:60 | green chile burger | burger
Fish taco, Baja-style | fish:100 flour:15 oil:12 corn_tortilla:60 cabbage:30 mayo:10 | baja fish tacos | serving (2)
California roll | rice_short:150 crab:40 avocado:30 cucumber:20 laver:3 | california maki | roll (8)
Cioppino | fish:80 shrimp:50 mussels:40 clams:40 tomato_canned:150 | san francisco seafood stew | bowl
Sourdough bread bowl with chowder | bread:150 clams:60 potato:60 milk:150 butter:8 | clam chowder bread bowl | bowl
Mission burrito | flour_tortilla:110 rice:100 kidney:80 beef:80 cheddar:25 sour_cream:20 salsa:30 | san francisco burrito | burrito
Garlic noodles | egg_noodles:180 butter:15 garlic:8 parmesan:10 | sf garlic noodles | plate
Frito pie | corn_tortilla:50 oil:12 beef_mince:70 kidney:40 cheddar:20 onion:10 | frito pie | bag
Breakfast kolache | flour:60 sugar:8 butter:10 sausage:40 cheddar:15 | texas klobasnek | piece
Texas sheet cake | flour:35 sugar:30 butter:20 cocoa_powder:6 buttermilk:20 walnuts:5 | chocolate sheet cake | slice
Chicken fried chicken | chicken_breast:150 flour:25 egg:15 oil:20 gravy:60 | country fried chicken | plate
Brisket plate | beef_brisket:150 bread:30 pickles:15 onion:10 | texas bbq brisket | plate
Burnt ends | beef_brisket:120 bbq:30 | kansas city burnt ends | portion
Toasted ravioli | pasta:80 beef_mince:30 breadcrumbs:15 oil:15 marinara:30 | st louis toasted ravioli | serving (6)
Gooey butter cake | flour:30 butter:20 sugar:25 cream_cheese:25 egg:15 | st louis gooey cake | slice
St. Paul sandwich | egg:60 bean_sprouts:30 onion:15 oil:12 bread:70 mayo:10 | st paul egg foo young sandwich | sandwich
Hawaiian plate lunch, kalua pork | pork_shoulder:120 rice:180 pasta:60 mayo:20 | kalua pig plate | plate
Poke, ahi shoyu | tuna_raw:120 soy:12 onion:15 sesame_oil:5 | ahi shoyu poke | bowl
Saimin | egg_noodles:150 ham_slice:30 egg:25 stock:250 | hawaiian saimin | bowl
Malasadas | flour:50 sugar:15 egg:10 milk:20 oil:15 | portuguese doughnut hawaii | serving (2)
Haupia | coconut_milk:100 sugar:15 cornstarch:12 | coconut pudding hawaii | square
Shave ice | sugar:30 water:150 | hawaiian shave ice | cup
Butter mochi | sticky_rice:50 coconut_milk:40 butter:12 sugar:25 egg:15 | hawaiian butter mochi | square
Fry sauce and fries | fries:150 mayo:15 ketchup:15 | utah fry sauce | serving
Funeral potatoes | potato:150 sour_cream:30 cheddar:30 cornflakes:10 butter:8 | utah cheesy potatoes | portion
Huckleberry pancakes | flour:60 milk:90 egg:25 blueberries:50 butter:8 | montana huckleberry pancakes | stack (3)
Salmon candy | salmon:60 brown_sugar:10 | alaska smoked salmon candy | portion
Reindeer-style sausage with eggs | sausage:80 egg_scrambled:100 | alaskan sausage breakfast | plate
Pumpkin roll | flour:20 pumpkin:40 sugar:20 egg:20 cream_cheese:25 icing_sugar:10 | thanksgiving pumpkin roll | slice
Cranberry sauce, homemade | cranberries:100 sugar:30 oj:20 | thanksgiving cranberry sauce | portion
Stuffing, homemade | bread:80 butter:15 onion:20 celery:20 stock:60 | thanksgiving stuffing | portion
Deviled crab | crab:80 breadcrumbs:15 mayo:15 egg:10 | maryland deviled crab | serving
Crab cakes, Maryland | crab:120 breadcrumbs:15 mayo:15 egg:10 mustard:3 | maryland crab cake | serving (2)
Smith Island cake | flour:30 sugar:30 butter:15 egg:15 dark_choc:20 | maryland layer cake | slice
Pepperoni roll | flour:70 pepperoni:25 | west virginia pepperoni roll | roll
Half-smoke | sausage:100 roll:60 onion:15 beef_mince:30 | dc half smoke | hot dog
Garbage plate | beef_patty:110 pasta:80 fries:80 baked_beans:60 onion:15 | rochester garbage plate | plate
Buffalo wings with blue cheese | wing:200 butter:10 sp_cayenne:1 blue_cheese:20 celery_raw:30 | buffalo wings | serving (8)
Beef on weck | roll:70 beef:100 | buffalo beef on weck | sandwich
Chicken riggies | pasta:180 chicken_breast:80 red_pepper:30 cream:40 marinara:60 | utica riggies | plate
Spiedie | chicken_breast:120 olive_oil:10 lemon:5 roll:50 | binghamton spiedie | sandwich
Bagel with schmear and tomato | bagel:100 cream_cheese:30 tomato:30 | new york bagel | bagel
Black and white cookie | flour:40 sugar:25 butter:12 egg:10 icing_sugar:20 cocoa_powder:3 | new york cookie | cookie
Knish, potato | flour:40 potato:100 onion:20 oil:10 | potato knish | knish
Egg cream (soda fountain) | milk:120 cocoa_powder:8 sugar:20 water:150 | new york egg cream | glass
`);
X('Mexico', 'Mexican', NA, `
Cochinita pibil tacos | pork_shoulder:110 oj:20 corn_tortilla:60 onion:15 | yucatan cochinita | serving (3)
Panuchos | corn_tortilla:60 refried:40 chicken_meat:50 oil:10 lettuce:15 | yucatan panuchos | serving (2)
Salbutes | corn_tortilla:60 oil:15 chicken_meat:50 tomato:20 cabbage:15 | yucatan salbutes | serving (2)
Papadzules | corn_tortilla:90 egg_boiled:60 pumpkin:40 tomato:50 | yucatan papadzules | serving (3)
Sopa de lima | chicken_meat:80 corn_tortilla:20 oil:8 lime:15 stock:250 | yucatan lime soup | bowl
Mole negro with rice | chicken_thigh:150 dark_choc:15 chili_powder:5 raisins:8 sesame:5 rice:150 | oaxacan black mole | plate
Tlayuda | corn_tortilla:80 refried:60 mozzarella:40 cabbage:20 avocado:30 | oaxacan pizza | piece
Memelas | masa:90 refried:40 feta:20 salsa:20 | oaxacan memelas | serving (2)
Enfrijoladas | corn_tortilla:90 black_beans:100 feta:20 sour_cream:15 | bean sauce tortillas | serving (3)
Entomatadas | corn_tortilla:90 tomato:120 feta:20 sour_cream:15 | tomato sauce tortillas | serving (3)
Chiles en nogada | green_pepper:150 pork_mince:60 apple:30 walnuts:25 cream:30 | puebla stuffed chiles | serving
Cemita poblana | roll:90 chicken_breast:80 avocado:40 mozzarella:30 | puebla cemita | sandwich
Chalupas poblanas | corn_tortilla:60 oil:12 pork_shoulder:40 salsa:30 onion:10 | puebla chalupas | serving (4)
Mole de olla | beef:120 corn:50 zucchini:50 green_beans:30 water:250 | beef vegetable mole soup | bowl
Pozole blanco | hominy:150 pork_shoulder:80 cabbage:20 radish:15 water:250 | white pozole | bowl
Birria tacos | beef:110 corn_tortilla:60 onion:15 stock:80 | quesabirria | serving (3)
Tortas ahogadas | roll:80 pork_shoulder:100 tomato:80 chili:5 | guadalajara drowned sandwich | torta
Carne en su jugo | beef:130 kidney:60 bacon:15 stock:200 | jalisco beef in its juice | bowl
Machaca con huevo | beef:60 egg:100 tomato:30 onion:15 flour_tortilla:50 | northern machaca eggs | plate
Cabrito-style roast goat | goat:180 | monterrey cabrito | portion
Discada | beef:70 pork_shoulder:40 bacon:15 sausage:30 onion:30 | northern discada | serving
Burritos de frijol (Chihuahua) | flour_tortilla:70 refried:80 cheddar:20 | bean burrito northern | burrito
Tacos de canasta | corn_tortilla:60 potato:60 oil:15 | basket tacos | serving (3)
Tacos al pastor | pork_shoulder:100 pineapple:30 corn_tortilla:60 onion:10 | al pastor | serving (3)
Tacos de suadero | beef:100 corn_tortilla:60 onion:10 | suadero tacos | serving (3)
Tacos de carnitas | pork_shoulder:110 corn_tortilla:60 onion:10 | carnitas tacos | serving (3)
Tacos de nopal | nopales:100 corn_tortilla:60 onion:15 cotija:15 | cactus tacos | serving (3)
Tacos de hongos | mushrooms:120 onion:20 oil:8 corn_tortilla:60 | mushroom tacos | serving (3)
Tacos de papa | potato:120 oil:15 corn_tortilla:60 salsa:20 | potato tacos | serving (3)
Tacos dorados | corn_tortilla:60 chicken_meat:60 oil:15 sour_cream:15 lettuce:15 | flautas | serving (3)
Gorditas de chicharrón | masa:90 pork_belly:40 oil:10 | gorditas | serving (2)
Gorditas de requesón | masa:90 ricotta:40 oil:10 | ricotta gorditas | serving (2)
Sopes | masa:90 refried:40 lettuce:15 feta:15 sour_cream:15 | sopes | serving (2)
Huaraches | masa:100 refried:50 salsa:30 feta:20 | huarache | piece
Tlacoyos | masa:90 fava:50 feta:20 salsa:20 | blue corn tlacoyos | serving (2)
Quesadillas de flor de calabaza | masa:80 mozzarella:30 squash_flowers:40 | squash blossom quesadilla | serving (2)
Elote asado | corn:150 mayo:10 feta:10 chili_powder:1 lime:5 | grilled corn | cob
Tamales de rajas con queso | masa:100 green_pepper:30 mozzarella:30 oil:8 | rajas tamales | serving (2)
Tamales dulces | masa:100 sugar:20 raisins:10 butter:10 | sweet tamales | serving (2)
Arroz rojo | rice:180 tomato:40 onion:15 oil:8 | mexican red rice | portion
Frijoles charros | kidney:180 bacon:15 tomato:30 onion:15 | cowboy beans | bowl
Frijoles de la olla | black_beans:200 onion:15 | pot beans | bowl
Calabacitas a la mexicana | zucchini:150 corn:40 tomato:40 onion:15 oil:8 | mexican squash | portion
Nopales salad | nopales:120 tomato:50 onion:15 cotija:15 coriander:3 | ensalada de nopales | bowl
Caldo de res | beef:100 corn:50 potato:60 carrots:40 cabbage:40 water:250 | mexican beef soup | bowl
Caldo tlalpeño | chicken_meat:80 chickpeas:40 carrots:30 avocado:30 water:250 | tlalpeno soup | bowl
Sopa de tortilla | corn_tortilla:40 oil:10 tomato:80 avocado:30 feta:15 stock:200 | tortilla soup | bowl
Albóndigas en chipotle | beef_mince:120 rice:15 tomato:80 chili:3 | chipotle meatballs | serving
Bistec a la mexicana | beef:150 tomato:60 onion:20 green_pepper:15 oil:8 | mexican steak | portion
Pescado a la veracruzana | fish:170 tomato:80 olives:15 capers:5 olive_oil:10 | veracruz fish | portion
Camarones a la diabla | shrimp:150 tomato:60 chili:5 butter:8 | deviled shrimp | portion
Aguachile | shrimp:130 lime:20 cucumber:40 onion:15 chili:3 | sinaloa aguachile | plate
Tostada de ceviche | taco_shell:30 fish:80 lime:15 tomato:30 onion:10 | ceviche tostada | serving (2)
Huevos motuleños | corn_tortilla:50 egg_fried:100 black_beans:50 ham:20 peas:15 salsa:30 | motul eggs | plate
Chilaquiles verdes | corn_tortilla:80 oil:15 salsa:80 sour_cream:20 onion:10 | green chilaquiles | plate
Enchiladas suizas | corn_tortilla:90 chicken_meat:80 cream:40 mozzarella:30 salsa:50 | swiss enchiladas | serving (3)
Enchiladas mineras | corn_tortilla:90 potato:50 carrots:30 feta:20 salsa:40 | guanajuato enchiladas | serving (3)
Molletes dulces | baguette:80 butter:10 sugar:10 sp_cinnamon:0.5 | sweet molletes | serving (2)
Pan de muerto | flour:60 sugar:15 butter:12 egg:15 oj:5 | day of the dead bread | piece
Rosca de reyes | flour:60 sugar:15 butter:12 egg:15 apricot_dried:10 | kings cake | slice
Buñuelos mexicanos | flour:40 oil:15 sugar:10 sp_cinnamon:0.5 | mexican bunuelos | piece
Capirotada | bread:60 brown_sugar:25 raisins:10 cheddar:15 peanuts:10 | lenten bread pudding | portion
Jericalla | milk:120 egg:30 sugar:20 | guadalajara custard | ramekin
Cajeta crepes | flour:30 milk:60 egg:20 condensed:30 walnuts:8 | crepas de cajeta | serving (2)
Gelatina de mosaico | gelatine:4 condensed:40 milk:60 sugar:10 | mosaic jello | cup
Mangonada | mango:150 sorbet:60 chili_powder:1 lime:5 | mango chamoy | cup
Paletas de fresa | strawberries:80 sugar:15 water:30 | strawberry ice pop | pop
Agua de pepino con limón | cucumber:100 lime:20 sugar:20 water:200 | cucumber lime water | glass
Café de olla | coffee:240 brown_sugar:15 sp_cinnamon:0.5 | pot coffee | cup
`);
X('Canada', 'Canadian', NA, `
Pâté chinois | beef_mince:110 corn_canned:80 mash:180 | quebec shepherds pie | portion
Cretons on toast | pork_mince:50 bread:60 | quebec pork spread | serving
Fèves au lard | kidney:180 molasses:15 pork_belly:20 | quebec baked beans | portion
Tarte au sucre à la crème | pie_crust:45 brown_sugar:30 cream:25 | quebec sugar cream pie | slice
Grands-pères au sirop | flour:50 milk:30 butter:8 maple:40 | maple dumplings | serving (3)
Oreilles de crisse | pork_belly:40 | quebec crispy pork | serving
Ragoût de boulettes | pork_mince:120 flour:10 potato:80 gravy:60 | quebec meatball stew | bowl
Pea soup with ham hock (Québec) | split_peas:100 ham:40 carrots:30 onion:20 water:250 | soupe aux pois jaunes | bowl
Bannock, Métis style | flour:70 oil:8 milk:30 raisins:10 | metis bannock | piece
Three sisters soup | corn:80 kidney:80 butternut:100 water:250 | haudenosaunee soup | bowl
Pemmican-style bar | beef:30 blueberries:20 | dried meat berry bar | bar
Jiggs dinner | beef_brisket:100 potato:100 cabbage:80 carrots:50 split_peas:40 | newfoundland jiggs | plate
Toutons with molasses | flour:60 oil:12 molasses:20 | newfoundland fried dough | serving (2)
Cod au gratin | cod:150 milk:80 cheddar:30 breadcrumbs:10 butter:8 | newfoundland cod | portion
Lobster roll, Maritime | crab:110 mayo:15 roll:60 celery_raw:10 | maritime lobster roll | roll
Rappie pie | potato:200 chicken_meat:70 stock:80 | acadian rappie | portion
Hodge podge | potato:100 green_beans:60 carrots:50 peas:30 cream:40 butter:10 | nova scotia hodge podge | bowl
Blueberry grunt | blueberries:100 flour:30 sugar:15 butter:8 | nova scotia grunt | portion
Fricot | chicken_meat:80 potato:100 onion:20 flour:20 water:200 | acadian chicken stew | bowl
Pouding chômeur aux pommes | flour:35 sugar:15 butter:10 apple:50 maple:20 | apple poor man's pudding | portion
Halifax donair pizza slice | flour:70 beef_mince:50 mozzarella:30 condensed:15 | donair pizza | slice
Montreal steak spice burger | beef_patty:120 sp_pepper:1 burger_bun:60 | montreal burger | burger
Bagel with smoked meat | bagel:90 beef_brisket:60 mustard:5 | smoked meat bagel | bagel
Smoked meat poutine | fries:180 cheddar:40 gravy:60 beef_brisket:40 | smoked meat poutine | plate
Japadog-style hot dog | sausage:60 roll:50 laver:2 mayo:10 teriyaki:10 | vancouver japadog | hot dog
B.C. salmon burger | salmon:120 burger_bun:60 lettuce:15 mayo:10 | salmon burger | burger
Bannock tacos | flour:60 oil:15 beef_mince:60 lettuce:20 cheddar:15 salsa:20 | indian taco canada | piece
Perogies with sour cream (Prairies) | flour:60 potato:60 cheddar:15 sour_cream:30 onion:15 butter:8 | prairie perogies | serving (6)
Holubtsi, Prairie Ukrainian | cabbage_cooked:120 rice:60 onion:20 butter:8 | prairie cabbage rolls | serving (3)
Saskatoon berry pancakes | flour:60 milk:90 egg:25 blueberries:50 maple:15 | prairie pancakes | stack (3)
Alberta beef dip | baguette:90 beef:100 stock:60 | beef dip | sandwich
Ginger beef, vegetarian (tofu) | tofu:150 cornstarch:15 oil:15 sugar:12 ginger:5 rice:150 | ginger tofu | plate
Caesar salad with tofu bacon | lettuce:100 tofu:40 parmesan:15 mayo:15 bread:20 | vegetarian caesar | bowl
Flapper pie | pie_crust:40 milk:80 egg:20 sugar:20 meringue:8 | prairie custard pie | slice
Butter tart squares | flour:30 butter:15 brown_sugar:25 egg:10 raisins:10 | butter tart bars | square
Maple taffy | maple:30 | tire d'erable | stick
`);
X('Brazil', 'Brazilian', SA, `
Vatapá | bread:40 shrimp:60 coconut_milk:60 peanuts:15 palm_oil:10 | bahian vatapa | portion
Acarajé | cowpeas:100 palm_oil:20 shrimp:30 tomato:20 | bahian acaraje | piece
Caruru | okra:150 dried_shrimp:10 peanuts:15 palm_oil:10 | okra stew bahia | portion
Bobó de camarão | shrimp:120 cassava_cooked:100 coconut_milk:60 palm_oil:8 | shrimp cassava cream | bowl
Baião de dois | rice:120 cowpeas:80 feta:30 bacon:15 | northeastern rice and beans | plate
Carne de sol com mandioca | beef:130 cassava_cooked:150 butter:10 | sun-dried beef with cassava | plate
Arroz de carreteiro | rice:180 beef:80 onion:20 oil:10 | cart driver rice | plate
Galinhada | rice:180 chicken_thigh:120 turmeric:1 peas:20 | goias chicken rice | plate
Pequi rice-style arroz com pequi | rice:180 chicken_thigh:80 oil:10 | arroz com pequi | plate
Tutu de feijão | kidney:150 flour:20 bacon:15 onion:15 | minas bean puree | portion
Frango com quiabo | chicken_thigh:150 okra:80 tomato:40 onion:20 | chicken with okra minas | plate
Tropeiro (Minas) | kidney:120 flour:25 bacon:20 egg:30 kale:30 | feijao tropeiro mineiro | plate
Virado à paulista | rice:120 kidney:80 pork_loin:80 egg_fried:50 kale:40 plantain_fried:50 | sao paulo plate | plate
Sanduíche de mortadela | roll:80 ham_slice:100 provolone:20 | sao paulo mortadella | sandwich
Bauru | roll:80 beef:50 mozzarella:30 tomato:20 pickles:10 | bauru sandwich | sandwich
Cuscuz paulista | cornmeal:60 sardine:40 tomato:40 peas:20 egg_boiled:20 | sao paulo couscous | slice
Barreado | beef:150 onion:20 banana:60 | parana barreado | plate
Arroz de pato (Brazilian) | rice:180 duck_meat:90 | duck rice brazil | plate
Pato no tucupi | duck_meat:150 spinach:50 rice:120 | duck in tucupi | plate
Tacacá | shrimp:40 tapioca:30 spinach:30 water:250 | amazon tacaca | bowl
Maniçoba | spinach:150 pork_shoulder:50 sausage:30 | para manicoba | bowl
Caldo de cana with pastel | sugarcane:250 flour:50 oil:15 mozzarella:30 | street pastel and cane juice | serving
Pastel de queijo | flour:50 oil:15 mozzarella:40 | cheese pastel | piece
Esfiha | flour:50 beef_mince:40 tomato:15 onion:10 | brazilian sfiha | serving (2)
Kibe (Brazilian) | bulgur:40 beef_mince:50 oil:15 | brazilian kibbeh | serving (2)
Empadinha de palmito | flour:40 butter:15 asparagus:40 milk:15 | heart of palm pie | serving (2)
Torta de frango | flour:50 milk:60 egg:20 chicken_meat:60 corn_canned:20 | brazilian chicken pie | slice
Salpicão | chicken_meat:80 carrots_raw:30 corn_canned:20 mayo:25 raisins:8 potato:30 | brazilian chicken salad | portion
Escondidinho de frango | cassava_cooked:180 chicken_meat:80 mozzarella:25 | chicken cassava bake | portion
Polenta frita | cornmeal:70 water:150 oil:15 | fried polenta | portion
Pão de queijo recheado | tapioca:50 mozzarella:30 milk:20 egg:10 ham_slice:15 | stuffed cheese bread | serving (3)
Canjica | hominy:100 milk:150 condensed:25 coconut_meat:10 peanuts:10 | sweet hominy porridge | bowl
Curau | corn:120 milk:120 sugar:20 sp_cinnamon:0.5 | sweet corn cream | bowl
Paçoca | peanuts:30 sugar:10 | peanut candy | piece
Pé de moleque | peanuts:30 brown_sugar:20 | peanut brittle brazil | piece
Beijinho | condensed:30 coconut_meat:8 butter:3 | coconut truffles | serving (3)
Romeu e Julieta | guava_paste:40 feta:40 | guava and cheese | serving
Pudim de leite condensado | condensed:60 milk:60 egg:30 sugar:10 | brazilian flan | slice
Mousse de maracujá | condensed:40 cream:40 passion:30 | passion fruit mousse | cup
Bolo de rolo | flour:20 sugar:20 butter:20 egg:20 guava_paste:30 | roll cake pernambuco | slice
Brigadeiro de colher | condensed:50 cocoa_powder:5 butter:5 | spoon brigadeiro | cup
Açaí na tigela with banana and granola | banana:80 strawberries:40 granola:40 honey:10 | acai bowl brazil | bowl
Caldo de feijão | black_beans:180 bacon:10 onion:15 water:150 | bean broth | cup
Guaraná-style homemade soda | sugar:30 water:300 lime:5 | brazilian soda homemade | glass
`);
X('Argentina', 'Argentine', SA, `
Milanesa de berenjena | eggplant:180 breadcrumbs:25 egg:20 oil:15 | eggplant milanesa | portion
Matambre arrollado | flank:150 egg_boiled:40 carrots:40 red_pepper:30 | rolled flank | slice (2)
Pastel de papa | beef_mince:110 mash:180 olives:10 egg_boiled:20 | argentine cottage pie | portion
Carbonada criolla | beef:100 pumpkin:80 corn:40 potato:50 peach:30 | argentine carbonada | bowl
Guiso de lentejas | lentils:180 chorizo:30 potato:50 carrots:30 | argentine lentil stew | bowl
Sorrentinos | pasta:150 ricotta:40 ham_slice:15 marinara:60 | argentine stuffed pasta | plate
Ñoquis del 29 | gnocchi:220 marinara:80 parmesan:10 | gnocchi day | plate
Revuelto gramajo | potato:100 oil:12 egg:100 ham:30 peas:20 | gramajo scramble | plate
Tortilla de papas (Argentine) | potato:150 egg:80 onion:30 oil:12 | argentine potato omelette | slice
Sándwich de miga | bread:60 ham_slice:30 swiss:20 butter:5 | crustless sandwich | serving (2)
Lomito completo | roll:90 beef_sirloin:100 ham_slice:20 swiss:20 egg_fried:50 lettuce:15 | lomito sandwich | sandwich
Humita en chala | corn:180 onion:20 milk:30 feta:20 | corn husk humita | serving (2)
Tamales salteños | cornmeal:80 beef:50 onion:15 lard:8 | salta tamales | serving (2)
Empanadas tucumanas | flour:50 lard:10 beef:50 onion:15 egg_boiled:10 | tucuman empanadas | serving (2)
Empanadas de jamón y queso | flour:50 butter:12 ham_slice:30 mozzarella:30 | ham cheese empanadas | serving (2)
Medialunas de grasa | flour:50 lard:12 | savory croissants | serving (2)
Vigilante | cheddar:40 guava_paste:40 | cheese and quince | serving
Arroz con leche (Argentine) | rice:50 milk:180 sugar:18 lemon:2 | argentine rice pudding | bowl
Flan con dulce de leche | milk:100 egg:35 sugar:20 condensed:20 | flan mixto | slice
Panqueques de manzana | flour:30 milk:60 egg:20 apple:60 sugar:10 | apple crepes | serving (2)
Torta rogel | flour:30 butter:12 egg:10 condensed:40 meringue:8 | layered dulce cake | slice
Chocotorta | shortbread:40 condensed:35 cream_cheese:35 cocoa_powder:2 | chocolate cookie cake | slice
`);
X('Peru', 'Peruvian', SA, `
Cau cau | tripe:120 potato:100 turmeric:2 mint:2 oil:8 | tripe stew peru | bowl
Carapulcra | potato:120 pork_shoulder:80 peanuts:15 onion:20 | dried potato stew | bowl
Seco de res | beef:130 coriander:10 kidney:80 rice:150 | peruvian beef stew | plate
Arroz con pato | rice:180 duck_meat:100 coriander:10 peas:20 | chiclayo duck rice | plate
Juane | rice:150 chicken_thigh:80 egg_boiled:25 olives:5 turmeric:1 | amazon juane | parcel
Tacacho con cecina | green_plantain:180 lard:10 pork_loin:80 | amazon plantain balls | plate
Chupe de camarones | shrimp:120 potato:80 milk:80 corn:40 egg:30 rice:30 water:150 | shrimp chowder peru | bowl
Parihuela | fish:100 shrimp:50 clams:40 tomato:60 water:200 | peruvian seafood soup | bowl
Sudado de pescado | fish:170 tomato:60 onion:30 rice:150 | fish stew peru | plate
Tiradito | fish:120 lime:20 chili:3 | peruvian tiradito | plate
Leche de tigre | fish:40 lime:30 onion:10 water:60 | tigers milk | glass
Anticuchos (beef heart-style beef) | beef:130 chili_powder:3 vinegar:5 potato:80 | anticuchos | serving (2)
Pollo a la brasa with fries | chicken_leg:200 fries:150 lettuce:30 | peruvian rotisserie chicken | plate
Salchipapa | sausage:80 fries:150 ketchup:15 mayo:10 | salchipapas | plate
Butifarra | roll:80 ham:60 onion:20 lime:5 | peruvian ham sandwich | sandwich
Triple sandwich | bread:80 avocado:40 tomato:40 egg_boiled:40 mayo:10 | triple peruano | sandwich
Papa rellena | potato:200 beef_mince:50 egg_boiled:15 olives:5 oil:15 | stuffed potato | piece
Yuquitas fritas | cassava:150 oil:15 | fried yuca | portion
Choclo con queso y huacatay | corn:150 feta:40 | corn cheese andes | plate
Quinotto | quinoa:180 mushrooms:50 parmesan:15 butter:8 | quinoa risotto | plate
Picante de quinua | quinoa:150 potato:60 feta:30 milk:30 | spicy quinoa stew | bowl
Mazamorra de calabaza | pumpkin:120 sugar:20 cornstarch:10 | pumpkin pudding | bowl
King kong | flour:40 butter:15 condensed:30 pineapple:20 peanuts:10 | lambayeque cookie | slice
Turrón de Doña Pepa | flour:40 butter:15 molasses:30 | october nougat | slice
Emoliente | barley:20 sugar:20 lemon:5 water:250 | herbal emoliente | glass
`);
X('Colombia', 'Colombian', SA, `
Sancocho de gallina | chicken_thigh:120 green_plantain:80 cassava_cooked:80 corn:40 potato:50 water:250 | hen sancocho | bowl
Mondongo (Colombian) | tripe:120 pork_shoulder:40 potato:80 cassava_cooked:40 water:200 | tripe soup | bowl
Cazuela de mariscos | shrimp:60 fish:60 clams:40 coconut_milk:60 tomato:40 | seafood casserole | bowl
Arroz con coco y pescado | rice:180 coconut_milk:50 fish:150 plantain_fried:60 | coastal fish plate | plate
Posta negra | beef:150 brown_sugar:15 soy:5 rice:150 | cartagena black beef | plate
Arroz atollado | rice:150 pork_shoulder:60 chicken_meat:50 potato:50 water:100 | valle soupy rice | plate
Lechona | pork_shoulder:120 rice:80 peas:20 | tolima lechona | portion
Tamal tolimense | masa:120 pork_shoulder:40 chicken_meat:30 egg_boiled:20 peas:15 | tolima tamal | tamal
Envuelto de mazorca | corn:150 sugar:10 butter:8 | sweet corn wrap | piece
Carimañola (Colombian) | cassava:100 beef_mince:40 oil:15 | colombian carimanola | serving (2)
Arepa boyacense | masa:80 cheddar:20 sugar:10 butter:8 | sweet boyaca arepa | arepa
Arepa santandereana | masa:90 oil:8 pork_belly:20 | santander arepa | arepa
Pan de yuca (Colombian) | tapioca:40 feta:30 egg:10 | colombian yuca bread | serving (3)
Mazamorra antioqueña | hominy:120 milk:150 brown_sugar:15 | corn drink with milk | glass
Natilla | milk:150 brown_sugar:25 cornstarch:15 sp_cinnamon:0.5 | christmas custard | portion
Postre de natas | milk:200 sugar:25 egg:20 raisins:8 | milk skin dessert | portion
Cholado | strawberries:40 papaya:40 banana:40 condensed:20 sugar:10 | cali shaved fruit | cup
Avena colombiana | oats:30 milk:200 sugar:15 sp_cinnamon:0.5 | colombian oat drink | glass
Lulada | oj:0 lime:15 sugar:25 water:200 pineapple:40 | | glass
`);
X('Venezuela', 'Venezuelan', SA, `
Asado negro | beef:150 brown_sugar:15 onion:20 rice:150 | caracas black roast | plate
Pisca andina | potato:80 egg:50 milk:100 onion:15 water:150 | andean breakfast soup | bowl
Mandocas | cornmeal:50 ripe_plantain:40 brown_sugar:10 oil:15 feta:15 | zulia corn rings | serving (3)
Patacón maracucho | green_plantain:200 oil:15 beef:60 cheddar:20 lettuce:15 | plantain sandwich | sandwich
Tostones con queso | green_plantain:150 oil:15 feta:30 | tostones cheese | serving
Cachito | flour:60 butter:12 ham_slice:30 | ham croissant venezuela | piece
Golfeados | flour:50 brown_sugar:20 feta:15 butter:8 | sweet cheese rolls | piece
Pan de jamón | flour:60 ham_slice:40 olives:10 raisins:10 | christmas ham bread | slice
Polvorosas | flour:30 lard:12 sugar:10 | venezuelan shortbread | serving (3)
Quesillo venezolano | condensed:50 milk:60 egg:35 sugar:10 | venezuelan flan | slice
Papelón con limón | brown_sugar:30 lime:15 water:250 | panela lemonade | glass
`);
X('Chile', 'Chilean', SA, `
Cazuela de vacuno | beef:100 potato:80 pumpkin:60 corn:40 rice:20 water:250 | chilean beef cazuela | bowl
Caldillo de congrio | fish:150 potato:80 tomato:40 onion:20 water:200 | conger eel soup | bowl
Paila marina | fish:60 mussels:50 clams:50 shrimp:30 water:200 | seafood stew chile | bowl
Machas a la parmesana | clams:100 parmesan:20 butter:10 | razor clams parmesan | plate
Chorrillana | fries:200 beef:80 onion:40 egg_fried:50 | chilean chorrillana | plate
Lomo a lo pobre | beef_sirloin:150 fries:150 egg_fried:100 onion:30 | steak poor man style | plate
Barros Luco | roll:80 beef_sirloin:80 cheddar:30 | barros luco sandwich | sandwich
Churrasco italiano | roll:80 beef_sirloin:80 avocado:40 tomato:30 mayo:15 | chilean steak sandwich | sandwich
Empanada de pino | flour:60 lard:10 beef_mince:60 onion:30 egg_boiled:15 olives:5 raisins:5 | pino empanada | piece
Sopaipillas pasadas | flour:40 pumpkin:30 oil:15 brown_sugar:20 | sopaipillas in syrup | serving (3)
Leche nevada | milk:150 egg:30 sugar:20 | floating islands chile | bowl
Alfajor chileno | flour:30 butter:10 condensed:30 dark_choc:10 | chilean alfajor | piece
Calzones rotos con manjar | flour:40 oil:15 sugar:10 condensed:20 | calzones manjar | serving (3)
`);
X('Ecuador', 'Ecuadorian', SA, `
Fanesca | fava:40 kidney:40 corn:40 pumpkin:60 salt_cod:30 milk:80 rice:20 | easter fanesca | bowl
Seco de chivo | goat:150 tomato:40 onion:20 rice:150 ripe_plantain:60 | goat stew ecuador | plate
Encocado de pescado | fish:170 coconut_milk:80 tomato:30 rice:150 | coconut fish ecuador | plate
Ceviche ecuatoriano de camarón | shrimp:120 tomato:60 oj:30 lime:15 onion:20 | ecuador shrimp ceviche | bowl
Hornado | pork_shoulder:150 potato:100 corn:50 | roast pork ecuador | plate
Guatita | tripe:120 potato:100 peanut_butter:20 | tripe peanut stew | bowl
Bolón de verde con chicharrón | green_plantain:180 pork_belly:30 butter:8 | bolon mixto | piece
Empanadas de viento | flour:50 oil:15 mozzarella:30 sugar:5 | wind empanadas | piece
Quimbolitos | flour:30 cornmeal:20 butter:15 sugar:15 egg:15 raisins:5 | steamed corn cakes | serving (2)
Higos con queso | figs:80 sugar:20 feta:40 | figs with cheese | serving
`);
X('Bolivia', 'Bolivian', SA, `
Pique macho | beef:100 sausage:50 fries:150 egg_boiled:30 tomato:30 green_pepper:20 | pique macho | plate
Majadito | rice:180 beef:60 egg_fried:50 ripe_plantain:60 | santa cruz rice | plate
Fricasé paceño | pork_shoulder:120 hominy:80 potato:80 water:200 | la paz fricase | bowl
Chairo | beef:60 potato:60 hominy:30 carrots:30 water:250 | andean chairo soup | bowl
Sajta de pollo | chicken_thigh:150 potato:80 onion:30 | bolivian chicken | plate
Plato paceño | corn:100 fava:60 potato:80 cheddar:30 | la paz plate | plate
Anticucho boliviano | beef:120 potato:80 peanuts:10 | bolivian anticucho | serving
Masaco | green_plantain:150 cheddar:30 lard:10 | mashed plantain bolivia | portion
Tawa tawa | flour:50 oil:15 honey:15 | bolivian fritters | serving (4)
Helado de canela | sugar:30 water:150 sp_cinnamon:1 | cinnamon ice | cup
`);
X('Uruguay', 'Uruguayan', SA, `
Chivito canadiense | roll:80 beef_sirloin:100 bacon:15 mozzarella:25 egg_fried:50 olives:10 lettuce:15 | chivito al plato | sandwich
Pizza al tacho | flour:70 marinara:30 mozzarella:40 | uruguayan pizza | slice
Fainá con pizza | chickpea_flour:40 olive_oil:8 flour:50 marinara:20 mozzarella:20 | pizza a caballo | slice
Buseca | tripe:80 kidney:60 chorizo:20 tomato_canned:80 | uruguayan tripe stew | bowl
Torta de fiambre | pie_crust:60 ham_slice:40 mozzarella:30 egg:20 | ham cheese pie | slice
Arroz con leche uruguayo | rice:50 milk:180 sugar:18 | uruguayan rice pudding | bowl
`);
X('Paraguay', 'Paraguayan', SA, `
So'o yosopy | beef_mince:100 rice:30 water:250 | beef soup paraguay | bowl
Pastel mandi'o | cassava:120 beef_mince:50 oil:15 | cassava empanada | serving (2)
Mbeju mestizo | tapioca:40 cornmeal:20 cheddar:30 milk:20 | mixed mbeju | piece
Chipa guasu | corn:150 cheddar:30 egg:20 milk:40 onion:15 | corn souffle | slice
Kosereva | oj:0 orange:80 molasses:30 | bitter orange candy | portion
Tereré-style iced yerba drink | green_tea:250 mint:2 | cold yerba drink | glass
`);
X('Cuba', 'Cuban', NA, `
Ropa vieja | flank:130 tomato:60 green_pepper:30 onion:20 rice:150 | cuban shredded beef | plate
Lechón asado | pork_shoulder:150 oj:20 garlic:4 | cuban roast pork | portion
Ajiaco cubano | beef:60 pork_shoulder:40 corn:40 cassava_cooked:60 taro:50 water:200 | cuban ajiaco | bowl
Arroz con pollo a la chorrera | rice:180 chicken_thigh:100 tomato:30 peas:20 red_pepper:20 | soupy chicken rice | plate
Tamal en cazuela | cornmeal:60 pork_shoulder:50 tomato:40 water:200 | cuban polenta stew | bowl
Fufú de plátano | green_plantain:200 pork_belly:20 garlic:3 | cuban plantain mash | portion
Frita cubana | beef_mince:100 roll:60 potato:30 oil:8 | cuban burger | sandwich
Medianoche | roll:80 pork_roast:50 ham_slice:30 swiss:20 pickles:10 | midnight sandwich | sandwich
Papa rellena cubana | potato:200 beef_mince:50 breadcrumbs:15 oil:15 | cuban stuffed potato | piece
Pan con lechón | roll:80 pork_shoulder:80 onion:15 | cuban pork sandwich | sandwich
Boniatillo | sweet_potato:120 sugar:25 egg:10 sp_cinnamon:0.5 | sweet potato pudding cuba | portion
Flan de coco | coconut_meat:30 condensed:40 egg:30 milk:40 | coconut flan | slice
Guava and cheese pastelito | puff_pastry:60 guava_paste:30 cream_cheese:20 | pastelito de guayaba y queso | pastry
Batido de mamey-style milkshake | papaya:120 milk:200 sugar:15 | cuban fruit shake | glass
`);
X('Puerto Rico', 'Puerto Rican', TE, `
Pernil | pork_shoulder:160 garlic:4 oregano:1 | puerto rican roast pork | portion
Pasteles puertorriqueños | green_plantain:120 taro:40 pork_shoulder:50 olives:5 | puerto rican pasteles | serving (2)
Asopao de pollo | rice:60 chicken_thigh:100 tomato:30 peas:20 water:250 | chicken asopao | bowl
Bacalaítos | salt_cod:30 flour:50 oil:15 | cod fritters puerto rico | serving (3)
Piononos | ripe_plantain:120 beef_mince:50 egg:15 oil:12 | stuffed plantain rolls | serving (2)
Sorullitos | cornmeal:50 cheddar:20 oil:15 | corn sticks | serving (4)
Tripleta | roll:90 beef:40 ham_slice:30 pork_shoulder:40 cheddar:15 | puerto rican tripleta | sandwich
Arroz con dulce | rice:60 coconut_milk:60 sugar:20 raisins:10 ginger:2 | coconut rice pudding pr | bowl
Flan de queso | cream_cheese:40 condensed:40 egg:30 milk:40 | cheese flan | slice
Coquito-style coconut drink (alcohol-free) | coconut_milk:120 condensed:40 evaporated:60 sp_cinnamon:0.5 | coconut eggnog no alcohol | glass
`);
X('Dominican Republic', 'Dominican', NA, `
Sancocho de siete carnes | beef:40 chicken_thigh:40 pork_shoulder:30 sausage:20 yam:60 plantain:50 corn:30 water:200 | seven meat sancocho | bowl
Chivo guisado | goat:160 tomato:40 onion:20 rice:150 | dominican goat stew | plate
Pescado con coco (Samaná) | fish:170 coconut_milk:80 tomato:30 rice:150 | samana coconut fish | plate
Locrio de pollo | rice:180 chicken_thigh:100 tomato_paste:15 oil:10 | dominican chicken rice | plate
Moro de guandules | rice:180 kidney:80 coconut_milk:30 | pigeon pea rice | plate
Chimichurri burger (Dominican chimi) | beef_patty:100 roll:70 cabbage:30 ketchup:10 mayo:10 | dominican chimi | sandwich
Quipe | bulgur:40 beef_mince:50 oil:15 | dominican kibbeh | serving (2)
Pastelitos dominicanos | flour:50 oil:15 beef_mince:40 | dominican turnovers | serving (2)
Kipes de yuca | cassava:100 cheddar:20 oil:15 | yuca kipes | serving (2)
Dulce de leche cortada | milk:200 sugar:30 lemon:5 | curdled milk sweet | portion
Majarete | corn:120 coconut_milk:60 sugar:25 cornstarch:10 | corn pudding dominican | portion
Morir soñando | milk:150 oj:120 sugar:15 | dominican orange milk | glass
`);
X('Haiti', 'Haitian', NA, `
Diri ak pwa wouj | rice:180 kidney:100 oil:10 | rice and red beans haiti | plate
Bouillon (Haitian) | beef:80 spinach:60 yam:60 plantain:60 carrots:30 water:250 | haitian bouyon | bowl
Lambi creole | clams:150 tomato:60 onion:20 oil:10 | conch in creole sauce | portion
Poul nan sòs | chicken_thigh:160 tomato:50 onion:20 oil:10 rice:150 | haitian stewed chicken | plate
Mayi moulen ak sòs pwa | cornmeal:80 water:200 kidney:80 coconut_milk:20 | cornmeal with bean sauce | plate
Bannann peze | green_plantain:180 oil:20 | haitian fried plantain | serving
Pate kode | flour:60 oil:15 beef_mince:40 | haitian patties | piece
Kremas-style coconut cream drink (alcohol-free) | coconut_milk:100 condensed:40 evaporated:60 sp_nutmeg:0.5 | kremas no alcohol | glass
Dous makos | condensed:40 sugar:20 cocoa_powder:3 | haitian fudge | piece
`);
X('Jamaica', 'Jamaican', NA, `
Stew chicken (Jamaican) | chicken_thigh:160 brown_sugar:5 tomato:30 carrots:30 rice:150 | jamaican stew chicken | plate
Curry chicken back | chicken_meat:120 potato:60 curry:5 rice:150 | jamaican curry chicken back | plate
Brown stew fish | fish:180 tomato:40 onion:20 green_pepper:20 oil:10 | jamaican brown stew fish | portion
Escovitch fish with bammy | fish:180 oil:20 vinegar:15 carrots_raw:20 cassava_cooked:80 | fried fish bammy | plate
Fish tea | fish:80 potato:40 yam:40 water:250 | jamaican fish soup | bowl
Mannish water-style goat soup | goat:100 yam:60 green_plantain:50 flour:20 water:250 | goat soup jamaica | bowl
Saltfish fritters | salt_cod:40 flour:50 oil:15 onion:10 | stamp and go | serving (4)
Steamed callaloo with breadfruit | spinach:120 breadfruit:150 onion:15 oil:8 | callaloo breadfruit | plate
Roast breadfruit and ackee | breadfruit:180 ackee:100 oil:8 | breadfruit and ackee | plate
Rice and peas with oxtail gravy | rice:180 kidney:60 coconut_milk:30 gravy:40 | rice and peas gravy | plate
Ital run down | coconut_milk:120 pumpkin:80 carrots:40 kidney:60 | vegan rundown | bowl
Ital vegetable patty | flour:60 butter:15 carrots:30 cabbage:30 curry:2 | vegetable patty jamaica | patty
Cheese patty | flour:60 butter:15 cheddar:40 | jamaican cheese patty | patty
Coco bread with patty | flour:80 butter:15 coconut_milk:30 beef_mince:50 | patty in coco bread | sandwich
Fried breadfruit | breadfruit:150 oil:15 | jamaican fried breadfruit | serving
Plantain tarts | pie_crust:40 ripe_plantain:60 sugar:10 | jamaican plantain tart | tart
Easter bun with cheese | flour:60 molasses:15 raisins:15 brown_sugar:12 cheddar:30 | easter bun and cheese | serving
Cornmeal pudding | cornmeal:40 coconut_milk:60 brown_sugar:25 raisins:10 | jamaican cornmeal pudding | slice
Blue draws | cornmeal:30 sweet_potato:50 coconut_milk:40 brown_sugar:20 | duckunoo | parcel
Asham | corn:40 brown_sugar:15 | parched corn sweet | serving
Irish moss-style drink | milk:200 condensed:30 sp_nutmeg:0.5 | jamaican irish moss | glass
`);
X('Trinidad and Tobago', 'Trinidadian', NA, `
Curry crab and dumpling | crab:150 curry:5 coconut_milk:40 flour:60 | tobago crab dumpling | plate
Bake and shark | flour:70 oil:20 fish:100 lettuce:15 tomato:20 | maracas bake and shark | sandwich
Callaloo (Trinidadian) | spinach:150 okra:40 coconut_milk:60 crab:30 | trini callaloo | bowl
Stewed chicken (Trini) | chicken_thigh:160 brown_sugar:8 tomato:30 rice:150 | trini stew chicken | plate
Curry duck | duck_meat:150 curry:5 potato:60 | trini curry duck | portion
Macaroni pie (Trini) | pasta:150 cheddar:40 egg:20 evaporated:40 | trini macaroni pie | slice
Corn soup (Trinidad) | corn:100 split_peas:40 pumpkin:50 dumplings_alt:0 water:250 | trini corn soup | bowl
Bhaji (Trinidad) | spinach:150 onion:15 garlic:3 oil:8 | trini spinach bhaji | portion
Aloo pie with channa | flour:50 potato:60 oil:15 chickpeas:50 | aloo pie stuffed | pie
Chow (pineapple) | pineapple:150 garlic:2 chili:2 lime:5 | pineapple chow | cup
Pastelles | cornmeal:60 beef_mince:50 olives:5 raisins:5 | trini pastelles | parcel
Black cake (alcohol-free, Trinidad) | flour:30 raisins:25 prunes:15 brown_sugar:20 butter:15 egg:15 | trini fruit cake no alcohol | slice
Sorrel (Trinidad, alcohol-free) | roselle:10 sugar:25 sp_cloves:0.5 water:250 | trini sorrel | glass
Mauby | sugar:25 water:250 sp_cinnamon:0.5 | mauby drink | glass
`);
X('Barbados', 'Barbadian', NA, `
Flying fish and cou-cou | fish:150 cornmeal:60 okra:40 tomato:40 butter:8 | bajan national dish | plate
Fish cutter | roll:70 fish:100 oil:10 | bajan cutter | sandwich
Bajan pepperpot | beef:120 pork_shoulder:40 molasses:5 | barbados pepperpot | bowl
Jug jug | split_peas:60 cornmeal:30 beef:40 ham:20 | christmas jug jug | portion
Conkies | cornmeal:40 sweet_potato:40 pumpkin:30 coconut_meat:15 sugar:15 raisins:8 | bajan conkies | parcel
Turnovers (Bajan) | flour:50 butter:15 coconut_meat:25 sugar:15 | coconut turnover | piece
`);
X('The Bahamas', 'Bahamian', NA, `
Conch salad | clams:120 tomato:40 onion:20 green_pepper:20 lime:15 oj:10 | bahamian conch salad | bowl
Conch fritters | clams:50 flour:50 oil:15 green_pepper:10 | bahamian conch fritters | serving (5)
Stew fish (Bahamian) | fish:170 tomato:40 onion:20 flour:10 | bahamian stew fish | portion
Souse (Bahamian chicken) | chicken_meat:120 potato:60 lime:15 onion:20 water:200 | chicken souse | bowl
`);
X('Guatemala', 'Guatemalan', NA, `
Kak'ik | turkey:150 tomato:60 chili_powder:3 water:200 | mayan turkey soup | bowl
Jocón | chicken_thigh:150 tomatillo:80 green_pepper:30 coriander:5 rice:120 | green chicken stew | plate
Hilachas | beef:130 tomato:60 potato:60 | shredded beef guatemala | plate
Subanik | beef:60 chicken_thigh:60 pork_shoulder:40 tomato:60 | mixed meat stew | bowl
Shucos | roll:70 sausage:60 cabbage:30 guacamole:20 | guatemalan hot dog | hot dog
Garnachas guatemaltecas | corn_tortilla:50 oil:12 beef_mince:40 cabbage:20 | guatemalan garnachas | serving (4)
Chiles rellenos guatemaltecos | green_pepper:150 pork_mince:60 carrots:30 green_beans:20 egg:20 oil:15 | guatemalan stuffed peppers | serving
Fiambre | ham_slice:30 sausage:30 chicken_meat:30 beets:40 carrots:30 cauliflower:30 green_beans:30 cheddar:15 | all saints salad | plate
Atol de plátano | ripe_plantain:120 milk:150 sugar:10 | plantain atole | cup
`);
X('El Salvador', 'Salvadoran', NA, `
Sopa de pata | beef:80 corn:40 yam:40 cabbage:40 water:250 | cow foot soup | bowl
Gallo en chicha (alcohol-free) | chicken_thigh:150 brown_sugar:10 prunes:10 | salvadoran chicken stew | plate
Panes con pollo | roll:80 chicken_meat:80 tomato:40 cucumber:20 | salvadoran chicken sandwich | sandwich
Yuca frita con curtido | cassava:150 oil:15 cabbage:50 vinegar:5 | fried yuca salvador | plate
Empanadas de leche | ripe_plantain:120 milk:60 sugar:15 cornstarch:8 oil:10 | plantain custard empanadas | serving (2)
Atol de elote salvadoreño | corn:100 milk:150 sugar:15 | salvadoran corn atole | cup
`);
X('Honduras', 'Honduran', NA, `
Pollo con tajadas | chicken_fried:150 green_plantain:120 oil:12 cabbage:40 | honduran chicken plantain | plate
Sopa de frijoles con costilla | kidney:150 ribs:80 water:200 | bean soup with ribs | bowl
Enchiladas hondureñas | taco_shell:30 beef_mince:60 cabbage:30 egg_boiled:20 tomato:30 | honduran enchiladas | serving (3)
Montucas | corn:150 pork_shoulder:40 | honduran corn tamal | piece
Torrejas (Honduran) | bread:60 egg:30 brown_sugar:25 sp_cinnamon:0.5 | holy week torrejas | serving (2)
`);
X('Nicaragua', 'Nicaraguan', NA, `
Indio viejo nicaragüense | beef:100 cornmeal:40 tomato:40 oj:10 | nica indio viejo | bowl
Baho | beef:120 green_plantain:100 cassava_cooked:80 | nicaraguan baho | plate
Sopa de albóndigas | chicken_mince:80 cornmeal:20 potato:40 water:250 | nica meatball soup | bowl
Nacatamal de cerdo | masa:120 pork_shoulder:60 potato:20 rice:15 | nicaraguan pork tamal | tamal
Güirila | corn:150 sugar:10 milk:20 feta:30 | sweet corn tortilla cheese | piece
Pío V | cornmeal:30 sugar:25 butter:12 milk:40 egg:15 | pio quinto cake | slice
Cajeta de leche | milk:150 sugar:30 | milk candy | piece
`);
X('Costa Rica', 'Costa Rican', NA, `
Chifrijo | rice:100 kidney:80 pork_belly:40 tomato:30 avocado:30 | costa rican chifrijo | bowl
Arroz con camarones | rice:180 shrimp:100 red_pepper:20 oil:8 | costa rican shrimp rice | plate
Picadillo de papa | potato:150 beef_mince:50 onion:15 | potato hash costa rica | portion
Rice and beans, Caribbean coast | rice:180 kidney:80 coconut_milk:40 | limon rice and beans | plate
Rondón | fish:80 green_plantain:60 cassava_cooked:60 coconut_milk:100 | caribbean rondon | bowl
Patí | flour:60 butter:15 beef_mince:40 | limon pati | piece
Tres leches (Costa Rica) | sponge:60 milk:40 condensed:30 evaporated:30 cream:15 | costa rican tres leches | slice
`);
X('Panama', 'Panamanian', NA, `
Ropa vieja panameña | flank:130 tomato:50 green_pepper:20 rice:150 | panama ropa vieja | plate
Tamal de olla | cornmeal:60 chicken_meat:60 tomato:30 olives:5 | panama pot tamal | portion
Bollos de maíz | corn:150 butter:5 | panama corn bollos | piece
Arroz con guandú y coco | rice:180 kidney:70 coconut_milk:40 | pigeon pea rice panama | plate
Raspao | sugar:25 condensed:20 water:150 | panama shaved ice | cup
Chicheme | corn:60 milk:150 sugar:15 sp_cinnamon:0.5 | panama corn drink | glass
`);
X('Belize', 'Belizean', NA, `
Relleno negro | turkey:120 chili_powder:5 egg_boiled:25 water:200 | black soup belize | bowl
Escabeche (Belizean) | chicken_meat:100 onion:60 vinegar:10 corn_tortilla:40 | belize onion soup | bowl
Boil-up | fish:100 egg_boiled:50 cassava_cooked:60 green_plantain:60 sweet_potato:50 tomato:30 | belize boil up | plate
Cow foot soup (Belize) | beef:80 cassava_cooked:50 carrots:30 water:250 | belize cow foot soup | bowl
Hudut with fish | fish:150 coconut_milk:100 green_plantain:150 | garifuna hudut | bowl
Belizean meat pie | flour:50 butter:15 beef_mince:50 | belize meat pie | pie
`);
X('Grenada', 'Grenadian', NA, `
Grenadian oil down with breadfruit | breadfruit:150 salt_cod:40 coconut_milk:100 spinach:30 | oil down | bowl
Lambie souse | clams:120 lime:15 cucumber:30 onion:15 | conch souse | bowl
Grenada cocoa tea | cocoa_powder:12 milk:150 sugar:15 sp_nutmeg:0.5 | cocoa tea | cup
`);
X('Saint Lucia', 'Saint Lucian', NA, `
Bouyon (Saint Lucian) | kidney:60 beef:60 yam:60 dumplings_alt:0 flour:20 water:250 | st lucian soup | bowl
Accra with bakes | salt_cod:40 flour:100 oil:25 | st lucia accra bake | serving
Green fig salad | green_plantain:150 mayo:20 onion:15 | st lucian fig salad | portion
`);
X('Saint Vincent and the Grenadines', 'Vincentian', NA, `
Callaloo and saltfish (Vincentian) | spinach:120 salt_cod:60 onion:15 oil:8 | vincy callaloo saltfish | plate
Breadfruit balls | breadfruit:120 salt_cod:20 flour:10 oil:15 | vincy breadfruit balls | serving (3)
Duckanoo (Vincentian) | cornmeal:40 coconut_meat:20 sugar:15 | vincy duckanoo | parcel
`);
X('Dominica', 'Dominican (Dominica)', NA, `
Crab backs | crab:120 breadcrumbs:15 butter:10 onion:15 | crab backs | serving
Titiri-style fish fritters | fish:50 flour:40 oil:15 | dominica fish fritters | serving (4)
Kubouyon | fish:120 tomato:40 onion:20 water:150 | dominica fish broth | bowl
`);
X('Antigua and Barbuda', 'Antiguan', NA, `
Antiguan pepperpot with fungee | spinach:100 eggplant:50 pumpkin:50 beef:50 cornmeal:70 okra:30 | pepperpot and fungi | plate
Antiguan saltfish breakfast | salt_cod:70 tomato:30 onion:20 oil:8 bread:60 | antigua breakfast | plate
`);
X('Saint Kitts and Nevis', 'Kittitian', NA, `
Kittitian stewed goat | goat:150 tomato:40 onion:20 | stewed goat st kitts | portion
Coconut tart (Kittitian) | pie_crust:40 coconut_meat:30 sugar:20 | kittitian coconut tart | tart
`);

console.log(`everyday dishes left to real measured records: ${preferred.length}`);
if (process.env.SHOW_PREFERRED) console.log(preferred.join('\n'));
// ---- write out ----
const LATER = new Set(NEW.slice(LATER_FROM).map((r) => r.name));
RECIPES.push(...NEW);
const total = Object.keys(coverage).length;
const out = Object.fromEntries(Object.entries(coverage).map(([c, v]) => [c, { demonym: v.demonym, region: v.region, dishes: [...new Set(v.dishes)] }]));
writeFileSync(new URL('../src/data/countryDishes.ts', import.meta.url), `// Generated by scripts/recipes-countries.mjs: every country and territory with its dishes.\nexport const COUNTRY_DISHES: Record<string, { demonym: string; region: string; dishes: string[] }> = ${JSON.stringify(out)};\n`);
console.error(`recipes-countries: ${NEW.length} new dishes, ${total} countries/territories/lists; ${missingRefs.length} references not found${missingRefs.length ? `: ${missingRefs.join('; ')}` : ''}`);
export { RECIPES, K, LATER, coverage };
