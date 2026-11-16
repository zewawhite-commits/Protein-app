import { useId } from 'react';

/**
 * Nutivili AI's mark: an N whose last stroke grows into a fresh leaf, on the brand-green tile.
 * Lit from the top-left with a soft shadow under the letter, to match the app's 3D look.
 * The PNG icons in public/icons are drawn from this same artwork (public/icons/icon.svg).
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  // Each logo needs its own ids: if two logos shared them and the first sat in a hidden header,
  // browsers would paint the visible one without its colours.
  const id = `logo-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3DD196" />
          <stop offset="0.55" stopColor="#17A574" />
          <stop offset="1" stopColor="#0A7A58" />
        </linearGradient>
        <radialGradient id={`${id}hl`} cx="0.28" cy="0.18" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}leaf`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#D9F99D" />
          <stop offset="1" stopColor="#A3E635" />
        </linearGradient>
        <linearGradient id={`${id}white`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E8FAF1" />
        </linearGradient>
        <filter id={`${id}sh`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="10" stdDeviation="11" floodColor="#04442F" floodOpacity="0.38" />
        </filter>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${id}bg)`} />
      <rect width="512" height="512" rx="116" fill={`url(#${id}hl)`} />
      <g filter={`url(#${id}sh)`}>
        <path d="M166 376V148L318 362V262" fill="none" stroke={`url(#${id}white)`} strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M292 266C290 186 330 122 418 100C418 182 386 240 344 266Z" fill={`url(#${id}leaf)`} />
        <path d="M318 260C338 210 366 162 402 120" fill="none" stroke="#15935F" strokeWidth="8" strokeLinecap="round" />
      </g>
    </svg>
  );
}
