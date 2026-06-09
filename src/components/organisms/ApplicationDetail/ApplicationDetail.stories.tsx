import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type {
  ApplicationPet,
  ApplicationWithPetAndHistory,
  ProfileSnapshot,
  StatusHistoryEntry,
} from '@/types/applications';
import ApplicationDetail from './ApplicationDetail';

const renterSnapshot: ProfileSnapshot = {
  full_name: 'Jane Renter',
  phone: '555-0101',
  address_line: '12 Oak St',
  city: 'Portland',
  state: 'OR',
  zip: '97201',
  housing_type: 'rent_apartment',
  landlord_approval: true,
  landlord_contact: 'Pat Property — landlord@example.com',
  has_yard: true,
  yard_fenced: false,
  household_adults: 2,
  household_children: 1,
  other_pets: 'One senior cat, very dog-tolerant',
  vet_name: 'Dr. Pawson, Rose City Vet',
  vet_phone: '555-0202',
  experience:
    'Grew up fostering herding dogs; currently volunteer at a county shelter on weekends.',
};

const ownerSparseSnapshot: ProfileSnapshot = {
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

const bella: ApplicationPet = {
  id: 'pet-1',
  name: 'Bella',
  species: 'dog',
  breed: 'Border Collie',
  photo_url: 'https://placedog.net/400/400?id=12',
  status: 'available',
};

const mochi: ApplicationPet = {
  id: 'pet-2',
  name: 'Mochi',
  species: 'cat',
  breed: null,
  photo_url: null,
  status: 'available',
};

function entry(
  id: string,
  from: StatusHistoryEntry['from_status'],
  to: StatusHistoryEntry['to_status'],
  created_at: string,
  note: string | null = null
): StatusHistoryEntry {
  return {
    id,
    application_id: 'app-1',
    from_status: from,
    to_status: to,
    changed_by: from === null ? null : 'staff-1',
    note,
    created_at,
  };
}

const renterApplication: ApplicationWithPetAndHistory = {
  id: 'app-1',
  adopter_id: 'adopter-1',
  pet_id: bella.id,
  shelter_id: 'shelter-1',
  status: 'home_visit',
  profile_snapshot: renterSnapshot,
  why_this_pet:
    'Bella matches our active household — we hike every weekend and want a smart, busy dog.',
  status_changed_at: '2026-06-05T16:00:00Z',
  created_at: '2026-06-01T12:00:00Z',
  pets: bella,
  application_status_history: [
    entry('h1', null, 'submitted', '2026-06-01T12:00:00Z'),
    entry(
      'h2',
      'submitted',
      'under_review',
      '2026-06-02T15:30:00Z',
      'Application looks strong; starting review.'
    ),
    entry(
      'h3',
      'under_review',
      'reference_check',
      '2026-06-03T10:00:00Z',
      'Calling vet and landlord this week.'
    ),
    entry(
      'h4',
      'reference_check',
      'home_visit',
      '2026-06-05T16:00:00Z',
      'Home visit scheduled for Saturday.'
    ),
  ],
};

const ownerApplication: ApplicationWithPetAndHistory = {
  id: 'app-2',
  adopter_id: 'adopter-2',
  pet_id: mochi.id,
  shelter_id: 'shelter-1',
  status: 'submitted',
  profile_snapshot: ownerSparseSnapshot,
  why_this_pet: null,
  status_changed_at: '2026-06-08T09:00:00Z',
  created_at: '2026-06-08T09:00:00Z',
  pets: mochi,
  application_status_history: [
    entry('h1', null, 'submitted', '2026-06-08T09:00:00Z'),
  ],
};

const terminalApplication: ApplicationWithPetAndHistory = {
  ...renterApplication,
  id: 'app-3',
  status: 'not_selected',
  status_changed_at: '2026-06-07T11:00:00Z',
  application_status_history: [
    ...renterApplication.application_status_history,
    entry(
      'h5',
      'home_visit',
      'not_selected',
      '2026-06-07T11:00:00Z',
      'Another applicant was a better fit for Bella. Thank you for applying!'
    ),
  ],
};

const meta = {
  title: 'Components/Organisms/ApplicationDetail',
  component: ApplicationDetail,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Staff view of a single adoption application: pet context with current status, the frozen profile snapshot exactly as submitted (never the live adopter profile), status advancement controls, and the adopter-visible status history (oldest first).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    application: {
      control: false,
      description: 'Application with embedded pet and status history',
    },
    onAdvance: {
      action: 'advance',
      description: 'Called when staff advances the application status',
    },
    advancing: {
      control: 'boolean',
      description: 'Disables status controls while a transition is in flight',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
  args: {
    onAdvance: () => {},
    advancing: false,
  },
} satisfies Meta<typeof ApplicationDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RenterWithFullData: Story = {
  args: {
    application: renterApplication,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A renter mid-pipeline (home_visit) with every snapshot field answered: landlord approval/contact rows appear because the housing type is a rental, and the history shows staff notes at each step.',
      },
    },
  },
};

export const OwnerWithSparseData: Story = {
  args: {
    application: ownerApplication,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A homeowner who answered only the required fields, applying for a pet without a photo. Optional fields render as em-dashes; landlord and yard-fenced rows are hidden.',
      },
    },
  },
};

export const TerminalApplication: Story = {
  args: {
    application: terminalApplication,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A not_selected application: terminal status badge and a complete history ending with the adopter-visible closing note. No further transitions are legal.',
      },
    },
  },
};
