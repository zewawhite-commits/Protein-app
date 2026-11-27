import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { cleanPhone, validPhone, sendEmailCode, signInWithGoogle, signInWithPassword, verifyEmailCode } from '@/lib/account';
import { GoogleIcon } from './BrandIcons';
import { cx } from './ui';
import { getAuthDraft, setAuthDraft, setPending } from '@/lib/gate';
import { cleanInviteCode, saveInviteCode } from '@/lib/perks';

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const SENT_KEY = 'nutivili-code-sent';
const COOLDOWN = 60;

/** When the last code was sent to this address (kept across reloads, so the wait can't be skipped). */
function sentAt(email: string): number {
  try { const s = JSON.parse(localStorage.getItem(SENT_KEY) ?? 'null') as { email: string; at: number } | null; return s && s.email === email ? s.at : 0; } catch { return 0; }
}
function markSent(email: string, at = Date.now()) { try { localStorage.setItem(SENT_KEY, JSON.stringify({ email, at })); } catch { /* storage blocked */ } }

/** Seconds left before another code can be sent, ticking down live. */
function useCooldown(email: string): [number, (secs?: number) => void] {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((sentAt(email) + COOLDOWN * 1000 - Date.now()) / 1000));
  // The server can ask for a different wait ("after 16 seconds"): line our timer up with it.
  return [left, (secs = COOLDOWN) => markSent(email, Date.now() - (COOLDOWN - secs) * 1000)];
}

type Step = 'email' | 'code';

/**
 * Email accounts use a 6-digit code — no passwords and no links to open in another tab.
 * New people agree to the terms first; whoever is new then goes through the setup questions.
 */
