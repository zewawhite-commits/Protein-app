-- Food search cache for /api/foods (USDA FoodData Central + Open Food Facts).
-- Run once in the Supabase SQL editor. Safe to run again.
-- Only the server (service role) reads and writes these tables; the app never touches them directly.
--
-- Size: a cached food is about 1–2 KB. 100,000 foods ≈ 150 MB, well inside Supabase Pro's 8 GB.
-- Nothing is bulk-imported: a food is stored only after someone searched for it.

create extension if not exists pg_trgm;

create table if not exists public.external_foods (
  id text primary key,                 -- "usda:<fdcId>" or "off:<barcode>"
  source text not null,                -- usda-branded | usda-foundation | usda-sr | usda-fndds | off
  name text not null,
  brand text,
  barcode text,
  kind text,                           -- generic | branded | restaurant | meal
  data jsonb not null,                 -- the normalised food, with per-100 g values and portions
  hits integer not null default 0,
  updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(brand, ''))) stored
);
create index if not exists external_foods_search_idx on public.external_foods using gin (search);
create index if not exists external_foods_name_trgm_idx on public.external_foods using gin (name gin_trgm_ops);
create index if not exists external_foods_barcode_idx on public.external_foods (barcode);
create index if not exists external_foods_source_idx on public.external_foods (source);

create table if not exists public.food_search_cache (
  key text primary key,                -- "q:<query>|<page>|<size>|<sources>" or "barcode:<code>"
  results jsonb not null,
  expires_at timestamptz not null
);
create index if not exists food_search_cache_expires_idx on public.food_search_cache (expires_at);

alter table public.external_foods enable row level security;
alter table public.food_search_cache enable row level security;
-- No policies: only the service role (the server) can use them.

-- Housekeeping: drop expired result pages (run weekly, or from a scheduled function).
-- delete from public.food_search_cache where expires_at < now();
