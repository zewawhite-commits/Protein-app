import { InstallRow } from '@/components/InstallApp';
import { AutoBackups, ShareReportRow } from '@/components/DataTools';
import { SignInButtons } from '@/components/SignIn';
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Bell, Target, Utensils, ArrowLeft, CalendarDays, Palette, ChevronRight, Cloud, CreditCard, Crown, Database, Download, FileText, Flame, HeartHandshake, LifeBuoy, Lightbulb, Lock, LogOut, Mail, Moon, Receipt, RefreshCw, RotateCcw, Scale, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal, Smartphone, Sun, Table, Trash2, Upload, UserRound, XCircle } from 'lucide-react';
import { useStore, exportData } from '@/store/useStore';
import { fetchBilling, isPremiumActive, manageSubscription, type Billing } from '@/lib/premium';
import { SUPPORT_EMAIL } from '@/pages/Legal';
import { setMarketingOptIn } from '@/lib/account';
import { accountsEnabled, cleanPhone, deleteAccount, setPhoneNumber, signOut, syncNow, useSession, useSyncStatus, validPhone } from '@/lib/account';
import { useOnline } from '@/lib/online';
import { usePendingSync } from '@/components/NetStatus';
import { toast } from '@/components/fx';

import { allPhotoIds, deletePhoto } from '@/lib/photos';
import type { Theme } from '@/lib/types';
import { ProfileForm } from '@/components/ProfileForm';
import { ProfileHero } from '@/components/ProfileHero';
import { InviteCard, TrialCard } from '@/components/FreePro';
import { CreditsCard } from '@/components/CreditsCard';
import { PageHeader, Segmented, Sheet, cx, fmt } from '@/components/ui';
import { ReminderSettings } from '@/components/Notifications';
import { calorieGoal } from '@/lib/energy';

