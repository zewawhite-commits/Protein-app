import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Bike, Dumbbell, Flame, HeartPulse, Leaf, Loader2, Mail, Phone, Scale, Sofa, Trophy, Fish, Salad, Utensils, Footprints } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { accountsEnabled, sendPhoneCode, signInWithEmail, signInWithGoogle, toE164, useSession, verifyPhoneCode } from '@/lib/account';
import { DIAL_CODES } from '@/lib/dialCodes';
import { COUNTRY_DATA } from '@/lib/countries';
import { GoogleIcon } from '@/components/BrandIcons';
import { primaryGoal, suggestGramsPerKg, suggestionReason } from '@/lib/goals';
import { COUNTRIES } from '@/lib/countries';
import { AVOIDS, CUISINES } from '@/lib/cuisines';
import { dailyGoal, fromKg, round1, toKg } from '@/lib/nutrition';
import { dailyTargets } from '@/lib/energy';
import type { ActivityLevel, Diet, FitnessGoal } from '@/lib/types';
import { Ring, Segmented, cx, fmt } from '@/components/ui';
import { CountUp, haptic } from '@/components/fx';

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

const STEPS = 7;

export default function Onboarding() {
  const session = useSession();
  const saveProfile = useStore((s) => s.saveProfile);
  const unit = useStore((s) => s.settings.bodyUnit);
  const updateSettings = useStore((s) => s.updateSettings);

  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [activity, setActivity] = useState<ActivityLevel>();
  const [diet, setDiet] = useState<Diet>();
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'female' | 'male' | 'unspecified'>('unspecified');
  const [pregnant, setPregnant] = useState(false);
  const [country, setCountry] = useState('');
  const [weight, setWeight] = useState('');
  const [gPerKg, setGPerKg] = useState(1.6);

  const weightNum = Number(weight.replace(',', '.'));
  const [minW, maxW] = unit === 'kg' ? [25, 300] : [55, 660];
  const weightOk = weightNum >= minW && weightNum <= maxW;
  const weightKg = weightOk ? toKg(weightNum, unit) : null;
  const weightError = weight && !weightOk ? `Enter a weight between ${minW} and ${maxW} ${unit}.` : '';
  // Height: cm, or feet + inches when the user weighs in pounds.
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const heightNum = unit === 'kg' ? Number(heightCm) : (Number(heightFt) * 12 + Number(heightIn || 0)) * 2.54;
  const heightOk = heightNum >= 100 && heightNum <= 250;
  const heightTyped = unit === 'kg' ? !!heightCm : !!heightFt;
  const heightError = heightTyped && !heightOk ? (unit === 'kg' ? 'Enter a height between 100 and 250 cm.' : 'Enter a height between 3 ft 4 in and 8 ft 2 in.') : '';
  const ageNum = Number(age);
  const ageOk = !age || (ageNum >= 13 && ageNum <= 110);
  const person = { age: ageNum || undefined, pregnant: sex === 'female' && pregnant };
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  function pickActivity(a: ActivityLevel) {
    setActivity(a);
    setGPerKg(suggestGramsPerKg(primaryGoal(goals.length ? goals : ['health'], a), a, person));
    next();
  }

  // The goal that sets the target (the one needing the most protein).
  const goal: FitnessGoal | undefined = goals.length ? primaryGoal(goals, activity ?? 'active') : undefined;

  const toggleGoal = (g: FitnessGoal) => setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  function finish() {
    if (!ageOk) return;
    if (!weightKg) return;
    saveProfile({
      name: name.trim() || session?.user.user_metadata?.full_name?.split(' ')[0] || '',
      bodyWeightKg: round1(weightKg),
      goalMode: 'perKg',
      gramsPerKg: gPerKg,
      goalGrams: Math.round(weightKg * gPerKg),
      createdAt: Date.now(),
      goal,
      goals,
      age: ageNum || undefined,
      sex,
      pregnant: sex === 'female' && pregnant ? true : undefined,
      country: country || undefined,
      activity,
      diet,
      heightCm: heightOk ? Math.round(heightNum) : undefined,
      cuisines: cuisines.length ? cuisines : undefined,
      avoid: avoid.length ? avoid : undefined,
      calorieMode: 'auto',
    });
  }

  if (step === 0) return <Welcome signedIn={!!session} email={session?.user.email} onStart={next} />;

  const total = weightKg ? dailyGoal({ goalMode: 'perKg', gramsPerKg: gPerKg, bodyWeightKg: weightKg, goalGrams: 0 }) : 0;
  const targets = weightKg
    ? dailyTargets({ name: '', goalMode: 'perKg', goalGrams: 0, gramsPerKg: gPerKg, createdAt: 0, bodyWeightKg: weightKg, heightCm: heightOk ? heightNum : undefined, age: ageNum || undefined, sex, pregnant: sex === 'female' && pregnant, goals, activity }, total)
    : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 md:max-w-xl pb-8">
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
          <Question title="What are your goals?" sub="Pick all that apply. We’ll set your calorie and protein targets.">
            {GOALS.map((o) => <Choice key={o.value} option={o} multi selected={goals.includes(o.value)} onClick={() => toggleGoal(o.value)} />)}
            <div className="flex-1" />
            <button onClick={next} disabled={!goals.length} className="btn-primary mt-6 w-full">
              Continue{goals.length > 1 ? ` · ${goals.length} goals` : ''}
            </button>
          </Question>
        )}
        {step === 2 && (
          <Question title="How active are you?" sub="Activity changes how much energy and protein your body uses.">
            {ACTIVITY.map((o) => <Choice key={o.value} option={o} selected={activity === o.value} onClick={() => pickActivity(o.value)} />)}
          </Question>
        )}
        {step === 3 && (
          <Question title="How do you eat?" sub="We’ll tailor food suggestions. You can still log anything.">
            {DIETS.map((o) => <Choice key={o.value} option={o} selected={diet === o.value} onClick={() => { setDiet(o.value); next(); }} />)}
          </Question>
        )}
        {step === 4 && (
          <Question title="What do you like to eat?" sub="Pick every cuisine you enjoy — we’ll mix ideas from all of them.">
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => (
                <button key={c} onClick={() => { haptic(); setCuisines((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])); }} className={cx('chip !h-11', cuisines.includes(c) && 'chip-on')}>
                  {cuisines.includes(c) && <Check size={15} strokeWidth={3} />}{c}
                </button>
              ))}
            </div>
            <p className="label mt-6">Allergies or foods you avoid</p>
            <div className="flex flex-wrap gap-2">
              {AVOIDS.map((c) => (
                <button key={c} onClick={() => { haptic(); setAvoid((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])); }} className={cx('chip !h-11', avoid.includes(c) && '!bg-danger/15 !text-danger')}>
                  {avoid.includes(c) && <Check size={15} strokeWidth={3} />}{c}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button onClick={next} className="btn-primary mt-6 w-full">{cuisines.length ? `Continue · ${cuisines.length} picked` : 'Skip for now'}</button>
          </Question>
        )}
        {step === 5 && (
          <Question title="About you" sub="This helps us set the right target for you.">
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <div>
                <label className="label mt-2" htmlFor="ob-name">First name</label>
                <input id="ob-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" autoComplete="given-name" />
              </div>
              <div>
                <label className="label mt-2" htmlFor="ob-age">Age</label>
                <input id="ob-age" className={cx('field text-center', !ageOk && '!ring-2 !ring-danger')} inputMode="numeric" maxLength={3} value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="—" />
              </div>
            </div>
            {!ageOk && <p className="mt-1 text-sm text-danger">Enter an age between 13 and 110.</p>}

            <span className="label mt-5">Sex</span>
            <Segmented full value={sex} onChange={(v) => { haptic(); setSex(v); }} options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'unspecified', label: 'Prefer not to say' }]} />
            {sex === 'female' && (
              <label className="mt-3 flex items-center gap-3 rounded-2xl bg-surface p-3 text-sm" style={{ boxShadow: 'var(--shadow)' }}>
                <input type="checkbox" checked={pregnant} onChange={(e) => setPregnant(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent))]" />
                Pregnant or breastfeeding
              </label>
            )}

            <label className="label mt-5" htmlFor="ob-country">Where do you live?</label>
            <select id="ob-country" className="field" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Choose a country (optional)</option>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <p className="mt-1 text-xs text-silver">We’ll suggest foods people actually eat where you live.</p>
            <div className="mt-5 flex items-center justify-between">
              <label className="label !mb-0 mt-5" htmlFor="ob-weight">Body weight</label>
              <Segmented value={unit} onChange={(u) => { if (weightNum) setWeight(String(round1(fromKg(toKg(weightNum, unit), u)))); updateSettings({ bodyUnit: u }); }} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
            </div>
            <div className="relative mt-2">
              <input id="ob-weight" className={cx('field !h-16 pr-14 text-2xl font-semibold', weightError && '!ring-2 !ring-danger')} inputMode="decimal" maxLength={5} value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={unit === 'kg' ? '75' : '165'} aria-invalid={!!weightError} aria-describedby="ob-weight-err" />
              <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-lg text-silver">{unit}</span>
            </div>
            <p id="ob-weight-err" className="mt-2 min-h-5 text-sm text-danger">{weightError}</p>
            <label className="label mt-1" htmlFor="ob-height">Height</label>
            {unit === 'kg' ? (
              <div className="relative">
                <input id="ob-height" className={cx('field !h-14 pr-14 text-xl font-semibold', heightError && '!ring-2 !ring-danger')} inputMode="numeric" maxLength={3} value={heightCm} onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, ''))} placeholder="175" />
                <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-lg text-silver">cm</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input id="ob-height" className={cx('field !h-14 pr-12 text-xl font-semibold', heightError && '!ring-2 !ring-danger')} inputMode="numeric" maxLength={1} value={heightFt} onChange={(e) => setHeightFt(e.target.value.replace(/\D/g, ''))} placeholder="5" aria-label="Feet" />
                  <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-lg text-silver">ft</span>
                </div>
                <div className="relative">
                  <input className="field !h-14 pr-12 text-xl font-semibold" inputMode="numeric" maxLength={2} value={heightIn} onChange={(e) => setHeightIn(e.target.value.replace(/\D/g, ''))} placeholder="9" aria-label="Inches" />
                  <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-lg text-silver">in</span>
                </div>
              </div>
            )}
            <p className="mt-1 min-h-5 text-sm">{heightError ? <span className="text-danger">{heightError}</span> : <span className="text-xs text-silver">With age and weight, this sets your calorie target. Optional.</span>}</p>
            <div className="flex-1" />
            <button onClick={() => { setGPerKg(suggestGramsPerKg(primaryGoal(goals.length ? goals : ['health'], activity ?? 'active'), activity ?? 'active', person)); next(); }} disabled={!weightKg || !ageOk || !!heightError} className="btn-primary mt-6 w-full">Continue</button>
          </Question>
        )}
        {step === 6 && goal && activity && (
          <Question title="Your daily target" sub="Based on your answers. Adjust it any time in Profile.">
            <div className="card mt-2 flex flex-col items-center p-6 text-center">
              <AnimatedRing>
                <div>
                  <p className={cx('num font-extrabold leading-none', fmt(total).length > 3 ? 'text-[30px]' : 'text-[40px]')}>
                    <CountUp value={total} /><span className="text-lg text-silver">g</span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-silver">protein / day</p>
                </div>
              </AnimatedRing>
              <div className="mt-5 flex w-full items-center gap-3">
                <button onClick={() => { haptic(); setGPerKg((v) => Math.max(0.8, round1(v - 0.1))); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-lg font-semibold transition active:scale-90" aria-label="Lower">−</button>
                <input
                  type="range" min={0.8} max={2.5} step={0.1} value={gPerKg}
                  onChange={(e) => { setGPerKg(Number(e.target.value)); haptic(5); }}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-raised accent-[rgb(var(--accent))]"
                  aria-label="Grams of protein per kilogram"
                />
                <button onClick={() => { haptic(); setGPerKg((v) => Math.min(2.5, round1(v + 0.1))); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-lg font-semibold transition active:scale-90" aria-label="Higher">+</button>
              </div>
              <p className="num mt-2 text-sm font-semibold">{gPerKg.toFixed(1)} g per kg of body weight</p>
              <p className="mt-4 text-sm leading-relaxed text-silver">{suggestionReason(goal, activity, suggestGramsPerKg(goal, activity, person), person)}</p>
            </div>
            {targets ? (
              <div className="card mt-3 p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">Full day</p>
                  <p className="num text-sm"><span className="text-lg font-bold"><CountUp value={targets.kcal} /></span> <span className="text-silver">kcal</span></p>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {([['Protein', targets.protein, 'bg-accent'], ['Carbs', targets.carbs, 'bg-[rgb(var(--carbs))]'], ['Fat', targets.fat, 'bg-[rgb(var(--fat))]'], ['Fibre', targets.fiber, 'bg-silver']] as const).map(([l, v, c]) => (
                    <div key={l} className="rounded-2xl bg-raised px-1 py-2">
                      <span className={cx('mx-auto mb-1 block h-1.5 w-6 rounded-full', c)} />
                      <p className="num text-[15px] font-bold">{fmt(v)}g</p>
                      <p className="text-[12px] text-silver">{l}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[12px] leading-snug text-dim">Calories estimated with the Mifflin–St Jeor equation{goals.includes('fatloss') && !(sex === 'female' && pregnant) ? ', about 20% below maintenance for fat loss' : goals.includes('muscle') ? ', about 10% above maintenance for muscle gain' : ''}.</p>
              </div>
            ) : (
              <p className="mt-3 rounded-2xl bg-raised p-3 text-center text-xs text-silver">Add your height and age to also get calorie, carb and fat targets.</p>
            )}
            <p className="mt-3 text-center text-xs text-dim">A starting point, not medical advice. Check with a health professional if you have a medical condition.</p>
            <div className="flex-1" />
            <button onClick={() => { haptic([10, 40, 10]); finish(); }} className="btn-primary mt-8 w-full">Start tracking</button>
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

function Choice<T>({ option, selected, onClick, multi }: { option: Option<T>; selected: boolean; onClick: () => void; multi?: boolean }) {
  const Icon = option.icon;
  return (
    <button
      onClick={() => { haptic(); onClick(); }}
      className={cx('flex items-center gap-4 rounded-[22px] border-2 bg-surface p-4 text-left transition active:scale-[.98]', selected ? 'border-ink' : 'border-transparent')}
      style={{ boxShadow: 'var(--shadow)' }}
    >
      <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', selected ? 'bg-primary text-on-primary' : 'bg-raised')}><Icon size={22} /></span>
      <span className="flex-1">
        <span className="block font-semibold">{option.label}</span>
        <span className="block text-sm text-silver">{option.sub}</span>
      </span>
      {multi && (
        <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-md border-2', selected ? 'border-ink bg-ink text-bg' : 'border-line')}>
          {selected && <Check size={15} strokeWidth={3} />}
        </span>
      )}
    </button>
  );
}

function Welcome({ signedIn, email, onStart }: { signedIn: boolean; email?: string; onStart: () => void }) {
  const [mode, setMode] = useState<'choose' | 'email' | 'sent' | 'phone' | 'code'>('choose');
  // Default to the phone's region (e.g. en-GB → United Kingdom), else the United Kingdom.
  const [dialLabel, setDialLabel] = useState(() => {
    const region = (navigator.language.split('-')[1] ?? '').toUpperCase();
    const i = COUNTRY_DATA.findIndex(([iso]) => iso === region);
    return DIAL_CODES[i >= 0 ? i : COUNTRY_DATA.findIndex(([iso]) => iso === 'GB')][0];
  });
  const dial = DIAL_CODES.find(([l]) => l === dialLabel)?.[1] ?? '+44';
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const fullPhone = toE164(dial, phone);
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
    <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col px-5 md:max-w-xl pb-8">
      <div className="pt-safe mt-10 flex items-center gap-3 animate-fade-up">
        <Ring value={0.72} size={40} stroke={5} color="ink" track="line" />
        <span className="text-lg font-semibold tracking-tight">Provora</span>
      </div>
      <h1 className="mt-12 animate-fade-up text-[44px] font-extrabold leading-[1.02] tracking-tight">
        Weigh it.<br />Snap it.<br /><span className="text-accent">Hit your number.</span>
      </h1>
      <p className="mt-4 max-w-sm text-[15px] text-silver">Calories, protein, carbs, vitamins — tracked by weight, with foods from around the world. Raw and cooked kept separate.</p>
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
      ) : mode === 'phone' ? (
        <div className="grid gap-2">
          <div className="flex gap-2">
            <select value={dialLabel} onChange={(e) => setDialLabel(e.target.value)} className="field !w-28 shrink-0 !px-2 text-sm" aria-label="Country code">
              {DIAL_CODES.map(([label, c]) => <option key={label} value={label}>{label} {c}</option>)}
            </select>
            <input type="tel" inputMode="tel" autoComplete="tel-national" className="field flex-1" placeholder="801 234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button disabled={busy || fullPhone.replace(/\D/g, '').length < 8} onClick={() => run(() => sendPhoneCode(fullPhone), () => setMode('code'))} className="btn-primary">
            {busy && <Loader2 size={18} className="animate-spin" />} Text me a code
          </button>
          <p className="text-center text-xs text-dim">We’ll send a 6-digit code to {fullPhone}. Standard SMS rates may apply.</p>
          <button onClick={() => setMode('choose')} className="text-sm font-semibold text-silver">Back</button>
        </div>
      ) : mode === 'code' ? (
        <div className="grid gap-2">
          <p className="text-center text-sm text-silver">Enter the code sent to {fullPhone}</p>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="field text-center text-2xl font-semibold tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
          <button disabled={busy || code.length < 6} onClick={() => run(() => verifyPhoneCode(fullPhone, code))} className="btn-primary">
            {busy && <Loader2 size={18} className="animate-spin" />} Verify
          </button>
          <button onClick={() => run(() => sendPhoneCode(fullPhone))} className="text-sm font-semibold text-silver">Send a new code</button>
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
          <button onClick={() => setMode('phone')} className="btn bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}>
            <Phone size={18} /> Continue with phone
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

/** Ring that fills up when the screen appears. */
function AnimatedRing({ children }: { children: ReactNode }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(1), 80);
    return () => clearTimeout(t);
  }, []);
  return <Ring value={v} size={160} stroke={12} color="accent" track="raised">{children}</Ring>;
}
