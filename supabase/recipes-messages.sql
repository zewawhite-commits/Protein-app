-- Recipe sharing on the feed + private messages. Run once in Supabase → SQL Editor (safe to re-run).
-- Needs social.sql to have been run first.

-- 1. Recipes attached to feed posts (ingredients with grams and per-100 g values,
--    calculated by the app from its food database). Kept small.
alter table public.posts add column if not exists recipe jsonb
  check (recipe is null or (jsonb_typeof(recipe) = 'object' and pg_column_size(recipe) < 60000));

-- 2. Private messages between two people (text, optionally a recipe).
create table if not exists public.direct_messages (
  id         uuid primary key default gen_random_uuid(),
  sender     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  recipient  uuid not null references auth.users (id) on delete cascade,
  body       text check (char_length(body) <= 2000),
  recipe     jsonb check (recipe is null or (jsonb_typeof(recipe) = 'object' and pg_column_size(recipe) < 60000)),
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  check (sender <> recipient),
  check (body is not null or recipe is not null)
);
create index if not exists dm_pair_time on public.direct_messages (least(sender, recipient), greatest(sender, recipient), created_at desc);
create index if not exists dm_recipient_unread on public.direct_messages (recipient) where read_at is null;

-- People you've blocked can't message you (and you won't see theirs).
create table if not exists public.blocks (
  blocker    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

-- Reports go to the app owner for review.
create table if not exists public.message_reports (
  id         bigint generated always as identity primary key,
  reporter   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  message_id uuid not null references public.direct_messages (id) on delete cascade,
  reason     text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

alter table public.direct_messages enable row level security;
alter table public.blocks enable row level security;
alter table public.message_reports enable row level security;

drop policy if exists "dm: read own" on public.direct_messages;
create policy "dm: read own" on public.direct_messages for select
  using (auth.uid() in (sender, recipient) and not public.is_blocked(sender, recipient));
drop policy if exists "dm: send" on public.direct_messages;
create policy "dm: send" on public.direct_messages for insert
  with check (sender = auth.uid() and not public.is_blocked(sender, recipient));
-- Only the recipient marks messages read; only the sender deletes their own.
drop policy if exists "dm: mark read" on public.direct_messages;
create policy "dm: mark read" on public.direct_messages for update using (recipient = auth.uid()) with check (recipient = auth.uid());
drop policy if exists "dm: delete own" on public.direct_messages;
create policy "dm: delete own" on public.direct_messages for delete using (sender = auth.uid());

drop policy if exists "blocks: own" on public.blocks;
create policy "blocks: own" on public.blocks for all using (blocker = auth.uid()) with check (blocker = auth.uid());
drop policy if exists "reports: file" on public.message_reports;
create policy "reports: file" on public.message_reports for insert with check (reporter = auth.uid());

-- The recipient may only change read_at (not the text).
create or replace function public.dm_only_read() returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body or new.recipe is distinct from old.recipe or new.sender <> old.sender or new.recipient <> old.recipient then
    raise exception 'Messages can''t be edited';
  end if;
  return new;
end $$;
drop trigger if exists dm_only_read on public.direct_messages;
create trigger dm_only_read before update on public.direct_messages for each row execute function public.dm_only_read();

-- Find someone to message by their exact @username (public profiles of people you share a group with
-- are already readable; this lets you start a chat with anyone who has a username).
create or replace function public.find_user(p_username text) returns table (user_id uuid, display_name text, username text, avatar text, photo_path text)
language sql stable security definer set search_path = public as $$
  select user_id, display_name, username, avatar, photo_path from profiles_public
  where username = lower(trim(p_username)) and auth.uid() is not null limit 1;
$$;
grant execute on function public.find_user(text) to authenticated;

-- Profiles of people you're messaging with are readable too.
drop policy if exists "profiles: read chat partners" on public.profiles_public;
create policy "profiles: read chat partners" on public.profiles_public for select using (
  exists (select 1 from direct_messages m where (m.sender = auth.uid() and m.recipient = profiles_public.user_id) or (m.recipient = auth.uid() and m.sender = profiles_public.user_id))
);
