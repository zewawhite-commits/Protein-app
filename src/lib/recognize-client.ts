/**
 * Browser side of photo recognition, plus matching AI suggestions to database records.
 * Order: the app's own /api/recognize endpoint (server-held key) → the user's own
 * Anthropic API key, if they saved one in Profile. Nutrient values always come from
 * the matched database record, never from the AI.
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

export async function recognizePhoto(photo: Blob, userApiKey?: string, premiumToken?: string): Promise<RecognitionResult> {
  const image = await toBase64(photo);
  const mediaType = photo.type || 'image/jpeg';

  // 1. Hosted endpoint (works when deployed with ANTHROPIC_API_KEY on the server).
  try {
    const res = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(premiumToken && { authorization: `Bearer ${premiumToken}` }) },
      body: JSON.stringify({ image, mediaType }),
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    if (res.ok && isJson) return (await res.json()) as RecognitionResult;
    if (isJson && res.status === 402) {
      const { error } = (await res.json()) as { error?: string };
      if (!userApiKey) throw new PremiumRequiredError(error);
      // Not Premium, but the user has their own key: fall through to it.
    } else if (isJson && res.status === 429) {
      const { error } = (await res.json()) as { error?: string };
      throw new ScanLimitError(error);
    } else if (isJson && res.status !== 501) {
      const { error } = (await res.json()) as { error?: string };
      throw new Error(error || `Recognition failed (${res.status}).`);
    }
  } catch (e) {
    if (e instanceof PremiumRequiredError || e instanceof ScanLimitError) throw e;
    if (!(e instanceof TypeError) && !userApiKey) throw e; // TypeError = network/no endpoint
  }

  // 2. The user's own key, called directly from this device.
  if (!userApiKey) throw new RecognitionUnavailableError();
  const [{ default: Anthropic }, { recognizeWithClient }] = await Promise.all([import('@anthropic-ai/sdk'), import('./recognition')]);
  const client = new Anthropic({ apiKey: userApiKey, dangerouslyAllowBrowser: true });
  try {
    return await recognizeWithClient(client, image, mediaType);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Your Anthropic API key was rejected. Check it in Profile.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Rate limited — try again in a moment.');
    if (e instanceof Anthropic.APIError) throw new Error(`Recognition service error (${e.status ?? 'network'}).`);
    throw e;
  }
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
