'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Reads the ?pet= search param and syncs it to parent state via callback.
 * Must be inside a Suspense boundary (Next.js requirement for
 * useSearchParams under static export). Renders nothing.
 * Pattern: src/app/messages/SearchParamsReader.tsx
 */
export default function SearchParamsReader({
  onParams,
}: {
  onParams: (petId: string | null) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onParams(searchParams?.get('pet') ?? null);
  }, [searchParams, onParams]);

  return null;
}
