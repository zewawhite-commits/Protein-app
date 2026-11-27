import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Award, X, Camera, ChefHat, ClipboardList, Dumbbell, MessageCircle, ShoppingBasket, Sparkle, TrendingUp, Utensils } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useHasTier } from '@/lib/perks';
import { haptic } from './fx';

const KEY = 'nutivili-upgrade-shown';
const WEEK = 7 * 864e5;

const REASONS = [
  { icon: Camera, t: 'Scan every meal', d: 'Unlimited AI photo scans and follow-up questions.' },
  { icon: MessageCircle, t: 'Your own nutrition coach', d: 'Ask anything, send a photo, get answers based on your real diary.' },
  { icon: ClipboardList, t: 'Meal plans that fit you', d: 'Personal weekly plans built around your targets and your food.' },
  { icon: ShoppingBasket, t: 'Grocery lists, done', d: 'Turn a plan into a shopping list in one tap.' },
  { icon: ChefHat, t: 'Recipes from your kitchen', d: 'Tell it what you have; get a recipe with full nutrition.' },
  { icon: Dumbbell, t: 'Training that adapts', d: 'AI workout plans for your goal, equipment and schedule.' },
  { icon: Utensils, t: 'Smarter swaps', d: 'Better options for any dish, without giving up what you love.' },
  { icon: TrendingUp, t: 'A weekly review', d: 'Your coach looks back at your week and tells you what to change.' },
  { icon: Sparkle, t: 'Support a small team', d: 'Plus keeps Nutivili ad-free and the free plan generous.' },
];

/**
 * A once-a-week "why Plus" sheet on opening the app. Never shown before someone has really used
 * the app (3+ days with food logged), never to Plus members, and always easy to close.
 */
export function UpgradePrompt() {
  const plus = useHasTier('plus');
  const loggedDays = useStore((s) => new Set(s.entries.map((e) => e.date)).size);
  const onboarded = useStore((s) => !!s.profile);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const name = useStore((s) => s.profile?.name);
  const nav = useNavigate();
  useEffect(() => {
    // ?whyplus=1 opens it on demand (for checking the wording); otherwise only after real use.
    if (!plus && new URLSearchParams(window.location.search).get('whyplus') === '1') { setOpen(true); return; }
    if (plus || !onboarded || loggedDays < 3) return;
    let last = 0;
    try { last = Number(localStorage.getItem(KEY) || 0); } catch { return; }
    if (Date.now() - last < WEEK) return;
    const t = setTimeout(() => { setOpen(true); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } }, 1500);
    return () => clearTimeout(t);
  }, [plus, onboarded, loggedDays]);
  if (plus || !open) return null;
  const first = (name ?? '').trim().split(/\s+/)[0];
  const close = () => { setOpen(false); setMore(false); };
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label="Reasons to try Plus">
      {!more ? (
        <>
          <div className="relative grid flex-[1.1] place-items-center bg-primary text-on-primary">
            <button onClick={close} className="pt-safe absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/10" aria-label="Close"><X size={22} /></button>
            <Award size={150} strokeWidth={1.25} aria-hidden />
          </div>
          <div className="flex-1 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-7">
            <h2 className="text-[26px] font-extrabold leading-tight tracking-tight">9 reasons to try Nutivili Plus</h2>
            <p className="mt-2 text-[16px]">{first ? `You’ve been showing up, ${first}. Here’s what’s next.` : 'You’ve been showing up. Here’s what’s next.'}</p>
            <p className="mt-4 text-[16px] leading-relaxed text-silver">If you want logging to take seconds and advice that actually knows your week, these are the biggest reasons people move to Plus.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={close} className="btn-ghost !h-12">No thanks</button>
              <button onClick={() => { haptic(); setMore(true); }} className="btn-primary !h-12">Read more</button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-safe">
          <div className="flex items-center justify-between pt-4">
            <h2 className="text-[22px] font-extrabold tracking-tight">Why Plus</h2>
            <button onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-raised" aria-label="Close"><X size={20} /></button>
          </div>
          <ol className="mt-4 space-y-3.5">
            {REASONS.map((r, i) => (
              <li key={r.t} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"><r.icon size={18} /></span>
                <span><span className="block font-bold">{i + 1}. {r.t}</span><span className="text-[14px] text-silver">{r.d}</span></span>
              </li>
            ))}
          </ol>
          <button onClick={() => { haptic(); close(); nav('/premium'); }} className="btn-primary mt-6 w-full">Explore Plus · $8.99/month</button>
          <p className="mt-2 text-center text-[13px] text-silver">or $44.99/year (save 58%). Cancel any time in two taps.</p>
          <button onClick={close} className="btn-ghost mt-2 w-full">Not now</button>
          <p className="mt-2 text-center text-[12px] text-dim">Everything you use today stays free.</p>
        </div>
      )}
    </div>,
    document.body,
  );
}
