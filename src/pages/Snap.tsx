import { photoFingerprint, recall, remember } from '@/lib/scanMemory';
import { MenuFits } from '@/components/MenuFits';
import { PHOTO_ONLY } from '@/lib/photoDiary';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, ChevronRight, CircleCheck, Crown, Focus, ImagePlus, Loader2, Mic, RotateCcw, ScanBarcode, ScanLine, ScanSearch, ScanText, Search, X, Zap } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb, usePhotoUrl } from '@/lib/hooks';
import { deletePhoto, getPhoto, resizeImage, savePhoto } from '@/lib/photos';
import { recognizeMenuUrl, matchItem, matchItems, pickKey, portionConfidence, recognizeMenu, sendFeedback, PremiumRequiredError, SignInRequiredError, readLabelPhoto, recognizePhoto, recognizeText, RecognitionUnavailableError, ScanLimitError, type MatchedItem } from '@/lib/recognize-client';
import { refreshPremium } from '@/lib/premium';
import { SOURCE_SHORT, searchFoods, splitName } from '@/lib/foods';
import { mealForNow, todayKey } from '@/lib/dates';
import type { Food, Per100 } from '@/lib/types';
import { FoodSheet } from '@/components/FoodSheet';
import { SignInButtons } from '@/components/SignIn';
import { accountsEnabled, useSession } from '@/lib/account';
import { FoodVisual } from '@/components/FoodIcon';
import { Segmented, StateBadge, cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';
import { labelHighlights, labelPer100 } from '@/lib/label';
import { COOKING_METHODS, type CookingMethod } from '@/lib/recognition';
import { suggestPortions, type PortionRow } from '@/lib/portion';
import { dailyTargets } from '@/lib/energy';
import { useDay } from '@/lib/hooks';
import { PortionCoach } from '@/components/PortionCoach';
import { AllergyTag } from '@/components/Allergy';

type Phase = 'diary' | 'camera' | 'describe' | 'signin' | 'analyzing' | 'results' | 'label' | 'unavailable' | 'premium' | 'limit' | 'error';

export default function Snap() {
  const session = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const date = params.get('date') ?? todayKey();
  const back = () => nav(date === todayKey() ? '/' : `/?date=${date}`);
  const premiumToken = useStore((s) => s.premium?.token);
  const addEntry = useStore((s) => s.addEntry);
  const custom = useStore((s) => s.customFoods);
  const entries = useStore((s) => s.entries);
  const { db } = useFoodDb();

  const [phase, setPhase] = useState<Phase>(params.get('mode') === 'describe' ? 'describe' : 'camera');
  const [described, setDescribed] = useState(params.get('q') ?? '');
  const [photoId, setPhotoId] = useState<string>();
  const [error, setError] = useState('');
  const [left, setLeft] = useState<{ left: number; limit: number } | null>(null);
  const [note, setNote] = useState('');
  const [quality, setQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [matches, setMatches] = useState<MatchedItem[]>([]);
  const [pick, setPick] = useState<{ food: Food; grams?: number; label: string; index: number } | null>(null);
  const [logged, setLogged] = useState<Set<number>>(new Set());
  const [labelMode, setLabelMode] = useState(params.get('mode') === 'label');
  const [menuMode, setMenuMode] = useState(params.get('mode') === 'menu');
  // The results came from a restaurant menu, not a plate.
  const [isMenu, setIsMenu] = useState(false);
  const [label, setLabel] = useState<{ name: string; per100: Per100; servingGrams: number; unit: 'g' | 'ml'; note: string } | null>(null);
  const upsertCustomFood = useStore((s) => s.upsertCustomFood);
  const photoUrl = usePhotoUrl(photoId);

  // Remove the photo on exit if nothing was logged with it.
  const photoRef = useRef<string>();
  photoRef.current = photoId;
  useEffect(() => () => {
    const id = photoRef.current;
    // Handing the photo to manual search (/add?photo=…) keeps it; that page cleans up instead.
    if (window.location.pathname.startsWith(`${import.meta.env.BASE_URL}add`)) return;
    if (id && !useStore.getState().entries.some((e) => e.photoId === id)) void deletePhoto(id);
  }, []);

  // Photo-diary mode: keep the photo without numbers; it can still be analysed afterwards.
  const photoDiary = useStore((s) => s.settings.tracking === 'photo');
  async function saveToDiary(file: Blob) {
    let id: string;
    try { id = await savePhoto(file); } catch { toast('Couldn’t save the photo on this phone, so scanning it instead.'); return analyse(file); }
    setPhotoId(id);
    addEntry({ date, meal: mealForNow(), food: PHOTO_ONLY, grams: 1, photoId: id, note: 'Photo diary' });
    lastTry.current = { photoId: id };
    setPhase('diary');
  }
  /** Once a diary photo is logged with real foods, its numberless placeholder goes away. */
  const dropDiaryEntry = () => {
    const st = useStore.getState();
    for (const e of st.entries) if (e.foodId === PHOTO_ONLY.id && e.photoId && e.photoId === photoId) st.removeEntry(e.id);
  };

  // What was last sent, so a failed scan can be retried without taking the photo again.
  const lastTry = useRef<{ photoId?: string; text?: string } | null>(null);
  const [retryable, setRetryable] = useState(false);

  /** A menu behind a QR code or link: the server opens it and lists the dishes. */
  async function analyseMenuUrl(url: string) {
    setRetryable(false);
    setPhase('analyzing');
    try {
      const result = await recognizeMenuUrl(url);
      setIsMenu(true);
      await waitForDb();
      if (!result.isFood || !result.items.length) { setError(result.note || 'No dishes found on that menu. Take a photo of it instead.'); setPhase('error'); return; }
      setNote(result.note);
      setQuality(result.photoQuality ?? 'good');
      setMatches(matchItems(result, custom, useStore.getState().picks));
      setPhase('results');
    } catch (e) {
      if (e instanceof SignInRequiredError) setPhase('signin');
      else if (e instanceof PremiumRequiredError) { setError(e.message); setPhase('premium'); }
      else { setError((e as Error).message || 'Couldn’t read that menu.'); setPhase('error'); }
    }
  }

  async function analyse(file: Blob | null, text?: string, savedId?: string) {
    // Show progress straight away, before any saving or resizing.
    setRetryable(false);
    setPhase('analyzing');
    let small: Blob | undefined;
    let id = savedId;
    // Saving the photo on the phone is a nice-to-have (retry, diary thumbnails). If storage is
    // blocked or full (e.g. private browsing), scan the photo anyway instead of silently stopping.
    try {
      if (savedId) {
        small = (await getPhoto(savedId)) ?? undefined;
      } else if (file) {
        id = await savePhoto(file);
        setPhotoId(id);
        small = (await getPhoto(id)) ?? file;
      }
    } catch {
      id = undefined;
      small = file ? await resizeImage(file).catch(() => file) : undefined;
    }
    lastTry.current = { photoId: id, text };
    try {
      await refreshPremium();
      const token = useStore.getState().premium?.token ?? premiumToken;
      if (labelMode && small) {
        const read = await readLabelPhoto(small);
        const per100 = labelPer100(read);
        if (!per100) {
          setError(!read.isLabel ? read.note || 'That doesn’t look like a nutrition label. Photograph the nutrition table on the pack.' : read.basis === 'perServing' && !read.servingGrams ? 'This label only gives values per serving and the serving size isn’t readable. Try including the serving size in the photo.' : 'Couldn’t read the numbers clearly. Try again with the label flat and well lit.');
          setPhase('error');
          return;
        }
        setLabel({ name: read.name, per100, servingGrams: read.servingGrams, unit: read.basis === 'per100ml' ? 'ml' : 'g', note: read.note });
        setPhase('label');
        return;
      }
      // Same photo, same answer (and no extra AI scan): reuse the earlier result for an identical photo.
      const memMode = menuMode ? 'menu' : 'food';
      const hash = small ? await photoFingerprint(small) : null;
      const remembered = recall(hash, memMode);
      const result = remembered ?? (small ? (menuMode ? await recognizeMenu(small, token) : await recognizePhoto(small, token)) : await recognizeText(text ?? '', token));
      if (!remembered && small) remember(hash, memMode, result);
      setIsMenu(menuMode && !!small);
      await waitForDb();
      if (!result.isFood || !result.items.length) {
        setError(result.note || (file ? 'No food found in this photo.' : 'No food found in that description.'));
        setPhase('error');
        return;
      }
      setNote(remembered ? `You scanned this exact photo before, so this is the same result as last time (no extra scan used).${result.note ? ` ${result.note}` : ''}` : result.note);
      setQuality(result.photoQuality ?? 'fair');
      const r = result as typeof result & { scansLeft?: number; scanLimit?: number };
      setLeft(r.scanLimit != null && r.scanLimit < 900 && r.scansLeft != null ? { left: r.scansLeft, limit: r.scanLimit } : null);
      setMatches(matchItems(result, custom, useStore.getState().picks));
      setPhase('results');
    } catch (e) {
      if (e instanceof SignInRequiredError) setPhase('signin');
      else if (e instanceof PremiumRequiredError) { setError(e.message); setPhase('premium'); }
      else if (e instanceof ScanLimitError) { setError(e.message || 'Monthly photo scans used up.'); setPhase('limit'); }
      else if (e instanceof RecognitionUnavailableError) setPhase('unavailable');
      else {
        // Network or server trouble: the photo is kept on the phone, so it can be tried again.
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        setError(offline ? 'You’re offline. Your photo is saved — try again when you’re connected.' : (e as Error).message || 'Something went wrong.');
        setRetryable(true);
        setPhase('error');
      }
    }
  }

  // Matching needs the food database loaded.
  const dbRef = useRef(db);
  dbRef.current = db;
  const waitForDb = () =>
    new Promise<void>((resolve) => {
      const tick = () => (dbRef.current ? resolve() : setTimeout(tick, 100));
      tick();
    });

  function retake() {
    if (photoId && !entries.some((e) => e.photoId === photoId)) void deletePhoto(photoId);
    setPhotoId(undefined);
    setMatches([]);
    setLogged(new Set());
    setPhase('camera');
  }

  // Voice: the phone's own speech-to-text fills the description box (nothing is recorded or stored).
  type Recognizer = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
  const SR = typeof window !== 'undefined' ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognizer) | undefined : undefined;
  const canListen = !!SR;
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognizer | null>(null);
  function listen() {
    haptic();
    if (listening) { recRef.current?.stop(); return; }
    if (!SR) return;
    const rec = new SR();
    rec.lang = navigator.language || 'en-GB';
    rec.interimResults = false;
    rec.continuous = false;
    const before = described.trim();
    rec.onresult = (e) => { const said = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim(); if (said) setDescribed((before ? `${before}, ` : '') + said); };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); toast('Couldn’t hear that — check microphone permission, or type it.'); };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }

  const manualUrl = (q = '') => `/add?${new URLSearchParams({ ...(q && { q }), ...(photoId && { photo: photoId }), ...(date !== todayKey() && { date }) })}`;

  // Signed out: say so before they take a photo, not after.
  if (accountsEnabled && session === null && (phase === 'camera' || phase === 'describe')) {
    return (
      <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-12 md:max-w-2xl md:px-8">
        <header className="pt-safe flex items-center pb-4">
          <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        </header>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Sign in to use AI</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-silver">A free account gets 3 AI scans and 5 coach messages a day, and keeps your log safe on any phone.</p>
        <div className="card mt-6 p-5"><SignInButtons /></div>
        <Link to={manualUrl()} className="btn-ghost mt-3 w-full">Search foods instead — always free</Link>
      </div>
    );
  }
  if (phase === 'camera') return <Camera onClose={back} onCapture={(b) => (photoDiary && !labelMode && !menuMode ? saveToDiary(b) : analyse(b)).catch((e: Error) => { setError(e.message || 'Something went wrong. Try again.'); setRetryable(true); setPhase('error'); })} mode={labelMode ? 'label' : menuMode ? 'menu' : 'food'} onMode={(m) => { haptic(); setLabelMode(m === 'label'); setMenuMode(m === 'menu'); }} onBarcode={() => nav(`/barcode${date !== todayKey() ? `?date=${date}` : ''}`)} onMenuUrl={(u) => void analyseMenuUrl(u)} />;
  if (phase === 'describe') {
    return (
      <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-12 md:max-w-2xl md:px-8">
        <header className="pt-safe flex items-center pb-4">
          <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        </header>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Describe your meal</h1>
        <p className="mt-1 text-[15px] text-silver">Type or say what you ate — at home or eating out. We’ll find each food; you check the amounts.</p>
        <textarea autoFocus value={described} onChange={(e) => setDescribed(e.target.value)} maxLength={500} rows={4} placeholder="e.g. 2 scrambled eggs, a slice of wholemeal toast and a latte" className="field mt-5 !h-auto resize-none py-4 text-[17px]" />
        <div className="mt-3 flex flex-wrap gap-2">
          {['Chicken Caesar salad', 'Bowl of porridge with banana', 'Cheeseburger and fries', 'Restaurant chicken tikka masala with rice and naan'].map((x) => (
            <button key={x} onClick={() => setDescribed(x)} className="chip !h-9">{x}</button>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          {canListen && (
            <button onClick={listen} className={cx('btn !h-14 !w-14 shrink-0 !px-0', listening ? 'bg-danger text-white' : 'bg-surface text-ink')} style={{ boxShadow: 'var(--shadow)' }} aria-label={listening ? 'Stop listening' : 'Say what you ate'}>
              <Mic size={22} />
            </button>
          )}
          <button onClick={() => void analyse(null, described)} disabled={described.trim().length < 3} className="btn-primary flex-1">Find foods</button>
        </div>
        {canListen && <p className="mt-2 text-xs text-dim">{listening ? 'Listening… say what you ate, then tap the mic again.' : 'Tap the mic to say it instead of typing.'}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 md:max-w-2xl md:px-8 pb-12">
      <header className="pt-safe flex items-center justify-between pb-4">
        <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Close">
          <X size={20} strokeWidth={2.4} />
        </button>
        <button onClick={retake} className="flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold" style={{ boxShadow: 'var(--shadow)' }}>
          <RotateCcw size={16} /> Retake
        </button>
      </header>

      <div className={cx('relative overflow-hidden rounded-[28px] bg-raised', !photoUrl && 'h-16')} style={photoUrl ? { aspectRatio: '4 / 3' } : undefined}>
        {photoUrl && <img src={photoUrl} alt="Your meal" className="h-full w-full object-cover" />}
        {phase === 'analyzing' && (
          <div className="absolute inset-0 overflow-hidden bg-black/30">
            <div className="scanline absolute inset-x-0 top-0 h-[10%] bg-gradient-to-b from-transparent via-white/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-4 grid place-items-center">
              <ScanSteps menu={menuMode} />
            </div>
          </div>
        )}
        {phase === 'results' && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
            <CircleCheck size={13} /> {matches.length} {isMenu ? (matches.length === 1 ? 'dish on this menu' : 'dishes on this menu') : matches.length === 1 ? 'food' : 'foods'} found
          </span>
        )}
      </div>

      {phase === 'results' && (
        <>
          {quality === 'poor' ? (
            <div role="alert" className="mt-4 rounded-[20px] bg-warn/10 p-4 text-warn">
              <p className="text-[15px] font-bold">This photo is hard to estimate from</p>
              <p className="mt-1 text-[14px] leading-relaxed">{note || 'It’s too dark, blurred or cropped to judge portions.'} The foods below may be right, but weigh them or retake the photo for better numbers.</p>
              <button onClick={retake} className="mt-3 flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink"><RotateCcw size={15} /> Retake photo</button>
            </div>
          ) : quality === 'fair' ? (
            <p className="mt-4 rounded-2xl bg-raised px-4 py-3 text-[14px] leading-relaxed text-silver">Weights are rough: there’s no clear size reference (plate, cutlery, hand) in the photo. Weigh the food, or include the whole plate next time.</p>
          ) : null}
          <p className="mt-4 px-1 text-[14px] font-medium leading-relaxed text-silver">
            Tap the closest match, then weigh. AI identifies the food — calories and nutrients always come from the database record.
            {note && quality !== 'poor' && <span className="mt-1 block text-ink/80">{note}</span>}
          </p>
          {left && (
            <Link to="/premium" className="mt-3 flex items-center justify-between rounded-2xl bg-accent/10 px-4 py-3 text-[14px] font-semibold text-accent">
              <span>{left.left} of {left.limit} free AI scans left today</span>
              <span>Unlimited →</span>
            </Link>
          )}
          {isMenu && <MenuFits matches={matches} date={date} onPick={(i) => { const m = matches[i]; if (m.candidates[0]) setPick({ food: m.candidates[0], grams: m.item.estimatedGrams || undefined, label: m.item.name, index: i }); }} />}
          {!isMenu && matches.length > 0 && <PlateWeight matches={matches} onApply={(factor) => { setMatches((ms) => ms.map((m) => ({ ...m, item: { ...m.item, estimatedGrams: Math.round(m.item.estimatedGrams * factor), gramsLow: Math.round(m.item.estimatedGrams * factor), gramsHigh: Math.round(m.item.estimatedGrams * factor) } }))); toast('Portions updated from your plate weight'); }} />}
          {!isMenu && <PlateSummary
            matches={matches}
            logged={logged}
            onAddExtra={(food, grams) => { addEntry({ date, meal: mealForNow(), food, grams, note: 'Cooking fat added to a scanned meal' }); toast(`Added ${grams} g ${splitName(food.name).title.toLowerCase()}`); }}
            date={date}
            onLogAll={(rows: PlateRow[]) => {
              dropDiaryEntry();
              rows.forEach((r, k) => addEntry({ date, meal: mealForNow(), food: r.food, grams: r.grams, photoId: k === 0 ? photoId : undefined, note: r.confirmed ? 'Weight set by you' : r.suggested ? 'Portion estimated — suggested serving, edit to what you ate' : 'Portion estimated by AI — edit to your real weight' }));
              setLogged((s) => { const n = new Set(s); rows.forEach((r) => n.add(r.index)); return n; });
              toast(`Logged ${rows.length} food${rows.length > 1 ? 's' : ''} — tap any to set the real weight`);
            }}
          />}
          <p className="mt-5 px-1 text-[15px] font-semibold">Check each food</p>
          <div className="mt-2 space-y-3">
            {matches.map((m, i) => (
              <ItemCard
                key={i}
                match={m}
                quality={quality}
                done={logged.has(i)}
                onMethod={(method) => setMatches((ms) => ms.map((x, j) => (j === i ? matchItem({ ...x.item, method }, custom, useStore.getState().picks) : x)))}
                onPick={(food) => {
                  useStore.getState().rememberPick(pickKey(m.item.name), food.id);
                  sendFeedback([{ aiName: m.item.name, localName: m.item.localName, cuisine: m.item.cuisine, chosenFoodId: food.id, chosenName: food.name, rank: m.candidates.findIndex((c) => c.id === food.id), kind: 'item' }]);
                  setPick({ food, grams: m.item.estimatedGrams || undefined, label: m.item.name, index: i });
                }}
                onLogIngredients={(rows) => {
                  sendFeedback(rows.map((r) => {
                    const ing = m.ingredients.find((x) => x.candidates.some((c) => c.id === r.food.id));
                    return { aiName: ing?.ingredient.name ?? r.food.name, cuisine: m.item.cuisine, chosenFoodId: r.food.id, chosenName: r.food.name, rank: ing ? ing.candidates.findIndex((c) => c.id === r.food.id) : -1, kind: 'ingredient' as const };
                  }));
                  rows.forEach((r, k) => addEntry({ date, meal: mealForNow(), food: r.food, grams: r.grams, photoId: k === 0 ? photoId : undefined, note: `Part of ${m.item.name}` }));
                  setLogged((s) => new Set(s).add(i));
                  toast(`Added ${rows.length} ingredient${rows.length > 1 ? 's' : ''} from ${m.item.name}`);
                }}
                manualUrl={manualUrl(m.item.searchQueries[0] ?? m.item.name)}
              />
            ))}
          </div>
          <Link to={manualUrl()} className="mt-3 flex h-14 items-center justify-center gap-2 rounded-full bg-surface text-sm font-semibold" style={{ boxShadow: 'var(--shadow)' }}>
            <Search size={16} /> Add something else
          </Link>
          {logged.size > 0 && (
            <button onClick={back} className="btn-primary mt-3 w-full">Done · {logged.size} logged</button>
          )}
        </>
      )}

      {phase === 'label' && label && (
        <div className="mt-4">
          <p className="px-1 text-[14px] font-medium leading-relaxed text-silver">Read from the label. Check the numbers against the pack and fix anything that’s off — then save.</p>
          {label.note && <p className="mt-2 rounded-2xl bg-warn/15 px-4 py-3 text-sm font-medium">{label.note}</p>}
          <div className="card mt-3 p-5">
            <label className="label" htmlFor="lb-name">Product name</label>
            <input id="lb-name" className="field" maxLength={60} placeholder="e.g. Protein yoghurt, strawberry" value={label.name} onChange={(e) => setLabel({ ...label, name: e.target.value })} />
            <p className="label mt-4">Per 100 {label.unit}</p>
            <div className="grid grid-cols-2 gap-2">
              {([['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['sugar', 'of which sugars', 'g'], ['fat', 'Fat', 'g'], ['satFat', 'of which saturates', 'g'], ['fiber', 'Fibre', 'g'], ['sodium', 'Sodium', 'mg']] as const).map(([k, l, u]) => (
                <label key={k} className="rounded-2xl bg-raised px-3 py-2">
                  <span className="block text-xs font-semibold text-silver">{l} ({u})</span>
                  <input inputMode="decimal" aria-label={l} className="num mt-0.5 w-full bg-transparent text-[17px] font-bold outline-none" placeholder="not on label" value={label.per100[k] ?? ''} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); setLabel({ ...label, per100: { ...label.per100, [k]: v === '' ? (k === 'protein' ? 0 : null) : Number(v) } }); }} />
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-dim">These are the manufacturer’s numbers as printed. Empty boxes weren’t on the label and stay unknown.</p>
            {(() => { const hl = labelHighlights(label.per100 as never, label.unit); return hl.length > 0 && (
              <div className="mt-3 rounded-2xl bg-raised p-3.5">
                <p className="text-[14px] font-semibold">What this label means</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hl.map((h) => <span key={h.text} className={cx('rounded-full px-2.5 py-1 text-[13px] font-semibold', h.tone === 'good' ? 'bg-accent/10 text-accent' : h.tone === 'watch' ? 'bg-warn/15 text-warn' : 'bg-surface')}>{h.text}</span>)}
                </div>
                <p className="mt-2 text-[12px] text-dim">Per 100 {label.unit}, using the UK traffic-light thresholds. Fine in a balanced day — just good to know.</p>
              </div>
            ); })()}
            <button
              disabled={label.name.trim().length < 2}
              onClick={() => {
                const food = upsertCustomFood({ name: label.name.trim(), category: 'My foods', state: 'na', per100: label.per100, portions: label.servingGrams > 0 ? [{ label: '1 serving', grams: Math.round(label.servingGrams) }] : [], sourceNote: 'Read from a photo of the nutrition label, checked by you' });
                toast('Saved to My recipes & foods');
                setPick({ food, grams: label.servingGrams > 0 ? Math.round(label.servingGrams) : undefined, label: food.name, index: 0 });
              }}
              className="btn-primary mt-4 w-full"
            >
              {label.name.trim().length < 2 ? 'Add the product name' : 'Save and log'}
            </button>
          </div>
          {logged.size > 0 && <button onClick={back} className="btn-ghost mt-3 w-full">Done</button>}
        </div>
      )}

      {phase === 'unavailable' && (
        <div className="card mt-5 p-5">
          <p className="flex items-center gap-2 font-semibold"><Zap size={18} className="text-accent" /> Photo recognition isn’t set up</p>
          <p className="mt-2 text-sm leading-relaxed text-silver">
            Your photo is saved. Automatic identification switches on once the app’s server is set up. Meanwhile, pick the food yourself — it only takes a moment.
          </p>
          <div className="mt-4 grid gap-2">
            <Link to={manualUrl()} className="btn-primary">Pick food manually</Link>
          </div>
        </div>
      )}

      {phase === 'signin' && (
        <div className="card mt-5 p-5">
          <p className="text-[17px] font-bold">Sign in to use AI scans</p>
          <p className="mt-1 text-sm text-silver">Free accounts get 3 AI scans a day. Your photo is saved — or pick the food yourself, always free.</p>
          <div className="mt-4"><SignInButtons /></div>
          <Link to={manualUrl()} className="btn-ghost mt-2 w-full">Pick food manually</Link>
        </div>
      )}

      {phase === 'premium' && (
        <div className="card mt-5 p-5">
          <p className="flex items-center gap-2 text-[17px] font-bold"><ScanLine size={18} className="text-accent" /> You’re out of AI scans</p>
          <p className="mt-2 text-sm leading-relaxed text-silver">{error || 'Unlimited AI scans come with Pro.'} Picking the food yourself is always free.</p>
          <div className="mt-4 grid gap-2">
            <Link to="/premium" className="btn-primary"><Crown size={17} /> Upgrade to Pro — $7.99/month</Link>
            <Link to={manualUrl()} className="btn-ghost">Pick food manually</Link>
          </div>
        </div>
      )}

      {phase === 'limit' && (
        <div className="card mt-5 p-5">
          <p className="font-semibold">Monthly photo scans used up</p>
          <p className="mt-1 text-sm text-silver">{error} Your scans reset on the 1st. You can still pick the food yourself.</p>
          <div className="mt-4 grid gap-2">
            <Link to={manualUrl()} className="btn-primary">Pick food manually</Link>
            <Link to="/premium" className="btn-ghost">See plans</Link>
          </div>
        </div>
      )}

      {phase === 'diary' && (
        <div className="card mt-5 p-5">
          <p className="font-semibold">Saved to your photo diary</p>
          <p className="mt-1 text-sm text-silver">No numbers needed. If you’d like the nutrition for this meal, the AI can analyse it now.</p>
          <div className="mt-4 grid gap-2">
            <button onClick={back} className="btn-primary">Done</button>
            <button onClick={() => { haptic(); void analyse(null, undefined, lastTry.current?.photoId); }} className="btn-ghost"><ScanSearch size={17} /> Analyse it with AI</button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="card mt-5 p-5">
          <p className="font-semibold">Couldn’t identify this one</p>
          <p className="mt-1 text-sm text-silver">{error}</p>
          <div className="mt-4 grid gap-2">
            {retryable && lastTry.current && (
              <button onClick={() => { haptic(); void analyse(null, lastTry.current?.text, lastTry.current?.photoId); }} className="btn-primary"><RotateCcw size={17} /> Try again</button>
            )}
            <Link to={manualUrl()} className={retryable ? 'btn-ghost' : 'btn-primary'}>Pick food manually</Link>
            <button onClick={retake} className="btn-ghost">Try another photo</button>
          </div>
        </div>
      )}

      <FoodSheet
        food={pick?.food ?? null}
        date={date}
        preset={pick ? { photoId, aiEstimate: pick.grams } : undefined}
        onClose={() => setPick(null)}
        onSaved={() => { dropDiaryEntry(); if (pick) setLogged((s) => new Set(s).add(pick.index)); }}
        onSwitchFood={(f) => setPick((p) => (p ? { ...p, food: f } : p))}
      />
    </div>
  );
}

function ItemCard({ match, done, quality, onPick, onMethod, manualUrl, onLogIngredients }: { match: MatchedItem; done: boolean; quality: 'good' | 'fair' | 'poor'; onPick: (f: Food) => void; onMethod: (m: CookingMethod) => void; manualUrl: string; onLogIngredients: (rows: { food: Food; grams: number }[]) => void }) {
  const { item, candidates } = match;
  const [open, setOpen] = useState(false);
  const hasIngredients = match.ingredients.length > 0;
  const [mode, setMode] = useState<'dish' | 'ingredients'>('dish');
  const shown = open ? candidates : candidates.slice(0, 2);
  const sub = useMemo(() => [item.localName && item.localName !== item.name ? item.localName : '', item.cuisine].filter(Boolean).join(' · '), [item]);
  return (
    <div className={cx('card p-4 transition', done && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{item.name}</p>
          {sub && <p className="mt-0.5 text-xs font-medium text-silver">{sub}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {item.confidence !== 'high' && <span className={cx('rounded-full px-2.5 py-1 text-[12px] font-semibold', item.confidence === 'low' ? 'bg-warn/15 text-warn' : 'bg-raised text-silver')} title="How sure the AI is about what this food is">{item.confidence === 'low' ? 'Food: not sure — check' : 'Food: fairly sure'}</span>}
          {item.estimatedGrams > 0 && <span className="rounded-full border border-dashed border-silver/50 px-2.5 py-1 text-[12px] font-medium text-silver" title="AI estimate from the photo — weigh it for the real number">~{item.estimatedGrams} g</span>}
          {done && <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white"><Check size={15} strokeWidth={3} /></span>}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-silver">
        <label className="flex items-center gap-1.5 rounded-full bg-raised py-1 pl-3 pr-1.5">
          <span className="font-medium">Cooked:</span>
          <select aria-label={`How ${item.name} was cooked`} value={item.method} onChange={(e) => { haptic(); onMethod(e.target.value as CookingMethod); }} className="bg-transparent font-semibold text-ink outline-none">
            {COOKING_METHODS.map((m) => <option key={m} value={m}>{m === 'none' ? 'not cooked / n/a' : m}</option>)}
          </select>
        </label>
        {item.estimatedGrams > 0 && item.gramsHigh > item.gramsLow && (
          <span title="Likely range from the photo">{item.size} portion · likely {item.gramsLow}–{item.gramsHigh} g</span>
        )}
        {(() => { const pc = portionConfidence(item, quality); return (
          <span className={cx('rounded-full px-2.5 py-0.5 font-semibold', pc === 'good' ? 'bg-accent/10 text-accent' : pc === 'rough' ? 'bg-raised text-silver' : 'bg-warn/15 text-warn')} title="How sure the estimate of the amount is (separate from what the food is)">
            Amount: {pc === 'good' ? 'good estimate' : pc === 'rough' ? 'rough — weigh if you can' : 'unsure — please weigh'}
          </span>
        ); })()}
        {match.learned && <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-semibold text-accent">{match.learned === 'mine' ? 'Your usual pick' : 'Most people pick this'}</span>}
      </div>

      {hasIngredients && (
        <div className="mt-3">
          <Segmented full value={mode} onChange={(m) => { haptic(); setMode(m); }} options={[{ value: 'dish', label: 'Whole dish' }, { value: 'ingredients', label: `By ingredient (${match.ingredients.length})` }]} />
        </div>
      )}

      {mode === 'ingredients' ? (
        <IngredientList match={match} onLog={onLogIngredients} />
      ) : candidates.length > 0 ? (
        <div className="-mx-2 mt-2">
          {shown.map((f) => {
            const { title, detail } = splitName(f.name);
            return (
              <button key={f.id} onClick={() => onPick(f)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition active:bg-raised/70">
                <FoodVisual name={f.name} category={f.category} fdcId={f.fdcId} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] font-medium text-silver">
                    <StateBadge state={f.state} />
                    <AllergyTag food={f} />
                    <span>{SOURCE_SHORT[f.source]}</span>
                    {detail && <span className="truncate">· {detail}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-[15px] font-bold leading-none">{f.per100.kcal != null ? fmt(f.per100.kcal) : '–'}<span className="text-[12px] text-silver"> kcal</span></p>
                  <p className="num mt-0.5 text-[12px] text-dim">{fmt(f.per100.protein, 1)}g protein /100g</p>
                </div>
                <ChevronRight size={15} className="text-dim" />
              </button>
            );
          })}
          {candidates.length > 2 && (
            <button onClick={() => setOpen((o) => !o)} className="ml-2 mt-1 text-xs font-semibold text-accent">
              {open ? 'Fewer matches' : `${candidates.length - 2} more matches`}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-silver">Not in our databases yet.</p>
      )}
      <Link to={manualUrl} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-silver">
        <Search size={13} /> Search other matches
      </Link>
    </div>
  );
}

/** Full-screen camera with a live viewfinder. Falls back to the system camera/gallery picker. */
function Camera({ onClose, onCapture, mode, onMode, onBarcode, onMenuUrl }: { onClose: () => void; onCapture: (b: Blob) => void; mode: 'food' | 'label' | 'menu'; onMode: (m: 'food' | 'label' | 'menu') => void; onBarcode: () => void; onMenuUrl: (url: string) => void }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState<'starting' | 'on' | 'off'>('starting');
  // Why the live camera isn't available, so we can say how to fix it.
  const [why, setWhy] = useState<'blocked' | 'none' | 'unsupported' | null>(null);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { setWhy('unsupported'); setLive('off'); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stop();
        streamRef.current = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => undefined);
        }
        const track = s.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch({ supported: !!caps.torch, on: false });
        setWhy(null);
        setLive('on');
      } catch (e) {
        const name = (e as DOMException)?.name;
        setWhy(name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'unsupported');
        setLive('off');
      }
    };
    void start();
    // Phones stop the camera when the app goes to the background (the feed turns black on return): restart it.
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop();
      else if (!cancelled && !streamRef.current?.active) { setLive('starting'); void start(); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, []);

  // Menu mode: spot a table QR code in the live picture (where the browser can read QR codes).
  useEffect(() => {
    if (mode !== 'menu' || live !== 'on') return;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!BD) return;
    let stop = false; let det: InstanceType<typeof BD>;
    try { det = new BD({ formats: ['qr_code'] }); } catch { return; }
    const tick = async () => {
      if (stop || !videoRef.current?.videoWidth) return;
      try {
        const found = (await det.detect(videoRef.current)).map((c) => c.rawValue).find((v) => /^https:\/\//i.test(v));
        if (found) { stop = true; haptic([10, 30, 10]); onMenuUrl(found); }
      } catch { /* keep looking */ }
    };
    const t = setInterval(() => void tick(), 700);
    return () => { stop = true; clearInterval(t); };
  }, [mode, live, onMenuUrl]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch { setTorch({ supported: false, on: false }); }
  }

  function shoot() {
    const v = videoRef.current;
    // Not ready yet (or the feed stopped): use the phone's own camera instead of doing nothing.
    if (!v || !v.videoWidth) { captureRef.current?.click(); return; }
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => (b ? onCapture(b) : captureRef.current?.click()), 'image/jpeg', 0.9);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <video ref={videoRef} playsInline muted autoPlay className={cx('absolute inset-0 h-full w-full object-cover transition-opacity', live === 'on' ? 'opacity-100' : 'opacity-0')} />

      {/* Framing guide */}
      {live === 'on' && (
        <div className="pointer-events-none absolute inset-x-8 top-[18%] bottom-[30%]">
          {['left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-[22px]', 'right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-[22px]', 'left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-[22px]', 'right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-[22px]'].map((c) => (
            <span key={c} className={cx('absolute h-10 w-10 border-white/90', c)} />
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 1.25rem)' }}>
        <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-black/45 backdrop-blur-md" aria-label="Close camera"><X size={20} /></button>
        <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-3.5 py-2 text-xs font-semibold backdrop-blur-md"><Focus size={13} /> {mode === 'label' ? 'Fit the nutrition table in the frame' : mode === 'menu' ? 'Snap the menu or its QR code' : 'Fit the whole plate in the frame'}</span>
        {torch.supported ? (
          <button onClick={() => void toggleTorch()} className={cx('grid h-11 w-11 place-items-center rounded-full backdrop-blur-md', torch.on ? 'bg-white text-black' : 'bg-black/45')} aria-label={torch.on ? 'Turn flash off' : 'Turn flash on'} aria-pressed={torch.on}><Zap size={19} /></button>
        ) : <span className="w-11" />}
      </div>

      {live === 'off' && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <p className="text-lg font-semibold">{why === 'blocked' ? 'Camera access is off' : 'Take a photo of your food'}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              {why === 'blocked'
                ? 'You can still use your phone’s camera below. To use the live camera here: on iPhone, Settings → Safari → Camera → Allow (or tap “aA” in the address bar → Website Settings); on Android, tap the lock icon by the address → Permissions → Camera → Allow. Then reopen this screen.'
                : why === 'none' ? 'No camera was found. Choose a photo you already have instead.'
                : 'Use your camera or choose a photo you already have.'}
            </p>
            <button onClick={() => captureRef.current?.click()} className="mt-6 h-14 w-full rounded-full bg-white font-semibold text-black">Open camera</button>
            <button onClick={() => fileRef.current?.click()} className="mt-2 h-12 w-full rounded-full bg-white/15 font-semibold text-white">Choose from library</button>
          </div>
        </div>
      )}

      {linkOpen && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/60" onClick={() => setLinkOpen(false)}>
          <div className="w-full rounded-t-[28px] bg-bg p-5 text-ink" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold">Menu from a QR code or link</p>
            <p className="mt-1 text-sm text-silver">Point your phone’s camera app at the table QR code, copy the link it opens, and paste it here. Or paste any online menu link.</p>
            <input type="url" inputMode="url" autoFocus className="field mt-3" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Menu link" />
            <button disabled={!/^https:\/\/\S+\.\S+/.test(link.trim())} onClick={() => { setLinkOpen(false); onMenuUrl(link.trim()); }} className="btn-primary mt-3 w-full">Read this menu</button>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}>
      {mode === 'menu' && (
        <div className="mb-3 flex justify-center"><button onClick={() => setLinkOpen(true)} className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-md">QR code or menu link</button></div>
      )}
      <div className="mx-auto mb-5 grid max-w-md grid-cols-5 gap-1.5 px-3">
        {([['food', 'Food', ScanLine], ['barcode', 'Barcode', ScanBarcode], ['label', 'Label', ScanText], ['menu', 'Menu', BookOpen], ['library', 'Library', ImagePlus]] as const).map(([m, label, Icon]) => {
          const on = m === mode;
          return (
            <button
              key={m}
              onClick={() => (m === 'barcode' ? onBarcode() : m === 'library' ? fileRef.current?.click() : onMode(m))}
              className={cx('flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[12px] font-semibold backdrop-blur-md transition active:scale-95', on ? 'bg-white text-black' : 'bg-black/45 text-white')}
              aria-pressed={on}
            >
              <Icon size={19} /> {label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-10">
        <span className="w-12" />
        <button
          onClick={() => (live === 'on' ? shoot() : captureRef.current?.click())}
          className="grid h-20 w-20 place-items-center rounded-full border-4 border-white/90 transition active:scale-95"
          aria-label="Take photo"
        >
          <span className="h-[62px] w-[62px] rounded-full bg-white" />
        </button>
        <span className="w-12" />
      </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onCapture(e.target.files[0])} />
      <input ref={captureRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && onCapture(e.target.files[0])} />
    </div>
  );
}

/** Confirm or correct each ingredient of a mixed dish and enter its weight. */
function IngredientList({ match, onLog }: { match: MatchedItem; onLog: (rows: { food: Food; grams: number }[]) => void }) {
  const [rows, setRows] = useState(() =>
    match.ingredients.map((m) => ({ ing: m.ingredient, options: m.candidates, choice: 0, grams: '', on: true })),
  );
  const update = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const ready = rows.filter((r) => r.on && r.options[r.choice] && Number(r.grams) > 0);
  const total = ready.reduce((sum, r) => sum + (r.options[r.choice].per100.protein * Number(r.grams)) / 100, 0);
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12px] text-silver">Untick what isn’t in your dish, pick the closest match and enter what you used (edible weight).</p>
      {rows.map((r, i) => {
        const food = r.options[r.choice];
        return (
          <div key={i} className={cx('rounded-2xl bg-raised/70 p-3 transition', !r.on && 'opacity-45')}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={r.on} onChange={(e) => update(i, { on: e.target.checked })} className="h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" aria-label={`Include ${r.ing.name}`} />
              <p className="flex-1 text-sm font-semibold">{r.ing.name}{!r.ing.visible && <span className="ml-1.5 rounded-full bg-warn/15 px-1.5 py-0.5 text-[12px] font-semibold text-warn">often hidden</span>}</p>
              <div className="relative w-24">
                <input inputMode="decimal" value={r.grams} onChange={(e) => update(i, { grams: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" disabled={!r.on} className="field !h-10 pr-7 text-right font-semibold" aria-label={`${r.ing.name} grams`} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-silver">g</span>
              </div>
            </div>
            {r.on && (food ? (
              <select value={r.choice} onChange={(e) => update(i, { choice: Number(e.target.value) })} className="mt-2 w-full truncate rounded-xl bg-surface px-3 py-2 text-xs" aria-label={`Database match for ${r.ing.name}`}>
                {r.options.map((o, j) => <option key={o.id} value={j}>{splitName(o.name).title} — {fmt(o.per100.protein, 1)} g/100 g ({SOURCE_SHORT[o.source]})</option>)}
              </select>
            ) : (
              <p className="mt-2 text-xs text-dim">No database match yet — add it separately with search.</p>
            ))}
          </div>
        );
      })}
      <button onClick={() => { haptic(12); onLog(ready.map((r) => ({ food: r.options[r.choice], grams: Number(r.grams) }))); }} disabled={!ready.length} className="btn-primary mt-1 w-full !h-12 text-sm">
        {ready.length ? `Add ${ready.length} ingredient${ready.length > 1 ? 's' : ''} · ${fmt(total, 1)} g protein` : 'Enter at least one weight'}
      </button>
    </div>
  );
}

/**
 * The whole plate at a glance: every food found, with totals from the best database match
 * and the AI's portion estimate. Clearly an estimate until the person weighs each food.
 */
type Amount = 'none' | 'little' | 'usual' | 'lot';
const AMOUNT_LABEL: Record<Amount, string> = { none: 'None', little: 'A little', usual: 'Usual', lot: 'A lot' };

type PlateRow = { food: Food; grams: number; index: number; confirmed: boolean; suggested: boolean };

function PlateSummary({ matches, logged, date, onLogAll, onAddExtra }: { matches: MatchedItem[]; logged: Set<number>; date: string; onLogAll: (rows: PlateRow[]) => void; onAddExtra: (food: Food, grams: number) => void }) {
  const [extras, setExtras] = useState<string[]>([]);
  const addEntry = useStore((s) => s.addEntry);
  // Where the food was made sets the default for hidden extras: restaurants and street food usually use more oil.
  const [where, setWhere] = useState<'home' | 'out'>('home');
  const [amount, setAmount] = useState<Record<string, Amount>>({});
  const hidden = matches.flatMap((m, i) => (logged.has(i) ? [] : m.hidden.map((h, k) => ({ key: `${i}:${k}`, index: i, dish: m.item.name, ...h }))));
  const amountOf = (key: string): Amount => amount[key] ?? (where === 'out' ? 'lot' : 'usual');
  const hiddenGrams = (h: (typeof hidden)[number], a: Amount = amountOf(h.key)) => (a === 'none' ? 0 : h.extra[a]);
  // Grams taken from the portion coach (not weighed, so still an estimate).
  const [suggested, setSuggested] = useState<Set<number>>(new Set());
  // Grams the person typed in, by food; anything not typed is still the AI's estimate.
  const [set, setSet] = useState<Record<number, number>>({});
  const rows = matches.map((m, index) => ({ index, name: m.item.name, food: m.candidates[0], grams: set[index] ?? m.item.estimatedGrams, confirmed: set[index] != null && !suggested.has(index), suggested: suggested.has(index) }));
  const usable = rows.filter((r) => r.food && r.grams > 0) as (PlateRow & { name: string })[];
  const plan = usePortionPlan(usable.filter((r) => !suggested.has(r.index)).length === usable.length ? usable : null, date);
  const [frozen, setFrozen] = useState<typeof plan>(null);
  // Once anything is logged, the day's totals include this plate, so the advice would shift — hide it.
  const shownPlan = logged.size ? null : suggested.size ? frozen ?? plan : plan;
  const t = usable.reduce((a, r) => {
    const k = r.grams / 100;
    return { kcal: a.kcal + (r.food.per100.kcal ?? 0) * k, protein: a.protein + r.food.per100.protein * k, carbs: a.carbs + (r.food.per100.carbs ?? 0) * k, fat: a.fat + (r.food.per100.fat ?? 0) * k };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  for (const h of hidden) {
    const k = hiddenGrams(h) / 100;
    t.kcal += (h.food.per100.kcal ?? 0) * k; t.protein += h.food.per100.protein * k; t.carbs += (h.food.per100.carbs ?? 0) * k; t.fat += (h.food.per100.fat ?? 0) * k;
  }
  // Likely range: weights you entered are exact; AI weights use their range; hidden extras go from a little to a lot.
  const kcalAt = (side: 'low' | 'high') => usable.reduce((a, r) => {
    const m = matches[r.index].item;
    const g = r.confirmed || !m.gramsHigh ? r.grams : side === 'low' ? m.gramsLow : m.gramsHigh;
    return a + ((r.food.per100.kcal ?? 0) * g) / 100;
  }, 0) + hidden.reduce((a, h) => a + ((h.food.per100.kcal ?? 0) * (side === 'low' ? h.extra.little : h.extra.lot)) / 100, 0);
  const lowK = Math.round(kcalAt('low')), highK = Math.round(kcalAt('high'));
  const todo = usable.filter((r) => !logged.has(r.index));
  const missing = rows.length - usable.length;
  if (!usable.length) return null;
  return (
    <div className="card mt-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[17px] font-bold">Whole plate</p>
        <span className="rounded-full border border-dashed border-silver/60 px-2.5 py-1 text-[12px] font-semibold text-silver">{usable.length && usable.every((r) => r.confirmed) ? 'Your weights' : 'Estimate'}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {([['Calories', t.kcal, ''], ['Protein', t.protein, 'g'], ['Carbs', t.carbs, 'g'], ['Fat', t.fat, 'g']] as const).map(([l, v, u]) => (
          <div key={l} className="rounded-2xl bg-raised py-3">
            <p className="num text-[18px] font-extrabold">{fmt(v)}{u}</p>
            <p className="text-xs text-silver">{l}</p>
          </div>
        ))}
      </div>
      {highK - lowK >= 40 && <p className="num mt-2 text-center text-[13px] text-silver">Likely between {fmt(lowK)} and {fmt(highK)} kcal — weigh the food or answer below to narrow it.</p>}
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.index} className="flex items-center justify-between gap-2 text-[14px]">
            <span className="flex min-w-0 flex-1 items-center gap-1.5"><span className="truncate font-medium">{logged.has(r.index) && <Check size={14} strokeWidth={3} className="mr-1 inline text-accent" />}{r.name}</span>{r.food && <AllergyTag food={r.food} />}</span>
            {r.food ? (
              <>
                <label className={cx('flex shrink-0 items-center rounded-xl px-2 py-1', r.confirmed ? 'bg-accent/10 text-accent' : 'border border-dashed border-silver/50 text-silver')} title={r.confirmed ? 'Weight you entered' : 'AI estimate — tap to enter the real weight'}>
                  {!r.confirmed && <span className="mr-0.5">~</span>}
                  <input inputMode="numeric" aria-label={`Grams of ${r.name}`} disabled={logged.has(r.index)} value={r.grams || ''} onChange={(e) => { const g = Number(e.target.value.replace(/\D/g, '').slice(0, 4)); setSet((s) => ({ ...s, [r.index]: g })); setSuggested((x) => { const n = new Set(x); n.delete(r.index); return n; }); }} className="num w-11 bg-transparent text-right font-semibold outline-none" />
                  <span className="ml-0.5">g</span>
                </label>
                <span className="num w-[70px] shrink-0 text-right text-silver">{fmt(((r.food.per100.kcal ?? 0) * r.grams) / 100)} kcal</span>
              </>
            ) : <span className="shrink-0 text-silver">pick a match below</span>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-dim">
        Nutrition comes from the food database. Weights marked ~ are the AI’s guess from the photo — a photo can’t weigh food. Tap a weight to enter the real one.{missing > 0 ? ` ${missing} food${missing > 1 ? 's' : ''} need a match first.` : ''}{usable.some((r) => r.food.per100.kcal == null) ? ' Some matches have no calorie value in their source, so the total may be low.' : ''}
      </p>
      {shownPlan && (
        <PortionCoach
          plan={shownPlan}
          applied={suggested.size > 0}
          onApply={(prs: PortionRow[]) => {
            haptic();
            setFrozen(shownPlan);
            const ch = prs.filter((x) => x.to !== x.from && !logged.has(x.index));
            setSet((s) => ({ ...s, ...Object.fromEntries(ch.map((x) => [x.index, x.to])) }));
            setSuggested(new Set(ch.map((x) => x.index)));
            toast('Suggested portions set — change any weight to what you actually eat');
          }}
        />
      )}
      {hidden.length > 0 && (
        <div className="mt-4 rounded-2xl bg-raised p-3.5">
          <p className="text-[14px] font-semibold">What the photo can’t see</p>
          <p className="text-xs leading-relaxed text-silver">Oil, butter, sugar and sauces change calories a lot but don’t show in photos. Pick the closest — it’s counted in the total above.</p>
          <div className="mt-2.5">
            <Segmented<'home' | 'out'> full value={where} onChange={(v) => { haptic(); setWhere(v); setAmount({}); }} options={[{ value: 'home', label: 'Home-made' }, { value: 'out', label: 'Restaurant / street food' }]} />
          </div>
          <ul className="mt-3 space-y-3">
            {hidden.map((h) => (
              <li key={h.key}>
                <p className="text-[14px] font-medium">{h.extra.name} <span className="text-silver">in {h.dish.toLowerCase()}</span></p>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`How much ${h.extra.name}`}>
                  {(['none', 'little', 'usual', 'lot'] as const).map((a) => (
                    <button key={a} role="radio" aria-checked={amountOf(h.key) === a} onClick={() => { haptic(); setAmount((x) => ({ ...x, [h.key]: a })); }}
                      className={cx('rounded-xl px-1 py-2 text-center text-[12px] font-semibold leading-tight transition', amountOf(h.key) === a ? 'bg-ink text-bg' : 'bg-surface text-ink')}>
                      {AMOUNT_LABEL[a]}<span className="block font-normal opacity-75">{hiddenGrams(h, a)} g</span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hidden.length === 0 && <div className="mt-4 rounded-2xl bg-raised p-3.5">
        <p className="text-[14px] font-semibold">Cooked with oil or butter?</p>
        <p className="text-xs text-silver">Photos can’t see it, and it’s the most common reason scans come out too low.</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {([['1 tsp oil', 'oil olive', 5], ['1 tbsp oil', 'oil olive', 14], ['Butter', 'butter salted', 10]] as const).map(([label, q, g]) => {
            const done = extras.includes(label);
            return (
              <button key={label} disabled={done} onClick={() => { const f = searchFoods(q, { limit: 1 })[0]; if (!f) return; haptic(); onAddExtra(f, g); setExtras((x) => [...x, label]); }} className={cx('chip !h-9 !bg-surface text-[14px]', done && '!text-accent')}>
                {done ? <Check size={14} strokeWidth={3} /> : '+'} {label} · {g} g
              </button>
            );
          })}
        </div>
      </div>}
      {todo.length > 0 && (
        <button onClick={() => {
          haptic([10, 30, 10]);
          onLogAll(todo);
          for (const h of hidden) {
            const g = hiddenGrams(h);
            if (g > 0) addEntry({ date, meal: mealForNow(), food: h.food, grams: g, note: `Hidden extra in ${h.dish} — your answer (${AMOUNT_LABEL[amountOf(h.key)].toLowerCase()})` });
          }
        }} className="btn-primary mt-4 w-full">Log whole plate · {fmt(t.kcal)} kcal</button>
      )}
    </div>
  );
}

/** Portion suggestion for this plate against what's left of the day (null without targets). */
function usePortionPlan(rows: (PlateRow & { name: string })[] | null, date: string) {
  const profile = useStore((s) => s.profile);
  const { totals, goal } = useDay(date);
  const key = rows?.map((r) => `${r.index}:${r.food.id}:${r.grams}`).join('|') ?? '';
  return useMemo(() => {
    if (!rows?.length || !profile) return null;
    const t = dailyTargets(profile, goal);
    if (!t) return null;
    const hour = date === todayKey() ? new Date().getHours() : 13;
    return suggestPortions({
      items: rows.map((r) => ({ index: r.index, name: r.name, grams: r.grams, per100: r.food.per100 })),
      targets: { kcal: t.kcal, protein: t.protein },
      eaten: { kcal: totals.kcal, protein: totals.protein },
      hour, goals: profile.goals ?? (profile.goal ? [profile.goal] : []), pregnant: profile.pregnant,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, profile, goal, date]);
}

/** What the scan is doing right now, so the wait feels short and clear. */
function ScanSteps({ menu }: { menu: boolean }) {
  const steps = menu ? ['Loading menu', 'Reading the dishes', 'Matching nutrition records', 'Almost there'] : ['Loading photo', 'Spotting each food', 'Estimating portions', 'Matching nutrition records'];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 1500); return () => clearInterval(t); }, [steps.length]);
  return (
    <div className="flex items-center gap-2 rounded-full bg-black/65 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md" role="status">
      <Loader2 size={16} className="animate-spin" /> {steps[i]}…
    </div>
  );
}

/**
 * A camera can't weigh food. If you weighed the whole plate (minus the empty plate), enter it
 * and the AI's estimates are scaled to match, keeping its split between the foods.
 */
function PlateWeight({ matches, onApply }: { matches: MatchedItem[]; onApply: (factor: number) => void }) {
  const [open, setOpen] = useState(false);
  const [g, setG] = useState('');
  const est = matches.reduce((a, m) => a + (m.item.estimatedGrams || 0), 0);
  if (!est) return null;
  const n = Number(g);
  return (
    <div className="mt-3 rounded-2xl bg-raised px-4 py-3 text-sm">
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full text-left font-semibold text-accent">Weighed your food? Enter the total for exact portions →</button>
      ) : (
        <>
          <p className="font-semibold">Total weight of the food (without the plate)</p>
          <p className="mt-0.5 text-silver">The AI estimated about {Math.round(est)} g in total. We’ll keep its split between the foods.</p>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1"><input inputMode="numeric" className="field pr-10" value={g} onChange={(e) => setG(e.target.value.replace(/\D/g, '').slice(0, 5))} aria-label="Total food weight in grams" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-silver">g</span></div>
            <button disabled={!(n >= 10 && n <= 5000)} onClick={() => { onApply(n / est); setOpen(false); setG(''); }} className="btn-primary !px-5">Apply</button>
          </div>
        </>
      )}
    </div>
  );
}
