'use client';

import React from 'react';
import { ColorblindType } from '@/utils/colorblind';
import {
  COLORBLIND_MATRICES,
  matrixToSVGString,
} from '@/utils/colorblind-matrices';
import { useColorblindMode } from '@/hooks/useColorblindMode';

export interface ColorblindFiltersProps {
  className?: string;
}

export const ColorblindFilters: React.FC<ColorblindFiltersProps> = ({
  className = '',
}) => {
  // Apply persisted colorblind settings on every page. The SVG defs alone are
  // not enough — without a mounted consumer of useColorblindMode, localStorage
  // preferences never touch the DOM (regression after ColorblindToggle left
  // GlobalNav; /accessibility still mounts the toggle, but / and everywhere
  // else would ignore a saved mode).
  useColorblindMode();

  // Define all filter types except NONE
  const filterTypes = [
    ColorblindType.PROTANOPIA,
    ColorblindType.PROTANOMALY,
    ColorblindType.DEUTERANOPIA,
    ColorblindType.DEUTERANOMALY,
    ColorblindType.TRITANOPIA,
    ColorblindType.TRITANOMALY,
    ColorblindType.ACHROMATOPSIA,
    ColorblindType.ACHROMATOMALY,
  ];

  return (
    <svg className={`hidden ${className}`} aria-hidden="true">
      <defs>
        {filterTypes.map((type) => (
          <filter key={type} id={type}>
            <feColorMatrix
              type="matrix"
              values={matrixToSVGString(COLORBLIND_MATRICES[type])}
            />
          </filter>
        ))}
      </defs>
    </svg>
  );
};
