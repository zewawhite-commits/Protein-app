import { useEffect, useState } from 'react';
import type { FoodPhoto } from '@/data/foodPhotos';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { APP_NAME } from '@/components/fx';
import { USD_PRICES } from '@/lib/prices';

/** Set these in Vercel (Settings → Environment Variables) so the policies name the business. */
export const SUPPORT_EMAIL: string | undefined = import.meta.env.VITE_SUPPORT_EMAIL || 'nutiviliai@gmail.com';
const BUSINESS: string = import.meta.env.VITE_BUSINESS_NAME || APP_NAME;
const ADDRESS: string | undefined = import.meta.env.VITE_BUSINESS_ADDRESS || undefined;
const UPDATED = '16 November 2026';

const DOCS = [
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/refunds', label: 'Cancellation & Refund Policy' },
];

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16 md:max-w-2xl md:px-8">
      <header className="pt-safe flex items-center pb-4">
        <button onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
      </header>
      <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-silver">Last updated {UPDATED}</p>
      <div className="legal mt-6 space-y-5 text-[15px] leading-relaxed text-ink/90">{children}</div>
      <nav aria-label="Policies" className="mt-10 flex flex-wrap gap-2 border-t border-line pt-5">
        {DOCS.filter((d) => d.to !== pathname).map((d) => <Link key={d.to} to={d.to} className="chip !h-10 text-[14px]">{d.label}</Link>)}
      </nav>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <h2 className="pt-2 text-[19px] font-bold text-ink">{children}</h2>;
const contact = SUPPORT_EMAIL ? <a className="font-semibold text-accent" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> : 'the support contact in the app (Profile → Contact support)';
const money = (id: string) => `$${USD_PRICES[id].toFixed(2)}`;

