import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { searchFoods, splitName } from '@/lib/foods';
import { EXTRA_KEYS } from '@/lib/nutrients';
import type { Food, Per100, RecipeDef } from '@/lib/types';
import { cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';

const KEYS = ['protein', 'kcal', 'fat', 'carbs', 'fiber', ...EXTRA_KEYS] as (keyof Per100)[];

/**
 * Per-100 g values of a cooked recipe: Σ(ingredient value × grams) ÷ cooked weight.
 * A nutrient stays unknown (null) when ingredients without a value make up over 10% of the weight.
 */
export function recipePer100(ingredients: RecipeDef['ingredients'], cookedGrams: number): Per100 {
  const total = ingredients.reduce((s, i) => s + i.grams, 0);
  const out: Record<string, number | null> = {};
  for (const k of KEYS) {
    let sum = 0;
    let missing = 0;
    for (const i of ingredients) {
      const v = i.per100[k];
      if (v == null) missing += i.grams;
      else sum += (v * i.grams) / 100;
    }
    out[k] = !total || !cookedGrams || missing / total > 0.1 ? null : Math.round(((sum * 100) / cookedGrams) * 100) / 100;
  }
  return { ...(out as unknown as Per100), protein: out.protein ?? 0 };
}

/** Build or edit a homemade recipe: ingredients + cooked weight → nutrition per 100 g and per serving. */
export default function RecipeBuilder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const custom = useStore((s) => s.customFoods);
  const upsert = useStore((s) => s.upsertCustomFood);
  const archive = useStore((s) => s.archiveCustomFood);
  const existing = custom.find((c) => c.id === params.get('id') && c.recipe);
  const { db } = useFoodDb();

  const [name, setName] = useState(existing?.name ?? '');
  const [items, setItems] = useState<RecipeDef['ingredients']>(existing?.recipe?.ingredients ?? []);
  const [cooked, setCooked] = useState(existing?.recipe ? String(existing.recipe.cookedGrams) : '');
  const [servings, setServings] = useState(String(existing?.recipe?.servings ?? 2));
  const [q, setQ] = useState('');

  const results = useMemo(() => (db && q.trim().length >= 2 ? searchFoods(q, { limit: 6, custom: custom.filter((c) => !c.recipe) }) : []), [db, q, custom]);
  const rawTotal = items.reduce((s, i) => s + i.grams, 0);
  const cookedGrams = Number(cooked) > 0 ? Number(cooked) : rawTotal;
  const nServings = Math.max(1, Math.round(Number(servings) || 1));
  const per100 = useMemo(() => recipePer100(items, cookedGrams), [items, cookedGrams]);
  const servingGrams = cookedGrams / nServings;
  const perServing = (v: number | null | undefined) => (v == null ? null : (v * servingGrams) / 100);
  const valid = name.trim().length >= 2 && items.length > 0 && items.every((i) => i.grams > 0);

  const add = (f: Food) => {
    haptic();
    setItems((cur) => [...cur, { foodId: f.id, name: splitName(f.name).title, grams: f.portions[0]?.grams && f.portions[0].grams <= 500 ? Math.round(f.portions[0].grams) : 100, per100: f.per100 }]);
    setQ('');
  };

  function save() {
    upsert({
      id: existing?.id,
      name: name.trim(),
      category: 'My recipes',
      state: 'cooked',
      per100,
      portions: [{ label: '1 serving', grams: Math.round(servingGrams) }],
      sourceNote: `My recipe, ${Math.round(cookedGrams)} g cooked: ${items.map((i) => `${Math.round(i.grams)} g ${i.name}`).join('; ')}`,
      recipe: { ingredients: items, cookedGrams: Math.round(cookedGrams), servings: nServings },
    });
    toast(existing ? 'Recipe updated' : 'Recipe saved to My foods');
    navigate('/add?tab=custom', { replace: true });
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16 md:max-w-2xl md:px-8">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <button onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-[26px] font-extrabold tracking-tight">{existing ? 'Edit recipe' : 'New recipe'}</h1>
      </header>

      <label className="label" htmlFor="rb-name">Recipe name</label>
      <input id="rb-name" className="field" maxLength={60} placeholder="e.g. Mum’s chicken stew" value={name} onChange={(e) => setName(e.target.value)} />

      <p className="label mt-5">Ingredients</p>
      {items.length > 0 && (
        <div className="card mb-3 divide-y divide-line p-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-2">
              <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{it.name}</p>
              <input inputMode="decimal" aria-label={`Grams of ${it.name}`} className="num h-10 w-20 rounded-xl bg-raised px-2 text-right text-[15px] font-bold outline-none" value={it.grams || ''} onChange={(e) => { const g = Number(e.target.value.replace(/[^\d.]/g, '')) || 0; setItems((cur) => cur.map((x, k) => (k === i ? { ...x, grams: Math.min(g, 20000) } : x))); }} />
              <span className="text-sm text-silver">g</span>
              <button onClick={() => setItems((cur) => cur.filter((_, k) => k !== i))} className="grid h-9 w-9 place-items-center rounded-full text-dim" aria-label={`Remove ${it.name}`}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
        <input className="field !pl-11" placeholder="Add an ingredient — search any food" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {results.length > 0 && (
        <div className="card mt-2 p-1.5">
          {results.map((f) => (
            <button key={f.id} onClick={() => add(f)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:bg-raised">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Plus size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{splitName(f.name).title}</span>
                <span className="num block text-xs text-silver">{f.state !== 'na' ? `${f.state} · ` : ''}{f.per100.kcal != null ? `${fmt(f.per100.kcal)} kcal` : ''} · {fmt(f.per100.protein, 1)} g protein per 100 g</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-dim">Weigh each ingredient as you add it to the pot (raw meat as “raw”, dry rice as “dry”). Don’t forget oil and butter.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="rb-cooked">Cooked weight</label>
          <div className="relative">
            <input id="rb-cooked" inputMode="numeric" className="field pr-10" placeholder={rawTotal ? String(Math.round(rawTotal)) : '0'} value={cooked} onChange={(e) => setCooked(e.target.value.replace(/\D/g, '').slice(0, 5))} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-silver">g</span>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="rb-serv">Servings</label>
          <input id="rb-serv" inputMode="numeric" className="field" value={servings} onChange={(e) => setServings(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </div>
      </div>
      <p className="mt-2 text-xs text-dim">Weigh the finished dish (pot on the scale, minus the empty pot). Food loses or gains water as it cooks, so this makes the numbers right. Left blank, we use the ingredients’ total weight.</p>

      {items.length > 0 && (
        <div className="card mt-5 p-5">
          <p className="text-[17px] font-bold">Nutrition</p>
          <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-5 gap-y-2 text-[15px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-dim" />
            <span className="text-right text-xs font-semibold uppercase tracking-wide text-dim">Per serving ({fmt(servingGrams)} g)</span>
            <span className="text-right text-xs font-semibold uppercase tracking-wide text-dim">Per 100 g</span>
            {([['Calories', 'kcal', ' kcal'], ['Protein', 'protein', ' g'], ['Carbs', 'carbs', ' g'], ['Fat', 'fat', ' g'], ['Fibre', 'fiber', ' g']] as const).map(([label, k, u]) => (
              <div key={k} className="contents">
                <span className={cx('font-medium', k === 'kcal' && 'font-bold')}>{label}</span>
                <span className="num text-right font-bold">{perServing(per100[k]) == null ? '–' : `${fmt(perServing(per100[k])!, k === 'kcal' ? 0 : 1)}${u}`}</span>
                <span className="num text-right text-silver">{per100[k] == null ? '–' : `${fmt(per100[k]!, k === 'kcal' ? 0 : 1)}${u}`}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-dim">Calculated from each ingredient’s database record × its weight, divided by the cooked weight. Change any amount and it recalculates.</p>
        </div>
      )}

      <button onClick={save} disabled={!valid} className="btn-primary mt-6 w-full">{existing ? 'Save changes' : 'Save recipe'}</button>
      {existing && (
        <button onClick={() => { if (confirm('Delete this recipe? Meals you already logged with it stay in your history.')) { archive(existing.id, true); toast('Recipe deleted'); navigate('/add?tab=custom', { replace: true }); } }} className="mt-3 w-full text-sm font-semibold text-danger">Delete recipe</button>
      )}
    </div>
  );
}
