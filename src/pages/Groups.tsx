import { MEAL_LABELS, MEAL_ORDER, feedMeal } from '@/lib/meals';
import { SharedRecipeCard, toShared } from '@/components/SharedRecipeCard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Copy, Crown, Droplet, Drumstick, Dumbbell, Flame, Globe2, Heart, ImagePlus, Link2, Loader2, Lock, LogOut, MessageCircle, Plus, RefreshCw, Reply, Send, Share2, Smile, SmilePlus, ThumbsUp, Trash2, UserRound, Users, Utensils, Wheat, X } from 'lucide-react';
import { AVATAR_COLORS, Avatar } from '@/components/Avatar';
import { GroupChat } from '@/components/GroupChat';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { accountsEnabled, useSession } from '@/lib/account';
import { useDay } from '@/lib/hooks';
import { todayKey } from '@/lib/dates';
import { sumEntries } from '@/lib/nutrition';
import { splitName } from '@/lib/foods';
import { cropSquare, getPhoto, resizeImage } from '@/lib/photos';
import type { Meal } from '@/lib/types';
import {
  REACTIONS, addComment, ago, comments as loadComments, createGroup, deletePost, feed, joinGroup, leaveGroup, members as loadMembers,
  COMMUNITY_ID, inviteUrl, joinCommunity, joinPublicGroup, myGroups, myProfile, pendingJoin, publicGroups, myUserId, sharePost, toggleReaction, uploadAvatar, upsertMyProfile, usernameAvailable,
  type Comment, type Group, type Member, type MyProfile, type Post, type PublicGroup, type PublicProfile, type Reaction,
} from '@/lib/social';
import { SignInButtons } from '@/components/SignIn';
import { FoodVisual } from '@/components/FoodIcon';
import { Segmented, Sheet, cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';
import { useStreak } from './Today';

const GROUP_KEY = 'provora-group';
const REACTION_ICON: Record<Reaction, typeof Flame> = { '🔥': Flame, '💪': Dumbbell, '👏': ThumbsUp, '😋': Smile, '❤️': Heart };
const REACTION_LABEL: Record<Reaction, string> = { '🔥': 'Fire', '💪': 'Strong', '👏': 'Nice', '😋': 'Tasty', '❤️': 'Love' };
const MEAL_LABEL = MEAL_LABELS;

export default function Groups() {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  // An invite link (?join=CODE) is remembered so it still works after signing in.
  useEffect(() => {
    const code = params.get('join');
    if (code) { pendingJoin.set(code); setParams({}, { replace: true }); }
  }, [params, setParams]);

  if (!accountsEnabled) return <Shell><Preview note="Groups will open once accounts are switched on for this app." /></Shell>;
  if (session === undefined) return <Shell><Loading /></Shell>;
  if (!session) return <Shell><Preview signIn /></Shell>;
  return <Shell><Signed /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-safe flex items-center gap-3 pb-4">
        <Link to="/feed" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back to feed"><ArrowLeft size={20} /></Link>
        <h1 className="text-[30px] font-extrabold tracking-tight">Groups</h1>
      </header>
      {children}
    </div>
  );
}

const STEPS = [
  { icon: Users, title: 'Join or create a group', body: 'Join a public group, or create a private one and share an invite link.' },
  { icon: Send, title: 'Post your meals', body: 'Share a meal with its calories and macros — or a photo, a win, a tip.' },
  { icon: MessageCircle, title: 'Chat and cheer', body: 'React, comment, chat and keep each other’s streaks going.' },
];

const EXAMPLES: Post[] = [
  { id: 'x1', group_id: '', user_id: 'a', title: 'Grilled chicken, rice and greens', caption: 'Post-gym dinner', meal: 'dinner', kcal: 612, protein: 48, carbs: 55, fat: 19, photo_path: null, created_at: new Date(Date.now() - 3600e3).toISOString(), author: { display_name: 'Maya', avatar: 'violet', streak: 21, username: 'maya_moves' }, reactions: [{ emoji: '🔥', user_id: 'b' }, { emoji: '💪', user_id: 'c' }], commentCount: 3, latestComments: [{ id: 'c1', post_id: 'x1', user_id: 'b', body: 'That looks so good!', created_at: '', author: { display_name: 'Leo', avatar: 'teal', streak: 9 } }, { id: 'c2', post_id: 'x1', user_id: 'c', body: 'Recipe please', created_at: '', author: { display_name: 'Kemi', avatar: 'amber', streak: 4 } }] },
  { id: 'x2', group_id: '', user_id: 'b', title: 'Down 4 kg this month!', caption: 'Logging every meal really works.', meal: null, kcal: null, protein: null, carbs: null, fat: null, photo_path: null, created_at: new Date(Date.now() - 5 * 3600e3).toISOString(), author: { display_name: 'Leo', avatar: 'teal', streak: 9, username: 'leo_lifts' }, reactions: [{ emoji: '❤️', user_id: 'a' }, { emoji: '👏', user_id: 'c' }, { emoji: '👏', user_id: 'd' }], commentCount: 5 },
];

/** What Groups is, before signing in: how it works, example posts and one clear button. */
function Preview({ signIn, note }: { signIn?: boolean; note?: string }) {
  const invited = pendingJoin.get();
  return (
    <>
      {invited && (
        <div className="mb-4 flex items-center gap-3 rounded-[22px] bg-accent/10 p-4 text-accent">
          <Users size={20} /><p className="text-sm font-bold">You’ve been invited to a group. Sign in to join — it only takes a moment.</p>
        </div>
      )}
      <div className="card p-6">
        <div className="flex -space-x-2">{['Ava Moore', 'Ben Cole', 'Kemi Ade', 'Leo Park'].map((n, i) => <Avatar key={n} name={n} color={Object.keys(AVATAR_COLORS)[i]} size={52} className="ring-4 ring-surface" />)}</div>
        <p className="mt-4 text-[24px] font-extrabold leading-tight">Grow with friends</p>
        <p className="mt-1 text-[15px] text-silver">People who track with friends stick with it. Share meals, chat and keep each other going.</p>
        <ol className="mt-5 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-on-primary"><s.icon size={18} /></span>
              <div><p className="font-bold">{i + 1}. {s.title}</p><p className="text-sm text-silver">{s.body}</p></div>
            </li>
          ))}
        </ol>
        {signIn ? (
          <div className="mt-6"><SignInButtons /></div>
        ) : (
          <p className="mt-6 rounded-2xl bg-raised p-4 text-sm text-silver">{note}</p>
        )}
      </div>
      <p className="mb-3 mt-6 px-1 text-sm font-semibold text-silver">What the feed looks like · examples</p>
      <div className="space-y-4">
        {EXAMPLES.map((p) => <PostCard key={p.id} post={p} onReact={() => toast('Sign in to react and comment')} onOpen={() => toast('Sign in to react and comment')} onDelete={() => undefined} />)}
      </div>
    </>
  );
}

