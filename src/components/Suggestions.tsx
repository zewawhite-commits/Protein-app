import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { searchFoods, splitName } from '@/lib/foods';
import { fitsDiet } from '@/lib/goals';
import { gramsForProtein } from '@/lib/nutrition';
import { todayKey } from '@/lib/dates';
import type { Food } from '@/lib/types';
import type { Idea } from '@/lib/recommendation';
import { FoodVisual } from './FoodIcon';
import { cx, fmt } from './ui';
import { haptic } from './fx';

interface Row { key: string; title: string; sub?: string; why?: string; food?: Food; query: string }

/** How much of a food closes the gap — or what a normal portion gives if that would be a lot. */
function amountLine(food: Food, remaining: number): string {
  const grams = gramsForProtein(food.per100.protein, remaining);
  if (grams && grams <= 350) return `~${fmt(grams)} g covers what’s left`;
  const portion = 150;
  return `${portion} g gives ${fmt((food.per100.protein * portion) / 100)} g protein`;
}

/**
 * "What to eat next": by default high-protein foods from the database that fit the diet;
 * on request, AI ideas from the user's country (names only — numbers come from the database).
 */
export function Suggestions({ remaining }: { remaining: number }) {
  const { db } = useFoodDb();
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const premiumToken = useStore((s) => s.premium?.token);
  const custom = useStore((s) => s.customFoods);
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; ideas: Idea[]; message?: string; premium?: boolean }>({ state: 'idle', ideas: [] });

  const eatenToday = useMemo(() => entries.filter((e) => e.date === todayKey()).map((e) => splitName(e.food.name).title), [entries]);

  const baseRows: Row[] = useMemo(() => {
    if (!db) return [];
    const eatenIds = new Set(entries.filter((e) => e.date === todayKey()).map((e) => e.foodId));
    return db.quickPicks
      .filter((f) => fitsDiet(f, profile?.diet) && !eatenIds.has(f.id) && f.state !== 'raw' && f.state !== 'dry')
      .sort((a, b) => b.per100.protein - a.per100.protein)
      .slice(0, 4)
      .map((f) => ({ key: f.id, title: splitName(f.name).title, food: f, query: splitName(f.name).title }));
  }, [db, entries, profile?.diet]);

  const aiRows: Row[] = useMemo(
    () =>
      ai.ideas.map((idea, i) => {
        const match = idea.searchQueries.concat(idea.localName, idea.name).filter(Boolean).map((q) => searchFoods(q, { custom, limit: 1 })[0]).find(Boolean);
        return { key: `ai${i}`, title: idea.localName && idea.localName !== idea.name ? idea.localName : idea.name, sub: idea.localName && idea.localName !== idea.name ? idea.name : undefined, why: idea.why, food: match, query: idea.searchQueries[0] ?? idea.name };
      }),
    [ai.ideas, custom],
  );

  async function getIdeas() {
    haptic();
    setAi({ state: 'loading', ideas: [] });
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(premiumToken && { authorization: `Bearer ${premiumToken}` }) },
        body: JSON.stringify({ country: profile?.country, diet: profile?.diet, remainingGrams: remaining, eatenToday }),
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!isJson || res.status === 404 || res.status === 501) throw new Error('AI ideas aren’t switched on yet — here are great options from the database.');
      const data = (await res.json()) as { ideas?: Idea[]; error?: string };
      if (res.status === 402) return setAi({ state: 'error', ideas: [], message: data.error, premium: true });
      if (!res.ok) throw new Error(data.error || 'Could not get ideas.');
      setAi({ state: 'done', ideas: data.ideas ?? [] });
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
          <p className="num text-[13px] text-silver">{fmt(remaining)} g protein to go{ai.state === 'done' && profile?.country ? ` · ideas from ${profile.country}` : ''}</p>
        </div>
        {ai.state !== 'done' && (
          <button onClick={getIdeas} disabled={ai.state === 'loading'} className="chip !h-9 shrink-0 !bg-accent/10 !text-accent">
            {ai.state === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {profile?.country ? 'Local ideas' : 'AI ideas'}
          </button>
        )}
      </div>

      {ai.state === 'error' && (
        <p className="mt-3 rounded-2xl bg-raised px-3 py-2 text-xs text-silver">
          {ai.message} {ai.premium && <Link to="/premium" className="font-semibold text-accent">See plans</Link>}
        </p>
      )}

      <div className="-mx-2 mt-3">
        {rows.map((r) => (
          <Link key={r.key} to={`/add?q=${encodeURIComponent(r.query)}`} onClick={() => haptic()} className="flex items-center gap-3 rounded-2xl p-2 transition active:bg-raised/60">
            <FoodVisual name={r.food?.name ?? r.title} category={r.food?.category} fdcId={r.food?.fdcId} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{r.title}{r.sub && <span className="font-normal text-silver"> · {r.sub}</span>}</p>
              {r.why && <p className="line-clamp-2 text-xs text-silver">{r.why}</p>}
              <p className={cx('num text-xs', r.food ? 'text-ink/80' : 'text-dim')}>
                {r.food ? `${fmt(r.food.per100.protein, 1)} g / 100 g · ${amountLine(r.food, remaining)}` : 'Not in our database yet — tap to search'}
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-dim" />
          </Link>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-dim">{ai.state === 'done' ? 'Ideas by AI. Protein numbers from USDA / FAO records.' : 'High-protein foods from the database that fit your diet.'}</p>
    </section>
  );
}
