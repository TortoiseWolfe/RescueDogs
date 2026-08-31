/** US state/territory codes for browse location filters (#111). */
export const US_STATE_OPTIONS: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

export interface BrowseLocationFilters {
  /** Two-letter state/territory code, or empty for any. */
  state?: string;
  /** Adopter center ZIP for mile-radius filter (#280). */
  centerZip?: string;
  /** Max miles from centerZip; omit for any distance. */
  maxMiles?: number;
  /** Shelter UUID for rescue-scoped listing (#274). */
  shelterId?: string;
}

/** Uppercase + trim 2-letter codes; drop empty. */
export function normalizeState(raw?: string | null): string | undefined {
  const value = raw?.trim().toUpperCase();
  if (!value) return undefined;
  return value;
}

/** Legacy exact ZIP (#111); URL ?zip= maps to centerZip in reader (#280). */
export function normalizeZip(raw?: string | null): string | undefined {
  const digits = raw?.replace(/\D/g, '') ?? '';
  if (digits.length < 5) return undefined;
  return digits.slice(0, 5);
}

/** Trim shelter id; drop empty. */
export function normalizeShelterId(raw?: string | null): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  return value;
}

function normalizeMaxMiles(raw?: number | string | null): number | undefined {
  if (raw === '' || raw == null) return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function normalizeBrowseLocationFilters(
  filters: BrowseLocationFilters & { zip?: string }
): BrowseLocationFilters {
  const state = normalizeState(filters.state);
  const shelterId = normalizeShelterId(filters.shelterId);
  const centerZip =
    normalizeZip(filters.centerZip) ?? normalizeZip(filters.zip);
  const maxMiles = normalizeMaxMiles(filters.maxMiles);
  return {
    ...(state ? { state } : {}),
    ...(centerZip ? { centerZip } : {}),
    ...(maxMiles ? { maxMiles } : {}),
    ...(shelterId ? { shelterId } : {}),
  };
}

export function hasBrowseLocationFilters(
  filters: BrowseLocationFilters
): boolean {
  const normalized = normalizeBrowseLocationFilters(filters);
  return Boolean(
    normalized.state ||
      normalized.centerZip ||
      normalized.maxMiles ||
      normalized.shelterId
  );
}
