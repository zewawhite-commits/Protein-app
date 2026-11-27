import { utter } from '@/lib/voice';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Minus, Mic, Pencil, Plus, Search, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb } from '@/lib/hooks';
import { matchItems } from '@/lib/recognize-client';
import { boneInQuery, detailQuery, detailQuestion, lastAmount, asRecognition, gramsFor, naturalServings, parseAmount, parseSaid, questionFor, soupProteinQuestion, type SaidFood } from '@/lib/describe';
import { boneInFood, matchIsConfident, searchFoods, splitName } from '@/lib/foods';
import { mealForNow, todayKey } from '@/lib/dates';
import { MEAL_LABELS, defaultMeal, rememberMeal, useMealOptions } from '@/lib/meals';
import type { CustomFood, Food, Meal } from '@/lib/types';
import { FoodVisual } from './FoodIcon';
import { cx, fmt } from './ui';
import { haptic, toast } from './fx';

export type Recognizer = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; abort?: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null };
export const SR = typeof window !== 'undefined' ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognizer) | undefined : undefined;
export const canUseVoice = !!SR;

interface Line { key: string; said: SaidFood; food: Food | null; options: Food[]; grams: number | null; how: string; /** Follow-ups already asked, so nothing is asked twice. */ asked?: { detail?: boolean; soup?: boolean; swallow?: boolean }; /** The match may not be what was said: ask before using it. */ unsure?: boolean }

const short = (f: Food) => splitName(f.name).title.split(',')[0].replace(/\b(NFS|NS)\b\s*/g, '').trim();

/** Meat and fish in soup, the way it's cooked there ("2 pieces of beef" → stewed beef). */
function soupMeat(answer: string): string {
  return answer.replace(/^(yes|yeah|yep)[,.]?\s*/i, '')
    .replace(/\bbeef\b/gi, 'beef stewing steak stewed').replace(/\bgoat( meat)?\b/gi, 'boiled goat meat').replace(/\b(shaki|tripe)\b/gi, 'tripe cooked')
    .replace(/\bchicken\b/gi, 'stewed chicken').replace(/\b(stock ?fish|panla)\b/gi, 'stockfish');
}

