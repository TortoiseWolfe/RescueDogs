import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackSheet from './FeedbackSheet';

const sendFeedback = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => '/apply' }));
vi.mock('@/lib/feedback/submit', () => ({
  sendFeedback: (...a: unknown[]) => sendFeedback(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  sendFeedback.mockResolvedValue({ ok: true });
  // jsdom does not implement <dialog>.
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

const open = () => render(<FeedbackSheet isOpen onClose={() => {}} />);

describe('FeedbackSheet', () => {
  it('asks for one thing', () => {
    open();
    expect(screen.getByTestId('feedback-body')).toBeInTheDocument();
    // No category picker, no severity, no email field. Somebody who has just hit a bug is
    // not in the mood to triage it, and a required category is how a report is abandoned.
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/categor/i)).not.toBeInTheDocument();
  });

  /**
   * SHOWN, NOT HARVESTED. A report that quietly collects is a different product from one
   * that says what it collects. This walks the rendered sentence rather than spot-checking,
   * so a field added to `factsFrom` that never reaches the sheet is caught here.
   */
  it('says what else it is sending, including the route', () => {
    open();
    const facts = screen.getByTestId('feedback-facts');
    expect(facts).toHaveTextContent('web');
    expect(facts).toHaveTextContent('/apply');
    expect(facts).toHaveTextContent(/no name, no email/i);
  });

  /**
   * NO SEND BUTTON OVER AN EMPTY BOX, rather than a disabled one. A control that is visibly
   * there and does nothing when tapped reads as a bug — a poor first impression on the
   * screen somebody reached in order to report one.
   */
  it('draws no Send until there is something to send, and never a disabled one', async () => {
    open();
    expect(screen.queryByTestId('feedback-send')).not.toBeInTheDocument();
    expect(screen.getByTestId('feedback-empty')).toBeInTheDocument();

    await userEvent.type(
      screen.getByTestId('feedback-body'),
      'The back button lost my form.'
    );
    expect(screen.getByTestId('feedback-send')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-send')).not.toBeDisabled();
  });

  it('sends the words and the route it was written on', async () => {
    open();
    await userEvent.type(
      screen.getByTestId('feedback-body'),
      'Photos never appear.'
    );
    await userEvent.click(screen.getByTestId('feedback-send'));
    expect(sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Photos never appear.', route: '/apply' })
    );
  });

  /**
   * A REFUSAL MUST NOT DESTROY WHAT SOMEBODY TYPED. The rate limit is the common case here,
   * and re-typing a paragraph because the app said "not yet" is how a second report never
   * gets written.
   */
  it('keeps the words and explains a refusal, rather than closing', async () => {
    sendFeedback.mockResolvedValue({
      ok: false,
      reason: 'too_often',
      message:
        'That is a few reports in a short time. Try again in a little while.',
    });
    open();
    await userEvent.type(
      screen.getByTestId('feedback-body'),
      'Seventh in an hour.'
    );
    await userEvent.click(screen.getByTestId('feedback-send'));

    expect(screen.getByTestId('feedback-problem')).toHaveTextContent(
      /short time/i
    );
    expect(screen.getByTestId('feedback-body')).toHaveValue(
      'Seventh in an hour.'
    );
  });

  /**
   * THE PICKER IS THE PRIVACY DESIGN: the library, never the camera and never a view
   * capture. In this product a silent capture could send another person's application.
   * A browser has no crop step, so the copy says to crop first rather than implying one.
   */
  it('offers a picture from the library, and says to crop it first', () => {
    open();
    const input = screen.getByTestId('feedback-attach');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).not.toHaveAttribute('capture');
    expect(
      screen.getByText(/crop anything you do not want us to see/i)
    ).toBeInTheDocument();
  });
});
