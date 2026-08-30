'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { BrowseLocationFilters } from '@/lib/browse/location-filters';

/**
 * Syncs browse URL params to parent state (#274).
 * Supports ?shelter=, ?state=, ?zip= for Petfinder listing links.
 */
export default function BrowseSearchParamsReader({
  onParams,
}: {
  onParams: (filters: BrowseLocationFilters) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onParams({
      shelterId: searchParams?.get('shelter') ?? undefined,
      state: searchParams?.get('state') ?? undefined,
      zip: searchParams?.get('zip') ?? undefined,
    });
  }, [searchParams, onParams]);

  return null;
}
