import { usePhotoUrl } from '@/lib/hooks';
import { useSyncExternalStore } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { photoFor, photoKeyFor, sizedPhoto, subscribePhoto } from '@/data/foodPhotos';
import { cx } from './ui';

/**
 * Rounded-square food picture: the user's own meal photo if there is one, otherwise a real food
 * photograph (Unsplash, photographer credited). No cartoons: while a photo loads, or if none
 * exists, it shows a plain tile.
 */
export function FoodVisual({ name, category, photoId, size = 52, className }: { name: string; category?: string; photoId?: string; fdcId?: number; size?: number; className?: string }) {
  const own = usePhotoUrl(photoId);
  const key = own ? undefined : photoKeyFor(name, category);
  const photo = useSyncExternalStore((f) => (key ? subscribePhoto(key, f) : () => undefined), () => photoFor(key));
  return (
    <div className={cx('relative grid shrink-0 place-items-center overflow-hidden bg-raised', photo === undefined && key && 'animate-pulse', className)} style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      {own ? <img src={own} alt="" className="h-full w-full object-cover" />
        : photo ? <img src={sizedPhoto(photo.url, Math.round(size * 2))} alt="" title={photo.author ? `Photo by ${photo.author} on ${photo.url.includes('pexels') ? 'Pexels' : photo.url.includes('wikimedia') ? 'Wikimedia Commons' : 'Unsplash'}` : undefined} width={size} height={size} loading="lazy" decoding="async" draggable={false} className="h-full w-full select-none object-cover" style={{ backgroundColor: photo.color ?? undefined }} />
        : photo === null || !key ? <UtensilsCrossed size={Math.max(12, Math.round(size * 0.34))} className="text-dim" strokeWidth={1.75} aria-hidden /> : null}
    </div>
  );
}
