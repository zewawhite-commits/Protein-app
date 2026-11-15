import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, ImagePlus, Loader2, Mic, RotateCcw, Search, Sparkles, X, Zap } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb, usePhotoUrl } from '@/lib/hooks';
import { deletePhoto, getPhoto, savePhoto } from '@/lib/photos';
import { matchItems, sendFeedback, PremiumRequiredError, SignInRequiredError, recognizePhoto, recognizeText, RecognitionUnavailableError, ScanLimitError, type MatchedItem } from '@/lib/recognize-client';
import { refreshPremium } from '@/lib/premium';
import { SOURCE_SHORT, searchFoods, splitName } from '@/lib/foods';
import { mealForNow, todayKey } from '@/lib/dates';
import type { Food } from '@/lib/types';
import { FoodSheet } from '@/components/FoodSheet';
import { SignInButtons } from '@/components/SignIn';
import { accountsEnabled, useSession } from '@/lib/account';
import { FoodVisual } from '@/components/FoodIcon';
import { Segmented, StateBadge, cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';

type Phase = 'camera' | 'describe' | 'signin' | 'analyzing' | 'results' | 'unavailable' | 'premium' | 'limit' | 'error';

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
  const [matches, setMatches] = useState<MatchedItem[]>([]);
  const [pick, setPick] = useState<{ food: Food; grams?: number; label: string; index: number } | null>(null);
  const [logged, setLogged] = useState<Set<number>>(new Set());
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

  async function analyse(file: Blob | null, text?: string) {
    let small: Blob | undefined;
    if (file) {
      const id = await savePhoto(file);
      setPhotoId(id);
      small = (await getPhoto(id)) ?? file;
    }
    setPhase('analyzing');
    try {
      await refreshPremium();
      const token = useStore.getState().premium?.token ?? premiumToken;
      const result = small ? await recognizePhoto(small, token) : await recognizeText(text ?? '', token);
      await waitForDb();
      if (!result.isFood || !result.items.length) {
        setError(result.note || (file ? 'No food found in this photo.' : 'No food found in that description.'));
        setPhase('error');
        return;
      }
      setNote(result.note);
      const r = result as typeof result & { scansLeft?: number; scanLimit?: number };
      setLeft(r.scanLimit != null && r.scanLimit < 900 && r.scansLeft != null ? { left: r.scansLeft, limit: r.scanLimit } : null);
      setMatches(matchItems(result, custom));
      setPhase('results');
    } catch (e) {
      if (e instanceof SignInRequiredError) setPhase('signin');
      else if (e instanceof PremiumRequiredError) { setError(e.message); setPhase('premium'); }
      else if (e instanceof ScanLimitError) { setError(e.message || 'Monthly photo scans used up.'); setPhase('limit'); }
      else if (e instanceof RecognitionUnavailableError) setPhase('unavailable');
      else {
        setError((e as Error).message || 'Something went wrong.');
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
        <p className="mt-2 text-[15px] leading-relaxed text-silver">A free account gets 3 AI scans and 5 coach messages a month, and keeps your log safe on any phone.</p>
        <div className="card mt-6 p-5"><SignInButtons /></div>
        <Link to={manualUrl()} className="btn-ghost mt-3 w-full">Search foods instead — always free</Link>
      </div>
    );
  }
  if (phase === 'camera') return <Camera onClose={back} onCapture={(b) => void analyse(b)} />;
  if (phase === 'describe') {
    return (
      <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-12 md:max-w-2xl md:px-8">
        <header className="pt-safe flex items-center pb-4">
          <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
        </header>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Describe your meal</h1>
        <p className="mt-1 text-[15px] text-silver">Type or say what you ate — we’ll find each food. You check and weigh.</p>
        <textarea autoFocus value={described} onChange={(e) => setDescribed(e.target.value)} maxLength={500} rows={4} placeholder="e.g. 2 scrambled eggs, a slice of wholemeal toast and a latte" className="field mt-5 !h-auto resize-none py-4 text-[17px]" />
        <div className="mt-3 flex flex-wrap gap-2">
          {['Chicken Caesar salad', 'Bowl of porridge with banana', 'Cheeseburger and fries', 'Two slices of pepperoni pizza'].map((x) => (
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
          <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md">
              <Loader2 size={16} className="animate-spin" /> Identifying food…
            </div>
          </div>
        )}
        {phase === 'results' && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
            <Sparkles size={13} /> {matches.length} {matches.length === 1 ? 'food' : 'foods'} found
          </span>
        )}
      </div>

      {phase === 'results' && (
        <>
          <p className="mt-4 px-1 text-[14px] font-medium leading-relaxed text-silver">
            Tap the closest match, then weigh. AI identifies the food — calories and nutrients always come from the database record.
            {note && <span className="mt-1 block text-ink/80">{note}</span>}
          </p>
          {left && (
            <Link to="/premium" className="mt-3 flex items-center justify-between rounded-2xl bg-accent/10 px-4 py-3 text-[14px] font-semibold text-accent">
              <span>{left.left} of {left.limit} free AI scans left this month</span>
              <span>Unlimited →</span>
            </Link>
          )}
          <PlateSummary
            matches={matches}
            logged={logged}
            onAddExtra={(food, grams) => { addEntry({ date, meal: mealForNow(), food, grams, note: 'Cooking fat added to a scanned meal' }); toast(`Added ${grams} g ${splitName(food.name).title.toLowerCase()}`); }}
            onLogAll={(rows) => {
              rows.forEach((r, k) => addEntry({ date, meal: mealForNow(), food: r.food, grams: r.grams, photoId: k === 0 ? photoId : undefined, note: 'Portion estimated by AI — edit to your real weight' }));
              setLogged((s) => { const n = new Set(s); rows.forEach((r) => n.add(r.index)); return n; });
              toast(`Logged ${rows.length} food${rows.length > 1 ? 's' : ''} — tap any to set the real weight`);
            }}
          />
          <p className="mt-5 px-1 text-[15px] font-semibold">Check each food</p>
          <div className="mt-2 space-y-3">
            {matches.map((m, i) => (
              <ItemCard
                key={i}
                match={m}
                done={logged.has(i)}
                onPick={(food) => {
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
          <p className="mt-1 text-sm text-silver">Free accounts get 3 AI scans a month. Your photo is saved — or pick the food yourself, always free.</p>
          <div className="mt-4"><SignInButtons /></div>
          <Link to={manualUrl()} className="btn-ghost mt-2 w-full">Pick food manually</Link>
        </div>
      )}

      {phase === 'premium' && (
        <div className="card mt-5 p-5">
          <p className="flex items-center gap-2 text-[17px] font-bold"><Sparkles size={18} className="text-accent" /> You’re out of AI scans</p>
          <p className="mt-2 text-sm leading-relaxed text-silver">{error || 'AI scans come with Plus and Pro.'} Picking the food yourself is always free.</p>
          <div className="mt-4 grid gap-2">
            <Link to="/premium" className="btn-primary"><Sparkles size={17} /> Upgrade — from $2.08/month</Link>
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

      {phase === 'error' && (
        <div className="card mt-5 p-5">
          <p className="font-semibold">Couldn’t identify this one</p>
          <p className="mt-1 text-sm text-silver">{error}</p>
          <div className="mt-4 grid gap-2">
            <Link to={manualUrl()} className="btn-primary">Pick food manually</Link>
            <button onClick={retake} className="btn-ghost">Try another photo</button>
          </div>
        </div>
      )}

      <FoodSheet
        food={pick?.food ?? null}
        date={date}
        preset={pick ? { photoId, aiEstimate: pick.grams } : undefined}
        onClose={() => setPick(null)}
        onSaved={() => pick && setLogged((s) => new Set(s).add(pick.index))}
        onSwitchFood={(f) => setPick((p) => (p ? { ...p, food: f } : p))}
      />
    </div>
  );
}

function ItemCard({ match, done, onPick, manualUrl, onLogIngredients }: { match: MatchedItem; done: boolean; onPick: (f: Food) => void; manualUrl: string; onLogIngredients: (rows: { food: Food; grams: number }[]) => void }) {
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
          {item.estimatedGrams > 0 && <span className="rounded-full border border-dashed border-silver/50 px-2.5 py-1 text-[12px] font-medium text-silver" title="Rough AI estimate from the photo">est. ~{item.estimatedGrams} g</span>}
          {done && <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white"><Check size={15} strokeWidth={3} /></span>}
        </div>
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
function Camera({ onClose, onCapture }: { onClose: () => void; onCapture: (b: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState<'starting' | 'on' | 'off'>('starting');

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) { setLive('off'); return; }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        setLive('on');
      })
      .catch(() => setLive('off'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onCapture(b), 'image/jpeg', 0.9);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <video ref={videoRef} playsInline muted className={cx('absolute inset-0 h-full w-full object-cover transition-opacity', live === 'on' ? 'opacity-100' : 'opacity-0')} />

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
        <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-3.5 py-2 text-xs font-semibold backdrop-blur-md"><Sparkles size={13} /> Snap your food</span>
        <span className="w-11" />
      </div>

      {live === 'off' && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <p className="text-lg font-semibold">Take a photo of your food</p>
            <p className="mt-2 text-sm text-white/70">Use your camera or choose a photo you already have.</p>
            <button onClick={() => captureRef.current?.click()} className="mt-6 h-14 w-full rounded-full bg-white font-semibold text-black">Open camera</button>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}>
        <button onClick={() => fileRef.current?.click()} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur-md" aria-label="Choose from gallery"><ImagePlus size={22} /></button>
        <button
          onClick={() => (live === 'on' ? shoot() : captureRef.current?.click())}
          className="grid h-20 w-20 place-items-center rounded-full border-4 border-white/90 transition active:scale-95"
          aria-label="Take photo"
        >
          <span className="h-[62px] w-[62px] rounded-full bg-white" />
        </button>
        <span className="w-12" />
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
function PlateSummary({ matches, logged, onLogAll, onAddExtra }: { matches: MatchedItem[]; logged: Set<number>; onLogAll: (rows: { food: Food; grams: number; index: number }[]) => void; onAddExtra: (food: Food, grams: number) => void }) {
  const [extras, setExtras] = useState<string[]>([]);
  const rows = matches.map((m, index) => ({ index, name: m.item.name, food: m.candidates[0], grams: m.item.estimatedGrams }));
  const usable = rows.filter((r) => r.food && r.grams > 0) as { index: number; name: string; food: Food; grams: number }[];
  const t = usable.reduce((a, r) => {
    const k = r.grams / 100;
    return { kcal: a.kcal + (r.food.per100.kcal ?? 0) * k, protein: a.protein + r.food.per100.protein * k, carbs: a.carbs + (r.food.per100.carbs ?? 0) * k, fat: a.fat + (r.food.per100.fat ?? 0) * k };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const todo = usable.filter((r) => !logged.has(r.index));
  const missing = rows.length - usable.length;
  if (!usable.length) return null;
  return (
    <div className="card mt-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[17px] font-bold">Whole plate</p>
        <span className="rounded-full border border-dashed border-silver/60 px-2.5 py-1 text-[12px] font-semibold text-silver">Estimate</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {([['Calories', t.kcal, ''], ['Protein', t.protein, 'g'], ['Carbs', t.carbs, 'g'], ['Fat', t.fat, 'g']] as const).map(([l, v, u]) => (
          <div key={l} className="rounded-2xl bg-raised py-3">
            <p className="num text-[18px] font-extrabold">{fmt(v)}{u}</p>
            <p className="text-xs text-silver">{l}</p>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.index} className="flex items-center justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate font-medium">{logged.has(r.index) && <Check size={14} strokeWidth={3} className="mr-1 inline text-accent" />}{r.name}</span>
            <span className="num shrink-0 text-silver">{r.food && r.grams > 0 ? `~${fmt(r.grams)} g · ${fmt(((r.food.per100.kcal ?? 0) * r.grams) / 100)} kcal` : 'pick a match below'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-dim">
        Nutrition comes from the food database. Portion sizes are the AI’s guess from the photo — a photo can’t weigh food, so weigh it for exact numbers.{missing > 0 ? ` ${missing} food${missing > 1 ? 's' : ''} need a match first.` : ''}
      </p>
      <div className="mt-4 rounded-2xl bg-raised p-3.5">
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
      </div>
      {todo.length > 0 && (
        <button onClick={() => { haptic([10, 30, 10]); onLogAll(todo); }} className="btn-primary mt-4 w-full">Log whole plate · {fmt(todo.reduce((a, r) => a + ((r.food.per100.kcal ?? 0) * r.grams) / 100, 0))} kcal</button>
      )}
    </div>
  );
}
