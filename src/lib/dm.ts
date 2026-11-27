/**
 * Direct messages, privacy and safety: everything here is also enforced by the database
 * (supabase/privacy-messaging.sql), so the app can't be used to get round a block or a setting.
 */
import { supabase } from './account';
import { conversations, myUserId, profilesFor, type Conversation, type DirectMessage, type PublicProfile, type SharedRecipe } from './social';

export interface Attachment { path: string; name: string; type: string; size: number }
export interface DM extends DirectMessage {
  reply_to?: string | null; edited_at?: string | null; delivered_at?: string | null;
  attachment?: Attachment | null; shared_post?: { post_id: string; title: string } | null;
  /** Only on this device, before the server confirms it. */
  pending?: 'sending' | 'failed';
}
export interface ChatSummary extends Conversation { archived: boolean; muted: boolean }
export type DmFrom = 'everyone' | 'following' | 'followers' | 'nobody';
export interface Privacy { dm_from: DmFrom; private_profile: boolean; show_follows: boolean; read_receipts: boolean; show_activity: boolean; notify: Record<string, boolean> }
export const DEFAULT_PRIVACY: Privacy = { dm_from: 'everyone', private_profile: false, show_follows: true, read_receipts: true, show_activity: true, notify: {} };
export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '💪'] as const;
export const REPORT_CATEGORIES = [
  ['harassment', 'Harassment or bullying'], ['spam', 'Spam'], ['inappropriate', 'Inappropriate content'],
  ['fake', 'Fake account or impersonation'], ['unwanted_messages', 'Unwanted messages'], ['other', 'Other'],
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number][0];

/** Files people can send: photos, short videos, PDFs and text, up to 15 MB. */
export const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf', 'text/plain'];
export const MAX_FILE = 15 * 1024 * 1024;
export function checkFile(f: { type: string; size: number }): string | null {
  if (!FILE_TYPES.includes(f.type)) return 'That kind of file can’t be sent. Photos, videos (MP4, MOV, WebM), PDFs and text files work.';
  if (f.size > MAX_FILE) return 'That file is over 15 MB. Try a smaller one.';
  if (f.size === 0) return 'That file is empty.';
  return null;
}

function db() {
  if (!supabase) throw new Error('Accounts aren’t set up on this server yet.');
  return supabase;
}
const hint = (e: { message: string } | null) => {
  if (!e) return;
  if (/dm_cleared|dm_archived|dm_muted|dm_reactions|privacy_settings|restricts|notifications|reports|reply_to|attachment|does not exist|schema cache/.test(e.message)) throw new Error('This needs a quick database update: run supabase/privacy-messaging.sql in Supabase.');
  if (/row-level security/.test(e.message)) throw new Error('You can’t message this person.');
  throw new Error(e.message);
};

export async function chats(): Promise<ChatSummary[]> {
  const [list, arch, mute] = await Promise.all([
    conversations(),
    db().from('dm_archived').select('other').then((r) => new Set((r.data ?? []).map((x) => String(x.other)))),
    db().from('dm_muted').select('other').then((r) => new Set((r.data ?? []).map((x) => String(x.other)))),
  ]);
  return list.map((c) => ({ ...c, archived: arch.has(c.with), muted: mute.has(c.with) }));
}

export async function loadThread(other: string): Promise<{ msgs: DM[]; reactions: Record<string, { user_id: string; emoji: string }[]> }> {
  const me = await myUserId();
  if (!me) return { msgs: [], reactions: {} };
  const { data, error } = await db().from('direct_messages').select('*')
    .or(`and(sender.eq.${me},recipient.eq.${other}),and(sender.eq.${other},recipient.eq.${me})`).order('created_at', { ascending: true }).limit(500);
  hint(error);
  const msgs = (data ?? []) as DM[];
  const now = new Date().toISOString();
  const undelivered = msgs.filter((m) => m.recipient === me && !m.delivered_at).map((m) => m.id);
  const unread = msgs.filter((m) => m.recipient === me && !m.read_at).map((m) => m.id);
  // Delivered as soon as it's on this screen; "read" only counts if the database allows it (not for requests, not with receipts off).
  if (undelivered.length) void db().from('direct_messages').update({ delivered_at: now }).in('id', undelivered).then(() => undefined);
  if (unread.length) void db().from('direct_messages').update({ read_at: now }).in('id', unread).then(() => undefined);
  const reactions: Record<string, { user_id: string; emoji: string }[]> = {};
  if (msgs.length) {
    const r = await db().from('dm_reactions').select('message_id, user_id, emoji').in('message_id', msgs.map((m) => m.id));
    for (const x of (r.data ?? []) as { message_id: string; user_id: string; emoji: string }[]) (reactions[x.message_id] ??= []).push(x);
  }
  return { msgs, reactions };
}

