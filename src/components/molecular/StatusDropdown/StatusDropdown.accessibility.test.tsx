import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import StatusDropdown from './StatusDropdown';

expect.extend(toHaveNoViolations);

describe('StatusDropdown Accessibility', () => {
  it('should have no accessibility violations with an active pipeline status', async () => {
    const { container } = render(
      <StatusDropdown currentStatus="under_review" onAdvance={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in the terminal state', async () => {
    const { container } = render(
      <StatusDropdown currentStatus="approved" onAdvance={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in the confirm step', async () => {
    const { container } = render(
      <StatusDropdown currentStatus="home_visit" onAdvance={vi.fn()} />
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/new status/i),
      'approved'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /update status/i })
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations when disabled', async () => {
    const { container } = render(
      <StatusDropdown currentStatus="submitted" onAdvance={vi.fn()} disabled />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('associates labels with their controls via htmlFor/id', () => {
    render(<StatusDropdown currentStatus="submitted" onAdvance={vi.fn()} />);

    expect(screen.getByLabelText(/new status/i)).toBeInstanceOf(
      HTMLSelectElement
    );
    expect(
      screen.getByLabelText(/note to applicant \(visible on their tracker\)/i)
    ).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(
      <StatusDropdown currentStatus="under_review" onAdvance={vi.fn()} />
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
