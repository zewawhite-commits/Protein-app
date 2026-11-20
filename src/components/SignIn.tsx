import { useState } from 'react';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { cleanPhone, validPhone, resendSignupCode, signInWithEmail, signInWithGoogle, signInWithPassword, signUpWithPassword, verifyEmailCode, verifySignupCode } from '@/lib/account';
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
  // Remembered for this tab, so a reload while they open their email doesn't lose the screen.
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem('nutivili-auth') ?? 'null') as { step: Step; email: string } | null; } catch { return null; } })();
  const [step, setStep] = useState<Step>(saved?.step === 'confirm' ? 'confirm' : start);
  const [email, setEmail] = useState(saved?.step === 'confirm' ? saved.email : '');
  const [pw, setPw] = useState('');
  const [phone, setPhone] = useState('');
  const tel = cleanPhone(phone);
  const phoneOk = !phone.trim() || validPhone(tel);
  const [agreed, setAgreed] = useState(false);
  const [marketing, setMarketing] = useState(true);
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const addr = email.trim();
  const run = async (fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
    setErr(''); setNote(''); setBusy(true);
    // Run fn first: `after?.(await fn())` would skip fn entirely when there is no `after`.
    try { const r = await fn(); after?.(r); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const go = (s: Step) => {
    setErr(''); setNote(''); setCode(''); setShowCode(false); setStep(s);
    try { if (s === 'confirm') sessionStorage.setItem('nutivili-auth', JSON.stringify({ step: s, email: email.trim() })); else sessionStorage.removeItem('nutivili-auth'); } catch { /* storage blocked */ }
  };

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
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent"><Mail size={26} /></span>
        <p className="text-center text-[19px] font-bold tracking-tight">Check your email</p>
        <p className="text-center text-sm leading-relaxed text-silver">
          We sent an email to <b className="text-ink">{addr}</b>. Open it and tap <b className="text-ink">{confirming ? 'Confirm your mail' : 'Log in'}</b> — you’ll be {confirming ? 'signed in and ready to go' : 'logged straight in'}.
        </p>
        <p className="text-center text-[13px] text-dim">Can’t find it? Check your spam or promotions folder.</p>
        {messages}
        {!showCode ? (
          <button onClick={() => setShowCode(true)} className="h-10 text-sm font-semibold text-accent">Got a code instead? Enter it</button>
        ) : (
          <>
            {codeInput}
            <button disabled={busy || code.length < 6} onClick={() => run(() => (confirming ? verifySignupCode(addr, code) : verifyEmailCode(addr, code)))} className="btn-primary">
              {Spinner} {confirming ? 'Confirm and continue' : 'Log in'}
            </button>
          </>
        )}
        <div className="flex justify-between text-sm font-semibold text-silver">
          <button onClick={() => go(confirming ? 'signup' : 'login')}>Back</button>
          <button disabled={busy} onClick={() => run(() => (confirming ? resendSignupCode(addr) : signInWithEmail(addr)), () => setNote('A new email is on its way.'))}>Send the email again</button>
        </div>
      </div>
    );
  }

  const signup = step === 'signup';
  const pwOk = pw.length >= MIN_PW || (!signup && pw.length > 0);
  return (
    <form className="grid gap-2.5" onSubmit={(e) => {
      e.preventDefault();
      if (busy || !validEmail(addr) || !pwOk || (signup && (!phoneOk || !agreed))) return;
      if (signup) void run(() => signUpWithPassword(addr, pw, phone.trim() ? tel : undefined, marketing), (r) => { if (r === 'confirm') go('confirm'); });
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
      {signup && (
        <>
          <input type="tel" inputMode="tel" autoComplete="tel" aria-label="Phone number (optional)" className={cx('field', !phoneOk && '!ring-2 !ring-danger')} placeholder="Phone number (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {!phoneOk && <p className="px-1 text-[13px] text-danger">Add your country code with + at the start.</p>}
          <label className="flex items-start gap-3 px-1 py-1 text-[13px] leading-relaxed text-silver">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" aria-label="I agree to the Terms and Privacy Policy" />
            <span>I agree to the <a href="/terms" target="_blank" className="font-semibold text-accent underline">Terms</a> and <a href="/privacy" target="_blank" className="font-semibold text-accent underline">Privacy Policy</a>. Nutivili AI gives general wellness guidance, not medical advice.</span>
          </label>
          <label className="flex items-start gap-2.5 px-1 text-[13px] leading-snug text-silver">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" aria-label="Email me tips and offers" />
            <span>Send me tips, recipes and offers by email. Untick if you’d rather not — you can also turn it off any time in Settings.</span>
          </label>
          <p className="px-1 text-[13px] text-silver">We’ll email you a link to confirm your email.</p>
        </>
      )}
      {messages}
      <button type="submit" disabled={busy || !validEmail(addr) || !pwOk || (signup && (!phoneOk || !agreed))} className="btn-primary">{Spinner} {signup ? 'Create account' : 'Log in'}</button>
      {!signup && (
        <button type="button" disabled={busy} onClick={() => (validEmail(addr) ? run(() => signInWithEmail(addr), () => go('code')) : setErr('Type your email above first, then tap this again.'))} className="h-10 text-sm font-semibold text-accent">
          Forgot password? Email me a login link
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
      <p className="-mt-1 text-center text-[12px] text-dim">By continuing with Google you agree to the <a href="/terms" target="_blank" className="font-semibold underline">Terms</a> and <a href="/privacy" target="_blank" className="font-semibold underline">Privacy Policy</a>. General wellness guidance, not medical advice.</p>
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-dim"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <EmailAuth start="signup" />
    </div>
  );
}
