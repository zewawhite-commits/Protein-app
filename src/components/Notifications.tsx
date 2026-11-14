import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, Flame, Lightbulb, PartyPopper, TriangleAlert, Utensils } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useDay } from '@/lib/hooks';
import { todayKey } from '@/lib/dates';
import { dailyTargets } from '@/lib/energy';
import { computeNudges, dueReminder, MEAL_TIMES, type Nudge } from '@/lib/nudges';
import type { Reminders } from '@/lib/types';
import { Sheet, cx } from './ui';
import { haptic, toast } from './fx';
import { useGoalStats } from '@/pages/Today';

const READ_KEY = 'provora-read';
const readSet = (): string[] => { try { return JSON.parse(localStorage.getItem(READ_KEY) ?? '[]'); } catch { return []; } };
const DEFAULT_REMINDERS: Reminders = { enabled: false, ...MEAL_TIMES };

function useNudges(): Nudge[] {
  const date = todayKey();
  const { entries, totals, goal } = useDay(date);
  const profile = useStore((s) => s.profile);
  const reminders = useStore((s) => s.settings.reminders);
  const { streak } = useGoalStats();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  return useMemo(
    () => computeNudges({ date, now, entries, totals, proteinGoal: goal, targets: profile ? dailyTargets(profile, goal) : null, streak, times: reminders }),
    [date, now, entries, totals, goal, profile, streak, reminders],
  );
}

const ICON = { meal: Utensils, win: PartyPopper, tip: Lightbulb, warn: TriangleAlert } as const;
const TONE = { meal: 'bg-accent/10 text-accent', win: 'bg-accent/10 text-accent', tip: 'bg-raised text-ink', warn: 'bg-warn/15 text-warn' } as const;

/** Bell (top right of Home) with today's notices and meal reminder settings. */
export function NotificationBell() {
  const nudges = useNudges();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>(readSet);
  const unread = nudges.filter((n) => !read.includes(n.id)).length;

  function openSheet() {
    haptic();
    setOpen(true);
    const ids = [...new Set([...read, ...nudges.map((n) => n.id)])].slice(-200);
    try { localStorage.setItem(READ_KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
    // Keep the dots visible while the sheet is open; clear them on close.
  }

  return (
    <>
      <button onClick={openSheet} className="relative grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label={`Notifications${unread ? `, ${unread} new` : ''}`}>
        {unread ? <BellRing size={20} className="text-ink" /> : <Bell size={20} />}
        {unread > 0 && <span className="num absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[12px] font-bold text-white">{unread}</span>}
      </button>
      <Sheet open={open} onClose={() => { setOpen(false); setRead(readSet()); }} title="Notifications">
        {nudges.length === 0 ? (
          <p className="rounded-2xl bg-raised p-4 text-sm text-silver">All caught up. We’ll nudge you here about meals, goals and streaks.</p>
        ) : (
          <ul className="space-y-2">
            {nudges.map((n) => {
              const Icon = ICON[n.kind];
              const body = (
                <div className="flex gap-3 rounded-[20px] bg-surface p-3.5" style={{ boxShadow: 'var(--shadow)' }}>
                  <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full', TONE[n.kind])}><Icon size={18} /></span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[15px] font-semibold">{n.title}{!read.includes(n.id) && <span className="h-2 w-2 rounded-full bg-danger" />}</p>
                    <p className="mt-0.5 text-sm text-silver">{n.body}</p>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.link ? <Link to={n.link} onClick={() => setOpen(false)}>{body}</Link> : body}</li>;
            })}
          </ul>
        )}
        <ReminderSettings />
      </Sheet>
    </>
  );
}

function ReminderSettings() {
  const reminders = useStore((s) => s.settings.reminders) ?? DEFAULT_REMINDERS;
  const updateSettings = useStore((s) => s.updateSettings);
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const set = (patch: Partial<Reminders>) => updateSettings({ reminders: { ...reminders, ...patch } });

  async function toggle() {
    haptic();
    if (reminders.enabled) return set({ enabled: false });
    if (!supported) return toast('This browser can’t show notifications. Install Provora to your home screen and try again.');
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') return toast('Notifications are blocked — allow them in your browser settings.');
    set({ enabled: true });
    toast('Meal reminders on');
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold"><Flame size={16} className="text-accent" /> Meal reminders</p>
          <p className="text-sm text-silver">A nudge if a meal isn’t logged by these times.</p>
        </div>
        <button onClick={toggle} role="switch" aria-checked={reminders.enabled} className={cx('relative h-8 w-14 shrink-0 rounded-full transition', reminders.enabled ? 'bg-accent' : 'bg-line')}>
          <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', reminders.enabled ? 'left-7' : 'left-1')} />
        </button>
      </div>
      <div className={cx('mt-3 grid grid-cols-3 gap-2', !reminders.enabled && 'opacity-50')}>
        {(['breakfast', 'lunch', 'dinner'] as const).map((m) => (
          <label key={m} className="rounded-2xl bg-raised p-2.5 text-center">
            <span className="block text-xs font-semibold capitalize text-silver">{m}</span>
            <input type="time" value={reminders[m]} onChange={(e) => set({ [m]: e.target.value })} className="mt-1 w-full bg-transparent text-center text-[15px] font-semibold outline-none" />
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-dim">Reminders arrive while Provora is open or running in the background. Reminders when the app is fully closed will come with a future update.</p>
    </section>
  );
}

/** Runs in the app shell: sends a meal reminder when one is due (once per meal per day). */
export function useMealReminders() {
  const reminders = useStore((s) => s.settings.reminders);
  useEffect(() => {
    if (!reminders?.enabled || !('Notification' in window)) return;
    const check = async () => {
      if (Notification.permission !== 'granted') return;
      const date = todayKey();
      const key = `provora-reminded-${date}`;
      let sent: string[] = [];
      try { sent = JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { /* ignore */ }
      const entries = useStore.getState().entries.filter((e) => e.date === date);
      const meal = dueReminder(new Date(), entries, reminders, sent);
      if (!meal) return;
      try { localStorage.setItem(key, JSON.stringify([...sent, meal])); } catch { /* ignore */ }
      const title = `Time to log your ${meal}`;
      const options = { body: 'Snap it or search — it only takes a few seconds.', icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, tag: `meal-${meal}` };
      const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
      if (reg) await reg.showNotification(title, options);
      else new Notification(title, options);
    };
    void check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [reminders]);
}
