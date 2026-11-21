/**
 * Online/offline state. Everything people log is saved on the phone first (see useStore), so the
 * app keeps working offline; only AI features (photo scan, coach, AI plans and recipes) and
 * looking up new barcodes need the internet.
 */
import { useEffect, useState } from 'react';

export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

export const OFFLINE_AI = 'You’re offline. This needs an internet connection. You can still search foods, log meals, weight and workouts: they’re saved on this phone and sync when you’re back online.';

/** For AI calls: stop early with a clear message instead of a network error. */
export function requireOnline() {
  if (!isOnline()) throw new Error(OFFLINE_AI);
}

export function useOnline(): boolean {
  const [on, setOn] = useState(isOnline);
  useEffect(() => {
    const up = () => setOn(true); const down = () => setOn(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}
