'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Reads ?id= for static-export pet detail pages (#274).
 */
export default function PetDetailSearchParamsReader({
  onParams,
}: {
  onParams: (petId: string | null) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onParams(searchParams?.get('id') ?? null);
  }, [searchParams, onParams]);

  return null;
}
