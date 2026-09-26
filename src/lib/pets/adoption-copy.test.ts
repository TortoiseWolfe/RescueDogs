import { describe, it, expect } from 'vitest';
import { adoptedConfirmMessage, petArchiveNote } from './adoption-copy';

describe('adoptedConfirmMessage (#339)', () => {
  it('uses him / that applicant for one open application on a male pet', () => {
    expect(
      adoptedConfirmMessage({ name: 'Bubba', sex: 'male', openCount: 1 })
    ).toBe(
      'Bubba has 1 open application. Marking him adopted will let that applicant know.'
    );
  });

  it('uses them / those applicants when sex is unknown and several are open', () => {
    expect(adoptedConfirmMessage({ name: 'Pixie', openCount: 3 })).toBe(
      'Pixie has 3 open applications. Marking them adopted will let those applicants know.'
    );
  });
});

describe('petArchiveNote (#339)', () => {
  it('explains an adopted pet is archived, not deleted', () => {
    expect(
      petArchiveNote({
        name: 'Bubba',
        sex: 'male',
        status: 'adopted',
        applicationCount: 1,
      })
    ).toBe(
      "Bubba is marked Adopted and hidden from browse. He's kept on file because applicants' records point to him."
    );
  });

  it('steers a still-listed pet toward Adopted instead of Delete', () => {
    expect(
      petArchiveNote({
        name: 'Noodle',
        sex: 'female',
        status: 'available',
        applicationCount: 2,
      })
    ).toBe(
      "Noodle has 2 applications, so it's kept on file. Mark Noodle Adopted to take the listing off the site."
    );
  });
});
