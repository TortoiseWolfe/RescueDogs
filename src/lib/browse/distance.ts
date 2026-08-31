import type { BrowsePet } from '@/types/applications';
import zipcodes from 'zipcodes';

/** Mile-radius options for browse (#280). */
export const BROWSE_RADIUS_OPTIONS: ReadonlyArray<{
  value: number | '';
  label: string;
}> = [
  { value: '', label: 'Any distance' },
  { value: 25, label: 'Within 25 miles' },
  { value: 50, label: 'Within 50 miles' },
  { value: 100, label: 'Within 100 miles' },
];

/** Normalize US ZIP to 5-digit string for lookup, or undefined. */
export function normalizeCenterZip(raw?: string | null): string | undefined {
  const digits = raw?.replace(/\D/g, '') ?? '';
  if (digits.length < 5) return undefined;
  return digits.slice(0, 5);
}

export function normalizeMaxMiles(
  raw?: number | string | null
): number | undefined {
  if (raw === '' || raw == null) return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Great-circle distance in miles between two lat/lng points. */
export function milesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 3958.8 * c;
}

export function zipCoordinates(zip: string | null | undefined): {
  lat: number;
  lng: number;
} | null {
  const normalized = normalizeCenterZip(zip);
  if (!normalized) return null;
  const row = zipcodes.lookup(normalized);
  if (!row?.latitude || !row?.longitude) return null;
  return { lat: row.latitude, lng: row.longitude };
}

/**
 * Client-side radius filter using shelter ZIP centroids (#280).
 * Pets without a resolvable shelter ZIP are excluded when radius is active.
 */
export function filterBrowsePetsByRadius(
  pets: BrowsePet[],
  centerZip: string,
  maxMiles: number
): BrowsePet[] {
  const center = zipCoordinates(centerZip);
  if (!center) return [];

  return pets.filter((pet) => {
    const shelterZip = pet.shelters?.zip;
    const shelterCoords = zipCoordinates(shelterZip);
    if (!shelterCoords) return false;
    const distance = milesBetween(
      center.lat,
      center.lng,
      shelterCoords.lat,
      shelterCoords.lng
    );
    return distance <= maxMiles;
  });
}
