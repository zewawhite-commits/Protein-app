/** Records why an AI request failed (no personal data), so problems can be diagnosed later. */
import { admin } from './accounts.js';

export async function logAiError(feature: string, e: unknown): Promise<void> {
  try {
    const err = e as { status?: number; message?: string; name?: string };
    await admin()?.from('ai_errors').insert({ feature, status: typeof err?.status === 'number' ? err.status : null, message: `${err?.name ?? 'Error'}: ${String(err?.message ?? e).slice(0, 500)}` });
  } catch { /* never let logging break the response */ }
}

/** What people see when the AI service fails: plain words, and what they can do instead. */
export function busyMessage(e: unknown): string {
  const status = (e as { status?: number })?.status;
  if (status === 429 || status === 529 || (status ?? 0) >= 500 || status == null) return 'Lots of people are using this right now. Try again in a few seconds — you can still search for the food or type it in.';
  return 'That didn’t work this time. Try again, or search for the food instead.';
}
