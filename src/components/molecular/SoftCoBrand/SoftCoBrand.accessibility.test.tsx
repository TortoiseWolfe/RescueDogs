import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import SoftCoBrand from './SoftCoBrand';

expect.extend(toHaveNoViolations);

describe('SoftCoBrand Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <SoftCoBrand shelterName="Second Chance Rescue" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('exposes shelter name and powered-by as visible text', () => {
    const { container } = render(
      <SoftCoBrand shelterName="Second Chance Rescue" context="status" />
    );
    const root = container.querySelector('[data-testid="soft-co-brand"]');
    expect(root).toHaveTextContent('Second Chance Rescue');
    expect(root).toHaveTextContent('Powered by Raised Paws');
    expect(root).not.toHaveAttribute('aria-hidden');
  });
});
