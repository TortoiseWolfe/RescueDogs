import type { BrowsePet, ShelterTransportInfo } from '@/types/applications';
import { US_STATE_OPTIONS } from './location-filters';
import { filterBrowsePetsByRadius, normalizeCenterZip } from './distance';
import zipcodes from 'zipcodes';

const STATE_CODES = new Set(US_STATE_OPTIONS.map((option) => option.code));

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

/**
 * The adopter's state for transport matching (#331). An explicit State filter
 * wins; otherwise fall back to the ZIP's state so someone who only typed a ZIP
 * still sees rescues that ship to them. ZIP never drives transport otherwise.
 */
export function transportStateFor(
  state?: string | null,
  centerZip?: string | null
): string | undefined {
  const explicit = state?.trim().toUpperCase();
  if (explicit && STATE_CODES.has(explicit)) return explicit;

  const zip = normalizeCenterZip(centerZip);
  if (!zip) return undefined;
  const derived = zipcodes.lookup(zip)?.state?.trim().toUpperCase();
  return derived && STATE_CODES.has(derived) ? derived : undefined;
}

/**
 * Browse filter hint (#335). Describes what the adopter is looking at so it
 * never promises transported pets while the box is unticked.
 */
export function browseFilterHint(options: {
  transportState?: string;
  includeTransport: boolean;
}): string {
  if (!options.transportState) {
    return 'Pick your state or enter your ZIP to see pets near you. Radius is optional.';
  }
  if (options.includeTransport) {
    return `Showing pets near you, plus pets that out-of-state rescues will transport to ${stateName(options.transportState)}.`;
  }
  return 'Showing only pets near you. Check "Include transportable pets" to see pets that rescues in other states will transport to you.';
}

/**
 * Note for a ZIP outside the chosen State (#335). The State filter wins for
 * both local results and transport, which silently hides nearby rescues across
 * the border unless we say so.
 */
export function zipStateMismatchNote(
  state?: string | null,
  centerZip?: string | null
): string | null {
  const chosen = state?.trim().toUpperCase();
  if (!chosen || !STATE_CODES.has(chosen)) return null;
  const zipState = transportStateFor(undefined, centerZip);
  if (!zipState || zipState === chosen) return null;
  return `Your ZIP is in ${stateName(zipState)}, but you picked ${stateName(chosen)}. Results use ${stateName(chosen)}.`;
}

/** True when this rescue advertises transport to `state`. */
export function shelterTransportsTo(
  shelter: ShelterTransportInfo | null | undefined,
  state?: string | null
): boolean {
  const target = state?.trim().toUpperCase();
  if (!shelter?.transports || !target) return false;
  return normalizeTransportStates(shelter.transport_states).includes(target);
}

/** True when this specific pet can travel — rescue offer minus the pet opt-out. */
export function petTransportsTo(
  pet: BrowsePet,
  state?: string | null
): boolean {
  return (
    pet.transportable !== false && shelterTransportsTo(pet.shelters, state)
  );
}

/**
 * A pet reached the adopter through transport rather than by being local, so
 * the card must say where it actually lives.
 */
export function isTransportMatch(
  pet: BrowsePet,
  state?: string | null
): boolean {
  const target = state?.trim().toUpperCase();
  if (!target) return false;
  const petState = pet.shelters?.state?.trim().toUpperCase();
  if (petState === target) return false;
  return petTransportsTo(pet, target);
}

/** Card/detail badge text, e.g. "Transport available to New Jersey". */
export function transportBadgeLabel(
  pet: BrowsePet,
  state?: string | null
): string | null {
  if (!isTransportMatch(pet, state)) return null;
  return `Transport available to ${stateName(state)}`;
}

/** Detail-page summary of every state a rescue ships to. */
export function transportStatesSummary(
  shelter: ShelterTransportInfo | null | undefined
): string | null {
  if (!shelter?.transports) return null;
  const codes = normalizeTransportStates(shelter.transport_states);
  if (codes.length === 0) return null;
  if (codes.length > 6) return `${codes.length} states`;
  return codes.map(stateName).join(', ');
}

export interface TransportRadiusOptions {
  /** Adopter's state used for transport matching. */
  transportState?: string;
  centerZip?: string;
  maxMiles?: number;
  includeTransport: boolean;
}

/**
 * Apply the mile radius without discarding transport matches (#331). A Houston
 * rescue that ships to New Jersey is thousands of miles away, so running the
 * radius over every row would silently undo the transport filter. The radius
 * narrows local pets only.
 */
export function applyRadiusWithTransport(
  pets: BrowsePet[],
  options: TransportRadiusOptions
): BrowsePet[] {
  const { transportState, centerZip, maxMiles, includeTransport } = options;
  if (!centerZip || !maxMiles) return pets;

  if (!includeTransport || !transportState) {
    return filterBrowsePetsByRadius(pets, centerZip, maxMiles);
  }

  const transported = new Set<string>();
  const local: BrowsePet[] = [];
  for (const pet of pets) {
    if (isTransportMatch(pet, transportState)) {
      transported.add(pet.id);
    } else {
      local.push(pet);
    }
  }

  const withinRadius = new Set(
    filterBrowsePetsByRadius(local, centerZip, maxMiles).map((pet) => pet.id)
  );

  return pets.filter(
    (pet) => transported.has(pet.id) || withinRadius.has(pet.id)
  );
}
