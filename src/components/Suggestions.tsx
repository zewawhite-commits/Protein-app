import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, MessageCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { splitName } from '@/lib/foods';
import { fitsPrefs } from '@/lib/goals';
import { gramsForProtein } from '@/lib/nutrition';
import { todayKey } from '@/lib/dates';
import { foodAllergens } from '@/lib/allergens';
import { useAvoid } from './Allergy';
import type { Food } from '@/lib/types';
import { FoodVisual } from './FoodIcon';
import { cx, fmt } from './ui';
import { haptic } from './fx';

interface Row { key: string; title: string; sub?: string; why?: string; food?: Food; query: string; minutes?: number; swap?: string }

/** How much of a food closes the gap — or what a normal portion gives if that would be a lot. */
function amountLine(food: Food, remaining: number): string {
  const grams = gramsForProtein(food.per100.protein, remaining);
  if (grams && grams <= 350) return `~${fmt(grams)} g covers what’s left`;
  // Use the food's own serving (e.g. "2 tbsp, 32 g" for peanut butter) rather than a fixed 150 g.
  // The smallest sensible serving (1 egg, 1 oz of nuts), not a cupful.
  const serving = [...(food.portions ?? [])].filter((x) => x.grams >= 25 && x.grams <= 400).sort((a, b) => a.grams - b.grams)[0];
  const g = serving?.grams ?? 150;
  return `${serving ? `${serving.label.split(' (')[0].split(',')[0]} (${fmt(g)} g)` : `${g} g`} gives ${fmt((food.per100.protein * g) / 100)} g protein`;
}

/**
 * "What to eat next": by default high-protein foods from the database that fit the diet;
 * "Chat ideas" opens the coach for meal ideas.
 */
export function Suggestions({ remaining, kcalLeft }: { remaining: number; kcalLeft?: number }) {
  const { db } = useFoodDb();
  const avoid = useAvoid();
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);

  const baseRows: Row[] = useMemo(() => {
    if (!db) return [];
    const eatenIds = new Set(entries.filter((e) => e.date === todayKey()).map((e) => e.foodId));
    // Whole foods only, one of each kind ("Ground beef" once, not crumbles + patty), short names.
    const seen = new Set<string>();
    return db.quickPicks
      .filter((f) => fitsPrefs(f, profile) && !foodAllergens(f, avoid).length && !eatenIds.has(f.id) && f.state !== 'raw' && f.state !== 'dry' && !/powder|supplement|isolate|bar\b/i.test(f.name))
      .sort((a, b) => b.per100.protein - a.per100.protein)
      .filter((f) => {
        const short = splitName(f.name).title.split(',')[0].trim().toLowerCase();
        if (seen.has(short)) return false;
        seen.add(short);
        return true;
      })
      .slice(0, 4)
      .map((f) => { const short = splitName(f.name).title.split(',')[0].trim(); return { key: f.id, title: short, food: f, query: short }; });
  }, [db, entries, profile, avoid]);

  if (remaining <= 0 || !db) return null;
  const rows = baseRows;

  return (
    <section className="card mt-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">What to eat next</p>
          <p className="num text-[14px] text-silver">{fmt(remaining)} g protein{kcalLeft != null ? ` · ${kcalLeft >= 0 ? `${fmt(kcalLeft)} kcal left` : `${fmt(-kcalLeft)} kcal over`}` : ''} to go</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link to={`/coach?ask=${encodeURIComponent('What should I eat next?')}`} onClick={() => haptic()} className="chip !h-9 !bg-accent/10 !text-accent"><MessageCircle size={14} /> Chat ideas</Link>
        </div>
      </div>


      <div className="-mx-2 mt-3">
        {rows.map((r) => (
          <Link key={r.key} to={`/add?q=${encodeURIComponent(r.query)}`} onClick={() => haptic()} className="flex items-center gap-3 rounded-2xl p-2 transition active:bg-raised/60">
            <FoodVisual name={r.sub ? `${r.title} ${r.sub}` : r.food?.name ?? r.title} category={r.food?.category} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{r.title}{r.sub && <span className="font-normal text-silver"> · {r.sub}</span>}</p>
              {r.why && <p className="line-clamp-2 text-xs text-silver">{r.why}</p>}
              {(r.minutes != null || r.swap) && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-silver">
                  {r.minutes != null && <span className="inline-flex items-center gap-1"><Clock size={11} /> {r.minutes === 0 ? 'Ready to eat' : `~${r.minutes} min`}</span>}
                  {r.swap && <span>Or: {r.swap}</span>}
                </p>
              )}
              <p className={cx('num text-xs', r.food ? 'text-ink/80' : 'text-dim')}>
                {r.food ? `${fmt(r.food.per100.protein, 1)} g / 100 g · ${amountLine(r.food, remaining)}` : 'Not in our database yet — tap to search'}
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-dim" />
          </Link>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-dim">High-protein foods from the database that fit your diet. Tap Chat ideas for meals from the coach.</p>
    </section>
  );
}
