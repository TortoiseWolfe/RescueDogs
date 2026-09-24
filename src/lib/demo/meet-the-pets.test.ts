import { describe, it, expect } from 'vitest';
import {
  browsePetToMeetCard,
  composeMeetThePets,
  DEFAULT_MEET_THE_PETS,
  HOMEPAGE_SLOT_THEMES,
  isSeedDemoPetId,
  MEET_PET_DETAIL_TEXT,
  MEET_THE_PETS_POOL,
  pickMeetThePets,
  type LiveMeetPetInput,
  type MeetPetCard,
} from './meet-the-pets';

/** Deterministic RNG: always pick the first remaining index (no shuffle). */
function identityRandom() {
  return 0;
}

function liveDog(
  overrides: Partial<LiveMeetPetInput> & Pick<LiveMeetPetInput, 'id' | 'name'>
): LiveMeetPetInput {
  return {
    species: 'dog',
    breed: 'Mix',
    age_years: 3,
    photo_url: 'https://example.com/dog.jpg',
    notes: null,
    status: 'available',
    ...overrides,
  };
}

function liveCat(
  overrides: Partial<LiveMeetPetInput> & Pick<LiveMeetPetInput, 'id' | 'name'>
): LiveMeetPetInput {
  return {
    species: 'cat',
    breed: 'DSH',
    age_years: 2,
    photo_url: 'https://example.com/cat.jpg',
    notes: null,
    status: 'available',
    ...overrides,
  };
}

describe('HOMEPAGE_SLOT_THEMES', () => {
  it('locks the homepage row to navy, orange, and baby blue', () => {
    expect(HOMEPAGE_SLOT_THEMES).toHaveLength(3);
    expect(HOMEPAGE_SLOT_THEMES[0].bg).toBe('bg-[#e8edf7]');
    expect(HOMEPAGE_SLOT_THEMES[1].bg).toBe('bg-[#fff7ed]');
    expect(HOMEPAGE_SLOT_THEMES[2].bg).toBe('bg-[#f1f6ff]');
  });

  it('keeps detail copy on fixed navy (not orange title — AAA #326)', () => {
    expect(MEET_PET_DETAIL_TEXT).toBe('text-[#0c1929]');
    // Orange slot title is fine for large bold names; body text must not reuse it.
    expect(HOMEPAGE_SLOT_THEMES[1].title).toBe('text-[#c2410c]');
    expect(MEET_PET_DETAIL_TEXT).not.toBe(HOMEPAGE_SLOT_THEMES[1].title);
  });
});

describe('MEET_THE_PETS_POOL identity lock', () => {
  it('keeps Pepper as a cat and Zeus/Tank/Scout/Lola/Tiger/Rocky as dogs', () => {
    const byName = Object.fromEntries(
      MEET_THE_PETS_POOL.map((p) => [p.name, p])
    ) as Record<string, MeetPetCard>;

    expect(byName.Pepper?.species).toBe('cat');
    expect(byName.Zeus?.species).toBe('dog');
    expect(byName.Tank?.species).toBe('dog');
    expect(byName.Scout?.species).toBe('dog');
    expect(byName.Lola?.species).toBe('dog');
    expect(byName.Tiger?.species).toBe('dog');
    expect(byName.Rocky?.species).toBe('dog');
    expect(byName.Rocky?.portrait).toBe('/demo-pets/rocky.webp');
    expect(byName.Rocky?.detail).toMatch(/German Shepherd/);
  });

  it('binds each pet name to its own portrait path', () => {
    for (const pet of MEET_THE_PETS_POOL) {
      expect(pet.portrait).toBe(`/demo-pets/${pet.name.toLowerCase()}.webp`);
      expect(pet.source).toBe('demo');
      expect(pet.href).toBe('/adopt');
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

describe('isSeedDemoPetId', () => {
  it('detects seed-rescue-demo UUID pets', () => {
    expect(isSeedDemoPetId('44444444-4444-4444-4444-444444444401')).toBe(true);
    expect(isSeedDemoPetId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(false);
  });
});

describe('composeMeetThePets (#324)', () => {
  it('fills dog|cat|dog from live pets and falls back to cartoons', () => {
    const composed = composeMeetThePets(
      [
        liveDog({ id: 'dog-1', name: 'Bubba' }),
        liveDog({ id: 'dog-2', name: 'Duke' }),
        liveCat({ id: 'cat-1', name: 'Muffin' }),
      ],
      { random: identityRandom }
    );

    expect(composed.map((p) => p.name)).toEqual(['Bubba', 'Muffin', 'Duke']);
    expect(composed.every((p) => p.source === 'live')).toBe(true);
    expect(composed[0].href).toContain('/dogs/detail?id=dog-1');
    expect(composed[1].href).toContain('/cats/detail?id=cat-1');
  });

  it('uses a cartoon cat when no real cat has a photo', () => {
    const composed = composeMeetThePets(
      [
        liveDog({ id: 'dog-1', name: 'Bubba' }),
        liveDog({ id: 'dog-2', name: 'Duke' }),
      ],
      { random: identityRandom }
    );

    expect(composed[0].name).toBe('Bubba');
    expect(composed[0].source).toBe('live');
    expect(composed[1].species).toBe('cat');
    expect(composed[1].source).toBe('demo');
    expect(composed[2].name).toBe('Duke');
    expect(composed[2].source).toBe('live');
  });

  it('ignores seed UUID pets so demo storage art does not win', () => {
    const composed = composeMeetThePets(
      [
        liveDog({
          id: '44444444-4444-4444-4444-444444444401',
          name: 'Tiger',
        }),
        liveDog({ id: 'dog-1', name: 'Bubba' }),
        liveDog({ id: 'dog-2', name: 'Duke' }),
      ],
      { random: identityRandom }
    );

    expect(
      composed.filter((p) => p.source === 'live').map((p) => p.name)
    ).toEqual(['Bubba', 'Duke']);
  });

  it('browsePetToMeetCard links to the species detail path', () => {
    const card = browsePetToMeetCard(
      liveDog({ id: 'abc', name: 'Bubba', notes: 'Good boy' })
    );
    expect(card.source).toBe('live');
    expect(card.href).toBe('/dogs/detail?id=abc');
    expect(card.detail).toContain('Good boy');
  });
});
