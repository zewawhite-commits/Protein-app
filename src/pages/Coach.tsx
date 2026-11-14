import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ChevronRight, ImagePlus, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { blobToBase64, resizeImage } from '@/lib/photos';
import { useStore } from '@/store/useStore';
import { useDay, useFoodDb } from '@/lib/hooks';
import { confidentMatch, splitName } from '@/lib/foods';
import { dailyTargets } from '@/lib/energy';
import { nutrientsFor } from '@/lib/nutrition';
import { todayKey } from '@/lib/dates';
import type { CoachContext, CoachFood, CoachReply, ChatTurn } from '@/lib/coach';
import type { Food } from '@/lib/types';
import { FoodVisual } from '@/components/FoodIcon';
import { FoodSheet } from '@/components/FoodSheet';
import { Segmented, cx, fmt } from '@/components/ui';
import { PlanView } from '@/components/PlanView';
import { APP_NAME, haptic } from '@/components/fx';

interface Msg extends ChatTurn { foods?: CoachFood[]; error?: boolean; premium?: boolean; thumb?: string; fromPhoto?: boolean }
interface Pending { data: string; mediaType: 'image/jpeg'; thumb: string }

const PHOTO_PROMPT = 'What’s in this photo, and how does it fit my goals?';

async function preparePhoto(file: File): Promise<Pending> {
  const big = await resizeImage(file, 1280);
  const small = await resizeImage(file, 240);
  return { data: await blobToBase64(big), mediaType: 'image/jpeg', thumb: `data:image/jpeg;base64,${await blobToBase64(small)}` };
}

const STORE_KEY = 'provora-coach';
const load = (): Msg[] => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as Msg[]; } catch { return []; }
};
const save = (m: Msg[]) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(m.slice(-40))); } catch { /* storage unavailable */ }
};

const STARTERS = [
  'What should I eat for dinner?',
  'How am I doing today?',
  'High-protein breakfast ideas',
  'Healthy snacks under 200 kcal',
  'How can I eat more fibre?',
  'Is my sugar too high today?',
  '📷 Send a photo of your meal',
];

/** Everything the AI needs to know about the person and their day. */
export function useCoachContext(): CoachContext {
  const profile = useStore((s) => s.profile);
  const { entries, totals, goal } = useDay(todayKey());
  return useMemo<CoachContext>(() => {
    const t = profile ? dailyTargets(profile, goal) : null;
    return {
      name: profile?.name || undefined,
      goals: profile?.goals ?? (profile?.goal ? [profile.goal] : undefined),
      activity: profile?.activity, diet: profile?.diet, country: profile?.country, cuisines: profile?.cuisines, avoid: profile?.avoid,
      age: profile?.age, sex: profile?.sex, pregnant: profile?.pregnant,
      targets: { kcal: t?.kcal, protein: goal || undefined, carbs: t?.carbs, fat: t?.fat, fiber: t?.fiber },
      today: { kcal: totals.kcal, protein: totals.protein, carbs: totals.carbs, fat: totals.fat, fiber: totals.fiber, sugar: totals.sugar, sodiumMg: totals.sodium },
      eatenToday: entries.map((e) => `${splitName(e.food.name).title} (${Math.round(e.grams)} g, ${e.meal})`),
      localTime: new Date().toLocaleString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }),
    };
  }, [profile, goal, totals, entries]);
}

export default function Coach() {
  const [view, setView] = useState<'chat' | 'plan'>(() => (new URLSearchParams(location.search).get('view') === 'plan' ? 'plan' : 'chat'));
  return (
    <div className="animate-fade-up">
      <header className="pt-safe flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent"><Sparkles size={20} /></span>
          <div>
            <h1 className="text-[22px] font-bold leading-tight tracking-tight">Coach</h1>
            <p className="text-xs text-silver">Knows your goals, tastes and today’s food</p>
          </div>
        </div>
      </header>
      <div className="mb-4"><Segmented full value={view} onChange={(v) => { haptic(); setView(v); }} options={[{ value: 'chat', label: 'Chat' }, { value: 'plan', label: 'My eating plan' }]} /></div>
      {view === 'chat' ? <Chat /> : <PlanView />}
    </div>
  );
}

