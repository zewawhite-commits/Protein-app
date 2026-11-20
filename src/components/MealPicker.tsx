import type { Meal } from '@/lib/types';
import { Segmented, cx } from './ui';

/** Four meals fit as a segmented control; more slots wrap as chips so nothing gets squashed. */
export function MealPicker({ value, onChange, options }: { value: Meal; onChange: (m: Meal) => void; options: { value: Meal; label: string }[] }) {
  if (options.length <= 4) return <Segmented full value={value} onChange={onChange} options={options} />;
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Meal">
      {options.map((o) => <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={cx('chip !h-10', value === o.value && 'chip-on')}>{o.label}</button>)}
    </div>
  );
}
