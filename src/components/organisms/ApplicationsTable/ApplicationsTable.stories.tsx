import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import ApplicationsTable from './ApplicationsTable';
import type { ApplicationWithPet, ProfileSnapshot } from '@/types/applications';

const baseSnapshot: ProfileSnapshot = {
  full_name: 'Alex Adopter',
  phone: '555-0100',
  address_line: '123 Main St',
  city: 'Springfield',
  state: 'IL',
  zip: '62704',
  housing_type: 'own_house',
  landlord_approval: null,
  landlord_contact: null,
  has_yard: true,
  yard_fenced: true,
  household_adults: 2,
  household_children: 1,
  other_pets: 'One senior cat',
  vet_name: 'Dr. Vetson',
  vet_phone: '555-0199',
  experience: 'Lifelong dog owner',
};

function makeApplication(
  overrides: Partial<ApplicationWithPet> & { id: string }
): ApplicationWithPet {
  return {
    adopter_id: 'adopter-1',
    pet_id: 'pet-1',
    shelter_id: 'shelter-1',
    status: 'submitted',
    profile_snapshot: baseSnapshot,
    why_this_pet: null,
    status_changed_at: '2026-06-01T12:00:00Z',
    created_at: '2026-05-28T12:00:00Z',
    pets: {
      id: 'pet-1',
      name: 'Rex',
      species: 'dog',
      breed: 'Labrador',
      photo_url: null,
      status: 'available',
    },
    ...overrides,
  };
}

const pipelineMix: ApplicationWithPet[] = [
  makeApplication({ id: 'app-1' }),
  makeApplication({
    id: 'app-2',
    status: 'under_review',
    status_changed_at: '2026-06-03T12:00:00Z',
    profile_snapshot: { ...baseSnapshot, full_name: 'Bella Browser' },
    pets: {
      id: 'pet-2',
      name: 'Whiskers',
      species: 'cat',
      breed: 'Tabby',
      photo_url: null,
      status: 'available',
    },
  }),
  makeApplication({
    id: 'app-3',
    status: 'reference_check',
    status_changed_at: '2026-06-04T12:00:00Z',
    profile_snapshot: { ...baseSnapshot, full_name: 'Carmen Caretaker' },
    pets: {
      id: 'pet-3',
      name: 'Daisy',
      species: 'dog',
      breed: 'Beagle',
      photo_url: null,
      status: 'pending',
    },
  }),
  makeApplication({
    id: 'app-4',
    status: 'home_visit',
    status_changed_at: '2026-06-05T12:00:00Z',
    profile_snapshot: { ...baseSnapshot, full_name: 'Devon Dogfan' },
    pets: {
      id: 'pet-4',
      name: 'Max',
      species: 'dog',
      breed: null,
      photo_url: null,
      status: 'pending',
    },
  }),
  makeApplication({
    id: 'app-5',
    status: 'approved',
    status_changed_at: '2026-06-06T12:00:00Z',
    profile_snapshot: { ...baseSnapshot, full_name: 'Erin Excited' },
    pets: {
      id: 'pet-5',
      name: 'Luna',
      species: 'cat',
      breed: 'Siamese',
      photo_url: null,
      status: 'adopted',
    },
  }),
  makeApplication({
    id: 'app-6',
    status: 'not_selected',
    status_changed_at: '2026-06-02T12:00:00Z',
    profile_snapshot: { ...baseSnapshot, full_name: 'Frank Fancier' },
  }),
  makeApplication({
    id: 'app-7',
    status: 'withdrawn',
    status_changed_at: '2026-06-01T12:00:00Z',
    profile_snapshot: { ...baseSnapshot, full_name: 'Grace Goneaway' },
  }),
];

const meta: Meta<typeof ApplicationsTable> = {
  title: 'Components/Organisms/ApplicationsTable',
  component: ApplicationsTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Shelter staff pipeline list: status filter tabs with counts above a table of applications (pet, applicant, status badge, last update, Review link). Presentational — filtering is done by the parent.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onFilterChange: fn(),
  },
  argTypes: {
    statusFilter: {
      control: 'select',
      options: [
        'all',
        'submitted',
        'under_review',
        'reference_check',
        'home_visit',
        'approved',
        'not_selected',
        'withdrawn',
      ],
      description: 'Currently active status filter tab',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FullPipeline: Story = {
  args: {
    applications: pipelineMix,
    statusFilter: 'all',
  },
};

export const FilteredView: Story = {
  args: {
    applications: pipelineMix.filter((app) => app.status === 'under_review'),
    statusFilter: 'under_review',
  },
};

export const Empty: Story = {
  args: {
    applications: [],
    statusFilter: 'all',
  },
};
