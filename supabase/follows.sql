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
