'use client';

import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { keyManagementService } from '@/services/messaging/key-service';
import { useAuth } from '@/contexts/AuthContext';

export interface EncryptionKeyGateProps {
  /** Child content — rendered once keys are confirmed in memory */
  children: ReactNode;
}

/**
 * EncryptionKeyGate — blocks interaction until E2E keys are usable (#60).
 *
 * After normal account login, silently ensures device/session keys via
 * `ensureKeysForSession` — no messaging-password modal and no redirect to
 * `/messages/setup`.
 *
 * Waits for the auth session to be restored before checking keys.
 *
 * @category auth
 */
export default function EncryptionKeyGate({
  children,
}: EncryptionKeyGateProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [checkingKeys, setCheckingKeys] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Track if user was ever authenticated. Supabase token refresh briefly
  // sets user=null and removes the auth token from localStorage. Without
  // this guard, the gate would redirect to /sign-in during refresh.
  const wasAuthenticatedRef = useRef(false);
  if (user) {
    wasAuthenticatedRef.current = true;
  }

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCheckingKeys(false);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setBootstrapError(null);
      try {
        await keyManagementService.ensureKeysForSession(user.id);
        if (!cancelled) {
          setCheckingKeys(false);
        }
      } catch (err) {
        console.error(
          '[EncryptionKeyGate] ensureKeysForSession() failed:',
          err
        );
        if (!cancelled) {
          setBootstrapError(
            'Could not prepare secure messaging for this session. Try refreshing the page.'
          );
          setCheckingKeys(false);
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  // Always render children — blocking them behind a spinner prevented
  // the sidebar tabs from mounting, which broke E2E tests that wait for
  // the "Connections" tab while the gate is still checking keys.
  // Show a loading overlay on top instead of replacing children entirely.
  return (
    <>
      {(authLoading || checkingKeys) && (
        <div
          className="bg-base-100/80 pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          data-testid="encryption-key-gate-loading"
        >
          <span
            className="loading loading-spinner loading-lg"
            role="status"
            aria-label="Checking encryption keys"
          ></span>
        </div>
      )}
      {bootstrapError && (
        <div
          role="alert"
          className="alert alert-error mx-4 mt-4"
          data-testid="encryption-key-gate-error"
        >
          <span>{bootstrapError}</span>
        </div>
      )}
      {children}
    </>
  );
}
