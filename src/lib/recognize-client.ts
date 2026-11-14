/**
 * Browser side of photo recognition, plus matching AI suggestions to database records.
 * Nutrient values always come from the matched database record, never from the AI.
 */
import type { RecognitionResult, RecognizedItem } from './recognition';
import { searchFoods } from './foods';
import type { CustomFood, Food } from './types';

/** Server recognition requires Premium and the user has no personal key. */
export class PremiumRequiredError extends Error {
  constructor(message = 'Photo recognition is a Premium feature.') {
    super(message);
  }
}

/** Monthly photo-scan allowance used up. */
export class ScanLimitError extends Error {}

export class RecognitionUnavailableError extends Error {
  constructor() {
    super('Photo recognition is not set up yet.');
  }
}

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Recognition always goes through the app's server (/api/recognize), which holds the
 * Anthropic key. No AI key ever lives in the browser or on the phone.
 */
export async function recognizePhoto(photo: Blob, premiumToken?: string): Promise<RecognitionResult> {
  const image = await toBase64(photo);
  const mediaType = photo.type || 'image/jpeg';
  let res: Response;
  try {
    res = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(premiumToken && { authorization: `Bearer ${premiumToken}` }) },
      body: JSON.stringify({ image, mediaType }),
    });
  } catch {
    throw new RecognitionUnavailableError();
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!isJson || res.status === 404 || res.status === 501) throw new RecognitionUnavailableError();
  const data = (await res.json()) as RecognitionResult & { error?: string };
  if (res.ok) return data;
  if (res.status === 402) throw new PremiumRequiredError(data.error);
  if (res.status === 429) throw new ScanLimitError(data.error);
  throw new Error(data.error || `Recognition failed (${res.status}).`);
}

export interface MatchedItem {
  item: RecognizedItem;
  candidates: Food[];
}

/** Look each recognised item up in the local databases. Prefers records in the same raw/cooked state. */
export function matchItems(result: RecognitionResult, custom: CustomFood[]): MatchedItem[] {
  return result.items.map((item) => {
    const seen = new Set<string>();
    const candidates: Food[] = [];
    const queries = [...item.searchQueries, item.localName, item.name].filter(Boolean);
    for (const q of queries) {
      const sameState = item.state !== 'na' ? searchFoods(q, { custom, state: item.state, limit: 3 }) : [];
      for (const f of [...sameState, ...searchFoods(q, { custom, limit: 3 })]) {
        if (!seen.has(f.id)) { seen.add(f.id); candidates.push(f); }
      }
      if (candidates.length >= 5) break;
    }
    return { item, candidates: candidates.slice(0, 5) };
  });
}
