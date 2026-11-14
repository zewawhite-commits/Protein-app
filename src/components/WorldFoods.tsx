import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { artFor, artUrl } from '@/data/foodArt';
import { haptic } from './fx';

/** Dishes from many cuisines (each one exists in the database; tapping searches for it). */
const WORLD: { label: string; q: string; emoji: string; cuisine: string }[] = [
  { label: 'Grilled chicken', q: 'chicken breast roasted', emoji: '🍗', cuisine: 'American' },
  { label: 'Sushi', q: 'sushi', emoji: '🍣', cuisine: 'Japanese' },
  { label: 'Spaghetti', q: 'spaghetti with meat sauce', emoji: '🍝', cuisine: 'Italian' },
  { label: 'Beef curry', q: 'beef curry', emoji: '🍛', cuisine: 'Indian' },
  { label: 'Tacos', q: 'taco', emoji: '🌮', cuisine: 'Mexican' },
  { label: 'Jollof rice', q: 'jollof', emoji: '🍚', cuisine: 'West African' },
  { label: 'Salmon', q: 'salmon cooked', emoji: '🐟', cuisine: 'Mediterranean' },
  { label: 'Pad Thai', q: 'pad thai', emoji: '🍜', cuisine: 'Thai' },
  { label: 'Hummus', q: 'hummus', emoji: '🧆', cuisine: 'Middle Eastern' },
  { label: 'Burger', q: 'hamburger', emoji: '🍔', cuisine: 'Fast food' },
  { label: 'Ramen', q: 'ramen', emoji: '🍜', cuisine: 'Japanese' },
  { label: 'Biryani', q: 'biryani', emoji: '🍛', cuisine: 'Pakistani' },
  { label: 'Paella', q: 'paella', emoji: '🥘', cuisine: 'Spanish' },
  { label: 'Bibimbap', q: 'bibimbap', emoji: '🍲', cuisine: 'Korean' },
  { label: 'Egusi soup', q: 'egusi', emoji: '🥣', cuisine: 'West African' },
  { label: 'Greek yogurt', q: 'yogurt greek plain', emoji: '🥛', cuisine: 'Mediterranean' },
  { label: 'Injera', q: 'injera', emoji: '🫓', cuisine: 'East African' },
  { label: 'Empanada', q: 'empanada', emoji: '🥟', cuisine: 'Latin American' },
  { label: 'Falafel', q: 'falafel', emoji: '🧆', cuisine: 'Middle Eastern' },
  { label: 'Shepherd’s pie', q: 'shepherd', emoji: '🥧', cuisine: 'British' },
  { label: 'Fried rice', q: 'fried rice', emoji: '🍚', cuisine: 'Chinese' },
  { label: 'Pierogi', q: 'pierogi', emoji: '🥟', cuisine: 'Eastern European' },
  { label: 'Plantain', q: 'plantain cooked', emoji: '🍌', cuisine: 'Caribbean' },
  { label: 'Adobo', q: 'adobo', emoji: '🍲', cuisine: 'Filipino' },
];

export function WorldFoods({ onSearch }: { onSearch: (q: string) => void }) {
  const liked = useStore((s) => s.profile?.cuisines);
  // Cuisines the person likes come first, but the row always stays mixed.
  const items = useMemo(() => {
    if (!liked?.length) return WORLD;
    const fav = WORLD.filter((w) => liked.includes(w.cuisine));
    const rest = WORLD.filter((w) => !liked.includes(w.cuisine));
    const out: typeof WORLD = [];
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
          return (
            <button key={w.label} onClick={() => { haptic(); onSearch(w.q); }} className="w-24 shrink-0 text-left transition active:scale-95">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-[22px] bg-surface" style={{ boxShadow: 'var(--shadow)' }}>
                <img src={artUrl(artFor(w.label))} alt="" loading="lazy" draggable={false} className="h-16 w-16" />
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
