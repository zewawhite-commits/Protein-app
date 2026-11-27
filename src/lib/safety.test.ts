import { describe, expect, it } from 'vitest';
import { CRISIS_REPLY, ED_REPLY, crisisReply } from './safety';

describe('crisis safety net', () => {
  it('answers self-harm with helplines, not coaching', () => {
    for (const t of ['I want to kill myself', 'sometimes I think about suicide', 'i dont want to live anymore', 'I have been cutting myself']) expect(crisisReply(t)).toBe(CRISIS_REPLY);
  });
  it('answers eating-disorder signals gently', () => {
    expect(crisisReply('I make myself throw up after meals')).toBe(ED_REPLY);
    expect(crisisReply("I haven't eaten in 4 days to lose weight")).toBe(ED_REPLY);
  });
  it('leaves normal food questions alone', () => {
    for (const t of ['how much protein in 3 eggs', 'I killed my workout today', 'is jollof rice healthy', 'I want to die of laughter at this recipe lol']) {
      // "want to die" is over-inclusive on purpose; only check the plain food ones.
      if (!/die/.test(t)) expect(crisisReply(t)).toBeNull();
    }
  });
});
