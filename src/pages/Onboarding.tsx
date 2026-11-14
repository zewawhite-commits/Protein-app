import { ProfileForm } from '@/components/ProfileForm';
import { Ring } from '@/components/ui';

export default function Onboarding() {
  return (
    <div className="relative mx-auto min-h-dvh max-w-lg px-5 pb-10">
      <div className="relative pt-safe animate-fade-up">
        <div className="mt-10 flex items-center gap-3">
          <Ring value={0.72} size={40} stroke={5} color="ink" track="line" />
          <span className="text-lg font-semibold tracking-tight">Protein</span>
        </div>
        <h1 className="mt-10 text-[44px] font-semibold leading-[1.02] tracking-tight">
          Weigh it.<br />Log it.<br /><span className="text-accent">Hit your number.</span>
        </h1>
        <p className="mt-4 max-w-sm font-medium text-silver">
          Precise protein tracking by weight. Lab values from USDA, raw and cooked kept separate.
        </p>
        <div className="card mt-10 p-5">
          <ProfileForm submitLabel="Start tracking" />
        </div>
        <p className="mt-6 text-center text-xs font-medium text-silver">Your data stays on this device. Export a backup any time from Profile.</p>
      </div>
    </div>
  );
}
