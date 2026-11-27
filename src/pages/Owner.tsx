import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { OwnerStats } from '@/components/OwnerStats';
import { AiCosts } from '@/components/AiCosts';
import { PhotoReview } from '@/components/PhotoReview';
import { fetchUsage } from '@/lib/premium';

/** The owner's dashboard: sign-ups, retention, AI costs, revenue and margin. Only for emails in ADMIN_EMAILS (checked on the server). */
export default function Owner() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => { void fetchUsage().then((u) => setAdmin(!!u?.admin)).catch(() => setAdmin(false)); }, []);
  return (
    <div className="mx-auto max-w-lg px-5 pb-16">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <Link to="/profile" className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Owner dashboard</h1>
      </header>
      {admin === false && <p className="card p-5 text-sm leading-relaxed text-silver">This page is only for the app owner. Sign in with the email you put in <b className="text-ink">ADMIN_EMAILS</b> in Vercel (Settings → Environment Variables), then open it again.</p>}
      {admin && <><OwnerStats /><AiCosts /><PhotoReview /></>}
      {admin === null && <p className="text-sm text-silver">Loading…</p>}
    </div>
  );
}
