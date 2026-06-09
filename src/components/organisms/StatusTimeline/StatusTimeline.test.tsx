import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  STATUS_LABELS,
  STATUS_ORDER,
  type ApplicationStatus,
  type StatusHistoryEntry,
} from '@/types/applications';
import StatusTimeline from './StatusTimeline';

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

describe('StatusTimeline', () => {
  describe('pipeline steps', () => {
    it('renders all five pipeline stage labels', () => {
      render(<StatusTimeline currentStatus="submitted" history={[]} />);
      const steps = screen.getByRole('list', {
        name: 'Application progress',
      });
      STATUS_ORDER.forEach((status) => {
        expect(
          within(steps).getByText(STATUS_LABELS[status])
        ).toBeInTheDocument();
      });
    });

    it.each(
      STATUS_ORDER.filter((s) => s !== 'approved').map(
        (status) => [status, STATUS_ORDER.indexOf(status)] as const
      )
    )(
      'marks steps up to and including %s as step-primary',
      (status, currentIdx) => {
        render(<StatusTimeline currentStatus={status} history={[]} />);
        STATUS_ORDER.forEach((stage, idx) => {
          const step = screen.getByTestId(`step-${stage}`);
          expect(step).toHaveClass('step');
          if (idx <= currentIdx) {
            expect(step).toHaveClass('step-primary');
          } else {
            expect(step).not.toHaveClass('step-primary');
            expect(step).not.toHaveClass('step-success');
          }
        });
      }
    );

    it.each(STATUS_ORDER.map((s) => [s] as const))(
      'sets aria-current="step" on the %s step when it is current',
      (status) => {
        render(<StatusTimeline currentStatus={status} history={[]} />);
        const current = screen.getByTestId(`step-${status}`);
        expect(current).toHaveAttribute('aria-current', 'step');
        STATUS_ORDER.filter((s) => s !== status).forEach((other) => {
          expect(screen.getByTestId(`step-${other}`)).not.toHaveAttribute(
            'aria-current'
          );
        });
      }
    );

    it('uses step-success (not step-primary) on the final step when approved', () => {
      render(<StatusTimeline currentStatus="approved" history={[]} />);
      const finalStep = screen.getByTestId('step-approved');
      expect(finalStep).toHaveClass('step-success');
      expect(finalStep).not.toHaveClass('step-primary');
      expect(finalStep).toHaveAttribute('aria-current', 'step');
      // Earlier stages all completed
      STATUS_ORDER.slice(0, -1).forEach((stage) => {
        expect(screen.getByTestId(`step-${stage}`)).toHaveClass('step-primary');
      });
    });
  });

  describe('terminal branches', () => {
    it('replaces the Approved step with a step-error "Not Selected" step', () => {
      const history = [
        entry('submitted'),
        entry('under_review', { from_status: 'submitted' }),
        entry('home_visit', { from_status: 'under_review' }),
        entry('not_selected', { from_status: 'home_visit' }),
      ];
      render(<StatusTimeline currentStatus="not_selected" history={history} />);

      const steps = screen.getByRole('list', { name: 'Application progress' });
      expect(within(steps).queryByText('Approved')).not.toBeInTheDocument();

      const terminal = screen.getByTestId('step-not_selected');
      expect(terminal).toHaveTextContent('Not Selected');
      expect(terminal).toHaveClass('step-error');
      expect(terminal).toHaveAttribute('aria-current', 'step');

      // Stays primary up to where the application got (home_visit)
      (
        ['submitted', 'under_review', 'reference_check', 'home_visit'] as const
      ).forEach((stage) => {
        expect(screen.getByTestId(`step-${stage}`)).toHaveClass('step-primary');
      });
    });

    it('replaces the Approved step with a step-neutral "Withdrawn" step', () => {
      const history = [
        entry('submitted'),
        entry('under_review', { from_status: 'submitted' }),
        entry('withdrawn', { from_status: 'under_review' }),
      ];
      render(<StatusTimeline currentStatus="withdrawn" history={history} />);

      const steps = screen.getByRole('list', { name: 'Application progress' });
      expect(within(steps).queryByText('Approved')).not.toBeInTheDocument();

      const terminal = screen.getByTestId('step-withdrawn');
      expect(terminal).toHaveTextContent('Withdrawn');
      expect(terminal).toHaveClass('step-neutral');
      expect(terminal).toHaveAttribute('aria-current', 'step');

      // Reached under_review, no further
      expect(screen.getByTestId('step-submitted')).toHaveClass('step-primary');
      expect(screen.getByTestId('step-under_review')).toHaveClass(
        'step-primary'
      );
      expect(screen.getByTestId('step-reference_check')).not.toHaveClass(
        'step-primary'
      );
      expect(screen.getByTestId('step-home_visit')).not.toHaveClass(
        'step-primary'
      );
    });
  });

  describe('history list', () => {
    it('renders an entry per history item, oldest first', () => {
      const history = [
        entry('under_review', {
          from_status: 'submitted',
          created_at: '2026-05-03T12:00:00Z',
        }),
        entry('submitted', { created_at: '2026-05-01T12:00:00Z' }),
      ];
      render(<StatusTimeline currentStatus="under_review" history={history} />);

      const entries = screen.getAllByTestId('history-entry');
      expect(entries).toHaveLength(2);
      expect(entries[0]).toHaveTextContent(STATUS_LABELS.submitted);
      expect(entries[1]).toHaveTextContent(STATUS_LABELS.under_review);
    });

    it('renders shelter notes when present', () => {
      const history = [
        entry('submitted'),
        entry('home_visit', {
          from_status: 'under_review',
          note: 'Home visit scheduled for Saturday',
        }),
      ];
      render(<StatusTimeline currentStatus="home_visit" history={history} />);

      const notes = screen.getAllByTestId('history-note');
      expect(notes).toHaveLength(1);
      expect(notes[0]).toHaveTextContent('Home visit scheduled for Saturday');
    });

    it('omits the note bubble for entries without a note', () => {
      render(
        <StatusTimeline
          currentStatus="submitted"
          history={[entry('submitted')]}
        />
      );
      expect(screen.queryByTestId('history-note')).not.toBeInTheDocument();
    });

    it('renders without crashing when history is empty', () => {
      render(<StatusTimeline currentStatus="submitted" history={[]} />);
      expect(screen.getByTestId('status-timeline')).toBeInTheDocument();
      expect(screen.getByTestId('history-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('history-entry')).not.toBeInTheDocument();
    });
  });

  it('applies custom className when provided', () => {
    render(
      <StatusTimeline
        currentStatus="submitted"
        history={[]}
        className="custom-test-class"
      />
    );
    expect(screen.getByTestId('status-timeline')).toHaveClass(
      'custom-test-class'
    );
  });
});
