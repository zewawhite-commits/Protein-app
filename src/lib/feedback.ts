/** Messages to the Nutivili AI team: general feedback and requests for missing foods. */
import { aiHeaders } from './premium';

export async function sendMessage(topic: 'feedback' | 'food-request', text: string): Promise<void> {
  const res = await fetch('/api/feedback', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ type: 'message', topic, text: text.slice(0, 1000), path: location.pathname }) });
  if (res.status === 429) throw new Error('Too many messages — try again in a minute.');
  if (!res.ok && res.status !== 401) throw new Error('Couldn’t send right now. Check your connection and try again.');
}