function Loading() {
  return <p className="flex items-center justify-center gap-2 py-16 text-silver"><Loader2 className="animate-spin" size={18} /> Loading…</p>;
}

function Signed() {
  const profile = useStore((s) => s.profile);
  const streak = useStreak();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [active, setActive] = useState<string | null>(() => { try { return localStorage.getItem(GROUP_KEY); } catch { return null; } });
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState(() => { try { return localStorage.getItem('provora-avatar') ?? 'blue'; } catch { return 'blue'; } });
  const [hub, setHub] = useState(() => new URLSearchParams(location.search).has('new'));
  const [invite, setInvite] = useState<string | null>(pendingJoin.get());

  const reload = useCallback(async () => {
    try {
      const list = (await myGroups()).filter((g) => g.id !== COMMUNITY_ID);
      setGroups(list);
      setActive((a) => (a && list.some((g) => g.id === a) ? a : list[0]?.id ?? null));
      return list;
    } catch (e) {
      setError((e as Error).message);
      setGroups([]);
      return [];
    }
  }, []);

  const [mine, setMine] = useState<MyProfile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  useEffect(() => { void reload(); myProfile().then(setMine, () => setMine(null)); }, [reload]);
  useEffect(() => {
    if (!mine) return;
    void upsertMyProfile({ avatar, streak }).catch(() => undefined);
  }, [mine, avatar, streak]);
  useEffect(() => { try { if (active) localStorage.setItem(GROUP_KEY, active); } catch { /* ignore */ } }, [active]);

  async function acceptInvite() {
    if (!invite) return;
    try {
      const g = await joinGroup(invite);
      haptic([10, 30, 10]);
      toast(`You joined “${g.name}”`);
      await reload();
      setActive(g.id); setHub(false);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      pendingJoin.clear(); setInvite(null);
    }
  }

  if (groups === null || mine === undefined) return <Loading />;
  if (error && !groups.length) return <p className="card p-5 text-sm text-danger">{error.includes('relation') || error.includes('function') || error.includes('schema') ? 'Groups aren’t set up on the server yet (run supabase/social.sql in Supabase).' : error}</p>;
  if (!mine?.username || editing) {
    return (
      <>
        {!mine?.username && <p className="mb-3 px-1 text-sm font-semibold text-silver">Step 1 of 2 · your profile</p>}
        <ProfileEditor
          initial={mine}
          defaultName={profile?.name ?? ''}
          onSaved={async () => { setMine(await myProfile()); setEditing(false); }}
          onCancel={mine?.username ? () => setEditing(false) : undefined}
        />
      </>
    );
  }
  const group = groups.find((g) => g.id === active);
  const opened = (g: Group) => { void reload().then(() => { setActive(g.id); setHub(false); }); };

  return (
    <>
      <Sheet open={!!invite} onClose={() => { pendingJoin.clear(); setInvite(null); }} title="Join group?">
        <p className="text-sm text-silver">You were invited with code <b className="text-ink">{invite}</b>.</p>
        <button onClick={acceptInvite} className="btn-primary mt-4 w-full"><Users size={18} /> Join group</button>
      </Sheet>
      {!groups.length || !group || hub ? (
        <GroupsHub hasGroups={groups.length > 0} onOpened={opened} onBack={group ? () => setHub(false) : undefined} />
      ) : (
        <GroupView
          key={group.id}
          group={group}
          groups={groups}
          avatar={avatar}
          onAvatar={(a) => { setAvatar(a); try { localStorage.setItem('provora-avatar', a); } catch { /* ignore */ } }}
          onSwitch={setActive}
          onChanged={reload}
          onEditProfile={() => setEditing(true)}
          onDiscover={() => setHub(true)}
        />
      )}
    </>
  );
}

