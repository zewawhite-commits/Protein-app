/**
 * Meal slots. Everyone has the four main ones; people who eat more often can switch on up
 * to three more in Settings (Meals per day: 4–7).
 */
import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import type { Meal } from './types';

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast', snack: 'Snack', lunch: 'Lunch', snack2: 'Afternoon snack', dinner: 'Dinner', snack3: 'Evening snack', extra: 'Late meal',
};
/** Day order. */
export const MEAL_ORDER: Meal[] = ['breakfast', 'snack', 'lunch', 'snack2', 'dinner', 'snack3', 'extra'];
export const EXTRA_MEALS: Meal[] = ['snack2', 'snack3', 'extra'];
export const mealLabel = (m: string) => MEAL_LABELS[m as Meal] ?? m;
/** The feed only knows the four main meals. */
export const feedMeal = (m: Meal): 'breakfast' | 'lunch' | 'dinner' | 'snack' => (m === 'snack2' || m === 'snack3' || m === 'extra' ? 'snack' : m);

/** The slots to offer, in day order: the four main ones, plus any extras switched on. */
export function mealsFor(perDay = 4): Meal[] {
  const extras = EXTRA_MEALS.slice(0, Math.max(0, Math.min(3, perDay - 4)));
  return MEAL_ORDER.filter((m) => !EXTRA_MEALS.includes(m) || extras.includes(m));
}

export function useMealOptions(current?: Meal) {
  const perDay = useStore((s) => s.settings.mealsPerDay ?? 4);
  return useMemo(() => {
    const list = mealsFor(perDay);
    if (current && !list.includes(current)) list.splice(MEAL_ORDER.indexOf(current), 0, current);
    return list.map((value) => ({ value, label: MEAL_LABELS[value] }));
  }, [perDay, current]);
}
