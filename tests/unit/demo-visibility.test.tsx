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

  it('lower demo band keeps white heading and navy support line (#74)', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { name: /want to see the live rescue loop/i })
    ).toBeInTheDocument();
    const support = screen.getByText(/pick adopter or shelter/i);
    expect(support.className).toMatch(/text-\[#172554\]/);
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
});
