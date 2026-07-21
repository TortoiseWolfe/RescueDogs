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

describe('GlobalNav Accessibility (#67)', () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      signOut: vi.fn(),
      isLoading: false,
      isAuthenticated: false,
    });
  });

  it('Demo links are named and meet 44px touch-target classes', () => {
    render(<GlobalNav />);

    const demoLinks = screen.getAllByRole('link', { name: /try the demo/i });
    expect(demoLinks.length).toBeGreaterThanOrEqual(2);

    for (const link of demoLinks) {
      expect(link).toHaveAccessibleName(/try the demo/i);
      // Desktop chrome uses min-h-11; mobile menu items inherit menu touch sizing.
      if (link.className.includes('btn')) {
        expect(link.className).toMatch(/min-h-11/);
      }
    }
  });
});
