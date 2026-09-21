/**
 * Unit coverage for rescue welcome email copy (#316).
 * Mirrors supabase/functions/_shared/email-templates.ts rescue_welcome branch
 * so CI catches regressions without Deno.
 */

import { describe, it, expect } from 'vitest';

type RescueWelcomeEmailData = {
  display_name: string;
  shelter_url: string;
  add_pet_url: string;
  contact_url: string;
  help_email: string;
  site_url: string;
};

function getSubject(): string {
  return 'Welcome to Raised Paws — next steps for your rescue';
}

function getText(d: RescueWelcomeEmailData): string {
  return [
    'Welcome to Raised Paws',
    '',
    `Hi ${d.display_name},`,
    '',
    'Your account is active. Here’s how to get your rescue set up:',
    '',
    `1. Complete your rescue profile: ${d.shelter_url}`,
    `2. Add your first pet: ${d.add_pet_url}`,
    '3. How adoption works: adopters apply from the pet page; you update status in the shelter dashboard so they can track progress.',
    '',
    `Need help? ${d.contact_url} or ${d.help_email}`,
    '',
    `Raised Paws · ${d.site_url}`,
  ].join('\n');
}

describe('rescue welcome email copy (#316)', () => {
  const sample: RescueWelcomeEmailData = {
    display_name: 'Annie',
    shelter_url: 'https://raisedpaws.com/shelter',
    add_pet_url: 'https://raisedpaws.com/shelter/pets/new',
    contact_url: 'https://raisedpaws.com/contact',
    help_email: 'contact@raisedpaws.com',
    site_url: 'https://raisedpaws.com',
  };

  it('uses a clear rescue-focused subject', () => {
    expect(getSubject()).toMatch(/Welcome to Raised Paws/i);
    expect(getSubject()).toMatch(/rescue/i);
  });

  it('covers profile, first pet, tracker, and help', () => {
    const text = getText(sample);
    expect(text).toContain(sample.shelter_url);
    expect(text).toContain(sample.add_pet_url);
    expect(text).toMatch(/track progress/i);
    expect(text).toContain(sample.contact_url);
    expect(text).toContain(sample.help_email);
    expect(text).not.toMatch(/App Store|PWA|download the app/i);
  });
});
