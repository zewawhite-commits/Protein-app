import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { cleanTurns, coachWithClient, sanitizeReply } from './coach';

describe('coach', () => {
  it('accepts only alternating conversations that end with the user', () => {
    expect(cleanTurns([{ role: 'user', content: 'hi' }])).toHaveLength(1);
    expect(cleanTurns([{ role: 'assistant', content: 'x' }, { role: 'user', content: 'hi' }])).toHaveLength(1);
    // Two questions in a row (after a failed reply) are merged, never rejected.
    expect(cleanTurns([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }])).toEqual([{ role: 'user', content: 'a\n\nb' }]);
    expect(cleanTurns([{ role: 'user', content: 'a' }, { role: 'assistant', content: '' }, { role: 'user', content: 'b' }])).toHaveLength(1);
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

  it('attaches a photo to the latest message only', async () => {
    let req: any;
    const client = { beta: { messages: { create: async (r: unknown) => { req = r; return { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"reply":"I see jollof rice.","foods":[]}' }] }; } } } } as unknown as Anthropic;
    await coachWithClient(client, [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }, { role: 'user', content: 'What is this?' }], {}, { data: 'AAAA', mediaType: 'image/jpeg' });
    expect(req.messages[0].content).toBe('hi');
    expect(req.messages[2].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
    expect(req.messages[2].content[1]).toEqual({ type: 'text', text: 'What is this?' });
  });
});

import { sanitizePlan } from './plan';
describe('eating plan', () => {
  it('keeps a clean shape and strips nutrient numbers from tips', () => {
    const p = sanitizePlan({ title: 'Strong day', meals: [{ meal: 'breakfast', title: 'Eggs', items: [{ name: 'Eggs', localName: '', searchQueries: ['egg whole hard-boiled'], grams: 100 }] }, { meal: 'brunch', title: 'x', items: [{ name: 'a' }] }, { meal: 'lunch', title: 'Empty', items: [] }], tips: ['Eat 30 g protein at breakfast'] });
    expect(p.meals).toHaveLength(1);
    expect(p.meals[0].items[0]).toEqual({ name: 'Eggs', localName: '', searchQueries: ['egg whole hard-boiled'], grams: 100 });
    expect(p.tips[0]).not.toMatch(/30 g/);
  });
});

import { partialReply } from './coach';
describe('streaming reply', () => {
  it('reads the reply text from partial JSON as it arrives', () => {
    expect(partialReply('{"rep')).toBe('');
    expect(partialReply('{"reply":"Hi Ada, try')).toBe('Hi Ada, try');
    expect(partialReply('{"reply":"Line one\\nLine \\"two\\"","foods":[]')).toBe('Line one\nLine "two"');
    expect(partialReply('{"reply":"caf\\u00e9 and')).toBe('café and');
    expect(partialReply('{"reply":"ends with \\')).toBe('ends with ');
  });
});
