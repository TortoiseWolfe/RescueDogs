import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmailVerificationNotice from './EmailVerificationNotice';

describe('EmailVerificationNotice', () => {
  it('renders without crashing', () => {
    render(<EmailVerificationNotice />);
    expect(
      screen.getByText(/please verify your email address/i)
    ).toBeInTheDocument();
  });

  it('stacks the notice so the security check fits on a phone', () => {
    render(<EmailVerificationNotice />);
    const alert = screen
      .getByText(/please verify your email address/i)
      .closest('.alert');
    expect(alert).toHaveClass('alert-vertical');
  });
});
