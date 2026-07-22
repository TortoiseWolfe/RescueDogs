import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConnectionManager from './ConnectionManager';
import { useAuth } from '@/contexts/AuthContext';
import { useConnections } from '@/hooks/useConnections';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useConnections');

const mockConnections = {
  pending_sent: [
    {
      connection: {
        id: '1',
        requester_id: 'user1',
        addressee_id: 'user2',
        status: 'pending' as const,
        created_at: '',
        updated_at: '',
      },
      requester: {
        id: 'user1',
        username: 'requester',
        display_name: 'Requester',
        avatar_url: null,
      },
      addressee: {
        id: 'user2',
        username: 'addressee',
        display_name: 'Addressee',
        avatar_url: null,
      },
    },
  ],
  pending_received: [],
  accepted: [],
  blocked: [],
};

describe('ConnectionManager', () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: signed in as the requester in pending_sent fixtures
    mockUseAuth.mockReturnValue({
      user: { id: 'user1', email: 'user1@example.com' },
    });
  });

  it('renders tabs', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: false,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    expect(
      screen.getByRole('tab', { name: /pending received/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /pending sent/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /accepted/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /blocked/i })).toBeInTheDocument();
  });

  it('displays loading state', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: true,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('displays error message', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: false,
      error: 'Test error',
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('switches tabs on click', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: false,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    const sentTab = screen.getByRole('tab', { name: /pending sent/i });
    fireEvent.click(sentTab);
    expect(sentTab.classList.contains('tab-active')).toBe(true);
  });

  it('displays sent connections', () => {
    vi.mocked(useConnections).mockReturnValue({
      connections: mockConnections,
      loading: false,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    fireEvent.click(screen.getByRole('tab', { name: /pending sent/i }));
    expect(screen.getByText('Addressee')).toBeInTheDocument();
  });

  it('calls acceptRequest when accept button clicked', async () => {
    // Current user is the addressee for a received request
    mockUseAuth.mockReturnValue({
      user: { id: 'user2', email: 'user2@example.com' },
    });
    const acceptRequest = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConnections).mockReturnValue({
      connections: {
        ...mockConnections,
        pending_received: mockConnections.pending_sent,
      },
      loading: false,
      error: null,
      acceptRequest,
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    expect(screen.getByText('Requester')).toBeInTheDocument();
    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(acceptRequest).toHaveBeenCalledWith('1');
    });
  });

  it('shows block confirmation modal', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user2', email: 'user2@example.com' },
    });
    vi.mocked(useConnections).mockReturnValue({
      connections: {
        ...mockConnections,
        pending_received: mockConnections.pending_sent,
      },
      loading: false,
      error: null,
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      blockUser: vi.fn(),
      removeConnection: vi.fn(),
      refreshConnections: vi.fn(),
    });

    render(<ConnectionManager />);
    fireEvent.click(screen.getByRole('button', { name: /block/i }));
    expect(
      screen.getByText(/are you sure you want to block/i)
    ).toBeInTheDocument();
  });

  describe('Message button (Feature 037)', () => {
    const acceptedAsRequester = {
      connection: {
        id: 'conn-1',
        requester_id: 'current-user',
        addressee_id: 'other-user',
        status: 'accepted' as const,
        created_at: '',
        updated_at: '',
      },
      requester: {
        id: 'current-user',
        username: 'me',
        display_name: 'Me',
        avatar_url: null,
      },
      addressee: {
        id: 'other-user',
        username: 'friend',
        display_name: 'My Friend',
        avatar_url: null,
      },
    };

    /** Current user accepted someone else's request (#70 regression case). */
    const acceptedAsAddressee = {
      connection: {
        id: 'conn-2',
        requester_id: 'other-user',
        addressee_id: 'current-user',
        status: 'accepted' as const,
        created_at: '',
        updated_at: '',
      },
      requester: {
        id: 'other-user',
        username: 'friend',
        display_name: 'My Friend',
        avatar_url: null,
      },
      addressee: {
        id: 'current-user',
        username: 'me',
        display_name: 'Me',
        avatar_url: null,
      },
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'current-user', email: 'me@example.com' },
      });
    });

    it('renders Message button for accepted connections when onMessage prop provided', () => {
      vi.mocked(useConnections).mockReturnValue({
        connections: {
          ...mockConnections,
          accepted: [acceptedAsRequester],
        },
        loading: false,
        error: null,
        acceptRequest: vi.fn(),
        declineRequest: vi.fn(),
        blockUser: vi.fn(),
        removeConnection: vi.fn(),
        refreshConnections: vi.fn(),
      });

      const onMessage = vi.fn();
      render(<ConnectionManager onMessage={onMessage} />);

      // Switch to accepted tab
      fireEvent.click(screen.getByRole('tab', { name: /accepted/i }));

      expect(screen.getByTestId('message-button')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /message/i })
      ).toBeInTheDocument();
    });

    it('does not render Message button when onMessage prop is undefined', () => {
      vi.mocked(useConnections).mockReturnValue({
        connections: {
          ...mockConnections,
          accepted: [acceptedAsRequester],
        },
        loading: false,
        error: null,
        acceptRequest: vi.fn(),
        declineRequest: vi.fn(),
        blockUser: vi.fn(),
        removeConnection: vi.fn(),
        refreshConnections: vi.fn(),
      });

      render(<ConnectionManager />);

      // Switch to accepted tab
      fireEvent.click(screen.getByRole('tab', { name: /accepted/i }));

      expect(screen.queryByTestId('message-button')).not.toBeInTheDocument();
    });

    it('calls onMessage with correct userId when Message button clicked', async () => {
      vi.mocked(useConnections).mockReturnValue({
        connections: {
          ...mockConnections,
          accepted: [acceptedAsRequester],
        },
        loading: false,
        error: null,
        acceptRequest: vi.fn(),
        declineRequest: vi.fn(),
        blockUser: vi.fn(),
        removeConnection: vi.fn(),
        refreshConnections: vi.fn(),
      });

      const onMessage = vi.fn();
      render(<ConnectionManager onMessage={onMessage} />);

      // Switch to accepted tab
      fireEvent.click(screen.getByRole('tab', { name: /accepted/i }));

      // Click Message button
      fireEvent.click(screen.getByTestId('message-button'));

      // Should call onMessage with the other user's ID (addressee since requester is current user)
      expect(onMessage).toHaveBeenCalledWith('other-user');
    });

    it('shows peer (not self) when current user is the addressee (#70)', () => {
      vi.mocked(useConnections).mockReturnValue({
        connections: {
          ...mockConnections,
          accepted: [acceptedAsAddressee],
        },
        loading: false,
        error: null,
        acceptRequest: vi.fn(),
        declineRequest: vi.fn(),
        blockUser: vi.fn(),
        removeConnection: vi.fn(),
        refreshConnections: vi.fn(),
      });

      const onMessage = vi.fn();
      render(<ConnectionManager onMessage={onMessage} />);

      fireEvent.click(screen.getByRole('tab', { name: /accepted/i }));

      expect(screen.getByText('My Friend')).toBeInTheDocument();
      expect(screen.queryByText('Me')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('message-button'));
      expect(onMessage).toHaveBeenCalledWith('other-user');
    });
  });
});
