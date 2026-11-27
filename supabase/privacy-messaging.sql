-- Nutivili: privacy, safety and full direct messaging.
-- Run AFTER schema.sql, social.sql, recipes-messages.sql and follows.sql. Safe to run again.
--
-- Everything here is enforced by the database itself (row-level security and triggers), so a
-- blocked person can't get round it from another screen or by calling the API directly.

-- ───────────────────────── Privacy settings ─────────────────────────
create table if not exists public.privacy_settings (
  user_id         uuid primary key default auth.uid() references auth.users on delete cascade,
  -- Who can start a conversation with me.
  dm_from         text not null default 'everyone' check (dm_from in ('everyone', 'following', 'followers', 'nobody')),
  private_profile boolean not null default false,
  show_follows    boolean not null default true,
  read_receipts   boolean not null default true,
  show_activity   boolean not null default true,
  -- Notification switches, e.g. {"message": true, "follow": false}. Missing = on.
  notify          jsonb not null default '{}'::jsonb check (jsonb_typeof(notify) = 'object' and pg_column_size(notify) < 4000),
  updated_at      timestamptz not null default now()
);
alter table public.privacy_settings enable row level security;
drop policy if exists "privacy: own" on public.privacy_settings;
create policy "privacy: own" on public.privacy_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- People I've restricted: their messages always wait in Requests and they never see my read receipts.
create table if not exists public.restricts (
  owner      uuid not null default auth.uid() references auth.users on delete cascade,
  restricted uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, restricted),
  check (owner <> restricted)
);
alter table public.restricts enable row level security;
drop policy if exists "restricts: own" on public.restricts;
create policy "restricts: own" on public.restricts for all using (owner = auth.uid()) with check (owner = auth.uid());

create or replace function public.setting_of(u uuid) returns public.privacy_settings
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p from privacy_settings p where p.user_id = u),
    row(u, 'everyone', false, true, true, true, '{}'::jsonb, now())::privacy_settings
  );
$$;

create or replace function public.follows_user(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from follows where follower = a and followee = b);
$$;

-- Has `owner` let `other` into their main inbox (follows them, or accepted their request)?
create or replace function public.dm_trusted(owner uuid, other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from restricts where restricts.owner = dm_trusted.owner and restricted = other)
     and (exists (select 1 from follows where follower = owner and followee = other)
       or exists (select 1 from dm_accepts a where a.owner = dm_trusted.owner and a.other = dm_trusted.other));
$$;

