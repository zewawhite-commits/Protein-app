import { useState, type ReactNode } from 'react';
import { ArrowLeft, Bike, Dumbbell, Flame, HeartPulse, Leaf, Loader2, Mail, Scale, Sofa, Trophy, Fish, Salad, Utensils, Footprints } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { accountsEnabled, signInWithEmail, signInWithGoogle, useSession } from '@/lib/account';
import { GoogleIcon } from '@/components/BrandIcons';
import { suggestGramsPerKg, suggestionReason } from '@/lib/goals';
import { dailyGoal, fromKg, round1, toKg } from '@/lib/nutrition';
import type { ActivityLevel, Diet, FitnessGoal } from '@/lib/types';
import { Ring, Segmented, cx, fmt } from '@/components/ui';

type Option<T> = { value: T; label: string; sub: string; icon: typeof Dumbbell };

const GOALS: Option<FitnessGoal>[] = [
  { value: 'muscle', label: 'Build muscle', sub: 'Gain strength and size', icon: Dumbbell },
  { value: 'fatloss', label: 'Lose fat', sub: 'Keep muscle while leaning out', icon: Flame },
  { value: 'performance', label: 'Sports performance', sub: 'Train, recover, compete', icon: Trophy },
  { value: 'maintain', label: 'Maintain', sub: 'Stay where I am', icon: Scale },
  { value: 'health', label: 'Eat healthier', sub: 'Enough protein, every day', icon: HeartPulse },
];
const ACTIVITY: Option<ActivityLevel>[] = [
  { value: 'sedentary', label: 'Mostly sitting', sub: 'Little or no exercise', icon: Sofa },
  { value: 'light', label: 'Lightly active', sub: 'Exercise 1–3 days a week', icon: Footprints },
  { value: 'active', label: 'Active', sub: 'Train 3–5 days a week', icon: Bike },
  { value: 'athlete', label: 'Very active', sub: 'Hard training 6–7 days a week', icon: Trophy },
];
const DIETS: Option<Diet>[] = [
  { value: 'all', label: 'I eat everything', sub: 'Meat, fish, dairy, plants', icon: Utensils },
  { value: 'pescatarian', label: 'Pescatarian', sub: 'Fish, no meat', icon: Fish },
  { value: 'vegetarian', label: 'Vegetarian', sub: 'No meat or fish', icon: Salad },
  { value: 'vegan', label: 'Vegan', sub: 'Plants only', icon: Leaf },
];

const STEPS = 6;

export default function Onboarding() {
  const session = useSession();
  const saveProfile = useStore((s) => s.saveProfile);
  const unit = useStore((s) => s.settings.bodyUnit);
  const updateSettings = useStore((s) => s.updateSettings);

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<FitnessGoal>();
  const [activity, setActivity] = useState<ActivityLevel>();
  const [diet, setDiet] = useState<Diet>();
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [gPerKg, setGPerKg] = useState(1.6);

  const weightNum = Number(weight.replace(',', '.'));
  const weightKg = weightNum > 20 ? toKg(weightNum, unit) : null;
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  function pickActivity(a: ActivityLevel) {
    setActivity(a);
    setGPerKg(suggestGramsPerKg(goal ?? 'health', a));
    next();
  }

  function finish() {
    if (!weightKg) return;
    saveProfile({
      name: name.trim() || session?.user.user_metadata?.full_name?.split(' ')[0] || '',
      bodyWeightKg: round1(weightKg),
      goalMode: 'perKg',
      gramsPerKg: gPerKg,
      goalGrams: Math.round(weightKg * gPerKg),
      createdAt: Date.now(),
      goal,
      activity,
      diet,
    });
  }

  if (step === 0) return <Welcome signedIn={!!session} email={session?.user.email} onStart={next} />;

  const total = weightKg ? dailyGoal({ goalMode: 'perKg', gramsPerKg: gPerKg, bodyWeightKg: weightKg, goalGrams: 0 }) : 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8">
      <header className="pt-safe flex items-center gap-4 pb-6">
        <button onClick={back} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-ink transition-all duration-500" style={{ width: `${(step / (STEPS - 1)) * 100}%` }} />
        </div>
      </header>

      <div key={step} className="flex flex-1 animate-fade-up flex-col">
        {step === 1 && (
          <Question title="What’s your main goal?" sub="We’ll suggest a daily protein target for it.">
            {GOALS.map((o) => <Choice key={o.value} option={o} selected={goal === o.value} onClick={() => { setGoal(o.value); next(); }} />)}
          </Question>
        )}
        {step === 2 && (
          <Question title="How active are you?" sub="Training raises how much protein your body uses.">
            {ACTIVITY.map((o) => <Choice key={o.value} option={o} selected={activity === o.value} onClick={() => pickActivity(o.value)} />)}
          </Question>
        )}
        {step === 3 && (
          <Question title="How do you eat?" sub="We’ll tailor food suggestions. You can still log anything.">
            {DIETS.map((o) => <Choice key={o.value} option={o} selected={diet === o.value} onClick={() => { setDiet(o.value); next(); }} />)}
          </Question>
        )}
        {step === 4 && (
          <Question title="About you" sub="Your target is set per kilogram of body weight.">
            <label className="label mt-2" htmlFor="ob-name">First name</label>
            <input id="ob-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" autoComplete="given-name" />
            <div className="mt-5 flex items-center justify-between">
              <label className="label !mb-0" htmlFor="ob-weight">Body weight</label>
              <Segmented value={unit} onChange={(u) => { if (weightNum) setWeight(String(round1(fromKg(toKg(weightNum, unit), u)))); updateSettings({ bodyUnit: u }); }} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
            </div>
            <div className="relative mt-2">
              <input id="ob-weight" className="field !h-16 pr-14 text-2xl font-semibold" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={unit === 'kg' ? '75' : '165'} />
              <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-lg text-silver">{unit}</span>
            </div>
            <div className="flex-1" />
            <button onClick={next} disabled={!weightKg} className="btn-primary mt-8 w-full">Continue</button>
          </Question>
        )}
        {step === 5 && goal && activity && (
          <Question title="Your daily target" sub="Based on your answers. Adjust it any time in Profile.">
            <div className="card mt-2 flex flex-col items-center p-6 text-center">
              <Ring value={1} size={150} stroke={12} color="accent" track="raised">
                <div>
                  <p className="num text-[44px] font-extrabold leading-none">{fmt(total)}<span className="text-xl text-silver">g</span></p>
                  <p className="mt-1 text-xs font-medium text-silver">protein / day</p>
                </div>
              </Ring>
              <div className="mt-5 flex items-center gap-3">
                <button onClick={() => setGPerKg((v) => Math.max(0.8, round1(v - 0.1)))} className="grid h-10 w-10 place-items-center rounded-full bg-raised text-lg font-semibold" aria-label="Lower">−</button>
                <span className="num w-24 text-lg font-semibold">{gPerKg.toFixed(1)} g/kg</span>
                <button onClick={() => setGPerKg((v) => Math.min(2.5, round1(v + 0.1)))} className="grid h-10 w-10 place-items-center rounded-full bg-raised text-lg font-semibold" aria-label="Higher">+</button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-silver">{suggestionReason(goal, activity, suggestGramsPerKg(goal, activity))}</p>
            </div>
            <p className="mt-3 text-center text-xs text-dim">A starting point, not medical advice. Check with a health professional if you have a medical condition.</p>
            <div className="flex-1" />
            <button onClick={finish} className="btn-primary mt-8 w-full">Start tracking</button>
          </Question>
        )}
      </div>
    </div>
  );
}

