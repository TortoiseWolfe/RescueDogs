'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { detectedConfig } from '@/config/project-detected';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import {
  composeMeetThePets,
  DEFAULT_MEET_THE_PETS,
  HOMEPAGE_SLOT_THEMES,
  type MeetPetCard,
} from '@/lib/demo/meet-the-pets';

/**
 * Homepage Meet-the-Pets (#165 / #324): SSR shows the default cartoon
 * trio; after mount, prefer live available listings with photos
 * (2 dogs + 1 cat), filling gaps from the demo cartoon pool.
 */
export default function MeetThePetsSection() {
  const [pets, setPets] = useState<readonly MeetPetCard[]>(
    DEFAULT_MEET_THE_PETS
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const service = new ApplicationService(supabase);
        const [dogs, cats] = await Promise.all([
          service.getBrowsePets('dog'),
          service.getBrowsePets('cat'),
        ]);
        if (cancelled) return;
        setPets(composeMeetThePets([...dogs, ...cats]));
      } catch {
        if (!cancelled) {
          setPets(composeMeetThePets([]));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasLive = pets.some((p) => p.source === 'live');

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
          {hasLive
            ? 'Meet a few pets looking for homes right now.'
            : 'A few demo pets are ready for your tour.'}
        </p>

        <div className="grid gap-7 md:grid-cols-3">
          {pets.map((pet, slot) => {
            const theme = HOMEPAGE_SLOT_THEMES[slot] ?? HOMEPAGE_SLOT_THEMES[0];
            const isRemote = /^https?:\/\//i.test(pet.portrait);
            return (
              <article
                key={pet.id ?? pet.name}
                className={`card h-full border-[3px] text-left ${theme.bg} ${theme.border}`}
              >
                <div className="card-body flex h-full flex-col gap-4 p-4">
                  <div
                    className={`relative grid h-52 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br ${theme.image}`}
                  >
                    {isRemote ? (
                      // Remote Supabase photos — same pattern as browse cards.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pet.portrait}
                        alt={pet.portraitAlt}
                        className="h-44 w-44 rounded-2xl object-cover drop-shadow-lg"
                      />
                    ) : (
                      <Image
                        src={`${detectedConfig.basePath}${pet.portrait}`}
                        alt={pet.portraitAlt}
                        width={180}
                        height={180}
                        className="h-44 w-44 object-contain drop-shadow-lg"
                      />
                    )}
                  </div>
                  <div className="flex-1 px-2">
                    <h3
                      className={`font-friendly text-2xl font-bold ${theme.title}`}
                    >
                      {pet.name}
                    </h3>
                    <p className="text-base-content/95 font-semibold">
                      {pet.detail}
                    </p>
                  </div>
                  <Link
                    href={pet.href}
                    className={`btn ${theme.cta} mt-auto min-h-11 w-full`}
                  >
                    Meet {pet.name}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
