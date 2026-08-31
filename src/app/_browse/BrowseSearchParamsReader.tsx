'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { BrowseLocationFilters } from '@/lib/browse/location-filters';

/**
 * Syncs browse URL params to parent state (#274 / #280).
 * Supports ?shelter=, ?state=, ?zip= (center), ?miles=.
 */
export default function BrowseSearchParamsReader({
  onParams,
}: {
  onParams: (filters: BrowseLocationFilters) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const milesRaw = searchParams?.get('miles');
    const maxMiles =
      milesRaw && Number.isFinite(Number(milesRaw))
        ? Number(milesRaw)
        : undefined;

    onParams({
      shelterId: searchParams?.get('shelter') ?? undefined,
      state: searchParams?.get('state') ?? undefined,
      centerZip: searchParams?.get('zip') ?? undefined,
      maxMiles,
    });
  }, [searchParams, onParams]);

  return null;
}
