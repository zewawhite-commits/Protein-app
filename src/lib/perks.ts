/**
 * Free Plus time on the app side: the one-off 3-day trial and invite-a-friend rewards.
 * The server decides (api/_lib/perks.ts); this just asks, remembers and shows.
 */
import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { aiHeaders, fetchUsage, isPremiumActive } from './premium';
import { useSession } from './account';
import { toast } from '@/components/fx';

const KEY = 'provora-invite';
const DAY = 864e5;

/** Codes people can type: the 22-character code, or a whole invite link pasted in. */
export function cleanInviteCode(raw: string): string | null {
  const m = /[?&]ref=([A-Za-z0-9_-]{22})/.exec(raw) ?? /^\s*([A-Za-z0-9_-]{22})\s*$/.exec(raw);
  return m ? m[1] : null;
}
/** Keep a typed code until sign-up finishes (same place as a code from a link). */
export function saveInviteCode(code: string) { try { localStorage.setItem(KEY, code); } catch { /* storage blocked */ } }

/** Use a friend's code on an account that already exists (new accounts only, once). */
export async function redeemInvite(code: string): Promise<{ days: number }> {
  const d = await post('invite', { code });
  await refreshPerks();
  return { days: d.days };
}

/** Remember an invite code from the link (?ref=…) until the person has an account. */
export function captureInvite() {
  try {
    const c = new URLSearchParams(location.search).get('ref');
    if (c && /^[A-Za-z0-9_-]{22}$/.test(c)) localStorage.setItem(KEY, c);
  } catch { /* storage blocked */ }
}

/** Same short code the server makes: the account id's 16 bytes in base64url. */
export function inviteCode(userId: string): string {
  const hex = userId.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) return '';
  const bytes = String.fromCharCode(...hex.match(/../g)!.map((h) => parseInt(h, 16)));
  return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const inviteLink = (userId: string) => `${location.origin}/?ref=${inviteCode(userId)}`;

export const daysLeft = (until: number) => Math.max(0, Math.ceil((until - Date.now()) / DAY));

/** True while the person has free Plus time. */
export function useFreePro(): { on: boolean; days: number } {
  const p = useStore((s) => s.perks);
  const on = !!p?.freePro && p.until > Date.now();
  return { on, days: on ? daysLeft(p!.until) : 0 };
}

/** Plus features available: a paid plan or free Plus time. */
export function useHasTier(_needs: 'plus' | 'pro'): boolean {
  const premium = useStore((s) => s.premium);
  const free = useFreePro().on;
  const server = useStore((s) => s.serverTier);
  const paid = isPremiumActive(premium); // one paid plan (Plus); older Plus passes count as Plus
  const onServer = server === 'pro' || server === 'plus';
  return paid || free || onServer;
}

async function post(path: 'trial' | 'invite', body: unknown = {}) {
  const r = await fetch(`/api/premium/${path}`, { method: 'POST', headers: await aiHeaders(), body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as { proUntil?: number; days?: number; error?: string };
  if (!r.ok) throw Object.assign(new Error(d.error || 'Something went wrong. Try again.'), { status: r.status });
  return d as { proUntil: number; days: number };
}

export async function refreshPerks() {
  const u = await fetchUsage();
  if (u) useStore.getState().setServerTier(u.tier);
  const p = u?.perks;
  useStore.getState().setPerks(p ? { until: p.proUntil, freePro: p.freePro, trialUsed: p.trialUsed, referrals: p.referrals, maxReferrals: p.maxReferrals, referralDays: p.referralDays } : null);
  return u;
}

export async function startTrial() {
  const d = await post('trial');
  await refreshPerks();
  return d;
}

/** After sign-in: accept a saved invite, then load the person's free Plus time. */
export function usePerksSync() {
  const session = useSession();
  const id = session?.user.id;
  useEffect(() => {
    if (!id) return;
    void (async () => {
      let code: string | null = null;
      try { code = localStorage.getItem(KEY); } catch { /* ignore */ }
      if (code) {
        try {
          const d = await post('invite', { code });
          toast(d.days ? `Invite accepted — enjoy ${d.days} days of Plus, free` : 'Invite accepted — your friend gets free Plus time');
          try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        } catch (e) {
          // Keep the code to retry only when the server had a problem; a refused invite is final.
          if (((e as { status?: number }).status ?? 500) < 500) try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        }
      }
      await refreshPerks();
    })();
  }, [id]);
}
