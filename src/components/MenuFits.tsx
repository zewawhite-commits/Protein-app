import { useMemo } from 'react';
import { ChevronRight, Utensils } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useDay } from '@/lib/hooks';
import { dailyTargets } from '@/lib/energy';
import type { MatchedItem } from '@/lib/recognize-client';
import { foodAllergens } from '@/lib/allergens';
import { useAvoid } from './Allergy';
import { fmt } from './ui';

/**
 * Restaurant menu: which dishes best fit what's left of the day. Estimates use a typical
 * restaurant portion plus the usual hidden oil/butter, from database records.
 */
export function MenuFits({ matches, date, onPick }: { matches: MatchedItem[]; date: string; onPick: (index: number) => void }) {
  const profile = useStore((s) => s.profile);
  const { totals, goal } = useDay(date);
  const avoid = useAvoid();
  const t = profile ? dailyTargets(profile, goal) : null;
  const kcalLeft = t ? t.kcal - totals.kcal : null;
  const proteinLeft = Math.max(0, goal - totals.protein);
  const ranked = useMemo(() => matches.map((m, index) => {
    const f = m.candidates[0];
    if (!f || !m.item.estimatedGrams) return null;
    const g = m.item.estimatedGrams / 100;
    let kcal = (f.per100.kcal ?? 0) * g;
    const protein = f.per100.protein * g;
    for (const h of m.hidden) kcal += ((h.food.per100.kcal ?? 0) * h.extra.usual) / 100;
    const allergens = foodAllergens(f, avoid).concat(...m.item.ingredients.map((i) => foodAllergens({ name: i.name }, avoid)));
    // More protein per calorie is better; going well past the calories left counts against it.
    const over = kcalLeft != null ? Math.max(0, kcal - Math.max(kcalLeft, 300) * 1.1) : 0;
    const score = (protein * 4) / Math.max(kcal, 1) - over / 1000 + (proteinLeft > 0 ? Math.min(protein, proteinLeft) / 200 : 0);
    return { index, name: m.item.name, kcal, protein, allergens: [...new Set(allergens)], score, fits: over === 0 };
  }).filter(Boolean) as { index: number; name: string; kcal: number; protein: number; allergens: string[]; score: number; fits: boolean }[], [matches, avoid, kcalLeft, proteinLeft]);
  const best = ranked.filter((r) => !r.allergens.length).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!best.length) return null;
  return (
    <section className="card mt-4 p-5" aria-label="Best fits on this menu">
      <p className="flex items-center gap-2 text-[17px] font-bold"><Utensils size={18} className="text-accent" /> Best fits for you</p>
      <p className="mt-1 text-[14px] text-silver">{kcalLeft != null ? `You have about ${fmt(Math.max(0, kcalLeft))} kcal and ${fmt(proteinLeft)} g protein left today.` : `About ${fmt(proteinLeft)} g protein left today.`} Estimates use a typical restaurant portion, including the usual oil.</p>
      <ul className="mt-3 space-y-2">
        {best.map((r, k) => (
          <li key={r.index}>
            <button onClick={() => onPick(r.index)} className="flex w-full items-center gap-3 rounded-2xl bg-raised p-3 text-left transition active:scale-[.99]">
              <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-[14px] font-bold text-accent">{k + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="num block text-[13px] text-silver">~{fmt(r.kcal)} kcal · {fmt(r.protein)} g protein{r.fits ? '' : ' · more than you have left'}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-dim" />
            </button>
          </li>
        ))}
      </ul>
      {ranked.some((r) => r.allergens.length) && <p className="mt-2 text-[12px] text-danger">Dishes that may contain something on your avoid list aren’t suggested.</p>}
      <p className="mt-2 text-[12px] text-dim">Restaurant recipes vary — ask how a dish is cooked, and check the full list below.</p>
    </section>
  );
}
