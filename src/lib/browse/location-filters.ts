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
  /** Exact shelter ZIP (trimmed). */
  zip?: string;
  /** Shelter UUID for rescue-scoped listing (#274). */
  shelterId?: string;
}

/** Uppercase + trim 2-letter codes; drop empty. */
export function normalizeState(raw?: string | null): string | undefined {
  const value = raw?.trim().toUpperCase();
  if (!value) return undefined;
  return value;
}

/** Exact ZIP match after trim (issue #111 — no radius). */
export function normalizeZip(raw?: string | null): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  return value;
}

/** Trim shelter id; drop empty. */
export function normalizeShelterId(raw?: string | null): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  return value;
}

export function normalizeBrowseLocationFilters(
  filters: BrowseLocationFilters
): BrowseLocationFilters {
  const state = normalizeState(filters.state);
  const zip = normalizeZip(filters.zip);
  const shelterId = normalizeShelterId(filters.shelterId);
  return {
    ...(state ? { state } : {}),
    ...(zip ? { zip } : {}),
    ...(shelterId ? { shelterId } : {}),
  };
}

export function hasBrowseLocationFilters(
  filters: BrowseLocationFilters
): boolean {
  const normalized = normalizeBrowseLocationFilters(filters);
  return Boolean(normalized.state || normalized.zip || normalized.shelterId);
}