export default function Profile({ mode = 'profile' }: { mode?: 'profile' | 'settings' }) {
  // Links like /settings#notifications open at that section.
  useEffect(() => { const id = location.hash.slice(1); if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50); }, [mode]);
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
  // Admin tools only for the owner account (the server decides, from ADMIN_EMAILS).
  const isOwner = useIsOwner();
  const dailyKcal = calorieGoal(profile)?.kcal;
  const goalCount = useStore((s) => Object.values(s.settings.goals ?? {}).filter((g) => g?.on && !g.paused && !g.done).length);

  const fileRef = useRef<HTMLInputElement>(null);


  /** Food history as a CSV that opens in Excel, Numbers or Google Sheets — easy to share with a coach or dietitian. */
  function downloadCsv() {
    const s = useStore.getState();
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const n = (v: number | null | undefined, g: number) => (v == null ? '' : Math.round((v * g) / 100 * 10) / 10);
    const rows = [...s.entries].sort((a, b) => a.date.localeCompare(b.date)).map((e) =>
      [e.date, e.meal, q(e.food.name), e.grams, n(e.food.per100.kcal, e.grams), n(e.food.per100.protein, e.grams), n(e.food.per100.carbs, e.grams), n(e.food.per100.fat, e.grams), n(e.food.per100.fiber, e.grams), n(e.food.per100.sugar, e.grams), n(e.food.per100.sodium, e.grams), q(e.food.source), q(e.note ?? '')].join(','));
    const weights = s.weights.map((w) => [w.date, 'weight', '"Body weight (kg)"', w.kg, '', '', '', '', '', '', '', '', ''].join(','));
    const workouts = s.exercises.map((x) => [x.date, 'exercise', q(`${x.type} (${x.minutes} min, ${x.intensity})`), '', -x.kcal, '', '', '', '', '', '', '', ''].join(','));
    const csv = ['Date,Meal,Food,Grams,Calories (kcal),Protein (g),Carbs (g),Fat (g),Fibre (g),Sugar (g),Sodium (mg),Source,Note', ...rows, ...weights, ...workouts].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `provora-food-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(rows.length ? `Downloaded ${rows.length} food entries.` : 'Downloaded — your log is empty so far.');
  }

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
          {/* The things people look for most, first. */}
          <Group title="Quick access">
            <Link to="/history" className="block"><Row icon={<CalendarDays size={18} />} label="Diary" chevron><span className="text-sm text-silver">Every meal, by date</span></Row></Link>
            <Link to="/goals" className="block"><Row icon={<Target size={18} />} label="My goals" chevron><span className="text-sm text-silver">{goalCount ? `${goalCount} active` : 'Weight, protein, water, workouts'}</span></Row></Link>
            <Link to="/settings#notifications" className="block"><Row icon={<Bell size={18} />} label="Reminders" chevron><span className="text-sm text-silver">{settings.reminders?.enabled ? `Meals at ${settings.reminders.breakfast} · ${settings.reminders.lunch} · ${settings.reminders.dinner}` : 'Off'}</span></Row></Link>
          </Group>
          <PersonalDetails profile={profile} unit={settings.bodyUnit} dailyKcal={dailyKcal} onEdit={() => setEditing(true)} />
          <PreferencesCard onEdit={() => setEditing(true)} />
          <SubscriptionGroup />
          <CreditsCard />
          <TrialCard className="mt-5" />
          <InviteCard className="mt-5" />
          <OwnerLink />
          <Group title="More">
            <Link to="/settings" className="block"><Row icon={<SettingsIcon size={18} />} label="Settings" chevron><span className="text-sm text-silver">Theme, units, notifications, data</span></Row></Link>
          </Group>
        </>
      )}

      {isSettings && (
        <>

      <Group title="Appearance">
        <Row icon={settings.theme === 'light' ? <Sun size={18} /> : <Moon size={18} />} label="Theme">
          <Segmented<Theme> value={settings.theme} onChange={(t) => updateSettings({ theme: t })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Auto' }]} />
        </Row>
        <Row icon={<Palette size={18} />} label="Colour">
          <Segmented<'green' | 'pink'> value={settings.accent ?? 'green'} onChange={(a) => updateSettings({ accent: a })} options={[{ value: 'green', label: 'Green' }, { value: 'pink', label: 'Pink' }]} />
        </Row>
      </Group>

      <Group title="Tracking">
        <Row icon={<Scale size={18} />} label="Weight unit">
          <Segmented value={settings.bodyUnit} onChange={(u) => updateSettings({ bodyUnit: u })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </Row>
        <Row icon={<SlidersHorizontal size={18} />} label="Tracking style" />
        <div className="px-3 pb-2">
          <Segmented full value={settings.tracking ?? 'detailed'} onChange={(t) => updateSettings({ tracking: t })} options={[{ value: 'simple', label: 'Simple' }, { value: 'detailed', label: 'Detailed' }, { value: 'photo', label: 'Photo diary' }]} />
          <p className="mt-2 text-xs leading-relaxed text-dim">{(settings.tracking ?? 'detailed') === 'simple' ? 'Calories and protein only, for a clean, quick log.' : (settings.tracking ?? 'detailed') === 'detailed' ? 'Calories, protein, carbs, fat, fibre, sugar, vitamins and minerals.' : 'Save meal photos by date and meal, and work out the nutrition later if you want.'} Switching never changes what you’ve logged.</p>
        </div>
        <Row icon={<Utensils size={18} />} label="Meals per day" />
        <div className="px-3 pb-2">
          <Segmented full value={String(settings.mealsPerDay ?? 4)} onChange={(v) => updateSettings({ mealsPerDay: Number(v) })} options={['4', '5', '6', '7'].map((n) => ({ value: n, label: n }))} />
          <p className="mt-2 text-xs leading-relaxed text-dim">4 is breakfast, snack, lunch and dinner. More adds afternoon and evening snacks and a late meal.</p>
        </div>
      </Group>

      <Group title="Nutrition">
        <Row icon={<Flame size={18} />} label="Add exercise calories to my budget">
          <Toggle on={!!settings.addBurned} onChange={(v) => updateSettings({ addBurned: v })} label="Add exercise calories" />
        </Row>
        <Row icon={<HeartHandshake size={18} />} label="Gentle mode">
          <Toggle on={!!settings.gentle} onChange={(v) => updateSettings({ gentle: v })} label="Gentle mode" />
        </Row>
        <p className="px-4 pb-2 text-xs leading-relaxed text-dim">Hides streaks and “over target” notices. If tracking ever makes you anxious about food, take a break; your data stays safe. Free support in the UK: <a className="font-semibold text-accent" href="https://www.beateatingdisorders.org.uk" target="_blank" rel="noreferrer">Beat</a>.</p>
      </Group>

      <Group title="AI">
        <Row icon={<Lightbulb size={18} />} label="Suggestions on Home">
          <Toggle on={!settings.quietAi} onChange={(v) => updateSettings({ quietAi: !v })} label="Suggestions on Home" />
        </Row>
        <p className="px-4 pb-2 text-xs leading-relaxed text-dim">Shows “What to eat next”. The coach only replies when you ask.</p>
      </Group>

      <section id="notifications" className="mt-6 scroll-mt-6">
        <p className="mb-3 px-1 text-sm font-semibold text-silver">Notifications and reminders</p>
        <div className="card px-5 pb-5 [&>section]:mt-0 [&>section]:pt-5"><ReminderSettings /></div>
        <div className="card mt-2.5 p-1.5"><MarketingRow /></div>
      </section>

      <AccountCard />

      <Group title="Your data">
        <p className="px-4 pb-1 pt-3 text-sm leading-relaxed text-silver">Your data is never sold. What you send to AI features is used only to answer you, not to train AI models.</p>
        <button onClick={downloadCsv} className="w-full"><Row icon={<Table size={18} />} label="Download food log" chevron /></button>
        <ShareReportRow Row={Row} />
        <button onClick={download} className="w-full"><Row icon={<Download size={18} />} label="Export backup" chevron /></button>
        <button onClick={() => fileRef.current?.click()} className="w-full"><Row icon={<Upload size={18} />} label="Restore backup" chevron /></button>
        <AutoBackups />
        <button onClick={() => { if (confirm('Answer the setup questions again? Your food log and history stay.')) useStore.setState({ profile: null }); }} className="w-full"><Row icon={<RotateCcw size={18} />} label="Update your preferences" chevron /></button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        <button onClick={reset} className="w-full"><Row icon={<Trash2 size={18} />} label="Delete all data" danger /></button>
      </Group>
      {msg && <p className="mt-2 px-1 text-sm font-semibold text-silver">{msg}</p>}

      <Group title="Help and support">
        <Link to="/help" className="block"><Row icon={<LifeBuoy size={18} />} label="Help and support" chevron /></Link>
        {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Nutivili AI support')}`} className="block"><Row icon={<Mail size={18} />} label="Contact support" chevron /></a>}
        <InstallRow />
      </Group>

      <Group title="Legal">
        <Link to="/privacy" className="block"><Row icon={<Lock size={18} />} label="Privacy policy" chevron /></Link>
        <Link to="/terms" className="block"><Row icon={<FileText size={18} />} label="Terms and conditions" chevron /></Link>
        <Link to="/refunds" className="block"><Row icon={<FileText size={18} />} label="Cancellation and refunds" chevron /></Link>
      </Group>

      {isOwner && (
        <Group title="Administration">
          <Row icon={<ShieldCheck size={18} />} label="Admin mode">
            <Toggle on={settings.adminMode} onChange={(v) => updateSettings({ adminMode: v })} label="Admin mode" />
          </Row>
          {settings.adminMode && (
            <Link to="/admin" className="block"><Row icon={<Database size={18} />} label="Nutrition records" chevron /></Link>
          )}
        </Group>
      )}

      <Group title="About Nutivili">
        <div className="px-3.5 py-3 text-sm font-medium leading-relaxed text-silver">
          <p className="flex items-center gap-2 font-semibold text-ink"><Database size={16} className="text-accent" /> Nutrition data</p>
          <p className="mt-1.5">
            USDA FoodData Central — SR Legacy (2018) and FNDDS (2024). UK: McCance and Widdowson’s CoFID 2021 (Open Government Licence v3.0). Australia: FSANZ Australian Food Composition Database Release 3 (CC BY 4.0). FAO/INFOODS Food Composition Table for Western Africa (2019), © FAO, used with acknowledgement for non-commercial use. Packaged products: Open Food Facts (ODbL), label data contributed by its community. Values are per 100 g and are copied from these tables; world dishes not in any table are calculated from their listed ingredient records.
          </p>
          <p className="mt-3">Food photos: <Link to="/credits" className="font-semibold text-accent">photographer credits</Link>.</p>
        </div>
      </Group>

      <p className="mt-8 w-full pb-4 text-center text-xs font-medium text-dim">Nutivili AI {__APP_VERSION__}</p>
        </>
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <ProfileForm initial={profile} submitLabel="Save" onSaved={() => setEditing(false)} />
        <p className="mt-3 text-xs text-dim">Goal changes apply from today. Past days keep the goal they had.</p>
      </Sheet>
    </div>
  );
}


