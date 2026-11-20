import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { BrandName } from '@/components/fx';
import { SharedRecipeCard } from '@/components/SharedRecipeCard';
import { readRecipeLink } from '@/components/ShareRecipe';
import { useStore } from '@/store/useStore';
import type { SharedRecipe } from '@/lib/social';

/** /r#… — a recipe someone shared by link. Anyone can see it; members can save a copy. */
export default function SharedRecipePage() {
  const [recipe, setRecipe] = useState<SharedRecipe | null | undefined>(undefined);
  const member = useStore((s) => !!s.profile);
  useEffect(() => { void readRecipeLink(location.hash).then(setRecipe); }, []);
  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 pb-16">
      <header className="pt-safe flex items-center gap-2 pb-5"><Logo size={28} /><BrandName className="text-xl" /></header>
      {recipe === undefined ? <p className="text-silver">Opening recipe…</p>
        : recipe === null ? <p className="card p-5 text-silver">This recipe link is incomplete. Ask for it to be shared again.</p>
        : (
          <>
            <p className="mb-1 text-sm font-semibold text-silver">A recipe shared with you</p>
            <div className="card py-1 [&>div]:mx-1">{member ? <SharedRecipeCard recipe={recipe} /> : <SharedRecipeCard recipe={recipe} readOnly />}</div>
            <Link to="/" className="btn-primary mt-5 w-full">{member ? 'Open Nutivili AI' : 'Join Nutivili AI free to save it'}</Link>
          </>
        )}
    </div>
  );
}
