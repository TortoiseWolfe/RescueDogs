import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('renders a password input by default', () => {
    render(<PasswordField aria-label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('toggles visibility when the eye button is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordField aria-label="Password" />);
    const input = screen.getByLabelText('Password');
    const toggle = screen.getByRole('button', { name: /show password/i });

    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: /hide password/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('disables the toggle when the input is disabled', () => {
    render(<PasswordField aria-label="Password" disabled />);
    expect(
      screen.getByRole('button', { name: /show password/i })
    ).toBeDisabled();
  });
});
