'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { BrowseLocationFilters } from '@/lib/browse/location-filters';

/**
 * Syncs browse URL params to parent state (#274 / #280).
 * Supports ?shelter=, ?state=, ?zip= (center), ?miles=, ?transport=0.
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
      // Transport matches are on by default (#331), so only the opt-out travels
      // in the URL.
      includeTransport: searchParams?.get('transport') === '0' ? false : true,
    });
  }, [searchParams, onParams]);

  return null;
}
