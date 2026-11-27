import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { FoodVisual } from './FoodIcon';
import { haptic } from './fx';

/** Dishes from many cuisines (each one exists in the database; tapping searches for it). */
const WORLD: { label: string; q: string; cuisine: string }[] = [
  { label: 'Grilled chicken', q: 'chicken breast roasted', cuisine: 'American' },
  { label: 'Sushi', q: 'sushi', cuisine: 'Japanese' },
  { label: 'Spaghetti', q: 'spaghetti with meat sauce', cuisine: 'Italian' },
  { label: 'Beef curry', q: 'beef curry', cuisine: 'Indian' },
  { label: 'Tacos', q: 'taco', cuisine: 'Mexican' },
  { label: 'Jollof rice', q: 'jollof', cuisine: 'West African' },
  { label: 'Salmon', q: 'salmon cooked', cuisine: 'Mediterranean' },
  { label: 'Pad Thai', q: 'pad thai', cuisine: 'Thai' },
  { label: 'Hummus', q: 'hummus', cuisine: 'Middle Eastern' },
  { label: 'Burger', q: 'cheeseburger', cuisine: 'Fast food' },
  { label: 'Pizza', q: 'pizza cheese', cuisine: 'Fast food' },
  { label: 'Ramen', q: 'ramen', cuisine: 'Japanese' },
  { label: 'Fries', q: 'french fries', cuisine: 'Fast food' },
  { label: 'Fried chicken', q: 'fried chicken', cuisine: 'Fast food' },
  { label: 'Doner kebab', q: 'doner kebab', cuisine: 'Fast food' },
  { label: 'Biryani', q: 'biryani', cuisine: 'Pakistani' },
  { label: 'Paella', q: 'paella', cuisine: 'Spanish' },
  { label: 'Bibimbap', q: 'bibimbap', cuisine: 'Korean' },
  { label: 'Tikka masala', q: 'chicken tikka masala', cuisine: 'Indian' },
  { label: 'Caesar salad', q: 'caesar salad', cuisine: 'American' },
  { label: 'Greek yogurt', q: 'yogurt greek plain', cuisine: 'Mediterranean' },
  { label: 'Injera', q: 'injera', cuisine: 'East African' },
  { label: 'Empanada', q: 'empanada', cuisine: 'Latin American' },
  { label: 'Falafel', q: 'falafel', cuisine: 'Middle Eastern' },
  { label: 'Shepherd’s pie', q: 'shepherd', cuisine: 'British' },
  { label: 'Fried rice', q: 'fried rice', cuisine: 'Chinese' },
  { label: 'Pierogi', q: 'pierogi', cuisine: 'Eastern European' },
  { label: 'Plantain', q: 'plantain cooked', cuisine: 'Caribbean' },
  { label: 'Adobo', q: 'adobo', cuisine: 'Filipino' },
];

