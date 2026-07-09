import React from 'react';
import Image from 'next/image';

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
      src="/rescuedogs-logo.svg"
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
