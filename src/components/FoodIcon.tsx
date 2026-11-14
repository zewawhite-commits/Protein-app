import { usePhotoUrl } from '@/lib/hooks';
import { iconFor } from '@/data/foodArt';
import { cx } from './ui';

/** Rounded-square visual: the user's own meal photo if there is one, otherwise a clean line icon. */
export function FoodVisual({ name, category, photoId, size = 52, className }: { name: string; category?: string; photoId?: string; fdcId?: number; size?: number; className?: string }) {
  const own = usePhotoUrl(photoId);
  const Icon = iconFor(name, category);
  return (
    <div className={cx('grid shrink-0 place-items-center overflow-hidden bg-raised text-ink', className)} style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      {own ? <img src={own} alt="" className="h-full w-full object-cover" /> : <Icon size={size * 0.44} strokeWidth={1.8} />}
    </div>
  );
}
