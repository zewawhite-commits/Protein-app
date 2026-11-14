import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Crown, Dumbbell, Flame, Heart, Loader2, LogOut, MessageCircle, Plus, RefreshCw, Send, Share2, Sparkles, ThumbsUp, Trash2, UserRound, Users, Utensils, ImagePlus, X } from 'lucide-react';
import { AVATAR_COLORS, Avatar } from '@/components/Avatar';
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
  myGroups, myProfile, myUserId, sharePost, toggleReaction, uploadAvatar, upsertMyProfile, usernameAvailable,
  type Comment, type Group, type Member, type MyProfile, type Post, type PublicProfile, type Reaction,
} from '@/lib/social';
import { SignInButtons } from '@/components/SignIn';
import { FoodVisual } from '@/components/FoodIcon';
import { Segmented, Sheet, cx, fmt } from '@/components/ui';
import { haptic, toast } from '@/components/fx';
import { useStreak } from './Today';

const GROUP_KEY = 'provora-group';
const REACTION_ICON: Record<Reaction, typeof Flame> = { '🔥': Flame, '💪': Dumbbell, '👏': ThumbsUp, '😋': Sparkles, '❤️': Heart };
const REACTION_LABEL: Record<Reaction, string> = { '🔥': 'Fire', '💪': 'Strong', '👏': 'Nice', '😋': 'Tasty', '❤️': 'Love' };
const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

export default function Groups() {
  const session = useSession();
  if (!accountsEnabled) {
    return (
      <Shell>
        <Intro />
        <p className="card mt-4 p-5 text-sm text-silver">Groups need accounts, which aren’t switched on for this app yet.</p>
      </Shell>
    );
  }
  if (session === undefined) return <Shell><Loading /></Shell>;
  if (!session) {
    return (
      <Shell>
        <Intro />
        <div className="card mt-4 p-5">
          <p className="text-[17px] font-bold">Sign in to join groups</p>
          <p className="mb-4 mt-1 text-sm text-silver">Share meals with friends, cheer each other on and keep your streaks going together.</p>
          <SignInButtons />
        </div>
      </Shell>
    );
  }
  return <Shell><Signed /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-up pb-6">
      <header className="pt-safe pb-4">
        <h1 className="text-[30px] font-extrabold tracking-tight">Groups</h1>
      </header>
      {children}
    </div>
  );
}

