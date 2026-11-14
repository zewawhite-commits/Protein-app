/**
 * Calories burned by exercise — an estimate: MET × body weight (kg) × hours.
 * MET values approximate the Compendium of Physical Activities (Ainsworth et al., 2011).
 * Shown labelled as an estimate; the user can type their own number (e.g. from a watch).
 */
export type ExerciseType = 'run' | 'walk' | 'cycle' | 'weights' | 'hiit' | 'swim' | 'sport' | 'yoga';
export type Intensity = 'low' | 'medium' | 'high';

export const EXERCISES: Record<ExerciseType, { label: string; met: Record<Intensity, number> }> = {
  run: { label: 'Run', met: { low: 6.0, medium: 9.8, high: 11.5 } },
  walk: { label: 'Walk', met: { low: 2.8, medium: 3.5, high: 5.0 } },
  cycle: { label: 'Cycling', met: { low: 4.0, medium: 6.8, high: 10.0 } },
  weights: { label: 'Weight lifting', met: { low: 3.5, medium: 5.0, high: 6.0 } },
  hiit: { label: 'HIIT / circuits', met: { low: 6.0, medium: 8.0, high: 10.0 } },
  swim: { label: 'Swimming', met: { low: 5.8, medium: 8.3, high: 10.0 } },
  sport: { label: 'Sport (football, etc.)', met: { low: 5.0, medium: 7.0, high: 9.0 } },
  yoga: { label: 'Yoga / pilates', met: { low: 2.5, medium: 3.0, high: 4.0 } },
};

export interface ExerciseEntry {
  id: string;
  date: string;
  type: ExerciseType;
  intensity: Intensity;
  minutes: number;
  kcal: number;
  /** True when the user typed the calories themselves. */
  manual?: boolean;
}

export function burnedKcal(type: ExerciseType, intensity: Intensity, minutes: number, kg: number): number {
  if (!kg || minutes <= 0) return 0;
  return Math.round(EXERCISES[type].met[intensity] * kg * (minutes / 60));
}
