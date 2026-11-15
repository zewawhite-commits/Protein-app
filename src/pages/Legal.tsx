import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { APP_NAME } from '@/components/fx';

export const SUPPORT_EMAIL: string | undefined = import.meta.env.VITE_SUPPORT_EMAIL || undefined;
const UPDATED = '15 November 2026';

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16 md:max-w-2xl md:px-8">
      <header className="pt-safe flex items-center pb-4">
        <button onClick={() => (history.length > 1 ? navigate(-1) : navigate('/profile'))} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
      </header>
      <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-silver">Last updated {UPDATED}</p>
      <div className="legal mt-6 space-y-5 text-[15px] leading-relaxed text-ink/90">{children}</div>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <h2 className="pt-2 text-[19px] font-bold text-ink">{children}</h2>;
const contact = SUPPORT_EMAIL ? <a className="font-semibold text-accent" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> : 'the contact details in the app';

export function Privacy() {
  return (
    <Page title="Privacy policy">
      <p>{APP_NAME} helps you track what you eat and train. This policy explains what we collect, why, and the choices you have. We don’t sell your data and we don’t show ads.</p>

      <H>What we collect</H>
      <ul className="list-disc space-y-2 pl-5">
        <li><b>What you enter:</b> your food log, weights, workouts, goals, body details (age, height, weight, sex) and preferences such as cuisines and allergies.</li>
        <li><b>Account:</b> if you sign in, your email address and, with Google, your name and profile picture.</li>
        <li><b>Photos:</b> meal photos you scan and progress photos. Progress photos stay on your phone unless you choose to share them.</li>
        <li><b>Community:</b> posts, comments, reactions, group messages, your username and profile photo — visible to other members.</li>
        <li><b>Payments:</b> handled by Paystack. We receive your plan, payment status and the card brand and last four digits — never your full card number.</li>
        <li><b>Usage counts:</b> how many AI features you used this month, to apply plan limits.</li>
      </ul>

      <H>How we use it</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>To run the app: calculate your targets, show your progress and keep your data in sync across devices.</li>
        <li>To provide AI features: when you scan a meal, describe food, chat with the coach or ask for a workout, recipe or plan, the photo or text and the relevant parts of your profile and today’s log are sent to our AI provider (Anthropic) to produce a reply. They are not used to train AI models.</li>
        <li>To take payments and manage your subscription.</li>
        <li>To keep the service safe and fix problems.</li>
      </ul>

      <H>Where it’s stored</H>
      <p>Without an account, your data stays on your device. With an account, it’s stored securely with our database provider (Supabase). Barcode lookups are sent to Open Food Facts. Our service providers only process data on our instructions.</p>

      <H>Health information</H>
      <p>Food, weight and body details can be health information. We use it only to provide the app to you, and we never share it for advertising. {APP_NAME} gives general guidance, not medical advice.</p>

      <H>Your rights</H>
      <p>You can see, export and delete your data at any time: Profile → Export backup, and Profile → Delete all data. Signing out stops syncing. You can ask us to delete your account and everything linked to it by contacting {contact}. If you’re in the UK or EU you also have the right to object, restrict processing and complain to your data protection authority (in the UK, the ICO).</p>

      <H>How long we keep it</H>
      <p>We keep your data while your account is active. When you delete it, it’s removed from our systems within 30 days, except records we must keep by law, such as payment records.</p>

      <H>Children</H>
      <p>{APP_NAME} is not for children under 13. Under 18s should use it with a parent or guardian.</p>

      <H>Changes and contact</H>
      <p>If we change this policy we’ll update the date above and tell you in the app for significant changes. Questions: {contact}.</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of use">
      <p>By using {APP_NAME} you agree to these terms. Please read them with our privacy policy.</p>

      <H>Not medical advice</H>
      <p>{APP_NAME} provides general nutrition and fitness information. It is not a substitute for advice from a doctor, dietitian or other professional. Talk to one before big changes to your diet or exercise, especially if you are pregnant, have a health condition, or have had an eating disorder. Stop exercising if you feel pain or unwell.</p>

      <H>Accuracy</H>
      <p>Nutrition values come from public food databases (USDA, FAO/INFOODS, Open Food Facts) and standard recipes built from them. Real foods vary, and AI can misidentify food in photos — always check what’s logged. AI suggestions (coach replies, workouts, recipes, plans) can be wrong; use your judgement.</p>

      <H>Your account</H>
      <p>Keep your sign-in secure. You’re responsible for activity on your account. You must be at least 13 to use {APP_NAME}.</p>

      <H>Subscriptions</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>Plus and Pro are paid monthly or yearly through Paystack and renew automatically until you cancel.</li>
        <li>Prices are shown in US dollars; your bank may charge in another currency at its exchange rate.</li>
        <li>Cancel any time from Profile → Subscription. You keep access until the end of the period you paid for.</li>
        <li>“Unlimited” features have a fair-use limit to stop abuse; normal use will never reach it.</li>
        <li>If you’re a consumer in the UK or EU, you have a 14-day right to cancel a new subscription; contact us for a refund of an unused period.</li>
      </ul>

      <H>Community rules</H>
      <p>Be kind. Don’t post anything illegal, hateful, sexual, harassing or harmful (including promoting extreme dieting), or other people’s private information. You own what you post, and you let us show it to other members. We may remove content or accounts that break these rules.</p>

      <H>Liability</H>
      <p>We provide {APP_NAME} “as is”. To the extent the law allows, we aren’t liable for indirect losses or for decisions you make based on the app. Nothing in these terms limits rights you have by law.</p>

      <H>Changes and contact</H>
      <p>We may update these terms; we’ll change the date above and tell you about significant changes. Questions: {contact}.</p>
    </Page>
  );
}
