import { describe, expect, it } from 'vitest';
import { completedActivities, parseExercise } from './exercise';

const one = (s: string) => parseExercise(s).map(({ type, minutes, intensity, km }) => [type, minutes, intensity, km ?? null]);

describe('saying what exercise you did', () => {
  it.each([
    ['I walked for 30 minutes', [['walk', 30, 'medium', null]]],
    ['ran 5k in 28 mins', [['run', 28, 'medium', 5]]],
    ['football for an hour', [['sport', 60, 'medium', null]]],
    ['did weights at the gym for 45 min', [['weights', 45, 'medium', null]]],
    ['an hour and a half of hard cycling', [['cycle', 90, 'high', null]]],
    ['easy swim half an hour', [['swim', 30, 'low', null]]],
    ['1h20m yoga', [['yoga', 80, 'medium', null]]],
    ['walked 20 minutes and did 40 minutes of weights', [['walk', 20, 'medium', null], ['weights', 40, 'medium', null]]],
    ['danced for 2 hours', [['sport', 120, 'medium', null]]],
  ])('"%s"', (s, want) => expect(one(s)).toEqual(want));
  it('never invents a time that was not said', () => {
    expect(one('went for a run')).toEqual([['run', null, 'medium', null]]);
    expect(one('walked 3 miles')).toEqual([['walk', null, 'medium', 4.83]]);
  });
  it('keeps a time even when the activity is unclear, so the person can pick it', () => {
    expect(one('trained 30 minutes')).toEqual([[null, 30, 'medium', null]]);
  });
});

describe('coach chat: completed activities only', () => {
  it('offers what was done', () => {
    expect(completedActivities('I walked 40 minutes this morning').length).toBe(1);
    expect(completedActivities('just finished a 30 min run').length).toBe(1);
  });
  it('ignores plans and questions', () => {
    expect(completedActivities('should I run 30 minutes tomorrow?')).toEqual([]);
    expect(completedActivities('I will walk 20 minutes later')).toEqual([]);
    expect(completedActivities('how many calories does a 30 minute run burn?')).toEqual([]);
  });
});
