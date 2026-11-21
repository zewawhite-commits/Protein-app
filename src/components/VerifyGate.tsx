import { useEffect, useState } from 'react';
import { Loader2, Lock, Mail } from 'lucide-react';
import { sendEmailCode, useSession, verifyEmailCode } from '@/lib/account';
import { pendingEmail, setPending } from '@/lib/gate';
import { Sheet } from './ui';
import { toast } from './fx';

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Who is in look-only mode (asked for a code, hasn't typed it in yet). Updates live. */
export function usePendingEmail(): string | null {
  const [email, setEmail] = useState(pendingEmail);
  useEffect(() => {
    const f = () => setEmail(pendingEmail());
    window.addEventListener('nutivili-pending', f);
    window.addEventListener('storage', f);
    return () => { window.removeEventListener('nutivili-pending', f); window.removeEventListener('storage', f); };
  }, []);
  return email;
}

/**
 * Look-only mode: a slim bar on every screen, and the "enter your code" sheet that opens when
 * someone tries to log or save anything. Also lets them fix a wrong email and get a new code.
 */
export function VerifyGate() {
  const email = usePendingEmail();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sentNote, setSentNote] = useState('');

  useEffect(() => { const f = () => setOpen(true); window.addEventListener('nutivili-locked', f); return () => window.removeEventListener('nutivili-locked', f); }, []);
  // Signed in (code entered here or anywhere else): look-only mode ends.
  useEffect(() => { if (session && email) { setPending(null); setOpen(false); } }, [session, email]);
  if (!email || session) return null;

  async function verify() {
    setErr(''); setBusy(true);
    try { await verifyEmailCode(email!, code); setPending(null); setOpen(false); toast('Email confirmed. You can log now.'); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function resend(to = email!) {
    setErr(''); setBusy(true);
    try {
      await sendEmailCode(to);
      if (to !== email) { setPending(to); setChanging(false); setNewEmail(''); }
      setCode(''); setSentNote(`New code sent to ${to}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <div aria-hidden style={{ height: 'calc(max(env(safe-area-inset-top), 8px) + 28px)' }} />
      <button onClick={() => setOpen(true)} className="fixed inset-x-0 top-0 z-50 flex w-full items-center justify-center gap-2 bg-ink px-4 pb-2 text-[13px] font-semibold text-bg" style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)' }}>
        <Lock size={14} /> Look-only mode · Enter your email code to start logging
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Confirm your email">
        <div className="grid gap-3 pb-2">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent"><Mail size={26} /></span>
          {!changing ? (
            <>
              <p className="text-center text-sm leading-relaxed text-silver">To log food, weight or workouts, enter the 6-digit code we sent to <b className="text-ink">{email}</b>. You can keep looking around until then.</p>
              <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) void verify(); }}>
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6-digit code" className="field text-center text-2xl font-semibold tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
                {err && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{err}</p>}
                {sentNote && !err && <p className="text-center text-[13px] text-accent">{sentNote}</p>}
                <button type="submit" disabled={busy || code.length < 6} className="btn-primary">{busy && <Loader2 size={18} className="animate-spin" />} Confirm</button>
              </form>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={busy} onClick={() => void resend()} className="btn-ghost">Resend code</button>
                <button disabled={busy} onClick={() => { setChanging(true); setErr(''); }} className="btn-ghost">Change email</button>
              </div>
              <p className="text-center text-[13px] text-dim">Can’t find it? Check spam or promotions.</p>
            </>
          ) : (
            <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); if (validEmail(newEmail)) void resend(newEmail.trim().toLowerCase()); }}>
              <p className="text-center text-sm text-silver">Typed it wrong? Enter the right email and we’ll send a new code there.</p>
              <input type="email" inputMode="email" autoComplete="email" aria-label="New email" className="field" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoFocus />
              {err && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{err}</p>}
              <button type="submit" disabled={busy || !validEmail(newEmail)} className="btn-primary">{busy && <Loader2 size={18} className="animate-spin" />} Send code to this email</button>
              <button type="button" onClick={() => setChanging(false)} className="h-10 text-sm font-semibold text-silver">Back</button>
            </form>
          )}
        </div>
      </Sheet>
    </>
  );
}
