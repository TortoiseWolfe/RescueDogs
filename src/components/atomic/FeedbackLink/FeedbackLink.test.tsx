import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackLink from './FeedbackLink';

vi.mock('next/navigation', () => ({ usePathname: () => '/apply' }));
vi.mock('@/lib/feedback/submit', () => ({ sendFeedback: vi.fn() }));

describe('FeedbackLink', () => {
  it('offers a way to say the software is wrong', () => {
    render(<FeedbackLink />);
    expect(screen.getByTestId('open-feedback')).toBeInTheDocument();
  });

  /**
   * The sheet is not on the page until it is asked for. `<dialog>` renders nothing before
   * `showModal()`, but its CONTENT is in the tree — so this asserts the control is what
   * puts the form in front of somebody, rather than the form being permanently present.
   */
  it('opens the sheet, and only on a click', async () => {
    render(<FeedbackLink />);
    expect(screen.queryByTestId('feedback-body')).not.toBeVisible();
    await userEvent.click(screen.getByTestId('open-feedback'));
    expect(screen.getByTestId('feedback-body')).toBeInTheDocument();
  });

  /**
   * WCAG AAA (7:1) is the gate in this repo, and this control renders on `/`, which
   * `tests/e2e/color-contrast.spec.ts` runs axe's `color-contrast-enhanced` against. A muted
   * `/70` variant would pass a casual read and fail that job.
   */
  it('uses full-opacity base-content, which the AAA contrast gate requires', () => {
    render(<FeedbackLink />);
    const el = screen.getByTestId('open-feedback');
    expect(el.className).toContain('text-base-content');
    expect(el.className).not.toMatch(/text-base-content\/\d/);
  });

  it('carries the 44px touch target this repo asks of every control', () => {
    render(<FeedbackLink />);
    expect(screen.getByTestId('open-feedback').className).toContain('min-h-11');
  });

  it('takes an extra class without losing its own', () => {
    render(<FeedbackLink className="mt-4" />);
    const el = screen.getByTestId('open-feedback');
    expect(el.className).toContain('mt-4');
    expect(el.className).toContain('min-h-11');
  });
});
