import { usePhotoUrl } from '@/lib/hooks';
import { artFor, artUrl } from '@/data/foodArt';
import { cx } from './ui';

/**
 * Rounded-square visual for a food: the user's own meal photo if there is one, otherwise a
 * 3D illustration (one consistent style across the app) chosen from the name and category.
 */
export function FoodVisual({ name, category, photoId, size = 52, className }: { name: string; category?: string; photoId?: string; fdcId?: number; size?: number; className?: string }) {
  const own = usePhotoUrl(photoId);
  return (
    <div
      className={cx('grid shrink-0 place-items-center overflow-hidden bg-raised', className)}
      style={{ width: size, height: size, borderRadius: size * 0.32 }}
    >
      {own ? (
        <img src={own} alt="" className="h-full w-full object-cover" />
      ) : (
        <img src={artUrl(artFor(name, category))} alt="" loading="lazy" draggable={false} style={{ width: size * 0.72, height: size * 0.72 }} />
      )}
    </div>
  );
}
