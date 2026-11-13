/**
 * Unit coverage for rescue welcome email copy (#316).
 * Imports the shipped rescue_welcome branch from
 * supabase/functions/_shared/email-templates.ts (no imports there, so Vitest
 * loads it directly) so an edit to the real copy is seen by this test.
 */

import { describe, it, expect } from 'vitest';
import {
  getEmailSubject,
  getEmailText,
  type RescueWelcomeEmailData,
} from '../../../../supabase/functions/_shared/email-templates';

function getSubject(): string {
  return getEmailSubject('rescue_welcome');
}

function getText(d: RescueWelcomeEmailData): string {
  return getEmailText('rescue_welcome', d);
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
