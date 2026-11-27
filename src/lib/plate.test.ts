import { describe, expect, it } from 'vitest';
import { plateParts } from './plate';
describe('plate parts', () => {
  it('splits meals from any cuisine', () => {
    expect(plateParts('okra soup with assorted meat and eba')).toEqual(['okra soup', 'assorted meat', 'eba']);
    expect(plateParts('rice + beans + plantain')).toEqual(['rice', 'beans', 'plantain']);
    expect(plateParts('salmon, rice, broccoli')).toEqual(['salmon', 'rice', 'broccoli']);
    expect(plateParts('chicken biryani with raita')).toEqual(['chicken biryani', 'raita']);
    expect(plateParts('feijoada')).toEqual(['feijoada']);
  });
});
