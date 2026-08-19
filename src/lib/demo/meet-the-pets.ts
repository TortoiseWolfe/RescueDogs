/**
 * Homepage Meet-the-Pets pool (#165).
 * Identity lock — name ↔ species ↔ breed ↔ portrait never cross
 * (same lock as seed / #164).
 */

export type MeetPetSpecies = 'dog' | 'cat';

export interface MeetPetCard {
  name: string;
  species: MeetPetSpecies;
  portrait: `/${string}`;
  portraitAlt: string;
  detail: string;
  bg: string;
  border: string;
  image: string;
  title: string;
  cta: string;
}

/**
 * Homepage row is always navy | orange | baby blue (#215), regardless of
 * which three pets `pickMeetThePets` drew. Per-pet theme fields on the pool
 * are leftovers and must not drive the homepage.
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

/** Available demo pets with local cartoon portraits (exclude adopted). */
export const MEET_THE_PETS_POOL: readonly MeetPetCard[] = [
  {
    name: 'Lola',
    species: 'dog',
    portrait: '/demo-pets/lola.png',
    portraitAlt:
      'Cartoon portrait of Lola, a white Chihuahua with black patches',
    detail: '2 yrs · Chihuahua · loves belly rubs & long walks',
    bg: 'bg-[#e8edf7]',
    border: 'border-[#a8b8d8]',
    image: 'from-[#7a94c4] to-[#e8edf7]',
    title: 'text-[#1e3a8a]',
    cta: 'btn-primary',
  },
  {
    name: 'Pepper',
    species: 'cat',
    portrait: '/demo-pets/pepper.png',
    portraitAlt: 'Cartoon portrait of Pepper, a warm tortoiseshell cat',
    detail: '4 yrs · cat · curious, cuddly, and treat motivated',
    bg: 'bg-[#fff7ed]',
    border: 'border-[#fed7aa]',
    image: 'from-[#ffedd5] to-[#fff7ed]',
    title: 'text-[#c2410c]',
    cta: 'btn-secondary',
  },
  {
    name: 'Tiger',
    species: 'dog',
    portrait: '/demo-pets/tiger.png',
    portraitAlt: 'Cartoon portrait of Tiger, a golden Labrador mix',
    detail: '2 yrs · Labrador Mix · hiking buddy energy',
    bg: 'bg-[#f1f6ff]',
    border: 'border-[#cfe0ff]',
    image: 'from-[#d7e6ff] to-[#e9f1ff]',
    title: 'text-[#27408f]',
    cta: 'border-[#cfe0ff] bg-[#d7e6ff] text-[#27408f] hover:border-[#a8c4f5] hover:bg-[#cfe0ff]',
  },
  {
    name: 'Tank',
    species: 'dog',
    portrait: '/demo-pets/tank.png',
    portraitAlt: 'Cartoon portrait of Tank, a sturdy Pit Bull Terrier',
    detail: '6 yrs · Pit Bull Terrier · patient, thrives on routine',
    bg: 'bg-[#f5f3ff]',
    border: 'border-[#ddd6fe]',
    image: 'from-[#ede9fe] to-[#f5f3ff]',
    title: 'text-[#5b21b6]',
    cta: 'btn-primary',
  },
  {
    name: 'Zeus',
    species: 'dog',
    portrait: '/demo-pets/zeus.png',
    portraitAlt: 'Cartoon portrait of Zeus, a gentle Great Dane',
    detail: '6 yrs · Great Dane · calm indoors, needs room to stretch',
    bg: 'bg-[#ecfeff]',
    border: 'border-[#a5f3fc]',
    image: 'from-[#cffafe] to-[#ecfeff]',
    title: 'text-[#0e7490]',
    cta: 'btn-secondary',
  },
  {
    name: 'Scout',
    species: 'dog',
    portrait: '/demo-pets/scout.png',
    portraitAlt: 'Cartoon portrait of Scout, a Border Collie',
    detail: '4 yrs · Border Collie · sharp, eager, always ready to play',
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#bbf7d0]',
    image: 'from-[#dcfce7] to-[#f0fdf4]',
    title: 'text-[#166534]',
    cta: 'border-[#bbf7d0] bg-[#dcfce7] text-[#166534] hover:border-[#86efac] hover:bg-[#bbf7d0]',
  },
  {
    name: 'Noodle',
    species: 'dog',
    portrait: '/demo-pets/noodle.png',
    portraitAlt: 'Cartoon portrait of Noodle, a Dachshund',
    detail: '1 yrs · Dachshund · small, silly, and full of personality',
    bg: 'bg-[#fefce8]',
    border: 'border-[#fde68a]',
    image: 'from-[#fef9c3] to-[#fefce8]',
    title: 'text-[#a16207]',
    cta: 'btn-primary',
  },
  {
    name: 'Miso',
    species: 'cat',
    portrait: '/demo-pets/miso.png',
    portraitAlt: 'Cartoon portrait of Miso, a Domestic Shorthair cat',
    detail: '3 yrs · cat · soft lap warmer with a quiet purr',
    bg: 'bg-[#fff7ed]',
    border: 'border-[#fed7aa]',
    image: 'from-[#ffedd5] to-[#fff7ed]',
    title: 'text-[#c2410c]',
    cta: 'btn-secondary',
  },
  {
    name: 'Pickles',
    species: 'cat',
    portrait: '/demo-pets/pickles.png',
    portraitAlt: 'Cartoon portrait of Pickles, a Domestic Shorthair cat',
    detail: '2 yrs · cat · playful mischief in a compact package',
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#bbf7d0]',
    image: 'from-[#dcfce7] to-[#f0fdf4]',
    title: 'text-[#166534]',
    cta: 'btn-primary',
  },
  {
    name: 'Ink',
    species: 'cat',
    portrait: '/demo-pets/ink.png',
    portraitAlt: 'Cartoon portrait of Ink, a Domestic Shorthair cat',
    detail: '4 yrs · cat · sleek, curious, and window-sill royalty',
    bg: 'bg-[#f5f3ff]',
    border: 'border-[#ddd6fe]',
    image: 'from-[#ede9fe] to-[#f5f3ff]',
    title: 'text-[#5b21b6]',
    cta: 'btn-secondary',
  },
  {
    name: 'Cloud',
    species: 'cat',
    portrait: '/demo-pets/cloud.png',
    portraitAlt: 'Cartoon portrait of Cloud, a Domestic Longhair cat',
    detail: '1 yrs · cat · fluffy cloud energy, soft as a sweater',
    bg: 'bg-[#f1f6ff]',
    border: 'border-[#cfe0ff]',
    image: 'from-[#d7e6ff] to-[#e9f1ff]',
    title: 'text-[#27408f]',
    cta: 'border-[#cfe0ff] bg-[#d7e6ff] text-[#27408f] hover:border-[#a8c4f5] hover:bg-[#cfe0ff]',
  },
  {
    name: 'Chili',
    species: 'cat',
    portrait: '/demo-pets/chili.png',
    portraitAlt: 'Cartoon portrait of Chili, a Domestic Shorthair cat',
    detail: '5 yrs · cat · warm personality with a spicy streak',
    bg: 'bg-[#fff1f2]',
    border: 'border-[#fecdd3]',
    image: 'from-[#ffe4e6] to-[#fff1f2]',
    title: 'text-[#be123c]',
    cta: 'btn-primary',
  },
] as const;

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
