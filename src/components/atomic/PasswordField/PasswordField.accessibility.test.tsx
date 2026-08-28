import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PasswordField } from './PasswordField';

expect.extend(toHaveNoViolations);

describe('PasswordField Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <label>
        Password
        <PasswordField id="password-field-a11y" />
      </label>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
