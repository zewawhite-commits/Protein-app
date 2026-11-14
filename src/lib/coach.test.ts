import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { cleanTurns, coachWithClient, sanitizeReply } from './coach';

describe('coach', () => {
  it('accepts only alternating conversations that end with the user', () => {
    expect(cleanTurns([{ role: 'user', content: 'hi' }])).toHaveLength(1);
    expect(cleanTurns([{ role: 'assistant', content: 'x' }, { role: 'user', content: 'hi' }])).toHaveLength(1);
    expect(cleanTurns([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }])).toBeNull();
    expect(cleanTurns([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }])).toBeNull();
    expect(cleanTurns([{ role: 'system', content: 'evil' }])).toBeNull();
    expect(cleanTurns('nope')).toBeNull();
  });

  it('cleans replies', () => {
    const r = sanitizeReply({ reply: 'Try moi moi', foods: [{ name: 'Bean pudding', localName: 'Moi moi', searchQueries: ['moi moi', 'cowpeas cooked'], portionGrams: 99999 }, { name: '' }] });
    expect(r.foods).toEqual([{ name: 'Bean pudding', localName: 'Moi moi', searchQueries: ['moi moi', 'cowpeas cooked'], portionGrams: 0 }]);
  });

  it('sends the profile as context with structured output and fallbacks', async () => {
    let req: any;
    const client = { beta: { messages: { create: async (r: unknown) => { req = r; return { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"reply":"Have eggs.","foods":[]}' }] }; } } } } as unknown as Anthropic;
    const out = await coachWithClient(client, [{ role: 'user', content: 'Breakfast?' }], { country: 'Nigeria', goals: ['muscle'], targets: { kcal: 2500, protein: 140 } });
    expect(out.reply).toBe('Have eggs.');
    expect(req.fallbacks).toBe('default');
    expect(req.output_config.format.type).toBe('json_schema');
    expect(req.system[1].text).toContain('Country: Nigeria');
    expect(req.system[1].text).toContain('2500 kcal');
    expect(req.messages).toEqual([{ role: 'user', content: 'Breakfast?' }]);
  });
});
