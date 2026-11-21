-- Indexes for busy days (run once in Supabase → SQL editor; safe to re-run).
-- Each matches a query the app makes, so lookups stay fast as tables grow to millions of rows.
create index if not exists posts_user_time on public.posts (user_id, created_at desc);          -- a person's posts (profile pages)
create index if not exists posts_time on public.posts (created_at desc);                         -- community feed, newest first
create index if not exists follows_followee on public.follows (followee);                        -- "who follows me"
create index if not exists dm_sender_time on public.direct_messages (sender, created_at desc);   -- inbox (messages I sent)
create index if not exists dm_recipient_time on public.direct_messages (recipient, created_at desc); -- inbox (messages to me)
create index if not exists comments_user on public.comments (user_id);                           -- deleting an account's comments
create index if not exists reactions_user on public.reactions (user_id);                         -- deleting an account's reactions
