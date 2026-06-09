import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import type {
  ApplicationStatus,
  StatusHistoryEntry,
} from '@/types/applications';
import StatusTimeline from './StatusTimeline';

expect.extend(toHaveNoViolations);

let seq = 0;

function entry(
  to_status: ApplicationStatus,
  overrides: Partial<StatusHistoryEntry> = {}
): StatusHistoryEntry {
  seq += 1;
  return {
    id: `history-${seq}`,
    application_id: 'app-1',
    from_status: null,
    to_status,
    changed_by: null,
    note: null,
    created_at: `2026-05-0${Math.min(seq, 9)}T12:00:00Z`,
    ...overrides,
  };
}

const MID_PIPELINE_HISTORY: StatusHistoryEntry[] = [
  entry('submitted'),
  entry('under_review', {
    from_status: 'submitted',
    note: 'We are reviewing your application this week.',
  }),
  entry('home_visit', {
    from_status: 'under_review',
    note: 'Home visit scheduled for Saturday',
  }),
];

describe('StatusTimeline Accessibility', () => {
  it('should have no accessibility violations mid-pipeline with notes', async () => {
    const { container } = render(
      <StatusTimeline
        currentStatus="home_visit"
        history={MID_PIPELINE_HISTORY}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with empty history', async () => {
    const { container } = render(
      <StatusTimeline currentStatus="submitted" history={[]} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations for terminal branches', async () => {
    const { container } = render(
      <div>
        <StatusTimeline
          currentStatus="not_selected"
          history={[
            entry('submitted'),
            entry('not_selected', {
              from_status: 'submitted',
              note: 'Another applicant was a better fit this time.',
            }),
          ]}
        />
        <StatusTimeline
          currentStatus="withdrawn"
          history={[
            entry('submitted'),
            entry('withdrawn', { from_status: 'submitted' }),
          ]}
        />
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('labels the steps list for assistive technology', () => {
    render(<StatusTimeline currentStatus="under_review" history={[]} />);
    expect(
      screen.getByRole('list', { name: 'Application progress' })
    ).toBeInTheDocument();
  });

  it('marks the current step with aria-current="step"', () => {
    render(<StatusTimeline currentStatus="reference_check" history={[]} />);
    const current = screen.getByTestId('step-reference_check');
    expect(current).toHaveAttribute('aria-current', 'step');
  });

  it('exposes step progress as non-interactive content (no focusable steps)', () => {
    const { container } = render(
      <StatusTimeline
        currentStatus="home_visit"
        history={MID_PIPELINE_HISTORY}
      />
    );
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusableElements).toHaveLength(0);
  });

  it('renders history dates inside <time> elements with machine-readable datetime', () => {
    const { container } = render(
      <StatusTimeline
        currentStatus="home_visit"
        history={MID_PIPELINE_HISTORY}
      />
    );
    const times = container.querySelectorAll('time[datetime]');
    expect(times.length).toBe(MID_PIPELINE_HISTORY.length);
  });
});
