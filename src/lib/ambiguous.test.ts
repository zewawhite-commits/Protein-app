import { describe, expect, it } from 'vitest';
import { detailQuestion, detailQuery, parseSaid } from './describe';

const said = (s: string) => parseSaid(s).map((x) => x.text);
describe('vague foods: never invent, ask instead', () => {
  it('"I made / cooked / prepared …" is dropped, not matched against food names', () => {
    expect(said('I made chicken')).toEqual(['chicken']);
    expect(said('I prepared chicken')).toEqual(['chicken']);
    expect(said('I cooked fish')).toEqual(['fish']);
    expect(said('I made rice')).toEqual(['rice']);
    expect(said('I made pasta')).toEqual(['pasta']);
    expect(said('I fried plantain')).toEqual(['fried plantain']);
    expect(said('I made jollof rice')).toEqual(['jollof rice']);
  });
  it('asks what matters, only when it matters', () => {
    expect(detailQuestion('chicken')?.kind).toBe('chicken');
    expect(detailQuestion('fish')?.kind).toBe('fish');
    expect(detailQuestion('rice')?.kind).toBe('rice');
    expect(detailQuestion('pasta')?.kind).toBe('pasta');
    expect(detailQuestion('eggs')?.kind).toBe('egg');
    expect(detailQuestion('smoothie')?.kind).toBe('smoothie');
    expect(detailQuestion(said('I made a smoothie')[0])?.kind).toBe('smoothie');
    // Already specific: no question.
    expect(detailQuestion('jollof rice')).toBeNull();
    expect(detailQuestion('boiled eggs')).toBeNull();
    expect(detailQuestion('grilled tilapia')).toBeNull();
    expect(parseSaid('I ate two boiled eggs')).toEqual([expect.objectContaining({ text: 'boiled eggs', qty: 2 })]);
  });
  it('turns the answer into the right search', () => {
    expect(detailQuery('rice', 'rice', 'brown')[0]).toMatch(/brown/);
    expect(detailQuery('rice', 'rice', 'jollof')).toEqual(['jollof rice']);
    expect(detailQuery('egg', 'eggs', 'scrambled')[0]).toMatch(/scrambled/);
    expect(detailQuery('pasta', 'pasta', 'plain')[0]).toBe('pasta cooked');
  });
});
