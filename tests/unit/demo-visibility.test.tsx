import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';
import ForAdoptersPage from '@/app/for-adopters/page';
import ForSheltersPage from '@/app/for-shelters/page';

const DEMO_HREF = '/get-started?demo=1&choose=1';

describe('Demo visibility pages (#67 / #74)', () => {
  it('homepage hero and lower CTA both link to the demo chooser', () => {
    render(<Home />);

    const demoLinks = screen.getAllByRole('link', { name: /^try demo$/i });
    expect(demoLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of demoLinks) {
      expect(link).toHaveAttribute('href', DEMO_HREF);
    }
  });

  it('homepage hero has Create Account then Try Demo', () => {
    render(<Home />);

    expect(
      screen.getByRole('link', { name: /create account/i })
    ).toHaveAttribute('href', '/get-started?choose=1&intent=signup');
    expect(
      screen.queryByRole('link', { name: /^for adopters$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /^for shelters$/i })
    ).not.toBeInTheDocument();
  });

  it('lower demo band puts dark ink on the orange fill (#241, was #74)', () => {
    render(<Home />);

    const heading = screen.getByRole('heading', {
      name: /want to see the live rescue loop/i,
    });
    // White on #f97316 is 2.80:1; accent-content (#040c14) is 7.02:1.
    const band = heading.parentElement as HTMLElement;
    expect(band.className).toMatch(/\bbg-accent\b/);
    expect(band.className).toMatch(/\btext-accent-content\b/);
    expect(band.className).not.toMatch(/text-white/);

    // The support line inherits the band's ink instead of its own navy.
    const support = screen.getByText(/choose the adopter or shelter door/i);
    expect(support.className).not.toMatch(/text-\[#/);
  });

  it('for-adopters exposes Try Demo', () => {
    render(<ForAdoptersPage />);

    expect(screen.getByRole('link', { name: /^try demo$/i })).toHaveAttribute(
      'href',
      DEMO_HREF
    );
  });

  it('for-shelters exposes Try Demo', () => {
    render(<ForSheltersPage />);

    expect(screen.getByRole('link', { name: /^try demo$/i })).toHaveAttribute(
      'href',
      DEMO_HREF
    );
  });

  it('for-shelters leads with a pilot contact CTA, not Create Account (#217)', () => {
    render(<ForSheltersPage />);

    expect(
      screen.getByRole('link', { name: /talk to us about a pilot/i })
    ).toHaveAttribute('href', '/contact?role=shelter');
    expect(
      screen.queryByRole('link', { name: /^create account$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/self-serve create-org is not live/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/create your shelter or rescue at the shelter portal/i)
    ).toBeInTheDocument();
  });
});
