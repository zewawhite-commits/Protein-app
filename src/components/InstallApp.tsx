import { useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useInstall } from '@/lib/install';
import { haptic, toast } from './fx';
import { cx } from './ui';

const DISMISS = 'provora-install-dismissed';

/** The iPhone steps (Safari has no install button for websites). */
function IOSSteps() {
  return (
    <ol className="mt-3 space-y-2 text-[14px]">
      <li className="flex items-center gap-2.5"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-white">1</span>Tap <Share size={16} className="text-accent" aria-label="Share" /> <b>Share</b> at the bottom of Safari</li>
      <li className="flex items-center gap-2.5"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-white">2</span>Scroll and tap <SquarePlus size={16} className="text-accent" aria-hidden /> <b>Add to Home Screen</b></li>
      <li className="flex items-center gap-2.5"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-white">3</span>Tap <b>Add</b> — Nutivili appears with your apps</li>
    </ol>
  );
}

/** Home-screen banner: shown until installed or dismissed. */
export function InstallBanner({ className }: { className?: string }) {
  const { installed, canPrompt, ios, install } = useInstall();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(DISMISS) === '1'; } catch { return false; } });
  const [steps, setSteps] = useState(false);
  if (installed || hidden || (!canPrompt && !ios)) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS, '1'); } catch { /* ignore */ } };
  return (
    <section className={cx('card relative p-4', className)} aria-label="Install Nutivili">
      <button onClick={dismiss} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-silver" aria-label="Not now"><X size={17} /></button>
      <div className="flex items-start gap-3 pr-8">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent"><Download size={20} /></span>
        <div>
          <p className="font-semibold">Add Nutivili to your home screen</p>
          <p className="text-[14px] leading-relaxed text-silver">Opens full screen like an app, with its own icon, and works offline.</p>
        </div>
      </div>
      {ios ? (steps ? <IOSSteps /> : <button onClick={() => { haptic(); setSteps(true); }} className="btn-primary mt-3 w-full">Show me how</button>) : (
        <button onClick={async () => { haptic(); if (await install()) toast('Installed — find Nutivili with your apps'); }} className="btn-primary mt-3 w-full"><Download size={17} /> Install app</button>
      )}
    </section>
  );
}

/** Profile row version: always available (unless already installed). */
export function InstallRow() {
  const { installed, canPrompt, ios, install } = useInstall();
  const [steps, setSteps] = useState(false);
  if (installed) return <p className="px-4 py-3 text-[14px] text-silver">Installed on this device — open it from your home screen.</p>;
  return (
    <div className="px-4 py-3">
      <p className="text-[15px] font-medium">Install Nutivili on this device</p>
      <p className="text-[13px] text-silver">Full screen, its own icon, works offline. No app store needed.</p>
      {canPrompt ? (
        <button onClick={async () => { haptic(); if (await install()) toast('Installed'); }} className="chip mt-2 !h-9 !bg-accent/10 !text-accent"><Download size={15} /> Install app</button>
      ) : ios ? (steps ? <IOSSteps /> : <button onClick={() => setSteps(true)} className="chip mt-2 !h-9">Show me how</button>) : (
        <p className="mt-1.5 text-[13px] text-silver">In your browser’s menu, choose “Install app” or “Add to Home screen”.</p>
      )}
    </div>
  );
}
