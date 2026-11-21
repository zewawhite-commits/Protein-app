import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Mic, Plus, Search, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { matchItems } from '@/lib/recognize-client';
import { lastAmount, asRecognition, gramsFor, parseAmount, parseSaid, type SaidFood } from '@/lib/describe';
import { splitName } from '@/lib/foods';
import { mealForNow, todayKey } from '@/lib/dates';
import { MEAL_LABELS, defaultMeal, rememberMeal, useMealOptions } from '@/lib/meals';
import type { Food, Meal } from '@/lib/types';
import { FoodVisual } from './FoodIcon';
import { cx, fmt } from './ui';
import { haptic, toast } from './fx';

export type Recognizer = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; abort?: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null };
export const SR = typeof window !== 'undefined' ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognizer) | undefined : undefined;
export const canUseVoice = !!SR;

interface Line { key: string; said: SaidFood; food: Food | null; options: Food[]; grams: number | null; how: string }

const short = (f: Food) => splitName(f.name).title.split(',')[0];

/**
 * Voice food logging, on the phone (free: the phone's own speech recognition and voice).
 * Say the meal → each food is found → if an amount is missing it asks out loud ("How many
 * chicken wings?") and listens for the answer → check the list → add it all.
 */
export function VoiceSheet({ onClose, onSearch, date }: { onClose: () => void; onSearch: (text: string) => void; date?: string }) {
  const { db } = useFoodDb();
  const dbRef = useRef(db);
  dbRef.current = db;
  const custom = useStore((s) => s.customFoods);
  const addEntry = useStore((s) => s.addEntry);
  const [said, setSaid] = useState('');
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [asking, setAsking] = useState<string | null>(null);
  const [speak, setSpeak] = useState(() => { try { return localStorage.getItem('nutivili-voice-replies') !== 'off'; } catch { return true; } });
  const rec = useRef<Recognizer | null>(null);
  const closed = useRef(false);
  const [meal, setMeal] = useState<Meal>(defaultMeal(mealForNow()));
  const meals = useMealOptions(meal);
  // What the mic is waiting for: a new meal, or the answer to a question ("How many wings?").
  const handler = useRef<(text: string) => void>(() => undefined);

  // The microphone and the voice always stop when the sheet closes or the person leaves the app.
  const stopAll = () => {
    try { rec.current?.abort ? rec.current.abort() : rec.current?.stop(); } catch { /* already stopped */ }
    rec.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* none */ }
    setListening(false);
  };
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') stopAll(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stopAll);
    return () => { closed.current = true; stopAll(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', stopAll); };
  }, []);
  const close = () => { closed.current = true; stopAll(); onClose(); };

  function say(text: string, then?: () => void) {
    if (!speak || !('speechSynthesis' in window)) { then?.(); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = navigator.language || 'en-GB';
      u.onend = () => { if (!closed.current) then?.(); };
      window.speechSynthesis.speak(u);
    } catch { then?.(); }
  }

  function listen(onFinal: (text: string) => void, auto = false) {
    if (!SR || closed.current) return;
    handler.current = onFinal;
    setErr('');
    stopAll();
    const r = new SR();
    r.lang = navigator.language || 'en-GB';
    r.interimResults = true;
    r.continuous = false;
    let last = '';
    r.onresult = (e) => { last = Array.from(e.results).map((x) => x[0].transcript).join(' ').trim(); setSaid(last); };
    r.onend = () => { setListening(false); rec.current = null; if (last && !closed.current) onFinal(last); };
    r.onerror = (e) => {
      setListening(false);
      if (e?.error === 'no-speech' || e?.error === 'aborted') return;
      // Phones (iPhone especially) won't reopen the mic by themselves after a spoken question: just tap to answer.
      if (auto && (e?.error === 'not-allowed' || e?.error === 'service-not-allowed')) { setAsking((q) => (q && !q.includes('Tap the mic') ? `${q} Tap the mic to answer.` : q)); return; }
      setErr(e?.error === 'not-allowed' ? 'Microphone access is off. Allow it in your browser settings, or type below.' : 'Couldn’t hear that. Tap the mic and try again.');
    };
    rec.current = r;
    setListening(true);
    haptic();
    try { r.start(); } catch { setListening(false); if (auto) setAsking((q) => (q && !q.includes('Tap the mic') ? `${q} Tap the mic to answer.` : q)); }
  }

  // Turn a sentence into lines: each food found in the database, amounts from its own servings.
  function understand(text: string) {
    if (!dbRef.current) { setErr('Still loading the food list — try again in a second.'); return; }
    const parts = parseSaid(text);
    if (!parts.length) return;
    const found = matchItems(asRecognition(parts), custom, useStore.getState().picks);
    const next: Line[] = parts.map((p, i) => {
      const all = found[i]?.candidates.slice(0, 8) ?? [];
      // "3 chicken wings": prefer a record that knows how much one wing weighs.
      const fits = p.qty != null ? all.find((f) => gramsFor(f, p.qty, p.unit)) : undefined;
      const options = (fits ? [fits, ...all.filter((f) => f !== fits)] : all).slice(0, 4);
      const food = options[0] ?? null;
      // No amount said: use what they had last time if we know it; otherwise ask, never assume.
      const g = food && (p.qty != null || p.unit) ? gramsFor(food, p.qty, p.unit) : null;
      const last = !g && food && p.qty == null && !p.unit ? lastAmount(useStore.getState().entries, food) : null;
      if (last) return { key: `${Date.now()}-${i}`, said: p, food, options, grams: last, how: `your usual ${fmt(last)} g of` };
      return { key: `${Date.now()}-${i}`, said: p, food, options, grams: g?.grams ?? null, how: g?.how ?? '' };
    });
    setLines((cur) => {
      const all = [...cur, ...next];
      setTimeout(() => askNext(all), 50);
      return all;
    });
  }

  // Ask out loud about the first food that still needs something, then listen for the answer.
  function askNext(all: Line[]) {
    const l = all.find((x) => !x.food || x.grams == null);
    if (!l) {
      setAsking(null);
      if (all.length) say(`Got it: ${all.map((x) => `${x.how || `${fmt(x.grams ?? 0)} grams`} ${x.food ? short(x.food) : x.said.text}`).join(', ')}. Tap add when you're ready.`);
      return;
    }
    if (!l.food) {
      const q = `I couldn't find ${l.said.text}. Try saying it another way, or type it below.`;
      setAsking(q); say(q);
      setLines((cur) => cur.filter((x) => x.key !== l.key));
      return;
    }
    const name = short(l.food).toLowerCase();
    // Ask in the food's own serving: "How many wraps of eba?", "How many wings?"
    const unitP = (l.food.portions ?? []).find((p) => /\b(piece|wing|drumstick|thigh|leg|slice|egg|ball|fillet|wrap|stick|plate|bowl)\b/i.test(p.label));
    const unit = unitP ? /\b(piece|wing|drumstick|thigh|leg|slice|egg|ball|fillet|wrap|stick|plate|bowl)\b/i.exec(unitP.label)![1].toLowerCase() : null;
    const many = unit ? (/(wing|drumstick|thigh|leg|egg|ball|fillet)/.test(unit) && name.includes(unit) ? `How many ${name}?` : `How many ${unit === 'piece' ? 'pieces' : `${unit}s`} of ${name}?`) : null;
    const q = many ?? `How much ${name}? Say grams, or cups or spoons.`;
    setAsking(q);
    say(q, () => listen((answer) => {
      const a = parseAmount(answer);
      const g = a.qty != null ? gramsFor(l.food!, a.qty, a.unit) : null;
      setLines((cur) => {
        const upd = cur.map((x) => (x.key === l.key ? { ...x, grams: g?.grams ?? x.grams, how: g?.how ?? x.how } : x));
        // Didn't catch a number: ask again and listen again (it used to stop here).
        if (!g) { const again = `Sorry, ${many ? many.charAt(0).toLowerCase() + many.slice(1) : `how much ${name}?`} For example, 2, or 150 grams.`; setAsking(again); const h = handler.current; say(again, () => listen(h, true)); }
        else setTimeout(() => askNext(upd), 50);
        return upd;
      });
    }, true));
  }

  // Start listening once the food list is ready (so the first words aren't lost).
  const started = useRef(false);
  useEffect(() => { if (SR && db && !started.current) { started.current = true; listen(understand); } }, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = lines.length > 0 && lines.every((l) => l.food && l.grams && l.grams > 0);
  const kcal = lines.reduce((a, l) => a + (l.food && l.grams ? ((l.food.per100.kcal ?? 0) * l.grams) / 100 : 0), 0);
  const protein = lines.reduce((a, l) => a + (l.food && l.grams ? (l.food.per100.protein * l.grams) / 100 : 0), 0);
  const [typed, setTyped] = useState('');

  function addAll() {
    const d = date ?? todayKey();
    const ids = lines.map((l) => addEntry({ date: d, meal, food: l.food!, grams: l.grams!, note: 'Logged by voice' }).id);
    rememberMeal(meal);
    haptic();
    toast(`Added ${lines.length} food${lines.length > 1 ? 's' : ''} · ${fmt(kcal)} kcal`, { action: { label: 'Undo', run: () => ids.forEach((id) => useStore.getState().removeEntry(id)) } });
    close();
  }

  // Attached to the page itself, so nothing on the screen behind can push it out of view.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 backdrop-blur-[2px]" onClick={close} role="dialog" aria-label="Voice logging">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] bg-bg px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-bold">Say what you ate</p>
          <div className="flex gap-2">
            <button onClick={() => { const v = !speak; setSpeak(v); if (!v) window.speechSynthesis?.cancel(); try { localStorage.setItem('nutivili-voice-replies', v ? 'on' : 'off'); } catch { /* ignore */ } }} className="grid h-10 w-10 place-items-center rounded-full bg-surface" aria-label={speak ? 'Mute voice replies' : 'Turn voice replies on'}>{speak ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
            <button onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-surface" aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <p className="mt-1 text-sm text-silver">For example: “two boiled eggs, a cup of rice and three chicken wings”. I’ll ask if I need to know how much.</p>

        <div className="my-5 grid place-items-center">
          <button disabled={!SR} onClick={() => (listening ? stopAll() : listen(asking && lines.some((l) => !l.food || l.grams == null) ? handler.current : understand))} className={cx('relative grid h-20 w-20 place-items-center rounded-full text-white transition disabled:opacity-40', listening ? 'bg-danger' : 'bg-primary')} aria-label={listening ? 'Stop listening' : 'Start listening'}>
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" />}
            <Mic size={32} className="relative" />
          </button>
          <p className="mt-2 text-sm font-semibold text-silver">{!SR ? 'Voice isn’t available in this browser — type below' : listening ? 'Listening…' : lines.length ? 'Tap to add more' : 'Tap to speak'}</p>
        </div>
        <div className="-mx-6 mb-3 flex gap-1.5 overflow-x-auto px-6 no-scrollbar" role="group" aria-label="Meal">
          {meals.map((m) => <button key={m.value} onClick={() => setMeal(m.value)} className={cx('chip !h-8 shrink-0 !px-3 text-[13px]', meal === m.value && 'chip-on')}>{m.label}</button>)}
        </div>
        {asking && <p className="mb-2 rounded-2xl bg-accent/10 px-4 py-3 text-[15px] font-semibold text-accent">{asking}</p>}
        {said && <p className="mb-2 rounded-2xl bg-surface px-4 py-2.5 text-[15px] text-silver">“{said}”</p>}
        {err && <p className="mb-2 text-sm text-danger">{err}</p>}

        {lines.length > 0 && (
          <div className="card divide-y divide-line p-1">
            {lines.map((l) => (
              <div key={l.key} className="flex items-center gap-3 p-2.5">
                {l.food && <FoodVisual name={l.food.name} category={l.food.category} size={44} />}
                <div className="min-w-0 flex-1">
                  {l.options.length > 1 ? (
                    <select aria-label={`Which ${l.said.text}`} className="w-full truncate bg-transparent text-[15px] font-semibold outline-none" value={l.food?.id} onChange={(e) => setLines((cur) => cur.map((x) => { if (x.key !== l.key) return x; const f = x.options.find((o) => o.id === e.target.value)!; const g = gramsFor(f, x.said.qty, x.said.unit); return { ...x, food: f, grams: g?.grams ?? x.grams, how: g?.how ?? x.how }; }))}>
                      {l.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  ) : <p className="truncate text-[15px] font-semibold">{l.food?.name ?? l.said.text}</p>}
                  <p className="num text-xs text-silver">{l.grams ? `${l.how ? `${l.how} · ` : ''}${fmt(((l.food?.per100.kcal ?? 0) * l.grams) / 100)} kcal · ${fmt(((l.food?.per100.protein ?? 0) * l.grams) / 100, 1)} g protein` : 'How much? Enter grams →'}</p>
                </div>
                <div className="relative w-20 shrink-0">
                  <input inputMode="decimal" aria-label={`Grams of ${l.said.text}`} className="field !h-10 !px-2 pr-6 text-right" value={l.grams ?? ''} onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); setLines((cur) => cur.map((x) => (x.key === l.key ? { ...x, grams: e.target.value === '' ? null : v, how: '' } : x))); }} />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-silver">g</span>
                </div>
                <button onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-dim" aria-label={`Remove ${l.said.text}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { understand(typed); setTyped(''); } }} className="mt-3 flex gap-2">
          <input className="field flex-1" placeholder="Or type it: 2 eggs and toast" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type what you ate" />
          <button type="submit" disabled={!typed.trim()} className="btn-ghost !px-4"><Plus size={17} /></button>
        </form>

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
          <button disabled={!said} onClick={() => { onSearch(said); close(); }} className="btn bg-surface !px-4 text-ink" style={{ boxShadow: 'var(--shadow)' }} aria-label="Search instead"><Search size={17} /></button>
          <button disabled={!ready} onClick={addAll} className="btn-primary"><Check size={18} /> {lines.length ? `Add ${lines.length} to ${MEAL_LABELS[meal]} · ${fmt(kcal)} kcal, ${fmt(protein)} g protein` : 'Add to diary'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
