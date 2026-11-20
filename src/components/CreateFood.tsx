import { useState } from 'react';
import { useStore } from '@/store/useStore';
import type { Food, Per100, PrepState } from '@/lib/types';
import { Segmented, Sheet, fmt } from './ui';
import { haptic, toast } from './fx';

const FIELDS: [keyof Per100, string, string][] = [
  ['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g'],
  ['fiber', 'Fibre', 'g'], ['sugar', 'Sugars', 'g'], ['satFat', 'Saturated fat', 'g'], ['sodium', 'Sodium', 'mg'],
];

/**
 * Add your own food, or your own corrected version of one: the numbers from a pack label
 * (per serving or per 100 g) or from anywhere you trust. Saved to My foods; nothing else changes.
 */
export function CreateFood({ open, onClose, from, onSaved }: { open: boolean; onClose: () => void; from?: Food | null; onSaved?: (f: Food) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={from ? 'Your own version' : 'Create a food'}>
      {open && <Form from={from ?? undefined} onDone={(f) => { onClose(); if (f) onSaved?.(f); }} />}
    </Sheet>
  );
}

function Form({ from, onDone }: { from?: Food; onDone: (f?: Food) => void }) {
  const upsert = useStore((s) => s.upsertCustomFood);
  const firstServing = from?.portions?.[0];
  const [name, setName] = useState(from ? `${from.name} (my version)` : '');
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
  if (per100.kcal == null) errors.push('Calories are needed.');
  for (const [k, label] of FIELDS) { const x = per100[k] as number | null; if (x != null && (Number.isNaN(x) || x < 0)) errors.push(`${label} must be a number.`); }
  if ((per100.kcal ?? 0) > 902) errors.push('Those calories are more than any food has per 100 g — check the serving size.');
  const mass = (per100.protein ?? 0) + (per100.carbs ?? 0) + (per100.fat ?? 0);
  if (mass > 100.5) errors.push(`Protein + carbs + fat come to ${fmt(mass, 1)} g per 100 g, which isn’t possible — check the numbers.`);

  function save() {
    if (errors.length) return;
    const portions = sg && sg > 0 ? [{ label: servingLabel.trim() || '1 serving', grams: Math.round(sg * 10) / 10 }] : (from?.portions ?? []);
    const food = upsert({
      name: name.trim().slice(0, 80), category: 'My foods', state, per100: { ...per100, protein: per100.protein ?? 0 }, portions,
      sourceNote: from ? `Your corrected version of “${from.name}”` : basis === 'serving' ? `Your numbers, per ${servingLabel} (${sg} g)` : 'Your numbers, per 100 g',
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
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(([k, label, unit]) => (
          <label key={k} className="rounded-2xl bg-raised px-3 py-2">
            <span className="block text-xs font-semibold text-silver">{label} ({unit}){k === 'kcal' || k === 'protein' ? '' : ' · optional'}</span>
            <input inputMode="decimal" aria-label={label} className="num mt-0.5 w-full bg-transparent text-[17px] font-bold outline-none" placeholder="—" value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value.replace(/[^\d.,]/g, '') }))} />
          </label>
        ))}
      </div>
      <p className="text-xs text-dim">Empty boxes stay “unknown”, not zero. {basis === 'serving' ? 'We work out per 100 g from your serving size.' : ''}</p>
      {errors.length > 0 && name && <p className="text-sm text-danger">{errors[0]}</p>}
      <button disabled={errors.length > 0} onClick={save} className="btn-primary w-full">Save to My foods</button>
    </div>
  );
}
