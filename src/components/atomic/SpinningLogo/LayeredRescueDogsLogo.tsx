'use client';

import React from 'react';
import Image from 'next/image';
import { SpinningLogo } from './SpinningLogo';
import { detectedConfig } from '@/config/project-detected';

/**
 * The spinning Raised Paws mark.
 *
 * WHY THIS IS ONE LAYER AND NOT THREE (#233). It used to compose three images:
 * a static printing mallet behind, a rotating silver gear carrying a wordmark,
 * and script-tag brackets in front. All three were ScriptHammer's artwork,
 * inherited at the fork and never replaced — `rescuedogs-logo.svg` was
 * byte-identical to upstream's mark and still carried the comment "Your
 * ScriptHammer logo with correct orientation and larger scale". A mallet and a
 * pair of angle brackets say "this is a code template"; they say nothing about
 * adopting a dog.
 *
 * The Raised Paws mark is a single unified symbol — navy triangle, orange
 * border, white paw whose pad is a heart — so there is nothing to stack. The
 * layering was not a feature we lost; it was upstream's composition, and
 * keeping a three-layer structure with one real layer would have been a
 * costume.
 *
 * The component, its name and its props are deliberately unchanged. Six
 * Storybook stories drive it, and upstream still ships the layered original at
 * `src/app/page.tsx` and `src/app/sign-in/page.tsx` — deleting ours would make
 * any future upstream merge re-add a file we had removed, with no conflict
 * marker to notice it by. That is the exact failure this repo just fixed in
 * #232.
 */
export interface LayeredRescueDogsLogoProps {
  className?: string;
  size?: number;
  speed?: 'slow' | 'normal' | 'fast' | number;
  pauseOnHover?: boolean;
}

export const LayeredRescueDogsLogo: React.FC<LayeredRescueDogsLogoProps> = ({
  className = '',
  speed = 'slow',
  pauseOnHover = true,
}) => {
  return (
    <div
      className={`relative ${className}`}
      style={{
        width: '100%',
        height: '100%',
        aspectRatio: '1 / 1',
      }}
    >
      <SpinningLogo speed={speed} pauseOnHover={pauseOnHover}>
        <Image
          src={`${detectedConfig.basePath}/raised-paws-logo.png`}
          alt="Raised Paws logo"
          width={512}
          height={512}
          className="absolute inset-0 h-full w-full"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(1px 1px 0px rgb(0 0 0 / 0.7))',
          }}
          priority
        />
      </SpinningLogo>
    </div>
  );
};

LayeredRescueDogsLogo.displayName = 'LayeredRescueDogsLogo';
