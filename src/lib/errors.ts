/**
 * Crash reporting without a third-party service: uncaught errors are sent to
 * /api/feedback and appear in the server log (Vercel → your project → Logs).
 * Only the error message, stack and page path are sent — never food logs or account details.
 */
let sent = 0;
const seen = new Set<string>();

function report(message: string, stack?: string) {
  if (!import.meta.env.PROD || sent >= 5) return;
  const key = message.slice(0, 120);
  if (seen.has(key)) return;
  seen.add(key);
  sent++;
  try {
    void fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'error', message: message.slice(0, 300), stack: stack?.slice(0, 1500), path: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* never let reporting break the app */ }
}

export function installErrorReporting() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => { if ((e.error as Error | undefined)?.name === 'LockedError') { e.preventDefault(); return; } report(String(e.message || 'Error'), e.error instanceof Error ? e.error.stack : undefined); });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    if ((r as Error | undefined)?.name === 'LockedError') { e.preventDefault(); return; }
    // Network hiccups are expected on phones; only report real errors.
    if (r instanceof TypeError && /fetch|network|load failed/i.test(r.message)) return;
    report(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
  });
}
