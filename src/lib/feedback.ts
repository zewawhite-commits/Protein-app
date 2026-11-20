/** Messages to the Nutivili AI team: general feedback and requests for missing foods. */
import { aiHeaders } from './premium';

/** Which onboarding step a signed-in person reached (once per step), so the owner can see where people stop. */
export function trackStep(step: string): void {
  const k = `nutivili-step-${step}`;
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch { /* storage blocked */ }
  void aiHeaders().then((headers) => fetch('/api/feedback', { method: 'POST', headers, body: JSON.stringify({ type: 'event', name: 'onboarding', step }) })).catch(() => undefined);
}

export async function sendMessage(topic: 'feedback' | 'food-request', text: string): Promise<void> {
  const res = await fetch('/api/feedback', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ type: 'message', topic, text: text.slice(0, 1000), path: location.pathname }) });
  if (res.status === 429) throw new Error('Too many messages — try again in a minute.');
  if (!res.ok && res.status !== 401) throw new Error('Couldn’t send right now. Check your connection and try again.');
}
