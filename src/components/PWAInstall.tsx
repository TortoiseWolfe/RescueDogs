'use client';

/**
 * PWA lifecycle helper (#50, #162).
 *
 * User-facing Install CTAs were removed (#50). We no longer register a
 * service worker so Chrome does not treat the site as installable (#162).
 * Existing registrations from earlier deploys are unregistered on load.
 */

import { useEffect } from 'react';
import { createLogger } from '@/lib/logger';

const logger = createLogger('components:pwa');

export default function PWAInstall() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      logger.debug('Service Worker not supported in this browser');
      return;
    }

    // Skip in test environments
    if (process.env.NODE_ENV === 'test') return;

    const unregisterWorkers = () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          if (registrations.length === 0) {
            logger.debug('No service workers to unregister');
            return;
          }
          return Promise.all(
            registrations.map((registration) =>
              registration.unregister().then((ok) => {
                logger.info('Service Worker unregistered', {
                  scope: registration.scope,
                  ok,
                });
              })
            )
          );
        })
        .catch((error) => {
          logger.error('Service Worker unregister failed', { error });
        });
    };

    if (document.readyState === 'complete') {
      unregisterWorkers();
    } else {
      window.addEventListener('load', unregisterWorkers, { once: true });
    }
  }, []);

  return null;
}