function WhoWeAre() {
  return (
    <p>
      {APP_NAME} is provided by <b>{BUSINESS}</b>{ADDRESS ? <>, {ADDRESS}</> : null}. You can contact us at {contact}.
    </p>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy Policy">
      <p>{APP_NAME} helps you track what you eat and train. This policy explains what we collect, why, and the choices you have. We don’t sell your data and we don’t show ads.</p>

      <H>Who we are</H>
      <WhoWeAre />

      <H>What we collect</H>
      <ul className="list-disc space-y-2 pl-5">
        <li><b>What you enter:</b> your food log, weights, workouts, goals, body details (age, height, weight, sex), and preferences such as cuisines, diet, allergies and foods you avoid.</li>
        <li><b>Account:</b> if you sign in, your email address and, with Google, your name and profile picture.</li>
        <li><b>Photos:</b> meal photos you scan and progress photos. They’re stored on your phone, not on our servers, unless you post one to the feed. Before a photo is stored or sent anywhere, the app re-saves it, which removes hidden details such as the location it was taken.</li>
        <li><b>Community:</b> posts, comments, reactions, group messages, your username and profile photo — visible to other members of the same groups.</li>
        <li><b>Payments:</b> handled by Paystack. We receive your plan, payment status, and the card brand and last four digits — never your full card number.</li>
        <li><b>Usage counts:</b> how many AI features you used this month, to apply plan limits.</li>
        <li><b>Scan corrections:</b> when you choose a different food than the one the app suggested after a scan, we record the AI’s name for the food and the food you chose, without your name or email, to improve suggestions for everyone.</li>
        <li><b>Free Plus time and invites:</b> whether you used the free trial, and if you joined with a friend’s invite link, who invited you so we can give you both free Plus time. Your friend only sees how many people joined, not who.</li>
        <li><b>Crash reports:</b> if the app hits an error, it sends the error message and the page it happened on so we can fix it. It doesn’t include your food log or account details.</li>
      </ul>

      <H>How we use it</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>To run the app: calculate your targets, show your progress, warn you about foods on your avoid list, and keep your data in sync across devices.</li>
        <li>To send occasional tips, recipes and offers by email. You can turn these off at sign-up, any time in Settings → Tips &amp; offers by email, or by asking us. Account emails (like confirming your email or resetting your password) are always sent.</li>
        <li>To provide AI features: when you scan a meal or label, describe food, chat with the coach or ask for a workout, recipe, plan or meal ideas, the photo or text and the relevant parts of your profile and recent log are sent to our AI provider, Anthropic, to produce a reply. Your first name may be included so the coach can address you; your email address and account details are not sent. Under Anthropic’s commercial terms, this data isn’t used to train their models.</li>
        <li>To take payments, manage your subscription and give free Plus time.</li>
        <li>To keep the service safe, prevent abuse and fix problems.</li>
        <li>To understand how the app is used, from totals only (for example how many people logged food this week), never to profile you for advertising.</li>
      </ul>

      <H>Where it’s stored</H>
      <p>Without an account, your data stays on your device. With an account, it’s stored securely with our database provider (Supabase) and the app is hosted by Vercel. Barcode lookups are sent to Open Food Facts. These providers may store or process data outside your country; they only process it on our instructions and under their own security and data-protection commitments.</p>

      <H>Health information</H>
      <p>Food, weight and body details can be health information. We use it only to provide the app to you, and we never share it for advertising. {APP_NAME} gives general guidance, not medical advice.</p>

      <H>Your rights</H>
      <p>You can see, export and delete your data at any time: Profile → Export backup, and Profile → Delete account, which removes your account and everything linked to it. You can also contact {contact}. Depending on where you live, data-protection law may also give you the right to correct your data, object to or restrict how it’s used, and complain to your local data-protection authority.</p>

      <H>How long we keep it</H>
      <p>We keep your data while your account is active. When you delete it, it’s removed from our systems within 30 days, except records we must keep by law, such as payment records. Scan corrections are kept without anything that identifies you. Crash reports are kept in our hosting logs for a short period and then deleted automatically.</p>

      <H>Children</H>
      <p>{APP_NAME} is not for children under 13. Under 18s should use it with a parent or guardian.</p>

      <H>Changes and contact</H>
      <p>If we change this policy we’ll update the date above and tell you in the app about significant changes. Questions: {contact}.</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms & Conditions">
      <p>These terms are an agreement between you and {BUSINESS} for your use of {APP_NAME}, on the web and as an installed app. By using {APP_NAME} you agree to them. Please read them with our <Link to="/privacy" className="font-semibold text-accent">Privacy Policy</Link> and <Link to="/refunds" className="font-semibold text-accent">Cancellation & Refund Policy</Link>.</p>

      <H>Who we are</H>
      <WhoWeAre />

      <H>Not medical advice</H>
      <p>{APP_NAME} provides general nutrition and fitness information. It is not a substitute for advice from a doctor, dietitian or other professional. Talk to one before big changes to your diet or exercise, especially if you are pregnant, have a health condition, or have had an eating disorder. Stop exercising if you feel pain or unwell.</p>

      <H>Accuracy, AI and allergies</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>Nutrition values come from public food databases (USDA, FAO/INFOODS, UK CoFID, Australia’s AFCD, Open Food Facts) and standard recipes built from them. Real foods vary.</li>
        <li>AI can misidentify food in photos, and portion weights from a photo are estimates. Always check what’s logged; weigh food when accuracy matters. AI suggestions (coach replies, workouts, recipes, plans, meal ideas, portion suggestions) can be wrong; use your judgement.</li>
        <li>Allergy and avoid-list warnings are based on food names and recipes, and can miss ingredients. They are a help, not a guarantee. Always check labels and ask how food was made if you have an allergy.</li>
      </ul>

      <H>Your account</H>
      <p>You must be at least 13 to use {APP_NAME}. Keep your sign-in secure; you’re responsible for activity on your account. Give accurate information, especially body details, as your targets depend on them.</p>

      <H>Plans and payments</H>
      <ul className="list-disc space-y-2 pl-5">
        <li><b>Free</b> costs nothing and includes 3 AI photo scans, 5 meal follow-ups and 5 coach messages each day, and 2 AI recipes and 1 AI meal plan each calendar month. Recipe imports are unlimited. Free may show advertising.</li>
        <li><b>Plus</b> costs {money('pro_monthly')} a month or {money('pro_yearly')} a year. The price is shown before you pay.</li>
        <li>Paid plans are billed in advance through Paystack and renew automatically at the end of each month or year until you cancel.</li>
        <li>Prices are shown in US dollars. If you’re charged in another currency, your bank or card provider sets the exchange rate and may add fees.</li>
        <li>We may change prices for future billing periods. We’ll tell you in advance, and you can cancel before the new price applies.</li>
        <li>Cancellations and refunds are covered by our <Link to="/refunds" className="font-semibold text-accent">Cancellation & Refund Policy</Link>.</li>
      </ul>

      <H>AI credits and fair use</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>Plus includes a monthly allowance of AI credits (currently 300), which refreshes on your billing date each month, also on yearly plans. AI photo scans (food, menu and label) and follow-up questions about a scanned meal are unlimited for personal use and don’t use credits. Other AI features use credits: a coach message 1, an AI recipe 3, a meal plan 5, a workout plan 3. Within the credits, each month: up to 12 AI recipes, 4 meal plans and 8 workout plans. Profile shows your balance and the current costs.</li>
        <li>Unused credits don’t roll over. If the AI fails to answer, the credits are returned. Sending the same request again uses no credits.</li>
        <li>Never limited and never use credits: logging food, searching the food database, barcode scanning, voice logging, recipe imports, saved meals, your own foods and recipes, the exercise library and workout diary, and coach voice replies.</li>
        <li>We may change the allowance or the cost of a feature for future billing months; we’ll tell you in the app first.</li>
        <li>Not personal use: automated or scripted requests, sharing one account between several people, or using {APP_NAME}’s AI for a business. If an account sends requests faster than a person could, we ask it to wait a minute.</li>
      </ul>

      <H>Free trial and invites</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>Each person can have one free 3-day Plus trial. No card is needed and it ends on its own; nothing is charged when it ends.</li>
        <li>Friends who join with your invite link get 14 days of Plus free, and you get 7 days of Plus for each friend who joins, up to 10 friends. Invites are for real people; we may remove free time earned with fake or duplicate accounts.</li>
        <li>Free Plus time includes Plus features with the same monthly AI credits (invite rewards keep the coach at the Free allowance), has no cash value and can’t be exchanged or transferred.</li>
      </ul>

      <H>Acceptable use and community rules</H>
      <p>Don’t misuse {APP_NAME}: no attempts to break, overload or get around its limits, no automated access, and no reselling. In the community, be kind. Don’t post anything illegal, hateful, sexual, harassing or harmful (including promoting extreme dieting), or other people’s private information. You own what you post and you let us show it to members of your groups. We may remove content, and suspend or close accounts that break these terms.</p>

      <H>Our app</H>
      <p>{APP_NAME}, its design and software belong to {BUSINESS}. We give you a personal, non-transferable right to use it. Food data from public databases remains subject to its sources’ terms.</p>

      <H>Ending your use</H>
      <p>You can stop using {APP_NAME} and delete your account at any time (Profile → Delete account). Deleting your account doesn’t cancel a paid plan billed by Paystack — cancel that first (see our Cancellation & Refund Policy).</p>

      <H>Availability and liability</H>
      <p>We work to keep {APP_NAME} running but can’t promise it will always be available or error-free, and features may change. We provide it “as is”. To the extent the law allows, we aren’t liable for indirect or consequential losses, or for decisions you make based on the app, and our total liability is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits rights you have by law as a consumer.</p>

      <H>Governing law</H>
      <p>You keep the protection of the mandatory consumer laws of the country where you live, and may bring claims in your local courts.</p>

      <H>Changes and contact</H>
      <p>We may update these terms; we’ll change the date above and tell you about significant changes before they apply. Questions: {contact}.</p>
    </Page>
  );
}

