import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type {
  ApplicationPet,
  ApplicationStatus,
  ApplicationWithPetAndHistory,
  ProfileSnapshot,
  StatusHistoryEntry,
} from '@/types/applications';
import ApplicationDetail from './ApplicationDetail';

// Mock StatusDropdown (built in parallel) so these tests only verify the
// contract: it receives currentStatus/disabled and propagates onAdvance.
vi.mock('@/components/molecular/StatusDropdown', () => ({
  default: ({
    currentStatus,
    onAdvance,
    disabled,
  }: {
    currentStatus: ApplicationStatus;
    onAdvance: (toStatus: ApplicationStatus, note?: string) => void;
    disabled?: boolean;
  }) => (
    <div
      data-testid="status-dropdown"
      data-current-status={currentStatus}
      data-disabled={disabled ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => onAdvance('reference_check', 'References received')}
      >
        mock-advance
      </button>
    </div>
  ),
}));

const EM_DASH = '—';

const renterSnapshot: ProfileSnapshot = {
  full_name: 'Jane Renter',
  phone: '555-0101',
  address_line: '12 Oak St',
  city: 'Portland',
  state: 'OR',
  zip: '97201',
  housing_type: 'rent_apartment',
  landlord_approval: true,
  landlord_contact: 'landlord@example.com',
  has_yard: true,
  yard_fenced: false,
  household_adults: 2,
  household_children: 1,
  other_pets: 'One senior cat',
  vet_name: 'Dr. Pawson',
  vet_phone: '555-0202',
  experience: 'Grew up fostering herding dogs',
};

const sparseSnapshot: ProfileSnapshot = {
  full_name: 'Sam Sparse',
  phone: null,
  address_line: null,
  city: null,
  state: null,
  zip: null,
  housing_type: 'own_house',
  landlord_approval: null,
  landlord_contact: null,
  has_yard: false,
  yard_fenced: null,
  household_adults: 1,
  household_children: 0,
  other_pets: null,
  vet_name: null,
  vet_phone: null,
  experience: null,
};

const pet: ApplicationPet = {
  id: 'pet-1',
  name: 'Bella',
  species: 'dog',
  breed: 'Border Collie',
  photo_url: 'https://example.com/bella.jpg',
  status: 'available',
};

// Intentionally out of order: the component must sort oldest first.
const history: StatusHistoryEntry[] = [
  {
    id: 'h2',
    application_id: 'app-1',
    from_status: 'submitted',
    to_status: 'under_review',
    changed_by: 'staff-1',
    note: 'Reviewing references',
    created_at: '2026-06-02T12:00:00Z',
  },
  {
    id: 'h1',
    application_id: 'app-1',
    from_status: null,
    to_status: 'submitted',
    changed_by: null,
    note: null,
    created_at: '2026-06-01T12:00:00Z',
  },
];

const baseApplication: ApplicationWithPetAndHistory = {
  id: 'app-1',
  adopter_id: 'adopter-1',
  pet_id: 'pet-1',
  shelter_id: 'shelter-1',
  status: 'under_review',
  profile_snapshot: renterSnapshot,
  why_this_pet: 'She matches our active household.',
  status_changed_at: '2026-06-02T12:00:00Z',
  created_at: '2026-06-01T12:00:00Z',
  pets: pet,
  application_status_history: history,
};

function makeApplication(
  overrides: Partial<ApplicationWithPetAndHistory> = {}
): ApplicationWithPetAndHistory {
  return { ...baseApplication, ...overrides };
}

/** Returns the <dd> paired with the <dt> whose text is `label`. */
function getDefinition(label: string): HTMLElement {
  const dt = screen.getByText(label, { selector: 'dt' });
  return dt.nextElementSibling as HTMLElement;
}

