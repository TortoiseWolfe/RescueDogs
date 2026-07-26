'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy messaging-password setup route (#60).
 * Second messaging passwords are removed — redirect to /messages, which
 * bootstraps device keys via EncryptionKeyGate.
 */
export default function MessagingSetupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/messages');
  }, [router]);

  return (
    <main className="bg-base-100 flex min-h-screen items-center justify-center">
      <span
        className="loading loading-spinner loading-lg"
        role="status"
        aria-label="Redirecting to messages"
      />
    </main>
  );
}
