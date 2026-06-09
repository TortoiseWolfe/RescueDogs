import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ApplicationsTable from './ApplicationsTable';
import type { ApplicationWithPet, ProfileSnapshot } from '@/types/applications';

expect.extend(toHaveNoViolations);

const baseSnapshot: ProfileSnapshot = {
  full_name: 'Alex Adopter',
  phone: null,
  address_line: null,
  city: null,
  state: null,
  zip: null,
  housing_type: 'own_house',
  landlord_approval: null,
  landlord_contact: null,
  has_yard: true,
  yard_fenced: true,
  household_adults: 2,
  household_children: 0,
  other_pets: null,
  vet_name: null,
  vet_phone: null,
  experience: null,
};

const applications: ApplicationWithPet[] = [
  {
    id: 'app-1',
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
  },
  {
    id: 'app-2',
    adopter_id: 'adopter-2',
    pet_id: 'pet-2',
    shelter_id: 'shelter-1',
    status: 'under_review',
    profile_snapshot: { ...baseSnapshot, full_name: 'Bella Browser' },
    why_this_pet: null,
    status_changed_at: '2026-06-05T12:00:00Z',
    created_at: '2026-05-29T12:00:00Z',
    pets: {
      id: 'pet-2',
      name: 'Whiskers',
      species: 'cat',
      breed: null,
      photo_url: null,
      status: 'available',
    },
  },
];

describe('ApplicationsTable Accessibility', () => {
  it('should have no accessibility violations with applications', async () => {
    const { container } = render(
      <ApplicationsTable
        applications={applications}
        statusFilter="all"
        onFilterChange={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in the empty state', async () => {
    const { container } = render(
      <ApplicationsTable
        applications={[]}
        statusFilter="all"
        onFilterChange={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should expose a labelled tablist with keyboard-reachable tabs', () => {
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="submitted"
        onFilterChange={vi.fn()}
      />
    );

    const tablist = screen.getByRole('tablist', {
      name: 'Filter applications by status',
    });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);
    tabs.forEach((tab) => {
      // Native buttons are keyboard reachable (no tabindex=-1)
      expect(tab.tagName).toBe('BUTTON');
      expect(tab).not.toHaveAttribute('tabindex', '-1');
      expect(tab).toHaveAttribute('aria-selected');
    });
  });

  it('should use proper table semantics with column headers', () => {
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="all"
        onFilterChange={vi.fn()}
      />
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(5);
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 data rows
  });

  it('should have focusable elements visible', () => {
    const { container } = render(
      <ApplicationsTable
        applications={applications}
        statusFilter="all"
        onFilterChange={vi.fn()}
      />
    );

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusableElements.length).toBeGreaterThan(0);
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });
});
