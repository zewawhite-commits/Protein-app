import { useMemo, useState } from 'react';
import { Bookmark, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { nutrientsFor } from '@/lib/nutrition';
import { splitName } from '@/lib/foods';
import { mealForNow } from '@/lib/dates';
import type { LogEntry, Meal, SavedMeal } from '@/lib/types';
import { FoodVisual } from './FoodIcon';
import { Segmented, Sheet, cx, fmt } from './ui';
import { haptic, toast } from './fx';

const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' }, { value: 'lunch', label: 'Lunch' }, { value: 'dinner', label: 'Dinner' }, { value: 'snack', label: 'Snack' },
];

const sum = (items: { food: LogEntry['food']; grams: number }[]) =>
  items.reduce((t, i) => { const n = nutrientsFor(i.food.per100, i.grams); return { kcal: t.kcal + (n.kcal ?? 0), protein: t.protein + n.protein }; }, { kcal: 0, protein: 0 });

/** "Save" button for Today: pick one of today's meals and keep it to log again later. */
export function SaveMealButton({ entries }: { entries: LogEntry[] }) {
  const saveMeal = useStore((s) => s.saveMeal);
  const meals = MEALS.filter((m) => entries.some((e) => e.meal === m.value));
  const [open, setOpen] = useState(false);
  const [meal, setMeal] = useState<Meal>(meals[0]?.value ?? 'breakfast');
  const [name, setName] = useState('');
  if (!meals.length) return null;
  const items = entries.filter((e) => e.meal === meal);
  const t = sum(items);
  return (
    <>
      <button onClick={() => { haptic(); setMeal(meals[0].value); setName(''); setOpen(true); }} className="flex items-center gap-1 text-sm font-semibold text-accent"><Bookmark size={15} /> Save meal</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Save a meal">
        <p className="mb-3 text-sm text-silver">Keep a meal you eat often and log it again in one tap.</p>
        {meals.length > 1 && <Segmented full value={meal} onChange={setMeal} options={meals} />}
        <div className="card mt-3 p-2">
          {items.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-2">
              <FoodVisual name={e.food.name} fdcId={e.food.fdcId} size={40} />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{splitName(e.food.name).title}</p>
              <span className="num text-sm text-silver">{fmt(e.grams)} g</span>
            </div>
          ))}
          <p className="num px-2 pb-1 text-xs text-silver">{fmt(t.kcal)} kcal · {fmt(t.protein, 1)} g protein</p>
        </div>
        <label className="label mt-4" htmlFor="sm-name">Name</label>
        <input id="sm-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={`My ${meal}`} />
        <button onClick={() => { saveMeal(name || `My ${meal}`, items); haptic([10, 30, 10]); toast('Meal saved — find it under Saved when you add food'); setOpen(false); }} className="btn-primary mt-4 w-full">Save meal</button>
      </Sheet>
    </>
  );
}

/** Saved meals list for the food page: log a whole saved meal in one tap. */
export function SavedMealsList({ date }: { date: string }) {
  const saved = useStore((s) => s.savedMeals);
  const addEntry = useStore((s) => s.addEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const removeSavedMeal = useStore((s) => s.removeSavedMeal);
  const [meal, setMeal] = useState<Meal>(mealForNow());
  const totals = useMemo(() => new Map(saved.map((m) => [m.id, sum(m.items)])), [saved]);

  function logAll(m: SavedMeal) {
    haptic([10, 30, 10]);
    const added = m.items.map((i) => addEntry({ date, meal, grams: i.grams, food: { id: i.foodId, name: i.food.name, state: i.food.state, per100: i.food.per100, source: i.food.source, fdcId: i.food.fdcId, ref: i.food.ref, sourceNote: i.food.sourceNote, category: '', portions: [] } }));
    toast(`${m.name} logged to ${meal}`, { action: { label: 'Undo', run: () => added.forEach((e) => removeEntry(e.id)) } });
  }

  if (!saved.length) {
    return <p className="card p-5 text-sm text-silver">No saved meals yet. On Home, tap <b className="text-ink">Save meal</b> next to today’s meals to keep one you eat often.</p>;
  }
  return (
    <div className="space-y-3">
      <Segmented full value={meal} onChange={setMeal} options={MEALS} />
      {saved.map((m) => {
        const t = totals.get(m.id)!;
        return (
          <div key={m.id} className="card p-4">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {m.items.slice(0, 3).map((i, k) => <FoodVisual key={k} name={i.food.name} fdcId={i.food.fdcId} size={40} className="ring-2 ring-surface" />)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{m.name}</p>
                <p className="num text-xs text-silver">{m.items.length} food{m.items.length > 1 ? 's' : ''} · {fmt(t.kcal)} kcal · {fmt(t.protein, 1)} g protein</p>
              </div>
              <button onClick={() => { removeSavedMeal(m.id); toast('Saved meal removed'); }} className="grid h-9 w-9 place-items-center rounded-full bg-raised text-silver" aria-label={`Delete ${m.name}`}><Trash2 size={15} /></button>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-silver">{m.items.map((i) => `${splitName(i.food.name).title} ${fmt(i.grams)} g`).join(' · ')}</p>
            <button onClick={() => logAll(m)} className={cx('btn-primary mt-3 w-full !h-11')}><Plus size={17} /> Log to {MEALS.find((x) => x.value === meal)!.label.toLowerCase()}</button>
          </div>
        );
      })}
      <p className="px-1 text-xs text-dim">Logged with the weights you saved — tap an entry on Home to change it.</p>
    </div>
  );
}
