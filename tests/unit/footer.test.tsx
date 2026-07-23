import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUsePathname = vi.fn(() => '/');

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

import { Footer } from '@/components/Footer';

describe('Footer (#74 / #65)', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('credits Tech Stack Devs with an external link', () => {
    render(<Footer />);

    expect(
      screen.getByText(/raised paws · every pet deserves a happy tail/i)
    ).toBeInTheDocument();

    const credit = screen.getByRole('link', { name: /tech stack devs/i });
    expect(credit).toHaveAttribute('href', 'https://www.techstackdevs.com');
    expect(credit).toHaveAttribute('target', '_blank');
    expect(credit).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('links to Blog in the footer as a pill (#65)', () => {
    render(<Footer />);

    const blogs = screen.getAllByRole('link', { name: /^blog$/i });
    expect(blogs.length).toBeGreaterThanOrEqual(1);
    expect(blogs[0]).toHaveAttribute('href', '/blog');
    expect(blogs[0].className).toMatch(/bg-white/);
  });

  it('hides the site footer on messaging routes', () => {
    mockUsePathname.mockReturnValue('/messages');
    const { container } = render(<Footer />);
    expect(container).toBeEmptyDOMElement();
  });
});
