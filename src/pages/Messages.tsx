import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, ArrowLeft, ArrowUp, BellOff, ChefHat, Copy, Download, FileText, Flag, Loader2, MoreHorizontal, Paperclip, Pencil, Reply, Search, ShieldOff, Trash2, UserMinus, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useSession } from '@/lib/account';
import { acceptChat, findUser, myUserId, setFollow, type PublicProfile } from '@/lib/social';
import {
  block, chats, checkFile, clearChat, declineRequest, deleteDM, editDM, fileUrl, loadThread, reactDM, REACTIONS, report, REPORT_CATEGORIES, restrict,
  searchMessages, sendDM, setArchived, setMuted, uploadDMFile, watchMessages, FILE_TYPES, type Attachment, type ChatSummary, type DM, type ReportCategory,
} from '@/lib/dm';
import { SharedRecipeCard, toShared } from '@/components/SharedRecipeCard';
import { SignInButtons } from '@/components/SignIn';
import { Segmented, Sheet, cx } from '@/components/ui';
import { haptic, toast } from '@/components/fx';

type Tab = 'inbox' | 'requests' | 'archived';

/** Private messages: real-time chats, requests from people you don't follow, files, replies and reactions. */
export default function Messages() {
  const nav = useNavigate();
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const open = params.get('with');
  const sending = params.get('recipe') ?? '';
  const postId = params.get('post');
  const postTitle = params.get('title') ?? '';
  const keep = { ...(sending ? { recipe: sending } : {}), ...(postId ? { post: postId, title: postTitle } : {}) };
  const sendingName = useStore((s) => s.customFoods.find((c) => c.id === sending)?.name);
  const [list, setList] = useState<ChatSummary[] | null>(null);
  const [error, setError] = useState('');
  const [who, setWho] = useState('');
  const [finding, setFinding] = useState(false);
  const [partner, setPartner] = useState<(PublicProfile & { user_id: string }) | null>(null);
  const [tab, setTab] = useState<Tab>('inbox');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<DM[] | null>(null);

  const load = useCallback(() => { chats().then(setList, (e: Error) => { setError(e.message); setList([]); }); }, []);
  useEffect(() => { if (!session) return; load(); return watchMessages(load); }, [session, load]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return; }
    const t = setTimeout(() => { searchMessages(q).then(setHits, () => setHits([])); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (session === null) return <Shell back={() => nav(-1)}><div className="card p-5"><p className="mb-3 font-semibold">Sign in to send messages</p><SignInButtons /></div></Shell>;
  if (open) {
    const c = list?.find((x) => x.with === open);
    const profile = c?.profile ?? (partner?.user_id === open ? partner : undefined);
    return <Thread other={open} chat={c} profile={profile} preRecipe={sending} prePost={postId ? { post_id: postId, title: postTitle } : undefined} onBack={() => { setParams(keep); load(); }} />;
  }

  const counts = { requests: list?.filter((c) => c.request && !c.archived).length ?? 0, archived: list?.filter((c) => c.archived).length ?? 0 };
  const needle = q.trim().toLowerCase();
  const shown = (list ?? []).filter((c) => (tab === 'archived' ? c.archived : !c.archived && c.request === (tab === 'requests')))
    .filter((c) => !needle || `${c.profile.display_name} ${c.profile.username ?? ''}`.toLowerCase().includes(needle));
  const nameOf = (id: string) => list?.find((c) => c.with === id)?.profile.display_name ?? 'Chat';

  return (
    <Shell back={() => nav(-1)} right={<Link to="/privacy-settings" className="chip !h-10">Privacy</Link>}>
      {sendingName && <p className="mb-3 rounded-2xl bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">Choose who to send “{sendingName}” to.</p>}
      {postId && <p className="mb-3 rounded-2xl bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">Choose who to send the post “{postTitle}” to.</p>}
      <div className="flex gap-2">
        <input className="field flex-1" placeholder="Message someone by @username" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Username" />
        <button disabled={finding || who.replace(/^@/, '').trim().length < 3} onClick={async () => {
          setFinding(true); setError('');
          try {
            const u = await findUser(who.trim());
            if (!u) setError('No one with that username. Check the spelling.');
            else if (u.user_id === (await myUserId())) setError('That’s you!');
            else { setPartner(u); setParams({ with: u.user_id, ...keep }); }
          } catch (e) { setError((e as Error).message); } finally { setFinding(false); }
        }} className="btn-primary !px-5">{finding ? <Loader2 size={17} className="animate-spin" /> : 'Chat'}</button>
      </div>
      <label className="relative mt-3 block">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
        <input className="field !pl-11" placeholder="Search chats and messages" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search chats and messages" />
      </label>
      {error && <p className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {hits && hits.length > 0 && (
        <div className="card mt-3 divide-y divide-line p-1.5">
          <p className="px-3 py-2 text-[12px] font-semibold text-silver">Messages</p>
          {hits.slice(0, 12).map((m) => {
            const other = list?.find((c) => c.with === m.sender || c.with === m.recipient)?.with ?? (m.sender);
            return (
              <button key={m.id} onClick={() => setParams({ with: other })} className="block w-full px-3 py-2.5 text-left">
                <span className="block text-[13px] font-semibold">{nameOf(other)}</span>
                <span className="block truncate text-[14px] text-silver">{m.body}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4"><Segmented full value={tab} onChange={setTab} options={[{ value: 'inbox', label: 'Inbox' }, { value: 'requests', label: `Requests${counts.requests ? ` (${counts.requests})` : ''}` }, { value: 'archived', label: `Archived${counts.archived ? ` (${counts.archived})` : ''}` }]} /></div>
      {tab === 'requests' && <p className="mt-3 px-1 text-[13px] text-silver">Messages from people you don’t follow wait here. They can’t see whether you’ve read them. Accept to reply, or delete, block or report.</p>}
      {list === null ? <p className="mt-6 flex justify-center text-silver"><Loader2 className="animate-spin" /></p> : shown.length === 0 ? (
        <p className="card mt-4 p-5 text-sm text-silver">{tab === 'requests' ? 'No message requests.' : tab === 'archived' ? 'No archived chats.' : 'No messages yet. Find a friend by their @username above, then share a recipe, a photo or say hi.'}</p>
      ) : (
        <div className="card mt-4 divide-y divide-line p-1.5">
          {shown.map((c) => (
            <button key={c.with} onClick={() => setParams({ with: c.with, ...keep })} className="flex w-full items-center gap-3 px-3 py-3 text-left">
              <Avatar p={c.profile} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate font-semibold">{c.profile.display_name}{c.profile.username ? <span className="font-normal text-silver">@{c.profile.username}</span> : null}{c.muted && <BellOff size={13} className="shrink-0 text-dim" aria-label="Muted" />}</span>
                <span className={cx('block truncate text-sm', c.unread ? 'font-semibold text-ink' : 'text-silver')}>{preview(c.last as DM)}</span>
              </span>
              {c.unread > 0 && !c.muted && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">{c.unread}</span>}
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

const preview = (m: DM) => (m.attachment ? (m.attachment.type.startsWith('image/') ? '📷 Photo' : m.attachment.type.startsWith('video/') ? '🎬 Video' : `📄 ${m.attachment.name}`) : m.recipe ? `Recipe: ${m.recipe.name}` : m.shared_post ? `Post: ${m.shared_post.title}` : m.body ?? '');

function Avatar({ p, size = 44 }: { p?: PublicProfile; size?: number }) {
  return <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-raised font-bold" style={{ width: size, height: size }}>{p?.photoUrl ? <img src={p.photoUrl} alt="" className="h-full w-full object-cover" /> : (p?.display_name ?? '?').slice(0, 1)}</span>;
}

function Shell({ children, back, title = 'Messages', right }: { children: React.ReactNode; back: () => void; title?: string; right?: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-32">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-extrabold tracking-tight">{title}</h1>
        {right}
      </header>
      {children}
    </div>
  );
}

/** Pick a reason and send a report. The person reported isn't told who reported them. */
export function ReportSheet({ open, onClose, target, what = 'this' }: { open: boolean; onClose: () => void; target: Parameters<typeof report>[0]; what?: string }) {
  const [cat, setCat] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={`Report ${what}`}>
      <div className="grid gap-2">
        {REPORT_CATEGORIES.map(([v, l]) => <button key={v} onClick={() => setCat(v)} aria-pressed={cat === v} className={cx('chip !h-11 justify-start !px-4', cat === v && 'chip-on')}>{l}</button>)}
      </div>
      <textarea className="field mt-3 !h-24 py-3" maxLength={1000} placeholder="Anything else we should know? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
      <button disabled={!cat || busy} onClick={async () => { setBusy(true); try { await report(target, cat!, details); toast('Reported. Thank you — our team will review it.'); setCat(null); setDetails(''); onClose(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); } }} className="btn-primary mt-4 w-full">{busy && <Loader2 size={17} className="animate-spin" />} Send report</button>
      <p className="mt-2 text-center text-[12px] text-dim">Reports are private. If someone is in danger, contact local emergency services.</p>
    </Sheet>
  );
}

function Thread({ other, chat, profile, onBack, preRecipe, prePost }: { other: string; chat?: ChatSummary; profile?: PublicProfile; onBack: () => void; preRecipe?: string; prePost?: { post_id: string; title: string } }) {
  const [postToSend, setPostToSend] = useState(prePost);
  const request = !!chat?.request;
  const [accepted, setAccepted] = useState(false);
  const [msgs, setMsgs] = useState<DM[] | null>(null);
  const [reactions, setReactions] = useState<Record<string, { user_id: string; emoji: string }[]>>({});
  const [me, setMe] = useState<string>();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(!!preRecipe);
  const [replyTo, setReplyTo] = useState<DM | null>(null);
  const [editing, setEditing] = useState<DM | null>(null);
  const [act, setAct] = useState<DM | null>(null);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState<Parameters<typeof report>[0] | null>(null);
  const [file, setFile] = useState<{ file: File; url: string } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; m: DM } | null>(null);
  const [muted, setMutedState] = useState(!!chat?.muted);
  const [archived, setArchivedState] = useState(!!chat?.archived);
  const customFoods = useStore((s) => s.customFoods);
  const recipes = useMemo(() => customFoods.filter((c) => c.recipe && !c.archived), [customFoods]);
  const end = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => { loadThread(other).then(({ msgs: m, reactions: r }) => { setMsgs((cur) => [...m, ...(cur ?? []).filter((x) => x.pending)]); setReactions(r); }, (e: Error) => { setError(e.message); setMsgs([]); }); }, [other]);
  useEffect(() => {
    void myUserId().then(setMe);
    load();
    const stop = watchMessages(load);
    // Backup in case live updates are off: check every 15 seconds while the chat is open.
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000);
    return () => { stop(); clearInterval(t); };
  }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);
  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);

  async function send(recipeId?: string) {
    const rec = recipes.find((r) => r.id === recipeId);
    if (editing) {
      if (!text.trim()) return;
      try { await editDM(editing.id, text); setEditing(null); setText(''); load(); toast('Edited'); } catch (e) { toast((e as Error).message); }
      return;
    }
    if (!text.trim() && !rec && !file) return;
    const temp: DM = { id: `tmp-${Date.now()}`, sender: me ?? '', recipient: other, body: text.trim() || null, recipe: rec ? toShared(rec) ?? null : null, created_at: new Date().toISOString(), read_at: null, reply_to: replyTo?.id ?? null, pending: 'sending', attachment: file ? { path: '', name: file.file.name, type: file.file.type, size: file.file.size } : null };
    setMsgs((cur) => [...(cur ?? []), temp]);
    const body = text, reply = replyTo, f = file;
    setText(''); setReplyTo(null); setFile(null); setPicking(false); setError('');
    try {
      const attachment: Attachment | null = f ? await uploadDMFile(other, f.file) : null;
      await sendDM(other, { body, reply_to: reply?.id ?? null, recipe: temp.recipe, attachment });
      haptic();
      setMsgs((cur) => (cur ?? []).filter((x) => x.id !== temp.id));
      load();
    } catch (e) {
      setMsgs((cur) => (cur ?? []).map((x) => (x.id === temp.id ? { ...x, pending: 'failed' } : x)));
      setError((e as Error).message);
    }
  }

  const status = (m: DM) => (m.pending === 'sending' ? 'Sending…' : m.pending === 'failed' ? 'Not sent' : m.read_at ? 'Read' : m.delivered_at ? 'Delivered' : 'Sent');
  const byId = new Map((msgs ?? []).map((m) => [m.id, m]));
  const canWrite = !request || accepted;
  const name = profile?.display_name ?? 'this person';

  return (
    <Shell back={onBack} title={profile ? `${profile.display_name}${profile.username ? ` @${profile.username}` : ''}` : 'Chat'} right={<button onClick={() => setMenu(true)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Chat options"><MoreHorizontal size={20} /></button>}>
      {request && !accepted && (
        <div className="card mb-3 p-4">
          <p className="text-[15px] font-semibold">Message request</p>
          <p className="mt-1 text-sm text-silver">{name} wants to message you. They won’t know you’ve seen this unless you accept.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={async () => { try { await acceptChat(other); setAccepted(true); haptic(); toast('Accepted — this chat is in your Inbox now'); } catch (e) { toast((e as Error).message); } }} className="btn-primary !h-11">Accept</button>
            <button onClick={async () => { if (!confirm('Delete this request? The messages are removed for you.')) return; try { await declineRequest(other); toast('Request deleted'); onBack(); } catch (e) { toast((e as Error).message); } }} className="btn-ghost !h-11">Delete</button>
            <button onClick={async () => { if (!confirm(`Block ${name}? They can’t message you, see your posts or find you, and won’t be told.`)) return; try { await block(other); toast('Blocked'); onBack(); } catch (e) { toast((e as Error).message); } }} className="btn-ghost !h-11"><ShieldOff size={15} /> Block</button>
            <button onClick={() => setReporting({ type: 'user', id: other, user: other })} className="btn-ghost !h-11"><Flag size={15} /> Report</button>
          </div>
          <button onClick={async () => { try { await Promise.all([acceptChat(other), setFollow(other, true)]); setAccepted(true); haptic(); toast('Accepted and following'); } catch (e) { toast((e as Error).message); } }} className="mt-2 w-full text-sm font-semibold text-accent">Accept &amp; follow back</button>
        </div>
      )}
      {error && <p className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      <div className="space-y-2">
        {msgs === null && <p className="flex justify-center text-silver"><Loader2 className="animate-spin" /></p>}
        {msgs?.length === 0 && <p className="text-center text-sm text-silver">Say hi, or share a photo or one of your recipes.</p>}
        {msgs?.map((m, i) => {
          const mine = m.sender === me;
          const quoted = m.reply_to ? byId.get(m.reply_to) : undefined;
          const rs = reactions[m.id] ?? [];
          const lastMine = mine && !msgs.slice(i + 1).some((x) => x.sender === me);
          return (
            <div key={m.id} className={cx('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <button onClick={() => !m.pending && setAct(m)} className={cx('flex max-w-[85%] flex-col text-left', mine ? 'items-end' : 'items-start')} aria-label="Message options">
                {quoted && <span className="mb-1 max-w-full truncate rounded-xl border-l-4 border-accent bg-raised px-3 py-1.5 text-[12px] text-silver">{preview(quoted)}</span>}
                {m.attachment && <AttachmentView m={m} onOpen={(url) => setViewer({ url, m })} />}
                {m.body && <span className={cx('whitespace-pre-wrap rounded-[20px] px-4 py-2.5 text-[15px]', mine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-surface', m.pending === 'failed' && 'opacity-60')}>{m.body}</span>}
                {m.shared_post && <Link to="/groups" onClick={(e) => e.stopPropagation()} className="mt-1 rounded-2xl bg-surface px-4 py-2.5 text-[14px]" style={{ boxShadow: 'var(--shadow)' }}>Shared post: <b>{m.shared_post.title}</b> <span className="text-accent">· Open feed</span></Link>}
              </button>
              {m.recipe && <div className="w-full max-w-[92%] [&>div]:mx-0"><SharedRecipeCard recipe={m.recipe} /></div>}
              {rs.length > 0 && <span className="mt-0.5 rounded-full bg-surface px-2 py-0.5 text-[13px]" style={{ boxShadow: 'var(--shadow)' }}>{rs.map((r) => r.emoji).join(' ')}</span>}
              <span className="mt-0.5 px-2 text-[11px] text-dim">
                {m.edited_at ? 'Edited · ' : ''}{new Date(m.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                {mine && (lastMine || m.pending) && ` · ${status(m)}`}
                {m.pending === 'failed' && <button onClick={() => { setMsgs((cur) => (cur ?? []).filter((x) => x.id !== m.id)); setText(m.body ?? ''); }} className="ml-1 font-semibold text-accent">Retry</button>}
              </span>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      {postToSend && canWrite && (
        <div className="card mt-3 flex items-center gap-3 p-3">
          <span className="min-w-0 flex-1 truncate text-[14px]">Send post: <b>{postToSend.title}</b></span>
          <button onClick={async () => { try { await sendDM(other, { body: text, shared_post: postToSend }); setText(''); setPostToSend(undefined); haptic(); toast('Post sent'); load(); } catch (e) { toast((e as Error).message); } }} className="chip chip-on !h-9">Send</button>
          <button onClick={() => setPostToSend(undefined)} aria-label="Don’t send"><X size={16} /></button>
        </div>
      )}
      {picking && canWrite && (
        <div className="card mt-3 p-3">
          <p className="mb-2 text-sm font-semibold">Share a recipe</p>
          {recipes.length ? recipes.map((r) => <button key={r.id} onClick={() => void send(r.id)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[15px] active:bg-raised"><ChefHat size={16} className="text-accent" /> {r.name}</button>)
            : <p className="text-sm text-silver">No recipes yet. Build one from + → Build a meal.</p>}
        </div>
      )}
      {canWrite && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg bg-bg/95 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2 backdrop-blur-xl">
          {(replyTo || editing) && (
            <div className="mb-2 flex items-center gap-2 rounded-2xl bg-raised px-3 py-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate"><b>{editing ? 'Editing' : 'Replying to'}</b> · {preview((editing ?? replyTo)!)}</span>
              <button onClick={() => { setReplyTo(null); if (editing) { setEditing(null); setText(''); } }} aria-label="Cancel"><X size={16} /></button>
            </div>
          )}
          {file && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-raised p-2">
              {file.file.type.startsWith('image/') ? <img src={file.url} alt="Preview" className="h-16 w-16 rounded-xl object-cover" /> : file.file.type.startsWith('video/') ? <video src={file.url} className="h-16 w-16 rounded-xl object-cover" muted /> : <FileText size={28} className="m-3" />}
              <span className="min-w-0 flex-1 truncate text-[13px]">{file.file.name}<span className="block text-dim">{(file.file.size / 1024 / 1024).toFixed(1)} MB · preview</span></span>
              <button onClick={() => setFile(null)} className="grid h-9 w-9 place-items-center" aria-label="Remove file"><X size={16} /></button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Send a photo, video or file"><Paperclip size={19} /></button>
            <button onClick={() => setPicking((v) => !v)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Share a recipe"><ChefHat size={19} /></button>
            <input className="field flex-1" maxLength={2000} placeholder={editing ? 'Edit message' : 'Message'} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} aria-label="Message" />
            <button disabled={!text.trim() && !file} onClick={() => void send()} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-on-primary" aria-label={editing ? 'Save edit' : 'Send'}><ArrowUp size={19} /></button>
          </div>
          <input ref={fileRef} type="file" hidden accept={FILE_TYPES.join(',')} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const bad = checkFile(f); if (bad) { toast(bad); return; } setFile({ file: f, url: URL.createObjectURL(f) }); }} />
        </div>
      )}

      {/* One message: reply, react, copy, edit, delete or report. */}
      <Sheet open={!!act} onClose={() => setAct(null)} title="Message">
        {act && (
          <>
            <div className="flex justify-between gap-1" role="group" aria-label="React">
              {REACTIONS.map((e) => {
                const on = (reactions[act.id] ?? []).some((r) => r.user_id === me && r.emoji === e);
                return <button key={e} onClick={async () => { const m = act; setAct(null); try { await reactDM(m.id, on ? null : e); load(); } catch (err) { toast((err as Error).message); } }} className={cx('grid h-11 w-11 place-items-center rounded-full text-[22px]', on ? 'bg-accent/20' : 'bg-raised')} aria-pressed={on}>{e}</button>;
              })}
            </div>
            <div className="mt-4 grid gap-2">
              {canWrite && <button onClick={() => { setReplyTo(act); setEditing(null); setAct(null); }} className="btn-ghost w-full justify-start"><Reply size={16} /> Reply</button>}
              {act.body && <button onClick={() => { void navigator.clipboard?.writeText(act.body ?? ''); toast('Copied'); setAct(null); }} className="btn-ghost w-full justify-start"><Copy size={16} /> Copy text</button>}
              {act.sender === me && act.body && <button onClick={() => { setEditing(act); setReplyTo(null); setText(act.body ?? ''); setAct(null); }} className="btn-ghost w-full justify-start"><Pencil size={16} /> Edit</button>}
              {act.sender === me && <button onClick={async () => { const m = act; if (!confirm('Delete this message for everyone? This can’t be undone.')) return; setAct(null); try { await deleteDM(m); load(); toast('Deleted'); } catch (e) { toast((e as Error).message); } }} className="btn-ghost w-full justify-start text-danger"><Trash2 size={16} /> Delete for everyone</button>}
              {act.sender !== me && <button onClick={() => { setReporting({ type: act.attachment ? 'image' : 'message', id: act.id, user: act.sender }); setAct(null); }} className="btn-ghost w-full justify-start"><Flag size={16} /> Report message</button>}
            </div>
          </>
        )}
      </Sheet>

      {/* The chat: mute, archive, delete, restrict, block, report. */}
      <Sheet open={menu} onClose={() => setMenu(false)} title={profile?.display_name ?? 'Chat'}>
        <div className="grid gap-2">
          <button onClick={async () => { try { await setMuted(other, !muted); setMutedState(!muted); toast(muted ? 'Notifications on' : 'Muted. You won’t be notified about this chat.'); } catch (e) { toast((e as Error).message); } setMenu(false); }} className="btn-ghost w-full justify-start"><BellOff size={16} /> {muted ? 'Unmute notifications' : 'Mute notifications'}</button>
          <button onClick={async () => { try { await setArchived(other, !archived); setArchivedState(!archived); toast(archived ? 'Moved back to Inbox' : 'Archived'); } catch (e) { toast((e as Error).message); } setMenu(false); if (!archived) onBack(); }} className="btn-ghost w-full justify-start"><Archive size={16} /> {archived ? 'Restore to Inbox' : 'Archive chat'}</button>
          <button onClick={async () => { if (!confirm('Delete this conversation? It’s removed for you; the other person keeps their copy. This can’t be undone.')) return; try { await clearChat(other); toast('Conversation deleted'); onBack(); } catch (e) { toast((e as Error).message); } }} className="btn-ghost w-full justify-start"><Trash2 size={16} /> Delete conversation</button>
          <button onClick={async () => { try { await restrict(other, true); toast(`Restricted. ${name}’s messages will wait in Requests and they won’t see when you read them.`); } catch (e) { toast((e as Error).message); } setMenu(false); }} className="btn-ghost w-full justify-start"><UserMinus size={16} /> Restrict</button>
          <button onClick={async () => { if (!confirm(`Block ${name}? They can’t message you, see or react to your posts, follow you or find you. They won’t be told.`)) return; try { await block(other); toast('Blocked. You can unblock in Privacy settings.'); onBack(); } catch (e) { toast((e as Error).message); } }} className="btn-ghost w-full justify-start text-danger"><ShieldOff size={16} /> Block</button>
          <button onClick={() => { setReporting({ type: 'user', id: other, user: other }); setMenu(false); }} className="btn-ghost w-full justify-start"><Flag size={16} /> Report {name}</button>
        </div>
      </Sheet>
      <ReportSheet open={!!reporting} onClose={() => setReporting(null)} target={reporting ?? { type: 'user', id: other }} what={reporting?.type === 'user' ? name : 'message'} />

      {viewer && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-label="Photo">
          <div className="pt-safe flex items-center justify-between px-4 py-3 text-white">
            <button onClick={() => setViewer(null)} className="grid h-11 w-11 place-items-center rounded-full bg-white/15" aria-label="Close"><X size={20} /></button>
            <span className="flex gap-2">
              <a href={viewer.url} download={viewer.m.attachment?.name} target="_blank" rel="noreferrer" className="grid h-11 w-11 place-items-center rounded-full bg-white/15" aria-label="Save"><Download size={18} /></a>
              {viewer.m.sender !== me && <button onClick={() => { setReporting({ type: 'image', id: viewer.m.id, user: viewer.m.sender }); setViewer(null); }} className="grid h-11 w-11 place-items-center rounded-full bg-white/15" aria-label="Report photo"><Flag size={18} /></button>}
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center p-2">
            {viewer.m.attachment?.type.startsWith('video/') ? <video src={viewer.url} controls autoPlay className="max-h-full max-w-full" /> : <img src={viewer.url} alt={viewer.m.attachment?.name ?? ''} className="max-h-full max-w-full object-contain" />}
          </div>
        </div>
      )}
    </Shell>
  );
}

/** A photo, video or document in a chat, opened through a short-lived private link. */
function AttachmentView({ m, onOpen }: { m: DM; onOpen: (url: string) => void }) {
  const a = m.attachment!;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (a.path) void fileUrl(a.path).then(setUrl); }, [a.path]);
  if (m.pending) return <span className="mb-1 flex items-center gap-2 rounded-2xl bg-raised px-3 py-2 text-[13px]"><Loader2 size={14} className="animate-spin" /> Uploading {a.name}…</span>;
  if (!url) return <span className="mb-1 rounded-2xl bg-raised px-3 py-2 text-[13px] text-silver">{a.name}</span>;
  if (a.type.startsWith('image/')) return <img src={url} alt={a.name} onClick={(e) => { e.stopPropagation(); onOpen(url); }} className="mb-1 max-h-64 w-56 rounded-2xl object-cover" />;
  if (a.type.startsWith('video/')) return <video src={url} onClick={(e) => { e.stopPropagation(); onOpen(url); }} className="mb-1 max-h-64 w-56 rounded-2xl" muted playsInline />;
  return <a href={url} target="_blank" rel="noreferrer" download={a.name} onClick={(e) => e.stopPropagation()} className="mb-1 flex items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 text-[14px]" style={{ boxShadow: 'var(--shadow)' }}><FileText size={18} /> <span className="truncate">{a.name}</span> <Download size={15} className="shrink-0 text-silver" /></a>;
}
