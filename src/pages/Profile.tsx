import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Database, Download, Moon, Pencil, ShieldCheck, Smartphone, Sun, Trash2, Upload } from 'lucide-react';
import { useStore, exportData } from '@/store/useStore';
import { dailyGoal, fromKg } from '@/lib/nutrition';
import { allPhotoIds, deletePhoto } from '@/lib/photos';
import type { Theme } from '@/lib/types';
import { ProfileForm } from '@/components/ProfileForm';
import { PageHeader, Segmented, Sheet, cx, fmt } from '@/components/ui';

export default function Profile() {
  const profile = useStore((s) => s.profile)!;
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const entries = useStore((s) => s.entries);
  const importData = useStore((s) => s.importData);
  const resetAll = useStore((s) => s.resetAll);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const goal = dailyGoal(profile);
  const days = new Set(entries.map((e) => e.date)).size;

  function download() {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `protein-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Backup downloaded. Photos are not included in backups yet.');
  }

  async function upload(file?: File) {
    if (!file) return;
    try {
      importData(JSON.parse(await file.text()));
      setMsg('Backup restored.');
    } catch (e) {
      setMsg((e as Error).message || 'Could not read that file.');
    }
  }

  async function reset() {
    if (!confirm('Delete all entries, custom foods, photos and your profile from this device? This cannot be undone.')) return;
    for (const id of await allPhotoIds()) await deletePhoto(id);
    resetAll();
  }

  return (
    <div className="animate-fade-up">
      <PageHeader eyebrow="Account" title="Profile" />

      <section className="card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-ink to-silver text-xl font-semibold text-bg">
            {(profile.name || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{profile.name || 'You'}</p>
            <p className="text-sm text-silver">
              {profile.bodyWeightKg ? `${fmt(fromKg(profile.bodyWeightKg, settings.bodyUnit), 1)} ${settings.bodyUnit} · ` : ''}
              {profile.goalMode === 'perKg' ? `${profile.gramsPerKg} g/kg` : 'Fixed goal'}
            </p>
          </div>
          <button onClick={() => setEditing(true)} className="grid h-10 w-10 place-items-center rounded-full bg-raised border border-line" aria-label="Edit profile"><Pencil size={16} /></button>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2 text-center">
          <Mini label="Daily goal" value={`${fmt(goal)} g`} />
          <Mini label="Days logged" value={fmt(days)} />
          <Mini label="Entries" value={fmt(entries.length)} />
        </div>
      </section>

      <Group title="Appearance">
        <Row icon={settings.theme === 'light' ? <Sun size={18} /> : <Moon size={18} />} label="Theme">
          <Segmented<Theme> value={settings.theme} onChange={(t) => updateSettings({ theme: t })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Auto' }]} />
        </Row>
      </Group>

      <Group title="Your data">
        <button onClick={download} className="w-full"><Row icon={<Download size={18} />} label="Export backup" chevron /></button>
        <button onClick={() => fileRef.current?.click()} className="w-full"><Row icon={<Upload size={18} />} label="Restore backup" chevron /></button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        <button onClick={reset} className="w-full"><Row icon={<Trash2 size={18} />} label="Delete all data" danger /></button>
      </Group>
      {msg && <p className="mt-2 px-1 text-sm text-silver">{msg}</p>}

      <Group title="Administration">
        <Row icon={<ShieldCheck size={18} />} label="Admin mode">
          <Toggle on={settings.adminMode} onChange={(v) => updateSettings({ adminMode: v })} label="Admin mode" />
        </Row>
        {settings.adminMode && (
          <Link to="/admin" className="block"><Row icon={<Database size={18} />} label="Nutrition records" chevron /></Link>
        )}
      </Group>

      <Group title="About">
        <div className="px-4 py-3.5 text-sm leading-relaxed text-silver">
          <p className="flex items-center gap-2 font-medium text-ink"><Database size={16} className="text-accent" /> Nutrition data</p>
          <p className="mt-1.5">
            U.S. Department of Agriculture, Agricultural Research Service. <em>FoodData Central: SR Legacy</em> (2018). Values are per 100 g edible portion and are not altered by this app.
          </p>
          <p className="mt-3 flex items-center gap-2 font-medium text-ink"><Smartphone size={16} className="text-accent" /> Install</p>
          <p className="mt-1.5">On iPhone: Share → Add to Home Screen. On Android: menu → Install app. Works offline once installed.</p>
        </div>
      </Group>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <ProfileForm initial={profile} submitLabel="Save" onSaved={() => setEditing(false)} />
        <p className="mt-3 text-xs text-dim">Goal changes apply from today. Past days keep the goal they had.</p>
      </Sheet>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line/60 bg-raised/50 py-2.5">
      <p className="font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-dim">{label}</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <p className="eyebrow mb-2 px-1">{title}</p>
      <div className="card divide-y divide-line/50 overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ icon, label, children, chevron, danger }: { icon: React.ReactNode; label: string; children?: React.ReactNode; chevron?: boolean; danger?: boolean }) {
  return (
    <div className={cx('flex min-h-[56px] items-center gap-3 px-4 py-2 text-left', danger && 'text-danger')}>
      <span className={cx('grid h-8 w-8 place-items-center rounded-xl bg-raised', danger ? 'text-danger' : 'text-silver')}>{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {children}
      {chevron && <ChevronRight size={16} className="text-dim" />}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative h-7 w-12 rounded-full transition', on ? 'bg-accent' : 'bg-line')}>
      <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  );
}