describe('ApplicationDetail', () => {
  describe('pet header', () => {
    it('renders the pet name, breed/species, and photo', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
        />
      );
      expect(
        screen.getByRole('heading', { name: 'Bella' })
      ).toBeInTheDocument();
      expect(screen.getByText('Border Collie · Dog')).toBeInTheDocument();
      const photo = screen.getByRole('img', { name: 'Photo of Bella' });
      expect(photo).toHaveAttribute('src', 'https://example.com/bella.jpg');
    });

    it('renders no image when the pet has no photo', () => {
      render(
        <ApplicationDetail
          application={makeApplication({ pets: { ...pet, photo_url: null } })}
          onAdvance={vi.fn()}
        />
      );
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('shows the current status badge', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
        />
      );
      expect(screen.getByTestId('status-badge')).toHaveTextContent(
        'Under Review'
      );
    });
  });

  describe('why this pet', () => {
    it('renders the quote when present', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
        />
      );
      expect(
        screen.getByText('She matches our active household.')
      ).toBeInTheDocument();
    });

    it('omits the section when null', () => {
      render(
        <ApplicationDetail
          application={makeApplication({ why_this_pet: null })}
          onAdvance={vi.fn()}
        />
      );
      expect(screen.queryByText('Why this pet')).not.toBeInTheDocument();
    });
  });

  describe('profile snapshot', () => {
    it('renders About You fields', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
        />
      );
      expect(getDefinition('Full name')).toHaveTextContent('Jane Renter');
      expect(getDefinition('Email')).toHaveTextContent(EM_DASH);
      expect(getDefinition('Phone')).toHaveTextContent('555-0101');
      expect(getDefinition('Address')).toHaveTextContent(
        '12 Oak St, Portland, OR, 97201'
      );
    });

    it('renders staff-only applicant email when provided (#66)', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          applicantEmail="jane@example.com"
          onAdvance={vi.fn()}
        />
      );
      expect(getDefinition('Email')).toHaveTextContent('jane@example.com');
    });

    it('renders Your Home fields with humanized housing and landlord rows when renting', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
        />
      );
      expect(getDefinition('Housing')).toHaveTextContent('Rent — apartment');
      expect(getDefinition('Landlord approval')).toHaveTextContent('Yes');
      expect(getDefinition('Landlord contact')).toHaveTextContent(
        'landlord@example.com'
      );
      expect(getDefinition('Has yard')).toHaveTextContent('Yes');
      expect(getDefinition('Yard fenced')).toHaveTextContent('No');
    });

    it('renders Household & Pets and References & Experience fields', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
        />
      );
      expect(getDefinition('Adults in household')).toHaveTextContent('2');
      expect(getDefinition('Children in household')).toHaveTextContent('1');
      expect(getDefinition('Other pets')).toHaveTextContent('One senior cat');
      expect(getDefinition('Veterinarian')).toHaveTextContent('Dr. Pawson');
      expect(getDefinition('Veterinarian phone')).toHaveTextContent('555-0202');
      expect(getDefinition('Experience')).toHaveTextContent(
        'Grew up fostering herding dogs'
      );
    });

    it('renders em-dashes for a null-heavy snapshot without crashing', () => {
      render(
        <ApplicationDetail
          application={makeApplication({ profile_snapshot: sparseSnapshot })}
          onAdvance={vi.fn()}
        />
      );
      expect(getDefinition('Phone')).toHaveTextContent(EM_DASH);
      expect(getDefinition('Address')).toHaveTextContent(EM_DASH);
      expect(getDefinition('Other pets')).toHaveTextContent(EM_DASH);
      expect(getDefinition('Veterinarian')).toHaveTextContent(EM_DASH);
      expect(getDefinition('Veterinarian phone')).toHaveTextContent(EM_DASH);
      expect(getDefinition('Experience')).toHaveTextContent(EM_DASH);
      expect(getDefinition('Housing')).toHaveTextContent('Own — house');
    });

    it('hides landlord and yard-fenced rows for an owner without a yard', () => {
      render(
        <ApplicationDetail
          application={makeApplication({ profile_snapshot: sparseSnapshot })}
          onAdvance={vi.fn()}
        />
      );
      expect(screen.queryByText('Landlord approval')).not.toBeInTheDocument();
      expect(screen.queryByText('Landlord contact')).not.toBeInTheDocument();
      expect(getDefinition('Has yard')).toHaveTextContent('No');
      expect(screen.queryByText('Yard fenced')).not.toBeInTheDocument();
    });
  });

  describe('status dropdown wiring', () => {
    it('passes the current status to StatusDropdown', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
        />
      );
      expect(screen.getByTestId('status-dropdown')).toHaveAttribute(
        'data-current-status',
        'under_review'
      );
    });

    it('propagates onAdvance with status and note', () => {
      const onAdvance = vi.fn();
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={onAdvance}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'mock-advance' }));
      expect(onAdvance).toHaveBeenCalledTimes(1);
      expect(onAdvance).toHaveBeenCalledWith(
        'reference_check',
        'References received'
      );
    });

    it('disables the dropdown while advancing', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
          advancing
        />
      );
      expect(screen.getByTestId('status-dropdown')).toHaveAttribute(
        'data-disabled',
        'true'
      );
    });

    it('leaves the dropdown enabled by default', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
        />
      );
      expect(screen.getByTestId('status-dropdown')).toHaveAttribute(
        'data-disabled',
        'false'
      );
    });
  });

  describe('status history', () => {
    it('renders entries oldest first with dates and notes', () => {
      render(
        <ApplicationDetail
          application={makeApplication()}
          onAdvance={vi.fn()}
        />
      );
      const items = within(screen.getByTestId('status-history')).getAllByRole(
        'listitem'
      );
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('Submitted');
      expect(items[0]).not.toHaveTextContent('→');
      expect(items[0]).toHaveTextContent(/Jun \d{1,2}, 2026/);
      expect(items[1]).toHaveTextContent('Submitted → Under Review');
      expect(items[1]).toHaveTextContent('Reviewing references');
    });

    it('shows an empty state when there is no history', () => {
      render(
        <ApplicationDetail
          application={makeApplication({ application_status_history: [] })}
          onAdvance={vi.fn()}
        />
      );
      expect(screen.getByText('No status changes yet.')).toBeInTheDocument();
      expect(screen.queryByTestId('status-history')).not.toBeInTheDocument();
    });
  });

  it('applies a custom className to the root element', () => {
    render(
      <ApplicationDetail
        application={makeApplication()}
        onAdvance={vi.fn()}
        className="custom-test-class"
      />
    );
    expect(screen.getByTestId('application-detail')).toHaveClass(
      'custom-test-class'
    );
  });
});
