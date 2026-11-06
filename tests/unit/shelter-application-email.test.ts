/**
 * Unit tests for shelter application notify email templates (#260).
 * Imports the shipped templates from supabase/functions/_shared/email-templates.ts
 * (the file has no imports, so Vitest loads it directly, as test-recipients does).
 */

import { describe, it, expect } from 'vitest';
import {
  getEmailHtml,
  getEmailSubject,
  getEmailText,
} from '../../supabase/functions/_shared/email-templates';

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

  it('html body escapes applicant-controlled fields', () => {
    const html = getEmailHtml('shelter_new_application', {
      ...sample,
      applicant_name: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
