import { mealLabel } from '@/lib/meals';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ChevronRight, ImagePlus, MessageCircle, RotateCcw, X } from 'lucide-react';
import { blobToBase64, resizeImage } from '@/lib/photos';
import { aiHeaders } from '@/lib/premium';
import { WorkoutView } from '@/components/WorkoutView';
import { RecipeView } from '@/components/RecipeView';
import { SignInButtons } from '@/components/SignIn';
import { accountsEnabled, useSession } from '@/lib/account';
import { useStore } from '@/store/useStore';
import { useDay, useFoodDb } from '@/lib/hooks';
import { confidentMatch, splitName } from '@/lib/foods';
import { dailyTargets } from '@/lib/energy';
import { nutrientsFor } from '@/lib/nutrition';
import { todayKey, addDays } from '@/lib/dates';
import type { CoachContext, CoachFood, CoachReply, ChatTurn, ProfileUpdate } from '@/lib/coach';
import { partialReply } from '@/lib/coach';
import type { Food } from '@/lib/types';
import { FoodSheet } from '@/components/FoodSheet';
import { Segmented, cx, fmt } from '@/components/ui';
import { PlanView } from '@/components/PlanView';
import { APP_NAME, haptic, toast } from '@/components/fx';

interface Msg extends ChatTurn { streaming?: boolean; updates?: ProfileUpdate[]; applied?: boolean; foods?: CoachFood[]; error?: boolean; premium?: boolean; signIn?: boolean; thumb?: string; fromPhoto?: boolean }
interface Pending { data: string; mediaType: 'image/jpeg'; thumb: string }

/** Apply changes the person confirmed in the chat to their profile. */
function applyUpdates(updates: ProfileUpdate[]) {
  const st = useStore.getState();
  const p = st.profile;
  if (!p) return;
  const num = (v: string) => Number(v.replace(/[^\d.]/g, ''));
  const add = (list: string[] | undefined, v: string) => (list?.some((x) => x.toLowerCase() === v.toLowerCase()) ? list : [...(list ?? []), v]);
  const next = { ...p };
  for (const u of updates) {
    if (u.field === 'calorieGoal') { next.calorieMode = 'fixed'; next.calorieGoal = Math.round(num(u.value)); }
    else if (u.field === 'proteinGoal') { next.goalMode = 'fixed'; next.goalGrams = Math.round(num(u.value)); }
    else if (u.field === 'goalWeightKg') next.goalWeightKg = Math.round(num(u.value) * 10) / 10;
    else if (u.field === 'avoidAdd') next.avoid = add(next.avoid, u.value);
    else if (u.field === 'cuisinesAdd') next.cuisines = add(next.cuisines, u.value);
    else if (u.field === 'dietPrefsAdd') next.dietPrefs = add(next.dietPrefs, u.value);
    else if (u.field === 'obstaclesAdd') next.obstacles = add(next.obstacles, u.value);
    else if (u.field === 'trainingAdd') next.training = add(next.training, u.value);
  }
  st.saveProfile(next);
  toast('Profile updated');
}

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
  'Send a photo of your meal',
];

