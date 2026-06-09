import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { STATUS_LABELS, type ApplicationStatus } from '@/types/applications';
import StatusBadge, { STATUS_BADGE_VARIANTS } from './StatusBadge';

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

describe('StatusBadge', () => {
  it.each(ALL_STATUSES)('renders the human label for %s', (status) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent(STATUS_LABELS[status]);
  });

  it('applies the badge base class', () => {
    render(<StatusBadge status="submitted" />);
    expect(screen.getByTestId('status-badge')).toHaveClass('badge');
  });

  it('applies badge-info for submitted', () => {
    render(<StatusBadge status="submitted" />);
    expect(screen.getByTestId('status-badge')).toHaveClass('badge-info');
  });

  it('applies badge-success for approved', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByTestId('status-badge')).toHaveClass('badge-success');
  });

  it('applies badge-error for not_selected', () => {
    render(<StatusBadge status="not_selected" />);
    expect(screen.getByTestId('status-badge')).toHaveClass('badge-error');
  });

  it('applies badge-neutral for withdrawn', () => {
    render(<StatusBadge status="withdrawn" />);
    expect(screen.getByTestId('status-badge')).toHaveClass('badge-neutral');
  });

  it('merges a custom className with the variant classes', () => {
    render(<StatusBadge status="under_review" className="badge-lg" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveClass('badge');
    expect(badge).toHaveClass('badge-primary');
    expect(badge).toHaveClass('badge-lg');
  });

  it('exports a variant entry for every status', () => {
    ALL_STATUSES.forEach((status) => {
      expect(STATUS_BADGE_VARIANTS[status]).toMatch(/^badge-/);
    });
  });
});
