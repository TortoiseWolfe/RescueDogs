import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ApplicationsTable from './ApplicationsTable';
import type {
  ApplicationStatus,
  ApplicationWithPet,
  ProfileSnapshot,
} from '@/types/applications';

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
  other_pets: null,
  vet_name: null,
  vet_phone: null,
  experience: null,
};

function makeApplication(
  overrides: Partial<ApplicationWithPet> & { id: string }
): ApplicationWithPet {
  return {
    adopter_id: 'adopter-1',
    pet_id: 'pet-1',
    shelter_id: 'shelter-1',
    status: 'submitted' as ApplicationStatus,
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

const applications: ApplicationWithPet[] = [
  makeApplication({ id: 'app-1' }),
  makeApplication({
    id: 'app-2',
    status: 'submitted',
    profile_snapshot: { ...baseSnapshot, full_name: 'Bella Browser' },
    pets: {
      id: 'pet-2',
      name: 'Whiskers',
      species: 'cat',
      breed: null,
      photo_url: null,
      status: 'available',
    },
  }),
  makeApplication({
    id: 'app-3',
    status: 'under_review',
    status_changed_at: '2026-06-05T12:00:00Z',
  }),
];

describe('ApplicationsTable', () => {
  it('renders a row per application with pet name, applicant name, and status badge', () => {
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="all"
        onFilterChange={vi.fn()}
      />
    );

    const row = screen.getByTestId('application-row-app-1');
    expect(within(row).getByText('Rex')).toBeInTheDocument();
    expect(within(row).getByText('Labrador')).toBeInTheDocument();
    expect(within(row).getByText('Alex Adopter')).toBeInTheDocument();
    expect(within(row).getByTestId('status-badge')).toHaveTextContent(
      'Submitted'
    );

    const reviewRow = screen.getByTestId('application-row-app-3');
    expect(within(reviewRow).getByTestId('status-badge')).toHaveTextContent(
      'Under Review'
    );

    expect(screen.getByTestId('application-row-app-2')).toBeInTheDocument();
    expect(screen.getByText('Whiskers')).toBeInTheDocument();
    expect(screen.getByText('Bella Browser')).toBeInTheDocument();
  });

  it('renders the last update as a short date', () => {
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="all"
        onFilterChange={vi.fn()}
      />
    );

    const row = screen.getByTestId('application-row-app-3');
    expect(within(row).getByText('Jun 5, 2026')).toBeInTheDocument();
  });

  it('renders only tabs for statuses present in the data, with correct counts', () => {
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="all"
        onFilterChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('tab-all')).toHaveTextContent('All (3)');
    expect(screen.getByTestId('tab-submitted')).toHaveTextContent(
      'Submitted (2)'
    );
    expect(screen.getByTestId('tab-under_review')).toHaveTextContent(
      'Under Review (1)'
    );
    // Statuses with no applications get no tab
    expect(screen.queryByTestId('tab-approved')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-not_selected')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-withdrawn')).not.toBeInTheDocument();

    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks the active tab via aria-selected', () => {
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="submitted"
        onFilterChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('tab-submitted')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('tab-all')).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('calls onFilterChange when a status tab is clicked', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="all"
        onFilterChange={onFilterChange}
      />
    );

    await user.click(screen.getByTestId('tab-under_review'));
    expect(onFilterChange).toHaveBeenCalledWith('under_review');
  });

  it('calls onFilterChange with "all" when the All tab is clicked', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="submitted"
        onFilterChange={onFilterChange}
      />
    );

    await user.click(screen.getByTestId('tab-all'));
    expect(onFilterChange).toHaveBeenCalledWith('all');
  });

  it('renders the empty state when there are no applications', () => {
    render(
      <ApplicationsTable
        applications={[]}
        statusFilter="all"
        onFilterChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('applications-empty')).toHaveTextContent(
      'No applications in this view yet'
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('keeps the active filter tab visible even when its result set is empty', () => {
    render(
      <ApplicationsTable
        applications={[]}
        statusFilter="approved"
        onFilterChange={vi.fn()}
      />
    );

    const approvedTab = screen.getByTestId('tab-approved');
    expect(approvedTab).toHaveTextContent('Approved (0)');
    expect(approvedTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders a Review link pointing at the shelter application detail page', () => {
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="all"
        onFilterChange={vi.fn()}
      />
    );

    const row = screen.getByTestId('application-row-app-2');
    const link = within(row).getByRole('link', { name: /review/i });
    expect(link).toHaveAttribute('href', '/shelter/application?id=app-2');
  });

  it('applies custom className when provided', () => {
    render(
      <ApplicationsTable
        applications={applications}
        statusFilter="all"
        onFilterChange={vi.fn()}
        className="custom-test-class"
      />
    );

    expect(screen.getByTestId('applications-table')).toHaveClass(
      'custom-test-class'
    );
  });
});
