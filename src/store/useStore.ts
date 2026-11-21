/**
 * App state, persisted to localStorage. This is the single data layer the UI
 * talks to, so it can later be backed by a server (e.g. Supabase) without
 * touching the screens.
 */
import type { WorkoutPlan } from '@/lib/workout';
import type { Recipe } from '@/lib/recipe';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SleepEntry, CustomFood, Food, LogEntry, Meal, Profile, ProgressPhoto, SavedMeal, SavedPlan, Settings, WeightEntry, MeasurementEntry } from '@/lib/types';
import { dailyGoal } from '@/lib/nutrition';
import { todayKey } from '@/lib/dates';
import { deletePhoto } from '@/lib/photos';
import { burnedKcal, type ExerciseEntry, type ExerciseType, type Routine } from '@/lib/exercise';
import { guardWrite } from '@/lib/gate';
import { elapsed, type ActiveWorkout, type CustomExercise, type LiveSet, type WorkoutLog } from '@/lib/liveWorkout';

interface State {
  profile: Profile | null;
  settings: Settings;
  entries: LogEntry[];
  customFoods: CustomFood[];
  /** Goal in effect from each date onward: { 'YYYY-MM-DD': grams }. Keeps history honest when the goal changes. */
  goalHistory: Record<string, number>;
  recentFoodIds: string[];
  favoriteFoodIds: string[];
  /** Products fetched live (Open Food Facts) that the user logged or starred, so recents/favourites resolve offline. */
  remoteFoods: Record<string, Food>;
  savedMeals: SavedMeal[];
  weights: WeightEntry[];
  exercises: ExerciseEntry[];
  measurements: MeasurementEntry[];
  routines: Routine[];
  /** Exercises the person made themselves (reusable). */
  customExercises: CustomExercise[];
  saveCustomExercise: (e: Omit<CustomExercise, 'id' | 'createdAt'>) => CustomExercise;
  /** Finished live workouts (history, personal records). */
  workoutLogs: WorkoutLog[];
  removeWorkoutLog: (id: string) => void;
  /** The workout in progress (kept if the app is closed). */
  activeWorkout: ActiveWorkout | null;
  setActiveWorkout: (w: ActiveWorkout | null | ((w: ActiveWorkout) => ActiveWorkout)) => void;
  finishWorkout: () => WorkoutLog | null;
  saveRoutine: (r: Omit<Routine, 'id' | 'createdAt'> & { id?: string }) => void;
  removeRoutine: (id: string) => void;
  addMeasurement: (m: Omit<MeasurementEntry, 'id' | 'createdAt'>) => void;
  removeMeasurement: (id: string) => void;
  addExercise: (e: Omit<ExerciseEntry, 'id'>) => void;
  removeExercise: (id: string) => void;
  /** Corrections replace the old numbers (never add to them). */
  updateExercise: (id: string, patch: Partial<Omit<ExerciseEntry, 'id'>>) => void;
  progressPhotos: ProgressPhoto[];
  logWeight: (kg: number, date?: string, note?: string) => void;
  removeWeight: (date: string) => void;
  addProgressPhoto: (p: Omit<ProgressPhoto, 'id'>) => void;
  removeProgressPhoto: (id: string) => void;
  savedPlans: SavedPlan[];
  /** The latest AI workout guide the person kept. */
  workoutPlan: { plan: WorkoutPlan; createdAt: number } | null;
  setWorkoutPlan: (plan: WorkoutPlan | null) => void;
  savedRecipes: { id: string; recipe: Recipe; createdAt: number }[];
  /** Every coach conversation (synced to the account, free or paid). */
  coachChats: { id: string; title: string; at: number; updatedAt: number; msgs: { role: string; content: string; thumb?: string }[] }[];
  saveRecipe: (recipe: Recipe) => string;
  removeRecipe: (id: string) => void;
  saveMeal: (name: string, entries: LogEntry[]) => SavedMeal;
  removeSavedMeal: (id: string) => void;
  savePlan: (p: Omit<SavedPlan, 'id' | 'createdAt'>) => SavedPlan;
  removeSavedPlan: (id: string) => void;
  /** Signed Premium pass from the server (Paystack subscription). */
  premium: { token: string; exp: number; email: string; plan: string; tier?: 'plus' | 'pro'; scanLimit?: number } | null;
  /** When user data last changed (epoch ms); used to decide which copy wins in cloud sync. */
  lastModified?: number;
  /** Account whose data is on this device (so one person's log never syncs into another's account). */
  ownerId?: string;
  setPremium: (p: State['premium']) => void;
  /** Free Plus time from the server (trial or invite rewards); the server stays the authority. */
  perks: { until: number; freePro: boolean; trialUsed: boolean; referrals: number; maxReferrals: number; referralDays: number } | null;
  setPerks: (p: State['perks']) => void;
  /**
   * The plan the server says this account has (admins and free Plus time count as Plus). Lets a
   * paid plan bought on another phone, or the owner's account, unlock features here too.
   */
  serverTier: 'free' | 'plus' | 'pro' | null;
  setServerTier: (t: State['serverTier']) => void;
  /** Water drunk, in ml, by day (YYYY-MM-DD). */
  water: Record<string, number>;
  /** Sleep by day woken up (YYYY-MM-DD). */
  sleep: Record<string, SleepEntry>;
  logSleep: (date: string, hours: number | null, quality?: SleepEntry['quality']) => void;
  addWater: (date: string, ml: number) => void;
  /** Deleted items (id, or "w:<date>" for weigh-ins) → when, so a sync never brings them back. */
  deleted: Record<string, number>;
  /** Put back an entry that was just deleted (undo). */
  restoreEntry: (e: LogEntry) => void;
  /** What this person picked for a name the AI gave ("jollof rice" → food id), so the next scan puts it first. */
  picks: Record<string, string>;
  rememberPick: (key: string, foodId: string) => void;

