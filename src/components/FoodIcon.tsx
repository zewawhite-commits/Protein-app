import { usePhotoUrl } from '@/lib/hooks';
import { foodArtUrl } from '@/data/foodArt';
import { cx } from './ui';

/** A food illustration (flat, colourful) sized to fit; decorative, so it has no alt text. */
export function FoodArt({ name, category, size, className }: { name: string; category?: string; size: number; className?: string }) {
  return <img src={foodArtUrl(name, category)} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} className={cx('select-none', className)} />;
}

/** Rounded-square visual: the user's own meal photo if there is one, otherwise a food illustration. */
export function FoodVisual({ name, category, photoId, size = 52, className }: { name: string; category?: string; photoId?: string; fdcId?: number; size?: number; className?: string }) {
  const own = usePhotoUrl(photoId);
  return (
    <div className={cx('grid shrink-0 place-items-center overflow-hidden bg-raised', className)} style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      {own ? <img src={own} alt="" className="h-full w-full object-cover" /> : <FoodArt name={name} category={category} size={Math.round(size * 0.58)} />}
    </div>
  );
}
