import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Check, Globe2, Loader2, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { activate, fetchPlans, formatPrice, intervalLabel, isPremiumActive, manageSubscription, startCheckout, type PlanInfo } from '@/lib/premium';
import { cx } from '@/components/ui';

const PERKS = [
  { icon: Camera, title: 'Snap any meal', body: 'AI identifies food from any cuisine in your photo.' },
  { icon: Sparkles, title: 'Portion estimate', body: 'A starting weight for each food, ready to confirm.' },
  { icon: ShieldCheck, title: 'Accurate numbers', body: 'Protein still comes only from USDA, FAO and product records.' },
  { icon: Globe2, title: 'Supports future features', body: 'Your plan keeps the app growing.' },
];

export default function Premium() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const premium = useStore((s) => s.premium);
  const active = isPremiumActive(premium);
  const [plans, setPlans] = useState<PlanInfo[] | null | undefined>(undefined);
  const [plan, setPlan] = useState<PlanInfo['id']>('yearly');
  const [email, setEmail] = useState(premium?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [ref, setRef] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    fetchPlans().then((p) => {
      setPlans(p);
      if (p && !p.some((x) => x.id === 'yearly')) setPlan(p[0].id);
    });
  }, []);

  // Back from Paystack checkout: /premium?reference=…
  useEffect(() => {
    const reference = params.get('reference') ?? params.get('trxref');
    if (!reference || handled.current) return;
    handled.current = true;
    setBusy(true);
    activate({ reference })
      .then(() => setMsg({ tone: 'ok', text: 'Welcome to Premium! Photo recognition is now on.' }))
      .catch((e: Error) => setMsg({ tone: 'err', text: e.message }))
      .finally(() => {
        setBusy(false);
        setParams({}, { replace: true });
      });
  }, [params, setParams]);

  async function pay() {
    setMsg(null);
    setBusy(true);
    try {
      await startCheckout(email.trim(), plan);
    } catch (e) {
      setMsg({ tone: 'err', text: (e as Error).message });
      setBusy(false);
    }
  }

  async function restore() {
    setMsg(null);
    setBusy(true);
    try {
      await activate({ reference: ref.trim(), email: email.trim() });
      setMsg({ tone: 'ok', text: 'Premium restored on this device.' });
      setRestoring(false);
    } catch (e) {
      setMsg({ tone: 'err', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const yearly = plans?.find((p) => p.id === 'yearly');
  const monthly = plans?.find((p) => p.id === 'monthly');
  const saving = yearly && monthly && monthly.currency === yearly.currency ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100) : 0;

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-12">
      <header className="pt-safe pb-4">
        <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
      </header>

      <div className="relative overflow-hidden rounded-[32px] bg-primary p-6 text-on-primary">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-accent/50 blur-3xl" />
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-on-primary/10 px-3 py-1 text-xs font-semibold"><Sparkles size={13} className="text-accent" /> Protein Premium</span>
        <h1 className="relative mt-4 text-[30px] font-bold leading-[1.08] tracking-tight">Snap it.<br />We’ll find it.</h1>
        <p className="relative mt-2 text-sm opacity-70">Photo recognition for every meal, from anywhere in the world.</p>
      </div>

      {msg && (
        <p className={cx('mt-4 rounded-2xl px-4 py-3 text-sm font-medium', msg.tone === 'ok' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger')}>{msg.text}</p>
      )}

      {active ? (
        <div className="card mt-5 p-5">
          <p className="flex items-center gap-2 font-semibold"><Check size={18} className="text-accent" strokeWidth={3} /> You’re Premium</p>
          <p className="mt-1 text-sm text-silver">
            {premium!.email} · renews or ends around {new Date(premium!.exp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <div className="mt-4 grid gap-2">
            <Link to="/snap" className="btn-primary"><Camera size={18} /> Snap a meal</Link>
            <button onClick={() => manageSubscription().catch((e: Error) => setMsg({ tone: 'err', text: e.message }))} className="btn-ghost">Manage or cancel subscription</button>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {PERKS.map((p) => (
              <li key={p.title} className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }}><p.icon size={18} /></span>
                <span>
                  <span className="block font-semibold">{p.title}</span>
                  <span className="block text-sm text-silver">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>

          {plans === undefined && <p className="mt-8 flex items-center justify-center gap-2 text-sm text-silver"><Loader2 size={16} className="animate-spin" /> Loading plans…</p>}

          {plans === null && (
            <div className="card mt-6 p-5 text-sm text-silver">
              <p className="font-semibold text-ink">Premium isn’t available here yet</p>
              <p className="mt-1">Subscriptions open once the app is set up with payments. You can still use your own AI key in Profile → Photo recognition, or log food manually for free.</p>
            </div>
          )}

          {plans && (
            <>
              <div className="mt-6 grid gap-2.5">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlan(p.id)}
                    className={cx('flex items-center justify-between rounded-[22px] border-2 bg-surface p-4 text-left transition', plan === p.id ? 'border-ink' : 'border-transparent')}
                    style={{ boxShadow: 'var(--shadow)' }}
                  >
                    <span>
                      <span className="flex items-center gap-2 font-semibold capitalize">
                        {p.id}
                        {p.id === 'yearly' && saving > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">Save {saving}%</span>}
                      </span>
                      <span className="text-xs text-silver">{p.name}</span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-xl font-bold">{formatPrice(p)}</span>
                      <span className="text-xs text-silver">per {intervalLabel(p.interval)}</span>
                    </span>
                  </button>
                ))}
              </div>

              <label className="label mt-5" htmlFor="pm-email">Email for your receipt</label>
              <input id="pm-email" type="email" inputMode="email" autoComplete="email" className="field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

              {!restoring ? (
                <>
                  <button onClick={pay} disabled={!validEmail || busy} className="btn-primary mt-4 w-full">
                    {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />} Continue to secure payment
                  </button>
                  <p className="mt-3 text-center text-xs text-silver">Pay with card, bank transfer or USSD via Paystack. Cancel any time.</p>
                  <button onClick={() => setRestoring(true)} className="mt-4 w-full text-center text-sm font-semibold text-silver">Already subscribed? Restore</button>
                </>
              ) : (
                <div className="mt-4">
                  <label className="label" htmlFor="pm-ref">Payment reference</label>
                  <input id="pm-ref" className="field" placeholder="From your Paystack receipt email" value={ref} onChange={(e) => setRef(e.target.value)} />
                  <button onClick={restore} disabled={!validEmail || ref.trim().length < 4 || busy} className="btn-primary mt-3 w-full">
                    {busy && <Loader2 size={18} className="animate-spin" />} Restore Premium
                  </button>
                  <button onClick={() => setRestoring(false)} className="mt-3 w-full text-center text-sm font-semibold text-silver">Back to plans</button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
