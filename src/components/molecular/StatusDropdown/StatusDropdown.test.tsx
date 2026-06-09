import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import StatusDropdown from './StatusDropdown';

describe('StatusDropdown', () => {
  describe('legal options', () => {
    it('renders only the legal transitions for submitted', () => {
      render(<StatusDropdown currentStatus="submitted" onAdvance={vi.fn()} />);

      const select = screen.getByLabelText(/new status/i);
      const options = within(select).getAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual([
        'Select new status…',
        'Under Review',
        'Not Selected',
      ]);
    });

    it('renders only the legal transitions for under_review', () => {
      render(
        <StatusDropdown currentStatus="under_review" onAdvance={vi.fn()} />
      );

      const select = screen.getByLabelText(/new status/i);
      const options = within(select).getAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual([
        'Select new status…',
        'Reference Check',
        'Home Visit',
        'Approved',
        'Not Selected',
      ]);
    });

    it('renders only the legal transitions for reference_check', () => {
      render(
        <StatusDropdown currentStatus="reference_check" onAdvance={vi.fn()} />
      );

      const select = screen.getByLabelText(/new status/i);
      const options = within(select).getAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual([
        'Select new status…',
        'Home Visit',
        'Approved',
        'Not Selected',
      ]);
    });

    it('renders only the legal transitions for home_visit', () => {
      render(<StatusDropdown currentStatus="home_visit" onAdvance={vi.fn()} />);

      const select = screen.getByLabelText(/new status/i);
      const options = within(select).getAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual([
        'Select new status…',
        'Approved',
        'Not Selected',
      ]);
    });

    it('never offers withdrawn (adopter-only) as a target', () => {
      render(
        <StatusDropdown currentStatus="under_review" onAdvance={vi.fn()} />
      );

      expect(
        screen.queryByRole('option', { name: 'Withdrawn' })
      ).not.toBeInTheDocument();
    });
  });

  describe('terminal current status', () => {
    it.each(['approved', 'not_selected', 'withdrawn'] as const)(
      'renders "No further actions" instead of a select for %s',
      (status) => {
        render(<StatusDropdown currentStatus={status} onAdvance={vi.fn()} />);

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /update status/i })
        ).not.toBeInTheDocument();
        expect(screen.getByText(/no further actions/i)).toBeInTheDocument();
      }
    );
  });

  describe('non-terminal advance', () => {
    it('calls onAdvance with the chosen status and note', async () => {
      const onAdvance = vi.fn();
      render(
        <StatusDropdown currentStatus="submitted" onAdvance={onAdvance} />
      );

      await userEvent.selectOptions(
        screen.getByLabelText(/new status/i),
        'under_review'
      );
      await userEvent.type(
        screen.getByLabelText(/note to applicant/i),
        'We are reviewing your application'
      );
      await userEvent.click(
        screen.getByRole('button', { name: /update status/i })
      );

      expect(onAdvance).toHaveBeenCalledTimes(1);
      expect(onAdvance).toHaveBeenCalledWith(
        'under_review',
        'We are reviewing your application'
      );
      // No confirm step for non-terminal targets
      expect(screen.queryByText(/this is final/i)).not.toBeInTheDocument();
    });

    it('passes undefined when no note is entered', async () => {
      const onAdvance = vi.fn();
      render(
        <StatusDropdown currentStatus="submitted" onAdvance={onAdvance} />
      );

      await userEvent.selectOptions(
        screen.getByLabelText(/new status/i),
        'under_review'
      );
      await userEvent.click(
        screen.getByRole('button', { name: /update status/i })
      );

      expect(onAdvance).toHaveBeenCalledWith('under_review', undefined);
    });

    it('resets the select and note after advancing', async () => {
      const onAdvance = vi.fn();
      render(
        <StatusDropdown currentStatus="submitted" onAdvance={onAdvance} />
      );

      await userEvent.selectOptions(
        screen.getByLabelText(/new status/i),
        'under_review'
      );
      await userEvent.type(
        screen.getByLabelText(/note to applicant/i),
        'Reviewing now'
      );
      await userEvent.click(
        screen.getByRole('button', { name: /update status/i })
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/new status/i)).toHaveValue('');
      });
      expect(screen.getByLabelText(/note to applicant/i)).toHaveValue('');
    });
  });

  describe('terminal target confirmation', () => {
    it.each(['approved', 'not_selected'] as const)(
      'requires confirmation before advancing to %s',
      async (target) => {
        const onAdvance = vi.fn();
        render(
          <StatusDropdown currentStatus="home_visit" onAdvance={onAdvance} />
        );

        await userEvent.selectOptions(
          screen.getByLabelText(/new status/i),
          target
        );
        await userEvent.click(
          screen.getByRole('button', { name: /update status/i })
        );

        // Not yet advanced — confirm step shown instead
        expect(onAdvance).not.toHaveBeenCalled();
        expect(
          screen.getByText(
            'This is final and immediately visible to the applicant.'
          )
        ).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

        expect(onAdvance).toHaveBeenCalledTimes(1);
        expect(onAdvance).toHaveBeenCalledWith(target, undefined);
      }
    );

    it('includes the note when confirming a terminal target', async () => {
      const onAdvance = vi.fn();
      render(
        <StatusDropdown currentStatus="home_visit" onAdvance={onAdvance} />
      );

      await userEvent.selectOptions(
        screen.getByLabelText(/new status/i),
        'approved'
      );
      await userEvent.type(
        screen.getByLabelText(/note to applicant/i),
        'Congratulations!'
      );
      await userEvent.click(
        screen.getByRole('button', { name: /update status/i })
      );
      await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

      expect(onAdvance).toHaveBeenCalledWith('approved', 'Congratulations!');
    });

    it('does not call onAdvance when the confirmation is cancelled', async () => {
      const onAdvance = vi.fn();
      render(
        <StatusDropdown currentStatus="home_visit" onAdvance={onAdvance} />
      );

      await userEvent.selectOptions(
        screen.getByLabelText(/new status/i),
        'not_selected'
      );
      await userEvent.click(
        screen.getByRole('button', { name: /update status/i })
      );
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onAdvance).not.toHaveBeenCalled();
      // Confirm step dismissed, selection preserved for a second look
      expect(screen.queryByText(/this is final/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/new status/i)).toHaveValue('not_selected');
    });

    it('dismisses the confirm step when the target is changed', async () => {
      const onAdvance = vi.fn();
      render(
        <StatusDropdown currentStatus="under_review" onAdvance={onAdvance} />
      );

      await userEvent.selectOptions(
        screen.getByLabelText(/new status/i),
        'approved'
      );
      await userEvent.click(
        screen.getByRole('button', { name: /update status/i })
      );
      expect(screen.getByText(/this is final/i)).toBeInTheDocument();

      await userEvent.selectOptions(
        screen.getByLabelText(/new status/i),
        'home_visit'
      );

      expect(screen.queryByText(/this is final/i)).not.toBeInTheDocument();
      expect(onAdvance).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('disables every control when disabled is set', () => {
      render(
        <StatusDropdown
          currentStatus="under_review"
          onAdvance={vi.fn()}
          disabled
        />
      );

      expect(screen.getByLabelText(/new status/i)).toBeDisabled();
      expect(screen.getByLabelText(/note to applicant/i)).toBeDisabled();
      expect(
        screen.getByRole('button', { name: /update status/i })
      ).toBeDisabled();
    });

    it('keeps the update button disabled until a target is chosen', async () => {
      render(
        <StatusDropdown currentStatus="under_review" onAdvance={vi.fn()} />
      );

      const button = screen.getByRole('button', { name: /update status/i });
      expect(button).toBeDisabled();

      await userEvent.selectOptions(
        screen.getByLabelText(/new status/i),
        'reference_check'
      );

      expect(button).not.toBeDisabled();
    });
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <StatusDropdown
        currentStatus="submitted"
        onAdvance={vi.fn()}
        className="custom-test-class"
      />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});