-- May `sender` message `recipient` at all? Blocks always win; then the recipient's setting.
-- Someone already trusted (followed or accepted) can always reply.
create or replace function public.can_message(sender uuid, recipient uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s privacy_settings;
begin
  if sender is null or recipient is null or sender = recipient then return false; end if;
  if public.is_blocked(sender, recipient) then return false; end if;
  if public.dm_trusted(recipient, sender) then return true; end if;
  s := public.setting_of(recipient);
  return case s.dm_from
    when 'everyone' then true
    when 'following' then public.follows_user(recipient, sender)
    when 'followers' then public.follows_user(sender, recipient)
    else false end;
end $$;
revoke all on function public.setting_of(uuid), public.follows_user(uuid, uuid), public.dm_trusted(uuid, uuid), public.can_message(uuid, uuid) from public, anon;
grant execute on function public.can_message(uuid, uuid), public.dm_trusted(uuid, uuid) to authenticated;

-- ───────────────────────── Direct messages: replies, edits, files, delivery ─────────────────────────
alter table public.direct_messages add column if not exists reply_to uuid references public.direct_messages (id) on delete set null;
alter table public.direct_messages add column if not exists edited_at timestamptz;
alter table public.direct_messages add column if not exists delivered_at timestamptz;
-- A shared photo, video or document: { path, name, type, size }. The file itself lives in the private dm-files bucket.
alter table public.direct_messages add column if not exists attachment jsonb
  check (attachment is null or (jsonb_typeof(attachment) = 'object' and pg_column_size(attachment) < 2000));
-- A shared post: { post_id, title }.
alter table public.direct_messages add column if not exists shared_post jsonb
  check (shared_post is null or (jsonb_typeof(shared_post) = 'object' and pg_column_size(shared_post) < 2000));

-- The old "needs a body or a recipe" rule now also accepts a file or a shared post.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.direct_messages'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%body IS NOT NULL%recipe IS NOT NULL%' loop
    execute format('alter table public.direct_messages drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.direct_messages drop constraint if exists dm_has_content;
alter table public.direct_messages add constraint dm_has_content check (body is not null or recipe is not null or attachment is not null or shared_post is not null);

drop policy if exists "dm: send" on public.direct_messages;
create policy "dm: send" on public.direct_messages for insert
  with check (sender = auth.uid() and public.can_message(sender, recipient)
    and (attachment is null or (attachment->>'path') like (auth.uid()::text || '/' || recipient::text || '/%')));

-- Conversations someone deleted "for me": messages up to that moment stay hidden for them only.
create table if not exists public.dm_cleared (
  owner          uuid not null default auth.uid() references auth.users on delete cascade,
  other          uuid not null references auth.users on delete cascade,
  cleared_before timestamptz not null default now(),
  primary key (owner, other)
);
alter table public.dm_cleared enable row level security;
drop policy if exists "cleared: own" on public.dm_cleared;
create policy "cleared: own" on public.dm_cleared for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "dm: read own" on public.direct_messages;
create policy "dm: read own" on public.direct_messages for select using (
  auth.uid() in (sender, recipient)
  and not public.is_blocked(sender, recipient)
  and not exists (
    select 1 from dm_cleared c
    where c.owner = auth.uid() and c.other = case when sender = auth.uid() then recipient else sender end
      and direct_messages.created_at <= c.cleared_before
  )
);

-- Senders can edit their own text (marked "edited"); recipients can only mark delivered/read.
drop policy if exists "dm: edit own" on public.direct_messages;
create policy "dm: edit own" on public.direct_messages for update using (sender = auth.uid()) with check (sender = auth.uid());

create or replace function public.dm_only_read() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sender <> old.sender or new.recipient <> old.recipient or new.created_at <> old.created_at
     or new.recipe is distinct from old.recipe or new.attachment is distinct from old.attachment
     or new.shared_post is distinct from old.shared_post or new.reply_to is distinct from old.reply_to then
    raise exception 'Only the text of a message can be changed';
  end if;
  if auth.uid() = old.sender then
    -- The sender may change the text, and nothing about delivery or reading.
    if new.read_at is distinct from old.read_at or new.delivered_at is distinct from old.delivered_at then
      raise exception 'Not allowed';
    end if;
    if new.body is distinct from old.body then
      if new.body is null or char_length(trim(new.body)) = 0 then raise exception 'A message can''t be empty'; end if;
      new.edited_at := now();
    end if;
  elsif auth.uid() = old.recipient then
    if new.body is distinct from old.body or new.edited_at is distinct from old.edited_at then
      raise exception 'Only the sender can edit a message';
    end if;
    -- Requests stay private: reading one isn't shown until it's accepted. Read receipts can be switched off.
    if new.read_at is not null and old.read_at is null
       and (not public.dm_trusted(old.recipient, old.sender) or not (public.setting_of(old.recipient)).read_receipts) then
      new.read_at := null;
    end if;
  elsif auth.uid() is not null then
    raise exception 'Not allowed';
  end if;
  return new;
end $$;
drop trigger if exists dm_only_read on public.direct_messages;
create trigger dm_only_read before update on public.direct_messages for each row execute function public.dm_only_read();

-- Reactions on messages.
create table if not exists public.dm_reactions (
  message_id uuid not null references public.direct_messages (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  emoji      text not null check (emoji in ('❤️', '👍', '😂', '😮', '😢', '🔥', '💪')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.dm_reactions enable row level security;
drop policy if exists "dm reactions: read" on public.dm_reactions;
create policy "dm reactions: read" on public.dm_reactions for select using (
  exists (select 1 from direct_messages m where m.id = message_id and auth.uid() in (m.sender, m.recipient) and not public.is_blocked(m.sender, m.recipient)));
drop policy if exists "dm reactions: add" on public.dm_reactions;
create policy "dm reactions: add" on public.dm_reactions for insert with check (
  user_id = auth.uid() and exists (select 1 from direct_messages m where m.id = message_id and auth.uid() in (m.sender, m.recipient) and not public.is_blocked(m.sender, m.recipient)));
drop policy if exists "dm reactions: change" on public.dm_reactions;
create policy "dm reactions: change" on public.dm_reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "dm reactions: remove" on public.dm_reactions;
create policy "dm reactions: remove" on public.dm_reactions for delete using (user_id = auth.uid());

-- Archived and muted conversations (per person).
create table if not exists public.dm_archived (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  other uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, other)
);
create table if not exists public.dm_muted (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  other uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, other)
);
alter table public.dm_archived enable row level security;
alter table public.dm_muted enable row level security;
drop policy if exists "archived: own" on public.dm_archived;
create policy "archived: own" on public.dm_archived for all using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "muted: own" on public.dm_muted;
create policy "muted: own" on public.dm_muted for all using (owner = auth.uid()) with check (owner = auth.uid());

-- Private storage for files in messages: <sender>/<recipient>/<file>. Only the two people can open
-- a file (through short-lived signed links), and not at all once either has blocked the other.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm-files', 'dm-files', false, 15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf', 'text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dm files: participants read" on storage.objects;
create policy "dm files: participants read" on storage.objects for select using (
  bucket_id = 'dm-files' and auth.uid() is not null
  and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
  and not public.is_blocked(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid));
drop policy if exists "dm files: sender uploads" on storage.objects;
create policy "dm files: sender uploads" on storage.objects for insert with check (
  bucket_id = 'dm-files' and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_message(auth.uid(), ((storage.foldername(name))[2])::uuid));
drop policy if exists "dm files: sender deletes" on storage.objects;
create policy "dm files: sender deletes" on storage.objects for delete using (
  bucket_id = 'dm-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── Blocking everywhere ─────────────────────────
-- A block removes follows both ways. The blocked person is never told.
create or replace function public.on_block() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from follows where (follower = new.blocker and followee = new.blocked) or (follower = new.blocked and followee = new.blocker);
  delete from dm_accepts where (owner = new.blocker and other = new.blocked) or (owner = new.blocked and other = new.blocker);
  return new;
end $$;
drop trigger if exists on_block on public.blocks;
create trigger on_block after insert on public.blocks for each row execute function public.on_block();

drop policy if exists "follow" on public.follows;
create policy "follow" on public.follows for insert with check (auth.uid() = follower and not public.is_blocked(follower, followee));

-- Private profiles: posts only show to followers (and the person themselves).
create or replace function public.can_see_posts_of(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u = auth.uid() or (not public.is_blocked(auth.uid(), u)
    and (not coalesce((select private_profile from privacy_settings where user_id = u), false)
      or exists (select 1 from follows where follower = auth.uid() and followee = u)));
$$;
revoke all on function public.can_see_posts_of(uuid) from public, anon;
grant execute on function public.can_see_posts_of(uuid) to authenticated;

drop policy if exists "posts: members read" on public.posts;
create policy "posts: members read" on public.posts for select using (public.is_member(group_id) and public.can_see_posts_of(user_id));

drop policy if exists "reactions: members read" on public.reactions;
create policy "reactions: members read" on public.reactions for select using (
  not public.is_blocked(auth.uid(), user_id)
  and exists (select 1 from posts p where p.id = post_id and public.is_member(p.group_id) and not public.is_blocked(auth.uid(), p.user_id)));
drop policy if exists "reactions: add own" on public.reactions;
create policy "reactions: add own" on public.reactions for insert with check (
  user_id = auth.uid() and exists (select 1 from posts p where p.id = post_id and public.is_member(p.group_id) and not public.is_blocked(auth.uid(), p.user_id)));

drop policy if exists "comments: members read" on public.comments;
create policy "comments: members read" on public.comments for select using (
  not public.is_blocked(auth.uid(), user_id)
  and exists (select 1 from posts p where p.id = post_id and public.is_member(p.group_id) and not public.is_blocked(auth.uid(), p.user_id)));
drop policy if exists "comments: add own" on public.comments;
create policy "comments: add own" on public.comments for insert with check (
  user_id = auth.uid() and exists (select 1 from posts p where p.id = post_id and public.is_member(p.group_id) and not public.is_blocked(auth.uid(), p.user_id)));

-- Group chat messages from people I blocked (or who blocked me) are hidden too.
drop policy if exists "messages: members read" on public.messages;
create policy "messages: members read" on public.messages for select using (public.is_member(group_id) and not public.is_blocked(auth.uid(), user_id));

-- A blocked person's profile can't be looked up by username.
create or replace function public.find_user(p_username text) returns table (user_id uuid, display_name text, username text, avatar text, photo_path text)
language sql stable security definer set search_path = public as $$
  select user_id, display_name, username, avatar, photo_path from profiles_public
  where username = lower(trim(p_username)) and auth.uid() is not null and not public.is_blocked(auth.uid(), profiles_public.user_id) limit 1;
$$;
grant execute on function public.find_user(text) to authenticated;

-- So people can see and undo their own blocks in Privacy settings (they already can: "blocks: own").

-- ───────────────────────── Reports (for moderation) ─────────────────────────
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  reporter    uuid not null default auth.uid() references auth.users on delete cascade,
  target_type text not null check (target_type in ('user', 'message', 'post', 'comment', 'image', 'group_message')),
  target_id   text not null check (char_length(target_id) <= 200),
  target_user uuid references auth.users on delete set null,
  category    text not null check (category in ('harassment', 'spam', 'inappropriate', 'fake', 'unwanted_messages', 'other')),
  details     text check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at  timestamptz not null default now()
);
create index if not exists reports_open on public.reports (status, created_at) where status = 'open';
alter table public.reports enable row level security;
-- People can file reports but never read them (only moderators, with the service key). The reported person isn't told who reported.
drop policy if exists "reports: file" on public.reports;
create policy "reports: file" on public.reports for insert with check (reporter = auth.uid() and status = 'open');

-- No more than 30 reports a day per person (stops report spam).
create or replace function public.reports_rate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports where reporter = new.reporter and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many reports today. We''re reviewing the ones you sent.';
  end if;
  return new;
end $$;
drop trigger if exists reports_rate on public.reports;
create trigger reports_rate before insert on public.reports for each row execute function public.reports_rate();

-- ───────────────────────── Notifications ─────────────────────────
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('message', 'request', 'request_accepted', 'follow', 'like', 'comment', 'reply', 'mention', 'security')),
  actor      uuid references auth.users on delete cascade,
  ref        text check (char_length(ref) <= 200),
  body       text check (char_length(body) <= 300),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_time on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications for select using (user_id = auth.uid() and (actor is null or not public.is_blocked(user_id, actor)));
drop policy if exists "notifications: mark read" on public.notifications;
create policy "notifications: mark read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own" on public.notifications for delete using (user_id = auth.uid());

create or replace function public.notify(p_user uuid, p_kind text, p_actor uuid, p_ref text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null and public.is_blocked(p_user, p_actor) then return; end if;
  if coalesce(((public.setting_of(p_user)).notify ->> p_kind)::boolean, true) = false then return; end if;
  insert into notifications (user_id, kind, actor, ref, body) values (p_user, p_kind, p_actor, p_ref, left(p_body, 300));
end $$;
revoke all on function public.notify(uuid, text, uuid, text, text) from public, anon, authenticated;

create or replace function public.notify_dm() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from dm_muted where owner = new.recipient and other = new.sender) then return new; end if;
  if public.dm_trusted(new.recipient, new.sender) then
    perform public.notify(new.recipient, 'message', new.sender, new.id::text, 'New message');
  elsif not exists (select 1 from notifications where user_id = new.recipient and actor = new.sender and kind = 'request' and created_at > now() - interval '1 day') then
    perform public.notify(new.recipient, 'request', new.sender, new.id::text, 'New message request');
  end if;
  return new;
end $$;
drop trigger if exists notify_dm on public.direct_messages;
create trigger notify_dm after insert on public.direct_messages for each row execute function public.notify_dm();

create or replace function public.notify_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify(new.followee, 'follow', new.follower, null, 'started following you'); return new; end $$;
drop trigger if exists notify_follow on public.follows;
create trigger notify_follow after insert on public.follows for each row execute function public.notify_follow();

create or replace function public.notify_accept() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify(new.other, 'request_accepted', new.owner, null, 'accepted your message request'); return new; end $$;
drop trigger if exists notify_accept on public.dm_accepts;
create trigger notify_accept after insert on public.dm_accepts for each row execute function public.notify_accept();

create or replace function public.notify_reaction() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  if not exists (select 1 from notifications where user_id = owner and actor = new.user_id and kind = 'like' and ref = new.post_id::text) then
    perform public.notify(owner, 'like', new.user_id, new.post_id::text, 'reacted to your post');
  end if;
  return new;
end $$;
drop trigger if exists notify_reaction on public.reactions;
create trigger notify_reaction after insert on public.reactions for each row execute function public.notify_reaction();

create or replace function public.notify_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  perform public.notify(owner, 'comment', new.user_id, new.post_id::text, left(new.body, 120));
  return new;
end $$;
drop trigger if exists notify_comment on public.comments;
create trigger notify_comment after insert on public.comments for each row execute function public.notify_comment();

-- Live updates for chats and notifications.
do $$ begin alter publication supabase_realtime add table public.direct_messages; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.dm_reactions; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when others then null; end $$;
