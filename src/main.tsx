import { captureInstallPrompt } from './lib/install';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { loadFoodDb } from './lib/foods';
import { installErrorReporting } from './lib/errors';
import { registerSW } from 'virtual:pwa-register';

installErrorReporting();
captureInstallPrompt();

// Updates: a new version is downloaded in the background. It's switched on (with a reload)
// only when that can't lose anything: while the app is in the background for someone who
// has finished setting up. Never during sign-up or onboarding, where a reload would wipe what
// they were doing (for example the "check your email" screen while they open their email).
const setupDone = () => {
  try { return !!JSON.parse(localStorage.getItem('protein-app') ?? '{}').state?.profile; } catch { return false; }
};
let waiting = false;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { waiting = true; },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine) void reg.update().catch(() => undefined); };
    setInterval(check, 30 * 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
      else if (waiting && setupDone() && !/^\/(onboarding|signin|welcome)/.test(location.pathname)) void updateSW(true);
    });
  },
});
void updateSW;

// Start fetching the food database immediately so search is instant.
void loadFoodDb().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
