import { useNavigate } from 'react-router-dom';
import { DIET_PREFS, TRAINING } from '@/lib/cuisines';
import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Bike, Coffee, Droplet, Drumstick, Dumbbell, Flame, HeartPulse, Leaf, Loader2, Mail, Pencil, Phone, Rabbit, Scale, Sofa, Soup, ThumbsDown, ThumbsUp, Trophy, Turtle, Fish, Salad, Utensils, Wheat, Zap, Footprints } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { accountsEnabled, sendPhoneCode, signInWithEmail, signInWithGoogle, toE164, useSession, verifyEmailCode, verifyPhoneCode } from '@/lib/account';
import { DIAL_CODES } from '@/lib/dialCodes';
import { COUNTRY_DATA } from '@/lib/countries';
import { GoogleIcon } from '@/components/BrandIcons';
import { primaryGoal, suggestGramsPerKg, suggestionReason } from '@/lib/goals';
import { COUNTRIES } from '@/lib/countries';
import { AVOIDS, CUISINES } from '@/lib/cuisines';
import { dailyGoal, fromKg, round1, toKg } from '@/lib/nutrition';
import { dailyTargets, weeksToGoal } from '@/lib/energy';
import type { ActivityLevel, Diet, FitnessGoal } from '@/lib/types';
import { Ring, Segmented, cx, fmt } from '@/components/ui';
import { haptic } from '@/components/fx';

type Option<T> = { value: T; label: string; sub: string; icon: typeof Dumbbell };

const GOALS: Option<FitnessGoal>[] = [
  { value: 'muscle', label: 'Build muscle', sub: 'Gain strength and size', icon: Dumbbell },
  { value: 'fatloss', label: 'Lose fat', sub: 'Keep muscle while leaning out', icon: Flame },
  { value: 'performance', label: 'Sports performance', sub: 'Train, recover, compete', icon: Trophy },
  { value: 'maintain', label: 'Maintain', sub: 'Stay where I am', icon: Scale },
  { value: 'health', label: 'Eat healthier', sub: 'Enough protein, every day', icon: HeartPulse },
];
const ACTIVITY: Option<ActivityLevel>[] = [
  { value: 'sedentary', label: '0 workouts', sub: 'Mostly sitting', icon: Sofa },
  { value: 'light', label: '1–2 a week', sub: 'Workouts now and then', icon: Footprints },
  { value: 'active', label: '3–5 a week', sub: 'Train 3–5 days a week', icon: Bike },
  { value: 'athlete', label: '6+ a week', sub: 'Dedicated athlete', icon: Trophy },
];
const DIETS: Option<Diet>[] = [
  { value: 'all', label: 'I eat everything', sub: 'Meat, fish, dairy, plants', icon: Utensils },
  { value: 'pescatarian', label: 'Pescatarian', sub: 'Fish, no meat', icon: Fish },
  { value: 'vegetarian', label: 'Vegetarian', sub: 'No meat or fish', icon: Salad },
  { value: 'vegan', label: 'Vegan', sub: 'Plants only', icon: Leaf },
];

const OBSTACLES = ['Lack of consistency', 'Busy schedule', 'Unhealthy eating habits', 'No meal ideas', 'Lack of support', 'Cravings & snacking', 'Eating out a lot', 'Don’t know what to eat'];

