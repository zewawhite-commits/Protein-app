/**
 * Same photo, same answer: the result of each scan is remembered on this device for
 * 30 days, keyed by a fingerprint (SHA-256) of the photo. Scanning the identical photo
 * again shows the same foods and weights, and doesn't use another AI scan.
 */
import type { RecognitionResult } from './recognition';

const KEY = 'provora-scan-memory';
const DAYS = 30 * 864e5;
const MAX = 40;

type Memory = Record<string, { at: number; mode: string; result: RecognitionResult }>;

const load = (): Memory => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Memory; } catch { return {}; } };
const save = (m: Memory) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage full: skip */ } };

export async function photoFingerprint(photo: Blob): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', await photo.arrayBuffer());
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export function recall(hash: string | null, mode: string): RecognitionResult | null {
  if (!hash) return null;
  const hit = load()[hash];
  return hit && hit.mode === mode && Date.now() - hit.at < DAYS ? hit.result : null;
}

export function remember(hash: string | null, mode: string, result: RecognitionResult) {
  if (!hash || !result.isFood) return;
  const m = load();
  m[hash] = { at: Date.now(), mode, result };
  const keys = Object.keys(m).sort((a, b) => m[a].at - m[b].at);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX))) delete m[k];
  save(m);
}
