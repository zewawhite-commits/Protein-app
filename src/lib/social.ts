/**
 * Social features on Supabase (see supabase/social.sql): groups, meal posts, reactions,
 * comments and a small public profile. Row-level security means people only ever see
 * the groups they belong to.
 */
import { supabase } from './account';

export const REACTIONS = ['🔥', '💪', '👏', '😋', '❤️'] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface Group { id: string; name: string; invite_code: string; created_by: string; created_at: string }
export interface Member { user_id: string; role: 'owner' | 'member'; display_name: string; avatar: string; streak: number }
export interface Post {
  id: string; group_id: string; user_id: string; title: string; caption: string | null; meal: string | null;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null;
  photo_path: string | null; created_at: string;
  author?: { display_name: string; avatar: string };
  photoUrl?: string;
  reactions: { emoji: Reaction; user_id: string }[];
  commentCount: number;
}
export interface Comment { id: string; post_id: string; user_id: string; body: string; created_at: string; author?: { display_name: string; avatar: string } }

function db() {
  if (!supabase) throw new Error('Accounts aren’t set up on this server yet.');
  return supabase;
}
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export async function myUserId(): Promise<string | undefined> {
  return (await supabase?.auth.getSession())?.data.session?.user.id;
}

export async function upsertMyProfile(p: { display_name: string; avatar: string; streak: number }) {
  const uid = await myUserId();
  if (!uid) return;
  const { error } = await db().from('profiles_public').upsert({ user_id: uid, ...p, updated_at: new Date().toISOString() });
  fail(error);
}

export async function myGroups(): Promise<Group[]> {
  const { data, error } = await db().from('groups').select('*').order('created_at');
  fail(error);
  return (data ?? []) as Group[];
}

export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await db().rpc('create_group', { p_name: name.trim().slice(0, 40) });
  fail(error);
  return data as Group;
}

export async function joinGroup(code: string): Promise<Group> {
  const { data, error } = await db().rpc('join_group', { p_code: code.trim().toUpperCase() });
  fail(error);
  return data as Group;
}

export async function leaveGroup(groupId: string) {
  const uid = await myUserId();
  const { error } = await db().from('group_members').delete().eq('group_id', groupId).eq('user_id', uid!);
  fail(error);
}

export async function members(groupId: string): Promise<Member[]> {
  const { data, error } = await db().from('group_members').select('user_id, role').eq('group_id', groupId);
  fail(error);
  const ids = (data ?? []).map((m) => m.user_id as string);
  const profiles = await profilesFor(ids);
  return (data ?? []).map((m) => ({ user_id: m.user_id, role: m.role, ...(profiles.get(m.user_id) ?? { display_name: 'Member', avatar: '🙂', streak: 0 }) }))
    .sort((a, b) => b.streak - a.streak);
}

async function profilesFor(ids: string[]) {
  const map = new Map<string, { display_name: string; avatar: string; streak: number }>();
  if (!ids.length) return map;
  const { data, error } = await db().from('profiles_public').select('user_id, display_name, avatar, streak').in('user_id', [...new Set(ids)]);
  fail(error);
  for (const p of data ?? []) map.set(p.user_id, { display_name: p.display_name, avatar: p.avatar, streak: p.streak });
  return map;
}

/** Latest posts in a group, with authors, photo links, reactions and comment counts. */
export async function feed(groupId: string, limit = 30): Promise<Post[]> {
  const { data, error } = await db().from('posts').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(limit);
  fail(error);
  const posts = (data ?? []) as Post[];
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const [profiles, reacts, comments, urls] = await Promise.all([
    profilesFor(posts.map((p) => p.user_id)),
    db().from('reactions').select('post_id, emoji, user_id').in('post_id', ids),
    db().from('comments').select('post_id').in('post_id', ids),
    signedUrls(posts.map((p) => p.photo_path).filter(Boolean) as string[]),
  ]);
  fail(reacts.error); fail(comments.error);
  return posts.map((p) => ({
    ...p,
    author: profiles.get(p.user_id) ?? { display_name: 'Member', avatar: '🙂' },
    photoUrl: p.photo_path ? urls.get(p.photo_path) : undefined,
    reactions: (reacts.data ?? []).filter((r) => r.post_id === p.id) as Post['reactions'],
    commentCount: (comments.data ?? []).filter((c) => c.post_id === p.id).length,
  }));
}

async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data } = await db().storage.from('post-photos').createSignedUrls(paths, 60 * 60);
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}

export async function sharePost(p: {
  groupId: string; title: string; caption?: string; meal?: string;
  kcal?: number; protein?: number; carbs?: number; fat?: number; photo?: Blob;
}) {
  const uid = await myUserId();
  if (!uid) throw new Error('Sign in first.');
  let photo_path: string | null = null;
  if (p.photo) {
    photo_path = `${p.groupId}/${uid}/${crypto.randomUUID()}.jpg`;
    const { error } = await db().storage.from('post-photos').upload(photo_path, p.photo, { contentType: 'image/jpeg', upsert: false });
    fail(error);
  }
  const round = (v?: number) => (v == null ? null : Math.round(v * 10) / 10);
  const { error } = await db().from('posts').insert({
    group_id: p.groupId, user_id: uid, title: p.title.slice(0, 120), caption: p.caption?.slice(0, 500) || null, meal: p.meal ?? null,
    kcal: round(p.kcal), protein: round(p.protein), carbs: round(p.carbs), fat: round(p.fat), photo_path,
  });
  fail(error);
}

export async function deletePost(post: Post) {
  if (post.photo_path) await db().storage.from('post-photos').remove([post.photo_path]);
  const { error } = await db().from('posts').delete().eq('id', post.id);
  fail(error);
}

export async function toggleReaction(postId: string, emoji: Reaction, on: boolean) {
  const uid = await myUserId();
  if (!uid) throw new Error('Sign in first.');
  const q = on
    ? db().from('reactions').insert({ post_id: postId, user_id: uid, emoji })
    : db().from('reactions').delete().eq('post_id', postId).eq('user_id', uid).eq('emoji', emoji);
  const { error } = await q;
  fail(error);
}

export async function comments(postId: string): Promise<Comment[]> {
  const { data, error } = await db().from('comments').select('*').eq('post_id', postId).order('created_at');
  fail(error);
  const list = (data ?? []) as Comment[];
  const profiles = await profilesFor(list.map((c) => c.user_id));
  return list.map((c) => ({ ...c, author: profiles.get(c.user_id) ?? { display_name: 'Member', avatar: '🙂' } }));
}

export async function addComment(postId: string, body: string) {
  const uid = await myUserId();
  if (!uid) throw new Error('Sign in first.');
  const { error } = await db().from('comments').insert({ post_id: postId, user_id: uid, body: body.trim().slice(0, 500) });
  fail(error);
}

/** Friendly relative time ("5m", "3h", "2d"). */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
