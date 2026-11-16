/** Provora's mark: a P drawn as a progress gauge, ending in the lime "progress" dot. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id="provora-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3CCB8F" />
          <stop offset="1" stopColor="#0C8C68" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#provora-g)" />
      <path d="M188 392V142h74a88 88 0 0 1 62.2 150.2" fill="none" stroke="#fff" strokeWidth="50" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="324.2" cy="292.2" r="31" fill="#BEF078" />
    </svg>
  );
}
