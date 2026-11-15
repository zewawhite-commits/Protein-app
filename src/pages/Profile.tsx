import { SignInButtons } from '@/components/SignIn';
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowLeft, Flame, UserRound, KeyRound, LogOut, Mail, Scale, Settings as SettingsIcon, ChevronRight, Cloud, CreditCard, Database, Download, FileText, LifeBuoy, Lock, Moon, Receipt, RotateCcw, ShieldCheck, Smartphone, Sparkles, Sun, Trash2, Upload, XCircle } from 'lucide-react';
import { useStore, exportData } from '@/store/useStore';
import { fetchBilling, isPremiumActive, manageSubscription, type Billing } from '@/lib/premium';
import { SUPPORT_EMAIL } from '@/pages/Legal';
import { accountsEnabled, changeEmail, deleteAccount, setPassword, signOut, useSession } from '@/lib/account';

import { allPhotoIds, deletePhoto } from '@/lib/photos';
import type { Theme } from '@/lib/types';
import { ProfileForm } from '@/components/ProfileForm';
import { ProfileHero } from '@/components/ProfileHero';
import { UsageCard } from '@/components/UsageCard';
import { PageHeader, Segmented, Sheet, cx, fmt } from '@/components/ui';
import { ReminderSettings } from '@/components/Notifications';
import { calorieGoal } from '@/lib/energy';

