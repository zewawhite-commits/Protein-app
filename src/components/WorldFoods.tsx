import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { iconFor } from '@/data/foodArt';
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

export function WorldFoods({ onSearch }: { onSearch: (q: string) => void }) {
  const liked = useStore((s) => s.profile?.cuisines);
  // Cuisines the person likes come first, but the row always stays mixed.
  const items = useMemo(() => {
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
  }, [liked]);

  return (
    <section className="mb-5">
      <p className="mb-2.5 px-1 text-[15px] font-semibold">Popular around the world</p>
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
        {items.map((w) => {
          const Icon = iconFor(w.label);
          return (
            <button key={w.label} onClick={() => { haptic(); onSearch(w.q); }} className="w-24 shrink-0 text-left transition active:scale-95">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-[22px] bg-surface" style={{ boxShadow: 'var(--shadow)' }}>
                <Icon size={34} strokeWidth={1.7} />
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