function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<{ food: Food; grams?: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const profile = useStore((s) => s.profile);
  const premiumToken = useStore((s) => s.premium?.token);

  useEffect(() => { save(msgs); endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);

  const context = useCoachContext();

  async function send(content: string) {
    const photo = pending;
    const q = content.trim() || (photo ? PHOTO_PROMPT : '');
    if (!q || busy) return;
    haptic();
    // Earlier photos aren't re-sent; the text notes that one was there.
    const history = [...msgs.filter((m) => !m.error).map((m) => (m.thumb ? { ...m, content: `[photo] ${m.content}` } : m)), { role: 'user' as const, content: q }];
    setMsgs([...msgs, { role: 'user', content: q, thumb: photo?.thumb }]);
    setText('');
    setPending(null);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(premiumToken && { authorization: `Bearer ${premiumToken}` }) },
        body: JSON.stringify({ turns: history.map(({ role, content }) => ({ role, content })), context, ...(photo && { image: { data: photo.data, mediaType: photo.mediaType } }) }),
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!isJson || res.status === 404 || res.status === 501) throw new Error('The coach isn’t switched on yet. It will work once the AI key is added on the server.');
      const data = (await res.json()) as CoachReply & { error?: string; premium?: boolean };
      if (res.status === 402) {
        setMsgs((m) => [...m, { role: 'assistant', content: data.error ?? 'The coach is a Plus and Pro feature.', error: true, premium: true }]);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Could not reply.');
      setMsgs((m) => [...m, { role: 'assistant', content: data.reply, foods: data.foods, fromPhoto: !!photo }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      {msgs.length > 0 && (
        <div className="mb-2 flex justify-end">
          <button onClick={() => { haptic(); setMsgs([]); }} className="chip !h-9" aria-label="New chat"><RotateCcw size={14} /> New chat</button>
        </div>
      )}

      <div className="flex-1 space-y-3 pb-28">
        {msgs.length === 0 && (
          <div className="card p-5">
            <p className="text-[15px] font-semibold">Hi{profile?.name ? ` ${profile.name}` : ''}! Ask me anything about food.</p>
            <p className="mt-1 text-sm text-silver">I can plan meals with foods from {profile?.country || 'where you live'}, check how today is going, or help you hit your targets. Numbers always come from the {APP_NAME} food database.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {STARTERS.map((s) => <button key={s} onClick={() => (s.startsWith('📷') ? fileRef.current?.click() : send(s))} className="chip !h-9 !bg-raised text-[14px]">{s}</button>)}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <div className="flex max-w-[85%] flex-col items-end gap-1.5">
              {m.thumb && <img src={m.thumb} alt="Your photo" className="h-40 w-40 rounded-[22px] object-cover" />}
              <p className="whitespace-pre-wrap rounded-[22px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-on-primary">{m.content}</p>
            </div>
          </div>
        ) : (
          <div key={i} className="max-w-[92%]">
            <div className={cx('whitespace-pre-wrap rounded-[22px] rounded-bl-md px-4 py-3 text-[15px] leading-relaxed', m.error ? 'bg-danger/10 text-ink' : 'bg-surface')} style={m.error ? undefined : { boxShadow: 'var(--shadow)' }}>
              {m.content}
              {m.premium && <Link to="/premium" className="mt-2 block font-semibold text-accent">See plans →</Link>}
            </div>
            {!!m.foods?.length && <FoodCards foods={m.foods} estimate={m.fromPhoto} onOpen={(food, grams) => setOpen({ food, grams })} />}
          </div>
        )))}

        {busy && (
          <div className="flex items-center gap-2 px-2 text-sm text-silver"><Loader2 size={16} className="animate-spin" /> Thinking…</div>
        )}
        <div ref={endRef} />
      </div>

      {pending && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+10.5rem)] z-20 mb-2 flex items-center gap-3 self-start rounded-[20px] bg-surface p-2 pr-3 lg:bottom-24" style={{ boxShadow: 'var(--shadow)' }}>
          <img src={pending.thumb} alt="Photo to send" className="h-14 w-14 rounded-2xl object-cover" />
          <span className="text-sm font-medium text-silver">Photo ready — add a question or just send</span>
          <button onClick={() => setPending(null)} className="grid h-8 w-8 place-items-center rounded-full bg-raised" aria-label="Remove photo"><X size={15} /></button>
        </div>
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); void send(text); }}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-20 flex items-end gap-2 lg:bottom-6"
      >
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-surface transition active:scale-95" style={{ boxShadow: 'var(--shadow)' }} aria-label="Add a photo">
          <ImagePlus size={21} />
        </button>
        <input
          ref={fileRef} type="file" accept="image/*" hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try { setPending(await preparePhoto(f)); haptic(); } catch { /* unreadable image */ }
          }}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text); } }}
          rows={1}
          maxLength={2000}
          placeholder={pending ? 'Ask about this photo…' : 'Ask your coach…'}
          className="field max-h-32 min-h-[52px] flex-1 resize-none !rounded-[26px] !py-3.5"
          style={{ boxShadow: 'var(--shadow)' }}
          aria-label="Message"
        />
        <button type="submit" disabled={(!text.trim() && !pending) || busy} className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-primary text-on-primary transition active:scale-95 disabled:opacity-40" aria-label="Send">
          <ArrowUp size={22} strokeWidth={2.5} />
        </button>
      </form>
      <p className="mt-2 text-center text-[12px] text-dim">AI coach — general guidance, not medical advice.</p>

      <FoodSheet food={open?.food ?? null} date={todayKey()} preset={{ aiEstimate: open?.grams }} onClose={() => setOpen(null)} />
    </div>
  );
}

