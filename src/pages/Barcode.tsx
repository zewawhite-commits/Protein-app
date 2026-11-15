import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, ScanBarcode } from 'lucide-react';
import { productByBarcode } from '@/lib/openFoodFacts';
import { todayKey } from '@/lib/dates';
import type { Food } from '@/lib/types';
import { FoodSheet } from '@/components/FoodSheet';
import { haptic } from '@/components/fx';

/**
 * Scan a packaged food's barcode with the camera (or type the number). Nutrition comes
 * from the product's label data on Open Food Facts.
 */
export default function Barcode() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const date = params.get('date') ?? todayKey();
  const back = () => nav(date === todayKey() ? '/' : `/?date=${date}`);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting');
  const [code, setCode] = useState('');
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const [food, setFood] = useState<Food | null>(null);
  const busyRef = useRef(false);

  async function lookup(raw: string) {
    const c = raw.replace(/\D/g, '');
    if (c.length < 8 || busyRef.current) return;
    busyRef.current = true;
    setState({ busy: true });
    try {
      const f = await productByBarcode(c);
      if (f) { haptic([10, 30, 10]); setFood(f); setState({ busy: false }); }
      else setState({ busy: false, error: `No product found for ${c}. Try searching by name.` });
    } catch {
      setState({ busy: false, error: 'Couldn’t reach the product database. Check your connection.' });
    } finally {
      busyRef.current = false;
    }
  }

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current!, (result) => {
          if (result && !food) void lookup(result.getText());
        });
        if (cancelled) controls.stop();
        else { stop = () => controls.stop(); setCamera('on'); }
      } catch {
        if (!cancelled) setCamera('off');
      }
    })();
    return () => { cancelled = true; stop?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-12 md:max-w-2xl md:px-8">
      <header className="pt-safe flex items-center pb-4">
        <button onClick={back} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
      </header>
      <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Scan a barcode</h1>
      <p className="mt-1 text-[15px] text-silver">Point your camera at the barcode on the pack.</p>

      <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-[28px] bg-primary">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-2xl border-[3px] border-white/90" />
        {camera !== 'on' && (
          <div className="absolute inset-0 grid place-items-center text-center text-on-primary">
            {camera === 'starting' ? <Loader2 className="animate-spin" /> : <p className="px-6 text-sm"><ScanBarcode className="mx-auto mb-2" />Camera not available — type the number below.</p>}
          </div>
        )}
        {state.busy && <div className="absolute inset-0 grid place-items-center bg-black/40 text-white"><Loader2 className="animate-spin" /></div>}
      </div>

      <label className="label mt-6" htmlFor="bc">Or type the barcode number</label>
      <div className="flex gap-2">
        <input id="bc" inputMode="numeric" className="field flex-1 text-lg font-semibold tracking-wider" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 14))} placeholder="5012345678900" />
        <button onClick={() => void lookup(code)} disabled={code.length < 8 || state.busy} className="btn-primary !px-5">Find</button>
      </div>
      {state.error && (
        <div className="mt-3 rounded-2xl bg-raised p-4">
          <p className="text-sm text-silver">{state.error}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/add" className="btn-primary !h-11 text-sm">Search by name</Link>
            <Link to="/snap?mode=describe" className="btn-ghost !h-11 !bg-surface text-sm">Describe it</Link>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-dim">Product data from Open Food Facts (label values per 100 g).</p>

      <FoodSheet food={food} date={date} onClose={() => setFood(null)} onSaved={back} />
    </div>
  );
}
