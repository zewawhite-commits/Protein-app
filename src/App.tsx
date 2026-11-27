import { backupToday } from './lib/backups';
import { lazy, Suspense, useEffect } from 'react';
import { refreshPremium } from './lib/premium';
import { captureInvite, usePerksSync } from './lib/perks';
import { useAdaptiveTarget } from './components/ProgressTop';

captureInvite();
import { useCloudSync } from './lib/account';
import { getAuthDraft, pendingEmail } from './lib/gate';
import { Confetti, Toaster } from './components/fx';
import { useMealReminders } from './components/Notifications';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import { useThemeSync } from './lib/hooks';
import { Layout } from './components/Layout';
import { VerifyGate } from './components/VerifyGate';
import { NetStatus } from './components/NetStatus';
import { ResumeRoute } from './lib/resume';
import Today from './pages/Today';
import AddFood from './pages/AddFood';
import History from './pages/History';
import Goals from './pages/Goals';
import Profile from './pages/Profile';
import Onboarding from './pages/Onboarding';

const Insights = lazy(() => import('./pages/Insights'));
const Planner = lazy(() => import('./pages/Planner'));
const Admin = lazy(() => import('./pages/Admin'));
const Owner = lazy(() => import('./pages/Owner'));
const Landing = lazy(() => import('./pages/Landing'));
const Snap = lazy(() => import('./pages/Snap'));
const Premium = lazy(() => import('./pages/Premium'));
const Coach = lazy(() => import('./pages/Coach'));
const Barcode = lazy(() => import('./pages/Barcode'));
const Groups = lazy(() => import('./pages/Groups'));
const RecipeBuilder = lazy(() => import('./pages/RecipeBuilder'));
const Privacy = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Terms })));
const Refunds = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Refunds })));
const Credits = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Credits })));
const Help = lazy(() => import('./pages/Help'));
const Reports = lazy(() => import('./pages/Reports'));
const Routines = lazy(() => import('./pages/Routines'));
const Messages = lazy(() => import('./pages/Messages'));
const PrivacySettings = lazy(() => import('./pages/PrivacySettings'));
const LiveWorkout = lazy(() => import('./pages/LiveWorkout'));
const Train = lazy(() => import('./pages/Train'));
const SharedRecipePage = lazy(() => import('./pages/SharedRecipePage'));
const Feed = lazy(() => import('./pages/Groups').then((m) => ({ default: m.CommunityFeedPage })));

export default function App() {
  useThemeSync();
  useEffect(() => { void refreshPremium(); }, []);
  // A daily copy of the data on this device, for restoring after a mistake.
  useEffect(() => { const t = setTimeout(() => void backupToday(), 4000); return () => clearTimeout(t); }, []);
  const session = useCloudSync();
  usePerksSync();
  useMealReminders();
  useAdaptiveTarget();
  const profile = useStore((s) => s.profile);
  // Legal pages open from the welcome screen too, before a profile exists.
  const path = useLocation().pathname;
  if (!profile && (path === '/privacy' || path === '/terms' || path === '/refunds')) return <Suspense fallback={null}>{path === '/privacy' ? <Privacy /> : path === '/terms' ? <Terms /> : <Refunds />}</Suspense>;
  // Prices are visible before sign-up, so nobody meets a surprise paywall.
  if (!profile && path === '/premium') return <Suspense fallback={null}><Toaster /><Premium /></Suspense>;
  if (path === '/r') return <Suspense fallback={null}><Toaster /><SharedRecipePage /></Suspense>;
  // The public website for visitors: not signed in, nothing started, opened in a browser (the installed app goes straight in).
  if (!profile && path === '/' && showWebsite(session)) return <Suspense fallback={null}><Landing /></Suspense>;
  if (!profile) return <Onboarding />;
  return (
    <Suspense fallback={null}>
      <Toaster />
      <Confetti />
      <VerifyGate />
      <NetStatus />
      <ResumeRoute />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="history" element={<History />} />
          <Route path="insights" element={<Insights />} />
          <Route path="planner" element={<Planner />} />
          <Route path="coach" element={<Coach />} />
          <Route path="groups" element={<Groups />} />
          <Route path="feed" element={<Feed />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Profile mode="settings" />} />
          <Route path="admin" element={<Admin />} />
        </Route>
        <Route path="snap" element={<Snap />} />
        <Route path="barcode" element={<Barcode />} />
        <Route path="premium" element={<Premium />} />
        <Route path="recipe" element={<RecipeBuilder />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="refunds" element={<Refunds />} />
        <Route path="credits" element={<Credits />} />
        <Route path="help" element={<Help />} />
        <Route path="reports" element={<Reports />} />
        <Route path="routines" element={<Routines />} />
        <Route path="workout" element={<LiveWorkout />} />
        <Route path="train" element={<Train />} />
        <Route path="goals" element={<Goals />} />
        <Route path="owner" element={<Owner />} />
        <Route path="messages" element={<Messages />} />
        <Route path="privacy-settings" element={<PrivacySettings />} />
        <Route path="add" element={<div className="mx-auto max-w-lg px-5 pb-16"><AddFood /></div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function showWebsite(session: unknown): boolean {
  if (session) return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone) return false;
    if (getAuthDraft() || pendingEmail() || localStorage.getItem('nutivili-onboarding')) return false;
  } catch { /* storage blocked: show the website */ }
  return true;
}
