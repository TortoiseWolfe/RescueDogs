import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { BrowsePetDetail } from '@/types/applications';

const service = vi.hoisted(() => ({
  getBrowsePet: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('id=pet-1'),
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/services/applications', () => ({
  ApplicationService: vi.fn().mockImplementation(() => service),
}));

import PetDetailView from './PetDetailView';

const PET = {
  id: 'pet-1',
  shelter_id: 'shelter-1',
  name: 'Biscuit',
  species: 'dog',
  breed: 'Beagle',
  sex: null,
  size: null,
  age_years: null,
  photo_url: null,
  pet_photos: [],
  shelters: { name: 'Happy Tails', city: 'Austin', state: 'TX' },
} as unknown as BrowsePetDetail;

describe('PetDetailView eyebrow colour (#464)', () => {
  beforeEach(() => {
    service.getBrowsePet.mockReset();
    service.getBrowsePet.mockResolvedValue(PET);
  });

  it('uses the --brand-ink token, not raw orange, for "Available for adoption"', async () => {
    render(<PetDetailView species="dogs" />);

    const eyebrow = (
      await screen.findByText(/Available for adoption/i)
    ).closest('p') as HTMLElement;

    expect(eyebrow.className).toContain('text-[var(--brand-ink)]');
    // Raw #f97316 on the cream page is 2.71:1 in the light theme.
    expect(eyebrow.className).not.toContain('#f97316');
  });
});
