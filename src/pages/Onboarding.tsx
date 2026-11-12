import { ProfileForm } from '@/components/ProfileForm';
import { Ring } from '@/components/ui';

export default function Onboarding() {
  return (
    <div className="relative mx-auto min-h-dvh max-w-lg px-5 pb-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--accent)/0.22),transparent)]" />
      <div className="relative pt-safe animate-fade-up">
        <div className="mt-10 flex items-center gap-3">
          <Ring value={0.72} size={44} stroke={5} />
          <span className="text-lg font-semibold tracking-tight">Protein</span>
        </div>
        <h1 className="mt-10 text-[40px] font-semibold leading-[1.05] tracking-tighter">
          Weigh it.<br />Log it.<br /><span className="text-accent">Hit your number.</span>
        </h1>
        <p className="mt-4 max-w-sm text-silver">
          Precise protein tracking by weight, using laboratory values from USDA FoodData Central — raw and cooked kept separate.
        </p>
        <div className="card mt-10 p-5">
          <ProfileForm submitLabel="Start tracking" />
        </div>
        <p className="mt-6 text-center text-xs text-dim">Your data stays on this device. Export a backup any time from Profile.</p>
      </div>
    </div>
  );
}
