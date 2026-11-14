import { useRef, useState } from 'react';
import { Camera, Plus, Share2, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { usePhotoUrl } from '@/lib/hooks';
import { getPhoto, savePhoto } from '@/lib/photos';
import { formatDay, todayKey } from '@/lib/dates';
import { fromKg } from '@/lib/nutrition';
import type { ProgressPhoto } from '@/lib/types';
import { Sheet, cx, fmt } from './ui';
import { APP_NAME, haptic, toast } from './fx';

/** "Watch the change": progress photos kept on this phone, with a before/after compare. */
export function ProgressPhotos() {
  const photos = useStore((s) => s.progressPhotos);
  const weights = useStore((s) => s.weights);
  const profileKg = useStore((s) => s.profile?.bodyWeightKg);
  const add = useStore((s) => s.addProgressPhoto);
  const fileRef = useRef<HTMLInputElement>(null);
  const [compare, setCompare] = useState(false);

  async function onFile(f?: File) {
    if (!f) return;
    const photoId = await savePhoto(f);
    const today = todayKey();
    const kg = weights.find((w) => w.date === today)?.kg ?? weights[weights.length - 1]?.kg ?? profileKg ?? undefined;
    add({ photoId, date: today, kg });
    haptic([10, 30, 10]);
    toast('Progress photo saved');
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Progress photos</h2>
        {photos.length >= 2 && <button onClick={() => setCompare(true)} className="chip !h-9 !bg-primary !text-on-primary">Compare</button>}
      </div>
      <p className="mt-0.5 text-sm text-silver">Private to this phone. Add one every week or two.</p>
      <div className="-mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar">
        <button onClick={() => fileRef.current?.click()} className="grid h-28 w-20 shrink-0 place-items-center rounded-[18px] border-2 border-dashed border-line text-silver" aria-label="Add progress photo">
          <span className="flex flex-col items-center gap-1 text-xs font-bold"><Camera size={20} /> Add</span>
        </button>
        {[...photos].reverse().map((p) => <Thumb key={p.id} p={p} onClick={() => setCompare(true)} />)}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <CompareSheet open={compare} onClose={() => setCompare(false)} />
    </section>
  );
}

function Thumb({ p, onClick, selected }: { p: ProgressPhoto; onClick: () => void; selected?: boolean }) {
  const url = usePhotoUrl(p.photoId);
  return (
    <button onClick={onClick} className={cx('relative h-28 w-20 shrink-0 overflow-hidden rounded-[18px] bg-raised', selected && 'ring-[3px] ring-accent')}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-bold text-white">{formatDay(p.date, { day: 'numeric', month: 'short' })}</span>
    </button>
  );
}

function CompareSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const photos = useStore((s) => s.progressPhotos);
  const unit = useStore((s) => s.settings.bodyUnit);
  const remove = useStore((s) => s.removeProgressPhoto);
  const [left, setLeft] = useState<string>();
  const [right, setRight] = useState<string>();
  const [hide, setHide] = useState(false);
  const [picking, setPicking] = useState<'left' | 'right'>('right');
  const a = photos.find((p) => p.id === left) ?? photos[0];
  const b = photos.find((p) => p.id === right) ?? photos[photos.length - 1];
  const label = (p?: ProgressPhoto) => (p ? `${!hide && p.kg ? `${fmt(fromKg(p.kg, unit), 1)} ${unit} · ` : ''}${formatDay(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}` : '');

  async function share() {
    if (!a || !b) return;
    try {
      const blob = await composeCompare(a, b, label(a), label(b));
      const file = new File([blob], 'progress.jpg', { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'My progress' });
      else {
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: 'progress.jpg' }).click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch { /* cancelled */ }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Compare">
      {a && b && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[a, b].map((p, i) => <Big key={p.id + i} p={p} label={label(p)} active={(i === 0 ? 'left' : 'right') === picking} onClick={() => setPicking(i === 0 ? 'left' : 'right')} />)}
          </div>
          <p className="mt-2 text-center text-xs text-silver">Tap a side, then pick a photo below.</p>
          <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
            {photos.map((p) => <Thumb key={p.id} p={p} selected={p.id === (picking === 'left' ? a.id : b.id)} onClick={() => (picking === 'left' ? setLeft(p.id) : setRight(p.id))} />)}
          </div>
          <label className="mt-4 flex items-center justify-between rounded-2xl bg-raised px-4 py-3 font-semibold">
            Hide weight
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent))]" />
          </label>
          <button onClick={share} className="btn-primary mt-3 w-full"><Share2 size={18} /> Share</button>
          <button onClick={() => { const p = picking === 'left' ? a : b; remove(p.id); toast('Photo deleted'); }} className="btn-ghost mt-2 w-full text-danger"><Trash2 size={17} /> Delete selected photo</button>
        </>
      )}
      {photos.length < 2 && <p className="flex items-center gap-2 text-sm text-silver"><Plus size={16} /> Add at least two photos to compare.</p>}
    </Sheet>
  );
}

function Big({ p, label, active, onClick }: { p: ProgressPhoto; label: string; active: boolean; onClick: () => void }) {
  const url = usePhotoUrl(p.photoId);
  return (
    <button onClick={onClick} className={cx('relative aspect-[3/4] overflow-hidden rounded-[20px] bg-raised', active && 'ring-[3px] ring-accent')}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <span className="num absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 pt-8 text-center text-sm font-bold text-white">{label}</span>
    </button>
  );
}

/** Side-by-side image for sharing (stays on the phone until the user shares it). */
async function composeCompare(a: ProgressPhoto, b: ProgressPhoto, la: string, lb: string): Promise<Blob> {
  const [ia, ib] = await Promise.all([a, b].map(async (p) => createImageBitmap((await getPhoto(p.photoId))!)));
  const W = 1080, H = 1440, half = W / 2;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H + 120 });
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H + 120);
  [ia, ib].forEach((im, i) => {
    const s = Math.max(half / im.width, H / im.height);
    const w = im.width * s, h = im.height * s;
    g.save(); g.beginPath(); g.rect(i * half + (i ? 4 : 0), 0, half - 4, H); g.clip();
    g.drawImage(im, i * half + (half - w) / 2, (H - h) / 2, w, h); g.restore();
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(i * half + (i ? 4 : 0), H - 90, half - 4, 90);
    g.fillStyle = '#fff'; g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(i ? lb : la, i * half + half / 2, H - 35);
  });
  g.fillStyle = '#0e0e10'; g.font = '800 44px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(`${APP_NAME} · my progress`, W / 2, H + 78);
  return new Promise((r) => c.toBlob((x) => r(x!), 'image/jpeg', 0.9));
}
