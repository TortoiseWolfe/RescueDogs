/**
 * Homepage Meet-the-Pets pool (#165).
 * Identity lock — name ↔ species ↔ breed ↔ portrait never cross
 * (same lock as seed / #164). Rocky = German Shepherd (#254).
 *
 * Live listings (#324 / #574): prefer real available pets with photos over
 * cartoon demos. The row is the first three real pets, any species — a
 * missing cat does not reserve a seat. Seed UUID pets (4444…) stay out
 * of the “real” pool so demo storage cartoons don’t crowd out Bubba/Duke.
 */

import {
  formatPetBreedLabel,
  formatPetSizeLabel,
} from '@/app/_browse/browse-labels';
import { petDetailPath } from '@/lib/browse/pet-links';
import { formatPetAgePhrase } from '@/lib/pet-age';
import type { PetSize } from '@/types/applications';

export type MeetPetSpecies = 'dog' | 'cat';

export interface MeetPetCard {
  /** Present for live browse pets; demo cartoons omit this. */
  id?: string;
  name: string;
  species: MeetPetSpecies;
  /** Local `/demo-pets/…` path or absolute Supabase photo URL. */
  portrait: string;
  portraitAlt: string;
  /** Breed line. Demo cats use the breed named in the portrait alt. */
  breed: string | null;
  /** Display size. Demo cartoons omit it. */
  size: string | null;
  age: string | null;
  /** Short trait or listing notes, separate from the facts. */
  notes: string | null;
  bg: string;
  border: string;
  image: string;
  title: string;
  cta: string;
  /** Where “Meet {name}” goes — detail page for live, /adopt for demo. */
  href: string;
  source: 'live' | 'demo';
}

/** Minimal browse fields needed to build a homepage card. */
export type LiveMeetPetInput = {
  id: string;
  name: string;
  species: MeetPetSpecies;
  breed: string | null;
  size: PetSize | null;
  age_years: number | null;
  photo_url: string | null;
  notes: string | null;
  status: string;
};

/** Demo seed pets from `seed-rescue-demo.sql` (cartoon files in storage). */
export function isSeedDemoPetId(id: string): boolean {
  return id.startsWith('44444444-4444-4444-4444-');
}

/**
 * Homepage row is always navy | orange | baby blue (#215), regardless of
 * which three pets `pickMeetThePets` drew. Per-pet theme fields on the pool
 * are leftovers and must not drive the homepage.
 *
 * Slot `title` colors are for the large bold pet name (AAA large-text).
 * Body/detail copy under the photo must use {@link MEET_PET_DETAIL_TEXT}:
 * reusing `title` on the orange slot (#c2410c on #fff7ed ≈ 4.87:1) fails
 * AAA normal-text 7:1 (#326 contrast gate).
 */
export const HOMEPAGE_SLOT_THEMES = [
  {
    bg: 'bg-[#e8edf7]',
    border: 'border-[#a8b8d8]',
    image: 'from-[#7a94c4] to-[#e8edf7]',
    title: 'text-[#1e3a8a]',
    cta: 'btn-primary',
  },
  {
    bg: 'bg-[#fff7ed]',
    border: 'border-[#fed7aa]',
    image: 'from-[#ffedd5] to-[#fff7ed]',
    title: 'text-[#c2410c]',
    cta: 'btn-secondary',
  },
  {
    bg: 'bg-[#f1f6ff]',
    border: 'border-[#cfe0ff]',
    image: 'from-[#d7e6ff] to-[#e9f1ff]',
    title: 'text-[#27408f]',
    cta: 'border-[#cfe0ff] bg-[#d7e6ff] text-[#27408f] hover:border-[#a8c4f5] hover:bg-[#cfe0ff]',
  },
] as const;

/**
 * Fixed navy for detail lines on pastel cards — stays readable in dark mode
 * (cards keep light fills) and clears WCAG AAA vs every HOMEPAGE_SLOT_THEMES bg.
 */
export const MEET_PET_DETAIL_TEXT = 'text-[#0c1929]';

const DEMO_HREF = '/adopt';

function demoCard(partial: Omit<MeetPetCard, 'href' | 'source'>): MeetPetCard {
  return { ...partial, href: DEMO_HREF, source: 'demo' };
}

