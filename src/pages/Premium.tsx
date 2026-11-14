import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Check, Loader2, Lock, Mail, MessageCircle, NotebookPen } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { accountsEnabled, signInWithEmail, signInWithGoogle, useSession } from '@/lib/account';
import { GoogleIcon } from '@/components/BrandIcons';
import {
  activate, chargedInOtherCurrency, displayPrice, fetchPlans, formatPrice, USD_PRICES, intervalLabel, isPremiumActive, manageSubscription, restoreForAccount, startCheckout,
  type PlanInfo, type Tier,
} from '@/lib/premium';
import { Segmented, cx } from '@/components/ui';

/** Planned prices, shown until live plans load from the payment provider (which sets the real charge). */
const PREVIEW = [
  { name: 'Free', perks: ['Calories, macros & 13,000+ foods', 'Groups, progress & weight', '3 AI scans a month'], year: '$0', month: '', perMonth: '' },
  { name: 'Plus', perks: ['60 AI scans a month', 'AI coach & eating plans'], year: '$29.99/yr', month: '$4.99/mo', perMonth: '≈ $2.50/mo', best: true },
  { name: 'Pro', perks: ['200 AI scans a month', 'Everything in Plus'], year: '$47.99/yr', month: '$7.99/mo', perMonth: '≈ $4.00/mo' },
];

const TIER_INFO: Record<'free' | Tier, { name: string; perks: string[] }> = {
  free: { name: 'Free', perks: ['13,000+ foods, calories & macros', 'Groups, progress & weight tracking', '3 AI photo scans a month'] },
  plus: { name: 'Plus', perks: ['60 AI photo scans a month', 'AI coach chat & eating plans', 'AI meal ideas'] },
  pro: { name: 'Pro', perks: ['200 AI photo scans a month', 'Everything in Plus', 'Best for logging every meal'] },
};

type Billing = 'monthly' | 'yearly';

