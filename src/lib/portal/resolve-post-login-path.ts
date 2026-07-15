import { supabase } from '@/lib/supabase/client';
import { ShelterApplicationService } from '@/services/applications';
import {
  PORTAL_DEFAULT_RETURN,
  type PortalType,
} from '@/lib/portal/portal-preference';

/**
 * Post-login destination when the user did not arrive with an explicit
 * safe returnUrl (#48). Membership wins over portal preference.
 */
export async function resolvePostLoginPath(options: {
  userId: string;
  explicitReturnUrl?: string | null;
  portal?: PortalType | null;
}): Promise<string> {
  const { userId, explicitReturnUrl, portal } = options;

  if (
    explicitReturnUrl &&
    explicitReturnUrl.startsWith('/') &&
    !explicitReturnUrl.startsWith('//')
  ) {
    return explicitReturnUrl;
  }

  if (portal) {
    return PORTAL_DEFAULT_RETURN[portal];
  }

  const service = new ShelterApplicationService(supabase);
  const membership = await service.getMyShelterMembership(userId);
  if (membership) return PORTAL_DEFAULT_RETURN.shelter;
  return PORTAL_DEFAULT_RETURN.adopter;
}
