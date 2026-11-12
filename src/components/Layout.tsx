import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, House, Plus, UserRound } from 'lucide-react';
import { cx } from './ui';

const tabs = [
  { to: '/', label: 'Home', icon: House },
  { to: '/history', label: 'History', icon: CalendarDays },
  { to: '/insights', label: 'Progress', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: UserRound },
] as const;

export function Layout() {
  const nav = useNavigate();
  const loc = useLocation();
  const day = new URLSearchParams(loc.search).get('date');
  return (
    <div className="relative mx-auto min-h-dvh max-w-lg">
      <main className="relative px-5 pb-nav">
        <Outlet />
      </main>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-32 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg items-center gap-3 px-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
        aria-label="Main"
      >
        <div className="card flex h-[68px] flex-1 items-center justify-around !rounded-full px-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) => cx('flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-bold transition', isActive ? 'text-ink' : 'text-dim')}
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
          onClick={() => nav(`/add${day ? `?date=${day}` : ''}`)}
          className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full bg-primary text-on-primary transition active:scale-95"
          style={{ boxShadow: '0 10px 30px -8px rgb(0 0 0 / 0.45)' }}
          aria-label="Log food"
        >
          <Plus size={28} strokeWidth={2.6} />
        </button>
      </nav>
    </div>
  );
}
