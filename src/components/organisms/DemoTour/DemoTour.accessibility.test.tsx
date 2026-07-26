import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import DemoTour from './DemoTour';
import { enterDemoMode } from '@/lib/demo/demo-session';

expect.extend(toHaveNoViolations);

describe('DemoTour Accessibility', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    enterDemoMode('adopter');
  });

  it('should have no accessibility violations when visible', async () => {
    const { container } = render(
      <DemoTour
        forceDemoMode
        forceRole="adopter"
        forcePathname="/applications"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should expose a labelled region and focusable controls', () => {
    const { container } = render(
      <DemoTour
        forceDemoMode
        forceRole="adopter"
        forcePathname="/applications"
      />
    );
    const region = container.querySelector('[data-testid="demo-tour"]');
    expect(region).toHaveAttribute('aria-labelledby');

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusableElements.length).toBeGreaterThan(0);
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });
});
