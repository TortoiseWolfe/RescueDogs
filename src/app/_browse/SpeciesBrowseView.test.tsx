import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { BrowsePet } from '@/types/applications';

const service = vi.hoisted(() => ({
  listBrowseShelters: vi.fn(),
  getBrowsePets: vi.fn(),
}));

// One stable object: a fresh one per render would retrigger the page's
// search-params effect and re-render forever.
const searchParams = vi.hoisted(() => new URLSearchParams(''));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  usePathname: () => '/dogs',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/services/applications', () => ({
  ApplicationService: vi.fn().mockImplementation(() => service),
}));

import SpeciesBrowseView from './SpeciesBrowseView';

function pet(id: string, name: string, photo: string | null): BrowsePet {
  return {
    id,
    shelter_id: 'shelter-1',
    name,
    species: 'dog',
    breed: null,
    sex: null,
    size: null,
    age_years: null,
    photo_url: photo,
    shelters: { name: 'Happy Tails', city: 'Austin', state: 'TX' },
  } as unknown as BrowsePet;
}

describe('SpeciesBrowseView photo links (#463)', () => {
  beforeEach(() => {
    service.listBrowseShelters.mockReset().mockResolvedValue([]);
    service.getBrowsePets
      .mockReset()
      .mockResolvedValue([
        pet('p1', 'Biscuit', 'https://example.test/biscuit.jpg'),
        pet('p2', 'Mochi', null),
      ]);
  });

  it('hides each card photo link from assistive tech and the tab order', async () => {
    const { container } = render(<SpeciesBrowseView species="dogs" />);
    await screen.findByText('Biscuit');

    const photoLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('article a')
    ).filter((a) => a.querySelector('figure'));

    expect(photoLinks).toHaveLength(2);
    for (const link of photoLinks) {
      expect(link.getAttribute('aria-hidden')).toBe('true');
      expect(link.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('keeps the named routes to the detail page for each pet', async () => {
    render(<SpeciesBrowseView species="dogs" />);
    await screen.findByText('Biscuit');

    // Accessible-name queries skip aria-hidden elements, so these are exactly
    // the links a screen reader or keyboard user reaches. None may be nameless.
    const links = screen.getAllByRole('link');
    const toDetail = links.filter((a) =>
      (a.getAttribute('href') ?? '').includes('detail')
    );
    expect(toDetail.length).toBeGreaterThanOrEqual(4);
    for (const link of toDetail) {
      expect((link.textContent ?? '').trim()).not.toBe('');
    }
    expect(screen.getByRole('link', { name: 'Biscuit' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mochi' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Meet Biscuit/ })).toBeTruthy();
  });
});
