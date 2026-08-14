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

    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()} Raised Paws`))
    ).toBeInTheDocument();

    const credit = screen.getByRole('link', { name: /tech stack devs/i });
    expect(credit).toHaveAttribute('href', 'https://www.techstackdevs.com');
    expect(credit).toHaveAttribute('target', '_blank');
    expect(credit).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('shows the Raised Paws mark linking home (#136)', () => {
    render(<Footer />);

    const home = screen.getByRole('link', { name: /^raised paws$/i });
    expect(home).toHaveAttribute('href', '/');
  });

  it('links to Blog in the footer as a pill (#65)', () => {
    render(<Footer />);

    const blogs = screen.getAllByRole('link', { name: /^blog$/i });
    expect(blogs.length).toBeGreaterThanOrEqual(1);
    expect(blogs[0]).toHaveAttribute('href', '/blog');
    expect(blogs[0].className).toMatch(/bg-white/);
  });

  it('links to Contact beside Blog in the footer (#128)', () => {
    render(<Footer />);

    const contacts = screen.getAllByRole('link', { name: /^contact$/i });
    expect(contacts.length).toBeGreaterThanOrEqual(1);
    expect(contacts[0]).toHaveAttribute('href', '/contact');
    expect(contacts[0].className).toMatch(/bg-white/);
  });

  it('links to Follow between Blog and Contact (#129)', () => {
    render(<Footer />);

    const follows = screen.getAllByRole('link', { name: /^follow$/i });
    expect(follows.length).toBeGreaterThanOrEqual(1);
    expect(follows[0]).toHaveAttribute('href', '/follow');
    expect(follows[0].className).toMatch(/bg-white/);
  });

  it('marks Follow as current on /follow (#129)', () => {
    mockUsePathname.mockReturnValue('/follow');
    render(<Footer />);

    const follow = screen.getByRole('link', { name: /^follow$/i });
    expect(follow).toHaveAttribute('aria-current', 'page');
  });

  it('marks Contact as current on /contact (#128)', () => {
    mockUsePathname.mockReturnValue('/contact');
    render(<Footer />);

    const contact = screen.getByRole('link', { name: /^contact$/i });
    expect(contact).toHaveAttribute('aria-current', 'page');
  });

  it('hides the site footer on messaging routes', () => {
    mockUsePathname.mockReturnValue('/messages');
    const { container } = render(<Footer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links to Raised Paws social profiles (#118)', () => {
    render(<Footer />);

    expect(
      screen.getByRole('link', { name: /raised paws on instagram/i })
    ).toHaveAttribute('href', 'https://www.instagram.com/raised_paws/');
    expect(
      screen.getByRole('link', { name: /raised paws on tiktok/i })
    ).toHaveAttribute('href', 'https://www.tiktok.com/@raisedpaws');
    expect(
      screen.getByRole('link', { name: /raised paws on x/i })
    ).toHaveAttribute('href', 'https://x.com/Raised_Paws');

    const instagram = screen.getByRole('link', {
      name: /raised paws on instagram/i,
    });
    expect(instagram).toHaveAttribute('target', '_blank');
    expect(instagram).toHaveAttribute(
      'rel',
      expect.stringContaining('noopener')
    );
  });
});
