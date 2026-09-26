import { describe, it, expect } from 'vitest';
import { moveIdBy } from './order';

describe('moveIdBy', () => {
  it('swaps a photo with its neighbour', () => {
    expect(moveIdBy(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveIdBy(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the list unchanged at either end', () => {
    expect(moveIdBy(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(moveIdBy(['a', 'b'], 'b', 1)).toEqual(['a', 'b']);
    expect(moveIdBy(['a'], 'missing', 1)).toEqual(['a']);
  });
});
