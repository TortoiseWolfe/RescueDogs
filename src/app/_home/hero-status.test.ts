import { describe, expect, it } from 'vitest';
import { heroStatusSteps, pickLatestApplication } from './hero-status';

describe('pickLatestApplication', () => {
  it('returns null when the adopter has no applications', () => {
    expect(pickLatestApplication([])).toBeNull();
  });

  it('picks the most recently updated application, not the newest created', () => {
    const olderUpdate = {
      id: 'new-file',
      status_changed_at: '2026-11-01T00:00:00.000Z',
    };
    const newerUpdate = {
      id: 'old-file',
      status_changed_at: '2026-11-12T00:00:00.000Z',
    };
    expect(pickLatestApplication([olderUpdate, newerUpdate])?.id).toBe(
      'old-file'
    );
  });
});

describe('heroStatusSteps', () => {
  it('uses the real pipeline labels and marks the current stage', () => {
    const steps = heroStatusSteps('home_visit');
    expect(steps.map((step) => step.label)).toEqual([
      'Submitted',
      'Under Review',
      'Reference Check',
      'Home Visit',
      'Approved',
    ]);
    expect(steps.find((step) => step.label === 'Home Visit')?.state).toBe(
      'current'
    );
    expect(steps.find((step) => step.label === 'Submitted')?.state).toBe(
      'done'
    );
    expect(steps.find((step) => step.label === 'Approved')?.state).toBe(
      'upcoming'
    );
  });

  it('replaces Approved when the application ends another way', () => {
    const steps = heroStatusSteps('not_selected');
    expect(steps.map((step) => step.label)).toEqual([
      'Submitted',
      'Under Review',
      'Reference Check',
      'Home Visit',
      'Not Selected',
    ]);
    expect(steps.at(-1)?.state).toBe('current');
  });
});
