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
      <PageHeader title="Profile" />

      <section className="card relative overflow-hidden p-5">
                <div className="relative flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-2xl font-extrabold text-on-primary">
            {(profile.name || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold">{profile.name || 'You'}</p>
            <p className="text-sm font-semibold text-silver">
              {profile.bodyWeightKg ? `${fmt(fromKg(profile.bodyWeightKg, settings.bodyUnit), 1)} ${settings.bodyUnit} · ` : ''}
              {profile.goalMode === 'perKg' ? `${profile.gramsPerKg} g/kg` : 'Fixed goal'}
            </p>
          </div>
          <button onClick={() => setEditing(true)} className="grid h-11 w-11 place-items-center rounded-full bg-raised" aria-label="Edit profile"><Pencil size={16} /></button>
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
      {msg && <p className="mt-2 px-1 text-sm font-semibold text-silver">{msg}</p>}

      <Group title="Administration">
        <Row icon={<ShieldCheck size={18} />} label="Admin mode">
          <Toggle on={settings.adminMode} onChange={(v) => updateSettings({ adminMode: v })} label="Admin mode" />
        </Row>
        {settings.adminMode && (
          <Link to="/admin" className="block"><Row icon={<Database size={18} />} label="Nutrition records" chevron /></Link>
        )}
      </Group>

      <Group title="About">
        <div className="px-3.5 py-3 text-sm font-medium leading-relaxed text-silver">
          <p className="flex items-center gap-2 font-bold text-ink"><Database size={16} className="text-accent" /> Nutrition data</p>
          <p className="mt-1.5">
            U.S. Department of Agriculture, Agricultural Research Service. <em>FoodData Central: SR Legacy</em> (2018). Values are per 100 g edible portion and are not altered by this app.
          </p>
          <p className="mt-4 flex items-center gap-2 font-bold text-ink"><Smartphone size={16} className="text-accent" /> Install</p>
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
    <div className="tile py-3">
      <p className="num text-lg font-extrabold">{value}</p>
      <p className="text-[11px] font-semibold text-silver">{label}</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <p className="mb-3 px-1 text-sm font-extrabold text-silver">{title}</p>
      <div className="card overflow-hidden p-1.5">{children}</div>
    </section>
  );
}

function Row({ icon, label, children, chevron, danger }: { icon: React.ReactNode; label: string; children?: React.ReactNode; chevron?: boolean; danger?: boolean }) {
  return (
    <div className={cx('flex min-h-[60px] items-center gap-3.5 rounded-[22px] px-3 py-2 text-left', danger && 'text-danger')}>
      <span className={cx('grid h-10 w-10 place-items-center rounded-full bg-raised', danger ? 'text-danger' : 'text-ink')}>{icon}</span>
      <span className="flex-1 font-bold">{label}</span>
      {children}
      {chevron && <ChevronRight size={16} className="text-dim" />}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative h-8 w-[52px] rounded-full transition', on ? 'bg-accent' : 'bg-line')}>
      <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[24px]' : 'left-1')} />
    </button>
  );
}
