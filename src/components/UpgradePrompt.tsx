import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChefHat, ClipboardList, Dumbbell, MessageCircle, ShoppingBasket, Sparkle, TrendingUp, Utensils } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useHasTier } from '@/lib/perks';
import { Sheet } from './ui';
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
  const nav = useNavigate();
  useEffect(() => {
    if (plus || !onboarded || loggedDays < 3) return;
    let last = 0;
    try { last = Number(localStorage.getItem(KEY) || 0); } catch { return; }
    if (Date.now() - last < WEEK) return;
    const t = setTimeout(() => { setOpen(true); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } }, 1500);
    return () => clearTimeout(t);
  }, [plus, onboarded, loggedDays]);
  if (plus) return null;
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="9 reasons to try Plus">
      <ul className="space-y-3">
        {REASONS.map((r) => (
          <li key={r.t} className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"><r.icon size={18} /></span>
            <span><span className="block font-bold">{r.t}</span><span className="text-[14px] text-silver">{r.d}</span></span>
          </li>
        ))}
      </ul>
      <button onClick={() => { haptic(); setOpen(false); nav('/premium'); }} className="btn-primary mt-5 w-full">Explore Plus · $8.99/month</button>
      <p className="mt-2 text-center text-[13px] text-silver">or $44.99/year (save 58%). Cancel any time in two taps.</p>
      <button onClick={() => setOpen(false)} className="btn-ghost mt-2 w-full">Not now</button>
      <p className="mt-2 text-center text-[12px] text-dim">Everything you use today stays free.</p>
    </Sheet>
  );
}
