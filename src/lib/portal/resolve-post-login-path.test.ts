import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {},
}));

const getMyShelterMembership = vi.fn();

vi.mock('@/services/applications', () => ({
  ShelterApplicationService: class {
    getMyShelterMembership = getMyShelterMembership;
  },
}));

import { resolvePostLoginPath } from './resolve-post-login-path';

describe('resolvePostLoginPath', () => {
  beforeEach(() => {
    getMyShelterMembership.mockReset();
  });

  it('prefers an explicit returnUrl', async () => {
    await expect(
      resolvePostLoginPath({
        userId: 'u1',
        explicitReturnUrl: '/messages',
        portal: 'shelter',
      })
    ).resolves.toBe('/messages');
    expect(getMyShelterMembership).not.toHaveBeenCalled();
  });

  it('uses portal default when set and no returnUrl', async () => {
    await expect(
      resolvePostLoginPath({
        userId: 'u1',
        portal: 'adopter',
      })
    ).resolves.toBe('/applications');
  });

  it('routes shelter staff to /shelter when bare login', async () => {
    getMyShelterMembership.mockResolvedValue({
      shelterId: 's1',
      shelterName: 'Demo',
      role: 'manager',
    });
    await expect(resolvePostLoginPath({ userId: 'u1' })).resolves.toBe(
      '/shelter'
    );
  });

  it('routes non-staff to /applications when bare login', async () => {
    getMyShelterMembership.mockResolvedValue(null);
    await expect(resolvePostLoginPath({ userId: 'u1' })).resolves.toBe(
      '/applications'
    );
  });
});
