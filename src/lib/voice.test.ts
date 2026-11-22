import { describe, expect, it } from 'vitest';
import { pickVoice } from './voice';
const v = (name: string, lang = 'en-GB', localService = true) => ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;
describe('voice', () => {
  it('prefers a natural female voice and never picks a male one when another exists', () => {
    expect(pickVoice([v('Daniel'), v('Samantha', 'en-US'), v('Arthur')], 'en-GB')?.name).toBe('Samantha');
    expect(pickVoice([v('Google UK English Male'), v('Google UK English Female')], 'en-GB')?.name).toBe('Google UK English Female');
    expect(pickVoice([v('Microsoft Guy Online (Natural)', 'en-US'), v('Microsoft Aria Online (Natural)', 'en-US'), v('Microsoft Zira', 'en-US')], 'en-US')?.name).toBe('Microsoft Aria Online (Natural)');
    expect(pickVoice([v('Daniel')], 'en-GB')).toBeNull();
  });
});