/** Everything the AI needs to know about the person and their day. */
export function useCoachContext(): CoachContext {
  const profile = useStore((s) => s.profile);
  const { entries, totals, goal } = useDay(todayKey());
  const allEntries = useStore((s) => s.entries);
  const weights = useStore((s) => s.weights);
  const extra = useMemo(() => {
    const from = addDays(todayKey(), -7);
    const week = allEntries.filter((e) => e.date > from);
    const counts = new Map<string, number>();
    for (const e of week) { const n = splitName(e.food.name).title.split(',')[0]; counts.set(n, (counts.get(n) ?? 0) + 1); }
    const recentFoods = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([n, c]) => (c > 1 ? `${n} ×${c}` : n));
    const progress: string[] = [`Logged food on ${new Set(week.map((e) => e.date)).size} of the last 7 days.`];
    const mean = (a: string, b: string) => { const v = weights.filter((w) => w.date > a && w.date <= b).map((w) => w.kg); return v.length ? v.reduce((s, n) => s + n, 0) / v.length : null; };
    const now = mean(from, todayKey()), prev = mean(addDays(todayKey(), -14), from);
    const st = useStore.getState();
    const trained = st.exercises.filter((x) => x.date > from);
    if (trained.length) progress.push(`${trained.length} workout${trained.length > 1 ? 's' : ''} in the last 7 days (${trained.reduce((s, x) => s + x.minutes, 0)} minutes)${trained.some((x) => x.date === todayKey()) ? ', including one today — recovery food and protein matter today' : ''}.`);
    else progress.push('No workouts logged in the last 7 days.');
    if (now != null) progress.push(`7-day average weight ${now.toFixed(1)} kg${prev != null ? ` (${now - prev >= 0 ? '+' : ''}${(now - prev).toFixed(1)} kg vs the week before)` : ''}.`);
    if (weights.length >= 2) { const first = weights[0], last = weights[weights.length - 1]; progress.push(`Since they started weighing in (${first.date}): ${first.kg} kg → ${last.kg} kg.`); }
    // Body measurements: latest per site and change since the first.
    const sites = new Map<string, { first: number; last: number }>();
    for (const m of [...(st.measurements ?? [])].sort((a, b) => a.date.localeCompare(b.date))) { const c = sites.get(m.site); sites.set(m.site, { first: c?.first ?? m.cm, last: m.cm }); }
    if (sites.size) progress.push(`Measurements: ${[...sites.entries()].map(([k, v]) => `${k} ${v.last} cm (${v.last - v.first >= 0 ? '+' : ''}${(v.last - v.first).toFixed(1)})`).join(', ')}.`);
    // Workout days vs rest days over 4 weeks (logged days only).
    const from28 = addDays(todayKey(), -28);
    const days = new Map<string, number>();
    for (const e of allEntries) if (e.date > from28 && !e.planned) days.set(e.date, (days.get(e.date) ?? 0) + (e.food.per100.kcal ?? 0) * e.grams / 100);
    const tdays = new Set(st.exercises.filter((x) => x.date > from28).map((x) => x.date));
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const a = avg([...days.entries()].filter(([d]) => tdays.has(d)).map(([, k]) => k)), r = avg([...days.entries()].filter(([d]) => !tdays.has(d)).map(([, k]) => k));
    if (a != null && r != null) progress.push(`Last 4 weeks: about ${a} kcal on workout days vs ${r} kcal on rest days (logged days only).`);
    return { recentFoods, progress };
  }, [allEntries, weights]);
  return useMemo<CoachContext>(() => {
    const t = profile ? dailyTargets(profile, goal) : null;
    return {
      name: profile?.name || undefined,
      goals: profile?.goals ?? (profile?.goal ? [profile.goal] : undefined),
      activity: profile?.activity, diet: [profile?.diet, ...(profile?.dietPrefs ?? [])].filter(Boolean).join(', ') || undefined, country: profile?.country, cuisines: profile?.cuisines, avoid: profile?.avoid,
      obstacles: profile?.obstacles, training: profile?.training, weightKg: profile?.bodyWeightKg ?? undefined, goalWeightKg: profile?.goalWeightKg,
      age: profile?.age, sex: profile?.sex, pregnant: profile?.pregnant,
      targets: { kcal: t?.kcal, protein: goal || undefined, carbs: t?.carbs, fat: t?.fat, fiber: t?.fiber },
      today: { kcal: totals.kcal, protein: totals.protein, carbs: totals.carbs, fat: totals.fat, fiber: totals.fiber, sugar: totals.sugar, sodiumMg: totals.sodium },
      ...extra,
      eatenToday: entries.filter((e) => !e.planned).map((e) => `${splitName(e.food.name).title} (${Math.round(e.grams)} g, ${mealLabel(e.meal).toLowerCase()})`),
      localTime: new Date().toLocaleString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }),
    };
  }, [profile, goal, totals, entries, extra]);
}

export default function Coach() {
  type View = 'chat' | 'workout' | 'recipe' | 'plan';
  const [view, setView] = useState<View>(() => {
    const v = new URLSearchParams(location.search).get('view');
    return v === 'plan' || v === 'workout' || v === 'recipe' ? v : 'chat';
  });
  return (
    <div className="animate-fade-up">
      <header className="pt-safe flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent"><MessageCircle size={20} /></span>
          <div>
            <h1 className="text-[22px] font-bold leading-tight tracking-tight">Coach</h1>
            <p className="text-xs text-silver">Knows your goals, tastes and today’s food</p>
          </div>
        </div>
      </header>
      <div className="mb-4"><Segmented full value={view} onChange={(v) => { haptic(); setView(v); }} options={[{ value: 'chat', label: 'Chat' }, { value: 'workout', label: 'Workouts' }, { value: 'recipe', label: 'Recipes' }, { value: 'plan', label: 'Meal plan' }]} /></div>
      {view === 'chat' ? <Chat /> : view === 'workout' ? <WorkoutView /> : view === 'recipe' ? <RecipeView /> : <PlanView />}
    </div>
  );
}