export function Refunds() {
  return (
    <Page title="Cancellation & Refund Policy">
      <p>This policy explains how to cancel a {APP_NAME} Plus subscription and when you can get your money back. Payments are processed by Paystack.</p>

      <H>Who we are</H>
      <WhoWeAre />

      <H>Cancelling</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>You can cancel at any time: open {APP_NAME} → Profile → Subscription → Manage, change or cancel. This opens Paystack’s page for your subscription. You can also email {contact} and we’ll cancel it for you.</li>
        <li>When you cancel, you won’t be charged again. You keep Plus until the end of the month or year you’ve already paid for, then your account moves to the Free plan.</li>
        <li>Your food log, history and settings stay yours on Free; nothing is deleted when a plan ends.</li>
        <li>Deleting your account doesn’t cancel a subscription by itself, so please cancel first.</li>
      </ul>

      <H>Free trial and free Plus time</H>
      <p>The 3-day Plus trial and Plus time from invites are free and need no card. They end automatically, so there’s nothing to cancel and nothing to refund.</p>

      <H>Refunds</H>
      <ul className="list-disc space-y-2 pl-5">
        <li><b>Yearly plans:</b> if you change your mind, ask within 14 days of your first yearly payment for a full refund.</li>
        <li><b>Monthly plans:</b> if you change your mind, ask within 7 days of your first monthly payment for a full refund.</li>
        <li><b>Renewals:</b> if you forgot to cancel and haven’t used any paid features since the renewal, ask within 7 days of the renewal date for a full refund of that renewal.</li>
        <li><b>Mistakes on our side:</b> if you were charged twice, charged the wrong amount, or paid features didn’t work and we couldn’t fix it, we’ll refund the affected charge in full, whenever it happened.</li>
        <li>Outside these cases, payments for a period that has started are not refundable, and we don’t give partial refunds for unused time; you keep access until the period ends.</li>
        <li>If you’re a consumer in the UK or EU, you have a legal right to cancel a new subscription within 14 days and get a refund. Using paid features in that time with your agreement can reduce the refund in proportion to the time used. This policy never takes away rights you have by law.</li>
      </ul>

      <H>How to ask for a refund</H>
      <p>Email {contact} from the email address you paid with, and include your payment reference (it’s in your Paystack receipt email) and the reason. We reply within 3 working days.</p>

      <H>How refunds are paid</H>
      <p>Approved refunds go back to the card or account you paid with, through Paystack, in the currency you were charged. Once we’ve sent it, it usually arrives within 5–10 working days, depending on your bank. When a refund is made, the paid plan it covered ends at the same time.</p>

      <H>Failed payments</H>
      <p>If a renewal payment fails, you keep access for a short grace period while you update your card in Paystack. If it still can’t be paid, your account moves to Free. You’re never charged for a period you didn’t get.</p>

      <H>Changes and contact</H>
      <p>If we change this policy, we’ll update the date above; changes don’t affect payments made before them. Questions: {contact}.</p>
    </Page>
  );
}

