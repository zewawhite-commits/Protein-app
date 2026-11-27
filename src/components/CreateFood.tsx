import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { searchFoods, splitName } from '@/lib/foods';
import { recipePer100 } from '@/lib/recipeMath';
import type { RecipeDef } from '@/lib/types';
import { useStore } from '@/store/useStore';
import type { CustomFood, Food, Per100, PrepState } from '@/lib/types';
import { Segmented, Sheet, cx, fmt } from './ui';
import { GROUP_NAMES, groupOf, startMeasure, suggestedUnits } from '@/lib/units';
import { IngredientAmount } from './IngredientAmount';
import { foodById as dbFood } from '@/lib/foods';
import { haptic, toast } from './fx';

const FIELDS: [keyof Per100, string, string][] = [
  ['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g'],
  ['fiber', 'Fibre', 'g'], ['sugar', 'Sugars', 'g'], ['satFat', 'Saturated fat', 'g'], ['sodium', 'Sodium', 'mg'],
];

/**
 * Add your own food, or your own corrected version of one: the numbers from a pack label
 * (per serving or per 100 g) or from anywhere you trust. Saved to My foods; nothing else changes.
 */
export function CreateFood({ open, onClose, from, onSaved, initialName }: { open: boolean; onClose: () => void; from?: Food | null; onSaved?: (f: Food) => void; initialName?: string }) {
  const [how, setHow] = useState<'numbers' | 'ingredients'>('numbers');
  const done = (f?: Food) => { onClose(); setHow('numbers'); if (f) onSaved?.(f); };
  return (
    <Sheet open={open} onClose={onClose} title={from ? 'Your own version' : 'Create a food'}>
      {open && !from && (
        <div className="mb-3">
          <Segmented<'numbers' | 'ingredients'> value={how} onChange={setHow} options={[{ value: 'numbers', label: 'I know the numbers' }, { value: 'ingredients', label: 'From ingredients' }]} />
        </div>
      )}
      {open && (how === 'ingredients' && !from ? <FromIngredients initialName={initialName} onDone={done} /> : <Form from={from ?? undefined} initialName={initialName} onDone={done} />)}
    </Sheet>
  );
}

/**
 * Make a food from what's in it (a side, a sauce, a homemade snack): pick each ingredient from
 * the database with its amount. Nutivili adds them up; nothing is estimated.
 */
