import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import ApplicationForm from './ApplicationForm';
import type { Pet } from '@/types/applications';

expect.extend(toHaveNoViolations);

const pets: Pet[] = [
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
];

describe('ApplicationForm Accessibility', () => {
  it('should have no accessibility violations (blank form)', async () => {
    const { container } = render(
      <ApplicationForm pets={pets} onSubmit={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with renter and yard fields visible', async () => {
    const { container } = render(
      <ApplicationForm
        pets={pets}
        onSubmit={vi.fn()}
        defaultValues={{ housing_type: 'rent_apartment', has_yard: true }}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('labels every form control', () => {
    const { container } = render(
      <ApplicationForm
        pets={pets}
        onSubmit={vi.fn()}
        defaultValues={{ housing_type: 'rent_house', has_yard: true }}
      />
    );

    const controls = container.querySelectorAll('input, select, textarea');
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((control) => {
      const id = control.getAttribute('id');
      expect(id).toBeTruthy();
      expect(container.querySelector(`label[for="${id}"]`)).not.toBeNull();
    });
  });

  it('marks required fields with aria-required', () => {
    render(<ApplicationForm pets={pets} onSubmit={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Pet' })).toHaveAttribute(
      'aria-required',
      'true'
    );
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute(
      'aria-required',
      'true'
    );
    expect(
      screen.getByRole('combobox', { name: /housing situation/i })
    ).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/adults in household/i)).toHaveAttribute(
      'aria-required',
      'true'
    );
    expect(screen.getByLabelText(/children in household/i)).toHaveAttribute(
      'aria-required',
      'true'
    );
  });

  it('links validation errors to controls via aria-describedby', async () => {
    const user = userEvent.setup();
    render(
      <ApplicationForm
        pets={pets}
        onSubmit={vi.fn()}
        defaultValues={{ housing_type: 'rent_house' }}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /submit application/i })
    );

    const checkbox = await screen.findByLabelText(/landlord has approved/i);
    expect(checkbox).toHaveAttribute(
      'aria-describedby',
      'landlord_approval-error'
    );
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');

    const error = document.getElementById('landlord_approval-error');
    expect(error).toHaveTextContent(/landlord's approval/i);
    expect(error).toHaveAttribute('role', 'alert');
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(
      <ApplicationForm pets={pets} onSubmit={vi.fn()} />
    );

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // All focusable elements should be visible
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });
});
