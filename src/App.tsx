import { lazy, Suspense, useEffect } from 'react';
import { refreshPremium } from './lib/premium';
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

export default function App() {
  useThemeSync();
  useEffect(() => { void refreshPremium(); }, []);
  const profile = useStore((s) => s.profile);
  if (!profile) return <Onboarding />;
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="history" element={<History />} />
          <Route path="insights" element={<Insights />} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin" element={<Admin />} />
        </Route>
        <Route path="snap" element={<Snap />} />
        <Route path="premium" element={<Premium />} />
        <Route path="add" element={<div className="mx-auto max-w-lg px-5 pb-16"><AddFood /></div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
