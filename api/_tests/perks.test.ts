import { describe, expect, it } from 'vitest';
import { checkReferral, extend, inviteCode, perksFrom, planTrial, userIdFromCode } from '../_lib/perks.js';
import { limitFor } from '../_lib/quota.js';

const DAY = 864e5;
const now = Date.UTC(2026, 10, 16);
const uid = '8f3e2a10-1b2c-4d5e-8f90-a1b2c3d4e5f6';

describe('free Pro time', () => {
  it('invite codes round-trip and are short', () => {
    const c = inviteCode(uid);
    expect(c).toHaveLength(22);
    expect(userIdFromCode(c)).toBe(uid);
    expect(userIdFromCode('nope')).toBeNull();
  });

  it('trial is 7 days, once; invited friends get 14', () => {
    const fresh = perksFrom({});
    const t = planTrial(fresh, now);
    expect(t.ok && t.proUntil).toBe(now + 3 * DAY);
    expect(planTrial({ ...fresh, trialUsed: true }, now).ok).toBe(false);
    const inv = planTrial({ ...fresh, referredBy: 'x' }, now);
    expect(inv.ok && inv.days).toBe(14);
  });

  it('extra days stack on time already given', () => {
    expect(extend(now + 3 * DAY, 7, now)).toBe(now + 10 * DAY);
    expect(extend(now - 50 * DAY, 7, now)).toBe(now + 7 * DAY);
  });

  it('invites: valid code, not your own, once, new accounts only', () => {
    const code = inviteCode(uid);
    const me = '11111111-1111-1111-1111-111111111111';
    expect(checkReferral({ userId: me, createdAt: now - DAY, perks: perksFrom({}), code, now })).toEqual({ ok: true, inviterId: uid });
    expect(checkReferral({ userId: uid, createdAt: now, perks: perksFrom({}), code, now }).ok).toBe(false);
    expect(checkReferral({ userId: me, createdAt: now, perks: perksFrom({ referred_by: uid }), code, now }).ok).toBe(false);
    expect(checkReferral({ userId: me, createdAt: now - 30 * DAY, perks: perksFrom({}), code, now }).ok).toBe(false);
    expect(checkReferral({ userId: me, createdAt: now, perks: perksFrom({}), code: 'garbage', now }).ok).toBe(false);
  });

  it('free Pro time has every Pro feature, capped', () => {
    for (const f of ['scan', 'coach', 'workout', 'recipe', 'plan', 'ideas'] as const) {
      expect(limitFor('trial', f)).toBeGreaterThan(0);
      expect(limitFor('trial', f)).toBeLessThan(900);
    }
  });
});

import { popularFrom } from '../_lib/popular.js';
describe('learning from corrections', () => {
  it('prefers a record only when enough people agree', () => {
    const rows = (name: string, id: string, n: number) => Array.from({ length: n }, () => ({ ai_name: name, chosen_food_id: id }));
    expect(popularFrom([...rows('Jollof Rice', 'recipe:r002', 4), ...rows('jollof rice', 'usda:1', 1)])).toEqual({ 'jollof rice': 'recipe:r002' });
    expect(popularFrom(rows('Fried plantain', 'usda:2', 2))).toEqual({});
    expect(popularFrom([...rows('Eba', 'a', 3), ...rows('Eba', 'b', 3)])).toEqual({});
  });
});

import { GET as health } from '../_premium/health.js';
describe('AI health check', () => {
  it('says plainly when the key is missing', async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(await (await health()).json()).toMatchObject({ ai: 'missing-key' });
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });
});
