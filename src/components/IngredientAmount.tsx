import type { Food, RecipeDef } from '@/lib/types';
import { parseQty, unitOptions } from '@/lib/units';
import { haptic } from './fx';
import { fmt } from './ui';

type Item = RecipeDef['ingredients'][number];

/**
 * How much of one ingredient: a quantity (½, 1½, 2…) and a unit that fits this food
 * (g, then e.g. cup / tbsp for oats, banana for bananas, tsp / tbsp for honey). Grams are worked
 * out from the food's own measure, so the nutrition stays exact.
 */
export function IngredientAmount({ item, food, onChange }: { item: Item; food: Food | undefined; onChange: (next: Pick<Item, 'unit' | 'qty' | 'grams'>) => void }) {
  const opts = food ? unitOptions(food) : [{ key: 'g', label: 'g', grams: 1 }];
  const unit = opts.find((o) => o.key === (item.unit ?? 'g')) ?? opts[0];
  const qtyText = item.qty ?? String(Math.round((item.grams / unit.grams) * 100) / 100);
  const set = (qty: string, u = unit) => { const n = parseQty(qty); onChange({ unit: u.key, qty, grams: n >= 0 ? Math.min(Math.round(n * u.grams * 10) / 10, 20000) : item.grams }); };
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <input inputMode="text" aria-label={`How much ${item.name}`} className="num h-10 w-16 rounded-xl bg-raised px-2 text-center text-[16px] font-bold outline-none" value={qtyText} onFocus={(e) => e.target.select()} onChange={(e) => set(e.target.value.replace(/[^\d.,/ ½¼¾⅓⅔]/g, '').slice(0, 7))} />
      <select aria-label={`Unit for ${item.name}`} value={unit.key} onChange={(e) => { const u = opts.find((o) => o.key === e.target.value) ?? opts[0]; haptic(); set(u.key === 'g' || u.key === 'ml' ? String(Math.round(item.grams / u.grams)) : u.key === 'oz' ? String(Math.round((item.grams / u.grams) * 10) / 10) : '1', u); }} className="h-10 min-w-0 max-w-[11rem] flex-1 truncate rounded-xl bg-raised px-2 text-[14px] font-semibold">
        {opts.map((o) => <option key={o.key} value={o.key}>{o.label}{o.key === o.label ? '' : ` (${Math.round(o.grams)} g${o.estimated ? ', est.' : ''})`}</option>)}
      </select>
      {unit.key !== 'g' && <span className="num shrink-0 text-[13px] text-silver">= {fmt(item.grams)} g</span>}
    </div>
  );
}
