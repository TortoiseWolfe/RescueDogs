import { US_STATE_OPTIONS } from './location-filters';

/**
 * Pure transport-state helpers (#331). They live apart from transport.ts on
 * purpose: transport.ts imports the `zipcodes` package (a ~5 MB ZIP table that
 * webpack cannot tree-shake), and the services layer must not pull that into
 * every page that touches it. Keep this file free of `zipcodes` and distance.
 */
export const STATE_CODES = new Set(
  US_STATE_OPTIONS.map((option) => option.code)
);

const STATE_NAMES = new Map(
  US_STATE_OPTIONS.map((option) => [option.code, option.name])
);

/** Full state name for a code, falling back to the code itself. */
export function stateName(code?: string | null): string {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return '';
  return STATE_NAMES.get(normalized) ?? normalized;
}

/** Uppercase, validate, de-duplicate and sort transport state codes (#331). */
export function normalizeTransportStates(
  raw?: ReadonlyArray<string | null | undefined> | null
): string[] {
  if (!raw) return [];
  const codes = new Set<string>();
  for (const entry of raw) {
    const code = entry?.trim().toUpperCase();
    if (code && STATE_CODES.has(code)) codes.add(code);
  }
  return Array.from(codes).sort();
}

/** A valid explicit State filter, trimmed and uppercased, or undefined. */
export function explicitTransportState(
  state?: string | null
): string | undefined {
  const explicit = state?.trim().toUpperCase();
  return explicit && STATE_CODES.has(explicit) ? explicit : undefined;
}
