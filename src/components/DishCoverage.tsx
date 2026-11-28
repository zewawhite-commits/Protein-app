import { useEffect, useMemo, useState } from 'react';
import { COUNTRY_DISHES } from '@/data/countryDishes';
import { dishPhotoKey } from '@/data/photoQueries';
import { cx } from './ui';

interface Row { country: string; region: string; dishes: number; protein: number; vegetarian: number; vegan: number; meals?: number; plantDishes: number }
interface Coverage { target: number; everyday: number; countries: Row[] }

/**
 * Owner-only completion tracker: how many dishes each country has toward the 1,000 goal.
 * A dish counts only when every ingredient is a measured USDA / FAO record (the data build
 * refuses anything else); versions are the vegan, vegetarian and other-protein forms of those dishes.
 * Photos count only once you've approved one in the photo review below.
 */
export function DishCoverage() {
  const [data, setData] = useState<Coverage | null>(null);
  const [photos, setPhotos] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'least' | 'most' | 'az'>('least');
  const [region, setRegion] = useState('All');

  useEffect(() => {
    void fetch(`${import.meta.env.BASE_URL}data/coverage.json`).then((r) => r.json()).then(setData).catch(() => setData(null));
    void fetch('/api/photos?all=1').then((r) => r.json()).then((d: { photos?: Record<string, unknown> }) => setPhotos(new Set(Object.keys(d.photos ?? {})))).catch(() => undefined);
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const withTotals = data.countries.map((c) => {
      const names = COUNTRY_DISHES[c.country]?.dishes ?? [];
      const withPhoto = names.filter((d) => photos.has(dishPhotoKey(d))).length;
      return { ...c, versions: c.protein + c.vegetarian + c.vegan, meals: c.meals ?? 0, total: c.dishes + c.protein + c.vegetarian + c.vegan + (c.meals ?? 0), withPhoto };
    });
    const term = q.trim().toLowerCase();
    const list = withTotals.filter((c) => (region === 'All' || c.region === region) && (!term || c.country.toLowerCase().includes(term)));
    return list.sort((a, b) => (sort === 'az' ? a.country.localeCompare(b.country) : sort === 'least' ? a.total - b.total : b.total - a.total));
  }, [data, photos, q, sort, region]);

  if (!data) return null;
  const all = data.countries;
  const sum = (f: (r: Row) => number) => all.reduce((s, r) => s + f(r), 0);
  const dishes = sum((r) => r.dishes); const versions = sum((r) => r.protein + r.vegetarian + r.vegan + (r.meals ?? 0));
  const reached = all.filter((r) => r.dishes + r.protein + r.vegetarian + r.vegan + (r.meals ?? 0) >= data.target).length;
  const regions = ['All', ...new Set(all.map((r) => r.region))];

  return (
    <section className="card mb-5 p-5">
      <h2 className="text-lg font-bold">Dish completion tracker</h2>
      <p className="mt-1 text-sm leading-relaxed text-silver">Goal: {data.target.toLocaleString()} real dishes per country. Only dishes built from measured ingredient records count — no padding, no invented foods.</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-raised p-3"><p className="text-xl font-extrabold">{dishes.toLocaleString()}</p><p className="text-xs text-silver">country dishes</p></div>
        <div className="rounded-2xl bg-raised p-3"><p className="text-xl font-extrabold">{versions.toLocaleString()}</p><p className="text-xs text-silver">versions &amp; meals</p></div>
        <div className="rounded-2xl bg-raised p-3"><p className="text-xl font-extrabold">{reached}/{all.length}</p><p className="text-xs text-silver">at goal</p></div>
      </div>
      <p className="mt-2 text-xs text-silver">Plus {data.everyday.toLocaleString()} everyday dishes that belong to no country (salads, oats, desserts…).</p>
      <div className="mt-4 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a country" className="min-w-0 flex-1 rounded-xl bg-raised px-3 py-2 text-sm" />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-xl bg-raised px-2 text-sm" aria-label="Sort">
          <option value="least">Fewest first</option><option value="most">Most first</option><option value="az">A–Z</option>
        </select>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {regions.map((r) => <button key={r} onClick={() => setRegion(r)} className={cx('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold', region === r ? 'bg-accent text-white' : 'bg-raised')}>{r}</button>)}
      </div>
      <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
        {rows.map((c) => (
          <li key={c.country} className="rounded-xl bg-raised px-3 py-2.5" data-country={c.country}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold">{c.country}</p>
              <p className="shrink-0 text-sm font-bold tabular-nums">{c.total.toLocaleString()}<span className="font-normal text-silver"> / {data.target.toLocaleString()}</span></p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (c.total / data.target) * 100)}%` }} /></div>
            <p className="mt-1.5 text-xs text-silver">{c.dishes} dishes · {c.versions} versions ({c.vegan} vegan, {c.vegetarian} vegetarian, {c.protein} other protein) · {c.meals} complete meals with a staple · {c.withPhoto} with an approved photo</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