const PLAN_CHOICES = [
  { tier: 'free' as const, name: 'Free', price: '$0', sub: 'forever', perks: ['Calories, macros & 18,000+ foods', 'Barcode, exercise, progress & feed', '3 AI scans + 5 coach messages a month'] },
  { tier: 'plus' as const, name: 'Plus', price: '$2.50/mo', sub: '$29.99 a year · or $4.99/mo', badge: 'Most popular', perks: ['Unlimited AI photo scans & coach', 'AI workout guide for your week', 'AI recipes with full nutrition'] },
  { tier: 'pro' as const, name: 'Pro', price: '$4.00/mo', sub: '$47.99 a year · or $7.99/mo', perks: ['Everything in Plus', 'AI eating plans built for you', 'AI meal ideas from your cuisines'] },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const session = useSession();
  const saveProfile = useStore((s) => s.saveProfile);
  const unit = useStore((s) => s.settings.bodyUnit);
  const updateSettings = useStore((s) => s.updateSettings);

  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [activity, setActivity] = useState<ActivityLevel>();
  const [diets, setDiets] = useState<Diet[]>([]);
  const [dietPrefs, setDietPrefs] = useState<string[]>([]);
  // The most flexible style picked sets what we suggest (e.g. vegetarian + pescatarian → fish is fine).
  const diet: Diet | undefined = (['all', 'pescatarian', 'vegetarian', 'vegan'] as Diet[]).find((d) => diets.includes(d));
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'female' | 'male' | 'unspecified'>('unspecified');
  const [pregnant, setPregnant] = useState(false);
  const [country, setCountry] = useState(() => {
    const region = (navigator.language.split('-')[1] ?? '').toUpperCase();
    return COUNTRY_DATA.find(([iso]) => iso === region)?.[1] ?? '';
  });
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
  // Extra answers (Cal AI-style interview).
  const [goalWeight, setGoalWeight] = useState('');
  const [pace, setPace] = useState(0.5);
  const [training, setTraining] = useState<string[]>([]);
  const [planChoice, setPlanChoice] = useState<'free' | 'plus' | 'pro'>('plus');
  const [obstacles, setObstacles] = useState<string[]>([]);
  const [hasCoach, setHasCoach] = useState<boolean>();
  const [kcalOverride, setKcalOverride] = useState<number>();
  const [proteinOverride, setProteinOverride] = useState<number>();
  const wantsChange = goals.includes('fatloss') || goals.includes('muscle');
  const flow = ['welcome', 'goals', 'activity', 'training', 'diet', 'cuisines', 'about', ...(wantsChange ? ['goalweight'] : []), 'obstacles', 'coach', 'notify', 'plan', 'choose'];
  const at = flow[step];
  const STEPS = flow.length;
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const goalWeightNum = Number(goalWeight.replace(',', '.'));
  const goalWeightKg = goalWeightNum >= minW && goalWeightNum <= maxW ? toKg(goalWeightNum, unit) : undefined;
  const losing = goalWeightKg != null && weightKg != null && goalWeightKg < weightKg;

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
      dietPrefs: dietPrefs.length ? dietPrefs : undefined,
      heightCm: heightOk ? Math.round(heightNum) : undefined,
      cuisines: cuisines.length ? cuisines : undefined,
      avoid: avoid.length ? avoid : undefined,
      calorieMode: kcalOverride ? 'fixed' : 'auto',
      calorieGoal: kcalOverride,
      ...(proteinOverride ? { goalMode: 'fixed' as const, goalGrams: proteinOverride } : {}),
      goalWeightKg: goalWeightKg ? round1(goalWeightKg) : undefined,
      paceKgPerWeek: goalWeightKg ? pace : undefined,
      obstacles: obstacles.length ? obstacles : undefined,
      training: training.length ? training : undefined,
      hasCoach,
    });
  }

  if (at === 'welcome') return <Welcome signedIn={!!session} email={session?.user.email} onStart={next} />;

  const total = proteinOverride ?? (weightKg ? dailyGoal({ goalMode: 'perKg', gramsPerKg: gPerKg, bodyWeightKg: weightKg, goalGrams: 0 }) : 0);
  const draftProfile = {
    name: '', goalMode: 'perKg' as const, goalGrams: 0, gramsPerKg: gPerKg, createdAt: 0, bodyWeightKg: weightKg, heightCm: heightOk ? heightNum : undefined,
    age: ageNum || undefined, sex, pregnant: sex === 'female' && pregnant, goals, activity,
    goalWeightKg, paceKgPerWeek: goalWeightKg ? pace : undefined,
    calorieMode: kcalOverride ? ('fixed' as const) : ('auto' as const), calorieGoal: kcalOverride,
  };
  const targets = weightKg ? dailyTargets(draftProfile, total) : null;
  const weeks = weightKg ? weeksToGoal({ bodyWeightKg: weightKg, goalWeightKg, paceKgPerWeek: pace }) : null;
  const goalDate = weeks ? new Date(Date.now() + weeks * 7 * 86400000) : null;

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
        {at === 'goals' && (
          <Question title="What are your goals?" sub="Pick all that apply. We’ll set your calorie and protein targets.">
            {GOALS.map((o) => <Choice key={o.value} option={o} multi selected={goals.includes(o.value)} onClick={() => toggleGoal(o.value)} />)}
            <div className="flex-1" />
            <button onClick={next} disabled={!goals.length} className="btn-primary mt-6 w-full">
              Continue{goals.length > 1 ? ` · ${goals.length} goals` : ''}
            </button>
          </Question>
        )}
        {at === 'activity' && (
          <Question title="How many workouts do you do per week?" sub="This helps us set your calories and protein, and build your workout guide.">
            {ACTIVITY.map((o) => <Choice key={o.value} option={o} selected={activity === o.value} onClick={() => pickActivity(o.value)} />)}
          </Question>
        )}
        {at === 'diet' && (
          <Question title="How do you eat?" sub="We’ll tailor food suggestions. You can still log anything.">
            {DIETS.map((o) => <Choice key={o.value} option={o} selected={diets.includes(o.value)} onClick={() => { haptic(); setDiets((cur) => (cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value])); }} />)}
            <p className="label mt-6">Anything else? Pick as many as you like</p>
            <div className="flex flex-wrap gap-2">
              {DIET_PREFS.map((c) => (
                <button key={c} onClick={() => { haptic(); setDietPrefs((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])); }} className={cx('chip !h-11', dietPrefs.includes(c) && 'chip-on')}>
                  {dietPrefs.includes(c) && <Check size={15} strokeWidth={3} />}{c}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button onClick={next} className="btn-primary mt-6 w-full">{diets.length || dietPrefs.length ? 'Continue' : 'Skip for now'}</button>
          </Question>
        )}
        {at === 'training' && (
          <Question title={activity === 'sedentary' ? 'What would you like to try?' : 'What kind of exercise do you do?'} sub="Pick all that apply — your AI workout guide is built around them.">
            <div className="flex flex-wrap gap-2">
              {TRAINING.map((c) => (
                <button key={c} onClick={() => { haptic(); setTraining((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])); }} className={cx('chip !h-11', training.includes(c) && 'chip-on')}>
                  {training.includes(c) && <Check size={15} strokeWidth={3} />}{c}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button onClick={next} className="btn-primary mt-6 w-full">{training.length ? 'Continue' : 'Skip for now'}</button>
          </Question>
        )}

        {at === 'cuisines' && (
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
        {at === 'about' && (
          <Question title="About you" sub="This helps us set the right target for you.">
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <div>
                <label className="label mt-2" htmlFor="ob-name">First name</label>
                <input id="ob-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" autoComplete="given-name" />
              </div>
              <div>
                <label className="label mt-2" htmlFor="ob-age">Age</label>
                <input id="ob-age" className={cx('field text-center', !ageOk && '!ring-2 !ring-danger')} inputMode="numeric" maxLength={3} value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="30" />
              </div>
            </div>
            {!ageOk && <p className="mt-1 text-sm text-danger">Enter an age between 13 and 110.</p>}

            <span className="label mt-5">Sex</span>
            <Segmented full value={sex} onChange={(v) => { haptic(); setSex(v); }} options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'unspecified', label: 'Rather not say' }]} />
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
            <p className="mt-1 min-h-5 text-sm">{heightError ? <span className="text-danger">{heightError}</span> : <span className="text-xs text-silver">We use your age, height and weight to work out your calories.</span>}</p>
            <div className="flex-1" />
            <button onClick={() => { setGPerKg(suggestGramsPerKg(primaryGoal(goals.length ? goals : ['health'], activity ?? 'active'), activity ?? 'active', person)); next(); }} disabled={!weightKg || !age || !ageOk || !heightOk} className="btn-primary mt-6 w-full">{!weightKg || !age || !heightOk ? 'Add age, height and weight' : 'Continue'}</button>
          </Question>
        )}
        {at === 'goalweight' && (
          <Question title="What’s your goal weight?" sub="We’ll pace your calories so you get there steadily.">
            <div className="relative">
              <input id="ob-goalweight" className="field !h-20 pr-16 text-center text-[34px] font-extrabold" inputMode="decimal" maxLength={5} value={goalWeight} onChange={(e) => setGoalWeight(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={weightKg ? String(round1(fromKg(weightKg * (goals.includes('fatloss') ? 0.92 : 1.05), unit))) : unit === 'kg' ? '70' : '155'} />
              <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-xl font-semibold text-silver">{unit}</span>
            </div>
            {goalWeightKg && weightKg && (
              <p className="num mt-2 text-center text-[15px] font-semibold">
                {Math.abs(goalWeightKg - weightKg) < 0.5 ? 'That’s about your weight now — we’ll help you maintain.' : `${losing ? 'Lose' : 'Gain'} ${fmt(Math.abs(fromKg(goalWeightKg - weightKg, unit)), 1)} ${unit}`}
              </p>
            )}
            {goalWeightKg && weightKg && Math.abs(goalWeightKg - weightKg) >= 0.5 && (
              <div className="card mt-5 p-5">
                <p className="text-center text-sm font-semibold text-silver">{losing ? 'Weight loss' : 'Weight gain'} per week</p>
                <p className="num mt-1 text-center text-[34px] font-extrabold">{fmt(fromKg(pace, unit), 2)} {unit}</p>
                <div className="mt-3 grid grid-cols-3 text-center text-sm font-bold">
                  {([[Turtle, 'Slow'], [Rabbit, 'Recommended'], [Zap, 'Fast']] as const).map(([Icon, l], i) => (
                    <span key={l} className={cx('flex flex-col items-center gap-1', (i === 0 && pace < 0.4) || (i === 1 && pace >= 0.4 && pace <= 0.6) || (i === 2 && pace > 0.6) ? 'text-accent' : 'text-silver')}><Icon size={28} strokeWidth={2} />{l}</span>
                  ))}
                </div>
                <input type="range" min={losing ? 0.25 : 0.1} max={losing ? 1 : 0.5} step={0.05} value={pace} onChange={(e) => { setPace(Number(e.target.value)); haptic(5); }} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-raised accent-[rgb(var(--accent))]" aria-label="Pace per week" />
                <div className="mt-4 rounded-2xl bg-raised p-4">
                  <p className="font-semibold">You should reach your goal in <span className="text-accent">{weeks && weeks > 8 ? `${Math.round(weeks / 4.3)} months` : `${weeks} weeks`}</span></p>
                  <p className="mt-1 text-sm text-silver">{pace > 0.75 ? 'Fast paces are harder to stick to and can cost muscle.' : pace < 0.4 ? 'Slow and steady — easy to keep up.' : 'A balanced pace that works for most people.'}</p>
                  {targets && <p className="num mt-1 text-sm font-semibold">Daily calories: {fmt(targets.kcal)} kcal</p>}
                </div>
              </div>
            )}
            <div className="flex-1" />
            <button onClick={() => { if (!losing && pace > 0.5) setPace(0.25); next(); }} className="btn-primary mt-6 w-full">{goalWeightKg ? 'Continue' : 'Skip for now'}</button>
          </Question>
        )}
        {at === 'obstacles' && (
          <Question title="What’s stopping you from reaching your goals?" sub="Pick any — your coach will help with these.">
            {OBSTACLES.map((o) => (
              <button key={o} onClick={() => { haptic(); setObstacles((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o])); }} className={cx('flex min-h-[60px] items-center justify-between rounded-[20px] px-5 text-left text-[16px] font-bold transition active:scale-[.99]', obstacles.includes(o) ? 'bg-primary text-on-primary' : 'bg-surface')} style={obstacles.includes(o) ? undefined : { boxShadow: 'var(--shadow)' }}>
                {o} {obstacles.includes(o) && <Check size={18} strokeWidth={3} />}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={next} className="btn-primary mt-6 w-full">{obstacles.length ? 'Continue' : 'Skip'}</button>
          </Question>
        )}
        {at === 'coach' && (
          <Question title="Do you work with a personal trainer or dietitian?" sub="Your plan stays yours either way — share it with them anytime.">
            {([[true, 'Yes', ThumbsUp], [false, 'No', ThumbsDown]] as const).map(([v, l, Icon]) => (
              <button key={l} onClick={() => { haptic(); setHasCoach(v); setTimeout(next, 180); }} className={cx('flex h-16 items-center gap-4 rounded-[20px] px-5 text-left text-[17px] font-bold transition', hasCoach === v ? 'bg-primary text-on-primary' : 'bg-surface')} style={hasCoach === v ? undefined : { boxShadow: 'var(--shadow)' }}>
                <span className={cx('grid h-10 w-10 place-items-center rounded-full', hasCoach === v ? 'bg-on-primary/15' : 'bg-raised')}><Icon size={19} /></span>{l}
              </button>
            ))}
          </Question>
        )}
        {at === 'notify' && (
          <Question title="Stay on track with reminders" sub="A gentle nudge if you forget to log a meal. You can change this anytime.">
            <div className="card mt-2 space-y-3 p-5">
              {([[Coffee, 'Breakfast', '09:30'], [Salad, 'Lunch', '14:00'], [Soup, 'Dinner', '20:00']] as const).map(([Icon, l, t]) => (
                <div key={l} className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent"><Icon size={19} /></span><span className="flex-1 font-bold">{l}</span><span className="num font-semibold text-silver">{t}</span></div>
              ))}
            </div>
            <div className="flex-1" />
            <button onClick={async () => { haptic(); await enableReminders(); next(); }} className="btn-primary mt-6 w-full">Allow reminders</button>
            <button onClick={next} className="mt-2 h-12 w-full font-bold text-silver">Not now</button>
          </Question>
        )}
        {at === 'plan' && goal && activity && (
          <div className="flex flex-1 flex-col">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-on-primary"><Check size={28} strokeWidth={3} /></div>
            <h1 className="mt-4 text-center text-[28px] font-extrabold leading-tight tracking-tight">
              {goalWeightKg && weightKg && goalDate && Math.abs(goalWeightKg - weightKg) >= 0.5
                ? <>Goal: {losing ? 'lose' : 'gain'} {fmt(Math.abs(fromKg(goalWeightKg - weightKg, unit)), 1)} {unit} by {goalDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</>
                : <>Your plan is ready{name.trim() ? `, ${name.trim()}` : ''}</>}
            </h1>
            {goalWeightKg && weightKg && goalDate && Math.abs(goalWeightKg - weightKg) >= 0.5 && (
              <div className="card mt-5 p-5">
                <p className="font-bold">Estimated progress</p>
                <ProgressCurve losing={losing} label={`${fmt(fromKg(goalWeightKg, unit), 1)} ${unit}`} />
                <div className="mt-1 flex justify-between text-sm font-semibold text-silver"><span>Now</span><span>{goalDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
              </div>
            )}
            <div className="card mt-4 p-5">
              <p className="text-[17px] font-bold">Your daily recommendation</p>
              <p className="text-sm text-silver">Tap any number to edit it.</p>
              <EditTile big icon={Flame} tone="text-ink" label="Calories" unit="kcal" value={targets?.kcal} onChange={(v) => setKcalOverride(v)} min={800} max={8000} />
              <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                <EditTile icon={Drumstick} tone="text-accent" label="Protein" unit="g" value={total} onChange={(v) => setProteinOverride(v)} min={20} max={400} />
                <EditTile icon={Wheat} tone="text-[rgb(var(--carbs))]" label="Carbs" unit="g" value={targets?.carbs} />
                <EditTile icon={Droplet} tone="text-[rgb(var(--fat))]" label="Fat" unit="g" value={targets?.fat} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-silver">{suggestionReason(goal, activity, suggestGramsPerKg(goal, activity, person), person)}</p>
              
            </div>
            <p className="mt-3 text-center text-xs text-dim">Calories estimated with the Mifflin–St Jeor equation. A starting point, not medical advice.</p>
            <div className="flex-1" />
            <button onClick={() => { haptic([10, 40, 10]); next(); }} className="btn-primary mt-8 w-full">Continue</button>
          </div>
        )}
        {at === 'choose' && (
          <Question title="Choose your plan" sub="Start free and upgrade any time. Cancel whenever you like.">
            <div className="space-y-3">
              {PLAN_CHOICES.map((p) => (
                <button key={p.tier} onClick={() => { haptic(); setPlanChoice(p.tier); }} className={cx('card w-full p-5 text-left transition active:scale-[.99]', planChoice === p.tier && 'ring-2 ring-ink')}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-[19px] font-extrabold">{p.name}{p.badge && <span className="whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-on-primary">{p.badge}</span>}</p>
                    <p className="text-right"><span className="text-[19px] font-extrabold">{p.price}</span><span className="block text-xs text-silver">{p.sub}</span></p>
                  </div>
                  <ul className="mt-3 space-y-1.5">{p.perks.map((x) => <li key={x} className="flex items-start gap-2 text-[14px] text-silver"><Check size={16} strokeWidth={3} className="mt-0.5 shrink-0 text-accent" />{x}</li>)}</ul>
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button
              onClick={() => {
                haptic([10, 40, 10]);
                // Paid choice: open checkout for that plan as soon as the app opens.
                if (planChoice !== 'free') navigate(`/premium?tier=${planChoice}`, { replace: true });
                finish();
              }}
              className="btn-primary mt-6 w-full"
            >
              {planChoice === 'free' ? 'Start for free' : `Continue with ${planChoice === 'pro' ? 'Pro' : 'Plus'}`}
            </button>
          </Question>
        )}
      </div>
    </div>
  );
}

function Question({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-[30px] font-extrabold leading-[1.15] tracking-tight">{title}</h1>
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
          <p className="mt-1 text-sm text-silver">Enter the 6-digit code we sent to {addr.trim()}</p>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="field mt-3 text-center text-2xl font-semibold tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
          <button disabled={busy || code.length < 6} onClick={() => run(() => verifyEmailCode(addr.trim(), code))} className="btn-primary mt-2 w-full">
            {busy && <Loader2 size={18} className="animate-spin" />} Sign in
          </button>
          <div className="mt-3 flex justify-between text-sm font-semibold text-silver">
            <button onClick={() => { setMode('choose'); setCode(''); }}>Use another way</button>
            <button onClick={() => run(() => signInWithEmail(addr.trim()))}>Send a new code</button>
          </div>
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
            {busy && <Loader2 size={18} className="animate-spin" />} Email me a code
          </button>
          <button onClick={() => setMode('choose')} className="mt-1 text-sm font-semibold text-silver">Back</button>
        </div>
      ) : (
        <div className="grid gap-2.5">
          <button disabled={busy} onClick={() => run(signInWithGoogle)} className="btn bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}>
            <GoogleIcon /> Continue with Google
          </button>
          {import.meta.env.VITE_PHONE_SIGNIN === 'on' && (
            <button onClick={() => setMode('phone')} className="btn bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}>
              <Phone size={18} /> Continue with phone
            </button>
          )}
          <button onClick={() => setMode('email')} className="btn bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}>
            <Mail size={18} /> Continue with email
          </button>
          <button onClick={onStart} className="mt-1 h-11 text-sm font-semibold text-silver">Skip — use without an account</button>
          <p className="text-center text-xs text-dim">An account saves your data so you can use it on any phone.</p>
          <p className="text-center text-xs text-dim">By continuing you agree to our <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy policy</a>.</p>
        </div>
      )}
    </div>
  );
}


/** Turn on meal reminders from onboarding (asks the browser for permission). */
async function enableReminders() {
  try {
    if (!('Notification' in window)) return;
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm === 'granted') {
      const st = useStore.getState();
      st.updateSettings({ reminders: { enabled: true, breakfast: '09:30', lunch: '14:00', dinner: '20:00' } });
    }
  } catch { /* not supported */ }
}

/** Simple eased curve from now to the goal (illustrative, not a prediction). */
function ProgressCurve({ losing, label }: { losing: boolean; label: string }) {
  const d = losing ? 'M10,18 C 90,18 120,30 160,62 S 240,104 290,104' : 'M10,104 C 90,104 120,92 160,60 S 240,18 290,18';
  const end = losing ? 104 : 18;
  return (
    <svg viewBox="0 0 300 120" className="mt-3 w-full">
      <defs><linearGradient id="pc" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent))" stopOpacity="0.25" /><stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L290,118 L10,118 Z`} fill="url(#pc)" />
      <path d={d} fill="none" stroke="rgb(var(--ink))" strokeWidth="3" strokeLinecap="round" className="animate-[dash_1.2s_ease-out_both]" style={{ strokeDasharray: 400, strokeDashoffset: 0 }} />
      <circle cx="10" cy={losing ? 18 : 104} r="6" fill="rgb(var(--surface))" stroke="rgb(var(--ink))" strokeWidth="3" />
      <circle cx="290" cy={end} r="6" fill="rgb(var(--surface))" stroke="rgb(var(--accent))" strokeWidth="3" />
      <g transform={`translate(${222},${losing ? end - 40 : end + 14})`}>
        <rect width="70" height="26" rx="13" fill="rgb(var(--primary))" />
        <text x="35" y="17.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="rgb(var(--on-primary))">{label}</text>
      </g>
    </svg>
  );
}

/** Number tile that can be tapped to edit. */
function EditTile({ icon: Icon, tone, label, unit, value, onChange, min = 0, max = 10000, big }: { icon: typeof Flame; tone: string; label: string; unit: string; value?: number; onChange?: (v: number) => void; min?: number; max?: number; big?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <div className={cx('rounded-[22px] bg-raised p-4', big && 'mt-4 flex items-center gap-4')}>
      <span className={cx('grid place-items-center rounded-2xl bg-surface', big ? 'h-14 w-14' : 'h-9 w-9', tone)}><Icon size={big ? 26 : 18} strokeWidth={2.2} /></span>
      <div className={cx(big && 'flex-1')}>
        {editing && onChange ? (
          <input
            autoFocus inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            onBlur={() => { const n = Number(draft); if (n >= min && n <= max) onChange(n); setEditing(false); }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={cx('num w-full bg-transparent font-extrabold outline-none', big ? 'text-[34px]' : 'text-[22px]')}
          />
        ) : (
          <button onClick={() => { if (!onChange) return; setDraft(value ? String(Math.round(value)) : ''); setEditing(true); haptic(); }} className={cx('num block whitespace-nowrap font-extrabold', big ? 'text-[34px]' : 'mt-1 text-[22px]')}>
            {value == null ? '—' : `${fmt(value)}${unit === 'g' ? 'g' : ''}`}{onChange && <Pencil size={big ? 16 : 12} className="ml-1 inline align-middle text-dim" />}
          </button>
        )}
        <p className="text-sm font-semibold text-silver">{label}{unit === 'kcal' ? ' (kcal)' : ''}</p>
      </div>
    </div>
  );
}
