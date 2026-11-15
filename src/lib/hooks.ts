import { useEffect, useMemo, useState } from 'react';
import { loadFoodDb, type FoodDb } from './foods';
import { getPhoto } from './photos';
import { useStore, goalOn } from '@/store/useStore';
import type { Food } from './types';
import { sumEntries } from './nutrition';

export function useFoodDb() {
  const [db, setDb] = useState<FoodDb | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadFoodDb().then((d) => live && setDb(d), (e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, []);
  return { db, error };
}

/** Resolve a food id against USDA records and custom records. */
export function useFoodLookup() {
  const { db } = useFoodDb();
  const custom = useStore((s) => s.customFoods);
  const remote = useStore((s) => s.remoteFoods);
  return useMemo(() => {
    const map = new Map<string, Food>(db?.byId);
    for (const f of Object.values(remote)) map.set(f.id, f);
    for (const c of custom) map.set(c.id, c);
    return (id: string) => map.get(id);
  }, [db, custom, remote]);
}

export function usePhotoUrl(id?: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!id) { setUrl(undefined); return; }
    let objectUrl: string | undefined;
    let live = true;
    getPhoto(id).then((b) => {
      if (b && live) setUrl((objectUrl = URL.createObjectURL(b)));
    });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url;
}

export function useDay(date: string) {
  const entries = useStore((s) => s.entries);
  const goalHistory = useStore((s) => s.goalHistory);
  const profile = useStore((s) => s.profile);
  return useMemo(() => {
    const list = entries.filter((e) => e.date === date).sort((a, b) => a.loggedAt - b.loggedAt);
    return { entries: list, totals: sumEntries(list), goal: goalOn(date, goalHistory, profile) };
  }, [entries, goalHistory, profile, date]);
}

/** Apply the theme setting to <html data-theme>. */
export function useThemeSync() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F9F7F2' : '#090D0B');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
