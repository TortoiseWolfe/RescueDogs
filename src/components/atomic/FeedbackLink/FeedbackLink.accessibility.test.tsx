import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import FeedbackLink from './FeedbackLink';

expect.extend(toHaveNoViolations);

describe('FeedbackLink Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<FeedbackLink />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  /**
   * SCOPED TO THE DIALOG'S OUTSIDE, and the generated version of this test was not.
   *
   * This component renders a CLOSED `<dialog>`, whose contents are correctly not visible --
   * that is what "closed" means, and it is the state the control exists to change. The
   * scaffold walks every focusable node in the container and asserts each is visible, which
   * a dialog can never satisfy while shut. Asserting it anyway would either fail forever or
   * be "fixed" by deleting the dialog from the test, which is worse.
   *
   * What is worth asserting is that everything OUTSIDE the dialog -- the one control a
   * person can actually reach -- is reachable.
   */
  it('should have focusable elements in proper tab order', () => {
    const { container } = render(<FeedbackLink />);

    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const outside = Array.from(container.querySelectorAll(selector)).filter(
      (el) => !el.closest('dialog')
    );

    expect(outside.length).toBeGreaterThan(0);
    outside.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(<FeedbackLink />);

    // Verify component renders with proper HTML structure
    expect(container.firstChild).toBeInTheDocument();

    // Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