/** "2 × 1 medium wrap" → "2 medium wraps"; "1 × 1 ladle" → "1 ladle" (for reading back aloud). */
function spokenAmount(how: string): string {
  const m = /^([\d.]+) × 1 (.+)$/.exec(how);
  if (!m) return how.replace(/^your usual /, 'your usual ');
  const n = Number(m[1]); const label = m[2].replace(/\s*\(.*\)$/, '');
  return n === 1 ? `1 ${label}` : `${m[1]} ${label.replace(/(\w+)$/, (w) => (/(s|sh|ch)$/.test(w) ? `${w}es` : `${w}s`))}`;
}


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
  const [speak, setSpeak] = useState(() => { try { return localStorage.getItem('nutivili-voice-replies') === 'on'; } catch { return false; } });
  // First time: ask whether they'd like answers spoken out loud or just written. Changeable any time.
  const [chosen, setChosen] = useState(() => { try { return localStorage.getItem('nutivili-voice-replies') != null; } catch { return true; } });
  const choose = (v: boolean) => { setSpeak(v); setChosen(true); if (!v) window.speechSynthesis?.cancel(); try { localStorage.setItem('nutivili-voice-replies', v ? 'on' : 'off'); } catch { /* ignore */ } };
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
      const u = utter(text);
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
      const fits = p.qty != null ? all.find((f) => gramsFor(f, p.qty, p.unit, p.size)) : undefined;
      const options = (fits ? [fits, ...all.filter((f) => f !== fits)] : all).slice(0, 4);
      const food = options[0] ?? null;
      // No amount said: use what they had last time if we know it; otherwise ask, never assume.
      const g = food && (p.qty != null || p.unit) ? gramsFor(food, p.qty, p.unit, p.size) : null;
      const last = !g && food && p.qty == null && !p.unit ? lastAmount(useStore.getState().entries, food) : null;
      const unsure = !!food && !matchIsConfident(p.text, food);
      if (last && !unsure) return { key: `${Date.now()}-${i}`, said: p, food, options, grams: last, how: `your usual ${fmt(last)} g of` };
      return { key: `${Date.now()}-${i}`, said: p, food, options, grams: g?.grams ?? null, how: g?.how ?? '', unsure };
    });
    setLines((cur) => {
      const all = [...cur, ...next];
      setTimeout(() => askNext(all), 50);
      return all;
    });
  }

  // Ask out loud about the first food that still needs something, then listen for the answer.
  // Change one line and carry on with the next question.
  const patchAndContinue = (key: string, patch: (x: Line) => Partial<Line>) => setLines((cur) => {
    const upd = cur.map((x) => (x.key === key ? { ...x, ...patch(x) } : x));
    setTimeout(() => askNext(upd), 50);
    return upd;
  });

  function askNext(all: Line[]) {
    // 0. Not sure the match is what was said: offer the closest options instead of guessing.
    const unsure = all.find((x) => x.food && x.unsure);
    if (unsure) {
      const opts = unsure.options.slice(0, 3);
      const q = `I'm not sure I found ${unsure.said.text}. Is it ${opts.map((o, i) => `${['one', 'two', 'three'][i]}: ${short(o).toLowerCase()}`).join(', ')}? Or say it another way.`;
      setAsking(q);
      say(q, () => listen((answer) => {
        const a = answer.toLowerCase();
        const pick = /\b(one|first|1)\b/.test(a) ? opts[0] : /\b(two|second|2)\b/.test(a) ? opts[1] : /\b(three|third|3)\b/.test(a) ? opts[2] : undefined;
        const again = pick ?? searchFoods(answer, { custom })[0];
        const ok = !!again && (!!pick || matchIsConfident(answer, again));
        if (!ok) { setLines((cur) => cur.filter((x) => x.key !== unsure.key)); const m = `I still couldn't find ${unsure.said.text}. Type it below, or add it as your own food.`; setAsking(m); say(m); return; }
        patchAndContinue(unsure.key, (x) => {
          const g = x.said.qty != null || x.said.unit ? gramsFor(again!, x.said.qty, x.said.unit, x.said.size) : null;
          return { food: again!, unsure: false, options: [again!, ...x.options.filter((o) => o.id !== again!.id)].slice(0, 4), grams: g?.grams ?? null, how: g?.how ?? '' };
        });
      }, true));
      return;
    }
    // 1. How it was cooked, for chicken and fish said without it: it changes the numbers.
    // "Rice and stew" is white rice with stew: don't ask which rice when a stew or sauce was said with it.
    const withStew = all.some((x) => /\b(stew|sauce|ayamase|ofada|curry|beans)\b/.test(x.said.text));
    const det = all.find((x) => x.food && !x.asked?.detail && detailQuestion(x.said.text) && !(withStew && detailQuestion(x.said.text)?.kind === 'rice'));
    if (det) {
      const dq = detailQuestion(det.said.text)!;
      setAsking(dq.q);
      say(dq.q, () => listen((answer) => {
        // "A smoothie": log what went in, never a made-up recipe.
        if (dq.kind === 'smoothie') { setLines((cur) => cur.filter((x) => x.key !== det.key)); understand(`${det.said.text} with ${answer}`); return; }
        const found = detailQuery(dq.kind, det.said.text, answer).map((q) => searchFoods(q, { custom })[0]).find(Boolean);
        patchAndContinue(det.key, (x) => {
          if (!found) return { asked: { ...x.asked, detail: true } };
          const g = x.said.qty != null || x.said.unit ? gramsFor(found, x.said.qty, x.said.unit, x.said.size) : null;
          return { food: found, options: [found, ...x.options.filter((o) => o.id !== found.id)].slice(0, 4), grams: g?.grams ?? (x.said.unit && /^(g|gram|kg|oz|lb)/.test(x.said.unit) ? x.grams : null), how: g?.how ?? x.how, asked: { ...x.asked, detail: true } };
        });
      }, true));
      return;
    }
    // 3. Soups: meat or fish in it, asked once after the amount (most of a soup's protein).
    const soup = all.find((x) => x.food && x.grams != null && !x.asked?.soup && !/\b(beef|meat|goat|chicken|fish|turkey|shaki|ponmo|kpomo|cow|crayfish|snail|assorted)\b/.test(x.said.text) && soupProteinQuestion(x.food, short(x.food).toLowerCase()));
    const l = all.find((x) => !x.food || x.grams == null);
    if (!l && soup) {
      const sq = soupProteinQuestion(soup.food!, short(soup.food!).toLowerCase())!;
      setAsking(sq);
      say(sq, () => listen((answer) => {
        setLines((cur) => cur.map((x) => (x.key === soup.key ? { ...x, asked: { ...x.asked, soup: true } } : x)));
        if (/^(no|nope|none|nothing|not really|just the soup|no meat)\b/i.test(answer.trim())) setTimeout(() => askNext(all.map((x) => (x.key === soup.key ? { ...x, asked: { ...x.asked, soup: true } } : x))), 50);
        else understand(soupMeat(answer));
      }, true));
      return;
    }
    // 4. Soup with no swallow said: ask once (eba, pounded yam, amala… carry most of the meal's calories).
    const SWALLOW = /\b(eba|garri|gari|pounded yam|poundo|iyan|amala|lafun|fufu|akpu|semo|semovita|tuwo|starch|wheat|swallow|banku|kenkey|rice|yam|plantain)\b/;
    const soloSoup = !l && !all.some((x) => SWALLOW.test(`${x.said.text} ${x.food?.name ?? ''}`.toLowerCase())) ? all.find((x) => x.food && x.asked?.soup && !x.asked?.swallow && soupProteinQuestion(x.food, '')) : undefined;
    if (soloSoup) {
      const q = `Did you have the ${short(soloSoup.food!).toLowerCase()} with a swallow, like eba, pounded yam, amala or fufu? Say which and how many wraps, or “no”.`;
      setAsking(q);
      say(q, () => listen((answer) => {
        setLines((cur) => cur.map((x) => (x.key === soloSoup.key ? { ...x, asked: { ...x.asked, swallow: true } } : x)));
        if (/^(no|nope|none|nothing|just the soup|on its own)\b/i.test(answer.trim())) setTimeout(() => askNext(all.map((x) => (x.key === soloSoup.key ? { ...x, asked: { ...x.asked, swallow: true } } : x))), 50);
        else understand(answer.replace(/^(yes|yeah|yep)[,.]?\s*/i, ''));
      }, true));
      return;
    }
    if (!l) {
      setAsking(null);
      if (all.length) say(`Got it: ${all.map((x) => `${x.how ? spokenAmount(x.how) : `${fmt(x.grams ?? 0)} grams`} of ${x.food ? short(x.food).toLowerCase() : x.said.text}`).join(', ')}. Tap add when you're ready.`);
      return;
    }
    if (!l.food) {
      const q = `I couldn't find ${l.said.text}. Try saying it another way, or type it below.`;
      setAsking(q); say(q);
      setLines((cur) => cur.filter((x) => x.key !== l.key));
      return;
    }
    const name = short(l.food).toLowerCase();
    // Ask the way people actually serve this food (see questionFor): never "how many bowls" of a soup.
    const asked = questionFor(l.food, name);
    // An ingredient of a smoothie or shake: say so, and ask what went in rather than what was drunk.
    const inDrink = (t: string) => (l.said.partOf ? `In the ${l.said.partOf}: ${t.charAt(0).toLowerCase()}${t.slice(1).replace('did you drink', 'went in')}` : t);
    const { unit: countUnit } = asked;
    const q = inDrink(asked.q), many = inDrink(asked.many);
    setAsking(q);
    say(q, () => listen((answer) => {
      const a = parseAmount(answer);
      // "300 grams with the bones": use the measured bone-in record, so bones aren't counted as food.
      const bone = /\b(with (the )?bones?|bone[- ]in|bones? included)\b/i.test(answer) ? boneInFood(l.food!, boneInQuery(l.food!.name)) : null;
      // A bare number ("two") counts in the unit we asked about (ladles, wraps, sticks...).
      const g = a.qty != null ? gramsFor(bone ?? l.food!, a.qty, a.unit ?? (a.size ? null : countUnit), a.size) : null;
      if (g && !bone && /\b(with (the )?bones?|bone[- ]in|bones? included)\b/i.test(answer)) toast(`No bone-in values for ${short(l.food!).toLowerCase()} — that weight is counted as all meat. Change the grams if you can weigh the meat alone.`);
      setLines((cur) => {
        const upd = cur.map((x) => (x.key === l.key ? { ...x, ...(bone && g && { food: bone, options: [bone, ...x.options].slice(0, 4) }), grams: g?.grams ?? x.grams, how: g?.how ?? x.how } : x));
        // Didn't catch a number: ask again and listen again (it used to stop here).
        if (!g) { const again = `Sorry, ${many.charAt(0).toLowerCase() + many.slice(1)} For example, ${countUnit ? `2 ${countUnit}s, or medium` : '150 grams'}.`; setAsking(again); const h = handler.current; say(again, () => listen(h, true)); }
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
            <button onClick={() => choose(!speak)} className="flex h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold" aria-label={speak ? 'Answers are spoken. Switch to written only' : 'Answers are written. Switch to spoken'}>{speak ? <Volume2 size={17} /> : <VolumeX size={17} />}{speak ? 'Talk back' : 'Write back'}</button>
            <button onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-surface" aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <p className="mt-1 text-sm text-silver">For example: “two boiled eggs, a cup of rice and three chicken wings”. I’ll ask if I need to know how much.</p>
        {!chosen && (
          <div className="mt-4 rounded-2xl bg-surface p-4" style={{ boxShadow: 'var(--shadow)' }} role="group" aria-label="How should I answer you?">
            <p className="font-bold">How should I answer you?</p>
            <p className="mt-0.5 text-[13px] text-silver">You can change this any time with the button at the top.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => choose(true)} className="btn-primary !h-11 text-[14px]"><Volume2 size={16} /> Talk back</button>
              <button onClick={() => choose(false)} className="btn-ghost !h-11 text-[14px]"><VolumeX size={16} /> Write back</button>
            </div>
          </div>
        )}

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
              <div key={l.key} className="p-2.5">
              <div className="flex items-center gap-3">
                {l.food && <FoodVisual name={l.food.name} category={l.food.category} size={44} />}
                <div className="min-w-0 flex-1">
                  {l.options.length > 1 ? (
                    <select aria-label={`Which ${l.said.text}`} className="w-full truncate bg-transparent text-[15px] font-semibold outline-none" value={l.food?.id} onChange={(e) => setLines((cur) => cur.map((x) => { if (x.key !== l.key) return x; const f = x.options.find((o) => o.id === e.target.value)!; const g = gramsFor(f, x.said.qty, x.said.unit, x.said.size); return { ...x, food: f, unsure: false, grams: g?.grams ?? x.grams, how: g?.how ?? x.how }; }))}>
                      {l.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  ) : <p className="truncate text-[15px] font-semibold">{l.food?.name ?? l.said.text}</p>}
                  {l.said.partOf && <p className="text-xs font-semibold text-accent">Part of your {l.said.partOf}</p>}
                  {l.unsure && <p className="text-xs font-semibold text-warn">Not sure this is “{l.said.text}” — check it</p>}
                  <p className="num text-xs text-silver">{l.grams ? `${l.how ? `${l.how} · ` : ''}${fmt(((l.food?.per100.kcal ?? 0) * l.grams) / 100)} kcal · ${fmt(((l.food?.per100.protein ?? 0) * l.grams) / 100, 1)} g protein` : 'How much? Enter grams →'}</p>
                </div>
                <div className="relative w-20 shrink-0">
                  <input inputMode="decimal" aria-label={`Grams of ${l.said.text}`} className="field !h-10 !px-2 pr-6 text-right" value={l.grams ?? ''} onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); setLines((cur) => cur.map((x) => (x.key === l.key ? { ...x, grams: e.target.value === '' ? null : v, how: '' } : x))); }} />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-silver">g</span>
                </div>
                <button onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-dim" aria-label={`Remove ${l.said.text}`}><Trash2 size={16} /></button>
              </div>
              {/* Wrong food or wrong amount? Fix it here, in this food's own servings. */}
              <LineFix line={l} custom={custom} onChange={(patch) => setLines((cur) => cur.map((x) => (x.key === l.key ? { ...x, ...patch } : x)))} />
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
          <button disabled={!ready} onClick={addAll} className="btn-primary"><Check size={18} /> {!lines.length ? 'Add to diary' : ready ? `Add ${lines.length} to ${MEAL_LABELS[meal]} · ${fmt(kcal)} kcal, ${fmt(protein)} g protein` : 'Answer the question above first'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Fix one voice line: pick a serving of this food (slices, wraps, ladles…) and how many, or swap the food. */
function LineFix({ line, custom, onChange }: { line: Line; custom: CustomFood[]; onChange: (patch: Partial<Line>) => void }) {
  const [swap, setSwap] = useState(false);
  const [q, setQ] = useState('');
  const servings = line.food ? naturalServings(line.food).slice(0, 4) : [];
  const [count, setCount] = useState(line.said.qty ?? 1);
  const [picked, setPicked] = useState<number | null>(null);
  const use = (i: number, n: number) => { const s = servings[i]; setPicked(i); setCount(n); onChange({ grams: Math.round(s.per * n), how: `${n} × 1 ${s.name}` }); haptic(); };
  const results = swap && q.trim().length > 1 ? searchFoods(q, { custom }).slice(0, 5) : [];
  return (
    <div className="mt-2 pl-[56px]">
      {servings.length > 0 && !swap && (
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center rounded-full bg-raised">
            <button onClick={() => picked != null ? use(picked, Math.max(0.5, count - (count > 1 ? 1 : 0.5))) : setCount((c) => Math.max(0.5, c - (c > 1 ? 1 : 0.5)))} className="grid h-8 w-8 place-items-center" aria-label={`Fewer ${line.said.text}`}><Minus size={14} /></button>
            <span className="num w-7 text-center text-sm font-bold" aria-label="How many">{fmt(count, 1)}</span>
            <button onClick={() => picked != null ? use(picked, count + (count < 1 ? 0.5 : 1)) : setCount((c) => c + (c < 1 ? 0.5 : 1))} className="grid h-8 w-8 place-items-center" aria-label={`More ${line.said.text}`}><Plus size={14} /></button>
          </div>
          {servings.map((s, i) => (
            <button key={s.name} onClick={() => use(i, count)} className={cx('chip !h-8 !px-3 text-[13px]', picked === i && 'chip-on')}>{s.name}</button>
          ))}
        </div>
      )}
      {swap ? (
        <div className="mt-1">
          <input autoFocus className="field !h-10" placeholder={`What was it instead of ${line.food ? short(line.food).toLowerCase() : line.said.text}?`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search for the right food" />
          <div className="mt-1 space-y-1">
            {results.map((f) => (
              <button key={f.id} onClick={() => { const g = gramsFor(f, line.said.qty, line.said.unit, line.said.size); onChange({ food: f, unsure: false, options: [f, ...line.options.filter((o) => o.id !== f.id)].slice(0, 4), grams: g?.grams ?? line.grams, how: g?.how ?? line.how }); setSwap(false); setQ(''); setPicked(null); haptic(); }} className="block w-full truncate rounded-xl bg-raised px-3 py-2 text-left text-sm font-semibold">{f.name}</button>
            ))}
          </div>
          <button onClick={() => { setSwap(false); setQ(''); }} className="mt-1 text-xs font-semibold text-silver">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setSwap(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-silver"><Pencil size={12} /> Wrong food? Change it</button>
      )}
    </div>
  );
}
