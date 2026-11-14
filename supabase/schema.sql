-- Protein app — Supabase schema. Run once in Supabase → SQL Editor.

-- One row per user holding their app data (profile, log, custom foods). Photos stay on the phone.
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Users can only see and change their own row.
drop policy if exists "own data: select" on public.user_data;
create policy "own data: select" on public.user_data for select using (auth.uid() = user_id);
drop policy if exists "own data: insert" on public.user_data;
create policy "own data: insert" on public.user_data for insert with check (auth.uid() = user_id);
drop policy if exists "own data: update" on public.user_data;
create policy "own data: update" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own data: delete" on public.user_data;
create policy "own data: delete" on public.user_data for delete using (auth.uid() = user_id);

-- Monthly photo-scan counter, written only by the server (service role).
create table if not exists public.scan_usage (
  subscriber text not null,          -- Supabase user id, or "cus_<paystack customer id>"
  month      text not null,          -- e.g. 2026-11 (UTC)
  scans      integer not null default 0,
  primary key (subscriber, month)
);
alter table public.scan_usage enable row level security;   -- no policies: clients can't read or write it

-- Atomically use one scan if under the limit. Returns scans left, or -1 if the limit is reached.
create or replace function public.use_scan(p_key text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_scans integer;
begin
  insert into scan_usage (subscriber, month, scans) values (p_key, v_month, 0)
  on conflict (subscriber, month) do nothing;

  update scan_usage set scans = scans + 1
  where subscriber = p_key and month = v_month and scans < p_limit
  returning scans into v_scans;

  if v_scans is null then
    return -1;
  end if;
  return p_limit - v_scans;
end;
$$;

revoke all on function public.use_scan(text, integer) from public, anon, authenticated;

-- Anonymous record of which database entry people chose for an AI-recognised food.
-- For human review only (improving coverage of international foods) — never treated as verified data.
create table if not exists public.recognition_feedback (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  ai_name        text not null,
  local_name     text,
  cuisine        text,
  chosen_food_id text not null,
  chosen_name    text,
  candidate_rank integer,           -- position of the chosen record in our suggestions (-1 = found by search)
  kind           text not null default 'item'
);
alter table public.recognition_feedback enable row level security;   -- server-only; no client access
