import { Link } from 'react-router-dom';
import { Camera, Check, CloudOff, Globe2, Mic, Scale, Search, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { BrandName } from '@/components/fx';
import { USD_PRICES } from '@/lib/prices';
import { SUPPORT_EMAIL } from './Legal';
import { CREDITS_NOTE, FREE_FEATURES, PLUS_FEATURES } from '@/lib/plans';

const usd = (n: number) => `$${n.toFixed(2)}`;
const M = USD_PRICES.plus_monthly, Y = USD_PRICES.plus_yearly;

const WAYS = [
  { icon: Camera, title: 'Snap it', text: 'Take a photo of your plate. Nutivili names each food and estimates the portion. You check it before it’s saved.' },
  { icon: Mic, title: 'Say it', text: '“Two scrambled eggs, a slice of toast and a latte.” It asks only what it needs, like how big the latte was.' },
  { icon: Search, title: 'Search it', text: '18,000+ foods from official food tables, plus dishes from around the world. Typos and local names welcome.' },
  { icon: Scale, title: 'Weigh it', text: 'Type the grams from your kitchen scale for exact numbers. Raw and cooked are kept separate.' },
];

const FAQ: [string, string][] = [
  ['What is Nutivili and how does it work?', 'Nutivili tracks what you eat and shows your calories, protein, carbs, fat, vitamins and minerals. Search 18,000+ foods, scan a meal with your camera, scan a barcode or say what you ate. Your diary, reports and trends update as you log.'],
  ['How do I track my food?', 'Tap + and pick a way: search the database, snap a photo, scan a barcode or nutrition label, or type or say it (“2 eggs and toast”). Choose the amount in grams, pieces, cups or servings, and it’s saved to your diary.'],
  ['Does Nutivili know foods from different countries and cuisines?', 'Yes. Dishes from around the world, with local names and common spellings, measured the way they’re really served: by the plate, bowl, piece, cup or gram.'],
  ['What if I can’t find a food?', 'Create your own in seconds with the numbers from the pack, or build a meal from its ingredients and save it. You can also edit any dish, for example add an egg or swap the protein, and keep your version for next time.'],
  ['Can I edit scanned meals and change serving sizes?', 'Always. A scan is a starting point: change any food, add or remove items, and adjust the amount or unit before you save. Saved meals can be edited later too.'],
  ['How accurate are the calories and nutrition numbers?', 'Foods come from official food-composition tables (such as USDA, UK CoFID, Australia’s AFCD and FAO/INFOODS) and pack labels, and every food shows its source. A photo can’t weigh food, so scans are clearly marked as estimates. For exact numbers, weigh it. Missing values are shown as missing, never as zero.'],
  ['What’s included in Free and Plus?', 'Free: the full food diary, search, barcode and voice logging, the recipe database, workouts, weight, water, sleep and steps, daily and weekly reports, 3 AI photo scans a day, 2 AI recipes and 1 AI meal plan a month. Plus ($8.99 a month or $44.99 a year) includes everything in Free and adds unlimited AI photo scans, 300 AI credits a month for the AI coach, recipes and plans, personalised meal plans, recipes and workouts, a weekly review from your AI coach, a smart calorie target and advanced insights.'],
  ['Can I cancel, and is my data secure?', 'Cancel any time in Profile → Subscription in two taps; you keep Plus until the end of the period you paid for, and your data stays yours. Your diary is private, sent over encrypted connections, never sold, and you can download or delete everything from Profile.'],
];

/** The public website: what Nutivili is, for people who haven't signed in yet. */
export default function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2"><Logo size={30} /><BrandName className="text-lg" /></div>
          <nav className="flex items-center gap-2 text-[14px] font-semibold">
            <a href="#pricing" className="hidden px-2 text-silver sm:inline">Pricing</a>
            <a href="#faq" className="hidden px-2 text-silver sm:inline">FAQ</a>
            <Link to="/start?login=1" className="px-2 text-silver">Log in</Link>
            <Link to="/start" className="btn-primary !h-10 !px-4 text-[14px]">Get started</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-5 pb-14 pt-12 md:pt-20">
          <p className="text-[13px] font-bold uppercase tracking-wider text-accent">Nutrition tracking, made easy</p>
          <h1 className="mt-3 max-w-3xl text-[40px] font-extrabold leading-[1.05] tracking-tight md:text-[60px]">Snap, say or weigh your food. <span className="text-accent">Hit your number.</span></h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-silver">Calories, protein, carbs, vitamins and minerals for the food you actually eat, from any kitchen in the world. Logging a meal takes seconds, not minutes.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/start" className="btn-primary !h-12 !px-6">Start free</Link>
            <a href="#how" className="btn-ghost !h-12 !px-6">See how it works</a>
          </div>

        </section>

        <section id="how" className="bg-surface/60 py-14">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-[30px] font-extrabold tracking-tight">Four ways to log. Pick what suits you.</h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {WAYS.map((w) => (
                <div key={w.title} className="card p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent"><w.icon size={21} /></span>
                  <p className="mt-4 text-[19px] font-bold">{w.title}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-silver">{w.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-14">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card p-6"><Globe2 className="text-accent" size={24} /><p className="mt-3 text-[18px] font-bold">Food from everywhere</p><p className="mt-1 text-[15px] leading-relaxed text-silver">Home cooking and restaurant dishes from every corner of the world, with local names, measured the way they’re really served.</p></div>
            <div className="card p-6"><ShieldCheck className="text-accent" size={24} /><p className="mt-3 text-[18px] font-bold">Numbers you can trust</p><p className="mt-1 text-[15px] leading-relaxed text-silver">Every value comes from an official food table and shows its source. Estimates are always labelled as estimates.</p></div>
            <div className="card p-6"><CloudOff className="text-accent" size={24} /><p className="mt-3 text-[18px] font-bold">Works offline</p><p className="mt-1 text-[15px] leading-relaxed text-silver">Search and log without internet. Everything syncs when you’re back online, and you can download your data any time.</p></div>
          </div>
        </section>

        <section id="pricing" className="bg-surface/60 py-14">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-[30px] font-extrabold tracking-tight">Simple pricing</h2>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <div className="card p-6">
                <p className="text-[20px] font-extrabold">Free</p>
                <p className="mt-1"><span className="text-[34px] font-extrabold">$0</span> <span className="text-silver">forever</span></p>
                <ul className="mt-4 space-y-2 text-[15px]">
                  {FREE_FEATURES.map((x) => <li key={x} className="flex gap-2"><Check size={18} className="mt-0.5 shrink-0 text-accent" />{x}</li>)}
                </ul>
                <Link to="/start" className="btn-ghost mt-6 w-full">Start free</Link>
              </div>
              <div className="card p-6 ring-2 ring-accent">
                <p className="text-[20px] font-extrabold">Plus</p>
                <p className="mt-1"><span className="text-[34px] font-extrabold">{usd(M)}</span> <span className="text-silver">a month</span></p>
                <p className="text-[14px] text-silver">or {usd(Y)} a year, <b className="text-accent">save {Math.round((1 - Y / (M * 12)) * 100)}%</b> (about {usd(Y / 12)} a month)</p>
                <p className="mt-4 text-[15px] font-bold">Everything in Free, plus:</p>
                <ul className="mt-2 space-y-2 text-[15px]">
                  {PLUS_FEATURES.map((x) => <li key={x} className="flex gap-2"><Check size={18} className="mt-0.5 shrink-0 text-accent" />{x}</li>)}
                </ul>
                <Link to="/start" className="btn-primary mt-6 w-full">Try Plus free for 3 days</Link>
                <p className="mt-2 text-center text-[12px] text-dim">{CREDITS_NOTE} Cancel any time.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-5 py-14">
          <h2 className="text-[30px] font-extrabold tracking-tight">Questions</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card p-5">
                <summary className="cursor-pointer text-[16px] font-bold">{q}</summary>
                <p className="mt-2 text-[15px] leading-relaxed text-silver">{a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/start" className="btn-primary !h-12 !px-8">Start free</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/60 py-8 text-[14px] text-silver">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-2"><Logo size={22} /><span>© {new Date().getFullYear()} Nutivili AI</span></div>
          <nav className="flex flex-wrap gap-4">
            <Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/refunds">Refunds</Link>
            {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>}
          </nav>
        </div>
        <p className="mx-auto mt-3 max-w-5xl px-5 text-[12px] text-dim">General nutrition information, not medical advice.</p>
      </footer>
    </div>
  );
}
