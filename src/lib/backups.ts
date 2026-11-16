/**
 * Automatic backups on this device: once a day the app saves a copy of your data
 * (food log, weights, workouts, recipes, settings) and keeps the last 7. If something goes
 * wrong — a bad sync, an accidental delete — you can restore one from Profile.
 * Photos aren't included (they're kept separately on the device).
 */
import { exportData, useStore } from '@/store/useStore';
import { todayKey } from './dates';

const DB = 'provora-backups';
const STORE = 'snaps';
const KEEP = 7;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

export interface BackupInfo { day: string; entries: number }

export async function listBackups(): Promise<BackupInfo[]> {
  try {
    const days = (await tx('readonly', (s) => s.getAllKeys())) as string[];
    const out: BackupInfo[] = [];
    for (const day of days.sort().reverse()) {
      const snap = (await tx('readonly', (s) => s.get(day))) as ReturnType<typeof exportData> | undefined;
      if (snap) out.push({ day, entries: snap.entries?.length ?? 0 });
    }
    return out;
  } catch {
    return [];
  }
}

/** Save today's copy (once a day) and drop copies older than the last 7. */
export async function backupToday(): Promise<void> {
  try {
    const s = useStore.getState();
    if (!s.profile && !s.entries.length) return; // nothing worth saving yet
    const day = todayKey();
    await tx('readwrite', (st) => st.put(exportData(), day));
    const days = ((await tx('readonly', (st) => st.getAllKeys())) as string[]).sort();
    for (const old of days.slice(0, Math.max(0, days.length - KEEP))) await tx('readwrite', (st) => st.delete(old));
  } catch { /* storage blocked or full: skip quietly */ }
}

export async function restoreBackup(day: string): Promise<void> {
  const snap = await tx('readonly', (s) => s.get(day));
  if (!snap) throw new Error('That backup is no longer on this device.');
  useStore.getState().importData(snap);
  useStore.setState({ lastModified: Date.now() });
}