  saveProfile: (p: Profile) => void;
  updateSettings: (s: Partial<Settings>) => void;
  addEntry: (e: { date: string; meal: Meal; food: Food; grams: number; photoId?: string; note?: string; planned?: boolean }) => LogEntry;
  updateEntry: (id: string, patch: Partial<Pick<LogEntry, 'grams' | 'meal' | 'photoId' | 'note' | 'date' | 'planned'>>) => void;
  removeEntry: (id: string, opts?: { keepPhoto?: boolean }) => void;
  toggleFavorite: (foodId: string) => void;
  rememberFood: (food: Food) => void;
  upsertCustomFood: (f: Omit<CustomFood, 'id' | 'createdAt' | 'updatedAt' | 'source'> & { id?: string }) => CustomFood;
  archiveCustomFood: (id: string, archived: boolean) => void;
  importData: (data: unknown) => void;
  resetAll: () => void;
}

const defaultSettings: Settings = { theme: 'system', bodyUnit: 'kg', adminMode: false };

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: null,
      settings: defaultSettings,
      entries: [],
      customFoods: [],
      goalHistory: {},
      recentFoodIds: [],
      favoriteFoodIds: [],
      remoteFoods: {},
      savedMeals: [],
      savedPlans: [],
      weights: [],
      exercises: [],
      measurements: [],
      customExercises: [],
      saveCustomExercise: (e) => {
        const dup = get().customExercises.find((x) => x.name.trim().toLowerCase() === e.name.trim().toLowerCase());
        const next: CustomExercise = { ...e, name: e.name.trim(), id: dup?.id ?? crypto.randomUUID(), createdAt: dup?.createdAt ?? Date.now(), updatedAt: Date.now() };
        set((s) => ({ customExercises: dup ? s.customExercises.map((x) => (x.id === dup.id ? next : x)) : [...s.customExercises, next] }));
        return next;
      },
      workoutLogs: [],
      removeWorkoutLog: (id) => set((s) => ({ workoutLogs: s.workoutLogs.filter((x) => x.id !== id), deleted: { ...s.deleted, [id]: Date.now() } })),
      activeWorkout: null,
      setActiveWorkout: (w) => set((s) => ({ activeWorkout: typeof w === 'function' ? (s.activeWorkout ? w(s.activeWorkout) : null) : w })),
      finishWorkout: () => {
        const w = get().activeWorkout;
        if (!w) return null;
        const minutes = Math.max(1, Math.round(elapsed(w) / 60));
        const done = w.exercises.filter((e) => !e.skipped && (e.sets.some((x) => x.done) || e.minutes || e.km));
        const log: WorkoutLog = { id: crypto.randomUUID(), date: todayKey(), name: w.name, startedAt: w.startedAt, minutes, exercises: done, note: w.note, ...(w.feel ? { feel: w.feel } : {}), createdAt: Date.now() };
        const kg = get().profile?.bodyWeightKg ?? 0;
        // Each exercise also goes in the day's activity (calories are an estimate).
        const share = Math.max(1, Math.round(minutes / Math.max(1, done.length)));
        const entries: ExerciseEntry[] = done.map((e) => {
          const type: ExerciseType = e.kind === 'cardio' ? (/run/i.test(e.name) ? 'run' : /walk/i.test(e.name) ? 'walk' : /cycl|bike/i.test(e.name) ? 'cycle' : /swim/i.test(e.name) ? 'swim' : 'hiit') : /yoga|stretch|pilates/i.test(e.name) ? 'yoga' : 'weights';
          const mins = e.minutes ?? share;
          const sets = e.sets.filter((x) => x.done);
          const best = sets.reduce<LiveSet | null>((b, x) => (!b || (x.weightKg ?? 0) * (x.reps ?? 0) > (b.weightKg ?? 0) * (b.reps ?? 0) ? x : b), null);
          return { id: crypto.randomUUID(), date: log.date, type, intensity: 'medium', minutes: mins, kcal: burnedKcal(type, 'medium', mins, kg), ...(e.km ? { km: e.km } : {}), ...(sets.length ? { detail: { name: e.name, sets: sets.length, ...(best?.reps ? { reps: best.reps } : {}), ...(best?.weightKg ? { weightKg: best.weightKg } : {}), ...(best?.seconds ? { seconds: best.seconds } : {}) } } : {}), note: w.name };
        });
        set((s) => ({ workoutLogs: [...s.workoutLogs, log], exercises: [...s.exercises, ...entries], activeWorkout: null }));
        return log;
      },
      routines: [],
      saveRoutine: (r) => set((s) => {
        const old = r.id ? s.routines.find((x) => x.id === r.id) : undefined;
        const next: Routine = { ...r, id: old?.id ?? crypto.randomUUID(), createdAt: old?.createdAt ?? Date.now(), updatedAt: Date.now() };
        return { routines: old ? s.routines.map((x) => (x.id === old.id ? next : x)) : [...s.routines, next] };
      }),
      removeRoutine: (id) => set((s) => ({ routines: s.routines.filter((x) => x.id !== id), deleted: { ...s.deleted, [id]: Date.now() } })),
      progressPhotos: [],
      premium: null,
      perks: null,
      serverTier: null,
      picks: {},
      water: {},
      sleep: {},
      deleted: {},

      addMeasurement: (m) => set((s) => ({ measurements: [...s.measurements, { ...m, id: crypto.randomUUID(), createdAt: Date.now() }] })),
      removeMeasurement: (id) => set((s) => ({ measurements: s.measurements.filter((x) => x.id !== id), deleted: { ...s.deleted, [id]: Date.now() } })),
      addExercise: (e) => set((s) => ({ exercises: [...s.exercises, { ...e, id: crypto.randomUUID() }] })),
      updateExercise: (id, patch) => set((s) => ({ exercises: s.exercises.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)) })),
      removeExercise: (id) => set((s) => ({ exercises: s.exercises.filter((x) => x.id !== id), deleted: { ...s.deleted, [id]: Date.now() } })),

      logWeight: (kg, date = todayKey(), note) =>
        set((s) => {
          const keep = note ?? s.weights.find((w) => w.date === date)?.note;
          const weights = [...s.weights.filter((w) => w.date !== date), { date, kg: Math.round(kg * 10) / 10, ...(keep ? { note: keep } : {}) }].sort((a, b) => a.date.localeCompare(b.date));
          const latest = weights[weights.length - 1];
          // The newest weigh-in becomes the profile weight (targets follow it).
          const profile = s.profile && latest ? { ...s.profile, bodyWeightKg: latest.kg } : s.profile;
          return { weights, profile, goalHistory: profile ? { ...s.goalHistory, [todayKey()]: dailyGoal(profile) } : s.goalHistory };
        }),
      removeWeight: (date) => set((s) => ({ weights: s.weights.filter((w) => w.date !== date), deleted: { ...s.deleted, [`w:${date}`]: Date.now() } })),
      addProgressPhoto: (p) => set((s) => ({ progressPhotos: [...s.progressPhotos, { ...p, id: crypto.randomUUID() }].sort((a, b) => a.date.localeCompare(b.date)) })),
      removeProgressPhoto: (id) => set((s) => {
        const ph = s.progressPhotos.find((x) => x.id === id);
        if (ph) void deletePhoto(ph.photoId);
        return { progressPhotos: s.progressPhotos.filter((x) => x.id !== id) };
      }),

      saveMeal: (name, list) => {
        const meal: SavedMeal = { id: crypto.randomUUID(), name: name.trim() || 'My meal', createdAt: Date.now(), items: list.map((e) => ({ foodId: e.foodId, food: e.food, grams: e.grams })) };
        set((s) => ({ savedMeals: [meal, ...s.savedMeals].slice(0, 1000) }));
        return meal;
      },
      removeSavedMeal: (id) => set((s) => ({ savedMeals: s.savedMeals.filter((m) => m.id !== id), deleted: { ...s.deleted, [id]: Date.now() } })),
      savePlan: (p) => {
        const plan: SavedPlan = { ...p, id: crypto.randomUUID(), createdAt: Date.now() };
        set((s) => ({ savedPlans: [plan, ...s.savedPlans].slice(0, 1000) }));
        return plan;
      },
      removeSavedPlan: (id) => set((s) => ({ savedPlans: s.savedPlans.filter((m) => m.id !== id), deleted: { ...s.deleted, [id]: Date.now() } })),
      workoutPlan: null,
      setWorkoutPlan: (plan) => set({ workoutPlan: plan ? { plan, createdAt: Date.now() } : null }),
      savedRecipes: [],
      coachChats: [],
      saveRecipe: (recipe) => {
        const id = crypto.randomUUID();
        set((s) => ({ savedRecipes: [{ id, recipe, createdAt: Date.now() }, ...s.savedRecipes].slice(0, 1000) }));
        return id;
      },
      removeRecipe: (id) => set((s) => ({ savedRecipes: s.savedRecipes.filter((r) => r.id !== id), deleted: { ...s.deleted, [id]: Date.now() } })),

      setPremium: (premium) => set({ premium }),
      setPerks: (perks) => set({ perks }),
      setServerTier: (serverTier) => set({ serverTier }),
      restoreEntry: (e) => set((s) => {
        const { [e.id]: _gone, ...deleted } = s.deleted ?? {};
        void _gone;
        return { entries: [...s.entries.filter((x) => x.id !== e.id), { ...e, updatedAt: Date.now() }], deleted };
      }),
      logSleep: (date, hours, quality) => set((s) => {
        const next = { ...(s.sleep ?? {}) };
        if (hours == null) delete next[date];
        else next[date] = { hours: Math.max(0, Math.min(16, Math.round(hours * 4) / 4)), ...(quality ? { quality } : next[date]?.quality ? { quality: next[date].quality } : {}), updatedAt: Date.now() };
        return { sleep: next };
      }),
      addWater: (date, ml) => set((s) => ({ water: { ...(s.water ?? {}), [date]: Math.max(0, Math.min(10000, (s.water?.[date] ?? 0) + ml)) } })),
      rememberPick: (key, foodId) => set((s) => {
        if (!key || s.picks?.[key] === foodId) return {};
        const next = { ...(s.picks ?? {}), [key]: foodId };
        const keys = Object.keys(next);
        if (keys.length > 300) delete next[keys[0]];
        return { picks: next };
      }),

      saveProfile: (p) =>
        set((s) => ({ profile: p, goalHistory: { ...s.goalHistory, [todayKey()]: dailyGoal(p) } })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addEntry: ({ date, meal, food, grams, photoId, note, planned }) => {
        const entry: LogEntry = {
          id: crypto.randomUUID(),
          date,
          loggedAt: Date.now(),
          meal,
          foodId: food.id,
          food: {
            name: food.name,
            state: food.state,
            per100: { ...food.per100 },
            source: food.source,
            fdcId: food.fdcId,
            ref: food.ref,
            sourceNote: food.sourceNote,
          },
          grams,
          photoId,
          note,
          ...(planned && { planned: true }),
        };
        set((s) => ({
          entries: [...s.entries, entry],
          recentFoodIds: [food.id, ...s.recentFoodIds.filter((id) => id !== food.id)].slice(0, 24),
          remoteFoods: food.source === 'off' ? { ...s.remoteFoods, [food.id]: food } : s.remoteFoods,
        }));
        return entry;
      },

      updateEntry: (id, patch) =>
        set((s) => {
          const old = s.entries.find((e) => e.id === id);
          if (old?.photoId && 'photoId' in patch && patch.photoId !== old.photoId) void deletePhoto(old.photoId);
          return { entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e)) };
        }),

      removeEntry: (id, opts) =>
        set((s) => {
          const e = s.entries.find((x) => x.id === id);
          if (e?.photoId && !opts?.keepPhoto) void deletePhoto(e.photoId);
          return { entries: s.entries.filter((x) => x.id !== id), deleted: { ...s.deleted, [id]: Date.now() } };
        }),

      rememberFood: (food) => set((s) => (food.source === 'off' ? { remoteFoods: { ...s.remoteFoods, [food.id]: food } } : {})),

      toggleFavorite: (foodId) =>
        set((s) => ({
          favoriteFoodIds: s.favoriteFoodIds.includes(foodId)
            ? s.favoriteFoodIds.filter((x) => x !== foodId)
            : [foodId, ...s.favoriteFoodIds],
        })),

      upsertCustomFood: (input) => {
        const now = Date.now();
        const existing = input.id ? get().customFoods.find((f) => f.id === input.id) : undefined;
        const food: CustomFood = {
          ...input,
          id: existing?.id ?? `custom:${crypto.randomUUID()}`,
          source: 'custom',
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        set((s) => ({
          customFoods: existing ? s.customFoods.map((f) => (f.id === food.id ? food : f)) : [food, ...s.customFoods],
        }));
        return food;
      },

      archiveCustomFood: (id, archived) =>
        set((s) => ({ customFoods: s.customFoods.map((f) => (f.id === id ? { ...f, archived, updatedAt: Date.now() } : f)) })),

      importData: (data) => {
        const d = data as Partial<State> & { app?: string };
        if (d?.app !== 'protein-app' || !Array.isArray(d.entries)) throw new Error('This file is not a Protein backup.');
        set({
          profile: d.profile ?? null,
          settings: { ...defaultSettings, ...d.settings },
          entries: d.entries,
          customFoods: d.customFoods ?? [],
          goalHistory: d.goalHistory ?? {},
          recentFoodIds: d.recentFoodIds ?? [],
          favoriteFoodIds: d.favoriteFoodIds ?? [],
          remoteFoods: d.remoteFoods ?? {},
          savedMeals: d.savedMeals ?? [],
          savedPlans: d.savedPlans ?? [],
          workoutPlan: d.workoutPlan ?? null,
          savedRecipes: d.savedRecipes ?? [],
          coachChats: (d as { coachChats?: State['coachChats'] }).coachChats ?? [],
          weights: d.weights ?? [],
          exercises: d.exercises ?? [],
          measurements: (d as { measurements?: MeasurementEntry[] }).measurements ?? [],
          routines: (d as { routines?: Routine[] }).routines ?? [],
          customExercises: (d as { customExercises?: CustomExercise[] }).customExercises ?? [],
          workoutLogs: (d as { workoutLogs?: WorkoutLog[] }).workoutLogs ?? [],
          water: (d as { water?: Record<string, number> }).water ?? {},
          sleep: (d as { sleep?: Record<string, SleepEntry> }).sleep ?? {},
          deleted: (d as { deleted?: Record<string, number> }).deleted ?? {},
        });
      },

      resetAll: () =>
        set({ profile: null, settings: defaultSettings, entries: [], customFoods: [], goalHistory: {}, recentFoodIds: [], favoriteFoodIds: [], remoteFoods: {}, savedMeals: [], savedPlans: [], workoutPlan: null, savedRecipes: [], coachChats: [], weights: [], exercises: [], measurements: [], routines: [], customExercises: [], workoutLogs: [], activeWorkout: null, progressPhotos: [], premium: null, perks: null, serverTier: null, picks: {}, water: {}, sleep: {}, deleted: {} }),
    }),
    {
      name: 'protein-app',
      version: 2,
      // v2: personal AI keys are no longer supported; remove any saved on this device.
      migrate: (persisted, from) => {
        const s = (persisted ?? {}) as { settings?: Record<string, unknown> };
        if (from < 2 && s.settings) delete s.settings.aiApiKey;
        return s as never;
      },
    },
  ),
);

