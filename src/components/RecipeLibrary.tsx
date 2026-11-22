import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChefHat, Clock, Lock, MessageCircle, Minus, Plus, Search, Users } from 'lucide-react';
import { useFoodDb } from '@/lib/hooks';
import { foodById } from '@/lib/foods';
import { useHasTier } from '@/lib/perks';
import { todayKey } from '@/lib/dates';
import type { Food } from '@/lib/types';
import { FoodVisual } from './FoodIcon';
import { FoodSheet } from './FoodSheet';
import { Sheet, cx, fmt } from './ui';
import { haptic } from './fx';

export interface LibraryRecipe {
  id: string; name: string; cuisine: string; minutes: number; steps: string[];
  servings: number; servingLabel: string; servingGrams: number; yield: number; ingredients: [string, number][];
}

let cache: Promise<LibraryRecipe[]> | null = null;
export function loadLibrary(): Promise<LibraryRecipe[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/recipes.json`).then((r) => r.json()).then((d: { recipes: LibraryRecipe[] }) => d.recipes).catch((e) => { cache = null; throw e; });
  return cache;
}

const REGION: [string, RegExp][] = [
  ['African', /African|Ghanaian|Nigerian|Kenyan|Congolese|Egyptian/],
  ['Caribbean & Latin', /Caribbean|Latin|Brazil|Mexican|Costa|Colombian/],
  ['Middle East', /Middle Eastern|Persian|Turkish|Arabian/],
  ['South Asian', /Indian|Pakistani|Nepali|Sri Lankan/],
  ['East & SE Asian', /Chinese|Japanese|Korean|Thai|Vietnamese|Indonesian|Malaysian|Filipino/],
  ['Europe & N. America', /British|French|Spanish|Greek|Russian|American|Canadian/],
];
const regionOf = (c: string) => REGION.find(([, re]) => re.test(c))?.[0] ?? 'Other';
const QUICK = ['High protein', 'Under 500 kcal', '30 min or less'] as const;
const duration = (m: number, long = false) => (m < 60 ? `${m} min${long ? 'utes' : ''}` : `${Math.round(m / 30) / 2} hour${m === 60 ? '' : 's'}`.replace('hour', long ? 'hour' : 'h').replace(/ hs?$/, ' h'));

/** Per serving, from the dish's own food record (the same numbers the diary uses). */
function perServing(r: LibraryRecipe, food?: Food) {
  if (!food) return null;
  const k = r.servingGrams / 100;
  return { kcal: (food.per100.kcal ?? 0) * k, protein: food.per100.protein * k, carbs: (food.per100.carbs ?? 0) * k, fat: (food.per100.fat ?? 0) * k };
}

/** World recipes for everyone: real dishes with amounts, method and nutrition. Plus adds coach conversations about any recipe. */
export function RecipeLibrary() {
  const { db } = useFoodDb();
  const [all, setAll] = useState<LibraryRecipe[] | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('All');
  const [quick, setQuick] = useState<string[]>([]);
  const [open, setOpen] = useState<LibraryRecipe | null>(null);
  useEffect(() => { loadLibrary().then(setAll, () => setErr(true)); }, []);

  const list = useMemo(() => {
    if (!all) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((r) => {
      if (region !== 'All' && regionOf(r.cuisine) !== region) return false;
      const hay = `${r.name} ${r.cuisine} ${r.ingredients.map((i) => i[0]).join(' ')}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
      const n = db ? perServing(r, foodById(`recipe:${r.id}`)) : null;
      if (quick.includes('High protein') && !(n && n.protein >= 25)) return false;
      if (quick.includes('Under 500 kcal') && !(n && n.kcal < 500)) return false;
      if (quick.includes('30 min or less') && r.minutes > 30) return false;
      return true;
    });
  }, [all, q, region, quick, db]);

  return (
    <section aria-label="Recipe library">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-[19px] font-bold tracking-tight">Recipes from around the world</p>
        {all && <p className="text-xs text-silver">{list.length} of {all.length}</p>}
      </div>
      <label className="relative mt-3 block">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-silver" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes or ingredients, e.g. jollof, chicken" className="field !pl-11" aria-label="Search recipes" />
      </label>
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-0.5 no-scrollbar" role="group" aria-label="Regions">
        {['All', ...REGION.map(([r]) => r)].map((r) => <button key={r} onClick={() => { haptic(); setRegion(r); }} className={cx('chip !h-9 shrink-0 text-[14px]', region === r && 'chip-on')}>{r}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Recipe filters">
        {QUICK.map((f) => <button key={f} onClick={() => setQuick((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))} className={cx('chip !h-8 !px-3 text-[13px]', quick.includes(f) && 'chip-on')}>{f}</button>)}
      </div>
      {err && <p className="mt-4 text-sm text-silver">Couldn’t load recipes. Check your connection and try again.</p>}
      {!all && !err && <p className="mt-4 text-sm text-silver">Loading recipes…</p>}
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {list.slice(0, 60).map((r) => {
          const n = db ? perServing(r, foodById(`recipe:${r.id}`)) : null;
          return (
            <li key={r.id}>
              <button onClick={() => { haptic(); setOpen(r); }} className="card flex w-full items-center gap-3 p-3 text-left transition active:scale-[.99]">
                <FoodVisual name={r.name} size={64} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold">{r.name}</span>
                  <span className="block truncate text-[13px] text-silver">{r.cuisine} · {duration(r.minutes)}</span>
                  {n && <span className="num mt-0.5 block text-[13px] font-semibold">{fmt(n.kcal)} kcal · {fmt(n.protein)} g protein <span className="font-normal text-silver">a serving</span></span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {list.length > 60 && <p className="mt-2 text-center text-xs text-silver">Showing 60. Search or pick a region to see the rest.</p>}
      {all && !list.length && <p className="mt-4 text-sm text-silver">No recipes match. Try fewer filters.</p>}
      <RecipeSheet recipe={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function RecipeSheet({ recipe, onClose }: { recipe: LibraryRecipe | null; onClose: () => void }) {
  const nav = useNavigate();
  const plus = useHasTier('plus');
  const { db } = useFoodDb();
  const [servings, setServings] = useState(1);
  const [logFood, setLogFood] = useState<Food | null>(null);
  useEffect(() => { if (recipe) setServings(recipe.servings); }, [recipe]);
  if (!recipe) return <FoodSheet food={logFood} date={todayKey()} onClose={() => setLogFood(null)} />;
  const food = db ? foodById(`recipe:${recipe.id}`) : undefined;
  const n = perServing(recipe, food);
  const scale = servings / recipe.servings;
  const ask = `Help me make ${recipe.name} fit my goals: adjust the portions and ingredients for my calorie and protein targets, my diet and anything I avoid, and suggest a side.`;
  return (
    <>
      <Sheet open onClose={onClose} title={recipe.name}>
        <div className="flex items-center gap-3">
          <FoodVisual name={recipe.name} size={84} />
          <div className="min-w-0 text-[14px] text-silver">
            <p className="font-semibold text-ink">{recipe.cuisine}</p>
            <p className="flex items-center gap-1.5"><Clock size={14} /> About {duration(recipe.minutes, true)}</p>
            <p className="flex items-center gap-1.5"><Users size={14} /> Makes {recipe.servings} · {recipe.servingLabel} ≈ {recipe.servingGrams} g</p>
          </div>
        </div>
        {n && (
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {([['Calories', fmt(n.kcal)], ['Protein', `${fmt(n.protein)}g`], ['Carbs', `${fmt(n.carbs)}g`], ['Fat', `${fmt(n.fat)}g`]] as const).map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-raised py-2.5"><p className="num text-[17px] font-extrabold">{v}</p><p className="text-[11px] text-silver">{l}</p></div>
            ))}
          </div>
        )}
        {n && <p className="mt-1.5 text-center text-xs text-silver">Per serving, from official food records</p>}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button disabled={!food} onClick={() => { haptic(); setLogFood(food!); onClose(); }} className="btn-primary !h-12 text-[15px]">Log a serving</button>
          {plus
            ? <button onClick={() => { haptic(); nav(`/coach?ask=${encodeURIComponent(ask)}`); }} className="btn-ghost !h-12 text-[15px]"><MessageCircle size={16} /> Make it mine</button>
            : <Link to="/premium?tier=pro" className="btn-ghost !h-12 text-[14px]"><Lock size={15} /> Make it mine · Plus</Link>}
        </div>
        {!plus && <p className="mt-1.5 text-center text-xs text-silver">With Plus, your coach adapts any recipe to your targets, diet and what’s in your kitchen.</p>}

        <div className="mt-6 flex items-center justify-between">
          <p className="text-[17px] font-bold">Ingredients</p>
          <div className="flex items-center rounded-full border-2 border-line" role="group" aria-label="Servings">
            <button onClick={() => setServings((s) => Math.max(1, s - 1))} className="grid h-9 w-9 place-items-center" aria-label="Fewer servings"><Minus size={15} /></button>
            <span className="num min-w-[5.5rem] text-center text-[14px] font-semibold">{servings} serving{servings === 1 ? '' : 's'}</span>
            <button onClick={() => setServings((s) => Math.min(24, s + 1))} className="grid h-9 w-9 place-items-center" aria-label="More servings"><Plus size={15} /></button>
          </div>
        </div>
        <ul className="mt-2 divide-y divide-line">
          {recipe.ingredients.map(([name, g], i) => (
            <li key={i} className="flex justify-between gap-3 py-2 text-[15px]"><span>{name}</span><span className="num shrink-0 font-semibold">{fmt(g * scale)} g</span></li>
          ))}
        </ul>

        <p className="mt-6 text-[17px] font-bold">Method</p>
        <ol className="mt-2 space-y-3">
          {recipe.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised text-[13px] font-bold">{i + 1}</span><span>{s}</span></li>
          ))}
        </ol>
        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-dim"><ChefHat size={14} className="mt-0.5 shrink-0" /> A common home version. Amounts are from official food records (USDA, FAO/INFOODS); cooked staples are listed by cooked weight. Salt and chilli to taste.</p>
      </Sheet>
    </>
  );
}
