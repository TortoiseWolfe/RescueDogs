import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyApplicationsPage from '@/app/applications/page';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/auth/ProtectedRoute/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {},
}));

vi.mock('@/services/applications', () => ({
  ApplicationService: class {
    getMyApplications = vi.fn().mockResolvedValue([]);
  },
}));

describe('My Applications empty state (#66)', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'new@example.com' },
      isLoading: false,
    } as ReturnType<typeof useAuth>);
  });

  it('shows welcome copy and browse/start CTAs when there are no applications', async () => {
    render(<MyApplicationsPage />);

    expect(
      await screen.findByRole('heading', {
        name: /welcome — let's get you started/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse dogs/i })).toHaveAttribute(
      'href',
      '/dogs'
    );
    expect(screen.getByRole('link', { name: /browse cats/i })).toHaveAttribute(
      'href',
      '/cats'
    );
    expect(
      screen.getByRole('link', { name: /start an application/i })
    ).toHaveAttribute('href', '/adopt');
    expect(screen.getByRole('link', { name: /display name/i })).toHaveAttribute(
      'href',
      '/account'
    );
  });
});
