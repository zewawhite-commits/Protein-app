import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, Lightbulb, Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { confidentMatch, splitName } from '@/lib/foods';
import { fitsPrefs } from '@/lib/goals';
import { gramsForProtein } from '@/lib/nutrition';
import { addDays, mealForNow, todayKey } from '@/lib/dates';
import { foodAllergens } from '@/lib/allergens';
import { useAvoid } from './Allergy';
import type { Food } from '@/lib/types';
import type { Idea } from '@/lib/recommendation';
import { FoodVisual } from './FoodIcon';
import { aiHeaders } from '@/lib/premium';
import { Segmented, cx, fmt } from './ui';
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
 * on request, AI ideas from the user's country (names only — numbers come from the database).
 */
export function Suggestions({ remaining, kcalLeft }: { remaining: number; kcalLeft?: number }) {
  const { db } = useFoodDb();
  const avoid = useAvoid();
  const [opts, setOpts] = useState<{ open: boolean; minutes: 0 | 15 | 30; budget: 'any' | 'low'; onHand: string }>({ open: false, minutes: 0, budget: 'any', onHand: '' });
  // Ideas already shown, so "More ideas" gives new ones.
  const [shown, setShown] = useState<string[]>([]);
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const custom = useStore((s) => s.customFoods);
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; ideas: Idea[]; message?: string; premium?: boolean }>({ state: 'idle', ideas: [] });

  const eatenToday = useMemo(() => entries.filter((e) => e.date === todayKey()).map((e) => splitName(e.food.name).title), [entries]);
  // Past week (not today), most frequent first, so ideas don't repeat what they always eat.
  const recentWeek = useMemo(() => {
    const fromKey = addDays(todayKey(), -7);
    const count = new Map<string, number>();
    for (const e of entries) if (e.date >= fromKey && e.date < todayKey()) { const t = splitName(e.food.name).title.split(',')[0]; count.set(t, (count.get(t) ?? 0) + 1); }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 15);
  }, [entries]);

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

  const aiRows: Row[] = useMemo(
    () =>
      ai.ideas.map((idea, i) => {
        const match = confidentMatch(idea.searchQueries.concat(idea.localName, idea.name).filter(Boolean), { custom });
        return { key: `ai${i}`, title: idea.localName && idea.localName !== idea.name ? idea.localName : idea.name, sub: idea.localName && idea.localName !== idea.name ? idea.name : undefined, why: idea.why, food: match, query: idea.searchQueries[0] ?? idea.name, minutes: idea.minutes, swap: idea.swap };
      }),
    [ai.ideas, custom],
  );

  async function getIdeas() {
    haptic();
    setAi({ state: 'loading', ideas: [] });
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: await aiHeaders(),
        body: JSON.stringify({
          country: profile?.country, diet: profile?.diet, remainingGrams: remaining, eatenToday, remainingKcal: kcalLeft,
          meal: mealForNow(), maxMinutes: opts.minutes || undefined, budget: opts.budget, onHand: opts.onHand.trim() || undefined,
          recent: [...shown, ...recentWeek],
          goals: profile?.goals ?? (profile?.goal ? [profile.goal] : undefined), activity: profile?.activity,
          age: profile?.age, sex: profile?.sex, pregnant: profile?.pregnant, cuisines: profile?.cuisines, avoid: profile?.avoid,
        }),
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!isJson || res.status === 404 || res.status === 501) throw new Error('AI ideas aren’t switched on yet — here are great options from the database.');
      const data = (await res.json()) as { ideas?: Idea[]; error?: string };
      if (res.status === 402 || res.status === 401) return setAi({ state: 'error', ideas: [], message: data.error, premium: res.status === 402 });
      if (!res.ok) throw new Error(data.error || 'Could not get ideas.');
      setAi({ state: 'done', ideas: data.ideas ?? [] });
      setShown((s) => [...(data.ideas ?? []).map((i) => i.name), ...s].slice(0, 20));
    } catch (e) {
      setAi({ state: 'error', ideas: [], message: (e as Error).message });
    }
  }

  if (remaining <= 0 || !db) return null;
  const rows = ai.state === 'done' && aiRows.length ? aiRows : baseRows;

  return (
    <section className="card mt-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">What to eat next</p>
          <p className="num text-[14px] text-silver">{fmt(remaining)} g protein{kcalLeft != null ? ` · ${kcalLeft >= 0 ? `${fmt(kcalLeft)} kcal left` : `${fmt(-kcalLeft)} kcal over`}` : ''} to go</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={() => { haptic(); setOpts((o) => ({ ...o, open: !o.open })); }} className={cx('chip !h-9 !px-3', opts.open && '!bg-ink !text-bg')} aria-label="Options for AI ideas" aria-expanded={opts.open}><SlidersHorizontal size={14} /></button>
          <button onClick={getIdeas} disabled={ai.state === 'loading'} className="chip !h-9 !bg-accent/10 !text-accent">
            {ai.state === 'loading' ? <Loader2 size={14} className="animate-spin" /> : ai.state === 'done' ? <RefreshCw size={14} /> : <Lightbulb size={14} />} {ai.state === 'done' ? 'More ideas' : 'AI ideas'}
          </button>
        </div>
      </div>

      {opts.open && (
        <div className="mt-3 space-y-2.5 rounded-2xl bg-raised p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold">Time</span>
            <Segmented<'0' | '15' | '30'> value={String(opts.minutes) as '0' | '15' | '30'} onChange={(v) => setOpts((o) => ({ ...o, minutes: Number(v) as 0 | 15 | 30 }))} options={[{ value: '0', label: 'Any' }, { value: '15', label: '15 min' }, { value: '30', label: '30 min' }]} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold">Budget</span>
            <Segmented<'any' | 'low'> value={opts.budget} onChange={(v) => setOpts((o) => ({ ...o, budget: v }))} options={[{ value: 'any', label: 'Any' }, { value: 'low', label: 'Low cost' }]} />
          </div>
          <label className="block">
            <span className="text-[13px] font-semibold">What do you have at home?</span>
            <input id="sugg-onhand" value={opts.onHand} onChange={(e) => setOpts((o) => ({ ...o, onHand: e.target.value.slice(0, 200) }))} placeholder="e.g. eggs, rice, tomatoes, beans" className="field mt-1 !h-11" />
          </label>
          <p className="text-[12px] text-dim">Used for AI ideas. Your allergies and diet always apply.</p>
        </div>
      )}

      {ai.state === 'error' && (
        <p className="mt-3 rounded-2xl bg-raised px-3 py-2 text-xs text-silver">
          {ai.message} {ai.premium && <Link to="/premium" className="font-semibold text-accent">See plans</Link>}
        </p>
      )}

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
      <p className="mt-2 text-[12px] text-dim">{ai.state === 'done' ? 'Ideas by AI. Protein numbers from USDA / FAO records.' : 'High-protein foods from the database that fit your diet.'}</p>
    </section>
  );
}