export async function sendDM(to: string, m: { body?: string; reply_to?: string | null; recipe?: SharedRecipe | null; attachment?: Attachment | null; shared_post?: DM['shared_post'] }): Promise<DM> {
  const row = { recipient: to, body: m.body?.trim().slice(0, 2000) || null, reply_to: m.reply_to ?? null, recipe: m.recipe ?? null, attachment: m.attachment ?? null, shared_post: m.shared_post ?? null };
  const { data, error } = await db().from('direct_messages').insert(row).select('*').single();
  hint(error);
  return data as DM;
}
export async function editDM(id: string, body: string) { const { error } = await db().from('direct_messages').update({ body: body.trim().slice(0, 2000) }).eq('id', id); hint(error); }
export async function deleteDM(m: DM) {
  const { error } = await db().from('direct_messages').delete().eq('id', m.id); hint(error);
  if (m.attachment?.path) void db().storage.from('dm-files').remove([m.attachment.path]);
}
export async function reactDM(id: string, emoji: string | null) {
  const me = await myUserId();
  await db().from('dm_reactions').delete().eq('message_id', id).eq('user_id', me ?? '');
  if (emoji) { const { error } = await db().from('dm_reactions').insert({ message_id: id, emoji }); hint(error); }
}
/** Deletes the conversation for you only (the other person keeps their copy). */
export async function clearChat(other: string) { const { error } = await db().from('dm_cleared').upsert({ other, cleared_before: new Date().toISOString() }); hint(error); }
export async function setArchived(other: string, on: boolean) { const { error } = on ? await db().from('dm_archived').upsert({ other }) : await db().from('dm_archived').delete().eq('other', other); hint(error); }
export async function setMuted(other: string, on: boolean) { const { error } = on ? await db().from('dm_muted').upsert({ other }) : await db().from('dm_muted').delete().eq('other', other); hint(error); }
export async function declineRequest(other: string) { await clearChat(other); await setArchived(other, false); }

/** Uploads to the private dm-files bucket as <me>/<them>/<random>-<name>. */
export async function uploadDMFile(to: string, file: File): Promise<Attachment> {
  const bad = checkFile(file);
  if (bad) throw new Error(bad);
  const me = await myUserId();
  if (!me) throw new Error('Sign in first.');
  const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-60) || 'file';
  const path = `${me}/${to}/${crypto.randomUUID()}-${safe}`;
  const { error } = await db().storage.from('dm-files').upload(path, file, { contentType: file.type, upsert: false });
  hint(error);
  return { path, name: file.name.slice(0, 120), type: file.type, size: file.size };
}
const urlCache = new Map<string, { url: string; until: number }>();
/** A short-lived link to open a file, only for the two people in the chat. */
export async function fileUrl(path: string): Promise<string | null> {
  const c = urlCache.get(path);
  if (c && c.until > Date.now()) return c.url;
  const { data } = await db().storage.from('dm-files').createSignedUrl(path, 600);
  if (data?.signedUrl) urlCache.set(path, { url: data.signedUrl, until: Date.now() + 540_000 });
  return data?.signedUrl ?? null;
}

/** Live updates for one chat (and the inbox). Returns an unsubscribe function. */
export function watchMessages(cb: () => void): () => void {
  if (!supabase) return () => undefined;
  const ch = supabase.channel(`dm-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_reactions' }, cb)
    .subscribe();
  return () => { void supabase?.removeChannel(ch); };
}

export async function searchMessages(q: string): Promise<DM[]> {
  const term = q.trim().replace(/[%_,()]/g, ' ').slice(0, 60);
  if (term.length < 2) return [];
  const { data, error } = await db().from('direct_messages').select('*').ilike('body', `%${term}%`).order('created_at', { ascending: false }).limit(50);
  hint(error);
  return (data ?? []) as DM[];
}

export async function report(target: { type: 'user' | 'message' | 'post' | 'comment' | 'image' | 'group_message'; id: string; user?: string | null }, category: ReportCategory, details = '') {
  const { error } = await db().from('reports').insert({ target_type: target.type, target_id: target.id.slice(0, 200), target_user: target.user ?? null, category, details: details.trim().slice(0, 1000) || null });
  hint(error);
}

export async function block(id: string) { const { error } = await db().from('blocks').insert({ blocked: id }); if (error && !/duplicate/i.test(error.message)) hint(error); }
export async function unblock(id: string) { const { error } = await db().from('blocks').delete().eq('blocked', id); hint(error); }
export async function blockedList(): Promise<(PublicProfile & { user_id: string })[]> {
  const { data, error } = await db().from('blocks').select('blocked'); hint(error);
  const ids = (data ?? []).map((r) => String(r.blocked));
  const p = await profilesFor(ids);
  return ids.map((id) => ({ user_id: id, ...(p.get(id) ?? { display_name: 'Member', avatar: '', streak: 0 }) }));
}
export async function restrict(id: string, on: boolean) { const { error } = on ? await db().from('restricts').upsert({ restricted: id }) : await db().from('restricts').delete().eq('restricted', id); hint(error); }
export async function restrictedList(): Promise<(PublicProfile & { user_id: string })[]> {
  const { data, error } = await db().from('restricts').select('restricted'); hint(error);
  const ids = (data ?? []).map((r) => String(r.restricted));
  const p = await profilesFor(ids);
  return ids.map((id) => ({ user_id: id, ...(p.get(id) ?? { display_name: 'Member', avatar: '', streak: 0 }) }));
}

export async function getPrivacy(): Promise<Privacy> {
  const { data, error } = await db().from('privacy_settings').select('*').maybeSingle(); hint(error);
  return { ...DEFAULT_PRIVACY, ...(data ?? {}) } as Privacy;
}
export async function savePrivacy(p: Partial<Privacy>) {
  const me = await myUserId();
  const { error } = await db().from('privacy_settings').upsert({ user_id: me, ...p, updated_at: new Date().toISOString() }); hint(error);
}

export interface Notice { id: number; kind: string; actor: string | null; ref: string | null; body: string | null; created_at: string; read_at: string | null; who?: PublicProfile }
export async function notices(): Promise<Notice[]> {
  const { data, error } = await db().from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
  if (error) return [];
  const list = (data ?? []) as Notice[];
  const p = await profilesFor([...new Set(list.map((n) => n.actor).filter(Boolean) as string[])]);
  return list.map((n) => ({ ...n, who: n.actor ? p.get(n.actor) : undefined }));
}
export async function markNoticesRead() { await db().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null); }
export async function deleteNotice(id: number) { await db().from('notifications').delete().eq('id', id); }
