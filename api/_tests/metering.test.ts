import { afterEach, describe, expect, it, vi } from 'vitest';
import { BURST_PER_MIN, CEILING, REVIEW, costOf } from '../_lib/metering.js';

describe('AI cost metering', () => {
  it('prices calls from the model’s own token counts', () => {
    // Opus 5.5: $4 in / $20 out per million tokens.
    expect(costOf('claude-opus-5-5', { input_tokens: 3000, output_tokens: 1000 })).toBeCloseTo(0.032, 6);
    // Sonnet 5.5: $2 / $10, cache reads $0.10.
    expect(costOf('claude-sonnet-5-5', { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 10000 })).toBeCloseTo(0.002 + 0.005 + 0.001, 6);
  });
  it('daily fair-use limits sit well above review alerts and normal use (a heavy real day is ~10–20 scans)', () => {
    for (const k of Object.keys(CEILING) as (keyof typeof CEILING)[]) expect(CEILING[k]!).toBeGreaterThanOrEqual(2 * REVIEW[k]!);
    expect(CEILING.scan).toBe(50);
    expect(CEILING.coach).toBe(150);
    expect(BURST_PER_MIN).toBeGreaterThanOrEqual(10);
  });
});

describe('fair use decisions', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('../_lib/accounts.js'); });
  async function withCounts(counts: Record<string, number>) {
    vi.doMock('../_lib/accounts.js', () => ({
      admin: () => ({
        rpc: async (_: string, a: { p_key: string }) => ({ data: Object.entries(counts).find(([k]) => a.p_key.startsWith(k))?.[1] ?? 1, error: null }),
        from: () => ({ insert: async () => ({}) }),
      }),
    }));
    return import('../_lib/metering.js');
  }
  const who = { userId: 'u1', tier: 'plus' };
  it('normal Plus use is never stopped', async () => {
    const m = await withCounts({ 'd:scan': 30 });
    expect(await m.fairUse('scan', who, true)).toEqual({ ok: true });
  });
  it('bot-like bursts are slowed down, for every plan', async () => {
    const m = await withCounts({ b1: 13 });
    expect(await m.fairUse('coach', { ...who, tier: 'free' }, false)).toMatchObject({ ok: false, status: 429 });
  });
  it('bulk use far beyond personal use pauses that feature for the day, with a clear reason', async () => {
    const m = await withCounts({ 'd:scan': 201 });
    const v = await m.fairUse('scan', who, true);
    expect(v).toMatchObject({ ok: false, status: 429 });
    expect((v as { error: string }).error).toMatch(/fair-use limit for AI photo scans \(50 a day\)[\s\S]*resets tomorrow/);
  });
  it('counters unavailable → never blocks', async () => {
    vi.doMock('../_lib/accounts.js', () => ({ admin: () => ({ rpc: async () => ({ data: null, error: { message: 'missing' } }), from: () => ({ insert: async () => ({}) }) }) }));
    const m = await import('../_lib/metering.js');
    expect(await m.fairUse('scan', who, true)).toEqual({ ok: true });
  });
  it('the same request twice within seconds is answered once', async () => {
    const m = await withCounts({ dup: 2 });
    expect(await m.isDuplicate('u1', 'same photo')).toBe(true);
  });
});
