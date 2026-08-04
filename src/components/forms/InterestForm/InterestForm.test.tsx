import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterestForm } from './InterestForm';
import * as useWeb3FormsModule from '@/hooks/useWeb3Forms';

vi.mock('@/hooks/useWeb3Forms', () => ({
  useWeb3Forms: vi.fn(),
}));

describe('InterestForm (#129)', () => {
  const mockSubmitForm = vi.fn();
  const mockReset = vi.fn();
  const mockValidateBeforeSubmit = vi.fn();

  const defaultHookReturn: useWeb3FormsModule.UseWeb3FormsReturn = {
    submitForm: mockSubmitForm,
    validateBeforeSubmit: mockValidateBeforeSubmit,
    reset: mockReset,
    isSubmitting: false,
    queueCount: 0,
    isSuccess: false,
    isError: false,
    error: null,
    successMessage: null,
    isOnline: true,
    wasQueuedOffline: false,
    retryQueue: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue(
      defaultHookReturn
    );
  });

  it('renders email, optional name, role, and submit', () => {
    render(<InterestForm />);

    expect(
      screen.getByRole('form', { name: /early interest list signup/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/i am mostly/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /join the list/i })
    ).toBeInTheDocument();
  });

  it('submits a contact payload tagged as early interest', async () => {
    const user = userEvent.setup();
    mockSubmitForm.mockResolvedValue(undefined);
    render(<InterestForm />);

    await user.type(screen.getByLabelText(/^email$/i), 'friend@example.com');
    await user.type(screen.getByLabelText(/name/i), 'Dana');
    await user.selectOptions(screen.getByLabelText(/i am mostly/i), 'shelter');
    await user.click(screen.getByRole('button', { name: /join the list/i }));

    await waitFor(() => {
      expect(mockSubmitForm).toHaveBeenCalledTimes(1);
    });

    const payload = mockSubmitForm.mock.calls[0][0];
    expect(payload.email).toBe('friend@example.com');
    expect(payload.name).toBe('Dana');
    expect(payload.role).toBe('shelter');
    expect(payload.subject).toMatch(/early interest/i);
    expect(payload.message).toMatch(/early interest list/i);
  });

  it('shows success alert when hook reports success', () => {
    vi.mocked(useWeb3FormsModule.useWeb3Forms).mockReturnValue({
      ...defaultHookReturn,
      isSuccess: true,
      successMessage: "You're on the list — thank you.",
    });

    render(<InterestForm />);
    expect(screen.getByRole('alert')).toHaveTextContent(/on the list/i);
  });
});