/** Available demo pets with local cartoon portraits (exclude adopted). */
export const MEET_THE_PETS_POOL: readonly MeetPetCard[] = [
  demoCard({
    name: 'Lola',
    species: 'dog',
    portrait: '/demo-pets/lola.webp',
    portraitAlt:
      'Cartoon portrait of Lola, a white Chihuahua with black patches',
    breed: 'Chihuahua',
    size: null,
    age: '2 years',
    notes: 'loves belly rubs & long walks',
    bg: 'bg-[#e8edf7]',
    border: 'border-[#a8b8d8]',
    image: 'from-[#7a94c4] to-[#e8edf7]',
    title: 'text-[#1e3a8a]',
    cta: 'btn-primary',
  }),
  demoCard({
    name: 'Pepper',
    species: 'cat',
    portrait: '/demo-pets/pepper.webp',
    portraitAlt: 'Cartoon portrait of Pepper, a warm tortoiseshell cat',
    breed: 'Tortoiseshell',
    size: null,
    age: '4 years',
    notes: 'curious, cuddly, and treat motivated',
    bg: 'bg-[#fff7ed]',
    border: 'border-[#fed7aa]',
    image: 'from-[#ffedd5] to-[#fff7ed]',
    title: 'text-[#c2410c]',
    cta: 'btn-secondary',
  }),
  demoCard({
    name: 'Tiger',
    species: 'dog',
    portrait: '/demo-pets/tiger.webp',
    portraitAlt: 'Cartoon portrait of Tiger, a golden Labrador mix',
    breed: 'Labrador Mix',
    size: null,
    age: '2 years',
    notes: 'hiking buddy energy',
    bg: 'bg-[#f1f6ff]',
    border: 'border-[#cfe0ff]',
    image: 'from-[#d7e6ff] to-[#e9f1ff]',
    title: 'text-[#27408f]',
    cta: 'border-[#cfe0ff] bg-[#d7e6ff] text-[#27408f] hover:border-[#a8c4f5] hover:bg-[#cfe0ff]',
  }),
  demoCard({
    name: 'Tank',
    species: 'dog',
    portrait: '/demo-pets/tank.webp',
    portraitAlt: 'Cartoon portrait of Tank, a sturdy Pit Bull Terrier',
    breed: 'Pit Bull Terrier',
    size: null,
    age: '6 years',
    notes: 'patient, thrives on routine',
    bg: 'bg-[#f5f3ff]',
    border: 'border-[#ddd6fe]',
    image: 'from-[#ede9fe] to-[#f5f3ff]',
    title: 'text-[#5b21b6]',
    cta: 'btn-primary',
  }),
  demoCard({
    name: 'Zeus',
    species: 'dog',
    portrait: '/demo-pets/zeus.webp',
    portraitAlt: 'Cartoon portrait of Zeus, a gentle Great Dane',
    breed: 'Great Dane',
    size: null,
    age: '6 years',
    notes: 'calm indoors, needs room to stretch',
    bg: 'bg-[#ecfeff]',
    border: 'border-[#a5f3fc]',
    image: 'from-[#cffafe] to-[#ecfeff]',
    title: 'text-[#0e7490]',
    cta: 'btn-secondary',
  }),
  demoCard({
    name: 'Scout',
    species: 'dog',
    portrait: '/demo-pets/scout.webp',
    portraitAlt: 'Cartoon portrait of Scout, a Border Collie',
    breed: 'Border Collie',
    size: null,
    age: '4 years',
    notes: 'sharp, eager, always ready to play',
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#bbf7d0]',
    image: 'from-[#dcfce7] to-[#f0fdf4]',
    title: 'text-[#166534]',
    cta: 'border-[#bbf7d0] bg-[#dcfce7] text-[#166534] hover:border-[#86efac] hover:bg-[#bbf7d0]',
  }),
  demoCard({
    name: 'Rocky',
    species: 'dog',
    portrait: '/demo-pets/rocky.webp',
    portraitAlt: 'Cartoon portrait of Rocky, a German Shepherd',
    breed: 'German Shepherd',
    size: null,
    age: '3 years',
    notes: 'loyal, smart, ready for long walks',
    bg: 'bg-[#faf5ff]',
    border: 'border-[#e9d5ff]',
    image: 'from-[#f3e8ff] to-[#faf5ff]',
    title: 'text-[#6b21a8]',
    cta: 'btn-primary',
  }),
  demoCard({
    name: 'Noodle',
    species: 'dog',
    portrait: '/demo-pets/noodle.webp',
    portraitAlt: 'Cartoon portrait of Noodle, a Dachshund',
    breed: 'Dachshund',
    size: null,
    age: '1 year',
    notes: 'small, silly, and full of personality',
    bg: 'bg-[#fefce8]',
    border: 'border-[#fde68a]',
    image: 'from-[#fef9c3] to-[#fefce8]',
    title: 'text-[#a16207]',
    cta: 'btn-primary',
  }),
  demoCard({
    name: 'Miso',
    species: 'cat',
    portrait: '/demo-pets/miso.webp',
    portraitAlt: 'Cartoon portrait of Miso, a Domestic Shorthair cat',
    breed: 'Domestic Shorthair',
    size: null,
    age: '3 years',
    notes: 'soft lap warmer with a quiet purr',
    bg: 'bg-[#fff7ed]',
    border: 'border-[#fed7aa]',
    image: 'from-[#ffedd5] to-[#fff7ed]',
    title: 'text-[#c2410c]',
    cta: 'btn-secondary',
  }),
  demoCard({
    name: 'Pickles',
    species: 'cat',
    portrait: '/demo-pets/pickles.webp',
    portraitAlt: 'Cartoon portrait of Pickles, a Domestic Shorthair cat',
    breed: 'Domestic Shorthair',
    size: null,
    age: '2 years',
    notes: 'playful mischief in a compact package',
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#bbf7d0]',
    image: 'from-[#dcfce7] to-[#f0fdf4]',
    title: 'text-[#166534]',
    cta: 'btn-primary',
  }),
  demoCard({
    name: 'Ink',
    species: 'cat',
    portrait: '/demo-pets/ink.webp',
    portraitAlt: 'Cartoon portrait of Ink, a Domestic Shorthair cat',
    breed: 'Domestic Shorthair',
    size: null,
    age: '4 years',
    notes: 'sleek, curious, and window-sill royalty',
    bg: 'bg-[#f5f3ff]',
    border: 'border-[#ddd6fe]',
    image: 'from-[#ede9fe] to-[#f5f3ff]',
    title: 'text-[#5b21b6]',
    cta: 'btn-secondary',
  }),
  demoCard({
    name: 'Cloud',
    species: 'cat',
    portrait: '/demo-pets/cloud.webp',
    portraitAlt: 'Cartoon portrait of Cloud, a Domestic Longhair cat',
    breed: 'Domestic Longhair',
    size: null,
    age: '1 year',
    notes: 'fluffy cloud energy, soft as a sweater',
    bg: 'bg-[#f1f6ff]',
    border: 'border-[#cfe0ff]',
    image: 'from-[#d7e6ff] to-[#e9f1ff]',
    title: 'text-[#27408f]',
    cta: 'border-[#cfe0ff] bg-[#d7e6ff] text-[#27408f] hover:border-[#a8c4f5] hover:bg-[#cfe0ff]',
  }),
  demoCard({
    name: 'Chili',
    species: 'cat',
    portrait: '/demo-pets/chili.webp',
    portraitAlt: 'Cartoon portrait of Chili, a Domestic Shorthair cat',
    breed: 'Domestic Shorthair',
    size: null,
    age: '5 years',
    notes: 'warm personality with a spicy streak',
    bg: 'bg-[#fff1f2]',
    border: 'border-[#fecdd3]',
    image: 'from-[#ffe4e6] to-[#fff1f2]',
    title: 'text-[#be123c]',
    cta: 'btn-primary',
  }),
];

