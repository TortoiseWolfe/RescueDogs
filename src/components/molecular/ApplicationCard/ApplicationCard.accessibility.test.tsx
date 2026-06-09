import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ApplicationCard from './ApplicationCard';
import type { ApplicationWithPet, ProfileSnapshot } from '@/types/applications';

expect.extend(toHaveNoViolations);

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

const application: ApplicationWithPet = {
  id: 'app-123',
  adopter_id: 'adopter-1',
  pet_id: 'pet-1',
  shelter_id: 'shelter-1',
  status: 'under_review',
  profile_snapshot: profileSnapshot,
  why_this_pet: 'Biscuit looks like a perfect trail buddy.',
  status_changed_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  created_at: new Date(Date.now() - 86_400_000).toISOString(),
  pets: {
    id: 'pet-1',
    name: 'Biscuit',
    species: 'dog',
    breed: 'Beagle Mix',
    photo_url: 'https://example.com/pets/biscuit.jpg',
    status: 'available',
  },
};

describe('ApplicationCard Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<ApplicationCard application={application} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(<ApplicationCard application={application} />);

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // The "View status" link is the only focusable element
    expect(focusableElements).toHaveLength(1);
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(<ApplicationCard application={application} />);

    // Card is an article with an accessible heading
    expect(container.querySelector('article')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Biscuit' })
    ).toBeInTheDocument();

    // Images should have alt text
    const images = container.querySelectorAll('img');
    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
      expect(img.getAttribute('alt')).not.toBe('');
    });
  });
});
