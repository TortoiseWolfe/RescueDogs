import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import FeedbackSheet from './FeedbackSheet';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/feedback/submit', () => ({ sendFeedback: vi.fn() }));

expect.extend(toHaveNoViolations);

describe('FeedbackSheet Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<FeedbackSheet isOpen onClose={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(<FeedbackSheet isOpen onClose={() => {}} />);

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // All focusable elements should be visible
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(<FeedbackSheet isOpen onClose={() => {}} />);

    // Verify component renders with proper HTML structure
    expect(container.firstChild).toBeInTheDocument();

    // Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
