import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAuth } from '@/contexts/AuthContext';
import { GlobalNav } from './GlobalNav';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ profile: null }),
}));

vi.mock('@/hooks/useUnreadCount', () => ({
  useUnreadCount: () => 0,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/services/admin/admin-auth-service', () => ({
  AdminAuthService: class {
    checkIsAdmin = vi.fn().mockResolvedValue(false);
  },
}));

vi.mock('@/services/applications', () => ({
  ShelterApplicationService: class {
    getMyShelterMembership = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock('@/components/atomic/AnimatedLogo', () => ({
  AnimatedLogo: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('@/components/atomic/AvatarDisplay', () => ({
  default: () => <span data-testid="avatar" />,
}));

const DEMO_HREF = '/get-started?demo=1&choose=1';

describe('GlobalNav demo visibility (#67)', () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      signOut: vi.fn(),
      isLoading: false,
      isAuthenticated: false,
    });
  });

  it('shows Try Demo links to the chooser for guests', () => {
    render(<GlobalNav />);

    const demoLinks = screen.getAllByRole('link', { name: /^try demo$/i });
    expect(demoLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of demoLinks) {
      expect(link).toHaveAttribute('href', DEMO_HREF);
    }
  });

  it('does not show Try Demo when signed in', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        user_metadata: {},
      },
      signOut: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
    });

    render(<GlobalNav />);

    expect(
      screen.queryByRole('link', { name: /^try demo$/i })
    ).not.toBeInTheDocument();
  });
});
