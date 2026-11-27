import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { mealForNow, todayKey } from '@/lib/dates';
import { useMealOptions } from '@/lib/meals';
import type { Food, Meal } from '@/lib/types';
import { Sheet, cx } from './ui';
import { haptic, toast } from './fx';

/**
 * Quick calorie entry: type the calories (and macros if you know them) without picking a food,
 * e.g. from a restaurant menu. Saved as one diary entry; missing macros stay unknown, not zero.
 */
export function QuickCalories({ open, onClose, date = todayKey() }: { open: boolean; onClose: () => void; date?: string }) {
  const addEntry = useStore((s) => s.addEntry);
  const meals = useMealOptions();
  const [meal, setMeal] = useState<Meal>(mealForNow());
  const [name, setName] = useState('');
  const [v, setV] = useState({ kcal: '', protein: '', carbs: '', fat: '' });
  const num = (s: string) => (s.trim() === '' ? null : Math.max(0, Number(s.replace(',', '.'))));
  const kcal = num(v.kcal);
  const ok = kcal != null && kcal > 0 && kcal <= 5000;
  const save = () => {
    if (!ok) return;
    // Stored as 100 g of a one-off food so every total and report treats it like any other entry.
    const food = {
      id: `quick:${crypto.randomUUID()}`, name: `Quick add: ${name.trim() || 'calories'}`, category: 'Quick add', state: 'na',
      per100: { kcal, protein: num(v.protein) ?? 0, carbs: num(v.carbs), fat: num(v.fat), fiber: null },
      portions: [], source: 'custom', sourceNote: 'Entered by you',
    } as unknown as Food;
    addEntry({ date, meal, food, grams: 100, note: num(v.protein) == null ? 'Protein not entered' : undefined });
    haptic(15); toast(`Added ${Math.round(kcal)} kcal to ${meals.find((m) => m.value === meal)?.label ?? 'your diary'}`);
    setName(''); setV({ kcal: '', protein: '', carbs: '', fat: '' }); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Quick calories">
      <input className="field" maxLength={60} placeholder="What was it? (optional)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {([['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g']] as const).map(([k, l, u]) => (
          <label key={k} className="rounded-2xl bg-raised px-3 py-2">
            <span className="block text-xs font-semibold text-silver">{l} ({u}){k === 'kcal' ? '' : ' · optional'}</span>
            <input inputMode="decimal" autoFocus={k === 'kcal'} aria-label={l} className="num mt-0.5 w-full bg-transparent text-[20px] font-bold outline-none" placeholder="—" value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value.replace(/[^\d.,]/g, '').slice(0, 6) }))} />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Meal">
        {meals.map((m) => <button key={m.value} onClick={() => setMeal(m.value)} className={cx('chip !h-9 !px-3 text-[13px]', meal === m.value && 'chip-on')}>{m.label}</button>)}
      </div>
      <p className="mt-2 text-xs text-dim">Macros you leave empty stay unknown in your totals, not zero.</p>
      <button onClick={save} disabled={!ok} className="btn-primary mt-4 w-full">Add{ok ? ` ${Math.round(kcal!)} kcal` : ''}</button>
    </Sheet>
  );
}
