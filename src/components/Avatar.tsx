import { cx } from './ui';

/** Avatar colours (stored as a key in profiles_public.avatar). */
export const AVATAR_COLORS: Record<string, string> = {
  blue: 'bg-[rgb(30_108_255)]',
  ink: 'bg-[rgb(14_14_16)]',
  violet: 'bg-[rgb(124_77_255)]',
  amber: 'bg-[rgb(230_140_30)]',
  teal: 'bg-[rgb(20_150_160)]',
  rose: 'bg-[rgb(225_70_110)]',
  slate: 'bg-[rgb(90_100_120)]',
  indigo: 'bg-[rgb(70_80_200)]',
};

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '·';

/** Initials on a colour — clean and consistent (no emoji). Unknown/old values fall back by name. */
export function Avatar({ name, color, size = 44, className }: { name: string; color?: string; size?: number; className?: string }) {
  const keys = Object.keys(AVATAR_COLORS);
  const key = color && AVATAR_COLORS[color] ? color : keys[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % keys.length];
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full font-bold text-white', AVATAR_COLORS[key], className)} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}