/** Who took the food photos and under which licence (required by Creative Commons). */
export function Credits() {
  const [list, setList] = useState<[string, FoodPhoto][] | null>(null);
  useEffect(() => {
    fetch('/api/photos?all=1').then((r) => (r.ok ? r.json() : { photos: {} })).then((d: { photos: Record<string, FoodPhoto | null> }) => setList(Object.entries(d.photos).filter((e): e is [string, FoodPhoto] => !!e[1]))).catch(() => setList([]));
  }, []);
  return (
    <Page title="Photo credits">
      <p>Food photos are from <a className="text-accent underline" href="https://unsplash.com/?utm_source=nutivili_ai&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>, with some from Pexels and Wikimedia Commons (free licences shown). Thank you to the photographers below.</p>
      <p>Food illustrations (shown where there’s no photo): Microsoft Fluent Emoji (MIT licence).</p>
      {list === null ? <p className="text-sm text-silver">Loading…</p> : (
        <ul className="space-y-2">
          {list.map(([key, c]) => (
            <li key={key} className="text-sm">
              <b className="text-ink">{key.replace(/_/g, ' ')}</b>: photo by <a className="text-accent underline" href={c.authorUrl ?? undefined} target="_blank" rel="noreferrer">{c.author ?? 'Unknown'}</a> on <a className="text-accent underline" href={c.page ?? 'https://unsplash.com/?utm_source=nutivili_ai&utm_medium=referral'} target="_blank" rel="noreferrer">{c.url?.includes('wikimedia') ? 'Wikimedia Commons' : c.url?.includes('pexels') ? 'Pexels' : 'Unsplash'}</a>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
