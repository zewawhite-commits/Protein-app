import { SignInButtons } from '@/components/SignIn';
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { ChevronRight, Cloud, CreditCard, Database, Download, FileText, LifeBuoy, Lock, Moon, Receipt, RotateCcw, ShieldCheck, Smartphone, Sparkles, Sun, Trash2, Upload, XCircle } from 'lucide-react';
import { useStore, exportData } from '@/store/useStore';
import { fetchBilling, isPremiumActive, manageSubscription, type Billing } from '@/lib/premium';
import { SUPPORT_EMAIL } from '@/pages/Legal';
import { accountsEnabled, signOut, useSession } from '@/lib/account';

import { allPhotoIds, deletePhoto } from '@/lib/photos';
import type { Theme } from '@/lib/types';
import { ProfileForm } from '@/components/ProfileForm';
import { ProfileHero } from '@/components/ProfileHero';
import { UsageCard } from '@/components/UsageCard';
import { PageHeader, Segmented, Sheet, cx } from '@/components/ui';

export default function Profile() {
  const profile = useStore((s) => s.profile)!;
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const importData = useStore((s) => s.importData);
  const resetAll = useStore((s) => s.resetAll);
  const [params, setParams] = useSearchParams();
  const [editing, setEditingState] = useState(params.get('edit') === '1');
  const setEditing = (v: boolean) => { setEditingState(v); if (!v && params.get('edit')) setParams({}, { replace: true }); };
  const [msg, setMsg] = useState<string | null>(null);
  const [adminTaps, setAdminTaps] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);


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

      <ProfileHero onEdit={() => setEditing(true)} />
      <UsageCard />

      <Group title="Appearance">
        <Row icon={settings.theme === 'light' ? <Sun size={18} /> : <Moon size={18} />} label="Theme">
          <Segmented<Theme> value={settings.theme} onChange={(t) => updateSettings({ theme: t })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Auto' }]} />
        </Row>
      </Group>

      <AccountCard />

      <PremiumCard />
      <SubscriptionGroup />

      <Group title="Your data">
        <button onClick={download} className="w-full"><Row icon={<Download size={18} />} label="Export backup" chevron /></button>
        <button onClick={() => fileRef.current?.click()} className="w-full"><Row icon={<Upload size={18} />} label="Restore backup" chevron /></button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        <button onClick={reset} className="w-full"><Row icon={<Trash2 size={18} />} label="Delete all data" danger /></button>
      </Group>
      {msg && <p className="mt-2 px-1 text-sm font-semibold text-silver">{msg}</p>}

      <Group title="Support & legal">
        {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Provora support')}`} className="block"><Row icon={<LifeBuoy size={18} />} label="Contact support" chevron /></a>}
        <Link to="/privacy" className="block"><Row icon={<Lock size={18} />} label="Privacy policy" chevron /></Link>
        <Link to="/terms" className="block"><Row icon={<FileText size={18} />} label="Terms of use" chevron /></Link>
      </Group>

      {(settings.adminMode || adminTaps >= 7) && (
        <Group title="Administration">
          <Row icon={<ShieldCheck size={18} />} label="Admin mode">
            <Toggle on={settings.adminMode} onChange={(v) => updateSettings({ adminMode: v })} label="Admin mode" />
          </Row>
          {settings.adminMode && (
            <Link to="/admin" className="block"><Row icon={<Database size={18} />} label="Nutrition records" chevron /></Link>
          )}
        </Group>
      )}

      <Group title="About">
        <div className="px-3.5 py-3 text-sm font-medium leading-relaxed text-silver">
          <p className="flex items-center gap-2 font-semibold text-ink"><Database size={16} className="text-accent" /> Nutrition data</p>
          <p className="mt-1.5">
            USDA FoodData Central — SR Legacy (2018) and FNDDS (2024). FAO/INFOODS Food Composition Table for Western Africa (2019), © FAO, used with acknowledgement for non-commercial use. Packaged products: Open Food Facts (ODbL), label data contributed by its community. Values are per 100 g and are never altered or estimated by this app.
          </p>
          <p className="mt-4 flex items-center gap-2 font-semibold text-ink"><Smartphone size={16} className="text-accent" /> Install</p>
          <p className="mt-1.5">On iPhone: Share → Add to Home Screen. On Android: menu → Install app. Works offline once installed.</p>
        </div>
      </Group>

      {/* Tap the version 7 times to show admin tools (hidden from normal users). */}
      <button onClick={() => setAdminTaps((n) => n + 1)} className="mt-8 w-full pb-4 text-center text-xs font-medium text-dim">Provora {__APP_VERSION__}</button>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <ProfileForm initial={profile} submitLabel="Save" onSaved={() => setEditing(false)} />
        <p className="mt-3 text-xs text-dim">Goal changes apply from today. Past days keep the goal they had.</p>
      </Sheet>
    </div>
  );
}


