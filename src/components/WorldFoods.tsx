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

/** West African everyday dishes, shown first for people there (or who chose these cuisines). */
const WEST_AFRICA: { label: string; q: string; cuisine: string }[] = [
  { label: 'Jollof rice', q: 'jollof rice', cuisine: 'Nigerian' }, { label: 'Egusi soup', q: 'egusi soup', cuisine: 'Nigerian' },
  { label: 'Pounded yam', q: 'pounded yam', cuisine: 'Nigerian' }, { label: 'Suya', q: 'suya', cuisine: 'Nigerian' },
  { label: 'Moi moi', q: 'moi moi', cuisine: 'Nigerian' }, { label: 'Akara', q: 'akara', cuisine: 'Nigerian' },
  { label: 'Fried rice', q: 'nigerian fried rice', cuisine: 'Nigerian' }, { label: 'Beans porridge', q: 'beans porridge', cuisine: 'Nigerian' },
  { label: 'Eba', q: 'eba', cuisine: 'Nigerian' }, { label: 'Dodo', q: 'fried plantain', cuisine: 'Nigerian' },
  { label: 'Efo riro', q: 'efo riro', cuisine: 'Nigerian' }, { label: 'Amala', q: 'amala', cuisine: 'Nigerian' },
  { label: 'Waakye', q: 'waakye', cuisine: 'Ghanaian' }, { label: 'Kelewele', q: 'kelewele', cuisine: 'Ghanaian' },
];
const WA_COUNTRIES = /nigeria|ghana|benin|togo|cameroon|sierra leone|liberia|senegal|gambia|ivory|côte|cote|burkina|niger\b|mali/i;

export function WorldFoods({ onSearch }: { onSearch: (q: string) => void }) {
  const liked = useStore((s) => s.profile?.cuisines);
  const country = useStore((s) => s.profile?.country ?? '');
  const local = WA_COUNTRIES.test(country) || !!liked?.some((c) => /nigerian|ghanaian|west african/i.test(c));
  // Cuisines the person likes come first, but the row always stays mixed.
  const items = useMemo(() => {
    // Local dishes first for West Africa, then the rest of the world.
    if (local) return [...WEST_AFRICA, ...WORLD.filter((w) => !WEST_AFRICA.some((x) => x.label === w.label))];
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
  }, [liked, local]);

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
