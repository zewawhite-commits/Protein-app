import { useMemo, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { allergensInAll, avoidSet, foodAllergens } from '@/lib/allergens';
import { cx } from './ui';

/** The person's avoid list (allergies plus what their diet preferences imply). */
export function useAvoid(): string[] {
  const avoid = useStore((s) => s.profile?.avoid);
  const prefs = useStore((s) => s.profile?.dietPrefs);
  return useMemo(() => avoidSet({ avoid, dietPrefs: prefs }), [avoid, prefs]);
}

type Named = Parameters<typeof foodAllergens>[0];

export function useAllergens(food: Named | null | undefined): string[] {
  const avoid = useAvoid();
  return useMemo(() => (food ? foodAllergens(food, avoid) : []), [food, avoid]);
}

/** Warning on a food's detail sheet. Never blocks logging — people know their own needs. */
export function AllergyBanner({ food, className }: { food: Named; className?: string }) {
  const hits = useAllergens(food);
  if (!hits.length) return null;
  return (
    <div role="alert" className={cx('flex items-start gap-3 rounded-[20px] bg-danger/10 px-4 py-3 text-danger', className)}>
      <TriangleAlert size={18} className="mt-0.5 shrink-0" />
      <p className="text-[14px] font-semibold leading-snug">
        May contain {hits.join(', ').toLowerCase()} — on your avoid list.
        <span className="block font-normal opacity-90">Based on the name and recipe. Always check the label or ask how it was made.</span>
      </p>
    </div>
  );
}

/** Small tag for lists (search results, scan matches). */
export function AllergyTag({ food }: { food: Named }) {
  const hits = useAllergens(food);
  if (!hits.length) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[12px] font-semibold text-danger" title={`May contain ${hits.join(', ')}`}>
      <TriangleAlert size={12} /> {hits[0]}{hits.length > 1 ? ` +${hits.length - 1}` : ''}
    </span>
  );
}

/** Warning for AI-made recipes and plans, checked against every ingredient name. */
export function AllergyTextBanner({ texts, what, className }: { texts: string[]; what: string; className?: string }) {
  const avoid = useAvoid();
  const hits = useMemo(() => allergensInAll(texts, avoid), [texts, avoid]);
  if (!hits.length) return null;
  return (
    <div role="alert" className={cx('flex items-start gap-3 rounded-[20px] bg-danger/10 px-4 py-3 text-danger', className)}>
      <TriangleAlert size={18} className="mt-0.5 shrink-0" />
      <p className="text-[14px] font-semibold leading-snug">
        This {what} may contain {hits.join(', ').toLowerCase()}, which is on your avoid list.
        <span className="block font-normal opacity-90">Swap those ingredients or ask for a new one.</span>
      </p>
    </div>
  );
}

/** Type your own allergy or food to avoid (anything not in the chips), shown as removable chips. */
export function CustomAvoid({ avoid, setAvoid, known }: { avoid: string[]; setAvoid: (f: (cur: string[]) => string[]) => void; known: string[] }) {
  const [text, setText] = useState('');
  const custom = avoid.filter((a) => !known.includes(a));
  const add = () => {
    const v = text.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!v) return;
    const name = v[0].toUpperCase() + v.slice(1);
    setAvoid((cur) => (cur.some((c) => c.toLowerCase() === name.toLowerCase()) ? cur : [...cur, name]));
    setText('');
  };
  return (
    <div className="mt-2.5">
      {custom.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {custom.map((c) => (
            <button type="button" key={c} onClick={() => setAvoid((cur) => cur.filter((x) => x !== c))} className="chip !h-9 !bg-danger/15 !text-danger" aria-label={`Remove ${c}`}>{c} <X size={14} /></button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input className="field flex-1" placeholder="Something else? e.g. Mango, Okra" aria-label="Add your own allergy or food to avoid" value={text} maxLength={30} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} disabled={!text.trim()} className="btn-ghost !px-4">Add</button>
      </div>
    </div>
  );
}
