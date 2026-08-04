import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { InterestForm } from './InterestForm';
import * as useWeb3FormsModule from '@/hooks/useWeb3Forms';

expect.extend(toHaveNoViolations);

vi.mock('@/hooks/useWeb3Forms', () => ({
  useWeb3Forms: vi.fn(),
}));

describe('InterestForm Accessibility (#129)', () => {
  beforeEach(() => {
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
      submitForm: vi.fn(),
      validateBeforeSubmit: vi.fn(),
      reset: vi.fn(),
      isSubmitting: false,
      queueCount: 0,
      isSuccess: false,
      isError: false,
      error: null,
      successMessage: null,
      isOnline: true,
      wasQueuedOffline: false,
      retryQueue: vi.fn(),
    });
  });

  it('has no axe violations', async () => {
    const { container } = render(<InterestForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
