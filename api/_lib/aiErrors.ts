/** Records why an AI request failed (no personal data), so problems can be diagnosed later. */
import { admin } from './accounts.js';

export async function logAiError(feature: string, e: unknown): Promise<void> {
  try {
    const err = e as { status?: number; message?: string; name?: string };
    await admin()?.from('ai_errors').insert({ feature, status: typeof err?.status === 'number' ? err.status : null, message: `${err?.name ?? 'Error'}: ${String(err?.message ?? e).slice(0, 500)}` });
  } catch { /* never let logging break the response */ }
}
