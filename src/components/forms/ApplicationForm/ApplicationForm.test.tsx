import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ApplicationForm from './ApplicationForm';
import type { Pet } from '@/types/applications';
import type { ApplicationFormData } from '@/schemas/application.schema';

const BISCUIT_ID = '11111111-1111-1111-1111-111111111111';
const MOCHI_ID = '22222222-2222-2222-2222-222222222222';
const SHELTER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const pets: Pet[] = [
  {
    id: BISCUIT_ID,
    shelter_id: SHELTER_ID,
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
    id: MOCHI_ID,
    shelter_id: SHELTER_ID,
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
];

const onSubmit = vi.fn();

function renderForm(
  props: Partial<React.ComponentProps<typeof ApplicationForm>> = {}
) {
  return render(<ApplicationForm pets={pets} onSubmit={onSubmit} {...props} />);
}

function petSelect() {
  return screen.getByRole('combobox', { name: 'Pet' }) as HTMLSelectElement;
}

function housingSelect() {
  return screen.getByRole('combobox', {
    name: /housing situation/i,
  }) as HTMLSelectElement;
}

function submitButton() {
  return screen.getByRole('button', { name: /submit application/i });
}

/** Minimum valid data for a homeowner application. */
async function fillValidOwnerData(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(petSelect(), BISCUIT_ID);
  await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
  await user.selectOptions(housingSelect(), 'own_house');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApplicationForm', () => {
  describe('Rendering', () => {
    it('renders all five section legends', () => {
      renderForm();

      expect(
        screen.getByRole('group', { name: 'This Pet' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('group', { name: 'About You' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('group', { name: 'Your Home' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('group', { name: 'Household & Pets' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('group', { name: 'References & Experience' })
      ).toBeInTheDocument();
    });

    it('applies custom className to the form', () => {
      const { container } = renderForm({ className: 'custom-test-class' });
      expect(container.querySelector('form')).toHaveClass('custom-test-class');
    });

    it('disables the submit button while submitting', () => {
      renderForm({ submitting: true });
      expect(submitButton()).toBeDisabled();
    });
  });

  describe('Pet select', () => {
    it('lists the provided pets with name and breed', () => {
      renderForm();

      expect(
        screen.getByRole('option', { name: 'Biscuit — Labrador Mix' })
      ).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Mochi' })).toBeInTheDocument();
      // placeholder + 2 pets
      expect(within(petSelect()).getAllByRole('option')).toHaveLength(3);
    });

    it('respects preselectedPetId', () => {
      renderForm({ preselectedPetId: MOCHI_ID });
      expect(petSelect()).toHaveValue(MOCHI_ID);
    });

    it('defaults to the placeholder when no pet is preselected', () => {
      renderForm();
      expect(petSelect()).toHaveValue('');
    });
  });

  describe('Conditional fields', () => {
    it('hides landlord controls for owners', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.selectOptions(housingSelect(), 'own_house');

      expect(
        screen.queryByLabelText(/landlord has approved/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/landlord contact/i)
      ).not.toBeInTheDocument();
    });

    it('shows landlord controls for renters', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.selectOptions(housingSelect(), 'rent_apartment');

      expect(
        screen.getByLabelText(/landlord has approved/i)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/landlord contact/i)).toBeInTheDocument();
    });

    it('shows the yard fenced checkbox only when has yard is checked', async () => {
      const user = userEvent.setup();
      renderForm();

      expect(
        screen.queryByLabelText(/yard is fenced/i)
      ).not.toBeInTheDocument();

      await user.click(screen.getByLabelText(/i have a yard/i));

      expect(screen.getByLabelText(/yard is fenced/i)).toBeInTheDocument();
    });

    it('prefills renter defaultValues including landlord approval', () => {
      renderForm({
        defaultValues: {
          full_name: 'Sam Renter',
          housing_type: 'rent_apartment',
          landlord_approval: true,
        },
      });

      expect(screen.getByLabelText(/full name/i)).toHaveValue('Sam Renter');
      expect(housingSelect()).toHaveValue('rent_apartment');
      expect(screen.getByLabelText(/landlord has approved/i)).toBeChecked();
    });
  });

  describe('Submission', () => {
    it('calls onSubmit with parsed data for a valid owner application', async () => {
      const user = userEvent.setup();
      renderForm();

      await fillValidOwnerData(user);
      await user.click(submitButton());

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const data = onSubmit.mock.calls[0][0] as ApplicationFormData;
      expect(data).toMatchObject({
        pet_id: BISCUIT_ID,
        full_name: 'Jane Doe',
        housing_type: 'own_house',
        has_yard: false,
        household_adults: 1,
        household_children: 0,
      });
      // empty optional strings parse to undefined
      expect(data.phone).toBeUndefined();
      expect(data.why_this_pet).toBeUndefined();
    });

    it('shows the landlord refinement error and blocks submit for renters without approval', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.selectOptions(petSelect(), BISCUIT_ID);
      await user.type(screen.getByLabelText(/full name/i), 'Sam Renter');
      await user.selectOptions(housingSelect(), 'rent_house');
      await user.click(submitButton());

      const error = await screen.findByText(/landlord's approval/i);
      expect(error).toBeInTheDocument();

      // error is linked to the landlord checkbox
      const checkbox = screen.getByLabelText(/landlord has approved/i);
      expect(checkbox).toHaveAttribute(
        'aria-describedby',
        'landlord_approval-error'
      );

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('coerces household counts to numbers', async () => {
      const user = userEvent.setup();
      renderForm();

      await fillValidOwnerData(user);

      const adults = screen.getByLabelText(/adults in household/i);
      const children = screen.getByLabelText(/children in household/i);
      await user.clear(adults);
      await user.type(adults, '3');
      await user.clear(children);
      await user.type(children, '2');

      await user.click(submitButton());

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const data = onSubmit.mock.calls[0][0] as ApplicationFormData;
      expect(data.household_adults).toBe(3);
      expect(data.household_children).toBe(2);
      expect(typeof data.household_adults).toBe('number');
      expect(typeof data.household_children).toBe('number');
    });

    it('shows validation errors and does not submit when required fields are missing', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(submitButton());

      await waitFor(() => {
        expect(
          screen.getByText(/please choose a pet to apply for/i)
        ).toBeInTheDocument();
      });
      expect(
        screen.getByText(/full name must be at least 2 characters/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/please select your housing situation/i)
      ).toBeInTheDocument();

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
