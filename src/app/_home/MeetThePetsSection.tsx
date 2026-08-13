'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { detectedConfig } from '@/config/project-detected';
import {
  DEFAULT_MEET_THE_PETS,
  pickMeetThePets,
  type MeetPetCard,
} from '@/lib/demo/meet-the-pets';

/**
 * Homepage Meet-the-Pets (#165): SSR shows the default 2 dogs + 1 cat
 * trio; after mount, shuffle from the demo pool while keeping that mix.
 */
export default function MeetThePetsSection() {
  const [pets, setPets] = useState<readonly MeetPetCard[]>(
    DEFAULT_MEET_THE_PETS
  );

  useEffect(() => {
    setPets(pickMeetThePets());
  }, []);

  return (
    <section
      aria-labelledby="meet-pets-heading"
      className="bg-base-100 px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl text-center">
        <h2
          id="meet-pets-heading"
          className="font-display text-base-content text-4xl font-extrabold sm:text-5xl"
        >
          Say hello!
        </h2>
        <p className="text-base-content/95 mt-2 mb-8 text-lg font-semibold">
          A few demo pets are ready for your tour.
        </p>

        <div className="grid gap-7 md:grid-cols-3">
          {pets.map((pet) => (
            <article
              key={pet.name}
              className={`card border-[3px] text-left ${pet.bg} ${pet.border}`}
            >
              <div className="card-body gap-4 p-4">
                <div
                  className={`relative grid h-52 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br ${pet.image}`}
                >
                  <Image
                    src={`${detectedConfig.basePath}${pet.portrait}`}
                    alt={pet.portraitAlt}
                    width={180}
                    height={180}
                    className="h-44 w-44 object-contain drop-shadow-lg"
                  />
                </div>
                <div className="px-2">
                  <h3
                    className={`font-friendly text-2xl font-bold ${pet.title}`}
                  >
                    {pet.name}
                  </h3>
                  <p className="text-base-content/95 font-semibold">
                    {pet.detail}
                  </p>
                </div>
                <Link
                  href="/adopt"
                  className={`btn ${pet.cta} min-h-11 w-full`}
                >
                  Meet {pet.name}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
