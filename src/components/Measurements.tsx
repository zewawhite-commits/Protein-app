import { useMemo, useState } from 'react';
import { Ruler, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { todayKey } from '@/lib/dates';
import { cx, fmt } from './ui';
import { haptic, toast } from './fx';

const SITES = ['Waist', 'Hips', 'Chest', 'Arms', 'Thighs', 'Neck'];
const IN = 2.54;

/** Optional, private body measurements: add one in seconds, see the change since the first. */
export function Measurements() {
  const list = useStore((s) => s.measurements);
  const add = useStore((s) => s.addMeasurement);
  const remove = useStore((s) => s.removeMeasurement);
  const inches = useStore((s) => s.settings.bodyUnit === 'lb');
  const unit = inches ? 'in' : 'cm';
  const show = (cm: number) => fmt(inches ? cm / IN : cm, 1);
  const [site, setSite] = useState('Waist');
  const [custom, setCustom] = useState('');
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string | null>(null);

  // Latest value per site, and the change since the first one.
  const bySite = useMemo(() => {
    const m = new Map<string, typeof list>();
    for (const e of [...list].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) m.set(e.site, [...(m.get(e.site) ?? []), e]);
    return [...m.entries()];
  }, [list]);

  const name = site === 'Other' ? custom.trim() : site;
  const num = Number(value.replace(',', '.'));
  const ok = name.length > 0 && num > 0 && num < (inches ? 120 : 300);

  function save() {
    if (!ok) return;
    add({ date: todayKey(), site: name, cm: Math.round((inches ? num * IN : num) * 10) / 10 });
    haptic(); toast(`${name} saved`);
    setValue(''); setOpen(false);
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Ruler size={18} className="text-accent" /> Body measurements</h2>
        <button onClick={() => setOpen((v) => !v)} className="chip !h-9">{open ? 'Close' : '+ Add'}</button>
      </div>
      <p className="mt-1 text-sm text-silver">Optional and private. Measure at the same time of day for a fair comparison.</p>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {[...SITES, 'Other'].map((s) => <button key={s} onClick={() => setSite(s)} className={cx('chip !h-9', site === s && 'chip-on')}>{s}</button>)}
          </div>
          {site === 'Other' && <input className="field" maxLength={24} placeholder="What did you measure? (e.g. Calf)" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Measurement name" />}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input className="field pr-12" inputMode="decimal" maxLength={6} placeholder="0" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))} aria-label={`${name || 'Measurement'} in ${unit}`} />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-silver">{unit}</span>
            </div>
            <button disabled={!ok} onClick={save} className="btn-primary !px-6">Save</button>
          </div>
        </div>
      )}

      {bySite.length > 0 ? (
        <div className="mt-4 divide-y divide-line">
          {bySite.map(([s, rows]) => {
            const first = rows[0], last = rows[rows.length - 1];
            const diff = last.cm - first.cm;
            return (
              <div key={s} className="py-2.5">
                <button onClick={() => setHistory(history === s ? null : s)} className="flex w-full items-center gap-3 text-left">
                  <span className="flex-1 font-semibold">{s}</span>
                  <span className="num font-bold">{show(last.cm)} {unit}</span>
                  {rows.length > 1 && <span className={cx('num w-16 text-right text-sm font-semibold', Math.abs(diff) < 0.05 ? 'text-silver' : 'text-accent')}>{diff > 0 ? '+' : diff < 0 ? '−' : ''}{show(Math.abs(diff))}</span>}
                </button>
                {history === s && (
                  <ul className="mt-2 space-y-1">
                    {[...rows].reverse().map((r) => (
                      <li key={r.id} className="flex items-center gap-3 text-sm text-silver">
                        <span className="flex-1">{new Date(`${r.date}T12:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="num font-semibold text-ink">{show(r.cm)} {unit}</span>
                        <button onClick={() => { remove(r.id); toast('Removed'); }} className="grid h-8 w-8 place-items-center rounded-full text-dim" aria-label={`Delete ${s} on ${r.date}`}><Trash2 size={15} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : !open && <p className="mt-3 text-sm text-dim">No measurements yet.</p>}
    </section>
  );
}
