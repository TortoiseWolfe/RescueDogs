/**
 * RescueDogs Anti-Ghosting MVP Type Definitions
 * Mirrors the schema in supabase/migrations/20251006_complete_monolithic_setup.sql
 * (RESCUEDOGS: ANTI-GHOSTING MVP section).
 */

// ============================================================================
// Status Pipeline
// ============================================================================

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'reference_check'
  | 'home_visit'
  | 'approved'
  | 'not_selected'
  | 'withdrawn';

/**
 * The five pipeline stages shown on the tracker timeline, in order.
 * Terminal branches (not_selected, withdrawn) are rendered as a final
 * step replacing 'approved'.
 */
export const STATUS_ORDER = [
  'submitted',
  'under_review',
  'reference_check',
  'home_visit',
  'approved',
] as const satisfies readonly ApplicationStatus[];

/**
 * Legal staff transitions, mirroring advance_application_status() in
 * Postgres. The database is authoritative — this map only drives UI
 * (StatusDropdown options). 'withdrawn' is intentionally absent: it is
 * adopter-only, via the separate withdraw_application() RPC.
 */
export const STATUS_TRANSITIONS: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  submitted: ['under_review', 'not_selected'],
  under_review: ['reference_check', 'home_visit', 'approved', 'not_selected'],
  reference_check: ['home_visit', 'approved', 'not_selected'],
  home_visit: ['approved', 'not_selected'],
  approved: [],
  not_selected: [],
  withdrawn: [],
} as const;

export const TERMINAL_STATUSES = [
  'approved',
  'not_selected',
  'withdrawn',
] as const satisfies readonly ApplicationStatus[];

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return (TERMINAL_STATUSES as readonly ApplicationStatus[]).includes(status);
}

/** Human-facing labels (Constitution Principle I: status must be legible). */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  reference_check: 'Reference Check',
  home_visit: 'Home Visit',
  approved: 'Approved',
  not_selected: 'Not Selected',
  withdrawn: 'Withdrawn',
};

// ============================================================================
// Rows
// ============================================================================

export interface Shelter {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  contact_email: string | null;
  created_at: string;
}

export type ShelterRole = 'staff' | 'manager';

export interface ShelterMembership {
  shelter_id: string;
  user_id: string;
  role: ShelterRole;
  created_at: string;
}

export type PetSpecies = 'dog' | 'cat';
export type PetSex = 'male' | 'female';
export type PetSize = 'small' | 'medium' | 'large';
export type PetStatus = 'available' | 'pending' | 'adopted';

export interface Pet {
  id: string;
  shelter_id: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  sex: PetSex | null;
  age_years: number | null;
  size: PetSize | null;
  photo_url: string | null;
  status: PetStatus;
  created_at: string;
}

export type HousingType =
  | 'own_house'
  | 'own_condo'
  | 'rent_house'
  | 'rent_apartment'
  | 'other';

export const RENTING_HOUSING_TYPES = [
  'rent_house',
  'rent_apartment',
] as const satisfies readonly HousingType[];

export function isRenting(housingType: HousingType): boolean {
  return (RENTING_HOUSING_TYPES as readonly HousingType[]).includes(
    housingType
  );
}

/**
 * The reusable "universal application" answers — 1:1 with the user,
 * editable source of truth that prefills every application form.
 */
export interface AdopterProfile {
  id: string;
  full_name: string;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  housing_type: HousingType;
  landlord_approval: boolean | null;
  landlord_contact: string | null;
  has_yard: boolean;
  yard_fenced: boolean | null;
  household_adults: number;
  household_children: number;
  other_pets: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  experience: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * What gets frozen into applications.profile_snapshot at submit time —
 * the adopter profile minus its row metadata. Shelter staff review this,
 * never the live profile (Constitution Principle III).
 */
export type ProfileSnapshot = Omit<
  AdopterProfile,
  'id' | 'created_at' | 'updated_at'
>;

export interface Application {
  id: string;
  adopter_id: string;
  pet_id: string;
  shelter_id: string;
  status: ApplicationStatus;
  profile_snapshot: ProfileSnapshot;
  why_this_pet: string | null;
  status_changed_at: string;
  created_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_by: string | null;
  /** Adopter-visible note ("Home visit scheduled for Saturday"). */
  note: string | null;
  created_at: string;
}

// ============================================================================
// Joined shapes returned by services
// ============================================================================

/** Pet columns embedded in application list/detail queries. */
export type ApplicationPet = Pick<
  Pet,
  'id' | 'name' | 'species' | 'breed' | 'photo_url' | 'status'
>;

export interface ApplicationWithPet extends Application {
  pets: ApplicationPet;
}

export interface ApplicationWithPetAndHistory extends ApplicationWithPet {
  application_status_history: StatusHistoryEntry[];
}