export default function Profile({ mode = 'profile' }: { mode?: 'profile' | 'settings' }) {
  const isSettings = mode === 'settings';
  const navigate = useNavigate();
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
  const dailyKcal = calorieGoal(profile)?.kcal;

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
      {isSettings ? (
        <header className="pt-safe flex items-center gap-3 pb-2">
          <button onClick={() => navigate('/profile')} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
          <h1 className="text-[28px] font-extrabold tracking-tight">Settings</h1>
        </header>
      ) : (
        <PageHeader title="Profile" right={<Link to="/settings" className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Settings"><SettingsIcon size={20} /></Link>} />
      )}

      {!isSettings && (
        <>
          <ProfileHero onEdit={() => setEditing(true)} />
          <UsageCard />
          <PreferencesCard onEdit={() => setEditing(true)} />
          <PremiumCard />
          <SubscriptionGroup />
          <Group title="More">
            <Link to="/settings" className="block"><Row icon={<SettingsIcon size={18} />} label="Settings & account" chevron /></Link>
            <Link to="/privacy" className="block"><Row icon={<Lock size={18} />} label="Privacy policy" chevron /></Link>
            <Link to="/terms" className="block"><Row icon={<FileText size={18} />} label="Terms of use" chevron /></Link>
          </Group>
        </>
      )}

      {isSettings && (
        <>
      <Group title="Personal details">
        {([
          ['Name', profile.name || 'Add your name'],
          ['Age', profile.age ? `${profile.age}` : 'Add'],
          ['Height', profile.heightCm ? (settings.bodyUnit === 'lb' ? `${Math.floor(profile.heightCm / 2.54 / 12)} ft ${Math.round((profile.heightCm / 2.54) % 12)} in` : `${profile.heightCm} cm`) : 'Add'],
          ['Weight', profile.bodyWeightKg ? `${fmt(settings.bodyUnit === 'lb' ? profile.bodyWeightKg * 2.20462 : profile.bodyWeightKg, 1)} ${settings.bodyUnit}` : 'Add'],
          ['Goal weight', profile.goalWeightKg ? `${fmt(settings.bodyUnit === 'lb' ? profile.goalWeightKg * 2.20462 : profile.goalWeightKg, 1)} ${settings.bodyUnit}` : 'Not set'],
          ['Daily calories', dailyKcal ? `${fmt(dailyKcal)} kcal` : 'Add height & age'],
        ] as const).map(([label, value]) => (
          <button key={label} onClick={() => setEditing(true)} className="w-full">
            <Row icon={<UserRound size={18} />} label={label} chevron><span className="max-w-[50%] truncate text-sm font-semibold text-silver">{value}</span></Row>
          </button>
        ))}
      </Group>

      <AccountCard />

      <Group title="Preferences">
        <Row icon={settings.theme === 'light' ? <Sun size={18} /> : <Moon size={18} />} label="Theme">
          <Segmented<Theme> value={settings.theme} onChange={(t) => updateSettings({ theme: t })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Auto' }]} />
        </Row>
        <Row icon={<Scale size={18} />} label="Weight unit">
          <Segmented value={settings.bodyUnit} onChange={(u) => updateSettings({ bodyUnit: u })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </Row>
        <Row icon={<Flame size={18} />} label="Add exercise calories to my budget">
          <Toggle on={!!settings.addBurned} onChange={(v) => updateSettings({ addBurned: v })} label="Add exercise calories" />
        </Row>
      </Group>

      <section className="mt-6">
        <p className="mb-3 px-1 text-sm font-semibold text-silver">Reminders</p>
        <div className="card px-5 pb-5 [&>section]:mt-0 [&>section]:pt-5"><ReminderSettings /></div>
      </section>

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
            USDA FoodData Central — SR Legacy (2018) and FNDDS (2024). UK: McCance and Widdowson’s CoFID 2021 (Open Government Licence v3.0). Australia: FSANZ Australian Food Composition Database Release 3 (CC BY 4.0). FAO/INFOODS Food Composition Table for Western Africa (2019), © FAO, used with acknowledgement for non-commercial use. Packaged products: Open Food Facts (ODbL), label data contributed by its community. Values are per 100 g and are copied from these tables; world dishes not in any table are calculated from their listed ingredient records.
          </p>
          <p className="mt-4 flex items-center gap-2 font-semibold text-ink"><Smartphone size={16} className="text-accent" /> Install</p>
          <p className="mt-1.5">On iPhone: Share → Add to Home Screen. On Android: menu → Install app. Works offline once installed.</p>
        </div>
      </Group>

      {/* Tap the version 7 times to show admin tools (hidden from normal users). */}
      <button onClick={() => setAdminTaps((n) => n + 1)} className="mt-8 w-full pb-4 text-center text-xs font-medium text-dim">Provora {__APP_VERSION__}</button>
        </>
      )}

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
  const premiumActive = useStore((s) => isPremiumActive(s.premium));
  const [changing, setChanging] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!accountsEnabled) return null;
  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true); setNote('');
    try { await fn(); if (ok) setNote(ok); } catch (e) { setNote((e as Error).message); } finally { setBusy(false); }
  };
  if (!session) {
    return (
      <section className="mt-6">
        <p className="mb-3 px-1 text-sm font-semibold text-silver">Account</p>
        <div className="card p-5">
          <p className="font-semibold">Save your data to an account</p>
          <p className="mt-0.5 text-xs text-silver">Use the app on any phone and never lose your log.</p>
          <div className="mt-3"><SignInButtons /></div>
        </div>
      </section>
    );
  }
  const viaGoogle = session.user.app_metadata?.provider === 'google';
  return (
    <Group title="Account">
      <Row icon={<Cloud size={18} />} label="Signed in as">
        <span className="max-w-[55%] truncate text-sm font-semibold text-silver">{session.user.email}</span>
      </Row>
      <Row icon={<ShieldCheck size={18} />} label="Sign-in method">
        <span className="text-sm font-semibold text-silver">{viaGoogle ? 'Google' : 'Email code'}</span>
      </Row>
      {!viaGoogle && (
        <button onClick={() => setChanging((v) => !v)} className="w-full"><Row icon={<Mail size={18} />} label="Change email" chevron /></button>
      )}
      {changing && (
        <div className="px-3 pb-3">
          <div className="flex gap-2">
            <input type="email" inputMode="email" autoComplete="email" className="field !h-12 flex-1" placeholder="new@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={() => run(() => changeEmail(email.trim()), 'Check your new inbox and confirm to finish the change.')} className="btn-primary !h-12 !px-4 text-sm">Save</button>
          </div>
        </div>
      )}
      <button onClick={() => setPwOpen((v) => !v)} className="w-full"><Row icon={<KeyRound size={18} />} label="Set or change password" chevron /></button>
      {pwOpen && (
        <div className="px-3 pb-3">
          <div className="flex gap-2">
            <input type="password" autoComplete="new-password" className="field !h-12 flex-1" placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button disabled={busy || pw.length < 8} onClick={() => run(async () => { await setPassword(pw); setPw(''); setPwOpen(false); }, 'Password saved. You can sign in with it, or keep using Google or an email code.')} className="btn-primary !h-12 !px-4 text-sm">Save</button>
          </div>
        </div>
      )}
      <button onClick={() => { if (confirm('Sign out? Your log is saved to your account and removed from this phone.')) void signOut(); }} className="w-full"><Row icon={<LogOut size={18} />} label="Sign out" chevron /></button>
      <button
        disabled={busy}
        onClick={() => {
          if (premiumActive && !confirm('You have an active subscription. Cancel it first under Profile → Subscription, or you may still be charged. Continue anyway?')) return;
          if (!confirm('Delete your account? Your log, photos, posts and profile are removed for good. This cannot be undone.')) return;
          void run(deleteAccount);
        }}
        className="w-full"
      >
        <Row icon={<Trash2 size={18} />} label={busy ? 'Deleting…' : 'Delete account'} danger />
      </button>
      {note && <p className="px-4 pb-3 text-sm text-silver">{note}</p>}
      <p className="px-4 pb-3 pt-1 text-xs text-dim">You can always sign in with Google or a one-time email code. A password is optional.</p>
    </Group>
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

const GOAL_LABEL: Record<string, string> = { muscle: 'Build muscle', fatloss: 'Lose fat', performance: 'Sports performance', maintain: 'Maintain', health: 'Eat healthier' };
const DIET_LABEL: Record<string, string> = { all: 'Eats everything', pescatarian: 'Pescatarian', vegetarian: 'Vegetarian', vegan: 'Vegan' };
const ACTIVITY_LABEL: Record<string, string> = { sedentary: '0 workouts a week', light: '1–2 workouts a week', active: '3–5 workouts a week', athlete: '6+ workouts a week' };

/** Everything they picked in onboarding, visible and editable. */
function PreferencesCard({ onEdit }: { onEdit: () => void }) {
  const p = useStore((s) => s.profile);
  if (!p) return null;
  const rows: [string, string[], string?][] = [
    ['Goals', (p.goals ?? (p.goal ? [p.goal] : [])).map((g) => GOAL_LABEL[g] ?? g)],
    ['Exercise', [...(p.activity ? [ACTIVITY_LABEL[p.activity]] : []), ...(p.training ?? [])]],
    ['How you eat', [...(p.diet ? [DIET_LABEL[p.diet]] : []), ...(p.dietPrefs ?? [])]],
    ['Cuisines', p.cuisines ?? []],
    ['Avoids', p.avoid ?? [], 'danger'],
  ];
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-silver">Your preferences</p>
        <button onClick={onEdit} className="text-sm font-semibold text-accent">Edit</button>
      </div>
      <div className="card space-y-4 p-5">
        {rows.map(([label, items, tone]) => (
          <div key={label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-dim">{label}</p>
            {items.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {items.map((i) => <span key={i} className={cx('rounded-full px-3 py-1 text-[13px] font-semibold', tone ? 'bg-danger/10 text-danger' : 'bg-raised')}>{i}</span>)}
              </div>
            ) : (
              <button onClick={onEdit} className="mt-1 text-sm text-silver">Not set — add</button>
            )}
          </div>
        ))}
        <p className="text-xs text-dim">Used for your food suggestions, AI coach, recipes, workouts and plans.</p>
      </div>
    </section>
  );
}
