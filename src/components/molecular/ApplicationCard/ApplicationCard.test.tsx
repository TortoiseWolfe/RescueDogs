import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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

function makeApplication(
  overrides: Partial<ApplicationWithPet> = {}
): ApplicationWithPet {
  return {
    id: 'app-123',
    adopter_id: 'adopter-1',
    pet_id: 'pet-1',
    shelter_id: 'shelter-1',
    status: 'under_review',
    profile_snapshot: profileSnapshot,
    why_this_pet: 'Biscuit looks like a perfect trail buddy.',
    status_changed_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    ...overrides,
    pets: {
      id: 'pet-1',
      name: 'Biscuit',
      species: 'dog',
      breed: 'Beagle Mix',
      photo_url: 'https://example.com/pets/biscuit.jpg',
      status: 'available',
      ...overrides.pets,
    },
  };
}

describe('ApplicationCard', () => {
  it('renders the pet name', () => {
    render(<ApplicationCard application={makeApplication()} />);
    expect(
      screen.getByRole('heading', { name: 'Biscuit' })
    ).toBeInTheDocument();
  });

  it('renders breed and species details', () => {
    render(<ApplicationCard application={makeApplication()} />);
    expect(screen.getByText('Beagle Mix · Dog')).toBeInTheDocument();
  });

  it('renders the status badge label for the current status', () => {
    render(
      <ApplicationCard application={makeApplication({ status: 'approved' })} />
    );
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Approved');
  });

  it('links to the status tracker with the application id', () => {
    render(<ApplicationCard application={makeApplication({ id: 'app-42' })} />);
    const link = screen.getByRole('link', { name: /view status/i });
    expect(link).toHaveAttribute('href', '/applications/status?id=app-42');
  });

  it('renders relative time from status_changed_at', () => {
    render(<ApplicationCard application={makeApplication()} />);
    expect(screen.getByText('Updated 5m ago')).toBeInTheDocument();
  });

  it('renders "just now" for a status change under a minute ago', () => {
    render(
      <ApplicationCard
        application={makeApplication({
          status_changed_at: new Date().toISOString(),
        })}
      />
    );
    expect(screen.getByText('Updated just now')).toBeInTheDocument();
  });

  it('renders the pet photo with alt text when photo_url is set', () => {
    render(<ApplicationCard application={makeApplication()} />);
    const img = screen.getByRole('img', { name: 'Photo of Biscuit' });
    expect(img).toHaveAttribute('src', 'https://example.com/pets/biscuit.jpg');
  });

  it('renders no img when the pet has no photo', () => {
    render(
      <ApplicationCard
        application={makeApplication({
          pets: {
            id: 'pet-2',
            name: 'Mochi',
            species: 'cat',
            breed: null,
            photo_url: null,
            status: 'available',
          },
        })}
      />
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <ApplicationCard
        application={makeApplication()}
        className="custom-test-class"
      />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});
