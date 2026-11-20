/**
 * Past coach conversations. They're part of the person's saved data (synced to their account on
 * every plan), so "New chat" files the current one instead of throwing it away.
 */
import { useStore } from '@/store/useStore';

export interface PastChat<M = { role: string; content: string; thumb?: string }> { id: string; title: string; at: number; updatedAt: number; msgs: M[] }

const OLD_KEY = 'nutivili-coach-chats';
const MAX = 300;

// Chats saved on this phone before they were synced: move them in once.
try {
  const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? 'null') as PastChat[] | null;
  if (old?.length) {
    const have = new Set(useStore.getState().coachChats.map((c) => c.id));
    useStore.setState((s) => ({ coachChats: [...s.coachChats, ...old.filter((c) => !have.has(c.id)).map((c) => ({ ...c, updatedAt: c.updatedAt ?? c.at }))] }));
    localStorage.removeItem(OLD_KEY);
  }
} catch { /* storage blocked */ }

export function pastChats<M>(): PastChat<M>[] {
  return [...useStore.getState().coachChats].sort((a, b) => b.at - a.at) as unknown as PastChat<M>[];
}

/** File a conversation (newest first). Re-filing the same one replaces it. */
export function archiveChat<M extends { role: string; content: string }>(msgs: M[], id: string = crypto.randomUUID()): void {
  const real = msgs.filter((m) => m.content && !(m as { error?: boolean; streaming?: boolean }).error && !(m as { streaming?: boolean }).streaming);
  if (!real.some((m) => m.role === 'user')) return;
  const cur = useStore.getState().coachChats.find((c) => c.id === id);
  if (cur && cur.msgs.length === real.length && cur.msgs[cur.msgs.length - 1]?.content === real[real.length - 1].content) return;
  const first = real.find((m) => m.role === 'user')!.content.replace(/\s+/g, ' ').trim();
  const title = first.length > 60 ? `${first.slice(0, 57)}…` : first;
  const now = Date.now();
  const chat = { id, title, at: cur?.at ?? now, updatedAt: now, msgs: real as unknown as PastChat['msgs'] };
  useStore.setState((s) => ({ coachChats: [chat, ...s.coachChats.filter((c) => c.id !== id)].slice(0, MAX) }));
}

export function removeChat(id: string): void {
  useStore.setState((s) => ({ coachChats: s.coachChats.filter((c) => c.id !== id), deleted: { ...s.deleted, [id]: Date.now() } }));
}
