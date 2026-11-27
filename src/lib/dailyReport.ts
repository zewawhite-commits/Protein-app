import { useStore } from '@/store/useStore';
import { sumEntries, dailyGoal, scale } from './nutrition';
import { dailyTargets } from './energy';
import { EXTRA_KEYS, NUTRIENTS } from './nutrients';
import { MEAL_LABELS } from './meals';
import { activityName } from './exercise';
import { dayActivity } from './activity';
import { DAY_PARTS, fmtMl } from './water';
import { formatDay, formatTime } from './dates';
import type { LogEntry, Meal } from './types';

const r0 = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString());
const r1 = (n: number | null | undefined) => (n == null ? '—' : (Math.round(n * 10) / 10).toLocaleString());

/**
 * A full, printable report for one day: every food with its amount and macros, meal totals,
 * day totals against targets, all vitamins and minerals (% of daily value, with gaps marked),
 * water by time of day, sleep, steps and every activity, and weight. Missing values say so.
 */
export async function downloadDailyReport(date: string): Promise<void> {
  const st = useStore.getState();
  const entries = st.entries.filter((e) => e.date === date && !e.planned);
  const planned = st.entries.filter((e) => e.date === date && e.planned);
  const totals = sumEntries(entries);
  const goal = st.profile ? dailyGoal(st.profile) : null;
  const targets = st.profile && goal ? dailyTargets(st.profile, goal) : null;
  const kg = st.weights.length ? st.weights[st.weights.length - 1].kg : st.profile?.bodyWeightKg ?? 70;
  const act = dayActivity(date, st.steps?.[date], st.exercises, kg);
  const sleep = st.sleep?.[date];
  const drinks = st.waterLog?.[date] ?? [];
  const water = st.water?.[date] ?? 0;
  const weight = st.weights.find((w) => w.date === date);
  const lb = st.settings.bodyUnit === 'lb';

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const L = 44, R = 551;
  let y = 54;
  const room = (h = 18) => { if (y + h > 800) { doc.addPage(); y = 54; } };
  const text = (t: string, opts: { size?: number; bold?: boolean; x?: number; gap?: number; color?: number } = {}) => {
    room(opts.gap ?? 16);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(opts.size ?? 10); doc.setTextColor(opts.color ?? 20);
    doc.text(t, opts.x ?? L, y); y += opts.gap ?? 16;
  };
  const heading = (t: string) => { y += 8; room(30); doc.setDrawColor(220); doc.line(L, y - 12, R, y - 12); text(t, { size: 13, bold: true, gap: 20 }); };
  /** A row of cells at fixed x positions. */
  const row = (cells: string[], xs: number[], bold = false, color = 20) => {
    room(15);
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(9.5); doc.setTextColor(color);
    cells.forEach((c, i) => {
      const t = doc.splitTextToSize(c, (xs[i + 1] ?? R) - xs[i] - 6)[0] ?? '';
      if (i === 0) doc.text(t, xs[i], y); else doc.text(t, xs[i + 1] ? xs[i + 1] - 8 : R, y, { align: 'right' });
    });
    y += 14;
  };

  text('Nutivili AI · Daily report', { size: 20, bold: true, gap: 24 });
  text(formatDay(date), { size: 12, gap: 16 });
  text(`Created ${new Date().toLocaleString()}`, { size: 8.5, color: 120, gap: 18 });

  heading('Summary');
  const X = [L, 220, 330, 440];
  row(['', 'Eaten', 'Target', 'Left'], X, true, 110);
  const sumRow = (label: string, v: number, t: number | null | undefined, unit: string, incomplete?: boolean) =>
    row([label, `${r0(v)}${unit}${incomplete ? '*' : ''}`, t ? `${r0(t)}${unit}` : '—', t ? `${r0(t - v)}${unit}` : '—'], X);
  sumRow('Calories', totals.kcal, targets?.kcal, ' kcal', totals.incomplete.kcal);
  sumRow('Protein', totals.protein, goal, ' g');
  sumRow('Carbs', totals.carbs, targets?.carbs, ' g', totals.incomplete.carbs);
  sumRow('Fat', totals.fat, targets?.fat, ' g', totals.incomplete.fat);
  sumRow('Fibre', totals.fiber, targets?.fiber ?? 30, ' g', totals.incomplete.fiber);
  if (Object.values(totals.incomplete).some(Boolean)) text('* At least one food has no value for this nutrient, so the total is a minimum, not zero-filled.', { size: 8, color: 120 });
  text(`Foods logged: ${entries.length}  ·  Water: ${fmtMl(water)}  ·  Sleep: ${sleep ? `${Math.floor(sleep.hours)}h ${Math.round((sleep.hours % 1) * 60)}m` : 'not logged'}  ·  Steps: ${act.steps != null ? r0(act.steps) : 'not logged'}`, { size: 9.5 });

  heading('Food by meal');
  if (!entries.length) text('No food logged on this day.', { color: 110 });
  const FX = [L, 250, 310, 370, 420, 470];
  const byMeal = new Map<Meal, LogEntry[]>();
  for (const e of entries.sort((a, b) => a.loggedAt - b.loggedAt)) byMeal.set(e.meal, [...(byMeal.get(e.meal) ?? []), e]);
  for (const [meal, list] of byMeal) {
    const t = sumEntries(list);
    y += 2; text(`${MEAL_LABELS[meal] ?? meal}  ·  ${r0(t.kcal)} kcal · ${r1(t.protein)} g protein`, { bold: true, size: 10.5, gap: 15 });
    row(['Food', 'Amount', 'kcal', 'Protein', 'Carbs', 'Fat'], FX, true, 110);
    for (const e of list) {
      const p = e.food.per100;
      row([`${e.food.name}${e.food.state && e.food.state !== 'na' ? ` (${e.food.state})` : ''}`, `${r0(e.grams)} g`, r0(scale(p.kcal, e.grams)), `${r1(scale(p.protein, e.grams))} g`, `${r1(scale(p.carbs ?? null, e.grams))} g`, `${r1(scale(p.fat ?? null, e.grams))} g`], FX);
      const src = [e.food.source, formatTime(e.loggedAt), e.note].filter(Boolean).join(' · ');
      if (src) text(src, { size: 7.5, color: 130, x: L + 8, gap: 12 });
    }
  }
  if (planned.length) { y += 4; text(`Planned but not marked as eaten (not counted): ${planned.map((e) => e.food.name).join(', ')}`, { size: 8.5, color: 120 }); }

  heading('Vitamins, minerals and more');
  const NX = [L, 260, 360, 450];
  row(['Nutrient', 'Amount', '% daily value', 'Note'], NX, true, 110);
  for (const k of EXTRA_KEYS) {
    const info = NUTRIENTS[k];
    const v = totals[k];
    const pct = info.dv ? Math.round((v / info.dv) * 100) : null;
    const note = totals.incomplete[k] ? 'some foods missing data' : info.limit && pct != null && pct > 100 ? 'over the limit' : '';
    row([info.label, `${info.unit === 'g' ? r1(v) : r0(v)} ${info.unit}`, pct == null ? '—' : `${pct}%`, note], NX);
  }
  text('% daily value uses general adult reference values (US FDA), not personal targets.', { size: 8, color: 120 });

  heading('Water');
  text(`${fmtMl(water)} in total${st.settings.waterGoalMl ? ` of a ${fmtMl(st.settings.waterGoalMl)} goal` : ''}.`);
  for (const p of DAY_PARTS) {
    const ml = drinks.filter((d) => d.part === p.v).reduce((a, d) => a + d.ml, 0);
    if (ml) text(`${p.label}: ${fmtMl(ml)} (${drinks.filter((d) => d.part === p.v).map((d) => `${fmtMl(d.ml)} at ${formatTime(d.at)}`).join(', ')})`, { size: 9.5 });
  }

  heading('Sleep');
  text(sleep ? `${Math.floor(sleep.hours)}h ${Math.round((sleep.hours % 1) * 60)}m${sleep.bed && sleep.wake ? `, ${sleep.bed} to ${sleep.wake}` : ''}${sleep.quality ? ` · felt ${sleep.quality === 'ok' ? 'okay' : sleep.quality}` : ''}` : 'Not logged.');

  heading('Activity & movement');
  text(`Steps: ${act.steps != null ? r0(act.steps) : 'not logged'}  ·  Distance: ${act.km ? `${r1(lb ? act.km / 1.609344 : act.km)} ${lb ? 'mi' : 'km'}` : '—'}  ·  Active calories: ${act.activeKcal ? `${act.estimated ? 'about ' : ''}${r0(act.activeKcal)} kcal` : '—'}  ·  Active minutes: ${r0(act.minutes)}`, { size: 9.5 });
  for (const e of st.exercises.filter((x) => x.date === date)) {
    text(`• ${activityName(e)}${e.time ? ` at ${e.time}` : ''}: ${e.minutes} min, ${e.manual ? '' : '~'}${r0(e.kcal)} kcal${e.km ? `, ${r1(e.km)} km` : ''}${e.steps ? `, ${r0(e.steps)} steps` : ''}${e.detail?.sets ? `, ${e.detail.sets}×${e.detail.reps ?? '?'}${e.detail.weightKg ? ` @ ${e.detail.weightKg} kg` : ''}` : ''}${e.note ? ` (${e.note})` : ''}`, { size: 9.5, x: L + 6 });
  }
  text('Active calories are movement only, not your total daily energy use; “~” means estimated.', { size: 8, color: 120 });

  if (weight) { heading('Weight'); text(`${r1(lb ? weight.kg / 0.45359237 : weight.kg)} ${lb ? 'lb' : 'kg'}`); }

  y += 14;
  text('General wellness information from your own logs, not medical advice. Food values come from official food-composition tables and pack labels; scanned portions are estimates.', { size: 8, color: 120 });

  const name = `nutivili-daily-report-${date}.pdf`;
  const file = new File([doc.output('blob')], name, { type: 'application/pdf' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `Nutivili daily report ${date}` }); return; }
  } catch (e) { if ((e as Error).name === 'AbortError') return; }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
