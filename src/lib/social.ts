/**
 * Social features on Supabase (see supabase/social.sql): groups, meal posts, reactions,
 * comments and a small public profile. Row-level security means people only ever see
 * the groups they belong to.
 */
import { supabase } from './account';

export const REACTIONS = ['🔥', '💪', '👏', '😋', '❤️'] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface Group { id: string; name: string; invite_code: string; created_by: string; created_at: string; is_public?: boolean; description?: string | null }
export interface PublicGroup { id: string; name: string; description: string | null; members: number; joined: boolean }
export interface PublicProfile { display_name: string; avatar: string; streak: number; username?: string | null; photoUrl?: string }
export interface Member extends PublicProfile { user_id: string; role: 'owner' | 'member' }
export interface Post {
  id: string; group_id: string; user_id: string; title: string; caption: string | null; meal: string | null;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null;
  photo_path: string | null; created_at: string;
  /** A recipe attached to the post (after supabase/recipes-messages.sql has been run). */
  recipe?: SharedRecipe | null;
  author?: PublicProfile;
  photoUrl?: string;
  reactions: { emoji: Reaction; user_id: string }[];
  commentCount: number;
  /** Up to two latest comments, shown under the post. */
  latestComments?: Comment[];
}
/** A recipe as shared with others: per-100 g values from the sharer's food database. */
export interface SharedRecipe { name: string; servings: number; cookedGrams: number; steps?: string[]; ingredients: { name: string; grams: number; per100: Record<string, number | null> }[]; per100: Record<string, number | null>; by?: string }
export interface Comment { id: string; post_id: string; user_id: string; body: string; created_at: string; author?: PublicProfile }

function db() {
  if (!supabase) throw new Error('Accounts aren’t set up on this server yet.');
  return supabase;
}
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export async function myUserId(): Promise<string | undefined> {
  return (await supabase?.auth.getSession())?.data.session?.user.id;
}

export async function upsertMyProfile(p: Partial<{ display_name: string; avatar: string; streak: number; username: string; photo_path: string | null }>) {
  const uid = await myUserId();
  if (!uid) return;
  const { error } = await db().from('profiles_public').upsert({ user_id: uid, ...p, updated_at: new Date().toISOString() });
  if (error?.message.includes('profiles_username_unique')) throw new Error('That username is taken.');
  if (error?.message.includes('profiles_username_format')) throw new Error('Usernames: 3–20 letters, numbers or _.');
  fail(error);
}

export interface MyProfile { display_name: string; avatar: string; username: string | null; photoUrl?: string; photo_path: string | null }

export async function myProfile(): Promise<MyProfile | null> {
  const uid = await myUserId();
  if (!uid) return null;
  const { data, error } = await db().from('profiles_public').select('display_name, avatar, username, photo_path').eq('user_id', uid).maybeSingle();
  fail(error);
  return data ? { ...data, photoUrl: avatarUrl(data.photo_path) } as MyProfile : null;
}

export async function usernameAvailable(name: string): Promise<boolean> {
  const { data, error } = await db().rpc('username_available', { p_username: name });
  fail(error);
  return data as boolean;
}

export const avatarUrl = (path?: string | null) => (path && supabase ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : undefined);

/** Upload a new profile photo (square-cropped by the caller) and save it on the profile. */
export async function uploadAvatar(photo: Blob): Promise<string> {
  const uid = await myUserId();
  if (!uid) throw new Error('Sign in first.');
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await db().storage.from('avatars').upload(path, photo, { contentType: 'image/jpeg' });
  fail(error);
  await upsertMyProfile({ photo_path: path });
  return path;
}

export async function myGroups(): Promise<Group[]> {
  const { data, error } = await db().from('groups').select('*').order('created_at');
  fail(error);
  return (data ?? []) as Group[];
}

export async function createGroup(name: string, isPublic = false, description = ''): Promise<Group> {
  const { data, error } = await db().rpc('create_group', { p_name: name.trim().slice(0, 40), p_public: isPublic, p_description: description.trim().slice(0, 140) || null });
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
  return (data ?? []).map((m) => ({ user_id: m.user_id, role: m.role, ...(profiles.get(m.user_id) ?? { display_name: 'Member', avatar: '', streak: 0 }) }))
    .sort((a, b) => b.streak - a.streak);
}