export function EmailAuth({ start = 'signup', onBack, onPreview }: { start?: 'signup' | 'login'; onBack?: () => void; onPreview?: () => void }) {
  const saved = getAuthDraft();
  const [signup, setSignup] = useState(saved?.step === 'code' ? saved.signup : start === 'signup');
  const [step, setStep] = useState<Step>(saved?.step === 'code' ? 'code' : 'email');
  const [email, setEmail] = useState(saved?.step === 'code' ? saved.email : '');
  const [phone, setPhone] = useState('');
  const tel = cleanPhone(phone);
  const phoneOk = !phone.trim() || validPhone(tel);
  const [marketing, setMarketing] = useState(true);
  const [invite, setInvite] = useState('');
  const inviteOk = !invite.trim() || !!cleanInviteCode(invite);
  const [code, setCode] = useState('');
  const [usePw, setUsePw] = useState(false);
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const addr = email.trim().toLowerCase();
  const [wait, startWait] = useCooldown(addr);

  function toCode() {
    setStep('code'); setCode('');
    setAuthDraft({ step: 'code', email: addr, signup });
  }
  async function send() {
    if (busy || wait > 0) return;
    setErr(''); setBusy(true);
    try {
      if (signup && invite.trim() && cleanInviteCode(invite)) saveInviteCode(cleanInviteCode(invite)!);
      await sendEmailCode(addr, signup ? { phone: phone.trim() ? tel : undefined, marketing } : undefined);
      startWait();
      toCode();
    } catch (e) {
      // "Only after 16 seconds": a code was sent a moment ago — wait for it, with a countdown.
      const m = /after (\d+) seconds?/i.exec((e as Error).message);
      if (m) { startWait(Number(m[1])); toCode(); } else setErr((e as Error).message);
    } finally { setBusy(false); }
  }
  async function verify() {
    setErr(''); setBusy(true);
    try { await verifyEmailCode(addr, code); setAuthDraft(null); setPending(null); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const Spinner = busy ? <Loader2 size={18} className="animate-spin" /> : null;
  const error = err && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{err}</p>;

  if (step === 'code') {
    return (
      <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) void verify(); }}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent"><Mail size={26} /></span>
        <p className="text-center text-[19px] font-bold tracking-tight">Enter your code</p>
        <p className="text-center text-sm leading-relaxed text-silver">We sent a 6-digit code to <b className="text-ink">{addr}</b>.</p>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus aria-label="6-digit code" className="field text-center text-2xl font-semibold tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
        {error}
        <button type="submit" disabled={busy || code.length < 6} className="btn-primary">{Spinner} Continue</button>
        <button type="button" disabled={busy || wait > 0} onClick={() => void send()} className="h-10 text-sm font-semibold text-accent disabled:text-dim">
          {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
        </button>
        <p className="text-center text-[13px] text-dim">Can’t find it? Check spam or promotions.</p>
        <button type="button" onClick={() => { setStep('email'); setErr(''); setAuthDraft(null); }} className="h-9 text-sm font-semibold text-silver">Wrong email? Change it</button>
        {onPreview && signup && (
          <button type="button" onClick={() => { setPending(addr); onPreview(); }} className="btn-ghost mt-1 w-full">Look around first</button>
        )}
        {onPreview && signup && <p className="text-center text-[12px] text-dim">You can see the app now. Logging starts once you enter the code.</p>}
      </form>
    );
  }

  const ready = validEmail(addr) && (!signup || (phoneOk && inviteOk));
  const pwLogin = !signup && usePw;
  async function passwordLogin() {
    setErr(''); setBusy(true);
    try { await signInWithPassword(addr, pw); setAuthDraft(null); setPending(null); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); if (!ready) return; if (pwLogin) { if (pw) void passwordLogin(); } else void send(); }}>
      <p className="text-[19px] font-bold tracking-tight">{signup ? 'Create your account' : 'Welcome back'}</p>
      <button type="button" onClick={() => { setErr(''); signInWithGoogle().catch((e) => setErr((e as Error).message)); }} className="btn w-full bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}><GoogleIcon /> {signup ? 'Sign up with Google' : 'Continue with Google'}</button>
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-dim"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
      <input type="email" inputMode="email" autoComplete="email" aria-label="Email" className="field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {pwLogin && (
        <div className="relative">
          <input type={showPw ? 'text' : 'password'} autoComplete="current-password" aria-label="Password" className="field !pr-12" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-silver" aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
      )}
      {signup && (
        <>
          <input type="tel" inputMode="tel" autoComplete="tel" aria-label="Phone number (optional)" className={cx('field', !phoneOk && '!ring-2 !ring-danger')} placeholder="Phone number (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {!phoneOk && <p className="px-1 text-[13px] text-danger">Add your country code with + at the start.</p>}
          <input aria-label="Invite code (optional)" className={cx('field', !inviteOk && '!ring-2 !ring-danger')} placeholder="Friend’s invite code (optional)" value={invite} onChange={(e) => setInvite(e.target.value)} />
          {!inviteOk && <p className="px-1 text-[13px] text-danger">That code doesn’t look right. Paste the code or the whole invite link.</p>}
          <label className="flex items-start gap-2.5 px-1 text-[13px] leading-snug text-silver">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" aria-label="Email me tips and offers" />
            <span>Send me tips, recipes and offers. You can turn this off any time.</span>
          </label>
        </>
      )}
      {signup && <p className="px-1 text-[12px] text-dim">You’ll read and accept the <a href="/terms" target="_blank" className="font-semibold underline">Terms</a> and <a href="/privacy" target="_blank" className="font-semibold underline">Privacy Policy</a> before you start.</p>}
      {error}
      {pwLogin
        ? <button type="submit" disabled={busy || !ready || !pw} className="btn-primary">{Spinner} Log in</button>
        : <button type="submit" disabled={busy || !ready || wait > 0} className="btn-primary">{Spinner} {wait > 0 ? `Send code in ${wait}s` : 'Send me a code'}</button>}
      {!signup && (
        <button type="button" onClick={() => { setUsePw(!usePw); setErr(''); }} className="h-9 text-sm font-semibold text-accent">
          {usePw ? 'Email me a code instead' : 'Log in with a password instead'}
        </button>
      )}
      {pwLogin && <p className="-mt-1 text-center text-[12px] text-dim">Forgot it, or never set one? Use the code instead, then set a password in Profile → Settings.</p>}
      <p className="text-center text-sm text-silver">
        {signup ? 'Already have an account? ' : 'New here? '}
        <button type="button" onClick={() => { setSignup(!signup); setErr(''); setUsePw(false); }} className="font-semibold text-accent">{signup ? 'Log in' : 'Create an account'}</button>
      </p>
      {onBack && <button type="button" onClick={onBack} className="h-10 text-sm font-semibold text-silver">Back</button>}
    </form>
  );
}

/** Google, or an email account (sign up / log in), reusable anywhere an account is needed. */
export function SignInButtons() {
  const [err, setErr] = useState('');
  return (
    <div className="grid gap-3">
      <button onClick={() => signInWithGoogle().catch((e) => setErr((e as Error).message))} className="btn w-full bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}><GoogleIcon /> Continue with Google</button>
      <p className="-mt-1 text-center text-[12px] text-dim">By continuing with Google you agree to the <a href="/terms" target="_blank" className="font-semibold underline">Terms</a> and <a href="/privacy" target="_blank" className="font-semibold underline">Privacy Policy</a>.</p>
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-dim"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <EmailAuth start="signup" />
    </div>
  );
}
