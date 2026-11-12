import { lazy, Suspense } from 'react';
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

export default function App() {
  useThemeSync();
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
        <Route path="add" element={<div className="mx-auto max-w-lg px-4 pb-16 sm:px-6"><AddFood /></div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
