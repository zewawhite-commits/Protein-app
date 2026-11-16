/**
 * "Add to home screen": Nutivili AI installs like an app (full screen, its own icon, works
 * offline). Android/desktop Chrome fire `beforeinstallprompt`, which we keep so a button
 * can open the install window; iPhone/iPad have no such event, so we show the steps.
 */
import { useEffect, useState } from 'react';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Call once at start-up, before the browser fires the event. */
export function captureInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('provora-installed', '1'); } catch { /* ignore */ } emit(); });
}

export const isInstalled = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIOS = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((n) => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return {
    installed: isInstalled(),
    canPrompt: !!deferred,
    ios: isIOS(),
    async install(): Promise<boolean> {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      emit();
      return outcome === 'accepted';
    },
  };
}
