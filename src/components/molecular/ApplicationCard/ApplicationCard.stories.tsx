import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ApplicationCard from './ApplicationCard';
import type { ApplicationWithPet, ProfileSnapshot } from '@/types/applications';

const profileSnapshot: ProfileSnapshot = {
  full_name: 'Jordan Rivera',
  phone: '555-0142',
  address_line: '12 Maple St',
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
  vet_name: 'Springfield Vet Clinic',
  vet_phone: '555-0188',
  experience: 'Grew up with dogs',
};

const baseApplication: ApplicationWithPet = {
  id: 'app-biscuit-001',
  adopter_id: 'adopter-1',
  pet_id: 'pet-biscuit',
  shelter_id: 'shelter-springfield',
  status: 'under_review',
  profile_snapshot: profileSnapshot,
  why_this_pet: 'Biscuit looks like the perfect trail buddy for our family.',
  status_changed_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  pets: {
    id: 'pet-biscuit',
    name: 'Biscuit',
    species: 'dog',
    breed: 'Beagle Mix',
    photo_url: 'https://placedog.net/640/480?id=12',
    status: 'available',
  },
};

const meta: Meta<typeof ApplicationCard> = {
  title: 'Components/Molecular/ApplicationCard',
  component: ApplicationCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Adopter-facing card for the "My Applications" list. Shows the pet, current pipeline status, last status change, and a link to the live status tracker.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    application: {
      control: 'object',
      description: 'Application joined with its pet',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[28rem] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** In-flight application moving through the pipeline. */
export const InFlight: Story = {
  args: {
    application: baseApplication,
  },
};

/** Happy ending — the application was approved. */
export const Approved: Story = {
  args: {
    application: {
      ...baseApplication,
      id: 'app-mochi-002',
      pet_id: 'pet-mochi',
      status: 'approved',
      why_this_pet: 'Mochi would love our sunny apartment windowsills.',
      status_changed_at: new Date(Date.now() - 30 * 60_000).toISOString(),
      pets: {
        id: 'pet-mochi',
        name: 'Mochi',
        species: 'cat',
        breed: 'Domestic Shorthair',
        photo_url: 'https://placedog.net/640/481?id=33',
        status: 'pending',
      },
    },
  },
};

/** Terminal branch — staff selected another adopter. */
export const NotSelected: Story = {
  args: {
    application: {
      ...baseApplication,
      id: 'app-ranger-003',
      pet_id: 'pet-ranger',
      status: 'not_selected',
      why_this_pet: 'Ranger seems like a great running partner.',
      status_changed_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      pets: {
        id: 'pet-ranger',
        name: 'Ranger',
        species: 'dog',
        breed: 'German Shepherd',
        photo_url: 'https://placedog.net/640/482?id=45',
        status: 'adopted',
      },
    },
  },
};

/** Pet without a photo — the card renders without an image column. */
export const NoPhoto: Story = {
  args: {
    application: {
      ...baseApplication,
      id: 'app-clover-004',
      pet_id: 'pet-clover',
      status: 'submitted',
      status_changed_at: new Date(Date.now() - 30_000).toISOString(),
      pets: {
        id: 'pet-clover',
        name: 'Clover',
        species: 'cat',
        breed: null,
        photo_url: null,
        status: 'available',
      },
    },
  },
};
