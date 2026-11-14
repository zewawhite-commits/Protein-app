/**
 * App state, persisted to localStorage. This is the single data layer the UI
 * talks to, so it can later be backed by a server (e.g. Supabase) without
 * touching the screens.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CustomFood, Food, LogEntry, Meal, Profile, Settings } from '@/lib/types';
import { dailyGoal } from '@/lib/nutrition';
import { todayKey } from '@/lib/dates';
import { deletePhoto } from '@/lib/photos';

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
        });
      },

      resetAll: () =>
        set({ profile: null, settings: defaultSettings, entries: [], customFoods: [], goalHistory: {}, recentFoodIds: [], favoriteFoodIds: [], remoteFoods: {} }),
    }),
    { name: 'protein-app', version: 1 },
  ),
);

/** Goal that applied on a given day (falls back to the current profile goal). */
export function goalOn(date: string, goalHistory: Record<string, number>, profile: Profile | null): number {
  const keys = Object.keys(goalHistory).sort();
  let goal: number | null = null;
  for (const k of keys) if (k <= date) goal = goalHistory[k];
  if (goal == null) goal = keys.length ? goalHistory[keys[0]] : profile ? dailyGoal(profile) : 0;
  return goal;
}

export function exportData() {
  const { profile, settings, entries, customFoods, goalHistory, recentFoodIds, favoriteFoodIds, remoteFoods } = useStore.getState();
  // The personal API key is never written to backup files.
  const { aiApiKey: _omit, ...safeSettings } = settings;
  void _omit;
  return { app: 'protein-app', exportedAt: new Date().toISOString(), profile, settings: safeSettings, entries, customFoods, goalHistory, recentFoodIds, favoriteFoodIds, remoteFoods };
}
