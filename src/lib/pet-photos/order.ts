/**
 * Swap one photo with its neighbour. Returns the same array when the move
 * would leave the list, so callers can skip a no-op save.
 */
export function moveIdBy(
  ids: readonly string[],
  id: string,
  delta: -1 | 1
): string[] {
  const index = ids.indexOf(id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= ids.length) {
    return [...ids];
  }
  const copy = [...ids];
  const swap = copy[index];
  copy[index] = copy[next];
  copy[next] = swap;
  return copy;
}
