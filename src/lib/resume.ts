/**
 * Coming back to the app carries on where the person was. Phones often close a web app that's in
 * the background; on reopening it starts at Home, so we go back to the last screen if it was
 * open in the last few hours. Sign-in itself is kept on the device (Supabase saves the session),
 * so nobody is asked to log in again.
 */
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const KEY = 'nutivili-last-screen';
const KEEP = 6 * 3600_000;
const SKIP = /^\/(r|premium\/success)?$/;

export function ResumeRoute() {
  const loc = useLocation();
  const nav = useNavigate();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { path: string; at: number } | null;
        const launchedAtHome = loc.pathname === '/' && !loc.search;
        if (saved && launchedAtHome && Date.now() - saved.at < KEEP && !SKIP.test(saved.path.split('?')[0])) { nav(saved.path, { replace: true }); return; }
      } catch { /* storage blocked */ }
    }
    try { localStorage.setItem(KEY, JSON.stringify({ path: loc.pathname + loc.search, at: Date.now() })); } catch { /* storage blocked */ }
  }, [loc.pathname, loc.search]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