// Stamp every change to user data, for cloud sync.
useStore.subscribe((s, prev) => {
  const changed =
    s.entries !== prev.entries || s.profile !== prev.profile || s.customFoods !== prev.customFoods ||
    s.goalHistory !== prev.goalHistory || s.favoriteFoodIds !== prev.favoriteFoodIds ||
    s.savedMeals !== prev.savedMeals || s.savedPlans !== prev.savedPlans || s.workoutPlan !== prev.workoutPlan || s.savedRecipes !== prev.savedRecipes || s.coachChats !== prev.coachChats || s.measurements !== prev.measurements || s.routines !== prev.routines || s.customExercises !== prev.customExercises || s.workoutLogs !== prev.workoutLogs || s.weights !== prev.weights || s.exercises !== prev.exercises || s.water !== prev.water || s.sleep !== prev.sleep || s.deleted !== prev.deleted;
  if (changed && s.lastModified === prev.lastModified) useStore.setState({ lastModified: Date.now() });
});

/** Goal that applied on a given day (falls back to the current profile goal). */
export function goalOn(date: string, goalHistory: Record<string, number>, profile: Profile | null): number {
  const keys = Object.keys(goalHistory).sort();
  let goal: number | null = null;
  for (const k of keys) if (k <= date) goal = goalHistory[k];
  if (goal == null) goal = keys.length ? goalHistory[keys[0]] : profile ? dailyGoal(profile) : 0;
  return goal;
}

