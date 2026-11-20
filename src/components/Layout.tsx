import { Logo } from './Logo';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogMenu } from './LogMenu';
import { BarChart3, Camera, House, MessageCircle, Plus, UserRound, Users } from 'lucide-react';
import { cx } from './ui';
import { BrandName } from './fx';

const tabs = [
  { to: '/', label: 'Home', icon: House },
  { to: '/insights', label: 'Progress', icon: BarChart3 },
  { to: '/feed', label: 'Feed', icon: Users },
  { to: '/coach', label: 'Coach', icon: MessageCircle },
  { to: '/profile', label: 'Profile', icon: UserRound },
] as const;

/**
 * Phones: content column + floating bottom bar. Tablets: wider column.
 * Laptops/desktops (lg+): fixed side menu and a wide content area.
 */
export function Layout() {
  const nav = useNavigate();
  const loc = useLocation();
  const day = new URLSearchParams(loc.search).get('date');
  const q = day ? `?date=${day}` : '';
  const [menu, setMenu] = useState(false);
  return (
    <div className="relative min-h-dvh">
      {/* Side menu (large screens) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line/60 bg-surface px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-3">
          <Logo size={30} />
          <BrandName className="text-xl" />
        </div>
        <button onClick={() => nav(`/add${q}`)} className="btn-primary mt-8 w-full !h-12"><Plus size={18} /> Add food</button>
        <button onClick={() => nav(`/snap${q}`)} className="btn-ghost mt-2 w-full !h-12"><Camera size={18} /> Scan food</button>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) => cx('flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition', isActive ? 'bg-raised text-ink' : 'text-silver hover:bg-raised/60')}
            >
              <t.icon size={20} />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="relative mx-auto max-w-lg px-5 pb-nav md:max-w-2xl md:px-8 lg:ml-64 lg:max-w-5xl lg:px-12 lg:pb-12">
        <Outlet />
      </main>

      {/* Bottom bar (phones and tablets) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-32 bg-gradient-to-t from-bg via-bg/80 to-transparent lg:hidden" />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg items-center gap-3 px-5 md:max-w-2xl lg:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
        aria-label="Main"
      >
        <div className="card flex h-[68px] flex-1 items-center justify-around !rounded-full px-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) => cx('flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[12px] font-semibold transition', isActive ? 'text-ink' : 'text-dim')}
            >
              {({ isActive }) => (
                <>
                  <t.icon size={22} strokeWidth={isActive ? 2.5 : 2} fill={isActive && t.to === '/' ? 'currentColor' : 'none'} fillOpacity={0.12} />
                  <span>{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
        <button
          onClick={() => setMenu(true)}
          className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full bg-primary text-on-primary transition active:scale-95"
          style={{ boxShadow: '0 10px 26px -8px rgb(18 152 104 / 0.55)' }}
          aria-label="Log food"
        >
          <Plus size={28} strokeWidth={2.6} />
        </button>
      </nav>
      <LogMenu open={menu} onClose={() => setMenu(false)} date={day ?? undefined} />
    </div>
  );
}
