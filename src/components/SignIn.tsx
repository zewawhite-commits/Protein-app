import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { resendSignupCode, signInWithEmail, signInWithGoogle, signInWithPassword, signUpWithPassword, verifyEmailCode, verifySignupCode } from '@/lib/account';
import { GoogleIcon } from './BrandIcons';
import { cx } from './ui';

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const MIN_PW = 8;

type Step = 'signup' | 'login' | 'confirm' | 'code';

/**
 * Email accounts: create one with a password, log in with it (no email needed, so no
 * email limits), or — if the password is forgotten — log in with a 6-digit code by email.
 * New accounts may need confirming with a code first, depending on the Supabase setting.
 */
export function EmailAuth({ start = 'signup', onBack }: { start?: 'signup' | 'login'; onBack?: () => void }) {
  const [step, setStep] = useState<Step>(start);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const addr = email.trim();
  const run = async (fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
    setErr(''); setNote(''); setBusy(true);
    // Run fn first: `after?.(await fn())` would skip fn entirely when there is no `after`.
    try { const r = await fn(); after?.(r); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const go = (s: Step) => { setErr(''); setNote(''); setCode(''); setStep(s); };

  const Spinner = busy ? <Loader2 size={18} className="animate-spin" /> : null;
  const messages = (
    <>
      {err && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{err}</p>}
      {note && <p className="rounded-2xl bg-accent/10 px-4 py-3 text-sm text-accent">{note}</p>}
    </>
  );
  const codeInput = (
    <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6-digit code" className="field text-center text-2xl font-semibold tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
  );

  if (step === 'confirm' || step === 'code') {
    const confirming = step === 'confirm';
    return (
      <div className="grid gap-2.5">
        <p className="text-[19px] font-bold tracking-tight">{confirming ? 'Confirm your email' : 'Check your email'}</p>
        <p className="text-sm text-silver">Enter the 6-digit code we sent to <b className="text-ink">{addr}</b>{confirming ? ', or tap the link in that email.' : '.'}</p>
        {codeInput}
        {messages}
        <button disabled={busy || code.length < 6} onClick={() => run(() => (confirming ? verifySignupCode(addr, code) : verifyEmailCode(addr, code)))} className="btn-primary">
          {Spinner} {confirming ? 'Confirm and continue' : 'Log in'}
        </button>
        <div className="flex justify-between text-sm font-semibold text-silver">
          <button onClick={() => go(confirming ? 'signup' : 'login')}>Back</button>
          <button disabled={busy} onClick={() => run(() => (confirming ? resendSignupCode(addr) : signInWithEmail(addr)), () => setNote('A new code is on its way.'))}>Send a new code</button>
        </div>
      </div>
    );
  }

  const signup = step === 'signup';
  const pwOk = pw.length >= MIN_PW || (!signup && pw.length > 0);
  return (
    <form className="grid gap-2.5" onSubmit={(e) => {
      e.preventDefault();
      if (busy || !validEmail(addr) || !pwOk) return;
      if (signup) void run(() => signUpWithPassword(addr, pw), (r) => { if (r === 'confirm') go('confirm'); });
      else void run(() => signInWithPassword(addr, pw));
    }}>
      <p className="text-[19px] font-bold tracking-tight">{signup ? 'Create your account' : 'Welcome back'}</p>
      <input type="email" inputMode="email" autoComplete="email" aria-label="Email" className="field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="relative">
        <input type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} aria-label="Password" className="field !pr-12" placeholder={signup ? `Password (at least ${MIN_PW} characters)` : 'Password'} value={pw} onChange={(e) => setPw(e.target.value)} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-silver" aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {signup && pw.length > 0 && pw.length < MIN_PW && <p className="px-1 text-[13px] text-silver">{MIN_PW - pw.length} more character{MIN_PW - pw.length === 1 ? '' : 's'} to go</p>}
      {messages}
      <button type="submit" disabled={busy || !validEmail(addr) || !pwOk} className="btn-primary">{Spinner} {signup ? 'Create account' : 'Log in'}</button>
      {!signup && (
        <button type="button" disabled={busy} onClick={() => (validEmail(addr) ? run(() => signInWithEmail(addr), () => go('code')) : setErr('Type your email above first, then tap this again.'))} className="h-10 text-sm font-semibold text-accent">
          Forgot password? Email me a code
        </button>
      )}
      <p className={cx('text-center text-sm text-silver', signup && 'mt-1')}>
        {signup ? 'Already have an account? ' : 'New here? '}
        <button type="button" onClick={() => go(signup ? 'login' : 'signup')} className="font-semibold text-accent">{signup ? 'Log in' : 'Create an account'}</button>
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
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-dim"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <EmailAuth start="signup" />
    </div>
  );
}
