import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';
import ForAdoptersPage from '@/app/for-adopters/page';
import ForSheltersPage from '@/app/for-shelters/page';

const DEMO_HREF = '/get-started?demo=1&choose=1';

describe('Demo visibility pages (#67)', () => {
  it('homepage hero and lower CTA both link to the demo chooser', () => {
    render(<Home />);

    const demoLinks = screen.getAllByRole('link', { name: /try the demo/i });
    expect(demoLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of demoLinks) {
      expect(link).toHaveAttribute('href', DEMO_HREF);
    }
  });

  it('homepage hero only has Create Account and Try the Demo', () => {
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

  it('for-adopters exposes Try the Demo', () => {
    render(<ForAdoptersPage />);

    expect(screen.getByRole('link', { name: /try the demo/i })).toHaveAttribute(
      'href',
      DEMO_HREF
    );
  });

  it('for-shelters exposes Try the Demo', () => {
    render(<ForSheltersPage />);

    expect(screen.getByRole('link', { name: /try the demo/i })).toHaveAttribute(
      'href',
      DEMO_HREF
    );
  });
});
