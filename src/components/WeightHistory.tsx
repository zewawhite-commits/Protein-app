import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cx, fmt } from './ui';
import { haptic, toast } from './fx';

const LB = 2.20462;

/** Every weigh-in, newest first: edit the number, add a note, or delete one. */
export function WeightHistory() {
  const weights = useStore((s) => s.weights);
  const logWeight = useStore((s) => s.logWeight);
  const removeWeight = useStore((s) => s.removeWeight);
  const lb = useStore((s) => s.settings.bodyUnit === 'lb');
  const unit = lb ? 'lb' : 'kg';
  const show = (kg: number) => fmt(lb ? kg * LB : kg, 1);
  const [editing, setEditing] = useState<string | null>(null);
  const [val, setVal] = useState('');
  const [note, setNote] = useState('');
  const [all, setAll] = useState(false);
  if (!weights.length) return null;
  const rows = [...weights].reverse();
  const shown = all ? rows : rows.slice(0, 5);

  function save(date: string) {
    const n = Number(val.replace(',', '.'));
    const kg = lb ? n / LB : n;
    if (!(kg >= 25 && kg <= 300)) { toast('Enter a realistic weight'); return; }
    logWeight(kg, date, note.trim() || undefined);
    haptic(); toast('Weigh-in updated'); setEditing(null);
  }

  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold">Weight history</h2>
      <p className="mt-1 text-sm text-silver">Day-to-day changes are mostly water. Watch the trend, not single days.</p>
      <ul className="mt-3 divide-y divide-line">
        {shown.map((w, i) => {
          const prev = rows[i + 1];
          const diff = prev ? w.kg - prev.kg : 0;
          return (
            <li key={w.date} className="py-2.5">
              {editing === w.date ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input className="field flex-1" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.,]/g, ''))} aria-label={`Weight in ${unit}`} />
                    <button onClick={() => save(w.date)} className="btn-primary !px-5">Save</button>
                  </div>
                  <input className="field" maxLength={80} placeholder="Note (optional), e.g. after holiday" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
                  <div className="flex justify-between text-sm font-semibold">
                    <button onClick={() => setEditing(null)} className="text-silver">Cancel</button>
                    <button onClick={() => { if (confirm('Delete this weigh-in?')) { removeWeight(w.date); toast('Weigh-in deleted'); setEditing(null); } }} className="flex items-center gap-1 text-danger"><Trash2 size={15} /> Delete</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setEditing(w.date); setVal(show(w.kg).replace(/,/g, '')); setNote(w.note ?? ''); }} className="flex w-full items-center gap-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{new Date(`${w.date}T12:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {w.note && <span className="block truncate text-xs text-silver">{w.note}</span>}
                  </span>
                  <span className="num font-bold">{show(w.kg)} {unit}</span>
                  <span className={cx('num w-14 text-right text-sm', !prev || Math.abs(diff) < 0.05 ? 'text-dim' : 'text-silver')}>{prev && Math.abs(diff) >= 0.05 ? `${diff > 0 ? '+' : '−'}${show(Math.abs(diff))}` : ''}</span>
                  <Pencil size={14} className="text-dim" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > 5 && <button onClick={() => setAll((v) => !v)} className="mt-2 text-sm font-semibold text-accent">{all ? 'Show less' : `Show all ${rows.length}`}</button>}
    </section>
  );
}
