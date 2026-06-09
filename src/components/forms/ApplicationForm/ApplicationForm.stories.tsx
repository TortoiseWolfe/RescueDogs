import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import ApplicationForm from './ApplicationForm';
import type { Pet } from '@/types/applications';

const samplePets: Pet[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    shelter_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Biscuit',
    species: 'dog',
    breed: 'Labrador Mix',
    sex: 'male',
    age_years: 2,
    size: 'large',
    photo_url: null,
    status: 'available',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    shelter_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Mochi',
    species: 'cat',
    breed: null,
    sex: 'female',
    age_years: 3,
    size: 'small',
    photo_url: null,
    status: 'available',
    created_at: '2025-01-02T00:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    shelter_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Ranger',
    species: 'dog',
    breed: 'Border Collie',
    sex: 'male',
    age_years: 5,
    size: 'medium',
    photo_url: null,
    status: 'available',
    created_at: '2025-01-03T00:00:00Z',
  },
];

const meta = {
  title: 'Features/Forms/ApplicationForm',
  component: ApplicationForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The universal adoption application: five fieldset sections ' +
          '(This Pet, About You, Your Home, Household & Pets, References & ' +
          'Experience) validated by applicationSchema. Landlord approval ' +
          'controls appear only while renting; yard fencing only with a yard. ' +
          'Presentational — the parent persists the parsed ApplicationFormData.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    pets: samplePets,
    onSubmit: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-base-100 mx-auto w-full max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ApplicationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Blank application, no pet preselected. */
export const Blank: Story = {};

/** Prefilled from a saved renter profile — landlord controls visible. */
export const PrefilledRenter: Story = {
  args: {
    preselectedPetId: samplePets[1].id,
    defaultValues: {
      full_name: 'Sam Renter',
      phone: '555-0102',
      address_line: '12 Maple St, Apt 4',
      city: 'Springfield',
      state: 'IL',
      zip: '62704',
      housing_type: 'rent_apartment',
      landlord_approval: true,
      landlord_contact: 'Pat Property — 555-0199',
      has_yard: false,
      household_adults: 2,
      household_children: 1,
      other_pets: 'One senior cat, spayed and up to date on shots.',
      vet_name: 'Springfield Vet Clinic',
      vet_phone: '555-0123',
      experience: 'Grew up with dogs; fostered two seniors last year.',
      why_this_pet: 'Mochi matches our quiet apartment lifestyle.',
    },
  },
};

/** Parent is persisting the application — submit button disabled. */
export const Submitting: Story = {
  args: {
    preselectedPetId: samplePets[0].id,
    defaultValues: {
      full_name: 'Jane Doe',
      housing_type: 'own_house',
    },
    submitting: true,
  },
};
