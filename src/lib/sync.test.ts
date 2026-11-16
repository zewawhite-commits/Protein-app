import { describe, expect, it } from 'vitest';
import { mergeSnapshots } from './sync';

const now = Date.UTC(2026, 10, 16);
const e = (id: string, loggedAt: number, extra = {}) => ({ id, loggedAt, date: '2026-11-16', grams: 100, ...extra });

describe('merging two devices', () => {
  it('keeps food logged on both devices (the "disappearing food" bug)', () => {
    const phone = { entries: [e('lunch', now - 3000)] };
    const tablet = { entries: [e('snack', now - 2000)] };
    const m = mergeSnapshots(phone, tablet, now - 3000, now - 2000, now);
    expect(m.entries!.map((x) => x.id).sort()).toEqual(['lunch', 'snack']);
  });
  it('a newer edit wins, a delete stays deleted', () => {
    const a = { entries: [e('x', now - 9000, { grams: 100, updatedAt: now - 1000 }), e('y', now - 9000)] };
    const b = { entries: [e('x', now - 9000, { grams: 150, updatedAt: now - 5000 }), e('y', now - 9000)], deleted: { y: now - 500 } };
    const m = mergeSnapshots(a, b, now - 1000, now - 500, now);
    expect(m.entries).toEqual([e('x', now - 9000, { grams: 100, updatedAt: now - 1000 })]);
  });
  it('an item re-added after a delete comes back; old tombstones expire', () => {
    const m = mergeSnapshots({ entries: [e('z', now - 100)] }, { deleted: { z: now - 200, old: now - 100 * 864e5 } }, now - 100, now - 200, now);
    expect(m.entries!.map((x) => x.id)).toEqual(['z']);
    expect(m.deleted).toEqual({ z: now - 200 });
  });
  it('weigh-ins merge by date and settings come from the newer copy', () => {
    const a = { profile: { name: 'Old' }, weights: [{ date: '2026-11-01', kg: 80 }], deleted: { 'w:2026-11-02': now - 10 } };
    const b = { profile: { name: 'New' }, weights: [{ date: '2026-11-02', kg: 79 }, { date: '2026-11-03', kg: 78.5 }] };
    const m = mergeSnapshots(a, b, now - 100, now - 50, now);
    expect(m.profile).toEqual({ name: 'New' });
    expect(m.weights!.map((w) => w.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });
});
