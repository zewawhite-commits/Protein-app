import { useState } from 'react';
import { signInWithEmail, signInWithGoogle } from '@/lib/account';
import { GoogleIcon } from './BrandIcons';

/** Google or email-link sign-in, reusable anywhere an account is needed. */
export function SignInButtons() {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  return (
    <div>
      <button onClick={() => signInWithGoogle().catch((e: Error) => setNote(e.message))} className="btn w-full bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}><GoogleIcon /> Continue with Google</button>
      <div className="mt-2 flex gap-2">
        <input type="email" inputMode="email" className="field !h-12 flex-1" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button
          disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
          onClick={() => signInWithEmail(email.trim()).then(() => setNote('Check your email for a sign-in link.'), (e: Error) => setNote(e.message))}
          className="btn-ghost !h-12 !px-4 text-sm"
        >
          Email link
        </button>
      </div>
      {note && <p className="mt-2 text-sm text-silver">{note}</p>}
    </div>
  );
}
