import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, ImagePlus, Loader2, RotateCcw, Search, Sparkles, X, Zap } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useFoodDb, usePhotoUrl } from '@/lib/hooks';
import { deletePhoto, getPhoto, savePhoto } from '@/lib/photos';
import { matchItems, PremiumRequiredError, recognizePhoto, RecognitionUnavailableError, ScanLimitError, type MatchedItem } from '@/lib/recognize-client';
import { refreshPremium } from '@/lib/premium';
import { SOURCE_SHORT, splitName } from '@/lib/foods';
import { todayKey } from '@/lib/dates';
import type { Food } from '@/lib/types';
import { FoodSheet } from '@/components/FoodSheet';
import { FoodVisual } from '@/components/FoodIcon';
import { StateBadge, cx, fmt } from '@/components/ui';

type Phase = 'camera' | 'analyzing' | 'results' | 'unavailable' | 'premium' | 'limit' | 'error';

export default function Snap() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const date = params.get('date') ?? todayKey();
  const back = () => nav(date === todayKey() ? '/' : `/?date=${date}`);
  const apiKey = useStore((s) => s.settings.aiApiKey);
  const premiumToken = useStore((s) => s.premium?.token);
  const custom = useStore((s) => s.customFoods);
  const entries = useStore((s) => s.entries);
  const { db } = useFoodDb();

  const [phase, setPhase] = useState<Phase>('camera');
  const [photoId, setPhotoId] = useState<string>();
  const [error, setError] = useState('');
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

  async function analyse(file: Blob) {
    const id = await savePhoto(file);
    setPhotoId(id);
    setPhase('analyzing');
    try {
      const small = (await getPhoto(id)) ?? file;
      await refreshPremium();
      const result = await recognizePhoto(small, apiKey, useStore.getState().premium?.token ?? premiumToken);
      await waitForDb();
      if (!result.isFood || !result.items.length) {
        setError(result.note || 'No food found in this photo.');
        setPhase('error');
        return;
      }
      setNote(result.note);
      setMatches(matchItems(result, custom));
      setPhase('results');
    } catch (e) {
      if (e instanceof PremiumRequiredError) setPhase('premium');
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

  const manualUrl = (q = '') => `/add?${new URLSearchParams({ ...(q && { q }), ...(photoId && { photo: photoId }), ...(date !== todayKey() && { date }) })}`;

  if (phase === 'camera') return <Camera onClose={back} onCapture={analyse} />;

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-12">
      <header className="pt-safe flex items-center justify-between pb-4">
        <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Close">
          <X size={20} strokeWidth={2.4} />
        </button>
        <button onClick={retake} className="flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold" style={{ boxShadow: 'var(--shadow)' }}>
          <RotateCcw size={16} /> Retake
        </button>
      </header>

      <div className="relative overflow-hidden rounded-[28px] bg-raised" style={{ aspectRatio: '4 / 3' }}>
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
          <p className="mt-4 px-1 text-[13px] font-medium leading-relaxed text-silver">
            Tap the closest match, then weigh. AI identifies the food — protein always comes from the database record.
            {note && <span className="mt-1 block text-ink/80">{note}</span>}
          </p>
          <div className="mt-4 space-y-3">
            {matches.map((m, i) => (
              <ItemCard
                key={i}
                match={m}
                done={logged.has(i)}
                onPick={(food) => setPick({ food, grams: m.item.estimatedGrams || undefined, label: m.item.name, index: i })}
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
            Your photo is saved. To have foods identified automatically, add an Anthropic API key in Profile → Photo recognition (or deploy with a server key). Meanwhile, pick the food yourself.
          </p>
          <div className="mt-4 grid gap-2">
            <Link to={manualUrl()} className="btn-primary">Pick food manually</Link>
            <Link to="/profile#ai" className="btn-ghost">Set up recognition</Link>
          </div>
        </div>
      )}

      {phase === 'premium' && (
        <div className="card mt-5 p-5">
          <p className="flex items-center gap-2 font-semibold"><Sparkles size={18} className="text-accent" /> Photo recognition is Premium</p>
          <p className="mt-2 text-sm leading-relaxed text-silver">Your photo is saved. Go Premium to have foods identified automatically, or pick the food yourself — that’s always free.</p>
          <div className="mt-4 grid gap-2">
            <Link to="/premium" className="btn-primary"><Sparkles size={17} /> See Premium</Link>
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
        preset={pick ? { photoId, grams: pick.grams, aiLabel: pick.grams ? `AI estimate ~${pick.grams} g — weigh for accuracy` : undefined } : undefined}
        onClose={() => setPick(null)}
        onSaved={() => pick && setLogged((s) => new Set(s).add(pick.index))}
        onSwitchFood={(f) => setPick((p) => (p ? { ...p, food: f } : p))}
      />
    </div>
  );
}

function ItemCard({ match, done, onPick, manualUrl }: { match: MatchedItem; done: boolean; onPick: (f: Food) => void; manualUrl: string }) {
  const { item, candidates } = match;
  const [open, setOpen] = useState(false);
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
          {item.estimatedGrams > 0 && <span className="rounded-full bg-raised px-2.5 py-1 text-[11px] font-semibold text-silver">~{item.estimatedGrams} g</span>}
          {done && <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white"><Check size={15} strokeWidth={3} /></span>}
        </div>
      </div>

      {candidates.length > 0 ? (
        <div className="-mx-2 mt-2">
          {shown.map((f) => {
            const { title, detail } = splitName(f.name);
            return (
              <button key={f.id} onClick={() => onPick(f)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition active:bg-raised/70">
                <FoodVisual name={f.name} category={f.category} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-medium text-silver">
                    <StateBadge state={f.state} />
                    <span>{SOURCE_SHORT[f.source]}</span>
                    {detail && <span className="truncate">· {detail}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-[15px] font-bold leading-none">{fmt(f.per100.protein, 1)}<span className="text-[11px] text-silver">g</span></p>
                  <p className="mt-0.5 text-[10px] text-dim">/100g</p>
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