function Chat() {
  const session = useSession();
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<{ food: Food; grams?: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const profile = useStore((s) => s.profile);

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
      const res = await fetch('/api/chat?stream=1', {
        method: 'POST',
        headers: await aiHeaders(),
        body: JSON.stringify({ turns: history.map(({ role, content }) => ({ role, content })), context, ...(photo && { image: { data: photo.data, mediaType: photo.mediaType } }) }),
      });
      const type = res.headers.get('content-type') ?? '';
      if (res.status === 404 || res.status === 501 || (!type.includes('json'))) throw new Error('The coach isn’t switched on yet. It will work once the AI key is added on the server.');
      if (!type.includes('ndjson')) {
        // Errors (and older servers) answer with plain JSON.
        const data = (await res.json()) as CoachReply & { error?: string };
        if (res.status === 401 || res.status === 402) {
          setMsgs((m) => [...m, { role: 'assistant', content: data.error ?? 'Unlimited coach chat comes with Pro.', error: true, premium: res.status === 402, signIn: res.status === 401 }]);
          return;
        }
        if (!res.ok) throw new Error(data.error || 'Could not reply.');
        setMsgs((m) => [...m, { role: 'assistant', content: data.reply || 'Done.', foods: data.foods, updates: data.profileUpdates, fromPhoto: !!photo }]);
        return;
      }
      // Live reply: show the words as they're written.
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '', raw = '', started = false;
      let final: CoachReply | null = null;
      const show = (content: string) => setMsgs((m) => {
        const next = [...m];
        if (!started) { started = true; return [...next, { role: 'assistant' as const, content, streaming: true }]; }
        next[next.length - 1] = { ...next[next.length - 1], content };
        return next;
      });
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { t?: string; done?: CoachReply; error?: string };
          if (ev.error) throw new Error(ev.error);
          if (ev.t) { raw += ev.t; const r = partialReply(raw); if (r) show(r); }
          if (ev.done) final = ev.done;
        }
      }
      if (!final) throw new Error('The reply was cut off. Try again.');
      const done = final;
      const msg: Msg = { role: 'assistant', content: done.reply || (done.foods?.length ? `Suggestions: ${done.foods.map((f) => f.name).join(', ')}` : 'Done.'), foods: done.foods, updates: done.profileUpdates, fromPhoto: !!photo };
      setMsgs((m) => (started ? [...m.slice(0, -1), msg] : [...m, msg]));
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
              {STARTERS.map((s) => <button key={s} onClick={() => (s.startsWith('Send a photo') ? fileRef.current?.click() : send(s))} className="chip !h-9 !bg-raised text-[14px]">{s.startsWith('Send a photo') && <ImagePlus size={15} />}{s}</button>)}
            </div>
            {accountsEnabled && session === null && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-3 text-sm font-semibold">Sign in free to chat — 5 coach messages a month</p>
                <SignInButtons />
              </div>
            )}
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
              {m.signIn && <div className="mt-3"><SignInButtons /></div>}
            </div>
            {!!m.foods?.length && <FoodCards foods={m.foods} estimate={m.fromPhoto} onOpen={(food, grams) => setOpen({ food, grams })} />}
            {!!m.updates?.length && (
              <div className="mt-2 rounded-[20px] bg-accent/10 p-4">
                <p className="text-sm font-bold text-accent">Update your profile?</p>
                <ul className="mt-1.5 space-y-1 text-sm">{m.updates.map((u) => <li key={u.field + u.value}>• {u.label}</li>)}</ul>
                {m.applied ? (
                  <p className="mt-3 text-sm font-semibold text-accent">Saved to your profile ✓</p>
                ) : (
                  <button onClick={() => { applyUpdates(m.updates!); haptic(); setMsgs((all) => all.map((x, j) => (j === i ? { ...x, applied: true } : x))); }} className="btn-primary mt-3 !h-11 w-full">Save to profile</button>
                )}
              </div>
            )}
          </div>
        )))}

        {busy && !msgs[msgs.length - 1]?.streaming && (
          <div className="inline-flex items-center gap-1.5 rounded-[22px] rounded-bl-md bg-surface px-4 py-3.5" style={{ boxShadow: 'var(--shadow)' }} role="status" aria-label="Coach is thinking">
            <span className="mr-1 text-sm font-medium text-silver">Thinking</span>
            {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-silver" style={{ animationDelay: `${d * 0.15}s` }} />)}
          </div>
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
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-20 flex items-end gap-2 pt-6 lg:bottom-6"
        // Messages scroll behind the box: fade them out so the box always sits on a clean background.
        style={{ background: 'linear-gradient(to top, rgb(var(--bg)) 0%, rgb(var(--bg)) 72%, rgb(var(--bg) / 0) 100%)' }}
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
          className="field max-h-32 min-h-[52px] flex-1 resize-none !rounded-[26px] !bg-surface !py-3.5"
          style={{ boxShadow: 'var(--shadow)' }}
          aria-label="Message"
        />
        <button type="submit" disabled={(!text.trim() && !pending) || busy} className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-primary text-on-primary transition active:scale-95 disabled:opacity-40" aria-label="Send">
          <ArrowUp size={22} strokeWidth={2.5} />
        </button>
      </form>
      <p className="mt-2 text-center text-[12px] text-dim">AI Coach gives general fitness and nutrition guidance, not medical advice.</p>

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
          <button key={i} onClick={() => { haptic(); onOpen(match, f.portionGrams || undefined); }} className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition active:bg-raised/60">
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
