/**
 * Merging two copies of someone's data (this device and the cloud) without losing anything.
 *
 * Lists are merged item by item, by id: an item on either side is kept; if both sides have
 * it, the more recently changed version wins. Deleted items are remembered for 90 days
 * ("tombstones") so a delete on one phone isn't undone by the other phone's old copy.
 * Single settings (profile, targets) come from whichever copy changed most recently.
 */
type Stamped = { id: string };
export interface SyncSnapshot {
  app?: string;
  exportedAt?: string;
  profile?: unknown;
  settings?: unknown;
  entries?: (Stamped & { loggedAt?: number; updatedAt?: number })[];
  exercises?: (Stamped & { updatedAt?: number })[];
  measurements?: (Stamped & { createdAt?: number })[];
  routines?: (Stamped & { createdAt?: number; updatedAt?: number })[];
  customExercises?: (Stamped & { createdAt?: number; updatedAt?: number })[];
  workoutLogs?: (Stamped & { createdAt?: number })[];
  customFoods?: (Stamped & { updatedAt?: number; createdAt?: number })[];
  savedMeals?: (Stamped & { createdAt?: number })[];
  savedPlans?: (Stamped & { createdAt?: number })[];
  savedRecipes?: (Stamped & { createdAt?: number })[];
  coachChats?: (Stamped & { updatedAt?: number })[];
  weights?: { date: string; kg: number }[];
  goalHistory?: Record<string, number>;
  recentFoodIds?: string[];
  favoriteFoodIds?: string[];
  remoteFoods?: Record<string, unknown>;
  workoutPlan?: unknown;
  water?: Record<string, number>;
  sleep?: Record<string, { hours: number; updatedAt?: number }>;
  /** id (or "w:<date>" for a weigh-in) → when it was deleted. */
  deleted?: Record<string, number>;
  [k: string]: unknown;
}

const KEEP_TOMBSTONES = 90 * 864e5;
const stamp = (x: { updatedAt?: number; loggedAt?: number; createdAt?: number }) => x.updatedAt ?? x.loggedAt ?? x.createdAt ?? 0;

function mergeList<T extends Stamped & { updatedAt?: number; loggedAt?: number; createdAt?: number }>(a: T[] = [], b: T[] = [], deleted: Record<string, number>): T[] {
  const byId = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const cur = byId.get(x.id);
    if (!cur || stamp(x) > stamp(cur)) byId.set(x.id, x);
  }
  return [...byId.values()].filter((x) => !(deleted[x.id] && deleted[x.id] >= stamp(x)));
}

/** Day-keyed records (sleep): the later edit of each day wins. */
function mergeByDay<T extends { updatedAt?: number }>(a: Record<string, T> = {}, b: Record<string, T> = {}): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) if (!out[k] || (v.updatedAt ?? 0) > (out[k].updatedAt ?? 0)) out[k] = v;
  return out;
}

/** Merge this device's copy with the cloud copy. `localTime`/`remoteTime`: when each last changed. */
export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot, localTime: number, remoteTime: number, now = Date.now()): SyncSnapshot {
  const newer = remoteTime > localTime ? remote : local;
  const older = newer === remote ? local : remote;
  const deleted: Record<string, number> = {};
  for (const [k, t] of [...Object.entries(local.deleted ?? {}), ...Object.entries(remote.deleted ?? {})]) {
    if (now - t < KEEP_TOMBSTONES) deleted[k] = Math.max(deleted[k] ?? 0, t);
  }
  // Weigh-ins are keyed by date: the newer copy wins a clash; a deleted date stays deleted unless the newer copy has it.
  const weights = new Map<string, { date: string; kg: number }>();
  for (const w of older.weights ?? []) if (!deleted[`w:${w.date}`]) weights.set(w.date, w);
  for (const w of newer.weights ?? []) weights.set(w.date, w);
  return {
    ...older,
    ...newer,
    entries: mergeList(local.entries, remote.entries, deleted),
    exercises: mergeList(local.exercises, remote.exercises, deleted),
    measurements: mergeList(local.measurements, remote.measurements, deleted),
    routines: mergeList(local.routines, remote.routines, deleted),
    customExercises: mergeList(local.customExercises, remote.customExercises, deleted),
    workoutLogs: mergeList(local.workoutLogs, remote.workoutLogs, deleted),
    customFoods: mergeList(local.customFoods, remote.customFoods, deleted),
    savedMeals: mergeList(local.savedMeals, remote.savedMeals, deleted),
    savedPlans: mergeList(local.savedPlans, remote.savedPlans, deleted),
    savedRecipes: mergeList(local.savedRecipes, remote.savedRecipes, deleted),
    coachChats: mergeList(local.coachChats, remote.coachChats, deleted),
    weights: [...weights.values()].sort((a, b) => a.date.localeCompare(b.date)),
    goalHistory: { ...(older.goalHistory ?? {}), ...(newer.goalHistory ?? {}) },
    remoteFoods: { ...(older.remoteFoods ?? {}), ...(newer.remoteFoods ?? {}) },
    water: { ...(older.water ?? {}), ...(newer.water ?? {}) },
    sleep: mergeByDay(local.sleep, remote.sleep),
    recentFoodIds: [...new Set([...(newer.recentFoodIds ?? []), ...(older.recentFoodIds ?? [])])].slice(0, 24),
    profile: newer.profile ?? older.profile,
    deleted,
  };
}

/** The parts that matter for "did anything change?" (ignores the export time). */
export const fingerprint = (s: SyncSnapshot) => JSON.stringify({ ...s, exportedAt: undefined });
