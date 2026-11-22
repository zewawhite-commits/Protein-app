import { describe, expect, it } from 'vitest';
import { WORKOUTS } from './workouts';
import { LIBRARY } from './exerciseLibrary';

describe('ready-made workouts', () => {
  it('only use exercises from the library (each has a written guide)', () => {
    const names = new Set(LIBRARY.map((e) => e.name));
    const missing = WORKOUTS.flatMap((w) => w.moves.filter(([n]) => !names.has(n)).map(([n]) => `${w.id}: ${n}`));
    expect(missing).toEqual([]);
    expect(new Set(WORKOUTS.map((w) => w.id)).size).toBe(WORKOUTS.length);
  });
});
