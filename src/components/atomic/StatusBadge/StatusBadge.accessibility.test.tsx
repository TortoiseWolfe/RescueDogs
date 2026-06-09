import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { STATUS_LABELS, type ApplicationStatus } from '@/types/applications';
import StatusBadge from './StatusBadge';

expect.extend(toHaveNoViolations);

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

describe('StatusBadge Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<StatusBadge status="under_review" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations for any status', async () => {
    const { container } = render(
      <div>
        {ALL_STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('exposes the status label as real text, not hidden from AT', () => {
    const { container } = render(<StatusBadge status="approved" />);
    const badge = container.querySelector('[data-testid="status-badge"]');

    expect(badge).toHaveTextContent(STATUS_LABELS.approved);
    expect(badge).not.toHaveAttribute('aria-hidden');
    expect(badge?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(<StatusBadge status="submitted" />);
    const badge = container.querySelector('[data-testid="status-badge"]');

    // Non-interactive status text: a span, not a focusable control
    expect(badge?.tagName).toBe('SPAN');
    expect(badge).not.toHaveAttribute('tabindex');
  });
});