/** Find a group: discover public groups, join with a code or link, or create one. */
function GroupsHub({ hasGroups, onOpened, onBack }: { hasGroups: boolean; onOpened: (g: Group) => void; onBack?: () => void }) {
  const [list, setList] = useState<PublicGroup[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { publicGroups().then(setList, () => setList([])); }, []);
  async function join(g: PublicGroup) {
    setBusy(g.id);
    try { const joined = await joinPublicGroup(g.id); haptic([10, 30, 10]); toast(`You joined “${joined.name}”`); onOpened(joined); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(null); }
  }
  return (
    <>
      {onBack && <button onClick={onBack} className="chip mb-4 !h-10"><ChevronDown size={16} className="rotate-90" /> Back to my group</button>}
      {!hasGroups && <p className="mb-3 px-1 text-sm font-semibold text-silver">Step 2 of 2 · find your people</p>}
      {new URLSearchParams(location.search).get('new') === 'create' && (
        <>
          <p className="mb-2 px-1 text-[17px] font-bold">Create a group</p>
          <CreateOrJoin initial="create" onDone={onOpened} />
          <div className="h-6" />
        </>
      )}
      <p className="mb-2 px-1 text-[17px] font-bold">Discover groups</p>
      {list === null ? <Loading /> : list.length === 0 ? (
        <p className="card p-5 text-sm text-silver">No public groups yet — create the first one below and make it public.</p>
      ) : (
        <div className="card p-2">
          {list.map((g) => (
            <div key={g.id} className="flex items-center gap-3 p-2.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-raised"><Globe2 size={20} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{g.name}</p>
                <p className="truncate text-sm text-silver">{g.members} member{g.members === 1 ? '' : 's'}{g.description ? ` · ${g.description}` : ''}</p>
              </div>
              {g.joined ? <span className="chip !h-9 !text-silver">Joined</span> : (
                <button onClick={() => join(g)} disabled={busy === g.id} className="chip !h-9 !bg-primary !text-on-primary">{busy === g.id ? <Loader2 size={14} className="animate-spin" /> : 'Join'}</button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mb-2 mt-6 px-1 text-[17px] font-bold">Join with an invite</p>
      <CreateOrJoin initial="join" onDone={onOpened} />
      {new URLSearchParams(location.search).get('new') !== 'create' && (
        <>
          <p className="mb-2 mt-6 px-1 text-[17px] font-bold">Start your own</p>
          <CreateOrJoin initial="create" onDone={onOpened} />
        </>
      )}
    </>
  );
}

function CreateOrJoin({ onDone, initial }: { onDone: (g: Group) => void; initial: 'create' | 'join' }) {
  const mode = initial;
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // Accept a full invite link as well as a bare code.
  const cleanCode = (v: string) => (v.match(/join=([A-Za-z0-9]+)/)?.[1] ?? v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  async function go() {
    setBusy(true);
    try {
      const g = mode === 'create' ? await createGroup(name, isPublic, about) : await joinGroup(code);
      haptic([10, 30, 10]);
      toast(mode === 'create' ? `“${g.name}” created — invite friends from the share button` : `You joined “${g.name}”`);
      onDone(g);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card p-5">
      {mode === 'create' ? (
        <>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Group name, e.g. Shred Squad" />
          <input className="field mt-2" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} placeholder="What’s it about? (optional)" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([[false, 'Private', 'Invite only', Lock], [true, 'Public', 'Anyone can join', Globe2]] as const).map(([v, l, sub, Icon]) => (
              <button key={l} onClick={() => setIsPublic(v)} className={cx('rounded-2xl p-3 text-left transition', isPublic === v ? 'bg-primary text-on-primary' : 'bg-raised')}>
                <Icon size={17} /><p className="mt-1 font-bold">{l}</p><p className="text-xs opacity-70">{sub}</p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <input className="field text-center text-xl font-bold uppercase tracking-[0.3em]" value={code} onChange={(e) => setCode(cleanCode(e.target.value))} placeholder="CODE or link" />
      )}
      <button onClick={go} disabled={busy || (mode === 'create' ? !name.trim() : code.length !== 6)} className="btn-primary mt-3 w-full">
        {busy ? <Loader2 size={18} className="animate-spin" /> : mode === 'create' ? <Plus size={18} /> : <Users size={18} />}
        {mode === 'create' ? 'Create group' : 'Join group'}
      </button>
    </div>
  );
}

function GroupView({ group, groups, avatar, onAvatar, onSwitch, onChanged, onEditProfile, onDiscover }: {
  group: Group; groups: Group[]; avatar: string; onAvatar: (a: string) => void; onSwitch: (id: string) => void; onChanged: () => void; onEditProfile: () => void; onDiscover: () => void;
}) {
  const [person, setPerson] = useState<{ id: string; profile: PublicProfile } | null>(null);
  const [tab, setTab] = useState<'feed' | 'chat' | 'members'>('feed');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [people, setPeople] = useState<Member[]>([]);
  const [me, setMe] = useState<string>();
  const [sharing, setSharing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [openPost, setOpenPost] = useState<Post | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, m, uid] = await Promise.all([feed(group.id), loadMembers(group.id), myUserId()]);
      setPosts(p); setPeople(m); setMe(uid);
    } catch (e) {
      toast((e as Error).message);
      setPosts([]);
    }
  }, [group.id]);
  useEffect(() => { void load(); }, [load]);

  async function react(post: Post, emoji: Reaction) {
    if (!me) return;
    haptic();
    const on = !post.reactions.some((r) => r.emoji === emoji && r.user_id === me);
    // Optimistic update so tapping feels instant.
    setPosts((ps) => ps?.map((p) => (p.id !== post.id ? p : { ...p, reactions: on ? [...p.reactions, { emoji, user_id: me }] : p.reactions.filter((r) => !(r.emoji === emoji && r.user_id === me)) })) ?? null);
    try { await toggleReaction(post.id, emoji, on); } catch (e) { toast((e as Error).message); void load(); }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setSwitching(true)} className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-4 font-bold" style={{ boxShadow: 'var(--shadow)' }}>
          <Users size={18} className="text-accent" /> <span className="truncate">{group.name}</span> <ChevronDown size={16} className="ml-auto text-silver" />
        </button>
        <button onClick={() => { haptic(); void load(); }} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Refresh"><RefreshCw size={18} /></button>
        <button onClick={() => setSettings(true)} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Invite friends"><Share2 size={18} /></button>
      </div>

      {/* Members, top streak first */}
      <div className="-mx-5 mb-4 flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
        {people.map((m, i) => (
          <button key={m.user_id} onClick={() => setPerson({ id: m.user_id, profile: m })} className="w-16 shrink-0 text-center">
            <div className="relative mx-auto h-16 w-16">
              <Avatar name={m.display_name} color={m.avatar} photoUrl={m.photoUrl} size={64} />
              {i === 0 && m.streak > 0 && <Crown size={18} className="absolute -top-2 left-1/2 -translate-x-1/2 fill-warn text-warn" />}
              <span className="num absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-surface px-1.5 text-xs font-bold" style={{ boxShadow: 'var(--shadow)' }}><Flame size={11} className="text-accent" />{m.streak}</span>
            </div>
            <p className="mt-2.5 truncate text-xs font-semibold">{m.user_id === me ? 'You' : m.display_name}</p>
          </button>
        ))}
      </div>

      <div className="mb-4"><Segmented full value={tab} onChange={(v) => { haptic(); setTab(v); }} options={[{ value: 'feed', label: 'Feed' }, { value: 'chat', label: 'Chat' }, { value: 'members', label: 'Members' }]} /></div>

      {tab === 'members' ? (
        <div className="card p-2">
          {people.map((m, i) => (
            <button key={m.user_id} onClick={() => setPerson({ id: m.user_id, profile: m })} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left active:bg-raised/60">
              <span className="num w-6 text-center font-bold text-silver">{i + 1}</span>
              <Avatar name={m.display_name} color={m.avatar} photoUrl={m.photoUrl} size={44} />
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{m.user_id === me ? 'You' : m.display_name}</p><p className="truncate text-sm text-silver">{m.username ? `@${m.username}` : ''}{m.role === 'owner' ? ' · owner' : ''}</p></div>
              <span className="num flex items-center gap-1 font-bold"><Flame size={15} className="text-[rgb(var(--carbs))]" />{m.streak}</span>
            </button>
          ))}
          <button onClick={() => setSettings(true)} className="btn-ghost m-2 !h-12 w-[calc(100%-1rem)]"><Share2 size={17} /> Invite friends</button>
        </div>
      ) : tab === 'chat' ? <GroupChat groupId={group.id} me={me} /> : <>
      <button onClick={() => { haptic(); setSharing(true); }} className="btn-primary mb-5 w-full"><Plus size={18} /> New post</button>

      {posts === null ? <Loading /> : posts.length === 0 ? (
        <div className="card p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-raised"><Utensils size={24} /></span>
          <p className="mt-2 font-bold">No posts yet</p>
          <p className="mt-1 text-sm text-silver">Share your first meal — or invite friends with code <b className="text-ink">{group.invite_code}</b>.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => <PostCard key={p.id} post={p} me={me} onAuthor={() => setPerson({ id: p.user_id, profile: p.author! })} onReact={(e) => react(p, e)} onOpen={() => setOpenPost(p)} onDelete={async () => { await deletePost(p); toast('Post deleted'); void load(); }} />)}
        </div>
      )}

      </>}

      <ShareSheet open={sharing} groupId={group.id} onClose={() => setSharing(false)} onShared={() => { setSharing(false); void load(); }} />
      <CommentsSheet post={openPost} onClose={() => { setOpenPost(null); void load(); }} />
      <PersonSheet groupId={group.id} person={person} me={me} onClose={() => setPerson(null)} onEdit={() => { setPerson(null); onEditProfile(); }} />

      <Sheet open={switching} onClose={() => setSwitching(false)} title="Your groups">
        <div className="space-y-2">
          {groups.map((g) => (
            <button key={g.id} onClick={() => { onSwitch(g.id); setSwitching(false); }} className="flex w-full items-center gap-3 rounded-[20px] bg-surface p-4 text-left font-bold" style={{ boxShadow: 'var(--shadow)' }}>
              <Users size={18} className="text-accent" /> <span className="flex-1 truncate">{g.name}</span> {g.id === group.id && <Check size={18} className="text-accent" />}
            </button>
          ))}
        </div>
        <button onClick={() => { setSwitching(false); onDiscover(); }} className="btn-primary mt-4 w-full"><Globe2 size={18} /> Discover, join or create a group</button>
      </Sheet>

      <Sheet open={settings} onClose={() => setSettings(false)} title="Invite friends">
        <p className="text-sm text-silver">Send the invite link — friends tap it, sign in and they’re in. Or they can enter the code.</p>
        <button
          onClick={() => {
            const url = inviteUrl(group.invite_code);
            if ('share' in navigator) void navigator.share({ title: 'Join my Nutivili AI group', text: `Join “${group.name}” on Nutivili AI`, url }).catch(() => undefined);
            else { void (navigator as Navigator).clipboard?.writeText(url); toast('Invite link copied'); }
            haptic();
          }}
          className="btn-primary mt-4 w-full"
        >
          <Share2 size={18} /> Share invite link
        </button>
        <button onClick={() => { void navigator.clipboard?.writeText(inviteUrl(group.invite_code)); haptic(); toast('Invite link copied'); }} className="btn-ghost mt-2 w-full"><Link2 size={17} /> Copy link</button>
        <button onClick={() => { void navigator.clipboard?.writeText(group.invite_code); haptic(); toast('Code copied'); }} className="card mt-3 flex w-full items-center justify-center gap-3 p-4">
          <span className="text-sm font-semibold text-silver">Code</span><span className="num text-[28px] font-extrabold tracking-[0.25em]">{group.invite_code}</span><Copy size={18} className="text-silver" />
        </button>
        <button onClick={() => { setSettings(false); onEditProfile(); }} className="btn-ghost mt-6 w-full"><UserRound size={18} /> Edit my profile</button>
        <p className="mb-2 mt-6 text-sm font-semibold text-silver">Colour (when you have no photo)</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(AVATAR_COLORS).map((c) => (
            <button key={c} onClick={() => onAvatar(c)} className={cx('grid h-12 w-12 place-items-center rounded-full', AVATAR_COLORS[c], c === avatar && 'ring-4 ring-accent/40')} aria-label={c}>
              {c === avatar && <Check size={18} className="text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Group mates see your first name (from Profile), your colour and streak — nothing else.</p>
        <button onClick={async () => { await leaveGroup(group.id); toast(`You left “${group.name}”`); setSettings(false); onChanged(); }} className="btn-ghost mt-6 w-full text-danger"><LogOut size={18} /> Leave group</button>
      </Sheet>
    </>
  );
}

function PostCard({ post, me, onReact, onOpen, onDelete, onAuthor }: { post: Post; me?: string; onReact: (e: Reaction) => void; onOpen: () => void; onDelete: () => void; onAuthor?: () => void }) {
  const [picker, setPicker] = useState(false);
  const counts = useMemo(() => REACTIONS.map((e) => ({ e, n: post.reactions.filter((r) => r.emoji === e).length, mine: post.reactions.some((r) => r.emoji === e && r.user_id === me) })), [post.reactions, me]);
  const used = counts.filter((c) => c.n > 0);
  const total = post.reactions.length;
  const when = new Date(post.created_at);
  const stamp = Date.now() - when.getTime() < 86400e3 ? `Today at ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : `${ago(post.created_at)} ago`;
  return (
    <article className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button onClick={onAuthor} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar name={post.author?.display_name ?? 'Member'} color={post.author?.avatar} photoUrl={post.author?.photoUrl} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{post.author?.display_name}</p>
            <p className="text-xs text-silver">{stamp}</p>
          </div>
        </button>
        {post.user_id === me && <button onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-full text-dim" aria-label="Delete post"><Trash2 size={16} /></button>}
      </div>
      <p className="mt-3 px-4 text-[17px] font-semibold leading-snug">{post.title}</p>
      {post.caption && <p className="mt-1 px-4 text-[15px] text-silver">{post.caption}</p>}
      {post.photoUrl && <img src={post.photoUrl} alt={post.title} className="mx-4 mt-3 aspect-[4/3] w-[calc(100%-2rem)] rounded-[18px] object-cover" loading="lazy" />}
      {post.recipe && <SharedRecipeCard recipe={post.recipe} />}
      {post.kcal != null && (
        <div className="num mt-3 grid grid-cols-4 gap-2 px-4">
          {([['Calories', post.kcal, '', Flame, 'text-ink'], ['Protein', post.protein, 'g', Drumstick, 'text-accent'], ['Carbs', post.carbs, 'g', Wheat, 'text-[rgb(var(--carbs))]'], ['Fats', post.fat, 'g', Droplet, 'text-[rgb(var(--fat))]']] as const).map(([l, v, u, Icon, c]) => (
            <div key={l}>
              <p className={cx('flex items-center gap-1 text-xs font-semibold', c)}><Icon size={12} />{l}</p>
              <p className="text-[17px] font-bold">{v == null ? '—' : `${fmt(Number(v))}${u}`}</p>
            </div>
          ))}
        </div>
      )}
      {(total > 0 || post.commentCount > 0) && (
        <div className="mt-3 flex items-center gap-2 px-4">
          {used.map(({ e, n, mine }) => {
            const Icon = REACTION_ICON[e];
            return (
              <button key={e} onClick={() => onReact(e)} className={cx('flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-bold', mine ? 'border-ink bg-ink text-on-primary' : 'border-line')}>
                <Icon size={13} /> {n}
              </button>
            );
          })}
          {post.commentCount > 0 && <button onClick={onOpen} className="ml-auto flex items-center gap-1 text-xs font-semibold text-silver"><MessageCircle size={13} /> {post.commentCount}</button>}
        </div>
      )}
      {!!post.latestComments?.length && (
        <button onClick={onOpen} className="mt-3 block w-full space-y-1.5 px-4 text-left">
          {post.latestComments.map((c) => (
            <p key={c.id} className="line-clamp-2 text-sm"><b className="font-semibold">{c.author?.display_name}</b> <span className="text-ink/80">{c.body}</span></p>
          ))}
          {post.commentCount > 2 && <p className="text-sm font-medium text-silver">View all {post.commentCount} comments</p>}
        </button>
      )}
      {picker && (
        <div className="mx-4 mt-3 flex justify-around rounded-full bg-raised p-1.5">
          {counts.map(({ e, mine }) => {
            const Icon = REACTION_ICON[e];
            return (
              <button key={e} onClick={() => { onReact(e); setPicker(false); }} aria-label={REACTION_LABEL[e]} className={cx('grid h-10 w-10 place-items-center rounded-full transition active:scale-90', mine ? 'bg-ink text-on-primary' : 'text-ink')}>
                <Icon size={19} />
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 border-t border-line">
        <button onClick={() => { haptic(); setPicker((v) => !v); }} className="flex h-12 items-center justify-center gap-2 text-sm font-semibold text-silver"><SmilePlus size={17} /> React</button>
        <button onClick={onOpen} className="flex h-12 items-center justify-center gap-2 border-l border-line text-sm font-semibold text-silver"><MessageCircle size={17} /> Comment</button>
      </div>
    </article>
  );
}

function ShareSheet({ open, groupId, onClose, onShared, initialTitle = '', initialText = '' }: { open: boolean; groupId: string; onClose: () => void; onShared: () => void; initialTitle?: string; initialText?: string }) {
  const { entries } = useDay(todayKey());
  const meals = MEAL_ORDER.filter((m) => entries.some((e) => e.meal === m));
  const [meal, setMeal] = useState<Meal | 'none'>('none');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [needTitle, setNeedTitle] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const customFoods = useStore((s) => s.customFoods);
  const myRecipes = useMemo(() => customFoods.filter((c) => c.recipe && !c.archived), [customFoods]);
  const [recipeId, setRecipeId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  // A ready-made post (e.g. "Just joined Pro"), still editable before posting.
  useEffect(() => {
    if (!open) return;
    if (initialTitle) setTitle((t) => t || initialTitle);
    if (initialText) setText((t) => t || initialText);
  }, [open, initialTitle, initialText]);
  const items = meal === 'none' ? [] : entries.filter((e) => e.meal === meal);
  const t = sumEntries(items);

  async function pick(f?: File) {
    if (!f) return;
    const blob = await resizeImage(f, 1080);
    setPhoto((p) => { if (p) URL.revokeObjectURL(p.url); return { blob, url: URL.createObjectURL(blob) }; });
  }

  async function share() {
    const heading = title.trim();
    // Every post needs a title, so the feed is easy to scan.
    if (!heading) { setNeedTitle(true); haptic(); titleRef.current?.focus(); return; }
    setBusy(true);
    try {
      let img = photo?.blob;
      if (!img && items.length) {
        const id = items.find((e) => e.photoId)?.photoId;
        const b = id ? await getPhoto(id) : undefined;
        if (b) img = await resizeImage(b, 1080);
      }
      const caption = text.trim();
      const rec = myRecipes.find((c) => c.id === recipeId);
      await sharePost({ groupId, title: heading.slice(0, 120), caption, meal: items.length ? feedMeal(meal as Meal) : undefined, ...(items.length ? { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat } : {}), photo: img, ...(rec ? { recipe: toShared(rec) ?? undefined } : {}) });
      haptic([10, 30, 10]);
      toast('Posted');
      setText(''); setTitle(''); setNeedTitle(false); setMeal('none'); setPhoto(null); setRecipeId('');
      onShared();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canPost = !!title.trim() || !!text.trim() || items.length > 0 || !!photo || !!recipeId;
  return (
    <Sheet open={open} onClose={onClose} title="New post">
      <input ref={titleRef} value={title} onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setNeedTitle(false); }} maxLength={120} aria-label="Title" placeholder="Title (e.g. Post-gym dinner)" className={cx('field text-[16px] font-semibold', needTitle && '!ring-2 !ring-danger')} />
      {needTitle && <p className="mt-1.5 px-1 text-sm font-semibold text-danger" role="alert">Add a title before posting.</p>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600} rows={3} placeholder="What’s on your plate? Share a win, a meal or a tip…" className="field mt-3 !h-auto resize-none py-3 text-[16px]" />
      {photo ? (
        <div className="relative mt-3 overflow-hidden rounded-[22px]">
          <img src={photo.url} alt="" className="aspect-[4/3] w-full object-cover" />
          <button onClick={() => setPhoto(null)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove photo"><X size={16} /></button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-line font-bold text-silver"><ImagePlus size={19} /> Add a photo</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {myRecipes.length > 0 && (
        <>
          <p className="label mt-5">Share one of your recipes</p>
          <div className="flex flex-wrap gap-2">
            {[{ id: '', name: 'No recipe' }, ...myRecipes].map((r) => (
              <button key={r.id || 'none'} onClick={() => { setRecipeId(r.id); if (r.id && !title.trim()) setTitle(r.name); }} className={cx('chip !h-10', recipeId === r.id && 'chip-on')}>{r.name}</button>
            ))}
          </div>
        </>
      )}
      <p className="label mt-5">Attach a meal from today</p>
      <div className="flex flex-wrap gap-2">
        {(['none', ...meals] as (Meal | 'none')[]).map((m) => (
          <button key={m} onClick={() => { setMeal(m); if (m !== 'none' && !title.trim()) { const list = entries.filter((e) => e.meal === m).map((e) => splitName(e.food.name).title); setTitle(list.slice(0, 3).join(', ') + (list.length > 3 ? ` + ${list.length - 3} more` : '')); setNeedTitle(false); } }} className={cx('chip !h-10', meal === m && 'chip-on')}>{m === 'none' ? 'No meal' : MEAL_LABEL[m]}</button>
        ))}
      </div>
      {items.length > 0 && (
        <div className="card mt-3 p-2">
          {items.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-2">
              <FoodVisual name={e.food.name} photoId={e.photoId} size={40} />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{splitName(e.food.name).title}</p>
              <span className="num text-sm text-silver">{fmt(e.grams)} g</span>
            </div>
          ))}
          <p className="num px-2 pb-1 text-sm text-silver">{fmt(t.kcal)} kcal · {fmt(t.protein)} g protein · {fmt(t.carbs)} g carbs · {fmt(t.fat)} g fat</p>
        </div>
      )}
      <button onClick={share} disabled={busy || !canPost} className="btn-primary mt-5 w-full">{busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Post</button>
    </Sheet>
  );
}

/** Set up or edit your public profile: photo, name and @username. */
function ProfileEditor({ initial, defaultName, onSaved, onCancel }: { initial: MyProfile | null; defaultName: string; onSaved: () => void; onCancel?: () => void }) {
  const localPhotoId = useStore((s) => s.profile?.photoId);
  const startName = initial?.display_name && initial.display_name !== 'Member' ? initial.display_name : defaultName;
  const [name, setName] = useState(startName);
  // Suggest a username from their name so setup is one tap (they can change it).
  const [username, setUsername] = useState(initial?.username ?? (startName ? `${startName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'user'}${Math.floor(100 + Math.random() * 900)}` : ''));
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl);
  const [newPhoto, setNewPhoto] = useState<Blob | null>(null);
  // Use the photo they already added in Profile, if any.
  useEffect(() => {
    if (initial?.photoUrl || !localPhotoId) return;
    void getPhoto(localPhotoId).then((b) => { if (b) { setNewPhoto(b); setPhotoUrl(URL.createObjectURL(b)); } });
  }, [initial?.photoUrl, localPhotoId]);
  const [free, setFree] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const valid = /^[a-z0-9_]{3,20}$/.test(username);

  useEffect(() => {
    if (!valid || username === initial?.username) { setFree(null); return; }
    const t = setTimeout(() => { usernameAvailable(username).then(setFree, () => setFree(null)); }, 400);
    return () => clearTimeout(t);
  }, [username, valid, initial?.username]);

  async function save() {
    setBusy(true);
    try {
      await upsertMyProfile({ display_name: name.trim().slice(0, 40) || 'Member', username });
      if (newPhoto) await uploadAvatar(newPhoto);
      haptic([10, 30, 10]);
      toast('Profile saved');
      onSaved();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <p className="text-[20px] font-extrabold">{initial?.username ? 'Edit profile' : 'Choose your username'}</p>
      <p className="mt-1 text-sm text-silver">{initial?.username ? 'This is how others see you.' : 'We filled this in from your profile — change anything, then tap Save.'}</p>
      <button onClick={() => fileRef.current?.click()} className="relative mx-auto mt-5 block">
        <Avatar name={name || 'You'} photoUrl={photoUrl} size={104} />
        <span className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-primary text-on-primary ring-4 ring-surface"><ImagePlus size={16} /></span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        const sq = await cropSquare(f);
        setNewPhoto(sq); setPhotoUrl(URL.createObjectURL(sq));
      }} />
      <label className="label mt-5" htmlFor="pe-name">Name</label>
      <input id="pe-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name" />
      <label className="label mt-4" htmlFor="pe-user">Username</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-silver">@</span>
        <input id="pe-user" className="field pl-9" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} placeholder="yourname" autoCapitalize="none" />
      </div>
      <p className={cx('mt-1.5 text-sm', !username ? 'text-silver' : !valid ? 'text-danger' : free === false ? 'text-danger' : 'text-accent')}>
        {!username ? '3–20 letters, numbers or _' : !valid ? 'At least 3 characters: letters, numbers or _' : free === false ? 'That username is taken' : free ? 'Available' : ' '}
      </p>
      <button onClick={save} disabled={busy || !valid || free === false || !name.trim()} className="btn-primary mt-5 w-full">{busy ? <Loader2 size={18} className="animate-spin" /> : 'Save profile'}</button>
      {onCancel && <button onClick={onCancel} className="mt-2 h-12 w-full font-bold text-silver">Cancel</button>}
    </div>
  );
}

/** A person's profile within this group: photo, name, streak and their posts. */
function PersonSheet({ groupId, person, me, onClose, onEdit }: { groupId: string; person: { id: string; profile: PublicProfile } | null; me?: string; onClose: () => void; onEdit: () => void }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  useEffect(() => {
    if (!person) return;
    setPosts(null);
    feed(groupId, 30, person.id).then(setPosts, () => setPosts([]));
  }, [person, groupId]);
  const p = person?.profile;
  return (
    <Sheet open={!!person} onClose={onClose} title={p?.username ? `@${p.username}` : 'Profile'}>
      {p && (
        <>
          <div className="flex flex-col items-center text-center">
            <Avatar name={p.display_name} color={p.avatar} photoUrl={p.photoUrl} size={96} />
            <p className="mt-3 text-[20px] font-extrabold">{p.display_name}</p>
            <div className="num mt-3 grid w-full grid-cols-2 gap-2">
              <div className="rounded-2xl bg-raised p-3"><p className="text-[22px] font-extrabold">{p.streak}</p><p className="text-sm text-silver">Day streak</p></div>
              <div className="rounded-2xl bg-raised p-3"><p className="text-[22px] font-extrabold">{posts?.length ?? '–'}</p><p className="text-sm text-silver">Posts</p></div>
            </div>
            {person?.id === me && <button onClick={onEdit} className="btn-ghost mt-3 w-full"><UserRound size={17} /> Edit profile</button>}
            {person && person.id !== me && <Link to={`/messages?with=${person.id}`} className="btn-primary mt-3 w-full"><MessageCircle size={17} /> Message</Link>}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-1.5">
            {(posts ?? []).map((x) => (
              <div key={x.id} className="relative aspect-square overflow-hidden rounded-xl bg-raised">
                {x.photoUrl ? <img src={x.photoUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-2 text-center text-xs font-semibold">{x.title}</div>}
              </div>
            ))}
          </div>
          {posts?.length === 0 && <p className="mt-2 text-center text-sm text-silver">No posts in this group yet.</p>}
        </>
      )}
    </Sheet>
  );
}

function CommentsSheet({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!post) return;
    setList(null);
    loadComments(post.id).then(setList, (e: Error) => { toast(e.message); setList([]); });
  }, [post]);
  async function send() {
    if (!post || !text.trim()) return;
    setBusy(true);
    try { await addComment(post.id, text); setText(''); haptic(); setList(await loadComments(post.id)); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <Sheet open={!!post} onClose={onClose} title="Comments">
      {list === null ? <Loading /> : list.length === 0 ? <p className="text-sm text-silver">No comments yet. Be the first!</p> : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author?.display_name ?? 'Member'} color={c.author?.avatar} photoUrl={c.author?.photoUrl} size={36} />
              <div className="min-w-0 rounded-[18px] bg-surface px-3.5 py-2.5" style={{ boxShadow: 'var(--shadow)' }}>
                <p className="text-sm font-bold">{c.author?.username ? `@${c.author.username}` : c.author?.display_name} <span className="font-medium text-dim">· {ago(c.created_at)}</span></p>
                <p className="text-sm">{c.body}</p>
              </div>
              <button onClick={() => setText(`@${c.author?.username ?? c.author?.display_name ?? ''} `)} className="ml-1 self-end pb-1 text-xs font-semibold text-silver" aria-label="Reply"><Reply size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} maxLength={500} placeholder="Add a comment…" className="field flex-1" />
        <button onClick={send} disabled={busy || !text.trim()} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-on-primary disabled:opacity-40" aria-label="Send"><Send size={18} /></button>
      </div>
    </Sheet>
  );
}

/** Community feed: everyone's journey posts in one place (Cal AI-style). */
export function CommunityFeedPage() {
  const session = useSession();
  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-safe pb-4">
        <h1 className="text-[30px] font-extrabold tracking-tight">Feed</h1>
        <p className="text-sm text-silver">Real journeys from the Nutivili AI community</p>
      </header>
      {!accountsEnabled ? <FeedPreview note="The feed will open once accounts are switched on for this app." />
        : session === undefined ? <Loading />
        : !session ? <FeedPreview signIn />
        : <CommunityFeed />}
    </div>
  );
}

function FeedPreview({ signIn, note }: { signIn?: boolean; note?: string }) {
  return (
    <>
      <div className="card p-6">
        <p className="text-[22px] font-extrabold leading-tight">Share your journey</p>
        <p className="mt-1 text-[15px] text-silver">Post meals, progress and wins. Cheer others on — people who share stick with it.</p>
        {signIn ? <div className="mt-5"><SignInButtons /></div> : <p className="mt-5 rounded-2xl bg-raised p-4 text-sm text-silver">{note}</p>}
      </div>
      <p className="mb-3 mt-6 px-1 text-sm font-semibold text-silver">Example posts</p>
      <div className="space-y-4">
        {EXAMPLES.map((p) => <PostCard key={p.id} post={p} onReact={() => toast('Sign in to react and comment')} onOpen={() => toast('Sign in to react and comment')} onDelete={() => undefined} />)}
      </div>
    </>
  );
}

function CommunityFeed() {
  const profile = useStore((s) => s.profile);
  const streak = useStreak();
  const [mine, setMine] = useState<MyProfile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [me, setMe] = useState<string>();
  const [sharing, setSharing] = useState(false);
  const [params, setParams] = useSearchParams();
  // /feed?post=Title&text=… opens a new post with that filled in (used after subscribing).
  const [draft] = useState(() => ({ title: params.get('post') ?? '', text: params.get('text') ?? '' }));
  useEffect(() => {
    if (!draft.title || !mine?.username) return;
    setSharing(true);
    setParams({}, { replace: true });
  }, [draft.title, mine?.username, setParams]);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [person, setPerson] = useState<{ id: string; profile: PublicProfile } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, uid] = await Promise.all([feed(COMMUNITY_ID, 50), myUserId()]);
      setPosts(p); setMe(uid);
    } catch (e) { setError((e as Error).message); setPosts([]); }
  }, []);

  useEffect(() => { myProfile().then(setMine, (e: Error) => { setError(e.message); setMine(null); }); }, []);
  useEffect(() => {
    if (!mine?.username) return;
    joinCommunity().then(load, (e: Error) => { setError(e.message); setPosts([]); });
    void upsertMyProfile({ streak }).catch(() => undefined);
  }, [mine, load, streak]);

  async function react(post: Post, emoji: Reaction) {
    if (!me) return;
    haptic();
    const on = !post.reactions.some((r) => r.emoji === emoji && r.user_id === me);
    setPosts((ps) => ps?.map((p) => (p.id !== post.id ? p : { ...p, reactions: on ? [...p.reactions, { emoji, user_id: me }] : p.reactions.filter((r) => !(r.emoji === emoji && r.user_id === me)) })) ?? null);
    try { await toggleReaction(post.id, emoji, on); } catch (e) { toast((e as Error).message); void load(); }
  }

  if (error && (error.includes('relation') || error.includes('function') || error.includes('schema'))) {
    return <p className="card p-5 text-sm text-danger">The feed isn’t set up on the server yet (run supabase/social.sql in Supabase).</p>;
  }
  if (mine === undefined) return <Loading />;
  if (!mine?.username || editing) {
    return <ProfileEditor initial={mine} defaultName={profile?.name ?? ''} onSaved={async () => { setMine(await myProfile()); setEditing(false); }} onCancel={mine?.username ? () => setEditing(false) : undefined} />;
  }

  return (
    <>
      <Link to="/messages" className="mb-3 flex items-center justify-end gap-1.5 text-sm font-semibold text-accent"><MessageCircle size={16} /> Messages</Link>
      <button onClick={() => { haptic(); setSharing(true); }} className="card mb-5 flex w-full items-center gap-3 p-3 text-left">
        <Avatar name={mine.display_name} color={mine.avatar} photoUrl={mine.photoUrl} size={44} />
        <span className="flex-1 text-[15px] text-dim">Share a meal, a win or your progress…</span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-on-primary"><Plus size={18} /></span>
      </button>
      <GroupsStrip />
      {posts === null ? <Loading /> : posts.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-bold">Be the first to post</p>
          <p className="mt-1 text-sm text-silver">Share today’s meal or where you’re starting from.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => <PostCard key={p.id} post={p} me={me} onAuthor={() => setPerson({ id: p.user_id, profile: p.author! })} onReact={(e) => react(p, e)} onOpen={() => setOpenPost(p)} onDelete={async () => { await deletePost(p); toast('Post deleted'); void load(); }} />)}
        </div>
      )}
      <ShareSheet open={sharing} groupId={COMMUNITY_ID} initialTitle={draft.title} initialText={draft.text} onClose={() => setSharing(false)} onShared={() => { setSharing(false); void load(); }} />
      <CommentsSheet post={openPost} onClose={() => { setOpenPost(null); void load(); }} />
      <PersonSheet groupId={COMMUNITY_ID} person={person} me={me} onClose={() => setPerson(null)} onEdit={() => { setPerson(null); setEditing(true); }} />
    </>
  );
}

/** On the Feed: your groups as bubbles, plus "New group" and "Find groups". */
function GroupsStrip() {
  const nav = useNavigate();
  const [list, setList] = useState<Group[] | null>(null);
  useEffect(() => { myGroups().then((g) => setList(g.filter((x) => x.id !== COMMUNITY_ID)), () => setList([])); }, []);
  const open = (id: string) => { try { localStorage.setItem(GROUP_KEY, id); } catch { /* ignore */ } haptic(); nav('/groups'); };
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <p className="text-[17px] font-bold">Your groups</p>
        <button onClick={() => { haptic(); nav('/groups?new=1'); }} className="text-sm font-semibold text-accent">Find groups</button>
      </div>
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
        <button onClick={() => { haptic(); nav('/groups?new=create'); }} className="w-20 shrink-0 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-line text-silver"><Plus size={22} /></span>
          <span className="mt-1.5 block text-xs font-bold">New group</span>
        </button>
        {(list ?? []).map((g, i) => (
          <button key={g.id} onClick={() => open(g.id)} className="w-20 shrink-0 text-center">
            <Avatar name={g.name} color={Object.keys(AVATAR_COLORS)[i % Object.keys(AVATAR_COLORS).length]} size={64} className="mx-auto" />
            <span className="mt-1.5 block truncate text-xs font-bold">{g.name}</span>
          </button>
        ))}
        {list && list.length === 0 && (
          <div className="flex min-w-[200px] items-center rounded-[20px] bg-surface px-4 text-sm text-silver" style={{ boxShadow: 'var(--shadow)' }}>
            Make a private group with friends, or join one.
          </div>
        )}
      </div>
    </section>
  );
}
