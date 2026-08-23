import React from 'react';
import Image from 'next/image';

/**
 * The static Raised Paws mark.
 *
 * It pointed at `/rescuedogs-logo.svg`, which despite the filename was
 * ScriptHammer's artwork inherited at the fork (#233). The `alt` text already
 * said "Raised Paws Logo" — only the image was someone else's.
 */

export interface RescueDogsLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const RescueDogsLogo: React.FC<RescueDogsLogoProps> = ({
  className = 'w-full h-full',
  width = 400,
  height = 400,
}) => {
  return (
    <Image
      src="/raised-paws-logo.png"
      alt="Raised Paws Logo"
      width={width}
      height={height}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      priority
    />
  );
};

RescueDogsLogo.displayName = 'RescueDogsLogo';
