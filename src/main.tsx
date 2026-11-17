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

// Updates: a new version takes over (and the page reloads) as soon as it's downloaded,
// instead of waiting for the app to be opened twice. Checked on open, when the app comes
// back into view, and every 30 minutes.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine) void reg.update().catch(() => undefined); };
    setInterval(check, 30 * 60_000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
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
