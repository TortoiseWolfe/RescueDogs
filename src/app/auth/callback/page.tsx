'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { OAuthErrorBoundary } from './error-boundary';
import { createLogger } from '@/lib/logger';
import {
  isOAuthUser,
  populateOAuthProfile,
  parseAuthErrorFromUrl,
} from '@/lib/auth/oauth-utils';

const logger = createLogger('app:auth:callback:page');

function AuthCallbackContent() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    // Errors arrive in the URL fragment under the implicit flow — see
    // parseAuthErrorFromUrl.
    const authError = parseAuthErrorFromUrl(
      window.location.search,
      window.location.hash
    );

    if (authError) {
      setErrorDetails(
        `Error: ${authError.error}\nDescription: ${authError.errorDescription || 'No description'}`
      );
      logger.error('OAuth error', {
        error: authError.error,
        errorDescription: authError.errorDescription,
      });
    }
  }, []);

  useEffect(() => {
    // Supabase handles state validation internally - no manual check needed

    const url = window.location.href;
    const hasCode = url.includes('code=');
    // #100: this guard used to read the query string only. Under the implicit flow
    // the error lives in the fragment, so an expired link produced error=null here —
    // the page rendered the error panel and STILL ran handleAuthComplete(), which
    // bounced the user to /sign-in two seconds later before they could read it.
    const authError = parseAuthErrorFromUrl(
      window.location.search,
      window.location.hash
    );

    setDebugInfo(
      `URL has code: ${hasCode}, has error: ${!!authError}, isLoading: ${isLoading}, user: ${user?.email || 'null'}`
    );

    const handleAuthComplete = async () => {
      if (user) {
        // Populate OAuth profile before redirect (FR-001)
        // Non-blocking per NFR-001 - errors logged but don't block redirect
        if (isOAuthUser(user)) {
          try {
            await populateOAuthProfile(user);
          } catch (err) {
            logger.error('Failed to populate OAuth profile', { error: err });
            // Continue with redirect - non-blocking
          }
        }

        logger.info('User authenticated, redirecting to profile');
        router.push('/profile');
      } else {
        logger.debug('No user after loading, waiting 2 more seconds...');
        setTimeout(() => {
          if (!user) {
            logger.warn('Still no user, redirecting to sign-in');
            router.push('/sign-in?error=auth_callback_failed');
          }
        }, 2000);
      }
    };

    // Never auto-redirect while an error is on screen — the user needs to read it
    // and use the "Back to Sign In" button themselves (#100).
    if (!isLoading && !authError) {
      handleAuthComplete();
    }
  }, [user, isLoading, router]);

  if (errorDetails) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="alert alert-error mx-auto max-w-md">
          <div>
            <h3 className="font-bold">Authentication Error</h3>
            <pre className="mt-2 text-xs whitespace-pre-wrap">
              {errorDetails}
            </pre>
            <p className="mt-2 text-sm">URL: {window.location.href}</p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push('/sign-in')}
            className="btn btn-primary"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4">Completing sign in...</p>
        <p className="text-base-content/85 mt-2 text-sm">{debugInfo}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <OAuthErrorBoundary>
      <AuthCallbackContent />
    </OAuthErrorBoundary>
  );
}
