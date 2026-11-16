import { AllergyTextBanner } from './Allergy';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Check, ChefHat, Clock, Lightbulb, Loader2, Trash2, Users } from 'lucide-react';
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
import { MacroBar } from './Nutrients';
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
    return [`${g} dinner in 30 minutes`, c ? `${c} dish, lighter` : 'Chicken stir-fry', 'Meal-prep lunches for 4', 'Breakfast with eggs', 'Vegetarian curry', 'Something with chicken'];
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
        <p className="flex items-center gap-2 text-[17px] font-bold"><ChefHat size={18} className="text-accent" /> Recipes</p>
        <p className="mt-1 text-sm text-silver">Any dish from anywhere — with calories, protein and more worked out from the food database.</p>
        <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask.trim() && make()} maxLength={300} placeholder="What do you want to cook?" className="field mt-4" />
        <div className="mt-3 flex flex-wrap gap-2">
          {ideas.map((i) => <button key={i} onClick={() => { setAsk(i); void make(i); }} disabled={state.busy} className="chip !h-9 text-[14px]">{i}</button>)}
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
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[21px] font-extrabold leading-tight">{recipe.title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-silver">
              {recipe.cuisine && <span>{recipe.cuisine}</span>}
              <span className="flex items-center gap-1"><Clock size={14} /> {recipe.minutes} min</span>
              <span className="flex items-center gap-1"><Users size={14} /> Serves {recipe.servings}</span>
            </p>
          </div>
          {savedId ? (
            <button onClick={onDelete} className="chip !h-9 shrink-0" aria-label="Remove saved recipe"><Trash2 size={15} /></button>
          ) : (
            <button onClick={onSave} className="chip !h-9 shrink-0 !bg-accent/10 !text-accent"><Bookmark size={15} /> Save</button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {([['kcal', per.kcal, 'Calories'], ['g', per.protein, 'Protein'], ['g', per.carbs, 'Carbs'], ['g', per.fat, 'Fat']] as const).map(([u, v, l]) => (
            <div key={l} className="rounded-2xl bg-raised py-3">
              <p className="num text-[18px] font-extrabold">{fmt(v)}{u === 'g' ? 'g' : ''}</p>
              <p className="text-xs text-silver">{l}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Per serving · calculated from the food database{per.missing ? ` · ${per.missing} ingredient${per.missing > 1 ? 's' : ''} not found, not counted` : ''}</p>
        <div className="mt-3"><MacroBar label="Fibre" value={per.fiber} color="protein" /></div>
        <button onClick={logServing} disabled={logged || !rows.some((r) => r.food)} className="btn-primary mt-4 w-full">
          {logged ? <><Check size={18} /> Logged</> : 'Log 1 serving'}
        </button>
      </div>

      <div className="card p-5">
        <p className="text-[17px] font-bold">Ingredients</p>
        <ul className="mt-3 space-y-2.5">
          {rows.map(({ it, food }, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-[15px]">
              <div className="min-w-0">
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
