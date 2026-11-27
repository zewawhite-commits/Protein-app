import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { X, Camera, ChefHat, ClipboardList, Dumbbell, MessageCircle, ShoppingBasket, Sparkle, TrendingUp, Utensils } from 'lucide-react';
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
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Hero: a glimpse of what Plus does, not a generic badge. */}
          <div className="relative shrink-0 overflow-hidden"  style={{ background: 'radial-gradient(120% 90% at 50% 0%, rgb(var(--accent) / .95), rgb(var(--accent) / .75) 45%, rgb(14 64 46) 100%)' }}>
            <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-black/20 blur-3xl" />
            <button onClick={close} className="absolute right-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md" style={{ top: 'max(env(safe-area-inset-top), 1rem)' }} aria-label="Close"><X size={20} /></button>
            <div className="relative flex h-full flex-col items-center justify-end gap-4 px-7 pb-7" style={{ paddingTop: 'calc(max(env(safe-area-inset-top), 1rem) + 3.5rem)' }}>
              <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-white backdrop-blur-md">Nutivili Plus</span>
              <div className="w-full max-w-[300px] space-y-3">
                <div className="ml-auto w-[88%] -rotate-[1.5deg] rounded-[20px] bg-white px-3.5 py-3 shadow-[0_14px_34px_rgb(0_0_0/.28)]">
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#13996B]">Your coach</p>
                  <p className="mt-1 text-[13px] leading-snug text-[#18201C]">Protein dipped midweek. Add eggs at breakfast to stay on track.</p>
                </div>
                <div className="w-[92%] rotate-1 rounded-[20px] bg-white px-3.5 py-3 shadow-[0_14px_34px_rgb(0_0_0/.28)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#13996B]/10 text-[#13996B]"><Camera size={18} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-[#18201C]">Plate scanned</span><span className="block text-[12px] leading-tight text-[#6B746F]">640 kcal · 42 g protein</span></span>
                    <span className="shrink-0 rounded-full bg-[#13996B] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">Unlimited</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-6">
            <h2 className="text-[28px] font-extrabold leading-[1.1] tracking-tight">{first ? `Nice work, ${first}.` : 'Nice work this week.'}<br /><span className="text-primary">Ready for more?</span></h2>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              {REASONS.slice(0, 3).map((r) => (
                <li key={r.t} className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><r.icon size={17} /></span><span className="font-semibold">{r.t}</span></li>
              ))}
            </ul>
            <div className="min-h-4 flex-1" />
            <button onClick={() => { haptic(); setMore(true); }} className="btn-primary mt-4 w-full !h-14 text-[16px]">See all 9 reasons</button>
            <button onClick={close} className="mt-2 h-11 w-full text-[15px] font-semibold text-silver">Not now</button>
            <p className="text-center text-[12px] text-dim">From $3.75/month billed yearly · cancel any time</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-safe">
          <div className="flex items-center justify-between pt-4">
            <h2 className="text-[22px] font-extrabold tracking-tight">Why Plus</h2>
            <button onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-raised" aria-label="Close"><X size={20} /></button>
          </div>
          <ol className="mt-4 space-y-3.5">
            {REASONS.map((r, i) => (
              <li key={r.t} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><r.icon size={18} /></span>
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