function Question({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
      <p className="mt-1.5 text-[15px] text-silver">{sub}</p>
      <div className="mt-6 flex flex-1 flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Choice<T>({ option, selected, onClick }: { option: Option<T>; selected: boolean; onClick: () => void }) {
  const Icon = option.icon;
  return (
    <button
      onClick={onClick}
      className={cx('flex items-center gap-4 rounded-[22px] border-2 bg-surface p-4 text-left transition active:scale-[.99]', selected ? 'border-ink' : 'border-transparent')}
      style={{ boxShadow: 'var(--shadow)' }}
    >
      <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', selected ? 'bg-primary text-on-primary' : 'bg-raised')}><Icon size={22} /></span>
      <span>
        <span className="block font-semibold">{option.label}</span>
        <span className="block text-sm text-silver">{option.sub}</span>
      </span>
    </button>
  );
}

function Welcome({ signedIn, email, onStart }: { signedIn: boolean; email?: string; onStart: () => void }) {
  const [mode, setMode] = useState<'choose' | 'email' | 'sent'>('choose');
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setErr('');
    setBusy(true);
    try {
      await fn();
      after?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8">
      <div className="pt-safe mt-10 flex items-center gap-3 animate-fade-up">
        <Ring value={0.72} size={40} stroke={5} color="ink" track="line" />
        <span className="text-lg font-semibold tracking-tight">Protein</span>
      </div>
      <h1 className="mt-12 animate-fade-up text-[44px] font-extrabold leading-[1.02] tracking-tight">
        Weigh it.<br />Snap it.<br /><span className="text-accent">Hit your number.</span>
      </h1>
      <p className="mt-4 max-w-sm text-[15px] text-silver">Protein tracking by weight, with foods from around the world. Raw and cooked kept separate.</p>
      <div className="flex-1" />

      {err && <p className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{err}</p>}

      {signedIn ? (
        <>
          <p className="mb-3 text-center text-sm text-silver">Signed in as {email}</p>
          <button onClick={onStart} className="btn-primary w-full">Set up my goal</button>
        </>
      ) : !accountsEnabled ? (
        <>
          <button onClick={onStart} className="btn-primary w-full">Get started</button>
          <p className="mt-4 text-center text-xs text-silver">Your data stays on this device. Export a backup any time from Profile.</p>
        </>
      ) : mode === 'sent' ? (
        <div className="card p-5 text-center">
          <p className="font-semibold">Check your email</p>
          <p className="mt-1 text-sm text-silver">We sent a sign-in link to {addr}. Open it on this phone.</p>
          <button onClick={() => setMode('choose')} className="mt-4 text-sm font-semibold text-silver">Use another way</button>
        </div>
      ) : mode === 'email' ? (
        <div className="grid gap-2">
          <input type="email" inputMode="email" autoComplete="email" className="field" placeholder="you@example.com" value={addr} onChange={(e) => setAddr(e.target.value)} />
          <button disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)} onClick={() => run(() => signInWithEmail(addr.trim()), () => setMode('sent'))} className="btn-primary">
            {busy && <Loader2 size={18} className="animate-spin" />} Email me a sign-in link
          </button>
          <button onClick={() => setMode('choose')} className="mt-1 text-sm font-semibold text-silver">Back</button>
        </div>
      ) : (
        <div className="grid gap-2.5">
          <button disabled={busy} onClick={() => run(signInWithGoogle)} className="btn bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}>
            <GoogleIcon /> Continue with Google
          </button>
          <button onClick={() => setMode('email')} className="btn bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}>
            <Mail size={18} /> Continue with email
          </button>
          <button onClick={onStart} className="mt-1 h-11 text-sm font-semibold text-silver">Skip — use without an account</button>
          <p className="text-center text-xs text-dim">An account saves your data so you can use it on any phone.</p>
        </div>
      )}
    </div>
  );
}
