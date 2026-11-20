import { useState } from 'react';
import { BookmarkPlus, ChefHat } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { SharedRecipe } from '@/lib/social';
import type { CustomFood, Per100 } from '@/lib/types';
import { fmt } from './ui';
import { haptic, toast } from './fx';

/** A recipe from My recipes, in the shape that's shared on the feed or in a message. */
export function toShared(f: CustomFood, by?: string): SharedRecipe | null {
  if (!f.recipe) return null;
  return {
    name: f.name, servings: f.recipe.servings, cookedGrams: f.recipe.cookedGrams, by, ...(f.recipe.steps?.length ? { steps: f.recipe.steps.slice(0, 40) } : {}),
    per100: f.per100 as unknown as Record<string, number | null>,
    ingredients: f.recipe.ingredients.slice(0, 40).map((i) => ({ name: i.name, grams: Math.round(i.grams), per100: i.per100 as unknown as Record<string, number | null> })),
  };
}

/** Shows a shared recipe with per-serving numbers; one tap saves your own copy (credit kept). */
export function SharedRecipeCard({ recipe, readOnly }: { recipe: SharedRecipe; readOnly?: boolean }) {
  const upsert = useStore((s) => s.upsertCustomFood);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const serving = recipe.cookedGrams / Math.max(1, recipe.servings);
  const per = (k: string) => { const v = recipe.per100[k]; return v == null ? null : (v * serving) / 100; };
  return (
    <div className="mx-4 mt-3 rounded-[20px] bg-raised p-4">
      <p className="flex items-center gap-2 font-bold"><ChefHat size={17} className="text-accent" /> {recipe.name}</p>
      <p className="num mt-1 text-sm text-silver">Per serving ({fmt(serving)} g): {per('kcal') != null ? `${fmt(per('kcal')!)} kcal · ` : ''}{fmt(per('protein') ?? 0)} g protein · {recipe.servings} servings{recipe.by ? ` · by @${recipe.by}` : ''}</p>
      {open && (
        <>
          <ul className="mt-2 space-y-0.5 text-sm">{recipe.ingredients.map((i, k) => <li key={k} className="flex justify-between gap-2"><span>{i.name}</span><span className="num text-silver">{i.grams} g</span></li>)}</ul>
          {recipe.steps?.length ? <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-silver">{recipe.steps.map((st, k) => <li key={k}>{st.replace(/^\d+[.)]\s*/, '')}</li>)}</ol> : null}
        </>
      )}
      <div className="mt-3 flex gap-2">
        <button onClick={() => setOpen((v) => !v)} className="chip !h-9">{open ? 'Hide recipe' : `${recipe.ingredients.length} ingredients${recipe.steps?.length ? ` · ${recipe.steps.length} steps` : ''}`}</button>
        {!readOnly && <button disabled={saved} onClick={() => {
          upsert({
            name: recipe.name.slice(0, 60), category: 'My recipes', state: 'cooked', per100: recipe.per100 as unknown as Per100,
            portions: [{ label: '1 serving', grams: Math.round(serving) }],
            sourceNote: `Recipe${recipe.by ? ` by @${recipe.by}` : ''}, saved from Nutivili AI: ${recipe.ingredients.map((i) => `${i.grams} g ${i.name}`).join('; ')}`,
            recipe: { ingredients: recipe.ingredients.map((i) => ({ foodId: `shared:${i.name}`, name: i.name, grams: i.grams, per100: i.per100 as unknown as Per100 })), cookedGrams: recipe.cookedGrams, servings: recipe.servings, ...(recipe.steps?.length ? { steps: recipe.steps } : {}) },
          });
          haptic(); setSaved(true); toast('Saved to My recipes');
        }} className="chip chip-on !h-9"><BookmarkPlus size={15} /> {saved ? 'Saved' : 'Save recipe'}</button>}
      </div>
    </div>
  );
}
