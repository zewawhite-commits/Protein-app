import { useEffect, useMemo, useState } from 'react';
import { PHOTO_QUERIES } from '@/data/photoQueries';
import { cx } from './ui';
import { toast } from './fx';
import { accessToken } from '@/lib/account';

interface Candidate { id: string; thumb: string; alt: string | null; author: string; photo: unknown }
const nice = (k: string) => k.replace(/^ex_/, '').replace(/_/g, ' ');

/**
 * Owner-only: pick the photo for each food. Nothing shows in the app until you choose one here,
 * so every photo is one a person checked shows exactly that food.
 */
export function PhotoReview() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<'food' | 'exercise'>('food');
  const [show, setShow] = useState<'missing' | 'all'>('missing');
  const [key, setKey] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void fetch('/api/photos?all=1').then((r) => r.json()).then((d: { photos?: Record<string, unknown> }) => setDone(new Set(Object.keys(d.photos ?? {})))).catch(() => undefined); }, []);
  const keys = useMemo(() => Object.keys(PHOTO_QUERIES).filter((k) => (kind === 'exercise') === k.startsWith('ex_')).filter((k) => show === 'all' || !done.has(k)).sort(), [kind, show, done]);
  const call = async (params: Record<string, string>) => fetch(`/api/photos?${new URLSearchParams({ ...params })}`, { headers: { 'x-user-token': (await accessToken()) ?? '' } }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? `error ${r.status}`); return d; });

  async function load(k: string, query = PHOTO_QUERIES[k]) {
    setKey(k); setQ(query); setItems(null); setBusy(true);
    try { setItems((await call({ review: 'candidates', key: k, q: query })).results); } catch (e) { toast(e instanceof Error && e.message === 'forbidden' ? 'Only the owner account can pick photos' : 'Could not load photos'); setItems([]); } finally { setBusy(false); }
  }
  async function pick(c: Candidate) {
    if (!key) return;
    try { await call({ review: 'pick', key, id: c.id, photo: JSON.stringify(c.photo) }); setDone((s) => new Set(s).add(key)); toast(`Saved: ${nice(key)}`); const next = keys[keys.indexOf(key) + 1]; if (next && show === 'missing') void load(next); else setKey(null); } catch { toast('Could not save'); }
  }
  async function clear() {
    if (!key) return;
    try { await call({ review: 'clear', key }); setDone((s) => { const n = new Set(s); n.delete(key); return n; }); toast(`${nice(key)}: no photo`); } catch { toast('Could not clear'); }
  }

  return (
    <section className="card mt-4 p-5">
      <h2 className="text-lg font-bold">Food photos</h2>
      <p className="mt-1 text-sm text-silver">Pick a photo only if it shows exactly that food. Skip it if none fit; the food keeps its plain tile.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['food', 'exercise'] as const).map((k) => <button key={k} onClick={() => { setKind(k); setKey(null); }} className={cx('chip', kind === k && 'chip-on')}>{k === 'food' ? 'Foods' : 'Exercises'}</button>)}
        {(['missing', 'all'] as const).map((k) => <button key={k} onClick={() => setShow(k)} className={cx('chip', show === k && 'chip-on')}>{k === 'missing' ? `Need a photo` : 'All'}</button>)}
      </div>
      <p className="mt-2 text-[13px] text-silver">{keys.length} {show === 'missing' ? 'still need a photo' : 'in total'} · {done.size} approved</p>
      {!key ? (
        <div className="mt-3 flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
          {keys.map((k) => <button key={k} onClick={() => void load(k)} className={cx('chip !h-8 !px-3 text-[13px] capitalize', done.has(k) && '!bg-accent/10 !text-accent')}>{nice(k)}</button>)}
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2"><b className="capitalize">{nice(key)}</b><button onClick={() => setKey(null)} className="text-sm font-semibold text-accent">Back to list</button></div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void load(key, q); }}><input className="field flex-1" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search words" /><button className="btn-primary !px-4">Search</button></form>
          {busy && <p className="mt-3 text-sm text-silver">Loading…</p>}
          {items && !items.length && !busy && <p className="mt-3 text-sm text-silver">No photos found. Try other words.</p>}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {items?.map((c) => (
              <button key={c.id} onClick={() => void pick(c)} className="overflow-hidden rounded-2xl bg-raised text-left" title={c.alt ?? ''}>
                <img src={c.thumb} alt={c.alt ?? ''} loading="lazy" className="aspect-square w-full object-cover" />
                <span className="line-clamp-2 block px-1.5 py-1 text-[11px] text-silver">{c.alt ?? 'No description'}</span>
              </button>
            ))}
          </div>
          <button onClick={() => void clear()} className="mt-3 w-full text-center text-sm font-semibold text-silver">None of these fit: no photo</button>
        </div>
      )}
    </section>
  );
}
