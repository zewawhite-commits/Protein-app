import { startMeasure } from '@/lib/units';
import { IngredientAmount } from '@/components/IngredientAmount';
import { ShareRecipeSheet } from '@/components/ShareRecipe';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Plus, Search, Trash2, Share2 } from 'lucide-react';
import { useHasTier } from '@/lib/perks';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { searchFoods, splitName } from '@/lib/foods';
import type { Food, RecipeDef } from '@/lib/types';
import { cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';
import { RecipeImport, type ImportResult } from '@/components/RecipeImport';
import { standardRecipe } from '@/lib/recipe';
import { CreateFood } from '@/components/CreateFood';
import { mealForNow, todayKey } from '@/lib/dates';
import { plateParts } from '@/lib/plate';

export { recipePer100 } from '@/lib/recipeMath';
import { recipePer100 } from '@/lib/recipeMath';

/** Build or edit a homemade recipe: ingredients + cooked weight → nutrition per 100 g and per serving. */
export default function RecipeBuilder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const importScrolled = useRef(false);
  const custom = useStore((s) => s.customFoods);
  const upsert = useStore((s) => s.upsertCustomFood);
  const archive = useStore((s) => s.archiveCustomFood);
  const [share, setShare] = useState(false);
  const [steps, setSteps] = useState(() => custom.find((c) => c.id === params.get('id'))?.recipe?.steps?.join('\n') ?? '');
  const existing = custom.find((c) => c.id === params.get('id') && c.recipe);
  const { db } = useFoodDb();

  const [name, setName] = useState(existing?.name ?? '');
  const [items, setItems] = useState<RecipeDef['ingredients']>(existing?.recipe?.ingredients ?? []);
  const [cooked, setCooked] = useState(existing?.recipe ? String(existing.recipe.cookedGrams) : '');
  const [servings, setServings] = useState(String(existing?.recipe?.servings ?? 2));
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  // Swapping an ingredient: the next food picked replaces it, keeping the amount.
  const [swapping, setSwapping] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const plus = useHasTier('plus');
  const [unitName, setUnitName] = useState(() => existing?.portions?.[0]?.label?.replace(/^1 /, '') ?? 'serving');
  const addEntry = useStore((s) => s.addEntry);
  const [check, setCheck] = useState<ImportResult | null>(null);
  // "Make it your way": start from a world dish's standard recipe (?from=<food id>) and change it.
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    const from = params.get('from');
    if (!db || !from || existing || items.length) return;
    const dish = db.byId.get(from);
    const std = dish && standardRecipe(dish.sourceNote);
    if (!dish || !std) return;
    const byName = new Map<string, Food>();
    for (const f of db.foods) if (!byName.has(f.name)) byName.set(f.name, f); // the record the dish was built from
    const found = std.items.map((i) => ({ i, f: byName.get(i.name) })).filter((x) => x.f);
    setItems(found.map(({ i, f }) => ({ foodId: f!.id, name: splitName(f!.name).title, grams: i.grams, per100: f!.per100 })));
    const title = splitName(dish.name).title.replace(/\s*\(.*$/, '');
    setName(`My ${title.toLowerCase()}`);
    setCooked(String(std.yieldGrams));
    const portion = dish.portions.find((p) => /medium|plate|wrap|bowl|portion|serving/.test(p.label));
    setServings(String(Math.max(1, Math.round(std.yieldGrams / (portion?.grams || std.yieldGrams / 4)))));
    setBase(title);
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps
  // While the name is the one we filled in, keep it matching what's added ("Oats with banana and honey").
  const autoName = useRef(!existing && !params.get('from') && !params.get('plate') && !params.get('import'));
  useEffect(() => {
    if (!autoName.current || !items.length) return;
    const [first, ...rest] = items.map((i) => i.name.split(',')[0].toLowerCase());
    const others = rest.length > 1 ? `${rest.slice(0, -1).join(', ')} and ${rest[rest.length - 1]}` : rest[0];
    setName((first.charAt(0).toUpperCase() + first.slice(1) + (others ? ` with ${others}` : '')).slice(0, 60));
  }, [items]);
  // "Add something to it": start a meal from one food at the amount chosen (?with=<food id>&g=<grams>).
  useEffect(() => {
    const id = params.get('with');
    if (!db || !id || existing || items.length) return;
    const f = db.byId.get(id) ?? custom.find((c) => c.id === id);
    if (!f) return;
    const grams = Math.min(3000, Math.max(1, Number(params.get('g')) || 100));
    const title = splitName(f.name).title;
    const u = params.get('u'); const n = params.get('n');
    setItems([{ foodId: f.id, name: title, grams, per100: f.per100, ...(u && n ? { unit: u, qty: n } : { unit: 'g', qty: String(grams) }) }]);
    setName(title);
    autoName.current = true;
    setServings('1');
    setUnitName('serving');
    setBase(null);
    toast(`${title} added. Now add what you put with it`);
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Build this plate" from search: find each part, add it with a typical portion, all editable.
  const [missingParts, setMissingParts] = useState<string[]>([]);
  useEffect(() => {
    const plate = params.get('plate');
    if (!db || !plate || existing || items.length) return;
    const parts = plateParts(plate);
    const found: RecipeDef['ingredients'] = [];
    const missing: string[] = [];
    for (const part of parts) {
      const f = searchFoods(part, { limit: 1, custom: custom.filter((c) => !c.recipe) })[0];
      if (!f) { missing.push(part); continue; }
      const portion = f.portions.find((x) => x.grams > 0 && x.grams <= 500);
      found.push({ foodId: f.id, name: splitName(f.name).title, grams: Math.round(portion?.grams ?? 100), per100: f.per100 });
    }
    setItems(found);
    setMissingParts(missing);
    setName(plate.replace(/^\w/, (c) => c.toUpperCase()).slice(0, 60));
    setServings('1');
    setUnitName('plate');
    setBase(null);
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps
  const imported = (r: ImportResult) => {
    if (r.title && !name.trim()) setName(r.title);
    if (r.servings) setServings(String(r.servings));
    setItems((cur) => [...cur, ...r.items]);
    if (r.steps.length) setSteps(r.steps.join('\n'));
    setCheck(r);
    toast(`${r.items.length} ingredient${r.items.length === 1 ? '' : 's'} added`);
  };

  const results = useMemo(() => (db && q.trim().length >= 2 ? searchFoods(q, { limit: 6, custom: custom.filter((c) => !c.archived && c.id !== existing?.id) }) : []), [db, q, custom]);
  const rawTotal = items.reduce((s, i) => s + i.grams, 0);
  const cookedGrams = Number(cooked) > 0 ? Number(cooked) : rawTotal;
  const nServings = Math.max(1, Math.round(Number(servings) || 1));
  const per100 = useMemo(() => recipePer100(items, cookedGrams), [items, cookedGrams]);
  const servingGrams = cookedGrams / nServings;
  const perServing = (v: number | null | undefined) => (v == null ? null : (v * servingGrams) / 100);
  const valid = name.trim().length >= 2 && items.length > 0 && items.every((i) => i.grams > 0);

  const add = (f: Food) => {
    haptic();
    const st = startMeasure(f);
    const item = { foodId: f.id, name: splitName(f.name).title, grams: st.grams, per100: f.per100, unit: st.unit, qty: st.qty };
    if (swapping != null) {
      setItems((cur) => cur.map((x, k) => (k === swapping ? item : x)));
      toast(`Swapped for ${item.name}`);
      setSwapping(null);
    } else setItems((cur) => [...cur, item]);
    setQ('');
  };

  /** Ingredients with a gap in the main numbers: saved as they are and flagged, never filled with zero. */
  const gaps = items.filter((i) => i.per100.kcal == null || i.per100.carbs == null || i.per100.fat == null);
  const foodOf = (id: string): Food | undefined => db?.byId.get(id) ?? custom.find((c) => c.id === id);
  function save(andLog = false) {
    const food = upsert({
      id: existing?.id,
      name: name.trim(),
      category: 'My recipes',
      state: 'cooked',
      per100,
      portions: [{ label: `1 ${unitName.trim() || 'serving'}`, grams: Math.round(servingGrams) }],
      sourceNote: `My recipe, ${Math.round(cookedGrams)} g cooked: ${items.map((i) => `${Math.round(i.grams)} g ${i.name}`).join('; ')}`,
      recipe: { ingredients: items, cookedGrams: Math.round(cookedGrams), servings: nServings, ...(steps.trim() ? { steps: steps.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 40) } : {}) },
    });
    if (andLog && food) {
      addEntry({ date: todayKey(), meal: mealForNow(), food, grams: Math.round(servingGrams) });
      toast(`Saved, and 1 ${unitName.trim() || 'serving'} added to today`);
      navigate('/', { replace: true });
      return;
    }
    toast(existing ? 'Meal updated' : 'Saved to My foods');
    navigate('/add?tab=custom', { replace: true });
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <button onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-[26px] font-extrabold tracking-tight">{existing ? 'Edit meal' : base ? 'Make it your way' : params.get('plate') ? 'Build your plate' : 'Build your meal'}</h1>
        {existing && <button onClick={() => setShare(true)} className="chip !h-10"><Share2 size={15} /> Share</button>}
      </header>
      {existing && <ShareRecipeSheet food={existing} open={share} onClose={() => setShare(false)} />}

      {base && (
        <div className="mb-5 rounded-2xl bg-accent/10 px-4 py-3 text-[14px] leading-relaxed">
          <p className="font-semibold">Starting from our standard {base} recipe</p>
          <p className="text-silver">Change the amounts to how you cook it — especially the oil, meat or fish, and vegetables. Remove what you don’t use and add what you do. The nutrition updates as you go. Set the cooked weight if you know it.</p>
        </div>
      )}
      {!existing && !base && <div className="mb-5" ref={(el) => { if (el && params.get('import') && !importScrolled.current) { importScrolled.current = true; el.scrollIntoView({ block: 'start' }); } }}><RecipeImport onImported={imported} /></div>}
      {check && (check.unmatched.length > 0 || check.guessed.length > 0 || check.missing.length > 0 || check.note) && (
        <div className="mb-5 rounded-[20px] bg-warn/15 p-4 text-sm">
          <p className="font-bold">Please check</p>
          {check.unmatched.length > 0 && <p className="mt-1">Not found, add these yourself below: {check.unmatched.join('; ')}</p>}
          {check.missing.length > 0 && <p className="mt-1"><b>Needs an amount</b> (the recipe doesn’t say how much — enter what you used, they’re at 0 g): {check.missing.join('; ')}</p>}
          {check.guessed.length > 0 && <p className="mt-1">Amounts guessed (no quantity in the recipe): {check.guessed.join('; ')}</p>}
          {check.note && <p className="mt-1 text-silver">{check.note}</p>}
          <p className="mt-1 text-silver">Weigh the finished pot and enter the cooked weight for the most accurate numbers.</p>
        </div>
      )}
      {params.get('plate') && (
        <div className="mb-5 rounded-2xl bg-accent/10 px-4 py-3 text-[14px] leading-relaxed">
          <p className="font-semibold">Check each item and its amount</p>
          <p className="text-silver">We picked the closest food for each part with a typical portion. Change the amounts, swap anything with Remove and + Add item, and the totals update.</p>
          {missingParts.length > 0 && <p className="mt-1 font-semibold text-warn">Not found: {missingParts.join(', ')}. Search a different name below or create it.</p>}
        </div>
      )}
      <label className="label" htmlFor="rb-name">Meal or recipe name</label>
      <input id="rb-name" className="field" maxLength={60} placeholder="e.g. Seafood boil with eggs, homemade zobo" value={name} onChange={(e) => { autoName.current = false; setName(e.target.value); }} />

      <p className="label mt-5">Ingredients</p>
      {items.length > 0 && (
        <div className="card mb-3 divide-y divide-line p-1.5">
          {items.map((it, i) => (
            <div key={i} className="px-2.5 py-2">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{it.name}</p>
              <button onClick={() => { haptic(); setSwapping(swapping === i ? null : i); setQ(''); setTimeout(() => searchRef.current?.focus(), 50); }} className={cx('h-9 shrink-0 rounded-full px-2.5 text-[13px] font-semibold', swapping === i ? 'bg-primary text-on-primary' : 'text-accent')} aria-label={`Swap ${it.name}`}>Swap</button>
              <button onClick={() => { setItems((cur) => cur.filter((_, k) => k !== i)); setSwapping(null); }} className="grid h-9 w-9 place-items-center rounded-full text-dim" aria-label={`Remove ${it.name}`}><Trash2 size={16} /></button>
            </div>
            <IngredientAmount item={it} food={foodOf(it.foodId)} onChange={(v) => setItems((cur) => cur.map((x, k) => (k === i ? { ...x, ...v } : x)))} />
            <p className="num mt-0.5 text-[12px] text-silver">
              {it.per100.kcal == null ? <span className="text-warn">no calorie data</span> : `${fmt((it.per100.kcal * it.grams) / 100)} kcal`} · {fmt((it.per100.protein * it.grams) / 100, 1)} g protein
              {it.per100.carbs != null && ` · ${fmt((it.per100.carbs * it.grams) / 100, 1)} g carbs`}{it.per100.fat != null && ` · ${fmt((it.per100.fat * it.grams) / 100, 1)} g fat`}
            </p>
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
        <input ref={searchRef} className="field !pl-11" placeholder={swapping != null ? `Swap ${items[swapping]?.name ?? ''} for…` : '+ Add item — search any food'} value={q} onChange={(e) => setQ(e.target.value)} />
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
      {q.trim().length >= 2 && db && (
        <button onClick={() => setCreating(true)} className="card mt-2 flex w-full items-center gap-3 p-3 text-left">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-on-primary"><Plus size={16} /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{results.length ? 'Not here? ' : 'Not found. '}Create “{q.trim()}”</span><span className="block text-xs text-silver">Enter its ingredients or numbers; it goes straight into this meal</span></span>
        </button>
      )}
      <button onClick={() => setCreating(true)} className="mt-2 w-full rounded-2xl bg-raised px-4 py-3 text-left text-[14px]"><span className="text-silver">Can’t find this food?</span> <span className="font-semibold text-accent">+ Create your own food</span></button>
      {name.trim().length >= 3 && (plus
        ? <Link to={`/snap?mode=describe&q=${encodeURIComponent(`${name.trim()}${items.length ? `: ${items.map((i) => `${Math.round(i.grams)} g ${i.name}`).join(', ')}` : ''}`)}`} className="mt-2 block rounded-2xl bg-raised px-4 py-3 text-[14px]"><span className="font-semibold text-accent">Estimate with AI</span> <span className="text-silver">· describe how you made it and get a labelled estimate</span></Link>
        : <Link to="/premium" className="mt-2 block rounded-2xl bg-raised px-4 py-3 text-[14px] text-silver"><Lock size={13} className="mr-1 inline" />Estimate a dish with AI from its ingredients and method · Plus</Link>)}
      <CreateFood open={creating} initialName={q.trim() ? q.trim().replace(/^\w/, (c) => c.toUpperCase()) : undefined} onClose={() => setCreating(false)} onSaved={(f) => add(f)} />
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
          <label className="label" htmlFor="rb-serv">How many {unitName.trim() || 'servings'}?</label>
          <input id="rb-serv" inputMode="numeric" className="field" value={servings} onChange={(e) => setServings(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </div>
      </div>
      <label className="label mt-3" htmlFor="rb-unit">Serving is a…</label>
      <div className="flex flex-wrap gap-1.5">
        {['serving', 'plate', 'bowl', 'bottle', 'glass', 'cup', 'piece', 'slice'].map((u) => <button key={u} onClick={() => setUnitName(u)} className={cx('chip !h-9 !px-3 text-[13px]', unitName === u && 'chip-on')}>{u}</button>)}
        <input id="rb-unit" className="field !h-9 !w-28 text-[13px]" maxLength={20} value={unitName} onChange={(e) => setUnitName(e.target.value)} aria-label="Serving name" />
      </div>
      <p className="mt-2 text-xs text-dim">Weigh the finished dish (pot on the scale, minus the empty pot). Food loses or gains water as it cooks, so this makes the numbers right. Left blank, we use the ingredients’ total weight.</p>

      {items.length > 0 && (
        <div className="card mt-5 p-5">
          <p className="text-[17px] font-bold">Nutrition</p>
          <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-5 gap-y-2 text-[15px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-dim" />
            <span className="text-right text-xs font-semibold uppercase tracking-wide text-dim">Per {unitName.trim() || 'serving'} ({fmt(servingGrams)} g)</span>
            <span className="text-right text-xs font-semibold uppercase tracking-wide text-dim">Per 100 g</span>
            {([['Calories', 'kcal', ' kcal'], ['Protein', 'protein', ' g'], ['Carbs', 'carbs', ' g'], ['Fat', 'fat', ' g'], ['Fibre', 'fiber', ' g']] as const).map(([label, k, u]) => (
              <div key={k} className="contents">
                <span className={cx('font-medium', k === 'kcal' && 'font-bold')}>{label}</span>
                <span className="num text-right font-bold">{perServing(per100[k]) == null ? '–' : `${fmt(perServing(per100[k])!, k === 'kcal' ? 0 : 1)}${u}`}</span>
                <span className="num text-right text-silver">{per100[k] == null ? '–' : `${fmt(per100[k]!, k === 'kcal' ? 0 : 1)}${u}`}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-dim">Calculated from each ingredient’s record: grams ÷ 100 × value per 100 g, added up, divided by the cooked weight. Change any amount and it recalculates.</p>
          {gaps.length > 0 && <p className="mt-2 rounded-2xl bg-warn/15 px-3 py-2 text-[13px] leading-relaxed"><b>Incomplete nutrition:</b> {gaps.map((g) => g.name).join(', ')} {gaps.length === 1 ? 'has' : 'have'} missing values. You can still save; totals marked “–” are unknown, not zero. Open the ingredient and add its numbers to complete it.</p>}
        </div>
      )}

      <label className="label mt-5" htmlFor="rb-steps">Method (optional)</label>
      <textarea id="rb-steps" value={steps} onChange={(e) => setSteps(e.target.value)} rows={5} maxLength={6000} placeholder={'One step per line\n1. Wash the rice…'} className="field !h-auto resize-y py-3 text-[15px]" />
      <button onClick={() => save(true)} disabled={!valid} className="btn-primary mt-6 w-full">Save and add 1 {unitName.trim() || 'serving'} to today</button>
      <button onClick={() => save(false)} disabled={!valid} className="btn-ghost mt-2 w-full">{existing ? 'Save changes' : 'Save to My foods'}</button>
      {base && <p className="mt-2 text-center text-xs text-dim">The original {base} stays as it is; this saves as your own meal.</p>}
      {existing && (
        <button onClick={() => { if (confirm('Delete this recipe? Meals you already logged with it stay in your history.')) { archive(existing.id, true); toast('Recipe deleted'); navigate('/add?tab=custom', { replace: true }); } }} className="mt-3 w-full text-sm font-semibold text-danger">Delete recipe</button>
      )}
    </div>
  );
}
