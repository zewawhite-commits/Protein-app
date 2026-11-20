-- Food photos from Unsplash, found once per food type and shared by everyone (credits kept).
create table if not exists public.food_photos (
  key           text primary key check (char_length(key) <= 60),
  url           text,
  author        text,
  author_url    text,
  photo_page    text,
  blur_color    text,
  tried_at      timestamptz not null default now()
);
alter table public.food_photos enable row level security;
drop policy if exists "food photos: anyone reads" on public.food_photos;
create policy "food photos: anyone reads" on public.food_photos for select using (true);
