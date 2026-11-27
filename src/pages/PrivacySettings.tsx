import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSession } from '@/lib/account';
import { blockedList, getPrivacy, restrict, restrictedList, savePrivacy, unblock, DEFAULT_PRIVACY, type DmFrom, type Privacy } from '@/lib/dm';
import { upsertMyProfile, type PublicProfile } from '@/lib/social';
import { SignInButtons } from '@/components/SignIn';
import { cx } from '@/components/ui';
import { toast } from '@/components/fx';

const DM_OPTIONS: [DmFrom, string, string][] = [
  ['everyone', 'Everyone', 'People you don’t follow land in Requests'],
  ['following', 'People you follow', 'Others can’t start a chat with you'],
  ['followers', 'Your followers', 'Only people who follow you can message you'],
  ['nobody', 'Nobody', 'No new chats; people you’ve accepted can still reply'],
];
const NOTIFY: [string, string][] = [
  ['message', 'New messages'], ['request', 'Message requests'], ['request_accepted', 'Accepted requests'],
  ['follow', 'New followers'], ['like', 'Likes and reactions'], ['comment', 'Comments and replies'], ['security', 'Account and security'],
];
type Person = PublicProfile & { user_id: string };

/** Privacy & Security: who can contact you, what others see, blocked and restricted people, notifications and your data. */
export default function PrivacySettings() {
  const nav = useNavigate();
  const session = useSession();
  const [p, setP] = useState<Privacy | null>(null);
  const [blocked, setBlocked] = useState<Person[] | null>(null);
  const [restricted, setRestricted] = useState<Person[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!session) return;
    getPrivacy().then(setP, (e: Error) => { setErr(e.message); setP(DEFAULT_PRIVACY); });
    blockedList().then(setBlocked, () => setBlocked([]));
    restrictedList().then(setRestricted, () => setRestricted([]));
  }, [session]);
  const set = async (patch: Partial<Privacy>) => {
    if (!p) return;
    const next = { ...p, ...patch };
    setP(next);
    try { await savePrivacy(patch); toast('Saved'); } catch (e) { setP(p); toast((e as Error).message); }
  };
  const Toggle = ({ on, label, sub, onChange }: { on: boolean; label: string; sub?: string; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between gap-3 px-4 py-3">
      <span><span className="block font-semibold">{label}</span>{sub && <span className="text-[13px] text-silver">{sub}</span>}</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" />
    </label>
  );
  const People = ({ list, empty, action, onAction }: { list: Person[] | null; empty: string; action: string; onAction: (id: string) => Promise<void> }) => (
    list === null ? <p className="p-4 text-silver"><Loader2 size={16} className="animate-spin" /></p> : list.length === 0 ? <p className="px-4 py-3 text-[14px] text-silver">{empty}</p> : (
      <ul className="divide-y divide-line">
        {list.map((x) => (
          <li key={x.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 truncate font-semibold">{x.display_name}{x.username && <span className="font-normal text-silver"> @{x.username}</span>}</span>
            <button onClick={() => void onAction(x.user_id)} className="chip !h-9 shrink-0">{action}</button>
          </li>
        ))}
      </ul>
    )
  );

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-[24px] font-extrabold tracking-tight">Privacy &amp; security</h1>
      </header>
      {session === null ? <div className="card p-5"><p className="mb-3 font-semibold">Sign in to manage your privacy</p><SignInButtons /></div> : !p ? <p className="flex justify-center text-silver"><Loader2 className="animate-spin" /></p> : (
        <div className="space-y-5">
          {err && <p className="rounded-2xl bg-warn/15 px-4 py-3 text-[14px]">{err}</p>}
          <section>
            <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-silver">Who can message you</p>
            <div className="card divide-y divide-line p-1">
              {DM_OPTIONS.map(([v, l, sub]) => (
                <button key={v} onClick={() => void set({ dm_from: v })} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-pressed={p.dm_from === v}>
                  <span><span className="block font-semibold">{l}</span><span className="text-[13px] text-silver">{sub}</span></span>
                  <span className={cx('h-5 w-5 shrink-0 rounded-full border-2', p.dm_from === v ? 'border-[6px] border-primary' : 'border-line')} />
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-silver">Profile and activity</p>
            <div className="card divide-y divide-line p-1">
              <Toggle on={p.private_profile} label="Private profile" sub="Only your followers see your posts" onChange={(v) => void set({ private_profile: v })} />
              <Toggle on={p.read_receipts} label="Read receipts" sub="Off: people don’t see when you’ve read their messages" onChange={(v) => void set({ read_receipts: v })} />
              <Toggle on={p.show_activity} label="Show my streak and activity" sub="Off: your streak isn’t shown on your profile or leaderboards" onChange={(v) => { void set({ show_activity: v }); if (!v) void upsertMyProfile({ streak: 0 }).catch(() => undefined); }} />
            </div>
          </section>
          <p className="-mt-3 px-1 text-[12px] text-dim">Who you follow and who follows you is always private: nobody else can see those lists or counts.</p>
          <section>
            <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-silver">Notifications</p>
            <div className="card divide-y divide-line p-1">
              {NOTIFY.map(([k, l]) => <Toggle key={k} on={p.notify[k] !== false} label={l} onChange={(v) => void set({ notify: { ...p.notify, [k]: v } })} />)}
            </div>
          </section>
          <section>
            <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-silver">Blocked accounts</p>
            <div className="card p-1"><People list={blocked} empty="You haven’t blocked anyone." action="Unblock" onAction={async (id) => { try { await unblock(id); setBlocked((b) => (b ?? []).filter((x) => x.user_id !== id)); toast('Unblocked. They aren’t told.'); } catch (e) { toast((e as Error).message); } }} /></div>
            <p className="mt-2 px-1 text-[12px] text-dim">Blocked people can’t message you, follow you, find you, or see or react to your posts. They’re never told.</p>
          </section>
          <section>
            <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-silver">Restricted accounts</p>
            <div className="card p-1"><People list={restricted} empty="No restricted accounts." action="Unrestrict" onAction={async (id) => { try { await restrict(id, false); setRestricted((b) => (b ?? []).filter((x) => x.user_id !== id)); toast('Unrestricted'); } catch (e) { toast((e as Error).message); } }} /></div>
            <p className="mt-2 px-1 text-[12px] text-dim">A restricted person’s messages wait in Requests and they don’t see when you’ve read them.</p>
          </section>
          <section>
            <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-silver">Your data</p>
            <div className="card divide-y divide-line p-1">
              <Link to="/profile" className="block px-4 py-3 font-semibold">Download a copy of your data</Link>
              <Link to="/privacy" className="block px-4 py-3 font-semibold">Read the Privacy Policy</Link>
              <Link to="/profile" className="block px-4 py-3 font-semibold text-danger">Delete account and all data</Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
