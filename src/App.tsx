import { lazy, Suspense, useEffect } from 'react';
import { refreshPremium } from './lib/premium';
import { useCloudSync } from './lib/account';
import { Confetti, Toaster } from './components/fx';
import { useMealReminders } from './components/Notifications';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store/useStore';
import { useThemeSync } from './lib/hooks';
import { Layout } from './components/Layout';
import Today from './pages/Today';
import AddFood from './pages/AddFood';
import History from './pages/History';
import Profile from './pages/Profile';
import Onboarding from './pages/Onboarding';

const Insights = lazy(() => import('./pages/Insights'));
const Admin = lazy(() => import('./pages/Admin'));
const Snap = lazy(() => import('./pages/Snap'));
const Premium = lazy(() => import('./pages/Premium'));
const Coach = lazy(() => import('./pages/Coach'));
const Barcode = lazy(() => import('./pages/Barcode'));
const Groups = lazy(() => import('./pages/Groups'));
const Privacy = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Terms })));
const Feed = lazy(() => import('./pages/Groups').then((m) => ({ default: m.CommunityFeedPage })));

export default function App() {
  useThemeSync();
  useEffect(() => { void refreshPremium(); }, []);
  useCloudSync();
  useMealReminders();
  const profile = useStore((s) => s.profile);
  // Legal pages open from the welcome screen too, before a profile exists.
  const path = typeof location !== 'undefined' ? location.pathname : '';
  if (!profile && (path === '/privacy' || path === '/terms')) return <Suspense fallback={null}>{path === '/privacy' ? <Privacy /> : <Terms />}</Suspense>;
  if (!profile) return <Onboarding />;
  return (
    <Suspense fallback={null}>
      <Toaster />
      <Confetti />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="history" element={<History />} />
          <Route path="insights" element={<Insights />} />
          <Route path="coach" element={<Coach />} />
          <Route path="groups" element={<Groups />} />
          <Route path="feed" element={<Feed />} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin" element={<Admin />} />
        </Route>
        <Route path="snap" element={<Snap />} />
        <Route path="barcode" element={<Barcode />} />
        <Route path="premium" element={<Premium />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="add" element={<div className="mx-auto max-w-lg px-5 pb-16 md:max-w-2xl md:px-8 lg:max-w-3xl"><AddFood /></div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
