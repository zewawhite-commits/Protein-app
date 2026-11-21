-- AI cost metering and fair-use protection (run once in Supabase → SQL editor; safe to re-run).

-- One row per AI call: who, which feature, the model's own token counts and the cost in US$.
create table if not exists public.ai_usage (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  user_id       uuid not null,
  feature       text not null,           -- scan, menu, label, coach, import, recipe, plan, workout, ideas
  tier          text not null,           -- free, plus, trial, reward, admin
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cache_read    integer not null default 0,
  cache_write   integer not null default 0,
  cost_usd      numeric(10, 6) not null default 0,
  device        text                      -- random id of the phone/browser (account-sharing signal)
);
create index if not exists ai_usage_at on public.ai_usage (at desc);
create index if not exists ai_usage_user_at on public.ai_usage (user_id, at desc);
alter table public.ai_usage enable row level security;   -- server-only (service role); no policies

-- Short-lived counters for throttling and duplicate requests.
create table if not exists public.ai_rate (
  key      text primary key,
  n        integer not null default 0,
  expires  timestamptz not null
);
alter table public.ai_rate enable row level security;

-- Count one hit on `p_key` (window of p_ttl seconds). Returns the count after this hit.
create or replace function public.ai_hit(p_key text, p_ttl integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  insert into ai_rate (key, n, expires) values (p_key, 1, now() + make_interval(secs => p_ttl))
  on conflict (key) do update
    set n = case when ai_rate.expires < now() then 1 else ai_rate.n + 1 end,
        expires = case when ai_rate.expires < now() then now() + make_interval(secs => p_ttl) else ai_rate.expires end
  returning n into v;
  -- Tidy up old counters now and then.
  if random() < 0.01 then delete from ai_rate where expires < now() - interval '1 hour'; end if;
  return v;
end $$;
revoke all on function public.ai_hit(text, integer) from public, anon, authenticated;

-- Accounts that crossed a fair-use review threshold (for the owner to look at; nobody is blocked by this).
create table if not exists public.ai_alerts (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  user_id  uuid not null,
  kind     text not null,     -- e.g. 'daily:scan', 'burst', 'devices', 'ceiling:scan'
  detail   text
);
create index if not exists ai_alerts_at on public.ai_alerts (at desc);
alter table public.ai_alerts enable row level security;

-- Dashboard summaries (owner only, via the server).
create or replace function public.ai_cost_by_feature(p_from timestamptz, p_to timestamptz)
returns table (feature text, tier text, requests bigint, cost numeric, people bigint)
language sql stable security definer set search_path = public as $$
  select feature, case when tier in ('plus', 'pro', 'trial', 'reward', 'admin') then tier else 'free' end, count(*), coalesce(sum(cost_usd), 0), count(distinct user_id)
  from ai_usage where at >= p_from and at < p_to group by 1, 2 order by 4 desc
$$;
create or replace function public.ai_top_accounts(p_from timestamptz, p_to timestamptz, p_limit integer)
returns table (user_id uuid, requests bigint, cost numeric, devices bigint, tier text, scans bigint, coach bigint)
language sql stable security definer set search_path = public as $$
  select user_id, count(*), coalesce(sum(cost_usd), 0), count(distinct device), max(tier),
         count(*) filter (where feature in ('scan', 'menu', 'label')), count(*) filter (where feature = 'coach')
  from ai_usage where at >= p_from and at < p_to group by user_id order by 3 desc limit p_limit
$$;
create or replace function public.ai_monthly(p_months integer)
returns table (month text, requests bigint, cost numeric, people bigint, paid_cost numeric, paid_people bigint)
language sql stable security definer set search_path = public as $$
  select to_char(date_trunc('month', at), 'YYYY-MM'), count(*), coalesce(sum(cost_usd), 0), count(distinct user_id),
         coalesce(sum(cost_usd) filter (where tier in ('plus', 'pro')), 0), count(distinct user_id) filter (where tier in ('plus', 'pro'))
  from ai_usage where at >= date_trunc('month', now()) - make_interval(months => p_months - 1) group by 1 order by 1
$$;
revoke all on function public.ai_cost_by_feature(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.ai_top_accounts(timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.ai_monthly(integer) from public, anon, authenticated;
