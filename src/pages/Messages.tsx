import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ChefHat, Flag, Loader2, Search, ShieldOff } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useSession } from '@/lib/account';
import { blockUser, conversations, findUser, myUserId, reportMessage, sendDirect, thread, type Conversation, type DirectMessage, type PublicProfile } from '@/lib/social';
import { SharedRecipeCard, toShared } from '@/components/SharedRecipeCard';
import { SignInButtons } from '@/components/SignIn';
import { cx } from '@/components/ui';
import { haptic, toast } from '@/components/fx';

/** Private messages: chats with other Nutivili members, with recipes you can share and save. */
export default function Messages() {
  const nav = useNavigate();
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const open = params.get('with');
  const [list, setList] = useState<Conversation[] | null>(null);
  const [error, setError] = useState('');
  const [who, setWho] = useState('');
  const [finding, setFinding] = useState(false);
  const [partner, setPartner] = useState<(PublicProfile & { user_id: string }) | null>(null);

  const load = useCallback(() => { conversations().then(setList, (e: Error) => { setError(e.message); setList([]); }); }, []);
  useEffect(() => { if (session) load(); }, [session, load]);

  if (session === null) return <Shell back={() => nav(-1)}><div className="card p-5"><p className="mb-3 font-semibold">Sign in to send messages</p><SignInButtons /></div></Shell>;
  if (open) {
    const c = list?.find((x) => x.with === open);
    const profile = c?.profile ?? (partner?.user_id === open ? partner : undefined);
    return <Thread other={open} profile={profile} onBack={() => { setParams({}); load(); }} />;
  }

  return (
    <Shell back={() => nav(-1)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
          <input className="field !pl-11" placeholder="Message someone by @username" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Username" />
        </div>
        <button disabled={finding || who.replace(/^@/, '').trim().length < 3} onClick={async () => {
          setFinding(true); setError('');
          try {
            const u = await findUser(who.trim());
            if (!u) setError('No one with that username. Check the spelling.');
            else if (u.user_id === (await myUserId())) setError('That’s you!');
            else { setPartner(u); setParams({ with: u.user_id }); }
          } catch (e) { setError((e as Error).message); } finally { setFinding(false); }
        }} className="btn-primary !px-5">{finding ? <Loader2 size={17} className="animate-spin" /> : 'Chat'}</button>
      </div>
      {error && <p className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {list === null ? <p className="mt-6 flex justify-center text-silver"><Loader2 className="animate-spin" /></p> : list.length === 0 ? (
        <p className="card mt-4 p-5 text-sm text-silver">No messages yet. Find a friend by their @username above, then share a recipe or say hi.</p>
      ) : (
        <div className="card mt-4 divide-y divide-line p-1.5">
          {list.map((c) => (
            <button key={c.with} onClick={() => setParams({ with: c.with })} className="flex w-full items-center gap-3 px-3 py-3 text-left">
              <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-raised font-bold">{c.profile.photoUrl ? <img src={c.profile.photoUrl} alt="" className="h-full w-full object-cover" /> : c.profile.display_name.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.profile.display_name}{c.profile.username ? <span className="font-normal text-silver"> @{c.profile.username}</span> : null}</span>
                <span className={cx('block truncate text-sm', c.unread ? 'font-semibold text-ink' : 'text-silver')}>{c.last.recipe ? `Recipe: ${c.last.recipe.name}` : c.last.body}</span>
              </span>
              {c.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">{c.unread}</span>}
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, back, title = 'Messages' }: { children: React.ReactNode; back: () => void; title?: string }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-28 md:max-w-2xl">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 truncate text-[24px] font-extrabold tracking-tight">{title}</h1>
      </header>
      {children}
    </div>
  );
}

function Thread({ other, profile, onBack }: { other: string; profile?: PublicProfile; onBack: () => void }) {
  const [msgs, setMsgs] = useState<DirectMessage[] | null>(null);
  const [me, setMe] = useState<string>();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const customFoods = useStore((s) => s.customFoods);
  const recipes = useMemo(() => customFoods.filter((c) => c.recipe && !c.archived), [customFoods]);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(() => { thread(other).then(setMsgs, (e: Error) => { setError(e.message); setMsgs([]); }); }, [other]);
  useEffect(() => {
    void myUserId().then(setMe);
    load();
    // New messages: check every 8 seconds while the chat is open.
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);

  async function send(recipeId?: string) {
    const rec = recipes.find((r) => r.id === recipeId);
    if (!text.trim() && !rec) return;
    setBusy(true); setError('');
    try { await sendDirect(other, text, rec ? toShared(rec) ?? undefined : undefined); setText(''); setPicking(false); haptic(); load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Shell back={onBack} title={profile ? `${profile.display_name}${profile.username ? ` @${profile.username}` : ''}` : 'Chat'}>
      <div className="mb-3 flex gap-2">
        <button onClick={async () => { if (confirm('Block this person? They won’t be able to message you.')) { try { await blockUser(other); toast('Blocked'); onBack(); } catch (e) { toast((e as Error).message); } } }} className="chip !h-9"><ShieldOff size={14} /> Block</button>
      </div>
      {error && <p className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      <div className="space-y-2">
        {msgs === null && <p className="flex justify-center text-silver"><Loader2 className="animate-spin" /></p>}
        {msgs?.length === 0 && <p className="text-center text-sm text-silver">Say hi, or share one of your recipes.</p>}
        {msgs?.map((m) => {
          const mine = m.sender === me;
          return (
            <div key={m.id} className={cx('flex flex-col', mine ? 'items-end' : 'items-start')}>
              {m.body && <div className={cx('max-w-[85%] whitespace-pre-wrap rounded-[20px] px-4 py-2.5 text-[15px]', mine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-surface')}>{m.body}</div>}
              {m.recipe && <div className="w-full max-w-[92%] [&>div]:mx-0"><SharedRecipeCard recipe={m.recipe} /></div>}
              {!mine && <button onClick={async () => { const why = prompt('Why are you reporting this message?'); if (why != null) { try { await reportMessage(m.id, why); toast('Reported. Thank you.'); } catch (e) { toast((e as Error).message); } } }} className="mt-0.5 flex items-center gap-1 px-2 text-[11px] text-dim"><Flag size={11} /> Report</button>}
            </div>
          );
        })}
        <div ref={end} />
      </div>

      {picking && (
        <div className="card mt-3 p-3">
          <p className="mb-2 text-sm font-semibold">Share a recipe</p>
          {recipes.length ? recipes.map((r) => <button key={r.id} disabled={busy} onClick={() => void send(r.id)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[15px] active:bg-raised"><ChefHat size={16} className="text-accent" /> {r.name}</button>)
            : <p className="text-sm text-silver">No recipes yet. Create one from Add food → My recipes.</p>}
        </div>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg gap-2 bg-bg/95 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2 backdrop-blur-xl md:max-w-2xl">
        <button onClick={() => setPicking((v) => !v)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Share a recipe"><ChefHat size={19} /></button>
        <input className="field flex-1" maxLength={2000} placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} aria-label="Message" />
        <button disabled={busy || !text.trim()} onClick={() => void send()} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-on-primary" aria-label="Send">{busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={19} />}</button>
      </div>
    </Shell>
  );
}