function PersonalDetails({ profile, unit, dailyKcal, onEdit }: { profile: import("@/lib/types").Profile; unit: 'kg' | 'lb'; dailyKcal?: number; onEdit: () => void }) {
  const w = (kg?: number | null) => (kg ? `${fmt(unit === 'lb' ? kg * 2.20462 : kg, 1)} ${unit}` : 'Add');
  const rows: [string, string][] = [
    ['Name', profile.name || 'Add your name'],
    ['Age', profile.age ? `${profile.age}` : 'Add'],
    ['Height', profile.heightCm ? (unit === 'lb' ? `${Math.floor(profile.heightCm / 2.54 / 12)} ft ${Math.round((profile.heightCm / 2.54) % 12)} in` : `${profile.heightCm} cm`) : 'Add'],
    ['Weight', w(profile.bodyWeightKg)],
    ['Daily calories', dailyKcal ? `${fmt(dailyKcal)} kcal` : 'Add height and age'],
  ];
  return (
    <Group title="Personal details">
      {rows.map(([label, value]) => (
        <button key={label} onClick={onEdit} className="w-full">
          <Row icon={<UserRound size={18} />} label={label} chevron><span className="max-w-[50%] truncate text-sm font-semibold text-silver">{value}</span></Row>
        </button>
      ))}
      <p className="px-4 pb-3 pt-1 text-xs leading-relaxed text-dim">Your age, sex, height and weight give the calories your body uses at rest (Mifflin–St Jeor equation). Your activity level adds what you burn moving, and your weight goal and pace raise or lower it. Your protein target comes from your weight. Change any of these and your targets update from today; past days keep theirs.</p>
    </Group>
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


function AccountCard() {
  const session = useSession();
  const premiumActive = useStore((s) => isPremiumActive(s.premium));
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
      <SyncRow userId={session.user.id} />
      <PhoneRow saved={(session.user.user_metadata?.phone_number as string | undefined) ?? ''} />
      <button onClick={() => { if (confirm('Sign out? Your log is saved to your account and removed from this phone.')) signOut().catch((e) => alert((e as Error).message)); }} className="w-full"><Row icon={<LogOut size={18} />} label="Sign out" chevron /></button>
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
      <Row icon={<Crown size={18} />} label="Plan">
        <span className="text-sm font-semibold text-silver">{active ? `Plus${billing?.interval ? ` · ${billing.interval === 'annually' ? 'yearly' : billing.interval}` : ''}` : 'Free'}</span>
      </Row>
      {active && billing?.status === 'attention' && (
        <div role="alert" className="mx-4 my-2 rounded-2xl bg-warn/10 p-3.5 text-[14px] leading-relaxed">
          <p className="font-semibold text-warn">Your last payment didn’t go through</p>
          <p className="text-ink/80">Your plan stays on for a few days while you update your card. Nothing is lost if it lapses — you move to Free.</p>
          <button onClick={() => void manageSubscription()} className="mt-2 font-semibold text-accent">Update card</button>
        </div>
      )}
      {active && billing?.status === 'non-renewing' && (
        <p className="mx-4 my-2 rounded-2xl bg-raised p-3.5 text-[14px] text-silver">Cancelled — you keep your plan until the date below, then move to Free. You won’t be charged again.</p>
      )}
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
          <div className="mx-3 my-2 grid grid-cols-2 gap-2 text-[13px] leading-snug">
            <div className="rounded-2xl bg-raised p-3">
              <p className="font-bold">Free <span className="font-medium text-silver">· your plan</span></p>
              <ul className="mt-1.5 space-y-1 text-silver"><li>Diary, search, barcode, voice</li><li>Recipe imports, exercises</li><li>3 AI scans + 5 coach messages a day</li><li>2 AI recipes, 1 meal plan a month</li></ul>
            </div>
            <div className="rounded-2xl bg-accent/10 p-3">
              <p className="font-bold">Plus <span className="font-medium text-silver">· $8.99/mo</span></p>
              <ul className="mt-1.5 space-y-1 text-silver"><li>Unlimited AI scans &amp; follow-ups</li><li>300 AI credits for coach, recipes, plans</li><li>Coach talks back</li><li>AI meal plans, recipes, workouts</li><li>Weekly progress report</li></ul>
            </div>
          </div>
          <Link to="/premium" className="block"><Row icon={<CreditCard size={18} />} label="See Plus" chevron><span className="text-sm font-semibold text-accent">$8.99/mo or $44.99/yr</span></Row></Link>
          <Link to="/premium?restore=1" className="block"><Row icon={<RotateCcw size={18} />} label="Restore purchase" chevron /></Link>
        </>
      )}
      {note && <p className="px-4 pb-3 text-sm text-silver">{note}</p>}
      <p className="px-4 pb-3 pt-1 text-xs text-dim">Payments are processed securely by Paystack. We never see or store your full card number.</p>
    </Group>
  );
}

