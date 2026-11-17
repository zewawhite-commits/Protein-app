import { useState } from 'react';
import { BadgeCheck, Copy, Gift, Loader2, Share2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { isPremiumActive } from '@/lib/premium';
import { useSession } from '@/lib/account';
import { inviteLink, startTrial, useFreePro } from '@/lib/perks';
import { haptic, toast } from './fx';
import { cx } from './ui';

/** "Try Pro free for 3 days" — once per account, no card. Hidden when it doesn't apply. */
export function TrialCard({ className }: { className?: string }) {
  const session = useSession();
  const perks = useStore((s) => s.perks);
  const paid = useStore((s) => isPremiumActive(s.premium));
  const serverTier = useStore((s) => s.serverTier);
  const free = useFreePro();
  const [busy, setBusy] = useState(false);
  // A paid plan (this phone or the account) never needs the trial offer.
  if (paid || (!free.on && (serverTier === 'plus' || serverTier === 'pro'))) return null;
  if (free.on) {
    return (
      <div className={cx('flex items-center gap-3 rounded-[22px] bg-accent/10 px-4 py-3.5 text-accent', className)}>
        <BadgeCheck size={18} className="shrink-0" />
        <p className="text-[14px] font-semibold">You have Pro free for {free.days} more day{free.days === 1 ? '' : 's'}. No card, nothing to cancel.</p>
      </div>
    );
  }
  if (!session || !perks || perks.trialUsed) return null;
  return (
    <div className={cx('card p-5', className)}>
      <p className="text-[17px] font-bold">Try Pro free for 3 days</p>
      <p className="mt-1 text-[14px] leading-relaxed text-silver">Every Pro feature — AI scans, coach, workouts, recipes, eating plans and meal ideas. No card needed, and it simply ends after 3 days; nothing renews.</p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try { const d = await startTrial(); haptic([10, 40, 10]); toast(`Pro is on for ${d.days} days — enjoy`); }
          catch (e) { toast((e as Error).message); }
          finally { setBusy(false); }
        }}
        className="btn-primary mt-4 w-full"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />} Start my free week
      </button>
    </div>
  );
}

/** Invite friends: they get 14 days of Pro, you get 7 days for each friend who joins. */
export function InviteCard({ className }: { className?: string }) {
  const session = useSession();
  const perks = useStore((s) => s.perks);
  if (!session || !perks) return null;
  const link = inviteLink(session.user.id);
  const left = Math.max(0, perks.maxReferrals - perks.referrals);
  const share = async () => {
    haptic();
    const text = `I track my food with Nutivili AI — snap a meal and it works out the nutrition. Join with my link and get 14 days of Pro free:`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Nutivili AI', text, url: link }); return; }
    } catch { return; /* closed the share sheet */ }
    try { await navigator.clipboard.writeText(`${text} ${link}`); toast('Invite link copied'); } catch { toast(link); }
  };
  return (
    <div className={cx('card p-5', className)}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent"><Gift size={20} /></span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold">Invite friends, get Pro</p>
          <p className="mt-0.5 text-[14px] leading-relaxed text-silver">
            Friends who join with your link get 14 days of Pro free. You get {perks.referralDays} days of Pro for each one, up to {perks.maxReferrals} friends.
          </p>
        </div>
      </div>
      {perks.referrals > 0 && (
        <p className="mt-3 rounded-2xl bg-raised px-4 py-2.5 text-[14px] font-semibold">
          {perks.referrals} friend{perks.referrals === 1 ? '' : 's'} joined · {perks.referrals * perks.referralDays} days of Pro earned{left === 0 ? ' · that’s the maximum' : ''}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={share} className="btn-primary flex-1"><Share2 size={17} /> Share invite</button>
        <button onClick={async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch { toast(link); } }} className="btn-ghost !w-14 !px-0" aria-label="Copy invite link"><Copy size={17} /></button>
      </div>
    </div>
  );
}
