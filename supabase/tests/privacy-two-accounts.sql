\set ON_ERROR_STOP 0
\set QUIET 1
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000000','a@x'),('bbbbbbbb-0000-0000-0000-000000000000','b@x'),('cccccccc-0000-0000-0000-000000000000','c@x');
insert into profiles_public (user_id, display_name, username) values ('aaaaaaaa-0000-0000-0000-000000000000','Ada','ada'),('bbbbbbbb-0000-0000-0000-000000000000','Ben','ben');
insert into group_members (group_id, user_id) values ('00000000-0000-0000-0000-00000000c0de','aaaaaaaa-0000-0000-0000-000000000000'),('00000000-0000-0000-0000-00000000c0de','bbbbbbbb-0000-0000-0000-000000000000');
insert into posts (id, group_id, user_id, title) values ('11111111-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000c0de','aaaaaaaa-0000-0000-0000-000000000000','Ada lunch');
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
\echo '--- 1. B messages A (not followed): lands as a request'
set role authenticated; select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000000');
insert into direct_messages (id, recipient, body) values ('22222222-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000000','hi Ada');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000000');
select 'A sees msgs: ' || count(*) from direct_messages;
select 'trusted before accept: ' || public.dm_trusted('aaaaaaaa-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000000');
update direct_messages set read_at = now() where id = '22222222-0000-0000-0000-000000000000';
select 'read hidden for request (expect t): ' || (read_at is null) from direct_messages;
select 'A notifications: ' || string_agg(kind, ',') from notifications;
\echo '--- 2. A sets Nobody; C cannot start a chat'
insert into privacy_settings (dm_from) values ('nobody');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000000');
insert into direct_messages (recipient, body) values ('aaaaaaaa-0000-0000-0000-000000000000','spam');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000000');
\echo '(B also blocked by Nobody until accepted:)'
insert into direct_messages (recipient, body) values ('aaaaaaaa-0000-0000-0000-000000000000','again');
\echo '--- 3. A accepts B: B notified, read receipts work'
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000000');
insert into dm_accepts (other) values ('bbbbbbbb-0000-0000-0000-000000000000');
update direct_messages set read_at = now() where id = '22222222-0000-0000-0000-000000000000';
select 'read now set (expect t): ' || (read_at is not null) from direct_messages where id = '22222222-0000-0000-0000-000000000000';
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000000');
select 'B notifications: ' || string_agg(kind, ',') from notifications;
insert into direct_messages (recipient, body) values ('aaaaaaaa-0000-0000-0000-000000000000','thanks for accepting');
select 'B can reply after accept, msgs: ' || count(*) from direct_messages;
\echo '--- 4. Edits: sender yes, recipient no'
update direct_messages set body = 'hi Ada!' where id = '22222222-0000-0000-0000-000000000000';
select 'edited flag (expect t): ' || (edited_at is not null) from direct_messages where id = '22222222-0000-0000-0000-000000000000';
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000000');
update direct_messages set body = 'hacked' where id = '22222222-0000-0000-0000-000000000000';
\echo '--- 5. A blocks B: B cut off everywhere'
insert into blocks (blocked) values ('bbbbbbbb-0000-0000-0000-000000000000');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000000');
insert into direct_messages (recipient, body) values ('aaaaaaaa-0000-0000-0000-000000000000','you there?');
select 'B sees msgs (expect 0): ' || count(*) from direct_messages;
insert into follows (followee) values ('aaaaaaaa-0000-0000-0000-000000000000');
select 'B sees A posts (expect 0): ' || count(*) from posts;
insert into comments (post_id, body) values ('11111111-0000-0000-0000-000000000000','nice');
insert into reactions (post_id, user_id, emoji) values ('11111111-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000000','🔥');
select 'B finds A by username (expect 0): ' || count(*) from public.find_user('ada');
insert into storage.objects (bucket_id, name) values ('dm-files','bbbbbbbb-0000-0000-0000-000000000000/aaaaaaaa-0000-0000-0000-000000000000/x.jpg');
select 'B notified of block (expect 0 new): ' || count(*) from notifications where kind not in ('request_accepted');
select 'B can read reactions on A post (expect 0): ' || count(*) from reactions;
\echo '--- 6. C cannot read A-B files or messages (no URL guessing)'
reset role; insert into storage.objects (bucket_id, name, owner) values ('dm-files','aaaaaaaa-0000-0000-0000-000000000000/cccccccc-0000-0000-0000-000000000000/p.jpg','aaaaaaaa-0000-0000-0000-000000000000');
set role authenticated; select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000000');
select 'B sees A->C file (expect 0): ' || count(*) from storage.objects where bucket_id = 'dm-files';
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000000');
select 'C sees A->C file (expect 1): ' || count(*) from storage.objects where bucket_id = 'dm-files';
select 'C sees A-B messages (expect 0): ' || count(*) from direct_messages;
\echo '--- 7. Reports: can file, cannot read'
insert into reports (target_type, target_id, target_user, category) values ('user','aaaaaaaa','aaaaaaaa-0000-0000-0000-000000000000','spam');
select 'C reads reports (expect 0): ' || count(*) from reports;
\echo '--- 8. Unblock: B can talk again, as a request (accept was removed)'
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000000');
delete from blocks where blocked = 'bbbbbbbb-0000-0000-0000-000000000000';
update privacy_settings set dm_from = 'everyone';
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000000');
insert into direct_messages (recipient, body) values ('aaaaaaaa-0000-0000-0000-000000000000','sorry');
select 'trusted after unblock (expect f): ' || public.dm_trusted('aaaaaaaa-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000000');
\echo '--- 9. Delete conversation for me only'
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000000');
insert into dm_cleared (other) values ('bbbbbbbb-0000-0000-0000-000000000000');
select 'A sees after clearing (expect 0): ' || count(*) from direct_messages;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000000');
select 'B still sees (expect >0): ' || count(*) from direct_messages;
\echo '--- 10. Reactions on a message'
insert into dm_reactions (message_id, emoji) values ('22222222-0000-0000-0000-000000000000','❤️');
select 'reactions: ' || count(*) from dm_reactions;
\echo '--- 11. Private profile: only followers see posts'
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000000');
update privacy_settings set private_profile = true;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000000');
select 'B (not following) sees private posts (expect 0): ' || count(*) from posts;
insert into follows (followee) values ('aaaaaaaa-0000-0000-0000-000000000000');
select 'B (following) sees posts (expect 1): ' || count(*) from posts;
