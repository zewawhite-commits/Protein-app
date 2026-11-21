/**
 * Nutivili AI's mark, kept minimal: an N whose last stroke grows into a leaf, all in the text
 * colour (black, or white in dark mode). The home-screen icons use the same drawing (public/icons/icon.svg).
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="96 80 352 336" className={className} aria-hidden>
      <path d="M166 376V148L318 362V262" fill="none" stroke="rgb(var(--ink))" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M292 266C290 186 330 122 418 100C418 182 386 240 344 266Z" fill="rgb(var(--ink))" />
    </svg>
  );
}
