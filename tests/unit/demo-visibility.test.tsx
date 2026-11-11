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

  it('lower demo band keeps light text on navy, not white on orange (#241, #571)', () => {
    render(<Home />);

    const heading = screen.getByRole('heading', {
      name: /want to see the live rescue loop/i,
    });
    // White on #f97316 is 2.80:1. The band is navy instead: #fdfbf7 on
    // #172554 is 14.22:1, and the support line #dbe4f3 on #172554 is 11.48:1.
    const band = heading.parentElement as HTMLElement;
    expect(band.className).toMatch(/\bbg-\[#172554\]/);
    expect(band.className).not.toMatch(/\bbg-accent\b/);
    expect(heading.className).toMatch(/\btext-\[#fdfbf7\]/);
    expect(heading.className).not.toMatch(/text-white/);

    const support = screen.getByText(/choose the adopter or shelter door/i);
    expect(support.className).toMatch(/\btext-\[#dbe4f3\]/);
    expect(support.className).not.toMatch(/text-white/);
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
