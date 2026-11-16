import { useId } from 'react';

/** Nutivility's mark: an N drawn in one stroke, with the lime "progress" dot on top of its last stroke. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  // Each logo needs its own gradient id: if two shared one and the first sat in a hidden header,
  // browsers would paint the visible logo's background transparent.
  const id = `logo-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3CCB8F" />
          <stop offset="1" stopColor="#0C8C68" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${id})`} />
      <path d="M172 370V142L340 370V142" fill="none" stroke="#fff" strokeWidth="50" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="340" cy="142" r="31" fill="#BEF078" />
    </svg>
  );
}
