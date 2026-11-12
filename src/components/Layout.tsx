import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, Home, Plus, UserRound } from 'lucide-react';
import { cx } from './ui';

const tabs = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/history', label: 'History', icon: CalendarDays },
  null,
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: UserRound },
] as const;

export function Layout() {
  const nav = useNavigate();
  const loc = useLocation();
  const day = new URLSearchParams(loc.search).get('date');
  return (
    <div className="relative mx-auto min-h-dvh max-w-lg">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--accent)/0.14),transparent)]" />
      <main className="relative px-4 pb-nav sm:px-6">
        <Outlet />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        aria-label="Main"
      >
        <div className="flex h-16 items-center justify-between rounded-[28px] border border-line/70 bg-surface/85 px-2 shadow-card backdrop-blur-xl">
          {tabs.map((t) =>
            t ? (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) => cx('flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium transition', isActive ? 'text-ink' : 'text-dim')}
              >
                {({ isActive }) => (
                  <>
                    <t.icon size={21} strokeWidth={isActive ? 2.3 : 1.8} />
                    <span>{t.label}</span>
                  </>
                )}
              </NavLink>
            ) : (
              <button
                key="add"
                onClick={() => nav(`/add${day ? `?date=${day}` : ''}`)}
                className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-accent text-white shadow-glow ring-4 ring-bg transition active:scale-95"
                aria-label="Log food"
              >
                <Plus size={26} strokeWidth={2.4} />
              </button>
            ),
          )}
        </div>
      </nav>
    </div>
  );
}
