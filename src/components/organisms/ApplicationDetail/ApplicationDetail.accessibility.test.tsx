import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import type {
  ApplicationPet,
  ApplicationWithPetAndHistory,
  ProfileSnapshot,
  StatusHistoryEntry,
} from '@/types/applications';
import ApplicationDetail from './ApplicationDetail';

expect.extend(toHaveNoViolations);

// Mock StatusDropdown (built in parallel) with an accessible stand-in so
// axe exercises a realistic labeled control.
vi.mock('@/components/molecular/StatusDropdown', () => ({
  default: ({ disabled }: { disabled?: boolean }) => (
    <select
      className="select"
      aria-label="Update application status"
      disabled={disabled}
      defaultValue="under_review"
    >
      <option value="under_review">Under Review</option>
    </select>
  ),
}));

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
  ...renterSnapshot,
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

const history: StatusHistoryEntry[] = [
  {
    id: 'h1',
    application_id: 'app-1',
    from_status: null,
    to_status: 'submitted',
    changed_by: null,
    note: null,
    created_at: '2026-06-01T12:00:00Z',
  },
  {
    id: 'h2',
    application_id: 'app-1',
    from_status: 'submitted',
    to_status: 'under_review',
    changed_by: 'staff-1',
    note: 'Reviewing references',
    created_at: '2026-06-02T12:00:00Z',
  },
];

const application: ApplicationWithPetAndHistory = {
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

describe('ApplicationDetail Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <ApplicationDetail application={application} onAdvance={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with a null-heavy snapshot and no photo', async () => {
    const { container } = render(
      <ApplicationDetail
        application={{
          ...application,
          profile_snapshot: sparseSnapshot,
          why_this_pet: null,
          pets: { ...pet, photo_url: null },
          application_status_history: [],
        }}
        onAdvance={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('keeps a sane heading hierarchy (h2 sections, h3 snapshot subsections)', () => {
    const { container } = render(
      <ApplicationDetail application={application} onAdvance={vi.fn()} />
    );
    const levels = Array.from(
      container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    ).map((h) => Number(h.tagName.slice(1)));

    expect(levels[0]).toBe(2); // pet name
    expect(levels).toContain(3); // snapshot subsections
    expect(levels).not.toContain(1);
    // No level is skipped going downward (e.g. h2 → h4)
    levels.reduce((prev, level) => {
      expect(level - prev).toBeLessThanOrEqual(1);
      return level;
    }, levels[0]);
  });

  it('uses dl/dt/dd semantics for the snapshot', () => {
    const { container } = render(
      <ApplicationDetail application={application} onAdvance={vi.fn()} />
    );
    const lists = container.querySelectorAll('dl');
    expect(lists.length).toBeGreaterThanOrEqual(4);
    lists.forEach((dl) => {
      Array.from(dl.children).forEach((child) => {
        expect(child.tagName).toBe('DIV');
        expect(child.querySelector('dt')).not.toBeNull();
        expect(child.querySelector('dd')).not.toBeNull();
      });
    });
  });

  it('gives the pet photo meaningful alt text', () => {
    const { container } = render(
      <ApplicationDetail application={application} onAdvance={vi.fn()} />
    );
    container.querySelectorAll('img').forEach((img) => {
      expect(img).toHaveAttribute('alt');
      expect(img.getAttribute('alt')).not.toBe('');
    });
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(
      <ApplicationDetail application={application} onAdvance={vi.fn()} />
    );
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });
});
