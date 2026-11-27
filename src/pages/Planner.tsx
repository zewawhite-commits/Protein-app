import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Lock, Plus, Repeat, ShoppingBasket, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useHasTier } from '@/lib/perks';
import { addDays, fromKey, todayKey, weekOf } from '@/lib/dates';
import { sumEntries, dailyGoal } from '@/lib/nutrition';
import { dailyTargets } from '@/lib/energy';
import { splitName } from '@/lib/foods';
import type { LogEntry, Meal } from '@/lib/types';
import { Sheet, cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';

const SLOTS: { meal: Meal; label: string }[] = [
  { meal: 'breakfast', label: 'Breakfast' }, { meal: 'lunch', label: 'Lunch' }, { meal: 'dinner', label: 'Dinner' }, { meal: 'snack', label: 'Snacks' },
];
const slotOf = (m: Meal): Meal => (m === 'snack2' || m === 'snack3' || m === 'extra' ? 'snack' : m);

/**
 * Weekly meal planner (Plus). Plan breakfast, lunch, dinner and snacks for seven days from the
 * food database or your own meals. Planned food never counts as eaten: tap "Log as eaten" when
 * you actually have it, and if you eat something else, the plan simply stays a plan.
 */
export default function Planner() {
  const nav = useNavigate();
  const plus = useHasTier('plus');
  const today = todayKey();
  const [day, setDay] = useState(today);
  const [shop, setShop] = useState(false);
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const update = useStore((s) => s.updateEntry);
  const remove = useStore((s) => s.removeEntry);
  const addEntry = useStore((s) => s.addEntry);
  const week = weekOf(day);
  const planned = useMemo(() => entries.filter((e) => e.planned && week.includes(e.date)), [entries, week]);
  const dayPlan = planned.filter((e) => e.date === day);
  const goal = profile ? dailyGoal(profile) : null;
  const targets = profile && goal ? dailyTargets(profile, goal) : null;
  const t = sumEntries(dayPlan.map((e) => ({ ...e, planned: false })));

  if (!plus) {
    return (
      <div className="mx-auto max-w-lg animate-fade-up px-5 pb-16">
        <Header onBack={() => nav(-1)} />
        <div className="card p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/12 text-primary"><Lock size={24} /></span>
          <p className="mt-3 text-[19px] font-bold">Plan your whole week with Plus</p>
          <p className="mt-1 text-[15px] text-silver">Breakfast, lunch, dinner and snacks for seven days, nutrition totals before you eat, a grocery list in one tap, and “Log as eaten” when you have it.</p>
          <Link to="/premium" className="btn-primary mt-5 w-full">Explore Plus</Link>
          <p className="mt-3 text-[13px] text-dim">On Free you can still plan any single future day from Home: tap a day in the week strip, then “+ Plan food”.</p>
        </div>
      </div>
    );
  }

  const logEaten = (e: LogEntry) => {
    haptic(15);
    if (e.date > today) { update(e.id, { planned: false, date: today }); toast(`${splitName(e.food.name).title} logged for today`); }
    else { update(e.id, { planned: false }); toast(`${splitName(e.food.name).title} logged as eaten`); }
  };
  const copy = (from: string, to: string) => {
    const src = planned.filter((e) => e.date === from);
    for (const e of src) addEntry({ date: to, meal: e.meal, food: e.food as never, grams: e.grams, planned: true });
    toast(`Copied ${src.length} item${src.length === 1 ? '' : 's'} to ${fromKey(to).toLocaleDateString(undefined, { weekday: 'long' })}`);
  };
  const repeat = (e: LogEntry) => {
    let n = 0;
    for (let i = 1; i <= 6; i++) { const d = addDays(e.date, i); if (week.includes(d)) { addEntry({ date: d, meal: e.meal, food: e.food as never, grams: e.grams, planned: true }); n++; } }
    toast(n ? `Repeated on the next ${n} day${n === 1 ? '' : 's'} this week` : 'Nothing left this week to repeat on');
  };

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-5 pb-16">
      <Header onBack={() => nav(-1)} onShop={() => setShop(true)} />
      <div className="flex items-center justify-between">
        <button onClick={() => setDay(addDays(day, -7))} className="grid h-10 w-10 place-items-center rounded-full bg-surface" aria-label="Previous week"><ChevronLeft size={18} /></button>
        <p className="font-semibold">{fromKey(week[0]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – {fromKey(week[6]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
        <button onClick={() => setDay(addDays(day, 7))} className="grid h-10 w-10 place-items-center rounded-full bg-surface" aria-label="Next week"><ChevronRight size={18} /></button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5" role="tablist" aria-label="Days">
        {week.map((d) => {
          const n = planned.filter((e) => e.date === d).length;
          return (
            <button key={d} role="tab" aria-selected={d === day} onClick={() => { haptic(); setDay(d); }} className={cx('flex flex-col items-center rounded-2xl py-2 text-[12px] font-semibold', d === day ? 'bg-primary text-on-primary' : 'bg-surface')}>
              {fromKey(d).toLocaleDateString(undefined, { weekday: 'short' })}
              <span className="num text-[16px] font-extrabold">{fromKey(d).getDate()}</span>
              <span className={cx('mt-0.5 h-1.5 w-1.5 rounded-full', n ? (d === day ? 'bg-on-primary' : 'bg-primary') : 'bg-transparent')} />
            </button>
          );
        })}
      </div>

      <section className="card mt-4 p-4">
        <p className="text-[13px] font-semibold text-silver">{fromKey(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · planned</p>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          {([['kcal', t.kcal, targets?.kcal], ['Protein', t.protein, goal], ['Carbs', t.carbs, targets?.carbs], ['Fat', t.fat, targets?.fat]] as const).map(([l, v, tg]) => (
            <div key={l} className="rounded-2xl bg-raised py-2"><p className="num text-[16px] font-extrabold">{fmt(v)}{l === 'kcal' ? '' : 'g'}</p><p className="text-[11px] text-silver">{l}{tg ? ` / ${fmt(tg)}` : ''}</p></div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setCopyFrom(day)} disabled={!dayPlan.length} className="chip !h-9 flex-1 justify-center text-[13px]"><Copy size={14} /> Copy this day</button>
        </div>
      </section>

      {SLOTS.map((s) => {
        const items = dayPlan.filter((e) => slotOf(e.meal) === s.meal);
        return (
          <section key={s.meal} className="mt-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-[17px] font-bold">{s.label}</p>
              <Link to={`/add?date=${day}&meal=${s.meal}&plan=1`} className="chip !h-9 !px-3 text-[13px]"><Plus size={14} /> Add meal</Link>
            </div>
            {items.length === 0 ? <p className="mt-2 px-1 text-[14px] text-dim">Nothing planned yet</p> : (
              <ul className="mt-2 space-y-2">
                {items.map((e) => (
                  <li key={e.id} className="card p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{splitName(e.food.name).title}</p>
                        <p className="num text-[13px] text-silver">{fmt(e.grams)} g · {fmt(((e.food.per100.kcal ?? 0) * e.grams) / 100)} kcal · {fmt((e.food.per100.protein * e.grams) / 100)} g protein · <span className="text-primary">Planned</span></p>
                      </div>
                      <button onClick={() => { remove(e.id); toast('Removed from plan'); }} className="grid h-8 w-8 shrink-0 place-items-center text-silver" aria-label="Remove from plan"><Trash2 size={15} /></button>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <button onClick={() => logEaten(e)} className="chip chip-on !h-8 !px-3 text-[13px]"><Check size={14} /> {e.date > today ? 'Ate it today' : 'Log as eaten'}</button>
                      <button onClick={() => repeat(e)} className="chip !h-8 !px-3 text-[13px]"><Repeat size={13} /> Repeat this week</button>
                      <select value={e.date} onChange={(ev) => { update(e.id, { date: ev.target.value }); toast('Moved'); }} className="chip !h-8 !px-2 text-[13px]" aria-label="Move to another day">
                        {week.map((d) => <option key={d} value={d}>{d === e.date ? 'Move to…' : fromKey(d).toLocaleDateString(undefined, { weekday: 'long' })}</option>)}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className="mt-6 text-[12px] leading-relaxed text-dim">Planned food isn’t counted as eaten. If you eat something else, log that instead; the plan stays as it was.</p>

      <Sheet open={!!copyFrom} onClose={() => setCopyFrom(null)} title="Copy this day to…">
        <div className="grid gap-2">
          {week.filter((d) => d !== copyFrom).map((d) => <button key={d} onClick={() => { copy(copyFrom!, d); setCopyFrom(null); }} className="btn-ghost w-full">{fromKey(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</button>)}
        </div>
      </Sheet>
      <ShoppingList open={shop} onClose={() => setShop(false)} items={planned} />
    </div>
  );
}

function Header({ onBack, onShop }: { onBack: () => void; onShop?: () => void }) {
  return (
    <header className="pt-safe flex items-center gap-3 pb-4">
      <button onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
      <h1 className="flex-1 text-[26px] font-extrabold tracking-tight">Meal planner</h1>
      {onShop && <button onClick={onShop} className="chip !h-10"><ShoppingBasket size={15} /> Grocery list</button>}
    </header>
  );
}

/** Everything planned this week, added up by food, ready to copy or share. */
function ShoppingList({ open, onClose, items }: { open: boolean; onClose: () => void; items: LogEntry[] }) {
  const [got, setGot] = useState<string[]>([]);
  const list = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of items) { const k = splitName(e.food.name).title; m.set(k, (m.get(k) ?? 0) + e.grams); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);
  const text = `Nutivili grocery list\n${list.map(([n, g]) => `• ${n}: ${g >= 1000 ? `${fmt(g / 1000, 1)} kg` : `${fmt(g)} g`}`).join('\n')}`;
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: 'Grocery list', text }); return; } } catch (e) { if ((e as Error).name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('Grocery list copied'); } catch { toast('Couldn’t copy. Select the list and copy it.'); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Grocery list for this week">
      {list.length === 0 ? <p className="text-silver">Plan some meals first and the list fills itself in.</p> : (
        <>
          <ul className="divide-y divide-line">
            {list.map(([n, g]) => (
              <li key={n}>
                <label className="flex items-center gap-3 py-3">
                  <input type="checkbox" checked={got.includes(n)} onChange={() => setGot((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]))} className="h-5 w-5 accent-[rgb(var(--accent))]" />
                  <span className={cx('flex-1', got.includes(n) && 'text-dim line-through')}>{n}</span>
                  <span className="num font-semibold">{g >= 1000 ? `${fmt(g / 1000, 1)} kg` : `${fmt(g)} g`}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-dim">Amounts are the weights you planned (cooked dishes are by cooked weight), so buy a little extra for raw ingredients.</p>
          <button onClick={() => void share()} className="btn-primary mt-4 w-full">Share or copy list</button>
        </>
      )}
    </Sheet>
  );
}
