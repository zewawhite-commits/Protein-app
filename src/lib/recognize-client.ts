import { accessToken } from './account';
/**
 * Browser side of photo recognition, plus matching AI suggestions to database records.
 * Nutrient values always come from the matched database record, never from the AI.
 */
import type { RecognitionResult, RecognizedIngredient, RecognizedItem } from './recognition';
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
  const userToken = premiumToken ? undefined : await accessToken();
  let res: Response;
  try {
    res = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(premiumToken && { authorization: `Bearer ${premiumToken}` }), ...(userToken && { 'x-user-token': userToken }) },
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

export interface MatchedIngredient {
  ingredient: RecognizedIngredient;
  candidates: Food[];
}

export interface MatchedItem {
  item: RecognizedItem;
  candidates: Food[];
  ingredients: MatchedIngredient[];
}

function candidatesFor(queries: string[], state: RecognizedItem['state'], custom: CustomFood[], max: number): Food[] {
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const q of queries) {
    const sameState = state !== 'na' ? searchFoods(q, { custom, state, limit: 3 }) : [];
    for (const f of [...sameState, ...searchFoods(q, { custom, limit: 3 })]) {
      if (!seen.has(f.id)) { seen.add(f.id); out.push(f); }
    }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

/** Look each recognised item (and its ingredients) up in the local databases. Prefers records in the same raw/cooked state. */
export function matchItems(result: RecognitionResult, custom: CustomFood[]): MatchedItem[] {
  return result.items.map((item) => ({
    item,
    candidates: candidatesFor([...item.searchQueries, item.localName, item.name].filter(Boolean), item.state, custom, 5),
    ingredients: (item.ingredients ?? []).map((ingredient) => ({
      ingredient,
      candidates: candidatesFor([...ingredient.searchQueries, ingredient.name].filter(Boolean), ingredient.state, custom, 3),
    })),
  }));
}

/** Fire-and-forget: tell the server which record the person chose (anonymous, for review). */
export function sendFeedback(items: { aiName: string; localName?: string; cuisine?: string; chosenFoodId: string; chosenName: string; rank: number; kind: 'item' | 'ingredient' }[]) {
  if (!items.length) return;
  void fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }), keepalive: true }).catch(() => {});
}
