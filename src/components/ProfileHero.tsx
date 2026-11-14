import { useEffect, useRef, useState } from 'react';
import { Camera, Crown, Flame, Pencil, Scale, Target, Users } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { usePhotoUrl } from '@/lib/hooks';
import { cropSquare, savePhoto, deletePhoto } from '@/lib/photos';
import { dailyGoal, fromKg } from '@/lib/nutrition';
import { dailyTargets } from '@/lib/energy';
import { isPremiumActive } from '@/lib/premium';
import { accountsEnabled, useSession } from '@/lib/account';
import { myProfile, uploadAvatar, type MyProfile } from '@/lib/social';
import { useLogStreak } from './ProgressTop';
import { Avatar } from './Avatar';
import { cx, fmt } from './ui';
import { haptic, toast } from './fx';

/** The person at the top of Profile: photo, name, @username, plan, stats and targets. */
export function ProfileHero({ onEdit }: { onEdit: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const saveProfile = useStore((s) => s.saveProfile);
  const unit = useStore((s) => s.settings.bodyUnit);
  const premium = useStore((s) => s.premium);
  const weights = useStore((s) => s.weights);
  const entries = useStore((s) => s.entries);
  const session = useSession();
  const [social, setSocial] = useState<MyProfile | null>(null);
  const localPhoto = usePhotoUrl(profile.photoId);
  const fileRef = useRef<HTMLInputElement>(null);
  const { streak } = useLogStreak();

  useEffect(() => { if (accountsEnabled && session) myProfile().then(setSocial, () => setSocial(null)); }, [session]);

  const goal = dailyGoal(profile);
  const targets = dailyTargets(profile, goal);
  const current = weights.length ? weights[weights.length - 1].kg : profile.bodyWeightKg;
  const days = new Set(entries.map((e) => e.date)).size;
  const plan = isPremiumActive(premium) ? (premium?.tier === 'pro' ? 'Pro' : 'Plus') : 'Free';

  async function pick(f?: File) {
    if (!f) return;
    const square = await cropSquare(f);
    const id = await savePhoto(square);
    if (profile.photoId) void deletePhoto(profile.photoId);
    saveProfile({ ...profile, photoId: id });
    if (session) await uploadAvatar(square).then(() => myProfile().then(setSocial)).catch(() => undefined);
    haptic([10, 30, 10]);
    toast('Profile photo updated');
  }

  return (
    <>
      <section className="card p-6 text-center">
        <button onClick={() => fileRef.current?.click()} className="relative mx-auto block" aria-label="Change profile photo">
          <Avatar name={profile.name || 'You'} photoUrl={localPhoto ?? social?.photoUrl} size={96} />
          <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-primary text-on-primary ring-4 ring-surface"><Camera size={14} /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        <p className="mt-3 text-[22px] font-extrabold">{profile.name || 'You'}</p>
        <p className="mt-0.5 flex items-center justify-center gap-2 text-sm font-semibold text-silver">
          {social?.username ? <span>@{social.username}</span> : session === null || !accountsEnabled ? <span>Not signed in</span> : null}
          <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', plan === 'Free' ? 'bg-raised text-ink' : 'bg-primary text-on-primary')}>
            {plan !== 'Free' && <Crown size={11} />}{plan}
          </span>
        </p>
        <button onClick={onEdit} className="btn-ghost mx-auto mt-4 !h-11 !px-5 text-sm"><Pencil size={15} /> Edit profile</button>

        <div className="num mt-5 grid grid-cols-4 gap-2">
          <Stat icon={<Flame size={15} />} value={fmt(streak)} label="Streak" />
          <Stat icon={<Scale size={15} />} value={current ? fmt(fromKg(current, unit), 1) : '—'} label={unit} />
          <Stat icon={<Target size={15} />} value={profile.goalWeightKg ? fmt(fromKg(profile.goalWeightKg, unit), 1) : '—'} label="Goal" />
          <Stat icon={<Users size={15} />} value={fmt(days)} label="Days" />
        </div>
      </section>

      <section className="mt-4">
        <p className="mb-2 px-1 text-sm font-semibold text-silver">Daily targets</p>
        <button onClick={onEdit} className="card grid w-full grid-cols-4 gap-2 p-4 text-center transition active:scale-[.99]">
          {([['Calories', targets?.kcal, ''], ['Protein', goal, 'g'], ['Carbs', targets?.carbs, 'g'], ['Fat', targets?.fat, 'g']] as const).map(([l, v, u]) => (
            <div key={l}>
              <p className="num text-[18px] font-extrabold">{v == null ? '—' : `${fmt(v)}${u}`}</p>
              <p className="text-xs font-semibold text-silver">{l}</p>
            </div>
          ))}
        </button>
      </section>
    </>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-raised px-1 py-2.5">
      <span className="flex justify-center text-silver">{icon}</span>
      <p className="mt-1 text-[17px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold text-silver">{label}</p>
    </div>
  );
}