/** Default SSR / first-paint lineup (#164): dog | cat | dog. */
export const DEFAULT_MEET_THE_PETS: readonly MeetPetCard[] = [
  MEET_THE_PETS_POOL.find((p) => p.name === 'Lola')!,
  MEET_THE_PETS_POOL.find((p) => p.name === 'Pepper')!,
  MEET_THE_PETS_POOL.find((p) => p.name === 'Tiger')!,
];

function shuffleInPlace<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Pick three homepage cards: always two dogs and one cat, laid out
 * dog | cat | dog so the mix stays visually balanced.
 */
export function pickMeetThePets(
  pool: readonly MeetPetCard[] = MEET_THE_PETS_POOL,
  random: () => number = Math.random
): MeetPetCard[] {
  const dogs = shuffleInPlace(
    pool.filter((p) => p.species === 'dog'),
    random
  );
  const cats = shuffleInPlace(
    pool.filter((p) => p.species === 'cat'),
    random
  );

  if (dogs.length < 2 || cats.length < 1) {
    return [...DEFAULT_MEET_THE_PETS];
  }

  return [dogs[0], cats[0], dogs[1]];
}

/** Map a live browse pet into a homepage card (detail CTA). */
export function browsePetToMeetCard(pet: LiveMeetPetInput): MeetPetCard {
  const theme = HOMEPAGE_SLOT_THEMES[0];
  const notes = pet.notes?.trim();
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    portrait: pet.photo_url!.trim(),
    portraitAlt: `Photo of ${pet.name}`,
    breed: formatPetBreedLabel(pet.breed),
    size: formatPetSizeLabel(pet.size),
    age: formatPetAgePhrase(pet.age_years),
    notes: notes ? notes : null,
    bg: theme.bg,
    border: theme.border,
    image: theme.image,
    title: theme.title,
    cta: theme.cta,
    href: petDetailPath(pet.species, pet.id),
    source: 'live',
  };
}

/**
 * Prefer real available pets with photos. Take the first three, whichever
 * species they are, and use cartoon cards only for seats that are left.
 * Callers pass dogs before cats, so three real dogs fill the row (#574).
 * Seed UUID pets are excluded so demo storage art does not displace real
 * listings (#324).
 */
export function composeMeetThePets(
  livePets: readonly LiveMeetPetInput[],
  options: {
    demoPool?: readonly MeetPetCard[];
    random?: () => number;
  } = {}
): MeetPetCard[] {
  const pool = options.demoPool ?? MEET_THE_PETS_POOL;
  const random = options.random ?? Math.random;

  const real = livePets
    .filter(
      (p) =>
        p.status === 'available' &&
        Boolean(p.photo_url?.trim()) &&
        !isSeedDemoPetId(p.id)
    )
    .slice(0, 3)
    .map(browsePetToMeetCard);

  if (real.length >= 3) return real;

  const filled = [...real];
  for (const card of pickMeetThePets(pool, random)) {
    if (filled.length >= 3) break;
    filled.push(card);
  }
  return filled;
}
