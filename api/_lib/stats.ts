/**
 * Owner-only usage summary, worked out from data the app already stores for signed-in
 * users (their own log and the monthly AI counters). No extra tracking, nothing per person
 * is returned — only totals. People using the app without an account aren't visible here.
 */
export interface Snapshot { profile?: { createdAt?: number } | null; entries?: { date: string }[]; weights?: unknown[]; exercises?: unknown[] }
export interface Row { data: Snapshot; updated_at: string }

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export function summarize(rows: Row[], now = Date.now()) {
  const today = dayKey(now);
  const ago = (n: number) => dayKey(now - n * 864e5);
  let finished = 0, loggedOnce = 0, twoDays = 0, active7 = 0, active30 = 0, eligible = 0, week2 = 0, weighed = 0, trained = 0, totalDays = 0;
  for (const r of rows) {
    const d = r.data ?? {};
    const days = [...new Set((d.entries ?? []).map((e) => e.date))].sort();
    if (d.profile) finished++;
    if (days.length >= 1) loggedOnce++;
    if (days.length >= 2) twoDays++;
    if (days.some((x) => x > ago(7) && x <= today)) active7++;
    if (days.some((x) => x > ago(30) && x <= today)) active30++;
    if ((d.weights ?? []).length) weighed++;
    if ((d.exercises ?? []).length) trained++;
    totalDays += days.length;
    // Week-2 retention: of people who started at least 14 days ago, how many logged food in days 8–14.
    const start = d.profile?.createdAt ? dayKey(d.profile.createdAt) : days[0];
    if (start && start <= ago(14)) {
      eligible++;
      const from = dayKey(new Date(`${start}T00:00:00Z`).getTime() + 7 * 864e5);
      const to = dayKey(new Date(`${start}T00:00:00Z`).getTime() + 14 * 864e5);
      if (days.some((x) => x >= from && x <= to)) week2++;
    }
  }
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  return {
    accounts: rows.length,
    finishedSetup: finished,
    loggedFood: loggedOnce,
    loggedTwoDays: twoDays,
    activeLast7Days: active7,
    activeLast30Days: active30,
    loggedWeight: weighed,
    loggedWorkout: trained,
    avgDaysLogged: rows.length ? Math.round((totalDays / rows.length) * 10) / 10 : 0,
    day2Rate: pct(twoDays, loggedOnce),
    week2: { eligible, returned: week2, rate: pct(week2, eligible) },
  };
}