export function exportData() {
  // Premium passes and personal API keys are never written to backup files.
  const { profile, settings, entries, customFoods, goalHistory, recentFoodIds, favoriteFoodIds, remoteFoods, savedMeals, savedPlans, workoutPlan, savedRecipes, coachChats, weights, exercises, measurements, routines, customExercises, workoutLogs, water, sleep, deleted } = useStore.getState();
  const safeSettings = settings;
  return { app: 'protein-app', exportedAt: new Date().toISOString(), profile, settings: safeSettings, entries, customFoods, goalHistory, recentFoodIds, favoriteFoodIds, remoteFoods, savedMeals, savedPlans, workoutPlan, savedRecipes, coachChats, weights, exercises, measurements, routines, customExercises, workoutLogs, water, sleep, deleted };
}

// Look-only mode (sign-up code not entered yet): saving is blocked and the code sheet opens.
{
  const WRITES = ['addEntry', 'updateEntry', 'removeEntry', 'addExercise', 'updateExercise', 'logWeight', 'addMeasurement', 'saveMeal', 'savePlan', 'saveRecipe', 'upsertCustomFood', 'addWater', 'saveRoutine', 'saveCustomExercise', 'addProgressPhoto', 'toggleFavorite', 'setActiveWorkout', 'logSleep'] as const;
  const s = useStore.getState() as unknown as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of WRITES) {
    const fn = s[k];
    if (typeof fn === 'function') patch[k] = (...a: unknown[]) => { guardWrite(); return (fn as (...x: unknown[]) => unknown)(...a); };
  }
  useStore.setState(patch as never);
}