async function profilesFor(ids: string[]) {
  const map = new Map<string, PublicProfile>();
  if (!ids.length) return map;
  const { data, error } = await db().from('profiles_public').select('user_id, display_name, avatar, streak, username, photo_path').in('user_id', [...new Set(ids)]);
  fail(error);
  for (const p of data ?? []) map.set(p.user_id, { display_name: p.display_name, avatar: p.avatar, streak: p.streak, username: p.username, photoUrl: avatarUrl(p.photo_path) });
  return map;
}

/** Latest posts in a group (optionally by one person), with authors, photos, reactions and comment counts. */
export async function feed(groupId: string, limit = 30, userId?: string): Promise<Post[]> {
  let q = db().from('posts').select('*').eq('group_id', groupId);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  fail(error);
  const posts = (data ?? []) as Post[];
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const [profiles, reacts, comments, urls] = await Promise.all([
    profilesFor(posts.map((p) => p.user_id)),
    db().from('reactions').select('post_id, emoji, user_id').in('post_id', ids),
    db().from('comments').select('id, post_id, user_id, body, created_at').in('post_id', ids).order('created_at', { ascending: false }),
    signedUrls(posts.map((p) => p.photo_path).filter(Boolean) as string[]),
  ]);
  fail(reacts.error); fail(comments.error);
  const allComments = (comments.data ?? []) as Comment[];
  const commenters = await profilesFor(allComments.map((c) => c.user_id));
  return posts.map((p) => ({
    ...p,
    author: profiles.get(p.user_id) ?? { display_name: 'Member', avatar: '', streak: 0 },
    photoUrl: p.photo_path ? urls.get(p.photo_path) : undefined,
    reactions: (reacts.data ?? []).filter((r) => r.post_id === p.id) as Post['reactions'],
    commentCount: allComments.filter((c) => c.post_id === p.id).length,
    latestComments: allComments.filter((c) => c.post_id === p.id).slice(0, 2).reverse()
      .map((c) => ({ ...c, author: commenters.get(c.user_id) ?? { display_name: 'Member', avatar: '', streak: 0 } })),
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
  kcal?: number; protein?: number; carbs?: number; fat?: number; photo?: Blob; recipe?: SharedRecipe;
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
    ...(p.recipe ? { recipe: p.recipe } : {}),
  });
  if (error && p.recipe && /recipe/.test(error.message)) throw new Error('Recipe sharing needs a quick database update (supabase/recipes-messages.sql).');
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
  return list.map((c) => ({ ...c, author: profiles.get(c.user_id) ?? { display_name: 'Member', avatar: '', streak: 0 } }));
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

// ---------- Group chat ----------
export interface Message { id: string; group_id: string; user_id: string; body: string; created_at: string; author?: PublicProfile }

/** Latest messages in a group (oldest first), with authors. */
export async function messages(groupId: string, limit = 60): Promise<Message[]> {
  const { data, error } = await db().from('messages').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(limit);
  fail(error);
  const list = ((data ?? []) as Message[]).reverse();
  const profiles = await profilesFor(list.map((m) => m.user_id));
  return list.map((m) => ({ ...m, author: profiles.get(m.user_id) ?? { display_name: 'Member', avatar: '', streak: 0 } }));
}

export async function sendMessage(groupId: string, body: string) {
  const uid = await myUserId();
  if (!uid) throw new Error('Sign in first.');
  const { error } = await db().from('messages').insert({ group_id: groupId, user_id: uid, body: body.trim().slice(0, 1000) });
  fail(error);
}

/** Live new messages for a group. Returns an unsubscribe function. */
export function onMessages(groupId: string, cb: () => void): () => void {
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel(`messages:${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, () => cb())
    .subscribe();
  return () => { void supabase?.removeChannel(channel); };
}

// ---------- Discover & invites ----------
export async function publicGroups(): Promise<PublicGroup[]> {
  const { data, error } = await db().rpc('public_groups');
  fail(error);
  return ((data ?? []) as PublicGroup[]).map((g) => ({ ...g, members: Number(g.members), joined: !!g.joined }));
}

export async function joinPublicGroup(id: string): Promise<Group> {
  const { data, error } = await db().rpc('join_public_group', { p_id: id });
  fail(error);
  return data as Group;
}

/** Link that opens Groups and joins with this code (after sign-in if needed). */
export const inviteUrl = (code: string) => `${location.origin}${import.meta.env.BASE_URL}groups?join=${encodeURIComponent(code)}`;

const PENDING = 'provora-pending-join';
export const pendingJoin = {
  get: (): string | null => { try { return localStorage.getItem(PENDING); } catch { return null; } },
  set: (code: string) => { try { localStorage.setItem(PENDING, code.toUpperCase()); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(PENDING); } catch { /* ignore */ } },
};

// ---------- Community feed ----------
export const COMMUNITY_ID = '00000000-0000-0000-0000-00000000c0de';
export async function joinCommunity() {
  const { error } = await db().rpc('join_community');
  fail(error);
}

// ---------- private messages (needs supabase/recipes-messages.sql) ----------

export interface DirectMessage { id: string; sender: string; recipient: string; body: string | null; recipe: SharedRecipe | null; created_at: string; read_at: string | null }
export interface Conversation { with: string; profile: PublicProfile; last: DirectMessage; unread: number }

const setupHint = (e: { message: string } | null) => { if (e && /direct_messages|find_user|blocks|does not exist/.test(e.message)) throw new Error('Messages need a quick database update (run supabase/recipes-messages.sql in Supabase).'); fail(e); };

/** Your chats, newest first, with the other person's profile and unread count. */
export async function conversations(): Promise<Conversation[]> {
  const me = await myUserId();
  if (!me) return [];
  const { data, error } = await db().from('direct_messages').select('*').or(`sender.eq.${me},recipient.eq.${me}`).order('created_at', { ascending: false }).limit(500);
  setupHint(error);
  const byOther = new Map<string, { last: DirectMessage; unread: number }>();
  for (const m of (data ?? []) as DirectMessage[]) {
    const other = m.sender === me ? m.recipient : m.sender;
    const c = byOther.get(other) ?? { last: m, unread: 0 };
    if (m.recipient === me && !m.read_at) c.unread++;
    byOther.set(other, c);
  }
  const profiles = await profilesFor([...byOther.keys()]);
  return [...byOther.entries()].map(([w, c]) => ({ with: w, profile: profiles.get(w) ?? { display_name: 'Member', avatar: '', streak: 0 }, ...c }));
}

export async function thread(other: string): Promise<DirectMessage[]> {
  const me = await myUserId();
  if (!me) return [];
  const { data, error } = await db().from('direct_messages').select('*')
    .or(`and(sender.eq.${me},recipient.eq.${other}),and(sender.eq.${other},recipient.eq.${me})`).order('created_at', { ascending: true }).limit(300);
  setupHint(error);
  const msgs = (data ?? []) as DirectMessage[];
  const unread = msgs.filter((m) => m.recipient === me && !m.read_at).map((m) => m.id);
  if (unread.length) void db().from('direct_messages').update({ read_at: new Date().toISOString() }).in('id', unread).then(() => undefined);
  return msgs;
}

export async function sendDirect(to: string, body: string, recipe?: SharedRecipe) {
  const { error } = await db().from('direct_messages').insert({ recipient: to, body: body.trim().slice(0, 2000) || null, recipe: recipe ?? null });
  setupHint(error);
}

export async function findUser(username: string): Promise<(PublicProfile & { user_id: string }) | null> {
  const { data, error } = await db().rpc('find_user', { p_username: username.replace(/^@/, '') });
  setupHint(error);
  const u = (data as { user_id: string; display_name: string; username: string; avatar: string; photo_path: string | null }[] | null)?.[0];
  return u ? { user_id: u.user_id, display_name: u.display_name, username: u.username, avatar: u.avatar, streak: 0, photoUrl: avatarUrl(u.photo_path) } : null;
}

export async function blockUser(id: string) { const { error } = await db().from('blocks').insert({ blocked: id }); setupHint(error); }
export async function reportMessage(id: string, reason: string) { const { error } = await db().from('message_reports').insert({ message_id: id, reason: reason.slice(0, 300) }); setupHint(error); }
export async function unreadCount(): Promise<number> {
  const me = await myUserId();
  if (!me) return 0;
  const { count, error } = await db().from('direct_messages').select('id', { count: 'exact', head: true }).eq('recipient', me).is('read_at', null);
  return error ? 0 : count ?? 0;
}

/** Who I follow (private — nobody sees follower counts). */
export async function following(): Promise<Set<string>> {
  const { data, error } = await db().from('follows').select('followee');
  if (error) return new Set();
  return new Set((data ?? []).map((r) => String(r.followee)));
}
export async function setFollow(userId: string, on: boolean): Promise<void> {
  const { error } = on ? await db().from('follows').insert({ followee: userId }) : await db().from('follows').delete().eq('followee', userId);
  if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
}
