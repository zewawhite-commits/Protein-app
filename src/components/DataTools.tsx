import { useEffect, useState } from 'react';
import { History, Share2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { listBackups, restoreBackup, type BackupInfo } from '@/lib/backups';
import { addDays, todayKey } from '@/lib/dates';
import { dailyGoal, sumEntries } from '@/lib/nutrition';
import { dailyTargets } from '@/lib/energy';
import { splitName } from '@/lib/foods';
import { haptic, toast } from './fx';
import { cx } from './ui';

/** A plain-text summary of the last 7 days, to send to a coach, dietitian or doctor. */
export function weeklyReport(): string {
  const s = useStore.getState();
  const p = s.profile;
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).reverse();
  const eaten = s.entries.filter((e) => !e.planned && days.includes(e.date));
  const logged = days.filter((d) => eaten.some((e) => e.date === d));
  const r = (n: number) => Math.round(n);
  const lines = [`Nutivili AI report — ${p?.name ? `${p.name}, ` : ''}${days[0]} to ${today}`, ''];
  if (p) {
    const goal = dailyGoal(p);
    const t = dailyTargets(p, goal);
    lines.push(`Targets: ${t ? `${r(t.kcal)} kcal, ` : ''}${goal} g protein${t ? `, ${t.carbs} g carbs, ${t.fat} g fat` : ''}`);
  }
  lines.push(`Days logged: ${logged.length} of 7`);
  if (logged.length) {
    const tot = sumEntries(eaten);
    const n = logged.length;
    lines.push(`Average per logged day: ${r(tot.kcal / n)} kcal · ${r(tot.protein / n)} g protein · ${r(tot.carbs / n)} g carbs · ${r(tot.fat / n)} g fat · ${r(tot.fiber / n)} g fibre`);
    lines.push('', 'By day:');
    for (const d of logged) { const t = sumEntries(eaten.filter((e) => e.date === d)); lines.push(`  ${d}: ${r(t.kcal)} kcal, ${r(t.protein)} g protein`); }
    const count = new Map<string, number>();
    for (const e of eaten) { const name = splitName(e.food.name).title.split(',')[0]; count.set(name, (count.get(name) ?? 0) + 1); }
    lines.push('', `Most eaten: ${[...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n).join(', ')}`);
  }
  const w = s.weights.filter((x) => x.date >= addDays(today, -28)).sort((a, b) => a.date.localeCompare(b.date));
  if (w.length >= 2) lines.push(`Weight (last 4 weeks): ${w[0].kg} kg on ${w[0].date} → ${w[w.length - 1].kg} kg on ${w[w.length - 1].date}`);
  const ex = s.exercises.filter((x) => days.includes(x.date));
  if (ex.length) lines.push(`Workouts: ${ex.length} (${r(ex.reduce((a, x) => a + x.minutes, 0))} minutes)`);
  if (p?.avoid?.length) lines.push(`Avoids / allergies: ${p.avoid.join(', ')}`);
  lines.push('', 'Weights the AI estimated from photos are marked “estimated” in the app. Nutrition values come from public food composition tables.');
  return lines.join('\n');
}

export function ShareReportRow({ Row }: { Row: (p: { icon: React.ReactNode; label: string; chevron?: boolean }) => React.ReactElement }) {
  return (
    <button
      className="w-full"
      onClick={async () => {
        haptic();
        const text = weeklyReport();
        try {
          if (navigator.share) { await navigator.share({ title: 'My Nutivili AI week', text }); return; }
        } catch { return; /* closed the share sheet */ }
        try { await navigator.clipboard.writeText(text); toast('Report copied — paste it into an email or message'); } catch { toast('Couldn’t copy the report on this device'); }
      }}
    >
      <Row icon={<Share2 size={18} />} label="Share this week with a coach or dietitian" chevron />
    </button>
  );
}

/** The automatic daily copies kept on this device, with a restore that asks first. */
export function AutoBackups() {
  const [list, setList] = useState<BackupInfo[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => { void listBackups().then(setList); }, []);
  if (!list?.length) return null;
  return (
    <div className="px-4 py-3">
      <p className="flex items-center gap-2 text-[15px] font-medium"><History size={18} className="text-silver" /> Automatic backups on this phone</p>
      <p className="mt-0.5 text-[13px] text-silver">A copy is saved each day; the last 7 are kept.</p>
      <ul className="mt-2 space-y-1.5">
        {list.map((b) => (
          <li key={b.day} className="flex items-center justify-between gap-3 rounded-xl bg-raised px-3 py-2 text-[14px]">
            <span>{new Date(`${b.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} <span className="text-silver">· {b.entries} entries</span></span>
            {confirm === b.day ? (
              <span className="flex gap-1.5">
                <button className="chip !h-8 !bg-danger/10 !text-danger" onClick={async () => { try { await restoreBackup(b.day); toast('Restored'); } catch (e) { toast((e as Error).message); } setConfirm(null); }}>Replace my data</button>
                <button className="chip !h-8" onClick={() => setConfirm(null)}>Cancel</button>
              </span>
            ) : (
              <button className={cx('chip !h-8')} onClick={() => setConfirm(b.day)}>Restore</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
