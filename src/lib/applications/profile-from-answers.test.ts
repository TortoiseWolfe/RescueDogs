import { describe, expect, it } from 'vitest';
import { profileSnapshotFromAnswers } from './profile-from-answers';

describe('profileSnapshotFromAnswers', () => {
  it('maps bank answers onto the legacy profile snapshot', () => {
    const answers = new Map<string, unknown>([
      ['con.full_name', 'Dana Adopter'],
      ['con.phone', { number: '555-0100' }],
      [
        'con.address',
        { street: '1 Main', city: 'Austin', state: 'TX', zip: '78701' },
      ],
      ['hou.home_type', 'house'],
      ['hou.own_rent', 'rent'],
      ['hou.landlord_allows', 'yes'],
      ['hou.landlord_contact', { name: 'Lee', phone: '555-0199' }],
      ['yrd.has_yard', true],
      ['yrd.fenced', 'fully'],
      ['hh.adults_count', 2],
      ['hh.children_count', 1],
      ['pet.current', { rows: [], legacy_note: 'one dog' }],
      ['vet.contact', { name: 'Happy Vet', phone: '555-0111' }],
      ['trn.experience_level', { level: 'moderate', describe: 'Had dogs' }],
    ]);

    expect(profileSnapshotFromAnswers(answers)).toEqual({
      full_name: 'Dana Adopter',
      phone: '555-0100',
      address_line: '1 Main',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      housing_type: 'rent_house',
      landlord_approval: true,
      landlord_contact: 'Lee',
      has_yard: true,
      yard_fenced: true,
      household_adults: 2,
      household_children: 1,
      other_pets: 'one dog',
      vet_name: 'Happy Vet',
      vet_phone: '555-0111',
      experience: 'Had dogs',
    });
  });

  it('falls back to a display name when contact is missing', () => {
    expect(profileSnapshotFromAnswers(new Map(), 'Fallback').full_name).toBe(
      'Fallback'
    );
  });
});
