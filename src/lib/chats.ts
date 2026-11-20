/**
 * Past coach conversations, kept on this phone. "New chat" files the current one here instead
 * of throwing it away, so people can go back to advice they were given.
 */
export interface PastChat<M = { role: string; content: string; thumb?: string }> { id: string; title: string; at: number; msgs: M[] }

const KEY = 'nutivili-coach-chats';
const MAX = 30;

export function pastChats<M>(): PastChat<M>[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as PastChat<M>[]; } catch { return []; }
}

function write(list: PastChat<unknown>[]) {
  // Photos are the bulky part: if the phone runs out of room, drop the oldest chats first.
  for (let n = Math.min(list.length, MAX); n >= 0; n--) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, n))); return; } catch { /* full: try fewer */ }
  }
}

/** File a conversation (newest first). Re-filing the same one replaces it. */
export function archiveChat<M extends { role: string; content: string }>(msgs: M[], id: string = crypto.randomUUID()): void {
  const real = msgs.filter((m) => m.content && !(m as { error?: boolean }).error);
  if (!real.some((m) => m.role === 'user')) return;
  const first = real.find((m) => m.role === 'user')!.content.replace(/\s+/g, ' ').trim();
  const title = first.length > 60 ? `${first.slice(0, 57)}…` : first;
  write([{ id, title, at: Date.now(), msgs: real }, ...pastChats().filter((c) => c.id !== id)]);
}

export function removeChat(id: string): void { write(pastChats().filter((c) => c.id !== id)); }
