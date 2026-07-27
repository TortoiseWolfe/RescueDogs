'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Reads ?id= for pet edit under static export. Must sit in Suspense.
 * Pattern: src/app/shelter/application/SearchParamsReader.tsx
 */
export default function SearchParamsReader({
  onParams,
}: {
  onParams: (id: string | null) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onParams(searchParams?.get('id') ?? null);
  }, [searchParams, onParams]);

  return null;
}
