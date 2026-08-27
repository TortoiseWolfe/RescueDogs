/**
 * Unit tests for shelter application notify email templates (#260).
 * Mirrors supabase/functions/_shared/email-templates.ts (Deno) logic.
 */

import { describe, it, expect } from 'vitest';

// Keep in sync with email-templates.ts — vitest cannot import Deno modules directly.
function getEmailSubject(type: string, data?: Record<string, string>): string {
  if (type === 'shelter_new_application') {
    return `New adoption application for ${data!.pet_name} — ${data!.shelter_name}`;
  }
  return 'Payment Notification';
}

function getEmailText(type: string, data: Record<string, string>): string {
  if (type === 'shelter_new_application') {
    return [
      'New adoption application',
      '',
      `${data.applicant_name} applied to adopt ${data.pet_name}.`,
      '',
      `Review the application: ${data.application_url}`,
      '',
      `${data.shelter_name} · Raised Paws adoption portal`,
    ].join('\n');
  }
  return `Payment Notification - Type: ${type}`;
}

const sample = {
  pet_name: 'Rocky',
  shelter_name: 'Once Upon A Prayer',
  applicant_name: 'Jane Doe',
  application_url:
    'https://raisedpaws.com/shelter/application?id=11111111-1111-1111-1111-111111111111',
};

describe('shelter_new_application email templates (#260)', () => {
  it('subject includes pet and shelter names', () => {
    expect(getEmailSubject('shelter_new_application', sample)).toBe(
      'New adoption application for Rocky — Once Upon A Prayer'
    );
  });

  it('text body includes applicant and review URL', () => {
    const text = getEmailText('shelter_new_application', sample);
    expect(text).toContain('Jane Doe applied to adopt Rocky');
    expect(text).toContain(sample.application_url);
  });
});
