import { AllergyTextBanner } from './Allergy';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, CalendarDays, ChevronRight, Lightbulb, Loader2, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useDay, useFoodDb } from '@/lib/hooks';
import { confidentMatch, splitName } from '@/lib/foods';
import { dailyTargets } from '@/lib/energy';
import { nutrientsFor } from '@/lib/nutrition';
import { todayKey } from '@/lib/dates';
import type { DayPlan, PlanItem } from '@/lib/plan';
import type { Food } from '@/lib/types';
import { useCoachContext } from '@/pages/Coach';
import { aiHeaders } from '@/lib/premium';
import { SignInButtons } from './SignIn';
import { PlanBadge } from './PlanBadge';
import { FoodVisual } from './FoodIcon';
import { FoodSheet } from './FoodSheet';
import { MacroBar } from './Nutrients';
import { cx, fmt } from './ui';
import { haptic, toast } from './fx';

const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' } as const;
const IDEAS = ['Cheap and simple', 'High protein', 'Vegetarian day', 'Training day', 'Quick to cook', 'Mix of world foods'];

/** An AI eating plan for today: foods and portions picked by AI, every number calculated from the database. */
export function PlanView() {
  const context = useCoachContext();
  const saved = useStore((s) => s.savedPlans);
  const savePlan = useStore((s) => s.savePlan);
  const removeSavedPlan = useStore((s) => s.removeSavedPlan);
  const [plan, setPlan] = useState<DayPlan | null>(saved[0]?.plan ?? null);
  const [savedId, setSavedId] = useState<string | null>(saved[0]?.id ?? null);
  const [ask, setAsk] = useState('');
  const [state, setState] = useState<{ busy: boolean; error?: string; premium?: boolean; signIn?: boolean }>({ busy: false });

  async function make(extra = ask) {
    haptic();
    setState({ busy: true });
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: await aiHeaders(),
        body: JSON.stringify({ context, request: extra }),
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!isJson || res.status === 404 || res.status === 501) throw new Error('Eating plans aren’t switched on yet. They will work once the AI key is added on the server.');
      const data = (await res.json()) as DayPlan & { error?: string; premium?: boolean };
      if (res.status === 401) return setState({ busy: false, error: data.error, signIn: true });
      if (res.status === 402) return setState({ busy: false, error: data.error, premium: true });
      if (!res.ok) throw new Error(data.error || 'Could not make a plan.');
      setPlan(data);
      setSavedId(null);
      setState({ busy: false });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <PlanBadge needs="pro" what="AI eating plans" />
      <section className="card p-5">
        <p className="flex items-center gap-2 text-[17px] font-semibold"><CalendarDays size={17} className="text-accent" /> Your eating plan</p>
        <p className="mt-1 text-sm text-silver">A full day of meals built around your goals, targets, the cuisines you enjoy and anything you avoid.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {IDEAS.map((i) => <button key={i} onClick={() => setAsk((a) => (a === i ? '' : i))} className={cx('chip !h-9', ask === i && 'chip-on')}>{i}</button>)}
        </div>
        <input value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={300} placeholder="Anything else? e.g. ‘no cooking at lunch’" className="field mt-3" />
        <button onClick={() => make()} disabled={state.busy} className="btn-primary mt-3 w-full">
          {state.busy ? <><Loader2 size={18} className="animate-spin" /> Building your day…</> : plan ? 'Make a new plan' : 'Make my plan for today'}
        </button>
        {state.error && (
          <p className="mt-3 rounded-2xl bg-raised px-3 py-2 text-sm text-silver">
            {state.error} {state.premium && <Link to="/premium" className="font-semibold text-accent">See plans</Link>}
          </p>
        )}
        {state.signIn && (
          <div className="mt-3"><SignInButtons /></div>
        )}
      </section>

      {saved.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-[15px] font-semibold">Saved plans</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
            {saved.map((p) => (
              <button key={p.id} onClick={() => { haptic(); setPlan(p.plan); setSavedId(p.id); }} className={cx('chip shrink-0', savedId === p.id && 'chip-on')}>
                <BookmarkCheck size={15} /> {p.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {plan && (
        <PlanCard
          plan={plan}
          savedId={savedId}
          onSave={() => { const p = savePlan({ title: plan.title, plan }); setSavedId(p.id); toast('Plan saved'); }}
          onDelete={() => { if (savedId) { removeSavedPlan(savedId); setSavedId(null); toast('Plan removed'); } }}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, savedId, onSave, onDelete }: { plan: DayPlan; savedId: string | null; onSave: () => void; onDelete: () => void }) {
  const { db } = useFoodDb();
  const custom = useStore((s) => s.customFoods);
  const profile = useStore((s) => s.profile);
  const { goal } = useDay(todayKey());
  const targets = profile ? dailyTargets(profile, goal) : null;
  const [open, setOpen] = useState<{ food: Food; grams: number } | null>(null);

  const matched = useMemo(
    () => (db ? plan.meals.map((m) => ({ ...m, rows: m.items.map((it) => ({ it, food: confidentMatch([...it.searchQueries, it.localName, it.name].filter(Boolean), { custom }) })) })) : []),
    [db, plan, custom],
  );
  // Plan totals, calculated from the matched database records (unmatched items are left out).
  const totals = useMemo(() => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, missing: 0 };
    for (const m of matched) for (const r of m.rows) {
      if (!r.food) { t.missing++; continue; }
      const n = nutrientsFor(r.food.per100, r.it.grams);
      t.kcal += n.kcal ?? 0; t.protein += n.protein; t.carbs += n.carbs ?? 0; t.fat += n.fat ?? 0;
    }
    return t;
  }, [matched]);

  return (
    <section className="space-y-3">
      <AllergyTextBanner what="plan" texts={plan.meals.flatMap((m) => [m.title, ...m.items.map((i) => `${i.name} ${i.localName}`)])} />
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[19px] font-bold leading-snug">{plan.title}</p>
          {savedId ? (
            <button onClick={onDelete} className="chip !h-9 shrink-0" aria-label="Remove saved plan"><Trash2 size={15} /> Remove</button>
          ) : (
            <button onClick={onSave} className="chip !h-9 shrink-0 !bg-accent/10 !text-accent"><Bookmark size={15} /> Save</button>
          )}
        </div>
        <p className="num mt-1 text-sm text-silver">
          About <b className="text-ink">{fmt(totals.kcal)} kcal</b>{targets ? ` of ${fmt(targets.kcal)}` : ''} · calculated from the food database
        </p>
        <div className="mt-3 space-y-2.5">
          <MacroBar label="Protein" value={totals.protein} target={goal || undefined} color="protein" />
          <MacroBar label="Carbs" value={totals.carbs} target={targets?.carbs} color="carbs" />
          <MacroBar label="Fat" value={totals.fat} target={targets?.fat} color="fat" />
        </div>
        {totals.missing > 0 && <p className="mt-2 text-xs text-dim">{totals.missing} item{totals.missing > 1 ? 's' : ''} not in our database yet — not counted.</p>}
      </div>

      {matched.map((m, i) => (
        <div key={i} className="card p-2">
          <p className="px-3 pb-1 pt-2.5 text-sm font-semibold text-silver">{MEAL_LABEL[m.meal]} · <span className="text-ink">{m.title}</span></p>
          {m.rows.map(({ it, food }, j) => <PlanRow key={j} item={it} food={food} onOpen={(f) => setOpen({ food: f, grams: it.grams })} />)}
        </div>
      ))}

      {plan.tips.length > 0 && (
        <div className="card p-5">
          <p className="flex items-center gap-2 font-semibold"><Lightbulb size={16} className="text-accent" /> Tips</p>
          <ul className="mt-2 space-y-1.5 text-sm text-silver">{plan.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
        </div>
      )}
      <p className="px-1 text-xs text-dim">Portions are suggestions — tap a food to weigh and log what you actually eat. General guidance, not medical advice.</p>

      <FoodSheet food={open?.food ?? null} date={todayKey()} preset={{ aiEstimate: open?.grams }} onClose={() => setOpen(null)} />
    </section>
  );
}

function PlanRow({ item, food, onOpen }: { item: PlanItem; food?: Food; onOpen: (f: Food) => void }) {
  const title = item.localName && item.localName !== item.name ? item.localName : item.name;
  const visualName = `${item.localName} ${item.name}`;
  if (!food) {
    return (
      <Link to={`/add?q=${encodeURIComponent(item.searchQueries[0] ?? item.name)}`} className="flex items-center gap-3 rounded-[18px] p-2.5">
        <FoodVisual name={visualName} size={46} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{title}</p>
          <p className="text-xs text-dim">~{item.grams} g · not in our database yet — tap to search</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-dim" />
      </Link>
    );
  }
  const n = nutrientsFor(food.per100, item.grams);
  return (
    <button onClick={() => { haptic(); onOpen(food); }} className="flex w-full items-center gap-3 rounded-[18px] p-2.5 text-left transition active:bg-raised/60">
      <FoodVisual name={visualName} category={food.category} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{title}{title !== item.name && <span className="font-normal text-silver"> · {item.name}</span>}</p>
        <p className="num text-xs text-silver">~{item.grams} g · {n.kcal != null ? `${fmt(n.kcal)} kcal · ` : ''}<span className="text-accent">{fmt(n.protein, 1)} g protein</span></p>
        <p className="truncate text-xs text-dim">Matched: {splitName(food.name).title}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-dim" />
    </button>
  );
}