const DIET_LABEL: Record<string, string> = { all: 'Eats everything', pescatarian: 'Pescatarian', vegetarian: 'Vegetarian', vegan: 'Vegan' };
const ACTIVITY_LABEL: Record<string, string> = { sedentary: '0 workouts a week', light: '1–2 workouts a week', active: '3–5 workouts a week', athlete: '6+ workouts a week' };

/** Everything they picked in onboarding, visible and editable. */
function PreferencesCard({ onEdit }: { onEdit: () => void }) {
  const p = useStore((s) => s.profile);
  if (!p) return null;
  const rows: [string, string[], string?][] = [
    ['Exercise', [...(p.activity ? [ACTIVITY_LABEL[p.activity]] : []), ...(p.training ?? [])]],
    ['How you eat', [...(p.diet ? [DIET_LABEL[p.diet]] : []), ...(p.dietPrefs ?? [])]],
    ['Cuisines', p.cuisines ?? []],
    ['Avoids', p.avoid ?? [], 'danger'],
    ['Challenges', p.obstacles ?? []],
  ];
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-silver">How you eat and train</p>
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
        <p className="text-xs text-dim">Used for food suggestions, the coach, recipes, workouts and plans. Weight and other goals are in My goals.</p>
      </div>
    </section>
  );
}

