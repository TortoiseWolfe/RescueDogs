'use client';

/**
 * Silent service-worker registration only.
 * User-facing Install App / PWA install CTAs were removed (#50).
 */

import { useEffect } from 'react';
import { projectConfig } from '@/config/project.config';
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

    const registerSW = () => {
      const swPath = projectConfig.swPath;
      logger.debug('Registering Service Worker', { path: swPath });

      const swUrl = `${swPath}?v=${Date.now()}`;

      navigator.serviceWorker.register(swUrl).then(
        (registration) => {
          // Defensive: register() can resolve undefined in some hosting setups
          if (!registration) {
            logger.warn(
              'Service Worker register() resolved with undefined — likely sw.js MIME or CSP issue'
            );
            return;
          }

          logger.info('Service Worker registered', {
            scope: registration.scope,
            state: registration.active?.state || 'installing',
          });

          registration.update().catch((err) => {
            logger.debug('SW update failed', { error: err });
          });

          setInterval(() => {
            registration.update().catch((err) => {
              logger.debug('SW update check failed', { error: err });
            });
          }, 60000);
        },
        (error) => {
          logger.error('Service Worker registration failed', { error });
        }
      );
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }
  }, []);

  return null;
}
