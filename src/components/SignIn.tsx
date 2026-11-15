import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { signInWithEmail, signInWithGoogle, signInWithPassword, verifyEmailCode } from '@/lib/account';
import { GoogleIcon } from './BrandIcons';

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Google or email-code sign-in, reusable anywhere an account is needed. */
export function SignInButtons() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [usePw, setUsePw] = useState(false);
  const [pw, setPw] = useState('');
  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setNote('');
    setBusy(true);
    try {
      await fn();
      after?.();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="grid gap-2">
        <p className="text-sm text-silver">Enter the 6-digit code we emailed to {email.trim()}</p>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="field text-center text-2xl font-semibold tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
        <button disabled={busy || code.length < 6} onClick={() => run(() => verifyEmailCode(email.trim(), code))} className="btn-primary">
          {busy && <Loader2 size={18} className="animate-spin" />} Sign in
        </button>
        <div className="flex justify-between text-sm font-semibold text-silver">
          <button onClick={() => { setSent(false); setCode(''); }}>Change email</button>
          <button onClick={() => run(() => signInWithEmail(email.trim()), () => setNote('New code sent.'))}>Send a new code</button>
        </div>
        {note && <p className="text-sm text-silver">{note}</p>}
      </div>
    );
  }
  return (
    <div>
      <button onClick={() => run(signInWithGoogle)} className="btn w-full bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}><GoogleIcon /> Continue with Google</button>
      <div className="mt-2 flex gap-2">
        <input type="email" inputMode="email" autoComplete="email" className="field !h-12 flex-1" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button disabled={busy || !validEmail(email)} onClick={() => run(() => signInWithEmail(email.trim()), () => setSent(true))} className="btn-ghost !h-12 !px-4 text-sm">
          {busy ? <Loader2 size={16} className="animate-spin" /> : 'Get code'}
        </button>
      </div>
      {usePw && (
        <div className="mt-2 flex gap-2">
          <input type="password" autoComplete="current-password" className="field !h-12 flex-1" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button disabled={busy || !validEmail(email) || pw.length < 6} onClick={() => run(() => signInWithPassword(email.trim(), pw))} className="btn-primary !h-12 !px-4 text-sm">Sign in</button>
        </div>
      )}
      <button onClick={() => setUsePw((v) => !v)} className="mt-2 text-sm font-semibold text-silver">{usePw ? 'Use an email code instead' : 'I have a password'}</button>
      {note && <p className="mt-2 text-sm text-silver">{note}</p>}
    </div>
  );
}
