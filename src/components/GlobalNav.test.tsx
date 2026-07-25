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

  it('shows Try Demo in menus for guests (not as a header pill)', () => {
    render(<GlobalNav />);

    const demoLinks = screen.getAllByRole('link', {
      name: /^try demo$/i,
      hidden: true,
    });
    expect(demoLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of demoLinks) {
      expect(link).toHaveAttribute('href', DEMO_HREF);
      // Header pill removed — menu entries are not btn chrome
      expect(link.className.includes('btn')).toBe(false);
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

describe('GlobalNav role menus (#65)', () => {
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

  it('exposes Browse Pets, For Adopters, and For Shelters menu triggers', () => {
    render(<GlobalNav />);

    expect(
      screen.getByRole('button', { name: /browse pets/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /for adopters/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /for shelters/i })
    ).toBeInTheDocument();
  });

  it('does not show a Home text link (logo is home)', () => {
    render(<GlobalNav />);

    expect(
      screen.queryByRole('link', { name: /^home$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /raised paws home/i })
    ).toHaveAttribute('href', '/');
  });

  it('shows Browse Pets dropdown with Dogs and Cats; no chrome Browse Pets pill', () => {
    render(<GlobalNav />);

    const browsePetsPills = screen
      .queryAllByRole('link', { name: /^browse pets$/i })
      .filter((el) => el.className.includes('btn'));
    expect(browsePetsPills).toHaveLength(0);

    const browseTrigger = screen.getByRole('button', {
      name: /browse pets/i,
    });
    const browseList = browseTrigger.parentElement?.querySelector('ul');
    expect(browseList).toBeTruthy();
    const browseLabels = [...browseList!.querySelectorAll('a')].map(
      (a) => a.textContent?.trim() || ''
    );
    expect(browseLabels).toEqual(['Dogs', 'Cats']);
    expect(
      [...browseList!.querySelectorAll('a')].some(
        (a) => a.getAttribute('href') === '/dogs'
      )
    ).toBe(true);
    expect(
      [...browseList!.querySelectorAll('a')].some(
        (a) => a.getAttribute('href') === '/cats'
      )
    ).toBe(true);

    const adopterTrigger = screen.getByRole('button', {
      name: /for adopters/i,
    });
    const adopterList = adopterTrigger.parentElement?.querySelector('ul');
    expect(adopterList).toBeTruthy();
    const adopterLabels = [...adopterList!.querySelectorAll('a')].map(
      (a) => a.textContent?.trim() || ''
    );
    expect(adopterLabels).not.toContain('Browse dogs');
    expect(adopterLabels).not.toContain('Browse cats');
    expect(adopterLabels).not.toContain('Dogs');
    expect(adopterLabels).not.toContain('Cats');

    const blogPills = screen
      .getAllByRole('link', { name: /^blog$/i, hidden: true })
      .filter((el) => el.className.includes('btn'));
    expect(blogPills).toHaveLength(0);
  });

  it('adopter menu includes Apply to Adopt and My Applications', () => {
    render(<GlobalNav />);

    const apply = screen.getAllByRole('link', { name: /^apply to adopt$/i });
    expect(apply[0]).toHaveAttribute('href', '/adopt');

    const apps = screen.getAllByRole('link', { name: /^my applications$/i });
    expect(apps[0]).toHaveAttribute('href', '/applications');
  });

  it('shelter menu includes Shelter dashboard, Blog, and omits dog/cat browse', () => {
    render(<GlobalNav />);

    const shelterTrigger = screen.getByRole('button', {
      name: /for shelters/i,
    });
    const list = shelterTrigger.parentElement?.querySelector('ul');
    expect(list).toBeTruthy();

    const labels = [...list!.querySelectorAll('a')].map(
      (a) => a.textContent?.trim() || ''
    );
    expect(labels).toContain('Shelter dashboard');
    expect(labels).toContain('Blog');
    expect(labels).not.toContain('Browse Pets');
    expect(labels).not.toContain('Browse dogs');
    expect(labels).not.toContain('Browse cats');
    expect(labels).not.toContain('Dogs');
    expect(labels).not.toContain('Cats');
    expect(
      [...list!.querySelectorAll('a')].some(
        (a) => a.getAttribute('href') === '/shelter'
      )
    ).toBe(true);
  });

  it('does not put Blog in the Adopters dropdown', () => {
    render(<GlobalNav />);

    const adopterTrigger = screen.getByRole('button', {
      name: /for adopters/i,
    });
    const list = adopterTrigger.parentElement?.querySelector('ul');
    expect(list).toBeTruthy();
    const labels = [...list!.querySelectorAll('a')].map(
      (a) => a.textContent?.trim() || ''
    );
    expect(labels).not.toContain('Blog');
  });

  it('keeps pill chrome on Log In (not on Try Demo or Dogs/Cats browse)', () => {
    render(<GlobalNav />);

    const loginPills = screen
      .getAllByRole('link', { name: /^log in$/i })
      .filter((el) => el.className.includes('btn'));
    expect(loginPills.length).toBeGreaterThanOrEqual(1);
    expect(loginPills[0].className).toMatch(/bg-white/);

    const demoPills = screen
      .getAllByRole('link', { name: /^try demo$/i, hidden: true })
      .filter((el) => el.className.includes('btn'));
    expect(demoPills).toHaveLength(0);

    const dogPills = screen
      .getAllByRole('link', { name: /^dogs$/i, hidden: true })
      .filter(
        (el) =>
          el.className.includes('btn') && el.className.includes('bg-white')
      );
    expect(dogPills).toHaveLength(0);
  });

  it('does not offer Create Account in role menus (sign-in page covers signup)', () => {
    render(<GlobalNav />);

    expect(
      screen.queryByRole('link', { name: /^create account$/i })
    ).not.toBeInTheDocument();
  });
});
