-- Follow people whose journeys you enjoy. Private: you only ever see who YOU follow,
-- so there are no follower counts or popularity numbers anywhere.
create table if not exists public.follows (
  follower uuid not null default auth.uid() references auth.users on delete cascade,
  followee uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
alter table public.follows enable row level security;
drop policy if exists "see who I follow" on public.follows;
create policy "see who I follow" on public.follows for select using (auth.uid() = follower);
drop policy if exists "follow" on public.follows;
create policy "follow" on public.follows for insert with check (auth.uid() = follower);
drop policy if exists "unfollow" on public.follows;
create policy "unfollow" on public.follows for delete using (auth.uid() = follower);

-- Messages: a chat goes to your Inbox when you follow each other; otherwise it waits under
-- Requests until you accept. You can see who follows you (never shown as a count).
drop policy if exists "see who follows me" on public.follows;
create policy "see who follows me" on public.follows for select using (auth.uid() = followee);

create table if not exists public.dm_accepts (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  other uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, other)
);
alter table public.dm_accepts enable row level security;
drop policy if exists "my accepts" on public.dm_accepts;
create policy "my accepts" on public.dm_accepts for all using (auth.uid() = owner) with check (auth.uid() = owner);
