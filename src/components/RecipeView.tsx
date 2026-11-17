import { AllergyTextBanner } from './Allergy';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Check, Clock, Lightbulb, Loader2, Search, Trash2, Users } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { confidentMatch, splitName } from '@/lib/foods';
import { nutrientsFor } from '@/lib/nutrition';
import { aiHeaders } from '@/lib/premium';
import { mealForNow, todayKey } from '@/lib/dates';
import type { Recipe } from '@/lib/recipe';
import { useCoachContext } from '@/pages/Coach';
import { SignInButtons } from './SignIn';
import { PlanBadge } from './PlanBadge';
import { FoodArt } from './FoodIcon';
import { cx, fmt } from './ui';
import { haptic, toast } from './fx';

/** AI recipes (Plus and Pro): AI writes the dish, the database supplies every number. */
export function RecipeView() {
  const context = useCoachContext();
  const profile = useStore((s) => s.profile);
  const saved = useStore((s) => s.savedRecipes);
  const saveRecipe = useStore((s) => s.saveRecipe);
  const removeRecipe = useStore((s) => s.removeRecipe);
  const [recipe, setRecipe] = useState<Recipe | null>(saved[0]?.recipe ?? null);
  const [savedId, setSavedId] = useState<string | null>(saved[0]?.id ?? null);
  const [ask, setAsk] = useState('');
  const [state, setState] = useState<{ busy: boolean; error?: string; premium?: boolean; signIn?: boolean }>({ busy: false });

  const ideas = useMemo(() => {
    const c = profile?.cuisines?.[0];
    const g = profile?.goals?.includes('muscle') ? 'High-protein' : profile?.goals?.includes('fatloss') ? 'Light' : 'Healthy';
    // Each idea has a matching illustration (the label is what's sent to the AI).
    return [
      { label: `${g} dinner in 30 minutes`, art: 'salad' },
      c ? { label: `${c} dish, lighter`, art: 'stew' } : { label: 'Chicken stir-fry', art: 'chicken' },
      { label: 'Meal-prep lunches for 4', art: 'bento' },
      { label: 'Breakfast with eggs', art: 'egg' },
      { label: 'Vegetarian curry', art: 'curry' },
      { label: 'Something with fish', art: 'fish' },
    ];
  }, [profile]);

  async function make(text = ask) {
    haptic();
    setState({ busy: true });
    try {
      const res = await fetch('/api/recipe', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ context, request: text }) });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!isJson || res.status === 404 || res.status === 501) throw new Error('Recipes aren’t switched on yet. They work once the AI key is added on the server.');
      const data = (await res.json()) as Recipe & { error?: string };
      if (res.status === 401) return setState({ busy: false, error: data.error, signIn: true });
      if (res.status === 402) return setState({ busy: false, error: data.error, premium: true });
      if (!res.ok) throw new Error(data.error || 'Could not make a recipe.');
      setRecipe(data);
      setSavedId(null);
      setState({ busy: false });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <PlanBadge needs="plus" what="AI recipes with full nutrition" />
      <section className="card p-5">
        <p className="text-[19px] font-bold tracking-tight">What are you cooking?</p>
        <p className="mt-0.5 text-sm text-silver">Any dish, any cuisine. Nutrition comes from real food data.</p>
        <label className="relative mt-4 block">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-silver" />
          <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask.trim() && make()} maxLength={300} placeholder="e.g. chicken jollof rice" className="field !pl-11" aria-label="What do you want to cook?" />
        </label>
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-0.5 no-scrollbar">
          {ideas.map((i) => (
            <button key={i.label} onClick={() => { setAsk(i.label); void make(i.label); }} disabled={state.busy} className="chip !h-10 shrink-0 !pl-2 text-[14px]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-surface"><FoodArt name={i.art} size={18} /></span>{i.label}
            </button>
          ))}
        </div>
        <button onClick={() => make()} disabled={state.busy} className="btn-primary mt-4 w-full">
          {state.busy ? <><Loader2 size={18} className="animate-spin" /> Writing your recipe…</> : ask.trim() ? 'Get recipe' : 'Surprise me'}
        </button>
        {state.error && (
          <p className="mt-3 rounded-2xl bg-raised px-3 py-2 text-sm text-silver">
            {state.error} {state.premium && <Link to="/premium" className="font-semibold text-accent">Get Plus</Link>}
          </p>
        )}
        {state.signIn && <div className="mt-3"><SignInButtons /></div>}
      </section>

      {saved.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-[15px] font-semibold">Saved recipes</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
            {saved.map((r) => (
              <button key={r.id} onClick={() => { haptic(); setRecipe(r.recipe); setSavedId(r.id); }} className={cx('chip shrink-0', savedId === r.id && 'chip-on')}>
                <BookmarkCheck size={15} /> {r.recipe.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {recipe && (
        <RecipeCard
          recipe={recipe}
          savedId={savedId}
          onSave={() => { setSavedId(saveRecipe(recipe)); toast('Recipe saved'); }}
          onDelete={() => { if (savedId) { removeRecipe(savedId); setSavedId(null); toast('Recipe removed'); } }}
        />
      )}
    </div>
  );
}

function RecipeCard({ recipe, savedId, onSave, onDelete }: { recipe: Recipe; savedId: string | null; onSave: () => void; onDelete: () => void }) {
  const { db } = useFoodDb();
  const custom = useStore((s) => s.customFoods);
  const addEntry = useStore((s) => s.addEntry);
  const [logged, setLogged] = useState(false);

  const rows = useMemo(
    () => (db ? recipe.ingredients.map((it) => ({ it, food: confidentMatch([...it.searchQueries, it.localName, it.name].filter(Boolean), { custom }) })) : []),
    [db, recipe, custom],
  );
  // Per serving, from the matched database records.
  const per = useMemo(() => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, missing: 0 };
    for (const r of rows) {
      if (!r.food) { t.missing++; continue; }
      const n = nutrientsFor(r.food.per100, r.it.grams / recipe.servings);
      t.kcal += n.kcal ?? 0; t.protein += n.protein; t.carbs += n.carbs ?? 0; t.fat += n.fat ?? 0; t.fiber += n.fiber ?? 0;
    }
    return t;
  }, [rows, recipe.servings]);

  function logServing() {
    haptic();
    const meal = mealForNow();
    for (const r of rows) if (r.food && r.it.grams / recipe.servings >= 1) addEntry({ date: todayKey(), meal, food: r.food, grams: Math.round(r.it.grams / recipe.servings), note: recipe.title });
    setLogged(true);
    toast('1 serving logged');
  }

  return (
    <section className="space-y-3">
      <AllergyTextBanner what="recipe" texts={[recipe.title, ...recipe.ingredients.map((i) => `${i.name} ${i.localName}`)]} />
      <div className="card overflow-hidden">
        <div className="relative bg-accent/[0.07] px-5 pb-5 pt-5">
          <div className="absolute right-4 top-4">
            {savedId ? (
              <button onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-full bg-surface text-silver" style={{ boxShadow: 'var(--shadow)' }} aria-label="Remove saved recipe"><Trash2 size={17} /></button>
            ) : (
              <button onClick={onSave} className="grid h-10 w-10 place-items-center rounded-full bg-surface text-accent" style={{ boxShadow: 'var(--shadow)' }} aria-label="Save recipe"><Bookmark size={17} /></button>
            )}
          </div>
          <span className="grid h-20 w-20 place-items-center rounded-[26px] bg-surface" style={{ boxShadow: 'var(--shadow)' }}>
            <FoodArt name={`${recipe.title} ${recipe.ingredients[0]?.name ?? ''}`} size={52} />
          </span>
          <p className="mt-4 pr-12 text-[24px] font-extrabold leading-tight tracking-tight">{recipe.title}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[13px] font-semibold text-ink/75">
            {recipe.cuisine && <span className="rounded-full bg-surface px-3 py-1">{recipe.cuisine}</span>}
            <span className="flex items-center gap-1 rounded-full bg-surface px-3 py-1"><Clock size={13} /> {recipe.minutes} min</span>
            <span className="flex items-center gap-1 rounded-full bg-surface px-3 py-1"><Users size={13} /> Serves {recipe.servings}</span>
          </div>
        </div>
        <div className="p-5 pt-4">
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {([['kcal', per.kcal, 'Calories'], ['g', per.protein, 'Protein'], ['g', per.carbs, 'Carbs'], ['g', per.fat, 'Fat']] as const).map(([u, v, l]) => (
            <div key={l} className="rounded-2xl bg-raised py-3">
              <p className="num text-[18px] font-extrabold">{fmt(v)}{u === 'g' ? 'g' : ''}</p>
              <p className="text-xs text-silver">{l}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Per serving · fibre {fmt(per.fiber)} g · calculated from the food database{per.missing ? ` · ${per.missing} ingredient${per.missing > 1 ? 's' : ''} not found, not counted` : ''}</p>
        <button onClick={logServing} disabled={logged || !rows.some((r) => r.food)} className="btn-primary mt-4 w-full">
          {logged ? <><Check size={18} /> Logged</> : 'Log 1 serving'}
        </button>
        </div>
      </div>

      <div className="card p-5">
        <p className="text-[17px] font-bold">Ingredients</p>
        <ul className="mt-3 space-y-2.5">
          {rows.map(({ it, food }, i) => (
            <li key={i} className="flex items-center gap-3 text-[15px]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-raised"><FoodArt name={it.name} category={food?.category} size={24} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{it.localName && it.localName !== it.name ? `${it.localName} (${it.name})` : it.name}{it.note && <span className="text-silver">, {it.note}</span>}</p>
                <p className="truncate text-xs text-dim">{food ? `Matched: ${splitName(food.name).title}` : 'Not in our database — not counted'}</p>
              </div>
              <span className="num shrink-0 font-semibold">{fmt(it.grams)} g</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-5">
        <p className="text-[17px] font-bold">Method</p>
        <ol className="mt-3 space-y-3">
          {recipe.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised text-xs font-bold">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {recipe.tip && <p className="mt-4 flex gap-2 rounded-2xl bg-raised px-4 py-3 text-sm"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" /> {recipe.tip}</p>}
      </div>
    </section>
  );
}
