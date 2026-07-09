'use client';

import React from 'react';
import Image from 'next/image';
import { SpinningLogo } from './SpinningLogo';
import { detectedConfig } from '@/config/project-detected';

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
      {/* Layer 1: Static printing mallet (BACK) */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '58%',
          left: '42%',
          transform: 'translate(-50%, -50%)',
          width: '65%',
          height: '65%',
          opacity: 0.9,
        }}
      >
        <Image
          src={`${detectedConfig.basePath}/printing-mallet.svg`}
          alt="Printing Mallet"
          width={400}
          height={400}
          className="h-full w-full"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(2px 2px 2px rgb(0 0 0 / 0.8))',
          }}
          priority
        />
      </div>

      {/* Layer 2: Rotating silver gear + "RescueDogs.com" text (MIDDLE) */}
      <SpinningLogo speed={speed} pauseOnHover={pauseOnHover}>
        <Image
          src={`${detectedConfig.basePath}/rescuedogs-logo.svg`}
          alt="Raised Paws gear logo"
          width={400}
          height={400}
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

      {/* Layer 3: Static script tags (FRONT) */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '68%',
          height: '68%',
        }}
      >
        <Image
          src={`${detectedConfig.basePath}/script-tags.svg`}
          alt="Script Tags"
          width={400}
          height={400}
          className="h-full w-full"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(2px 2px 2px rgb(0 0 0 / 0.8))',
          }}
          priority
        />
      </div>
    </div>
  );
};

LayeredRescueDogsLogo.displayName = 'LayeredRescueDogsLogo';
