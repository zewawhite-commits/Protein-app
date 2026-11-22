import { loadExercises } from '@/lib/exerciseDb';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ChevronRight, Dumbbell, Search } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { photoFor, sizedPhoto, subscribePhoto } from '@/data/foodPhotos';
import { CATEGORY_NAMES, EQUIP_NAMES, LEVEL_NAMES, LIBRARY, alternativesFor, exercisePhotoKey, findExercise, type Category, type Equip, type LibExercise, type Level, type Place } from '@/data/exerciseLibrary';
import { Segmented, Sheet, cx } from './ui';

/**
 * The exercise's picture: a real photo only once someone has checked it shows exactly this
 * exercise; otherwise a clean tile that says the written guide is below. Never a video player.
 */
/** Start and end photos from the exercise database, when it has this exact movement. */
function useDbImages(id: string): string[] {
  const [imgs, setImgs] = useState<string[]>([]);
  useEffect(() => { let live = true; loadExercises().then((all) => { if (live) setImgs(all.find((e) => e.id === id)?.images ?? []); }).catch(() => undefined); return () => { live = false; }; }, [id]);
  return imgs;
}

export function ExerciseVisual({ ex, size = 'card' }: { ex: LibExercise; size?: 'card' | 'thumb' }) {
  const key = exercisePhotoKey(ex);
  const checked = useSyncExternalStore((f) => subscribePhoto(key, f), () => photoFor(key));
  const db = useDbImages(ex.id);
  const [pos, setPos] = useState(0);
  if (!checked && db.length) {
    if (size === 'thumb') return <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-raised"><img src={db[0]} alt="" className="h-full w-full object-cover" /></span>;
    return (
      <figure className="overflow-hidden rounded-[22px] bg-raised">
        <img src={db[pos]} alt={`${ex.name}: ${pos === 0 ? 'start' : 'end'} position`} className="aspect-[3/2] w-full object-cover" loading="lazy" />
        <figcaption className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] text-dim">
          <span>{pos === 0 ? 'Start' : 'End'} position · Free Exercise DB</span>
          {db.length > 1 && <span className="flex gap-1">{db.map((_, i) => <button key={i} onClick={() => setPos(i)} aria-pressed={pos === i} className={cx('rounded-full px-2 py-0.5 font-semibold', pos === i ? 'bg-ink text-bg' : 'bg-surface text-ink')}>{i === 0 ? 'Start' : 'End'}</button>)}</span>}
        </figcaption>
      </figure>
    );
  }
  const photo = checked;
  if (size === 'thumb') {
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-raised">
        {photo ? <img src={sizedPhoto(photo.url, 96)} alt="" className="h-full w-full object-cover" /> : <Dumbbell size={18} className="text-dim" />}
      </span>
    );
  }
  return photo ? (
    <figure className="overflow-hidden rounded-[22px] bg-raised">
      <img src={sizedPhoto(photo.url, 720)} alt={`${ex.name}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
      <figcaption className="px-3 py-1.5 text-[11px] text-dim">Photo{photo.author ? ` by ${photo.author}` : ''}. A photo can’t fully teach technique — follow the steps below.</figcaption>
    </figure>
  ) : (
    <div className="flex items-center gap-3 rounded-[22px] bg-raised px-4 py-3.5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Dumbbell size={20} /></span>
      <p className="text-[13px] leading-snug text-silver">No checked photo for this exercise yet — the step-by-step guide below explains exactly how to do it.</p>
    </div>
  );
}

/** Everything about one exercise. `onUse` (in a workout) swaps it for an alternative. */
export function GuideSheet({ name, onClose, onUse }: { name: string | null; onClose: () => void; onUse?: (alt: LibExercise) => void }) {
  const [shown, setShown] = useState<string | null>(null);
  const current = shown ?? name;
  const ex = findExercise(current);
  const custom = useStore((s) => s.customExercises.find((c) => c.name.toLowerCase() === (current ?? '').toLowerCase()));
  const prefs = usePrefs();
  const close = () => { setShown(null); onClose(); };
  return (
    <Sheet open={!!name} onClose={close} title={ex?.name ?? current ?? ''}>
      {ex ? <GuideBody ex={ex} alts={alternativesFor(ex, prefs)} onAlt={(a) => setShown(a.name)} onUse={onUse && ((a) => { setShown(null); onUse(a); })} isAlt={!!shown && shown !== name} onBack={() => setShown(null)} />
        : (
          <div className="space-y-3 text-[15px] text-silver">
            <p>{custom ? `Your own exercise · ${custom.muscle || 'muscles not set'}${custom.equipment ? ` · ${custom.equipment}` : ''}.` : 'This exercise isn’t in our library, so there’s no written guide for it.'}</p>
            <p>Record it the way you do it. If you’re not sure how to do it safely, pick a similar exercise from the library instead.</p>
          </div>
        )}
    </Sheet>
  );
}

function GuideBody({ ex, alts, onAlt, onUse, isAlt, onBack }: { ex: LibExercise; alts: LibExercise[]; onAlt: (a: LibExercise) => void; onUse?: (a: LibExercise) => void; isAlt: boolean; onBack: () => void }) {
  const restText = ex.rx.rest ? `${ex.rx.rest >= 60 ? `${ex.rx.rest / 60} min` : `${ex.rx.rest} s`} rest` : '';
  return (
    <div className="space-y-4 pb-2 text-[15px] leading-relaxed">
      {isAlt && <button onClick={onBack} className="text-sm font-semibold text-accent">← Back</button>}
      <ExerciseVisual ex={ex} />
      <p className="text-silver">{ex.description}</p>
      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <Fact label="Targets" value={ex.primary.join(', ')} sub={ex.secondary.length ? `Also: ${ex.secondary.join(', ')}` : undefined} />
        <Fact label="Equipment" value={ex.equipment.map((e) => EQUIP_NAMES[e]).join(', ')} />
        <Fact label="Level" value={LEVEL_NAMES[ex.level]} />
        <Fact label={ex.kind === 'strength' ? 'Sets × reps' : 'Suggested'} value={`${ex.rx.sets > 1 ? `${ex.rx.sets} × ` : ''}${ex.rx.reps}`} sub={restText || undefined} />
      </div>
      <Section title="Starting position"><p>{ex.start}</p></Section>
      <Section title="Step by step"><ol className="list-decimal space-y-1.5 pl-5">{ex.steps.map((s) => <li key={s}>{s}</li>)}</ol></Section>
      <Section title="Breathing"><p>{ex.breathing}</p></Section>
      {ex.mistakes.length > 0 && <Section title="Common mistakes"><ul className="list-disc space-y-1 pl-5">{ex.mistakes.map((s) => <li key={s}>{s}</li>)}</ul></Section>}
      <Section title="Safety"><ul className="list-disc space-y-1 pl-5">{ex.safety.map((s) => <li key={s}>{s}</li>)}</ul></Section>
      {(ex.easier || ex.harder) && (
        <Section title="Make it easier or harder">
          {ex.easier && <p><span className="font-semibold">Easier:</span> {ex.easier}</p>}
          {ex.harder && <p className="mt-1"><span className="font-semibold">Harder:</span> {ex.harder}</p>}
        </Section>
      )}
      {alts.length > 0 && (
        <Section title="Alternatives (same muscles)">
          <div className="space-y-1.5">
            {alts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-2xl bg-raised px-3 py-2">
                <button onClick={() => onAlt(a)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="block truncate text-xs text-silver">{a.equipment.map((e) => EQUIP_NAMES[e]).join(', ')} · {LEVEL_NAMES[a.level]}</span>
                </button>
                {onUse && <button onClick={() => onUse(a)} className="chip !h-8 shrink-0 !px-3 text-[13px]">Use instead</button>}
              </div>
            ))}
          </div>
        </Section>
      )}
      <p className="rounded-2xl bg-raised px-4 py-3 text-xs leading-snug text-silver">General fitness guidance, not medical advice — we can’t see your technique. If something hurts, stop that exercise and get it checked by a doctor or physiotherapist.</p>
    </div>
  );
}

const Fact = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-2xl bg-raised px-3 py-2"><p className="text-[11px] font-bold uppercase tracking-wide text-dim">{label}</p><p className="font-semibold">{value}</p>{sub && <p className="text-xs text-silver">{sub}</p>}</div>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section><h3 className="mb-1 text-[15px] font-bold">{title}</h3>{children}</section>;

/** The person's saved workout preferences (equipment and level), for suggesting alternatives. */
export function usePrefs(): { equipment?: Equip[]; maxLevel?: Level } {
  try {
    const p = JSON.parse(localStorage.getItem('nutivili-workout-prefs') ?? 'null') as { equipment?: Equip[]; level?: string } | null;
    return { equipment: p?.equipment?.length ? p.equipment : undefined, maxLevel: p?.level === 'beginner' ? 2 : undefined };
  } catch { return {}; }
}

/** The whole library: by muscle group, filtered by where you train and your level. */
export function GuideBrowser({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick?: (ex: LibExercise) => void }) {
  const [name, setName] = useState<string | null>(null);
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [place, setPlace] = useState<Place | 'any'>('any');
  const [level, setLevel] = useState<Level | 0>(0);
  const [q, setQ] = useState('');
  const list = useMemo(() => LIBRARY.filter((e) => (cat === 'all' || e.category === cat) && (place === 'any' || e.places.includes(place)) && (!level || e.level === level) && (!q.trim() || `${e.name} ${e.primary.join(' ')} ${e.secondary.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))), [cat, place, level, q]);
  return (
    <>
      <Sheet open={open && !name} onClose={onClose} title="Exercise library">
        <div className="relative"><Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dim" /><input className="field !pl-11" placeholder="Search exercises or muscles" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the exercise library" /></div>
        <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 no-scrollbar">
          {(['all', ...Object.keys(CATEGORY_NAMES)] as (Category | 'all')[]).map((c) => <button key={c} onClick={() => setCat(c)} className={cx('chip !h-8 shrink-0 !px-3 text-[13px]', cat === c && 'chip-on')}>{c === 'all' ? 'All' : CATEGORY_NAMES[c]}</button>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Segmented<Place | 'any'> value={place} onChange={setPlace} options={[{ value: 'any', label: 'Anywhere' }, { value: 'home', label: 'Home' }, { value: 'gym', label: 'Gym' }, { value: 'outdoors', label: 'Outdoors' }]} />
          <Segmented<string> value={String(level)} onChange={(v) => setLevel(Number(v) as Level | 0)} options={[{ value: '0', label: 'All levels' }, { value: '1', label: 'Beginner' }, { value: '2', label: 'Inter.' }, { value: '3', label: 'Adv.' }]} />
        </div>
        <p className="mt-2 px-1 text-xs text-dim">{list.length} exercise{list.length === 1 ? '' : 's'} · each has a full written guide</p>
        <div className="mt-1 max-h-[52dvh] divide-y divide-line overflow-y-auto">
          {list.map((x) => (
            <div key={x.id} className="flex items-center gap-3 px-1 py-2.5">
              <button onClick={() => setName(x.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <ExerciseVisual ex={x} size="thumb" />
                <span className="min-w-0"><span className="block truncate font-semibold">{x.name}</span><span className="block truncate text-xs text-silver">{x.primary.join(', ')} · {LEVEL_NAMES[x.level]} · {x.equipment.map((e) => EQUIP_NAMES[e]).join(', ')}</span></span>
              </button>
              {onPick ? <button onClick={() => onPick(x)} className="chip !h-8 shrink-0 !px-3 text-[13px]">Add</button> : <ChevronRight size={16} className="shrink-0 text-dim" />}
            </div>
          ))}
          {list.length === 0 && <p className="py-6 text-center text-sm text-silver">Nothing matches — try another filter.</p>}
        </div>
      </Sheet>
      <GuideSheet name={name} onClose={() => setName(null)} />
    </>
  );
}

