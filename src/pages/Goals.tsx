import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Pause, Play, Target, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { GOAL_INFO, GOAL_KINDS, GOAL_LIMITS, goalProgress, type GoalKind, type GoalSetting } from '@/lib/myGoals';
import { ProfileForm } from '@/components/ProfileForm';
import { Sheet, cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';

/**
 * My goals: pick any number — weight, protein, calories, water, workouts, distance, strength.
 * Nothing is chosen for you. Each has its own target, period and (for weight) an optional date,
 * and can be paused, marked done or removed. Progress shows here and on the Progress tab.
 */
export default function Goals() {
  const nav = useNavigate();
  const stored = useStore((s) => s.settings.goals);
  const goals = stored ?? {};
  const [editing, setEditing] = useState<GoalKind | null>(null);
  // Re-render when the data behind progress changes.
  useStore((s) => s.entries); useStore((s) => s.weights); useStore((s) => s.water); useStore((s) => s.workoutLogs); useStore((s) => s.exercises);
  const on = GOAL_KINDS.filter((k) => goals[k]?.on);
  const off = GOAL_KINDS.filter((k) => !goals[k]?.on);
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-28">
      <header className="pt-safe flex items-center gap-3 pb-2">
        <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-[28px] font-extrabold tracking-tight">My goals</h1>
      </header>
      <p className="mb-4 px-1 text-sm text-silver">Choose what you want to work on. You can have several, or none. Weight is only one way to measure progress.</p>

      {on.length > 0 && (
        <section className="space-y-2.5">
          {on.map((k) => <GoalCard key={k} kind={k} g={goals[k]!} onEdit={() => setEditing(k)} />)}
        </section>
      )}

      <p className="mb-2 mt-6 px-1 text-[15px] font-semibold">{on.length ? 'Add another goal' : 'Pick a goal'}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {off.map((k) => (
          <button key={k} onClick={() => { haptic(); setEditing(k); }} className="card p-4 text-left transition active:scale-[.98]">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent"><Target size={18} /></span>
            <span className="mt-2.5 block font-bold">{GOAL_INFO[k].title}</span>
            <span className="block text-[13px] text-silver">{GOAL_INFO[k].what}</span>
          </button>
        ))}
      </div>
      <GoalEditor kind={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function GoalCard({ kind, g, onEdit }: { kind: GoalKind; g: GoalSetting; onEdit: () => void }) {
  const info = GOAL_INFO[kind];
  const p = goalProgress(kind);
  const pct = p.target && p.current != null ? (kind === 'weight' ? null : Math.min(1, p.current / p.target)) : null;
  const status = g.done ? 'Done' : g.paused ? 'Paused' : p.onTrack == null ? '' : p.onTrack ? (kind === 'weight' ? 'Moving the right way' : 'On track') : (info.period === 'day' ? 'In progress today' : 'Keep going');
  return (
    <button onClick={onEdit} className={cx('card block w-full p-4 text-left', (g.paused || g.done) && 'opacity-70')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{info.title}</p>
          <p className="text-[13px] text-silver">{p.target != null ? `${fmt(p.target, kind === 'water' ? 1 : 0)} ${info.unit}${info.period === 'day' ? ' a day' : info.period === 'week' ? ' a week' : ''}` : 'No target yet'}{g.deadline ? ` · by ${new Date(g.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
        </div>
        {status && <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold', g.done ? 'bg-accent text-white' : p.onTrack ? 'bg-accent/10 text-accent' : 'bg-raised text-silver')}>{status}</span>}
      </div>
      {pct != null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} /></div>}
      <p className="num mt-2 text-[13px] text-silver">
        {kind === 'weight' ? (p.current != null ? `Now ${fmt(p.current, 1)} kg · ${p.note}` : p.note) : p.current != null ? `${p.note ? `${p.note}: ` : ''}${fmt(p.current, kind === 'water' || kind === 'distance' ? 1 : 0)} ${info.unit}` : p.note}
        {kind !== 'weight' && p.left != null && kind !== 'calories' && (p.left > 0 ? ` · ${fmt(p.left, 1)} to go` : ' · reached')}
      </p>
    </button>
  );
}

/** Set or change one goal. Targets that already exist elsewhere in the app are edited in place. */
function GoalEditor({ kind, onClose }: { kind: GoalKind | null; onClose: () => void }) {
  const st = useStore();
  const g = kind ? st.settings.goals?.[kind] : undefined;
  const [profileOpen, setProfileOpen] = useState(false);
  const [val, setVal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [last, setLast] = useState<GoalKind | null>(null);
  if (kind !== last) {
    setLast(kind);
    if (kind) {
      const p = goalProgress(kind);
      setVal(p.target != null ? String(kind === 'water' ? p.target : Math.round(p.target)) : '');
      setDeadline(g?.deadline ?? '');
    }
  }
  if (!kind) return <Sheet open={false} onClose={onClose} title=""><div /></Sheet>;
  const info = GOAL_INFO[kind];
  const save = (patch: Partial<GoalSetting>) => st.updateSettings({ goals: { ...(st.settings.goals ?? {}), [kind]: { ...(g ?? { on: true }), on: true, ...patch, updatedAt: Date.now() } } });
  const n = Number(val.replace(',', '.'));
  const lim = GOAL_LIMITS[kind];
  const bad = kind === 'weight' ? !(n >= 30 && n <= 300) : kind === 'water' ? !(n >= 0.5 && n <= 6) : kind === 'workouts' ? !(n >= 1 && n <= 7) : lim ? !(n >= lim[0] && n <= lim[1]) : false;
  const usesProfile = kind === 'protein' || kind === 'calories';

  function confirm() {
    if (!usesProfile && bad) return;
    const p = st.profile;
    if (kind === 'weight' && p) st.saveProfile({ ...p, goalWeightKg: Math.round((st.settings.bodyUnit === 'lb' ? n / 2.20462 : n) * 10) / 10 });
    if (kind === 'water') st.updateSettings({ waterGoalMl: Math.round(n * 1000) });
    if (kind === 'workouts') st.updateSettings({ workoutsPerWeek: Math.round(n) });
    save({ ...(kind === 'distance' || kind === 'strength' ? { target: n } : {}), deadline: kind === 'weight' && deadline ? deadline : undefined, paused: false, done: false });
    haptic(); toast('Goal saved'); onClose();
  }

  return (
    <Sheet open onClose={onClose} title={info.title}>
      <div className="space-y-3 pb-2">
        <p className="text-sm text-silver">{info.what}{info.period === 'day' ? ' — counted each day.' : info.period === 'week' ? ' — counted Monday to Sunday.' : '.'}</p>
        {usesProfile ? (
          <>
            <p className="rounded-2xl bg-raised px-4 py-3 text-sm">Your {kind} target is worked out from your details (and can be set by hand). It’s the same number used on Home, so there’s only ever one.</p>
            <button onClick={() => setProfileOpen(true)} className="btn-ghost w-full">Change my {kind} target</button>
          </>
        ) : (
          <label className="flex items-center gap-2">
            <input inputMode="decimal" autoFocus className="field flex-1" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.,]/g, ''))} aria-label={`Target in ${info.unit}`} placeholder="Target" />
            <span className="w-20 text-sm font-semibold text-silver">{kind === 'weight' ? st.settings.bodyUnit : info.unit}</span>
          </label>
        )}
        {!usesProfile && val && bad && <p className="text-sm text-danger">{kind === 'weight' ? 'Enter a weight between 30 and 300.' : 'That target looks too high or too low.'}</p>}
        {kind === 'weight' && (
          <label className="block text-sm">
            <span className="font-semibold">By a date? <span className="font-normal text-silver">(optional)</span></span>
            <input type="date" className="field mt-1" value={deadline} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDeadline(e.target.value)} aria-label="Target date" />
            <span className="mt-1 block text-xs text-dim">A steady 0.5–1 kg a week is a common safe pace. We’ll tell you if a date needs faster than that.</span>
          </label>
        )}
        <button onClick={confirm} disabled={!usesProfile && (!val || bad)} className="btn-primary w-full"><Check size={18} /> {g?.on ? 'Save' : 'Start this goal'}</button>
        {g?.on && (
          <div className="flex gap-2">
            <button onClick={() => { save({ paused: !g.paused }); onClose(); }} className="btn-ghost flex-1">{g.paused ? <><Play size={16} /> Resume</> : <><Pause size={16} /> Pause</>}</button>
            <button onClick={() => { save({ done: !g.done }); toast(g.done ? 'Goal reopened' : 'Nice work — goal marked done'); onClose(); }} className="btn-ghost flex-1"><Check size={16} /> {g.done ? 'Reopen' : 'Done'}</button>
            <button onClick={() => { st.updateSettings({ goals: { ...(st.settings.goals ?? {}), [kind]: { on: false, updatedAt: Date.now() } } }); onClose(); }} className="btn-ghost !px-4" aria-label="Remove goal"><Trash2 size={16} /></button>
          </div>
        )}
      </div>
      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title="Your targets">
        {st.profile && <ProfileForm initial={st.profile} submitLabel="Save" onSaved={() => { setProfileOpen(false); save({}); onClose(); }} />}
      </Sheet>
    </Sheet>
  );
}

/** Goals at a glance on the Progress tab (tap to manage). */
export function GoalsSummary() {
  const goals = useStore((s) => s.settings.goals);
  useStore((s) => s.entries); useStore((s) => s.weights); useStore((s) => s.water); useStore((s) => s.workoutLogs); useStore((s) => s.exercises);
  const nav = useNavigate();
  const on = GOAL_KINDS.filter((k) => goals?.[k]?.on && !goals[k]!.done);
  return (
    <section className="card mb-5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[16px] font-bold">Your goals</p>
        <button onClick={() => nav('/goals')} className="hit text-sm font-semibold text-accent">{on.length ? 'Manage' : 'Set goals'}</button>
      </div>
      {on.length === 0 ? <p className="mt-1 text-sm text-silver">Pick what you’re working on — weight, protein, water, workouts and more. Optional.</p> : (
        <div className="mt-2 space-y-2.5">
          {on.map((k) => {
            const p = goalProgress(k); const info = GOAL_INFO[k];
            const pct = k !== 'weight' && p.target && p.current != null ? Math.min(1, p.current / p.target) : null;
            return (
              <button key={k} onClick={() => nav('/goals')} className="block w-full text-left">
                <div className="flex items-baseline justify-between gap-2 text-[14px]">
                  <span className="font-semibold">{info.title}{goals?.[k]?.paused ? ' · paused' : ''}</span>
                  <span className="num text-silver">{k === 'weight' ? p.note : p.current != null && p.target != null ? `${fmt(p.current, k === 'water' || k === 'distance' ? 1 : 0)} / ${fmt(p.target, k === 'water' ? 1 : 0)} ${info.unit}` : 'No target'}</span>
                </div>
                {pct != null && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised"><div className={cx('h-full rounded-full', p.onTrack ? 'bg-accent' : 'bg-accent/60')} style={{ width: `${pct * 100}%` }} /></div>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
