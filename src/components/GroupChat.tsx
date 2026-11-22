import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, MessageCircle } from 'lucide-react';
import { messages as loadMessages, onMessages, sendMessage, type Message } from '@/lib/social';
import { Avatar } from './Avatar';
import { cx } from './ui';
import { haptic, toast } from './fx';

/** Real-time chat for one group (members only — enforced by the database). */
export function GroupChat({ groupId, me }: { groupId: string; me?: string }) {
  const [list, setList] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => loadMessages(groupId).then(setList, (e: Error) => { toast(e.message); setList([]); }), [groupId]);
  useEffect(() => {
    void load();
    const off = onMessages(groupId, () => void load());
    const t = setInterval(() => void load(), 15_000); // backup if live updates are unavailable
    return () => { off(); clearInterval(t); };
  }, [groupId, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [list?.length]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try { await sendMessage(groupId, body); setText(''); haptic(); await load(); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  }

  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex min-h-[55dvh] flex-col">
      <div className="flex-1 space-y-3 pb-28">
        {list === null ? (
          <p className="flex items-center justify-center gap-2 py-16 text-silver"><Loader2 size={18} className="animate-spin" /> Loading chat…</p>
        ) : list.length === 0 ? (
          <div className="card p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-raised"><MessageCircle size={24} /></span>
            <p className="mt-2 font-bold">Start the conversation</p>
            <p className="mt-1 text-sm text-silver">Say hi, share a tip or cheer someone on.</p>
          </div>
        ) : (
          list.map((m, i) => {
            const mine = m.user_id === me;
            const first = i === 0 || list[i - 1].user_id !== m.user_id;
            return (
              <div key={m.id} className={cx('flex items-end gap-2', mine && 'flex-row-reverse')}>
                {!mine && (first ? <Avatar name={m.author?.display_name ?? 'Member'} color={m.author?.avatar} photoUrl={m.author?.photoUrl} size={32} /> : <span className="w-8 shrink-0" />)}
                <div className={cx('max-w-[78%]', mine && 'text-right')}>
                  {!mine && first && <p className="mb-1 px-1 text-xs font-bold text-silver">{m.author?.username ? `@${m.author.username}` : m.author?.display_name}</p>}
                  <p className={cx('inline-block whitespace-pre-wrap rounded-[20px] px-4 py-2.5 text-left text-[15px]', mine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-surface')} style={mine ? undefined : { boxShadow: 'var(--shadow)' }}>
                    {m.body}
                  </p>
                  <p className="mt-0.5 px-1 text-[11px] font-medium text-dim">{time(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="sticky bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-20 flex items-end gap-2">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1000} placeholder="Message the group…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          className="field max-h-32 min-h-[52px] flex-1 resize-none !rounded-[26px] !bg-surface !py-3.5" style={{ boxShadow: 'var(--shadow)' }} aria-label="Message"
        />
        <button type="submit" disabled={!text.trim() || busy} className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-primary text-on-primary transition active:scale-95 disabled:opacity-40" aria-label="Send">
          {busy ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={22} strokeWidth={2.5} />}
        </button>
      </form>
    </div>
  );
}
