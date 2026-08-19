import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MEET_THE_PETS,
  HOMEPAGE_SLOT_THEMES,
  MEET_THE_PETS_POOL,
  pickMeetThePets,
  type MeetPetCard,
} from './meet-the-pets';

/** Deterministic RNG: always pick the first remaining index (no shuffle). */
function identityRandom() {
  return 0;
}

describe('HOMEPAGE_SLOT_THEMES', () => {
  it('locks the homepage row to navy, orange, and baby blue', () => {
    expect(HOMEPAGE_SLOT_THEMES).toHaveLength(3);
    expect(HOMEPAGE_SLOT_THEMES[0].bg).toBe('bg-[#e8edf7]');
    expect(HOMEPAGE_SLOT_THEMES[1].bg).toBe('bg-[#fff7ed]');
    expect(HOMEPAGE_SLOT_THEMES[2].bg).toBe('bg-[#f1f6ff]');
  });
});

describe('MEET_THE_PETS_POOL identity lock', () => {
  it('keeps Pepper as a cat and Zeus/Tank/Scout/Lola/Tiger as dogs', () => {
    const byName = Object.fromEntries(
      MEET_THE_PETS_POOL.map((p) => [p.name, p])
    ) as Record<string, MeetPetCard>;

    expect(byName.Pepper?.species).toBe('cat');
    expect(byName.Zeus?.species).toBe('dog');
    expect(byName.Tank?.species).toBe('dog');
    expect(byName.Scout?.species).toBe('dog');
    expect(byName.Lola?.species).toBe('dog');
    expect(byName.Tiger?.species).toBe('dog');
  });

  it('binds each pet name to its own portrait path', () => {
    for (const pet of MEET_THE_PETS_POOL) {
      expect(pet.portrait).toBe(`/demo-pets/${pet.name.toLowerCase()}.png`);
    }
  });
});

describe('pickMeetThePets', () => {
  it('always returns two dogs and one cat in dog|cat|dog order', () => {
    for (let i = 0; i < 40; i += 1) {
      const picked = pickMeetThePets(MEET_THE_PETS_POOL, Math.random);
      expect(picked).toHaveLength(3);
      expect(picked[0].species).toBe('dog');
      expect(picked[1].species).toBe('cat');
      expect(picked[2].species).toBe('dog');
      expect(new Set(picked.map((p) => p.name)).size).toBe(3);
    }
  });

  it('falls back to the default trio when the pool is too small', () => {
    const tiny = MEET_THE_PETS_POOL.filter((p) => p.name === 'Pepper');
    expect(pickMeetThePets(tiny, identityRandom)).toEqual([
      ...DEFAULT_MEET_THE_PETS,
    ]);
  });

  it('is deterministic for a fixed RNG', () => {
    const a = pickMeetThePets(MEET_THE_PETS_POOL, identityRandom);
    const b = pickMeetThePets(MEET_THE_PETS_POOL, identityRandom);
    expect(a.map((p) => p.name)).toEqual(b.map((p) => p.name));
    expect(a[0].species).toBe('dog');
    expect(a[1].species).toBe('cat');
    expect(a[2].species).toBe('dog');
  });
});
