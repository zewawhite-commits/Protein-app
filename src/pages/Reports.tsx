import { waterGoal } from '@/components/Water';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { addDays, fromKey, toKey, todayKey } from '@/lib/dates';
import { sumEntries, dailyGoal } from '@/lib/nutrition';
import { dailyTargets } from '@/lib/energy';
import { splitName } from '@/lib/foods';
import { Segmented, cx, fmt } from '@/components/ui';
import { downloadDailyReport } from '@/lib/dailyReport';
import { activityName } from '@/lib/exercise';
import { fmtSleep } from '@/components/Sleep';

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

/** Start and end (inclusive) of the week (Mon–Sun) or month that is `offset` periods back. */
function range(period: Exclude<Period, 'custom' | 'day'>, offset: number): { from: string; to: string; label: string } {
  const now = fromKey(todayKey());
  if (period === 'week') {
    const monday = addDays(todayKey(), -((now.getDay() + 6) % 7) - offset * 7);
    const to = addDays(monday, 6);
    const f = (k: string) => fromKey(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return { from: monday, to, label: `${f(monday)} – ${f(to)}` };
  }
  if (period === 'year') {
    const y = now.getFullYear() - offset;
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  }
  const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { from: toKey(first), to: toKey(last), label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
}

/**
 * Weekly, monthly and yearly reports, worked out from your own logs (any past period, so they are
 * always there to revisit). Averages use only days with food logged; missing days are not zero.
 */
export default function Reports() {
  const nav = useNavigate();
  const [period, setPeriod] = useState<Period>('week');
  const [day, setDay] = useState(todayKey());
  const [offset, setOffset] = useState(0);
  const st = useStore();
  // Custom: any dates they pick (defaults to the last 14 days); compared with the same number of days before.
  const [from, setFrom] = useState(addDays(todayKey(), -13));
  const [to, setTo] = useState(todayKey());
  const fmtDay = (k: string) => fromKey(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const span = Math.max(1, Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 864e5) + 1);
  const r = period === 'custom' ? { from, to, label: `${fmtDay(from)} – ${fmtDay(to)}` } : period === 'day' ? { from: day, to: day, label: fmtDay(day) } : range(period, offset);
  const prev = period === 'custom' ? { from: addDays(from, -span), to: addDays(from, -1), label: '' } : period === 'day' ? { from: addDays(day, -1), to: addDays(day, -1), label: '' } : range(period, offset + 1);

  const report = useMemo(() => {
    const stats = (from: string, to: string) => {
      const days = new Map<string, typeof st.entries>();
      for (const e of st.entries) if (e.date >= from && e.date <= to && !e.planned) days.set(e.date, [...(days.get(e.date) ?? []), e]);
      const totals = [...days.values()].map(sumEntries);
      const n = totals.length;
      const avg = (k: 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber') => (n ? totals.reduce((a, t) => a + (t[k] ?? 0), 0) / n : null);
      const water = Object.entries(st.water ?? {}).filter(([d]) => d >= from && d <= to).map(([, ml]) => ml).filter((ml) => ml > 0);
      const workouts = st.exercises.filter((e) => e.date >= from && e.date <= to);
      const nights = Object.entries(st.sleep ?? {}).filter(([d]) => d >= from && d <= to).map(([, v]) => v.hours);
      const stepDays = Object.entries(st.steps ?? {}).filter(([d]) => d >= from && d <= to).map(([, v]) => v.steps);
      const w = st.weights.filter((x) => x.date >= from && x.date <= to);
      const foods = new Map<string, number>();
      for (const list of days.values()) for (const e of list) foods.set(splitName(e.food.name).title, (foods.get(splitName(e.food.name).title) ?? 0) + 1);
      return {
        logged: n, kcal: avg('kcal'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat'), fiber: avg('fiber'),
        water: water.length ? water.reduce((a, b) => a + b, 0) / water.length : null,
        sleep: nights.length ? nights.reduce((a, b) => a + b, 0) / nights.length : null,
        steps: stepDays.length ? stepDays.reduce((a, b) => a + b, 0) / stepDays.length : null,
        workouts: workouts.length, minutes: workouts.reduce((a, e) => a + e.minutes, 0), km: workouts.reduce((a, e) => a + (e.km ?? 0), 0),
        weightChange: w.length >= 2 ? w[w.length - 1].kg - w[0].kg : null, lastWeight: w.length ? w[w.length - 1].kg : null,
        top: [...foods.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
        activities: [...workouts.reduce((m, e) => { const k = activityName(e); const c = m.get(k) ?? { n: 0, min: 0, km: 0, kcal: 0, est: false }; m.set(k, { n: c.n + 1, min: c.min + e.minutes, km: c.km + (e.km ?? 0), kcal: c.kcal + e.kcal, est: c.est || !e.manual }); return m; }, new Map<string, { n: number; min: number; km: number; kcal: number; est: boolean }>()).entries()].sort((a, b) => b[1].min - a[1].min),
        proteinDays: st.profile ? totals.filter((t) => t.protein >= dailyGoal(st.profile!) * 0.9).length : 0,
      };
    };
    return { now: stats(r.from, r.to), before: stats(prev.from, prev.to) };
  }, [st.entries, st.water, st.sleep, st.steps, st.exercises, st.weights, st.profile, r.from, r.to, prev.from, prev.to]);

  const targets = st.profile ? dailyTargets(st.profile, dailyGoal(st.profile)) : null;
  const length = Math.round((fromKey(r.to).getTime() - fromKey(r.from).getTime()) / 864e5) + 1;
  const lb = st.settings.bodyUnit === 'lb';
  const w = (kg: number) => `${fmt(lb ? kg * 2.20462 : kg, 1)} ${lb ? 'lb' : 'kg'}`;
  const { now, before } = report;
  const delta = (a: number | null, b: number | null, unit = '') => (a == null || b == null ? null : `${a - b >= 0 ? '+' : '−'}${fmt(Math.abs(a - b))}${unit}`);

  const rows: [string, string, string | null, number | null][] = [
    ['Calories', now.kcal == null ? '—' : `${fmt(now.kcal)} kcal`, delta(now.kcal, before.kcal), targets?.kcal && now.kcal ? now.kcal / targets.kcal : null],
    ['Protein', now.protein == null ? '—' : `${fmt(now.protein)} g`, delta(now.protein, before.protein, ' g'), st.profile && now.protein ? now.protein / dailyGoal(st.profile) : null],
    ['Carbs', now.carbs == null ? '—' : `${fmt(now.carbs)} g`, delta(now.carbs, before.carbs, ' g'), targets?.carbs && now.carbs ? now.carbs / targets.carbs : null],
    ['Fat', now.fat == null ? '—' : `${fmt(now.fat)} g`, delta(now.fat, before.fat, ' g'), targets?.fat && now.fat ? now.fat / targets.fat : null],
    ['Fiber', now.fiber == null ? '—' : `${fmt(now.fiber)} g`, delta(now.fiber, before.fiber, ' g'), now.fiber ? now.fiber / 30 : null],
    ['Water', now.water == null ? '—' : `${fmt(now.water / 1000, 1)} L`, null, now.water ? now.water / waterGoal(st.profile?.bodyWeightKg, st.settings.waterGoalMl) : null],
    ['Sleep', now.sleep == null ? '—' : fmtSleep(now.sleep), null, now.sleep ? now.sleep / (st.settings.sleepGoalH ?? 8) : null],
    ['Steps', now.steps == null ? '—' : fmt(now.steps), null, now.steps ? now.steps / (st.settings.stepGoal ?? 8000) : null],
  ];

  const periodWord = period === 'custom' ? `${span} days` : period;
  const kind = period === 'day' ? 'daily' : period === 'week' ? 'weekly' : period === 'month' ? 'monthly' : period === 'year' ? 'yearly' : 'custom';
  /** A real PDF file saved to the phone (share sheet on phones, download on computers). */
  const savePdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 56;
    const line = (t: string, size = 11, bold = false, gap = 18) => { if (y > 790) { doc.addPage(); y = 56; } doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.text(t, 48, y); y += gap; };
    line(`Nutivili AI ${kind} report`, 20, true, 26);
    line(r.label, 13, false, 26);
    if (now.logged === 0) line('No food logged in this period. Missing days are not counted as zero.');
    else {
      line(`Daily averages on the ${now.logged} of ${length} days you logged (change vs previous ${periodWord})`, 11, true, 22);
      for (const [label, value, change] of rows) line(`${label}: ${value}${change ? `   (${change})` : ''}`);
      y += 8;
      line('Highlights', 11, true, 22);
      line(`Days hitting protein: ${now.proteinDays} of ${now.logged}`);
      line(`Workouts: ${now.workouts} · ${now.minutes} min${now.km ? ` · ${fmt(now.km, 1)} km` : ''}`);
      line(`Latest weight: ${now.lastWeight ? w(now.lastWeight) : '—'}`);
      line(`Weight change: ${now.weightChange == null ? '—' : `${now.weightChange >= 0 ? '+' : '−'}${w(Math.abs(now.weightChange))}`}`);
      if (now.top.length) { y += 8; line('Most logged foods', 11, true, 22); now.top.forEach(([f, c], i) => line(`${i + 1}. ${f} — ${c}×`)); }
    }
    y += 12;
    line('General wellness information from your own logs, not medical advice. Scanned portions are estimates.', 9, false);
    const name = `nutivili-${kind}-report-${r.from}.pdf`;
    const file = new File([doc.output('blob')], name, { type: 'application/pdf' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `Nutivili ${kind} report` }); return; }
    } catch (e) { if ((e as Error).name === 'AbortError') return; }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16 print:max-w-none">
      <header className="pt-safe flex items-center gap-3 pb-4 print:hidden">
        <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-[26px] font-extrabold tracking-tight">Reports</h1>
        <button onClick={() => void (period === 'day' ? downloadDailyReport(day) : savePdf())} className="chip !h-10"><Download size={15} /> PDF</button>
      </header>
      <div className="print:hidden"><Segmented full value={period} onChange={(p) => { setPeriod(p); setOffset(0); }} options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }, { value: 'custom', label: 'Custom' }]} /></div>

      {period === 'day' && (
        <div className="mt-4 print:hidden">
          <label className="text-xs font-semibold text-silver">Day<input type="date" aria-label="Day" className="field mt-1" value={day} max={todayKey()} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
          <button onClick={() => void downloadDailyReport(day)} className="btn-primary mt-3 w-full"><Download size={17} /> Download full daily report (PDF)</button>
          <p className="mt-2 text-xs text-dim">Every food with amounts and macros, meal totals, all vitamins and minerals, water by time of day, sleep, steps, activities and weight.</p>
        </div>
      )}
      {period === 'custom' && (
        <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
          <label className="text-xs font-semibold text-silver">From<input type="date" aria-label="From" className="field mt-1" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label className="text-xs font-semibold text-silver">To<input type="date" aria-label="To" className="field mt-1" value={to} min={from} max={todayKey()} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between">
        <button disabled={period === 'custom'} onClick={() => (period === 'day' ? setDay((d) => addDays(d, -1)) : setOffset((o) => o + 1))} className="grid h-10 w-10 place-items-center rounded-full bg-surface print:hidden" aria-label="Previous"><ChevronLeft size={18} /></button>
        <p className="text-center font-bold">Nutivili AI {kind} report · {r.label}</p>
        <button disabled={period === 'day' ? day >= todayKey() : offset === 0 || period === 'custom'} onClick={() => (period === 'day' ? setDay((d) => addDays(d, 1)) : setOffset((o) => Math.max(0, o - 1)))} className="grid h-10 w-10 place-items-center rounded-full bg-surface disabled:opacity-30 print:hidden" aria-label="Next"><ChevronRight size={18} /></button>
      </div>

      {now.logged === 0 ? (
        <p className="card mt-4 p-5 text-sm text-silver">No food logged in this {periodWord}. Missing days aren’t counted as zero, so there’s nothing to report yet.</p>
      ) : (
        <>
          <section className="card mt-4 p-5">
            <p className="text-sm text-silver">Daily average on the {now.logged} of {length} days you logged · vs previous {periodWord}</p>
            <div className="mt-3 space-y-3">
              {rows.map(([label, value, change, pct]) => (
                <div key={label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{label}</span>
                    <span className="num font-bold">{value} {change && <span className="ml-1 text-xs font-semibold text-silver">{change}</span>}</span>
                  </div>
                  {pct != null && (
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised"><div className={cx('h-full rounded-full', pct > 1.15 ? 'bg-warn' : 'bg-accent')} style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-dim">Bars show the average against your daily target (fibre vs 30 g, water vs your water goal).</p>
          </section>

          <section className="card mt-4 grid grid-cols-2 gap-3 p-5 text-center">
            <div className="rounded-2xl bg-raised py-3"><p className="num text-[22px] font-extrabold">{now.proteinDays}/{now.logged}</p><p className="text-xs text-silver">days hitting protein</p></div>
            <div className="rounded-2xl bg-raised py-3"><p className="num text-[22px] font-extrabold">{now.workouts}</p><p className="text-xs text-silver">workouts · {now.minutes} min{now.km ? ` · ${fmt(now.km, 1)} km` : ''}{st.settings.workoutsPerWeek ? ` · goal ${fmt(st.settings.workoutsPerWeek * length / 7)} days` : ''}</p></div>
            <div className="rounded-2xl bg-raised py-3"><p className="num text-[22px] font-extrabold">{now.lastWeight ? w(now.lastWeight) : '—'}</p><p className="text-xs text-silver">latest weight</p></div>
            <div className="rounded-2xl bg-raised py-3"><p className="num text-[22px] font-extrabold">{now.weightChange == null ? '—' : `${now.weightChange >= 0 ? '+' : '−'}${w(Math.abs(now.weightChange))}`}</p><p className="text-xs text-silver">weight change</p></div>
          </section>

          {now.activities.length > 0 && (
            <section className="card mt-4 p-5">
              <p className="font-bold">Activities</p>
              <ul className="mt-2 space-y-1.5 text-sm">{now.activities.map(([name, a]) => <li key={name} className="flex justify-between gap-2"><span>{name} <span className="text-silver">× {a.n}</span></span><span className="num text-silver">{a.min} min{a.km ? ` · ${fmt(a.km, 1)} km` : ''} · {a.est ? '~' : ''}{fmt(a.kcal)} kcal</span></li>)}</ul>
              <p className="mt-2 text-xs text-dim">Includes activities you added yourself. “~” calories are estimates from the activity, time and your weight.</p>
            </section>
          )}
          {now.top.length > 0 && (
            <section className="card mt-4 p-5">
              <p className="font-bold">Most logged foods</p>
              <ol className="mt-2 space-y-1 text-sm">{now.top.map(([f, n], i) => <li key={f} className="flex justify-between"><span>{i + 1}. {f}</span><span className="text-silver">{n}×</span></li>)}</ol>
            </section>
          )}
          <p className="mt-4 text-xs text-dim">General wellness information from your own logs, not medical advice. Nutrition values come from food-composition databases; scanned portions are estimates.</p>
        </>
      )}
    </div>
  );
}
