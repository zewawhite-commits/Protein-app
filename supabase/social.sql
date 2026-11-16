-- Nutivili AI — social features (groups, meal posts, reactions, comments).
-- Run once in Supabase → SQL Editor, after schema.sql. Safe to run again.
-- Privacy: people only see groups they belong to, and only those groups' posts.

-- Public profile shown to group members (name, emoji avatar, streak).
create table if not exists public.profiles_public (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Member' check (char_length(display_name) between 1 and 40),
  avatar       text not null default '🙂' check (char_length(avatar) <= 8),
  streak       integer not null default 0 check (streak between 0 and 10000),
  updated_at   timestamptz not null default now()
);

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members (user_id);

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  caption    text check (char_length(caption) <= 500),
  meal       text check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  -- Totals calculated by the app from the food database at posting time.
  kcal       numeric check (kcal >= 0 and kcal < 20000),
  protein    numeric check (protein >= 0 and protein < 2000),
  carbs      numeric check (carbs >= 0 and carbs < 5000),
  fat        numeric check (fat >= 0 and fat < 2000),
  photo_path text check (char_length(photo_path) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists posts_group_time on public.posts (group_id, created_at desc);

create table if not exists public.reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  emoji      text not null check (emoji in ('🔥', '💪', '👏', '😋', '❤️')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_time on public.comments (post_id, created_at);

-- Membership check used by the policies (security definer avoids recursive policy checks).
create or replace function public.is_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid());
$$;

create or replace function public.shares_group(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p_user);
$$;

-- Create a group (and become its owner) in one step.
create or replace function public.create_group(p_name text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if (select count(*) from groups where created_by = auth.uid()) >= 20 then raise exception 'Group limit reached'; end if;
  insert into groups (name, created_by) values (trim(p_name), auth.uid()) returning * into g;
  insert into group_members (group_id, user_id, role) values (g.id, auth.uid(), 'owner');
  return g;
end;
$$;

-- Join a group with its invite code.
create or replace function public.join_group(p_code text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into g from groups where invite_code = upper(trim(p_code));
  if g.id is null then raise exception 'No group with that code'; end if;
  if (select count(*) from group_members where group_id = g.id) >= 200 then raise exception 'This group is full'; end if;
  insert into group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  return g;
end;
$$;

revoke all on function public.create_group(text), public.join_group(text) from public, anon;
grant execute on function public.create_group(text), public.join_group(text) to authenticated;

alter table public.profiles_public enable row level security;
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.posts           enable row level security;
alter table public.reactions       enable row level security;
alter table public.comments        enable row level security;

drop policy if exists "profiles: read group mates" on public.profiles_public;
create policy "profiles: read group mates" on public.profiles_public for select using (public.shares_group(user_id));
drop policy if exists "profiles: write own" on public.profiles_public;
create policy "profiles: write own" on public.profiles_public for insert with check (user_id = auth.uid());
drop policy if exists "profiles: update own" on public.profiles_public;
create policy "profiles: update own" on public.profiles_public for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "groups: members read" on public.groups;
create policy "groups: members read" on public.groups for select using (public.is_member(id));
drop policy if exists "groups: owner renames" on public.groups;
create policy "groups: owner renames" on public.groups for update using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "groups: owner deletes" on public.groups;
create policy "groups: owner deletes" on public.groups for delete using (created_by = auth.uid());

drop policy if exists "members: read same group" on public.group_members;
create policy "members: read same group" on public.group_members for select using (public.is_member(group_id));
drop policy if exists "members: leave" on public.group_members;
create policy "members: leave" on public.group_members for delete using (user_id = auth.uid());

drop policy if exists "posts: members read" on public.posts;
create policy "posts: members read" on public.posts for select using (public.is_member(group_id));
drop policy if exists "posts: members write own" on public.posts;
create policy "posts: members write own" on public.posts for insert with check (user_id = auth.uid() and public.is_member(group_id));
drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts for delete using (user_id = auth.uid());

drop policy if exists "reactions: members read" on public.reactions;
create policy "reactions: members read" on public.reactions for select using (exists (select 1 from posts p where p.id = post_id and public.is_member(p.group_id)));
drop policy if exists "reactions: add own" on public.reactions;
create policy "reactions: add own" on public.reactions for insert with check (user_id = auth.uid() and exists (select 1 from posts p where p.id = post_id and public.is_member(p.group_id)));
drop policy if exists "reactions: remove own" on public.reactions;
create policy "reactions: remove own" on public.reactions for delete using (user_id = auth.uid());

drop policy if exists "comments: members read" on public.comments;
create policy "comments: members read" on public.comments for select using (exists (select 1 from posts p where p.id = post_id and public.is_member(p.group_id)));
drop policy if exists "comments: add own" on public.comments;
create policy "comments: add own" on public.comments for insert with check (user_id = auth.uid() and exists (select 1 from posts p where p.id = post_id and public.is_member(p.group_id)));
drop policy if exists "comments: delete own" on public.comments;
create policy "comments: delete own" on public.comments for delete using (user_id = auth.uid());

-- Meal photos for posts: private bucket; group members get short-lived signed links.
-- Files live at <group id>/<user id>/<random>.jpg.
insert into storage.buckets (id, name, public) values ('post-photos', 'post-photos', false) on conflict (id) do nothing;
drop policy if exists "post photos: members read" on storage.objects;
create policy "post photos: members read" on storage.objects for select
  using (bucket_id = 'post-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "post photos: upload own" on storage.objects;
create policy "post photos: upload own" on storage.objects for insert
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[2] = auth.uid()::text and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "post photos: delete own" on storage.objects;
create policy "post photos: delete own" on storage.objects for delete
  using (bucket_id = 'post-photos' and (storage.foldername(name))[2] = auth.uid()::text);

-- ---------- Profiles v2: usernames and profile photos ----------
alter table public.profiles_public add column if not exists username text;
alter table public.profiles_public add column if not exists photo_path text check (char_length(photo_path) <= 200);
do $$ begin
  alter table public.profiles_public add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$');
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_username_unique on public.profiles_public (username);

-- Is a username free? (callable before anyone shares a group)
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles_public where username = lower(trim(p_username)) and user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'));
$$;
revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

-- Profile photos: public bucket (anyone with the link can view), each user writes only their own folder.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "avatars: upload own" on storage.objects;
create policy "avatars: upload own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: update own" on storage.objects;
create policy "avatars: update own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: delete own" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Group chat ----------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_group_time on public.messages (group_id, created_at desc);
alter table public.messages enable row level security;
drop policy if exists "messages: members read" on public.messages;
create policy "messages: members read" on public.messages for select using (public.is_member(group_id));
drop policy if exists "messages: members send" on public.messages;
create policy "messages: members send" on public.messages for insert with check (user_id = auth.uid() and public.is_member(group_id));
drop policy if exists "messages: delete own" on public.messages;
create policy "messages: delete own" on public.messages for delete using (user_id = auth.uid());
-- Live updates (Supabase Realtime respects the read policy above).
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null; end $$;

-- ---------- Public groups (discoverable, one-tap join) ----------
alter table public.groups add column if not exists is_public boolean not null default false;
alter table public.groups add column if not exists description text check (char_length(description) <= 140);
drop policy if exists "groups: public read" on public.groups;
create policy "groups: public read" on public.groups for select using (is_public);

drop function if exists public.create_group(text);
create or replace function public.create_group(p_name text, p_public boolean default false, p_description text default null)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if (select count(*) from groups where created_by = auth.uid()) >= 20 then raise exception 'Group limit reached'; end if;
  insert into groups (name, created_by, is_public, description) values (trim(p_name), auth.uid(), coalesce(p_public, false), nullif(trim(p_description), ''))
  returning * into g;
  insert into group_members (group_id, user_id, role) values (g.id, auth.uid(), 'owner');
  return g;
end;
$$;

-- Public groups with member counts, biggest first.
create or replace function public.public_groups()
returns table (id uuid, name text, description text, members bigint, joined boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.description, count(m.user_id) as members, bool_or(m.user_id = auth.uid()) as joined
  from groups g left join group_members m on m.group_id = g.id
  where g.is_public
  group by g.id
  order by members desc, g.created_at
  limit 50;
$$;

create or replace function public.join_public_group(p_id uuid)
returns public.groups language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into g from groups where id = p_id and is_public;
  if g.id is null then raise exception 'Group not found'; end if;
  if (select count(*) from group_members where group_id = g.id) >= 5000 then raise exception 'This group is full'; end if;
  insert into group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  return g;
end;
$$;

revoke all on function public.create_group(text, boolean, text), public.public_groups(), public.join_public_group(uuid) from public, anon;
grant execute on function public.create_group(text, boolean, text), public.public_groups(), public.join_public_group(uuid) to authenticated;

-- ---------- Community feed (one public feed everyone shares) ----------
alter table public.groups alter column created_by drop not null;
insert into public.groups (id, name, invite_code, created_by, is_public, description)
values ('00000000-0000-0000-0000-00000000c0de', 'Community', 'PROVRA', null, true, 'Everyone’s journeys')
on conflict (id) do nothing;

-- Join the community feed (no member cap).
create or replace function public.join_community()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into group_members (group_id, user_id) values ('00000000-0000-0000-0000-00000000c0de', auth.uid()) on conflict do nothing;
end;
$$;
revoke all on function public.join_community() from public, anon;
grant execute on function public.join_community() to authenticated;