/** Suggested foods, matched to database records so every number is calculated, not generated. */
function FoodCards({ foods, onOpen, estimate }: { foods: CoachFood[]; onOpen: (f: Food, grams?: number) => void; estimate?: boolean }) {
  const { db } = useFoodDb();
  const custom = useStore((s) => s.customFoods);
  const rows = useMemo(
    () => (db ? foods.map((f) => ({ f, match: confidentMatch([...f.searchQueries, f.localName, f.name].filter(Boolean), { custom }) })) : []),
    [db, foods, custom],
  );
  return (
    <div className="card mt-2 p-2">
      {rows.map(({ f, match }, i) => {
        const g = f.portionGrams || 100;
        const n = match ? nutrientsFor(match.per100, g) : null;
        const title = f.localName && f.localName !== f.name ? f.localName : f.name;
        return match ? (
          <button key={i} onClick={() => { haptic(); onOpen(match, f.portionGrams || undefined); }} className="flex w-full items-center gap-3 rounded-[18px] p-2 text-left transition active:bg-raised/60">
            <FoodVisual name={`${f.localName} ${f.name}`} category={match.category} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{title}{title !== f.name && <span className="font-normal text-silver"> · {f.name}</span>}</p>
              <p className="num text-xs text-silver">
                {estimate && f.portionGrams ? `~${g} g (AI estimate)` : `${g} g${f.portionGrams ? ' portion' : ''}`} · {n?.kcal != null ? `${fmt(n.kcal)} kcal · ` : ''}<span className="text-accent">{fmt(n!.protein, 1)} g protein</span>
              </p>
              <p className="truncate text-[12px] text-dim">Matched: {splitName(match.name).title}</p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-dim" />
          </button>
        ) : (
          <Link key={i} to={`/add?q=${encodeURIComponent(f.searchQueries[0] ?? f.name)}`} className="flex items-center gap-3 rounded-[18px] p-2">
            <FoodVisual name={`${f.localName} ${f.name}`} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{title}</p>
              <p className="text-xs text-dim">Not in our database yet — tap to search</p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-dim" />
          </Link>
        );
      })}
      <p className="px-2 pb-1 pt-1 text-[12px] text-dim">Numbers from USDA / FAO records for the portion shown. Tap to log your real weight.</p>
    </div>
  );
}