/** Optional contact phone number on the account (sign-in stays by email or Google). */
function PhoneRow({ saved }: { saved: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(saved);
  const [current, setCurrent] = useState(saved);
  const [busy, setBusy] = useState(false);
  const tel = cleanPhone(value);
  const ok = !value.trim() || validPhone(tel);
  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="w-full">
        <Row icon={<Smartphone size={18} />} label="Phone number" chevron><span className="text-sm font-semibold text-silver">{current || 'Add'}</span></Row>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className="flex gap-2">
            <input type="tel" inputMode="tel" autoComplete="tel" aria-label="Phone number" className={cx('field flex-1', !ok && '!ring-2 !ring-danger')} placeholder="Phone number" value={value} onChange={(e) => setValue(e.target.value)} />
            <button disabled={busy || !ok} onClick={async () => {
              setBusy(true);
              try { const v = value.trim() ? tel : ''; await setPhoneNumber(v); setCurrent(v); setOpen(false); toast(v ? 'Phone number saved' : 'Phone number removed'); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
            }} className="btn-primary !px-5">Save</button>
          </div>
          {!ok && <p className="mt-1.5 px-1 text-[13px] text-danger">Add your country code with + at the start.</p>}
        </div>
      )}
    </>
  );
}

/** Tips and offers by email — only for signed-in people, off unless they turn it on. */
function MarketingRow() {
  const session = useSession();
  const [on, setOn] = useState<boolean>(session?.user.user_metadata?.marketing_opt_in !== false);
  if (!session) return null;
  return (
    <>
      <Row icon={<Mail size={18} />} label="Tips & offers by email">
        <Toggle on={on} onChange={(v) => { setOn(v); setMarketingOptIn(v).then(() => toast(v ? 'You’ll get tips and offers by email' : 'Unsubscribed from tips and offers'), (e: Error) => { setOn(!v); toast(e.message); }); }} label="Tips and offers by email" />
      </Row>
      <p className="px-4 pb-2 text-xs leading-relaxed text-dim">Occasional recipes, tips and offers from Nutivili AI. Account emails (like confirming your email) are always sent.</p>
    </>
  );
}

/** When this phone last matched the account, and a button to sync now. */
function SyncRow({ userId }: { userId: string }) {
  const online = useOnline();
  const pending = usePendingSync();
  const { syncing, failed, syncedAt } = useSyncStatus();
  const label = !online ? (pending ? 'Offline · will sync later' : 'Offline') : syncing ? 'Syncing…' : failed ? 'Not synced · tap to retry' : pending ? 'Changes waiting' : syncedAt ? `Synced ${new Date(syncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet';
  return (
    <button disabled={!online || syncing} onClick={() => void syncNow(userId).catch(() => undefined)} className="w-full">
      <Row icon={<RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />} label="Sync">
        <span className={`text-sm font-semibold ${failed || (!online && pending) ? 'text-danger' : 'text-silver'}`}>{label}</span>
      </Row>
    </button>
  );
}

/** True only for the owner account (server says admin). */
function useIsOwner(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => { void import('@/lib/premium').then((m) => m.fetchUsage()).then((u) => setAdmin(!!u?.admin)).catch(() => undefined); }, []);
  return admin;
}

/** Only the owner sees the link to their dashboard. */
function OwnerLink() {
  const admin = useIsOwner();
  if (!admin) return null;
  return (
    <Group title="Owner">
      <Link to="/owner" className="block"><Row icon={<Lightbulb size={18} />} label="Owner dashboard" chevron><span className="text-sm text-silver">Users, AI costs, revenue</span></Row></Link>
    </Group>
  );
}