function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <p className="mb-3 px-1 text-sm font-semibold text-silver">{title}</p>
      <div className="card overflow-hidden p-1.5">{children}</div>
    </section>
  );
}

function Row({ icon, label, children, chevron, danger }: { icon: React.ReactNode; label: string; children?: React.ReactNode; chevron?: boolean; danger?: boolean }) {
  return (
    <div className={cx('flex min-h-[60px] items-center gap-3.5 rounded-[22px] px-3 py-2 text-left', danger && 'text-danger')}>
      <span className={cx('grid h-10 w-10 place-items-center rounded-full bg-raised', danger ? 'text-danger' : 'text-ink')}>{icon}</span>
      <span className="flex-1 font-semibold">{label}</span>
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

function PremiumCard() {
  const premium = useStore((s) => s.premium);
  const active = isPremiumActive(premium);
  if (active) return null; // the Subscription section shows the plan
  return (
    <Link to="/premium" className="mt-6 block overflow-hidden rounded-[28px] bg-primary p-5 text-on-primary transition active:scale-[.99]">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-on-primary/10"><Sparkles size={22} className="text-accent" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{active ? `${premium!.tier === 'pro' ? 'Pro' : 'Plus'} is active` : 'Upgrade to Plus or Pro'}</p>
          <p className="truncate text-[14px] opacity-70">
            {active ? `${premium!.email} · until ${new Date(premium!.exp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'Unlimited AI scans and coach'}
          </p>
        </div>
        <ChevronRight size={18} className="opacity-60" />
      </div>
    </Link>
  );
}

function AccountCard() {
  const session = useSession();
  if (!accountsEnabled) return null;
  return (
    <section className="mt-6">
      <p className="mb-3 px-1 text-sm font-semibold text-silver">Account</p>
      <div className="card p-4">
        {session ? (
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-raised"><Cloud size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{session.user.email}</p>
              <p className="text-xs text-silver">Your data is saved to your account</p>
            </div>
            <button onClick={() => void signOut()} className="chip !h-9">Sign out</button>
          </div>
        ) : (
          <>
            <p className="font-semibold">Save your data to an account</p>
            <p className="mt-0.5 text-xs text-silver">Use the app on any phone and never lose your log.</p>
            <div className="mt-3"><SignInButtons /></div>
          </>
        )}
      </div>
    </section>
  );
}

/** Plan, renewal date and card on file, with manage / cancel / restore. */
function SubscriptionGroup() {
  const premium = useStore((s) => s.premium);
  const active = isPremiumActive(premium);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (active) void fetchBilling().then(setBilling); }, [active]);

  async function manage() {
    setBusy(true);
    setNote('');
    try { await manageSubscription(); } catch (e) { setNote((e as Error).message); } finally { setBusy(false); }
  }
  const date = (v: string | number) => new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Group title="Subscription">
      <Row icon={<Sparkles size={18} />} label="Plan">
        <span className="text-sm font-semibold text-silver">{active ? `${premium!.tier === 'pro' ? 'Pro' : 'Plus'}${billing?.interval ? ` · ${billing.interval === 'annually' ? 'yearly' : billing.interval}` : ''}` : 'Free'}</span>
      </Row>
      {active ? (
        <>
          <Row icon={<Receipt size={18} />} label={billing?.status === 'non-renewing' ? 'Ends on' : 'Renews on'}>
            <span className="text-sm font-semibold text-silver">{date(billing?.nextPayment ?? premium!.exp)}</span>
          </Row>
          <button onClick={manage} disabled={busy} className="w-full">
            <Row icon={<CreditCard size={18} />} label="Payment method" chevron>
              <span className="text-sm font-semibold text-silver">{billing?.card ? `${billing.card.brand.replace(/^\w/, (c) => c.toUpperCase())} •••• ${billing.card.last4}` : 'Update card'}</span>
            </Row>
          </button>
          <button onClick={manage} disabled={busy} className="w-full"><Row icon={<XCircle size={18} />} label="Cancel subscription" chevron /></button>
        </>
      ) : (
        <>
          <Link to="/premium" className="block"><Row icon={<CreditCard size={18} />} label="Upgrade" chevron><span className="text-sm font-semibold text-accent">From $2.50/mo</span></Row></Link>
          <Link to="/premium?restore=1" className="block"><Row icon={<RotateCcw size={18} />} label="Restore purchase" chevron /></Link>
        </>
      )}
      {note && <p className="px-4 pb-3 text-sm text-silver">{note}</p>}
      <p className="px-4 pb-3 pt-1 text-xs text-dim">Payments are processed securely by Paystack. We never see or store your full card number.</p>
    </Group>
  );
}
