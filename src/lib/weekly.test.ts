import { describe, expect, it } from 'vitest';
import { lastWeekStart, weeklyReport } from './weekly';
import type { Food, LogEntry } from './types';

const food = { id: 'f', name: 'Chicken breast, grilled', per100: { kcal: 150, protein: 30, carbs: 0, fat: 3 } } as unknown as Food;
const e = (date: string, grams: number, planned = false) => ({ id: date + grams, date, meal: 'lunch', foodId: 'f', food, grams, createdAt: 0, ...(planned && { planned }) }) as unknown as LogEntry;

describe('weekly report', () => {
  it('uses last Monday–Sunday', () => {
    expect(lastWeekStart('2026-11-22')).toBe('2026-11-09'); // Sunday → the week before last Monday
    expect(lastWeekStart('2026-11-23')).toBe('2026-11-16'); // Monday
  });
  it('averages only logged days and ignores planned food', () => {
    const r = weeklyReport({
      entries: [e('2026-11-16', 400), e('2026-11-17', 200), e('2026-11-18', 1000, true), e('2026-11-10', 100)],
      weights: [{ date: '2026-11-16', kg: 80 }, { date: '2026-11-22', kg: 79.4 }],
      workoutDates: ['2026-11-17', '2026-11-17', '2026-11-20'], today: '2026-11-23', proteinGoal: () => 100, kcalTarget: 2000,
    });
    expect(r).toMatchObject({ from: '2026-11-16', to: '2026-11-22', daysLogged: 2, protein: 90, kcal: 450, proteinDaysHit: 1, workouts: 2, weight: { start: 80, end: 79.4 } });
    expect(r.previous).toMatchObject({ daysLogged: 1, protein: 30 });
  });
});
