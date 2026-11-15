/**
 * DELETE /api/account (x-user-token: Supabase access token)
 * Permanently deletes the signed-in account: the sign-in itself and everything linked
 * to it (log, posts, comments, groups they own, profile, usage counts).
 */
import { json } from './_lib/premium';
import { admin, userFromToken } from './_lib/accounts';

export async function DELETE(request: Request): Promise<Response> {
  const db = admin();
  if (!db) return json({ error: 'Accounts aren’t set up on the server yet.' }, 503);
  const user = await userFromToken(request.headers.get('x-user-token'));
  if (!user) return json({ error: 'Sign in again to delete your account.' }, 401);
  try {
    // Usage counters are keyed by text, not a foreign key, so remove them by hand.
    await db.from('scan_usage').delete().like('subscriber', `%:${user.id}`);
    // Stored photos: avatars sit in a folder named after the user; post photos are listed on their posts.
    const { data: avatars } = await db.storage.from('avatars').list(user.id, { limit: 1000 });
    if (avatars?.length) await db.storage.from('avatars').remove(avatars.map((f) => `${user.id}/${f.name}`));
    const { data: posts } = await db.from('posts').select('photo_path').eq('user_id', user.id).not('photo_path', 'is', null);
    const paths = (posts ?? []).map((r) => r.photo_path as string).filter(Boolean);
    if (paths.length) await db.storage.from('post-photos').remove(paths);
    // Everything else references auth.users with ON DELETE CASCADE.
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message || 'Could not delete the account.' }, 500);
  }
}