export default function Premium() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const session = useSession();
  const premium = useStore((s) => s.premium);
  const active = isPremiumActive(premium);
  const [catalog, setCatalog] = useState<{ plans: PlanInfo[]; accountRequired: boolean } | null | undefined>(undefined);
  const [billing, setBilling] = useState<Billing>('yearly');
  const [tier, setTier] = useState<Tier>('plus');
  const [email, setEmail] = useState(premium?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [ref, setRef] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    fetchPlans().then(setCatalog);
  }, []);
  useEffect(() => {
    if (session?.user.email && !email) setEmail(session.user.email);
  }, [session, email]);

  // Back from Paystack checkout: /premium?reference=…
  useEffect(() => {
    const reference = params.get('reference') ?? params.get('trxref');
    if (!reference || handled.current) return;
    handled.current = true;
    setBusy(true);
    activate({ reference })
      .then((p) => setMsg({ tone: 'ok', text: `Welcome to ${p.tier === 'pro' ? 'Pro' : 'Plus'}! Photo recognition is now on.` }))
      .catch((e: Error) => setMsg({ tone: 'err', text: e.message }))
      .finally(() => {
        setBusy(false);
        setParams({}, { replace: true });
      });
  }, [params, setParams]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      if (ok) setMsg({ tone: 'ok', text: ok });
    } catch (e) {
      setMsg({ tone: 'err', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const plans = catalog?.plans ?? [];
  const planFor = (t: Tier, b: Billing) => plans.find((p) => p.tier === t && p.id.endsWith(b));
  const hasYearly = plans.some((p) => p.id.endsWith('yearly'));
  const billingNow: Billing = hasYearly && plans.some((p) => p.id.endsWith('monthly')) ? billing : hasYearly ? 'yearly' : 'monthly';
  const chosen = planFor(tier, billingNow);
  const needsAccount = !!catalog?.accountRequired && !session;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 md:max-w-2xl md:px-8 pb-12">
      <header className="pt-safe pb-4">
        <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
      </header>

      <div className="text-center">
        <div className="mx-auto flex w-fit -space-x-3">
          {[Camera, NotebookPen, MessageCircle].map((Icon, i) => (
            <span key={i} className="grid h-16 w-16 place-items-center rounded-full bg-primary text-on-primary ring-4 ring-bg"><Icon size={26} strokeWidth={2} /></span>
          ))}
        </div>
        <h1 className="mt-5 text-[32px] font-extrabold leading-[1.1] tracking-tight">Reach your goal faster</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-silver">Snap any meal, chat with your AI coach and get eating plans built for you. Nutrition numbers always come from real food records.</p>
      </div>

      {msg && <p className={cx('mt-4 rounded-2xl px-4 py-3 text-sm font-medium', msg.tone === 'ok' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger')}>{msg.text}</p>}

      {active ? (
        <div className="card mt-5 p-5">
          <p className="flex items-center gap-2 font-semibold"><Check size={18} className="text-accent" strokeWidth={3} /> You’re on {premium!.tier === 'pro' ? 'Pro' : 'Plus'}</p>
          <p className="mt-1 text-sm text-silver">
            {premium!.email} · renews or ends around {new Date(premium!.exp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            {premium!.scanLimit && <> · {premium!.scanLimit} photo scans a month</>}
          </p>
          <div className="mt-4 grid gap-2">
            <Link to="/snap" className="btn-primary"><Camera size={18} /> Snap a meal</Link>
            <button onClick={() => run(manageSubscription)} className="btn-ghost">Manage, change or cancel</button>
          </div>
        </div>
      ) : catalog === undefined ? (
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-silver"><Loader2 size={16} className="animate-spin" /> Loading plans…</p>
      ) : catalog === null ? (
        <div className="mt-6">
          <div className="grid gap-2.5">
            {PREVIEW.map((t) => (
              <div key={t.name} className={cx('card p-5', t.best && 'ring-2 ring-ink')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-[18px] font-extrabold">{t.name}{t.best && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-on-primary">Most popular</span>}</p>
                    <ul className="mt-2 space-y-1 text-sm text-silver">{t.perks.map((x) => <li key={x} className="flex items-center gap-2"><Check size={15} className="text-accent" strokeWidth={3} />{x}</li>)}</ul>
                  </div>
                  <div className="text-right">
                    <p className="num text-[22px] font-extrabold">{t.year}</p>
                    {t.month && <p className="num text-sm text-silver">{t.perMonth} · or {t.month}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-2xl bg-raised p-4 text-center text-sm text-silver">Subscriptions open soon. Everything in Free works now.</p>
        </div>
      ) : (
        <>
          {hasYearly && plans.some((p) => p.id.endsWith('monthly')) && (
            <div className="mt-6 flex justify-center">
              <Segmented<Billing> value={billing} onChange={setBilling} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} />
            </div>
          )}

          <div className="mt-4 grid gap-2.5">
            <TierCard tier="free" selected={false} price="Free" sub="forever" />
            {(['plus', 'pro'] as Tier[]).map((t) => {
              const p = planFor(t, billingNow);
              if (!p) return null;
              const monthly = planFor(t, 'monthly');
              const amt = (x: PlanInfo) => USD_PRICES[x.id] ?? x.amount;
              const save = billingNow === 'yearly' && monthly ? Math.round((1 - amt(p) / (amt(monthly) * 12)) * 100) : 0;
              return (
                <TierCard
                  key={t}
                  tier={t}
                  selected={tier === t}
                  onClick={() => setTier(t)}
                  price={displayPrice(p)}
                  sub={`per ${intervalLabel(p.interval)}`}
                  badge={save > 0 ? `Save ${save}%` : t === 'pro' ? 'Most scans' : undefined}
                  scans={p.scans}
                />
              );
            })}
          </div>

          {needsAccount ? (
            <div className="mt-6">
              <p className="mb-3 text-center text-sm text-silver">Create a free account to subscribe — your plan follows you to any phone.</p>
              <div className="grid gap-2.5">
                <button disabled={busy} onClick={() => run(signInWithGoogle)} className="btn bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}><GoogleIcon /> Continue with Google</button>
                <div className="flex gap-2">
                  <input type="email" inputMode="email" className="field flex-1" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button disabled={busy || !validEmail} onClick={() => run(() => signInWithEmail(email.trim()), 'Check your email for a sign-in link.')} className="btn-ghost !h-14 !px-4"><Mail size={18} /></button>
                </div>
              </div>
            </div>
          ) : !restoring ? (
            <>
              {(!accountsEnabled || (session && !session.user.email)) && (
                <>
                  <label className="label mt-6" htmlFor="pm-email">Email for your receipt</label>
                  <input id="pm-email" type="email" inputMode="email" autoComplete="email" className="field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </>
              )}
              <button onClick={() => chosen && run(() => startCheckout(email.trim(), chosen.id))} disabled={!chosen || ((!session || !session.user.email) && !validEmail) || busy} className="btn-primary mt-5 w-full">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />} Get {TIER_INFO[tier].name}{chosen ? ` · ${displayPrice(chosen)}` : ''}
              </button>
              <p className="mt-3 text-center text-xs text-silver">Secure payment by Paystack · cancel any time{chargedInOtherCurrency(chosen) && <><br />Charged as {formatPrice(chosen!)}; your bank converts it to your currency.</>}</p>
              <button onClick={() => (session ? run(restoreForAccount, 'Your plan is restored on this phone.') : setRestoring(true))} className="mt-4 w-full text-center text-sm font-semibold text-silver">
                Already subscribed? Restore
              </button>
            </>
          ) : (
            <div className="mt-6">
              <label className="label" htmlFor="pm-email2">Email you paid with</label>
              <input id="pm-email2" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label className="label mt-3" htmlFor="pm-ref">Payment reference</label>
              <input id="pm-ref" className="field" placeholder="From your Paystack receipt email" value={ref} onChange={(e) => setRef(e.target.value)} />
              <button onClick={() => run(async () => { await activate({ reference: ref.trim(), email: email.trim() }); setRestoring(false); }, 'Your plan is restored on this phone.')} disabled={!validEmail || ref.trim().length < 4 || busy} className="btn-primary mt-3 w-full">
                {busy && <Loader2 size={18} className="animate-spin" />} Restore
              </button>
              <button onClick={() => setRestoring(false)} className="mt-3 w-full text-center text-sm font-semibold text-silver">Back to plans</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TierCard({ tier, selected, onClick, price, sub, badge, scans }: { tier: 'free' | Tier; selected: boolean; onClick?: () => void; price: string; sub: string; badge?: string; scans?: number }) {
  const info = TIER_INFO[tier];
  const perks = scans ? info.perks.map((p) => (p === 'AI photo recognition' ? `${scans} AI photo scans a month` : p === '4× more photo scans' ? `${scans} AI photo scans a month` : p)) : info.perks;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cx('rounded-[24px] border-2 bg-surface p-4 text-left transition', selected ? 'border-ink' : 'border-transparent', !onClick && 'opacity-80')}
      style={{ boxShadow: 'var(--shadow)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-lg font-semibold">
          {info.name}
          {badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-white">{badge}</span>}
        </span>
        <span className="text-right">
          <span className="num block text-xl font-bold">{price}</span>
          <span className="text-xs text-silver">{sub}</span>
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {perks.map((p) => (
          <li key={p} className="flex items-center gap-2 text-sm text-silver"><Check size={14} className={tier === 'free' ? 'text-dim' : 'text-accent'} strokeWidth={3} /> {p}</li>
        ))}
      </ul>
    </button>
  );
}