type Pick = { label: string; q: string; cuisine: string };
const r = (cuisine: string, items: string[]): Pick[] => items.map((x) => { const [label, q] = x.split('|'); return { label, q: (q ?? label).toLowerCase(), cuisine }; });
/** Everyday local dishes per region, shown first for people there (every region, not just one). */
const LOCAL: [RegExp, Pick[]][] = [
  [/nigeria|ghana|benin|togo|cameroon|sierra leone|liberia|senegal|gambia|ivory|côte|cote|burkina|niger\b|mali|guinea|mauritania|cabo verde|cape verde/i, r('West African', ['Jollof rice', 'Egusi soup', 'Waakye', 'Thieboudienne', 'Fufu and light soup', 'Moi moi', 'Suya', 'Yassa chicken', 'Attiéké with grilled fish', 'Kelewele', 'Beans and fried plantain', 'Ndolé'])],
  [/kenya|tanzania|uganda|rwanda|burundi|ethiopia|eritrea|somalia|djibouti|south sudan|sudan/i, r('East African', ['Ugali', 'Pilau', 'Nyama choma', 'Chapati and beans', 'Injera', 'Doro wat', 'Shiro', 'Rolex', 'Chips mayai', 'Mandazi', 'Sukuma wiki', 'Suqaar'])],
  [/south africa|namibia|botswana|zimbabwe|zambia|malawi|mozambique|lesotho|eswatini|swaziland|angola|madagascar|mauritius/i, r('Southern African', ['Pap and wors', 'Bobotie', 'Bunny chow', 'Chakalaka', 'Sadza and beef stew', 'Nshima with chicken', 'Piri piri chicken', 'Potjiekos', 'Vetkoek', 'Durban curry'])],
  [/morocco|algeria|tunisia|libya|egypt|western sahara/i, r('North African', ['Couscous royale', 'Chicken tagine', 'Harira', 'Koshari', 'Ful medames', 'Lamb tagine with prunes', 'Shakshuka', 'Brik', 'Taameya', 'Molokhia'])],
  [/india|pakistan|bangladesh|sri lanka|nepal|bhutan|maldives/i, r('South Asian', ['Chicken biryani', 'Dal tadka', 'Chana masala', 'Butter chicken', 'Masala dosa', 'Aloo paratha', 'Rajma chawal', 'Palak paneer', 'Chicken karahi', 'Idli sambar', 'Samosa', 'Kottu roti'])],
  [/china|taiwan|hong kong|macau/i, r('Chinese', ['Egg fried rice', 'Kung pao chicken', 'Mapo tofu', 'Chicken chow mein', 'Pork and chive dumplings', 'Char siu pork with rice', 'Hot and sour soup', 'Chicken congee', 'Xiaolongbao', 'Beef ho fun'])],
  [/japan/i, r('Japanese', ['Chicken teriyaki with rice', 'Salmon sushi roll', 'Shoyu ramen', 'Miso soup', 'Gyudon', 'Chicken katsu curry', 'Onigiri', 'Chicken karaage', 'Gyoza', 'Okonomiyaki'])],
  [/korea/i, r('Korean', ['Beef bibimbap', 'Bulgogi', 'Kimchi fried rice', 'Kimchi jjigae', 'Japchae', 'Kimbap', 'Dak galbi', 'Korean fried chicken', 'Sundubu jjigae'])],
  [/thailand|vietnam|cambodia|laos|myanmar|malaysia|singapore|indonesia|philippines|brunei|timor/i, r('South-East Asian', ['Pad thai with chicken', 'Nasi goreng', 'Beef pho', 'Chicken adobo', 'Nasi lemak', 'Thai green curry with chicken', 'Banh mi', 'Chicken satay', 'Laksa', 'Hainanese chicken rice', 'Pancit canton', 'Tom yum'])],
  [/saudi|emirates|uae|qatar|kuwait|bahrain|oman|yemen|iraq|jordan|lebanon|syria|palestine|israel|türkiye|turkey|iran|cyprus/i, r('Middle Eastern', ['Chicken shawarma wrap', 'Kabsa', 'Hummus', 'Falafel', 'Mandi', 'Lamb kofta with rice', 'Shish tawook plate', 'Fattoush', 'Lahmacun', 'Kebab koobideh', 'Mansaf', 'Baklava'])],
  [/mexico|guatemala|honduras|el salvador|nicaragua|costa rica|panama|belize/i, r('Mexican & Central American', ['Chicken tacos', 'Carne asada tacos', 'Chicken burrito', 'Chicken enchiladas', 'Gallo pinto', 'Huevos rancheros', 'Pozole rojo', 'Chilaquiles rojos', 'Cheese quesadilla', 'Guacamole'])],
  [/jamaica|trinidad|barbados|bahamas|haiti|cuba|dominican|puerto rico|grenada|lucia|vincent|kitts|antigua|dominica|aruba|curaçao|curacao|martinique|guadeloupe|guyana|suriname/i, r('Caribbean', ['Jerk chicken', 'Rice and peas with jerk chicken', 'Curry goat', 'Ackee and saltfish', 'Brown stew chicken', 'Doubles', 'Chicken roti (Trinidad)', 'Griot', 'Cuban sandwich', 'Arroz con gandules', 'Callaloo', 'Oxtail and rice'])],
  [/brazil|argentina|colombia|peru|chile|venezuela|ecuador|bolivia|paraguay|uruguay/i, r('South American', ['Feijoada', 'Arroz con pollo', 'Beef empanadas', 'Arepa reina pepiada', 'Lomo saltado', 'Ceviche', 'Pollo a la brasa with fries', 'Bandeja paisa', 'Churrasco', 'Pão de queijo'])],
  [/united kingdom|\buk\b|england|scotland|wales|ireland/i, r('British & Irish', ['Fish and chips', 'Full English breakfast', 'Sunday roast', 'Shepherd’s pie', 'Bangers and mash', 'Jacket potato with cheese', 'Beans on toast', 'Chicken tikka masala', 'Cornish pasty', 'Porridge with banana and honey'])],
  [/united states|usa|america|canada/i, r('North American', ['Cheeseburger', 'Fried chicken with fries', 'Mac and cheese', 'Chicken Caesar salad', 'Pancakes with bacon and syrup', 'BBQ ribs', 'Burrito bowl', 'Philly cheesesteak', 'Poutine', 'Buffalo wings'])],
  [/italy|spain|portugal|greece|malta|france|monaco|san marino|andorra|vatican/i, r('Mediterranean European', ['Spaghetti carbonara', 'Margherita pizza', 'Seafood paella', 'Greek salad', 'Moussaka', 'Quiche lorraine', 'Piri piri chicken', 'Risotto', 'Gazpacho', 'Croque monsieur'])],
  [/germany|austria|switzerland|netherlands|belgium|luxembourg|denmark|sweden|norway|finland|iceland|poland|czech|slovakia|hungary|romania|bulgaria|russia|ukraine|belarus|serbia|croatia|bosnia|slovenia|albania|macedonia|montenegro|kosovo|moldova|estonia|latvia|lithuania/i, r('European', ['Pork schnitzel', 'Bratwurst with sauerkraut', 'Hungarian goulash', 'Borscht', 'Potato pierogi', 'Swedish meatballs', 'Beef stroganoff', 'Rösti', 'Stamppot', 'Käsespätzle'])],
  [/australia|new zealand|fiji|samoa|tonga|papua|solomon|vanuatu|kiribati|tuvalu|nauru|palau|marshall|micronesia|cook islands|niue|polynesia|caledonia|guam/i, r('Oceanian', ['Meat pie', 'Vegemite toast', 'Fish and chips', 'Kokoda', 'Lovo', 'Hangi', 'Lamington', 'Pavlova', 'Avocado toast', 'Sausage roll'])],
];
export function WorldFoods({ onSearch }: { onSearch: (q: string) => void }) {
  const liked = useStore((s) => s.profile?.cuisines);
  const country = useStore((s) => s.profile?.country ?? '');
  const localList = LOCAL.find(([re]) => re.test(country))?.[1] ?? null;
  const local = !!localList;
  // Cuisines the person likes come first, but the row always stays mixed.
  const items = useMemo(() => {
    // Local dishes first for West Africa, then the rest of the world.
    if (localList) return [...localList, ...WORLD.filter((w) => !localList.some((x) => x.label === w.label))];
    if (!liked?.length) return WORLD;
    const fav = WORLD.filter((w) => liked.includes(w.cuisine));
    const rest = WORLD.filter((w) => !liked.includes(w.cuisine));
    // The row always opens with a couple of everyday picks, then mixes in their cuisines.
    const out: typeof WORLD = rest.splice(0, 2);
    while (fav.length || rest.length) {
      if (fav.length) out.push(fav.shift()!);
      if (rest.length) out.push(rest.shift()!);
    }
    return out;
  }, [liked, localList]);

  return (
    <section className="mb-5">
      <p className="mb-2.5 px-1 text-[15px] font-semibold">{local ? 'Popular near you' : 'Popular around the world'}</p>
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
        {items.map((w) => {
          return (
            <button key={w.label} onClick={() => { haptic(); onSearch(w.q); }} className="w-24 shrink-0 text-left transition active:scale-95">
              <div className="overflow-hidden rounded-[22px]" style={{ boxShadow: 'var(--shadow)' }}>
                <FoodVisual name={w.label} size={96} />
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold">{w.label}</p>
              <p className="truncate text-xs text-silver">{w.cuisine}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