function Intro() {
  return (
    <div className="card overflow-hidden p-5">
      <div className="flex -space-x-2">{['Ava Moore', 'Ben Cole', 'Kemi Ade', 'Leo Park'].map((n, i) => <Avatar key={n} name={n} color={Object.keys(AVATAR_COLORS)[i]} size={52} className="ring-4 ring-surface" />)}</div>
      <p className="mt-4 text-[20px] font-extrabold leading-snug">Grow with friends</p>
      <p className="mt-1 text-sm text-silver">Create a private group, invite friends with a code, post your meals and react to theirs.</p>
    </div>
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

  const reload = useCallback(async () => {
    try {
      const list = await myGroups();
      setGroups(list);
      setActive((a) => (a && list.some((g) => g.id === a) ? a : list[0]?.id ?? null));
    } catch (e) {
      setError((e as Error).message);
      setGroups([]);
    }
  }, []);

  const [mine, setMine] = useState<MyProfile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  useEffect(() => { void reload(); myProfile().then(setMine, () => setMine(null)); }, [reload]);
  // Keep the streak and colour up to date for group mates (name and username are set in the profile editor).
  useEffect(() => {
    if (!mine) return;
    void upsertMyProfile({ avatar, streak }).catch(() => undefined);
  }, [mine, avatar, streak]);
  useEffect(() => { try { if (active) localStorage.setItem(GROUP_KEY, active); } catch { /* ignore */ } }, [active]);

  if (groups === null || mine === undefined) return <Loading />;
  if (!mine?.username || editing) {
    return (
      <ProfileEditor
        initial={mine}
        defaultName={profile?.name ?? ''}
        onSaved={async () => { setMine(await myProfile()); setEditing(false); }}
        onCancel={mine?.username ? () => setEditing(false) : undefined}
      />
    );
  }
  if (error && !groups.length) return <p className="card p-5 text-sm text-danger">{error.includes('relation') || error.includes('function') ? 'Groups aren’t set up on the server yet (run supabase/social.sql).' : error}</p>;
  const group = groups.find((g) => g.id === active);

  return (
    <>
      {!groups.length || !group ? (
        <>
          <Intro />
          <CreateOrJoin onDone={(g) => { setActive(g.id); void reload(); }} />
        </>
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
        />
      )}
    </>
  );
}

function CreateOrJoin({ onDone }: { onDone: (g: Group) => void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const g = mode === 'create' ? await createGroup(name) : await joinGroup(code);
      haptic([10, 30, 10]);
      toast(mode === 'create' ? `“${g.name}” created — invite friends with code ${g.invite_code}` : `You joined “${g.name}”`);
      onDone(g);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card mt-4 p-5">
      <Segmented full value={mode} onChange={setMode} options={[{ value: 'create', label: 'Create a group' }, { value: 'join', label: 'Join with code' }]} />
      {mode === 'create' ? (
        <input className="field mt-4" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Group name, e.g. Shred Squad" />
      ) : (
        <input className="field mt-4 text-center text-xl font-bold uppercase tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={6} placeholder="ABC123" />
      )}
      <button onClick={go} disabled={busy || (mode === 'create' ? !name.trim() : code.length !== 6)} className="btn-primary mt-3 w-full">
        {busy ? <Loader2 size={18} className="animate-spin" /> : mode === 'create' ? <Plus size={18} /> : <Users size={18} />}
        {mode === 'create' ? 'Create group' : 'Join group'}
      </button>
    </div>
  );
}

function GroupView({ group, groups, avatar, onAvatar, onSwitch, onChanged, onEditProfile }: {
  group: Group; groups: Group[]; avatar: string; onAvatar: (a: string) => void; onSwitch: (id: string) => void; onChanged: () => void; onEditProfile: () => void;
}) {
  const [person, setPerson] = useState<{ id: string; profile: PublicProfile } | null>(null);
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
        <p className="mb-2 mt-6 text-sm font-semibold text-silver">Create or join another</p>
        <CreateOrJoin onDone={(g) => { setSwitching(false); onSwitch(g.id); onChanged(); }} />
      </Sheet>

      <Sheet open={settings} onClose={() => setSettings(false)} title="Invite friends">
        <p className="text-sm text-silver">Share this code. Friends open Provora → Groups → Join with code.</p>
        <button onClick={() => { void navigator.clipboard?.writeText(group.invite_code); haptic(); toast('Code copied'); }} className="card mt-3 flex w-full items-center justify-center gap-3 p-5">
          <span className="num text-[34px] font-extrabold tracking-[0.25em]">{group.invite_code}</span><Copy size={20} className="text-silver" />
        </button>
        {'share' in navigator && (
          <button onClick={() => void navigator.share({ title: 'Join my Provora group', text: `Join “${group.name}” on Provora with code ${group.invite_code}`, url: location.origin }).catch(() => undefined)} className="btn-ghost mt-3 w-full"><Share2 size={18} /> Share invite</button>
        )}
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
  const counts = useMemo(() => REACTIONS.map((e) => ({ e, n: post.reactions.filter((r) => r.emoji === e).length, mine: post.reactions.some((r) => r.emoji === e && r.user_id === me) })), [post.reactions, me]);
  return (
    <article className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        <button onClick={onAuthor} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar name={post.author?.display_name ?? 'Member'} color={post.author?.avatar} photoUrl={post.author?.photoUrl} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{post.author?.display_name}{post.author?.username && <span className="font-medium text-silver"> @{post.author.username}</span>}</p>
            <p className="text-xs text-silver">{post.meal ? `${MEAL_LABEL[post.meal as Meal]} · ` : ''}{ago(post.created_at)} ago</p>
          </div>
        </button>
        {post.user_id === me && <button onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-full text-dim" aria-label="Delete post"><Trash2 size={16} /></button>}
      </div>
      <div className="flex items-center gap-3 px-4">
        {!post.photoUrl && post.kcal != null && <FoodVisual name={post.title} size={48} />}
        <p className="min-w-0 flex-1 text-[17px] font-bold leading-snug">{post.title}</p>
      </div>
      {post.caption && <p className="mt-1 px-4 text-sm text-silver">{post.caption}</p>}
      {post.photoUrl && <img src={post.photoUrl} alt={post.title} className="mt-3 aspect-[4/3] w-full object-cover" loading="lazy" />}
      {post.kcal != null && <div className="num grid grid-cols-4 gap-2 px-4 pt-3 text-center">
        {([['Calories', post.kcal, ''], ['Protein', post.protein, 'g'], ['Carbs', post.carbs, 'g'], ['Fat', post.fat, 'g']] as const).map(([l, v, u]) => (
          <div key={l} className="rounded-2xl bg-raised py-2">
            <p className="text-[15px] font-bold">{v == null ? '—' : `${fmt(Number(v))}${u}`}</p>
            <p className="text-xs text-silver">{l}</p>
          </div>
        ))}
      </div>}
      <div className="flex items-center gap-1.5 overflow-x-auto p-3 no-scrollbar">
        {counts.map(({ e, n, mine }) => {
          const Icon = REACTION_ICON[e];
          return (
            <button key={e} onClick={() => onReact(e)} aria-label={REACTION_LABEL[e]} aria-pressed={mine} className={cx('flex h-9 shrink-0 items-center gap-1 rounded-full px-3 transition active:scale-90', mine ? 'bg-accent text-white' : 'bg-raised text-ink/70')}>
              <Icon size={16} strokeWidth={2.4} fill={mine && (e === '❤️' || e === '🔥') ? 'currentColor' : 'none'} />{n > 0 && <span className="num text-xs font-bold">{n}</span>}
            </button>
          );
        })}
        <button onClick={onOpen} className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-raised px-3 text-sm font-semibold"><MessageCircle size={15} /> {post.commentCount || 'Comment'}</button>
      </div>
    </article>
  );
}

function ShareSheet({ open, groupId, onClose, onShared }: { open: boolean; groupId: string; onClose: () => void; onShared: () => void }) {
  const { entries } = useDay(todayKey());
  const meals = (['breakfast', 'lunch', 'dinner', 'snack'] as Meal[]).filter((m) => entries.some((e) => e.meal === m));
  const [meal, setMeal] = useState<Meal | 'none'>('none');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const items = meal === 'none' ? [] : entries.filter((e) => e.meal === meal);
  const t = sumEntries(items);
  const mealTitle = items.map((e) => splitName(e.food.name).title).slice(0, 3).join(', ') + (items.length > 3 ? ` + ${items.length - 3} more` : '');

  async function pick(f?: File) {
    if (!f) return;
    const blob = await resizeImage(f, 1080);
    setPhoto((p) => { if (p) URL.revokeObjectURL(p.url); return { blob, url: URL.createObjectURL(blob) }; });
  }

  async function share() {
    setBusy(true);
    try {
      let img = photo?.blob;
      if (!img && items.length) {
        const id = items.find((e) => e.photoId)?.photoId;
        const b = id ? await getPhoto(id) : undefined;
        if (b) img = await resizeImage(b, 1080);
      }
      const words = text.trim();
      const title = items.length ? mealTitle : words.split('\n')[0].slice(0, 120);
      const caption = items.length ? words : words.slice(title.length).trim();
      await sharePost({ groupId, title, caption, meal: items.length ? (meal as Meal) : undefined, ...(items.length ? { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat } : {}), photo: img });
      haptic([10, 30, 10]);
      toast('Posted');
      setText(''); setMeal('none'); setPhoto(null);
      onShared();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canPost = !!text.trim() || items.length > 0 || !!photo;
  return (
    <Sheet open={open} onClose={onClose} title="New post">
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600} rows={3} placeholder="What’s on your plate? Share a win, a meal or a tip…" className="field !h-auto resize-none py-3 text-[16px]" />
      {photo ? (
        <div className="relative mt-3 overflow-hidden rounded-[22px]">
          <img src={photo.url} alt="" className="aspect-[4/3] w-full object-cover" />
          <button onClick={() => setPhoto(null)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove photo"><X size={16} /></button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-line font-bold text-silver"><ImagePlus size={19} /> Add a photo</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      <p className="label mt-5">Attach a meal from today</p>
      <div className="flex flex-wrap gap-2">
        {(['none', ...meals] as (Meal | 'none')[]).map((m) => (
          <button key={m} onClick={() => setMeal(m)} className={cx('chip !h-10', meal === m && 'chip-on')}>{m === 'none' ? 'No meal' : MEAL_LABEL[m]}</button>
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
      <button onClick={share} disabled={busy || !canPost} className="btn-primary mt-5 w-full">{busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Post to group</button>
    </Sheet>
  );
}

/** Set up or edit your public profile: photo, name and @username. */
function ProfileEditor({ initial, defaultName, onSaved, onCancel }: { initial: MyProfile | null; defaultName: string; onSaved: () => void; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.display_name && initial.display_name !== 'Member' ? initial.display_name : defaultName);
  const [username, setUsername] = useState(initial?.username ?? '');
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl);
  const [newPhoto, setNewPhoto] = useState<Blob | null>(null);
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
      <p className="text-[20px] font-extrabold">{initial?.username ? 'Edit profile' : 'Set up your profile'}</p>
      <p className="mt-1 text-sm text-silver">This is how friends see you in groups.</p>
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