function FromIngredients({ initialName, onDone }: { initialName?: string; onDone: (f?: Food) => void }) {
  const upsert = useStore((s) => s.upsertCustomFood);
  const custom = useStore((s) => s.customFoods);
  const [name, setName] = useState(initialName ?? '');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<RecipeDef['ingredients']>([]);
  const [cooked, setCooked] = useState('');
  const foodById = (id: string): Food | undefined => custom.find((c) => c.id === id) ?? dbFood(id);
  const results = useMemo(() => (q.trim().length >= 2 ? searchFoods(q, { limit: 6, custom: custom.filter((c) => !c.archived) }) : []), [q, custom]);
  const total = items.reduce((t, i) => t + i.grams, 0);
  const weight = Number(cooked) > 0 ? Number(cooked) : total;
  const per100 = items.length ? recipePer100(items, weight) : null;
  const ok = name.trim().length >= 2 && items.length > 0 && total > 0;
  function save() {
    if (!ok || !per100) return;
    const food = upsert({
      name: name.trim().slice(0, 80), category: 'My foods', state: 'na', per100, portions: [{ label: '1 serving (all of it)', grams: Math.round(weight) }],
      sourceNote: `Your recipe: ${items.map((i) => `${i.name} ${Math.round(i.grams)} g`).join(', ')}`.slice(0, 300),
      recipe: { ingredients: items, cookedGrams: Math.round(weight), servings: 1 },
    });
    haptic();
    toast(`Saved to My foods: ${food.name}`);
    onDone(food);
  }
  return (
    <div className="space-y-3 pb-2">
      <input className="field" placeholder="Name, e.g. Mum’s coleslaw or Pepper sauce" value={name} onChange={(e) => setName(e.target.value)} aria-label="Food name" maxLength={80} />
      <p className="text-[13px] text-silver">Add what's in it and how much of each. The nutrition is worked out from the database.</p>
      {items.length > 0 && (
        <div className="card divide-y divide-line p-1.5">
          {items.map((it, i) => (
            <div key={it.foodId + i} className="px-2 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{it.name}</span>
                <button onClick={() => setItems((cur) => cur.filter((_, k) => k !== i))} className="grid h-9 w-9 place-items-center rounded-full text-silver" aria-label={`Remove ${it.name}`}><Trash2 size={17} /></button>
              </div>
              <IngredientAmount item={it} food={foodById(it.foodId)} onChange={(v) => setItems((cur) => cur.map((x, k) => (k === i ? { ...x, ...v } : x)))} />
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-silver" />
        <input className="field !pl-11" placeholder="+ Add an ingredient" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ingredients" />
      </div>
      {results.length > 0 && (
        <div className="card p-1.5">
          {results.map((f) => (
            <button key={f.id} onClick={() => { haptic(); const st = startMeasure(f); setItems((cur) => [...cur, { foodId: f.id, name: splitName(f.name).title, grams: st.grams, per100: f.per100, unit: st.unit, qty: st.qty }]); setQ(''); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:bg-raised">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Plus size={16} /></span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{splitName(f.name).title}</span>
            </button>
          ))}
        </div>
      )}
      {items.length > 1 && (
        <label className="flex items-center justify-between gap-2 text-sm"><span className="font-semibold">Weight after cooking <span className="font-normal text-silver">(optional)</span></span><span className="relative"><input inputMode="numeric" className="field !h-10 !w-28 pr-8 text-right" placeholder={String(Math.round(total))} value={cooked} onChange={(e) => setCooked(e.target.value.replace(/\D/g, '').slice(0, 5))} aria-label="Weight after cooking" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-silver">g</span></span></label>
      )}
      {per100 && (
        <p className="num rounded-2xl bg-raised px-3 py-2 text-[13px]">All of it ({fmt(weight)} g): <b>{per100.kcal != null ? fmt((per100.kcal * weight) / 100) : '–'} kcal</b> · P {fmt((per100.protein * weight) / 100, 1)} g · C {per100.carbs != null ? fmt((per100.carbs * weight) / 100, 1) : '–'} g · F {per100.fat != null ? fmt((per100.fat * weight) / 100, 1) : '–'} g</p>
      )}
      <button disabled={!ok} onClick={save} className="btn-primary w-full">Save to My foods</button>
    </div>
  );
}

function Form({ from, onDone, initialName }: { from?: Food; onDone: (f?: Food) => void; initialName?: string }) {
  const upsert = useStore((s) => s.upsertCustomFood);
  const firstServing = from?.portions?.[0];
  const mine = from?.source === 'custom' ? (from as CustomFood) : undefined;
  const [name, setName] = useState(mine ? from!.name : from ? `${from.name} (my version)` : initialName ?? '');
  const [state, setState] = useState<PrepState>(from?.state ?? 'na');
  const [basis, setBasis] = useState<'serving' | '100'>(from ? '100' : 'serving');
  const [servingLabel, setServingLabel] = useState(firstServing?.label ?? '1 serving');
  const [servingGrams, setServingGrams] = useState(firstServing ? String(firstServing.grams) : '');
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map(([k]) => [k, from?.per100[k] != null ? String(Math.round((from.per100[k] as number) * 10) / 10) : ''])));
  const n = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
  const sg = n(servingGrams);
  const factor = basis === '100' ? 1 : sg && sg > 0 ? 100 / sg : null;
  const per100 = Object.fromEntries(FIELDS.map(([k]) => { const x = n(v[k]); return [k, x == null || factor == null ? null : Math.round(x * factor * 100) / 100]; })) as unknown as Per100;
  const errors: string[] = [];
  if (name.trim().length < 2) errors.push('Give it a name.');
  if (basis === 'serving' && !(sg && sg > 0 && sg <= 3000)) errors.push('Enter the serving size in grams (on the pack, e.g. “per 30 g”).');
  if (per100.protein == null) errors.push('Protein is needed (0 is fine).');
  // Missing calories are allowed: the food is saved as incomplete and totals say so, never as zero.
  const incomplete = per100.kcal == null || per100.carbs == null || per100.fat == null;
  for (const [k, label] of FIELDS) { const x = per100[k] as number | null; if (x != null && (Number.isNaN(x) || x < 0)) errors.push(`${label} must be a number.`); }
  if ((per100.kcal ?? 0) > 902) errors.push('Those calories are more than any food has per 100 g — check the serving size.');
  const mass = (per100.protein ?? 0) + (per100.carbs ?? 0) + (per100.fat ?? 0);
  if (mass > 100.5) errors.push(`Protein + carbs + fat come to ${fmt(mass, 1)} g per 100 g, which isn’t possible — check the numbers.`);

  function save() {
    if (errors.length) return;
    const portions = sg && sg > 0 ? [{ label: servingLabel.trim() || '1 serving', grams: Math.round(sg * 10) / 10 }] : (from?.portions ?? []);
    const food = upsert({
      ...(mine ? { id: mine.id } : {}),
      name: name.trim().slice(0, 80), category: 'My foods', state, per100: { ...per100, protein: per100.protein ?? 0 }, portions,
      sourceNote: mine ? mine.sourceNote : from ? `Your corrected version of “${from.name}”` : basis === 'serving' ? `Your numbers, per ${servingLabel} (${sg} g)` : 'Your numbers, per 100 g',
    });
    haptic();
    toast(`Saved to My foods: ${food.name}`);
    onDone(food);
  }

  return (
    <div className="space-y-3 pb-2">
      <input className="field" placeholder="Name, e.g. Mum’s moi moi or Brand protein bar" value={name} onChange={(e) => setName(e.target.value)} aria-label="Food name" maxLength={80} />
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">Weighed</span><Segmented<PrepState> value={state} onChange={setState} options={[{ value: 'na', label: 'As is' }, { value: 'raw', label: 'Raw' }, { value: 'cooked', label: 'Cooked' }]} /></div>
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">Numbers are</span><Segmented<'serving' | '100'> value={basis} onChange={setBasis} options={[{ value: 'serving', label: 'Per serving' }, { value: '100', label: 'Per 100 g' }]} /></div>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <input className="field" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} aria-label="Serving name" placeholder="1 bar, 1 cup, 1 piece…" />
        <div className="relative"><input className="field pr-8" inputMode="decimal" value={servingGrams} onChange={(e) => setServingGrams(e.target.value)} aria-label="Serving size in grams" placeholder={basis === 'serving' ? 'grams' : 'optional'} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-silver">g</span></div>
      </div>
      {name.trim().length >= 2 && (
        <div className="-mt-1 flex flex-wrap items-center gap-1.5" role="group" aria-label="Suggested serving units">
          <span className="text-[12px] text-silver">{GROUP_NAMES[groupOf({ name, category: '', source: 'custom' })]} · measured in:</span>
          {suggestedUnits(name).filter((u) => u !== 'g').map((u) => <button key={u} type="button" onClick={() => setServingLabel(`1 ${u}`)} className={cx('chip !h-8 !px-3 text-[13px]', servingLabel === `1 ${u}` && 'chip-on')}>{u}</button>)}
          <span className="text-[12px] text-dim">then enter how many grams one weighs</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(([k, label, unit]) => (
          <label key={k} className="rounded-2xl bg-raised px-3 py-2">
            <span className="block text-xs font-semibold text-silver">{label} ({unit}){k === 'protein' ? '' : ' · optional'}</span>
            <input inputMode="decimal" aria-label={label} className="num mt-0.5 w-full bg-transparent text-[17px] font-bold outline-none" placeholder="—" value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value.replace(/[^\d.,]/g, '') }))} />
          </label>
        ))}
      </div>
      <p className="text-xs text-dim">Empty boxes stay “unknown”, not zero. {basis === 'serving' ? 'We work out per 100 g from your serving size.' : ''}</p>
      {errors.length > 0 && name && <p className="text-sm text-danger">{errors[0]}</p>}
      {!errors.length && incomplete && name && <p className="rounded-2xl bg-warn/15 px-3 py-2 text-[13px]">Some values are missing. You can still save it; it’s marked as incomplete and totals show the gap instead of counting it as zero.</p>}
      {mine?.changes?.length ? (
        <details className="rounded-2xl bg-raised px-4 py-3 text-[13px] text-silver">
          <summary className="cursor-pointer font-semibold text-ink">Earlier values ({mine.changes.length})</summary>
          <ul className="mt-2 space-y-1">
            {mine.changes.map((c) => <li key={c.at} className="num">{new Date(c.at).toLocaleDateString()}: {c.per100.kcal ?? '–'} kcal · P {c.per100.protein ?? '–'} · C {c.per100.carbs ?? '–'} · F {c.per100.fat ?? '–'} g per 100 g</li>)}
          </ul>
        </details>
      ) : null}
      <button disabled={errors.length > 0} onClick={save} className="btn-primary w-full">Save to My foods</button>
    </div>
  );
}
