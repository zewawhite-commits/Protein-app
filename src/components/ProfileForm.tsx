import { useState } from 'react';
import type { Profile } from '@/lib/types';
import { dailyGoal, fromKg, round1, toKg } from '@/lib/nutrition';
import { useStore } from '@/store/useStore';
import { Segmented, cx, fmt } from './ui';

/**
 * Reference intakes shown for context only — the user always chooses the number.
 * 0.8 g/kg: Recommended Dietary Allowance for adults (US National Academies, DRI 2005).
 * 1.4–2.0 g/kg: International Society of Sports Nutrition position stand (Jäger et al., 2017) for exercising individuals.
 */
const PRESETS = [
  { v: 0.8, label: '0.8', note: 'Adult RDA' },
  { v: 1.2, label: '1.2', note: '' },
  { v: 1.6, label: '1.6', note: 'Training' },
  { v: 2.0, label: '2.0', note: '' },
];

export function ProfileForm({ initial, submitLabel, onSaved }: { initial?: Profile | null; submitLabel: string; onSaved?: () => void }) {
  const saveProfile = useStore((s) => s.saveProfile);
  const unit = useStore((s) => s.settings.bodyUnit);
  const updateSettings = useStore((s) => s.updateSettings);

  const [name, setName] = useState(initial?.name ?? '');
  const [weight, setWeight] = useState(initial?.bodyWeightKg ? String(round1(fromKg(initial.bodyWeightKg, unit))) : '');
  const [mode, setMode] = useState<Profile['goalMode']>(initial?.goalMode ?? 'perKg');
  const [perKg, setPerKg] = useState(String(initial?.gramsPerKg ?? 1.6));
  const [fixed, setFixed] = useState(String(initial?.goalGrams ?? 140));

  const weightNum = Number(weight.replace(',', '.'));
  const weightKg = weightNum > 0 ? toKg(weightNum, unit) : null;
  const draft: Profile = {
    name: name.trim(),
    bodyWeightKg: weightKg ? round1(weightKg) : null,
    goalMode: mode,
    gramsPerKg: Number(perKg.replace(',', '.')) || 0,
    goalGrams: Number(fixed) || 0,
    createdAt: initial?.createdAt ?? Date.now(),
  };
  const goal = dailyGoal(draft);
  const valid = goal > 0 && goal < 1000 && (mode === 'fixed' || !!weightKg);

  function switchUnit(u: 'kg' | 'lb') {
    if (u === unit) return;
    if (weightNum > 0) setWeight(String(round1(fromKg(toKg(weightNum, unit), u))));
    updateSettings({ bodyUnit: u });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        saveProfile(draft);
        onSaved?.();
      }}
    >
      <div>
        <label className="label" htmlFor="pf-name">Name</label>
        <input id="pf-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="pf-weight">Body weight</label>
          <Segmented value={unit} onChange={switchUnit} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </div>
        <div className="relative mt-2">
          <input id="pf-weight" className="field pr-12" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={unit === 'kg' ? '75' : '165'} />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-silver">{unit}</span>
        </div>
      </div>

      <div>
        <span className="label">Daily protein goal</span>
        <div className="grid grid-cols-2 gap-2">
          {([['perKg', 'Per body weight'], ['fixed', 'Fixed grams']] as const).map(([v, l]) => (
            <button type="button" key={v} onClick={() => setMode(v)} className={cx('chip justify-center !h-12', mode === v && 'chip-on')}>{l}</button>
          ))}
        </div>

        {mode === 'perKg' ? (
          <div className="mt-4">
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button type="button" key={p.v} onClick={() => setPerKg(String(p.v))} className={cx('flex h-16 flex-col items-center justify-center rounded-[20px] transition', Number(perKg) === p.v ? 'bg-primary text-on-primary' : 'bg-raised')}>
                  <span className="num text-lg font-extrabold">{p.label}</span>
                  <span className="text-[10px] font-semibold opacity-60">{p.note || 'g/kg'}</span>
                </button>
              ))}
            </div>
            <div className="relative mt-2">
              <input className="field pr-16" inputMode="decimal" value={perKg} onChange={(e) => setPerKg(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="Grams per kg" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-silver">g / kg</span>
            </div>
            <p className="mt-2 text-xs font-medium leading-relaxed text-silver">
              Adult RDA: 0.8 g/kg. Active people: 1.4–2.0 g/kg (ISSN). Check with a health professional.
            </p>
          </div>
        ) : (
          <div className="relative mt-4">
            <input className="field pr-10" inputMode="numeric" value={fixed} onChange={(e) => setFixed(e.target.value.replace(/\D/g, ''))} aria-label="Grams per day" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-silver">g</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-[24px] bg-raised p-5">
        <div>
          <p className="num text-[44px] font-extrabold leading-none">{valid ? fmt(goal) : '—'}<span className="text-lg text-silver">g</span></p>
          <p className="mt-1.5 text-sm font-bold">Daily protein goal</p>
        </div>
        {mode === 'perKg' && !weightKg && <p className="max-w-[9rem] text-right text-xs text-silver">Enter your body weight to calculate</p>}
      </div>

      <button type="submit" disabled={!valid} className="btn-primary w-full">{submitLabel}</button>
    </form>
  );
}
