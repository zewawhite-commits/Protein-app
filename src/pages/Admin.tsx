import { useEffect, useMemo, useState } from 'react';
import { fetchUsage } from '@/lib/premium';
import { Link, Navigate } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { sourceInfo, searchFoods, splitName, STATE_LABEL } from '@/lib/foods';
import type { CustomFood, PrepState } from '@/lib/types';
import { Segmented, Sheet, StateBadge, cx, fmt } from '@/components/ui';

type View = 'custom' | 'usda';

export default function Admin() {
  const admin = useStore((s) => s.settings.adminMode);
  const custom = useStore((s) => s.customFoods);
  const archive = useStore((s) => s.archiveCustomFood);
  const { db } = useFoodDb();
  const [view, setView] = useState<View>('custom');
  const [editing, setEditing] = useState<CustomFood | 'new' | null>(null);
  const [q, setQ] = useState('');

  const stats = useMemo(() => {
    if (!db) return null;
    const by: Record<PrepState, number> = { raw: 0, cooked: 0, dry: 0, na: 0 };
    for (const f of db.foods) by[f.state]++;
    return { total: db.foods.length, by };
  }, [db]);

  const usdaResults = useMemo(() => (db && q.trim() ? searchFoods(q, { limit: 40 }) : []), [db, q]);

  const [owner, setOwner] = useState<boolean | null>(null);
  useEffect(() => { void fetchUsage().then((u) => setOwner(!!u?.admin)).catch(() => setOwner(false)); }, []);
  if (!admin || owner === false) return <Navigate to="/profile" replace />;
  if (owner === null) return null;

  return (
    <div className="animate-fade-up">
      <header className="pt-safe pb-5">
        <div className="flex items-center gap-3">
          <Link to="/profile" className="grid h-11 w-11 place-items-center rounded-full bg-surface" aria-label="Back"><ArrowLeft size={18} /></Link>
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="text-[26px] font-semibold tracking-tight">Nutrition records</h1>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="eyebrow">Database records</p>
          <p className="mt-2 text-3xl font-bold num">{fmt(stats?.total)}</p>
          <p className="mt-1 text-xs text-dim">
            {stats ? `${fmt(stats.by.raw)} raw · ${fmt(stats.by.cooked)} cooked · ${fmt(stats.by.dry)} dry` : 'Loading…'}
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Custom records</p>
          <p className="mt-2 text-3xl font-bold num">{custom.filter((c) => !c.archived).length}</p>
          <p className="mt-1 text-xs text-dim">{custom.filter((c) => c.archived).length} archived</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Segmented value={view} onChange={setView} options={[{ value: 'custom', label: 'Custom' }, { value: "usda", label: "Database" }]} />
        {view === 'custom' && <button onClick={() => setEditing('new')} className="btn-primary !h-11 !px-5 text-sm"><Plus size={16} /> New record</button>}
      </div>

      {view === 'custom' ? (
        <div className="mt-4 space-y-2">
          {custom.length === 0 && (
            <div className="card p-6 text-center text-sm text-silver">
              No custom records. Add one for foods missing from the databases — every record must cite where its values came from (product label, national food composition table, lab analysis).
            </div>
          )}
          {custom.map((f) => (
            <div key={f.id} className={cx('card flex items-center gap-3 p-4', f.archived && 'opacity-50')}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-silver">
                  <StateBadge state={f.state} />
                  <span className="num">{fmt(f.per100.protein, 1)} g / 100 g</span>
                </div>
                <p className="mt-1 truncate text-[12px] text-dim">Source: {f.sourceNote}</p>
              </div>
              <button onClick={() => setEditing(f)} className="grid h-9 w-9 place-items-center rounded-full bg-raised text-silver" aria-label="Edit"><Pencil size={15} /></button>
              <button onClick={() => archive(f.id, !f.archived)} className="grid h-9 w-9 place-items-center rounded-full bg-raised text-silver" aria-label={f.archived ? 'Restore' : 'Archive'}>
                {f.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-3 flex items-start gap-2 rounded-[20px] bg-raised p-3.5 text-xs font-medium leading-relaxed text-silver">
            <Lock size={14} className="mt-0.5 shrink-0" />
            USDA and FAO records are read-only so they always match the published source. To correct or add a food, create a custom record and cite its source.
          </p>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search database records" className="field !rounded-full pl-10" />
          </div>
          <div className="card overflow-hidden p-1.5">
            {usdaResults.map((f) => (
              <a key={f.id} href={sourceInfo(f).url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[22px] px-3.5 py-3 hover:bg-raised/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{splitName(f.name).title}</p>
                  <p className="truncate text-xs text-silver">{splitName(f.name).detail || f.category}</p>
                  <p className="mt-1 text-[12px] text-dim num">
                    {sourceInfo(f).label} · {STATE_LABEL[f.state]} · P {fmt(f.per100.protein, 2)} · F {fmt(f.per100.fat, 2)} · C {fmt(f.per100.carbs, 2)} · {fmt(f.per100.kcal)} kcal
                  </p>
                </div>
                <ExternalLink size={14} className="shrink-0 text-dim" />
              </a>
            ))}
            {!usdaResults.length && <p className="p-6 text-center text-sm text-dim">{q ? 'No matches.' : 'Search to inspect a record.'}</p>}
          </div>
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New custom record' : 'Edit record'}>
        {editing && <CustomFoodForm initial={editing === 'new' ? undefined : editing} categories={db?.categories ?? []} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

function CustomFoodForm({ initial, categories, onDone }: { initial?: CustomFood; categories: string[]; onDone: () => void }) {
  const upsert = useStore((s) => s.upsertCustomFood);
  const s = (v: number | null | undefined) => (v == null ? '' : String(v));
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'Custom');
  const [state, setState] = useState<PrepState>(initial?.state ?? 'na');
  const [v, setV] = useState({
    protein: s(initial?.per100.protein),
    kcal: s(initial?.per100.kcal),
    fat: s(initial?.per100.fat),
    carbs: s(initial?.per100.carbs),
    fiber: s(initial?.per100.fiber),
  });
  const [portions, setPortions] = useState(initial?.portions.map((p) => ({ label: p.label, grams: String(p.grams) })) ?? []);
  const [sourceNote, setSourceNote] = useState(initial?.sourceNote ?? '');

  const parsed = { protein: num(v.protein), kcal: num(v.kcal), fat: num(v.fat), carbs: num(v.carbs), fiber: num(v.fiber) };
  const errors: string[] = [];
  if (!name.trim()) errors.push('Name is required.');
  if (parsed.protein == null || Number.isNaN(parsed.protein)) errors.push('Protein per 100 g is required.');
  for (const [k, val] of Object.entries(parsed)) {
    if (val == null) continue;
    if (Number.isNaN(val) || val < 0) errors.push(`${k} must be a positive number.`);
    else if (k === 'kcal' ? val > 902 : val > 100) errors.push(`${k} is outside the possible range per 100 g.`);
  }
  const mass = (parsed.protein ?? 0) + (parsed.fat ?? 0) + (parsed.carbs ?? 0);
  if (mass > 100.5) errors.push(`Protein + fat + carbs = ${fmt(mass, 1)} g, which exceeds 100 g.`);
  if (sourceNote.trim().length < 4) errors.push('Cite the source of these values.');

  function save() {
    if (errors.length) return;
    upsert({
      id: initial?.id,
      name: name.trim(),
      category,
      state,
      per100: { protein: parsed.protein!, kcal: parsed.kcal, fat: parsed.fat, carbs: parsed.carbs, fiber: parsed.fiber },
      portions: portions.filter((p) => p.label.trim() && Number(p.grams) > 0).map((p) => ({ label: p.label.trim(), grams: Number(p.grams) })),
      sourceNote: sourceNote.trim(),
      archived: initial?.archived,
    });
    onDone();
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="cf-name">Name</label>
        <input id="cf-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Skyr, plain, 0% fat (Brand X)" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="cf-cat">Category</label>
          <select id="cf-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Custom</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cf-state">State</label>
          <select id="cf-state" className="field" value={state} onChange={(e) => setState(e.target.value as PrepState)}>
            {(Object.keys(STATE_LABEL) as PrepState[]).map((k) => <option key={k} value={k}>{STATE_LABEL[k]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <span className="label">Per 100 g</span>
        <div className="grid grid-cols-2 gap-2">
          {([['protein', 'Protein (g) *'], ['kcal', 'Energy (kcal)'], ['carbs', 'Carbohydrate (g)'], ['fat', 'Fat (g)'], ['fiber', 'Fibre (g)']] as const).map(([k, l]) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs font-semibold text-silver">{l}</span>
              <input className="field" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/[^\d.,]/g, '') })} />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Leave a field blank if the source has no value. Never estimate.</p>
      </div>

      <div>
        <span className="label">Portions (optional)</span>
        <div className="space-y-2">
          {portions.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input className="field flex-1" placeholder="1 pot" value={p.label} onChange={(e) => setPortions(portions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input className="field w-24" placeholder="g" inputMode="decimal" value={p.grams} onChange={(e) => setPortions(portions.map((x, j) => (j === i ? { ...x, grams: e.target.value.replace(/[^\d.]/g, '') } : x)))} />
              <button onClick={() => setPortions(portions.filter((_, j) => j !== i))} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-raised text-silver" aria-label="Remove portion"><Trash2 size={16} /></button>
            </div>
          ))}
          <button onClick={() => setPortions([...portions, { label: '', grams: '' }])} className="chip"><Plus size={14} /> Add portion</button>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="cf-src">Source *</label>
        <textarea id="cf-src" rows={2} className="field !h-auto py-3" value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="e.g. Product label, photographed 2026-11-12; or FAO/INFOODS table, record ID…" />
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-[20px] bg-danger/10 p-3.5 text-xs font-semibold text-danger">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <button onClick={save} disabled={errors.length > 0} className="btn-primary w-full">{initial ? 'Save record' : 'Create record'}</button>
    </div>
  );
}
