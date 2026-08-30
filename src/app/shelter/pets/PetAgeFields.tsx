'use client';

import React from 'react';
import { PET_AGE_MAX_YEARS } from '@/lib/pet-age';

const YEAR_OPTIONS = Array.from({ length: PET_AGE_MAX_YEARS + 1 }, (_, i) => i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i);

type PetAgeFieldsProps = {
  years: number;
  months: number;
  onYearsChange: (years: number) => void;
  onMonthsChange: (months: number) => void;
};

/**
 * Years + months age dropdowns for shelter pet forms (#272).
 */
export function PetAgeFields({
  years,
  months,
  onYearsChange,
  onMonthsChange,
}: PetAgeFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="form-control w-full">
        <span className="label-text">Years</span>
        <select
          className="select select-bordered min-h-11 w-full"
          value={years}
          onChange={(e) => onYearsChange(Number(e.target.value))}
          aria-label="Years"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className="form-control w-full">
        <span className="label-text">Months</span>
        <select
          className="select select-bordered min-h-11 w-full"
          value={months}
          onChange={(e) => onMonthsChange(Number(e.target.value))}
          aria-label="Age in months"
        >
          {MONTH_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
