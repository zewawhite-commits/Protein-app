/**
 * App state, persisted to localStorage. This is the single data layer the UI
 * talks to, so it can later be backed by a server (e.g. Supabase) without
 * touching the screens.
 */
import type { WorkoutPlan } from '@/lib/workout';
import type { Recipe } from '@/lib/recipe';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CustomFood, Food, LogEntry, Meal, Profile, ProgressPhoto, SavedMeal, SavedPlan, Settings, WeightEntry } from '@/lib/types';
import { dailyGoal } from '@/lib/nutrition';
import { todayKey } from '@/lib/dates';
import { deletePhoto } from '@/lib/photos';
import type { ExerciseEntry } from '@/lib/exercise';

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
  addExercise: (e: Omit<ExerciseEntry, 'id'>) => void;
  removeExercise: (id: string) => void;
  progressPhotos: ProgressPhoto[];
  logWeight: (kg: number, date?: string) => void;
  removeWeight: (date: string) => void;
  addProgressPhoto: (p: Omit<ProgressPhoto, 'id'>) => void;
  removeProgressPhoto: (id: string) => void;
  savedPlans: SavedPlan[];
  /** The latest AI workout guide the person kept. */
  workoutPlan: { plan: WorkoutPlan; createdAt: number } | null;
  setWorkoutPlan: (plan: WorkoutPlan | null) => void;
  savedRecipes: { id: string; recipe: Recipe; createdAt: number }[];
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
  /** Free Pro time from the server (trial or invite rewards); the server stays the authority. */
  perks: { until: number; freePro: boolean; trialUsed: boolean; referrals: number; maxReferrals: number; referralDays: number } | null;
  setPerks: (p: State['perks']) => void;
  /** What this person picked for a name the AI gave ("jollof rice" → food id), so the next scan puts it first. */
  picks: Record<string, string>;
  rememberPick: (key: string, foodId: string) => void;

  saveProfile: (p: Profile) => void;
  updateSettings: (s: Partial<Settings>) => void;
  addEntry: (e: { date: string; meal: Meal; food: Food; grams: number; photoId?: string; note?: string }) => LogEntry;
  updateEntry: (id: string, patch: Partial<Pick<LogEntry, 'grams' | 'meal' | 'photoId' | 'note' | 'date'>>) => void;
  removeEntry: (id: string) => void;
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
      progressPhotos: [],
      premium: null,
      perks: null,
      picks: {},

      addExercise: (e) => set((s) => ({ exercises: [...s.exercises, { ...e, id: crypto.randomUUID() }] })),
      removeExercise: (id) => set((s) => ({ exercises: s.exercises.filter((x) => x.id !== id) })),

      logWeight: (kg, date = todayKey()) =>
        set((s) => {
          const weights = [...s.weights.filter((w) => w.date !== date), { date, kg: Math.round(kg * 10) / 10 }].sort((a, b) => a.date.localeCompare(b.date));
          const latest = weights[weights.length - 1];
          // The newest weigh-in becomes the profile weight (targets follow it).
          const profile = s.profile && latest ? { ...s.profile, bodyWeightKg: latest.kg } : s.profile;
          return { weights, profile, goalHistory: profile ? { ...s.goalHistory, [todayKey()]: dailyGoal(profile) } : s.goalHistory };
        }),
      removeWeight: (date) => set((s) => ({ weights: s.weights.filter((w) => w.date !== date) })),
      addProgressPhoto: (p) => set((s) => ({ progressPhotos: [...s.progressPhotos, { ...p, id: crypto.randomUUID() }].sort((a, b) => a.date.localeCompare(b.date)) })),
      removeProgressPhoto: (id) => set((s) => {
        const ph = s.progressPhotos.find((x) => x.id === id);
        if (ph) void deletePhoto(ph.photoId);
        return { progressPhotos: s.progressPhotos.filter((x) => x.id !== id) };
      }),

      saveMeal: (name, list) => {
        const meal: SavedMeal = { id: crypto.randomUUID(), name: name.trim() || 'My meal', createdAt: Date.now(), items: list.map((e) => ({ foodId: e.foodId, food: e.food, grams: e.grams })) };
        set((s) => ({ savedMeals: [meal, ...s.savedMeals].slice(0, 100) }));
        return meal;
      },
      removeSavedMeal: (id) => set((s) => ({ savedMeals: s.savedMeals.filter((m) => m.id !== id) })),
      savePlan: (p) => {
        const plan: SavedPlan = { ...p, id: crypto.randomUUID(), createdAt: Date.now() };
        set((s) => ({ savedPlans: [plan, ...s.savedPlans].slice(0, 30) }));
        return plan;
      },
      removeSavedPlan: (id) => set((s) => ({ savedPlans: s.savedPlans.filter((m) => m.id !== id) })),
      workoutPlan: null,
      setWorkoutPlan: (plan) => set({ workoutPlan: plan ? { plan, createdAt: Date.now() } : null }),
      savedRecipes: [],
      saveRecipe: (recipe) => {
        const id = crypto.randomUUID();
        set((s) => ({ savedRecipes: [{ id, recipe, createdAt: Date.now() }, ...s.savedRecipes].slice(0, 60) }));
        return id;
      },
      removeRecipe: (id) => set((s) => ({ savedRecipes: s.savedRecipes.filter((r) => r.id !== id) })),

      setPremium: (premium) => set({ premium }),
      setPerks: (perks) => set({ perks }),
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

      addEntry: ({ date, meal, food, grams, photoId, note }) => {
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
          return { entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
        }),

      removeEntry: (id) =>
        set((s) => {
          const e = s.entries.find((x) => x.id === id);
          if (e?.photoId) void deletePhoto(e.photoId);
          return { entries: s.entries.filter((x) => x.id !== id) };
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
          weights: d.weights ?? [],
          exercises: d.exercises ?? [],
        });
      },

      resetAll: () =>
        set({ profile: null, settings: defaultSettings, entries: [], customFoods: [], goalHistory: {}, recentFoodIds: [], favoriteFoodIds: [], remoteFoods: {}, savedMeals: [], savedPlans: [], workoutPlan: null, savedRecipes: [], weights: [], exercises: [], progressPhotos: [], premium: null, perks: null, picks: {} }),
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
    s.savedMeals !== prev.savedMeals || s.savedPlans !== prev.savedPlans || s.workoutPlan !== prev.workoutPlan || s.savedRecipes !== prev.savedRecipes || s.weights !== prev.weights || s.exercises !== prev.exercises;
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
  const { profile, settings, entries, customFoods, goalHistory, recentFoodIds, favoriteFoodIds, remoteFoods, savedMeals, savedPlans, workoutPlan, savedRecipes, weights, exercises } = useStore.getState();
  const safeSettings = settings;
  return { app: 'protein-app', exportedAt: new Date().toISOString(), profile, settings: safeSettings, entries, customFoods, goalHistory, recentFoodIds, favoriteFoodIds, remoteFoods, savedMeals, savedPlans, workoutPlan, savedRecipes, weights, exercises };
}
