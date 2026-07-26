/**
 * E2E coverage for messaging unlock UX after #60 (was Feature 013 OAuth
 * messaging-password modal).
 *
 * #60 removed the second messaging-password gate. Email (and OAuth) users
 * bootstrap device keys via EncryptionKeyGate.ensureKeysForSession — no
 * ReAuthModal unlock/setup.
 *
 * US-3 (was: assert unlock modal for email users) now asserts the modal is
 * gone and the thread is usable after normal session injection.
 *
 * US-1 / US-2 (OAuth setup/unlock modal copy) remain skipped — those Feature
 * 013 surfaces were removed with #60; see #106 for cross-device key recovery.
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedConversation,
  deleteIsolatedConversation,
  dismissCookieBanner,
  handleReAuthModal,
  type IsolatedConversation,
  type InjectableSession,
} from '../utils/test-user-factory';

test.describe.configure({ mode: 'parallel' });

/**
 * Inject `session` and open a conversation; wait for #60 silent key bootstrap.
 */
async function openMessagesWithSessionBootstrap(
  browser: import('@playwright/test').Browser,
  session: InjectableSession,
  conversationId: string
): Promise<{
  page: import('@playwright/test').Page;
  context: import('@playwright/test').BrowserContext;
  close: () => Promise<void>;
}> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  const browserUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_ADMIN_URL ||
    '';
  const supabaseHost = new URL(browserUrl).hostname.split('.')[0];
  const sbStorageKey = `sb-${supabaseHost}-auth-token`;

  await page.goto(`${basePath}/`);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    ({ key, s }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_at: s.expires_at,
          expires_in: 3600,
          token_type: 'bearer',
          user: s.user,
        })
      );
    },
    { key: sbStorageKey, s: session }
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  await page.goto(`${basePath}/messages?conversation=${conversationId}`, {
    waitUntil: 'domcontentloaded',
  });
  await dismissCookieBanner(page);
  await handleReAuthModal(page);

  return { page, context, close: () => context.close() };
}

test.describe('Feature 013 — OAuth Messaging Password', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  // #60: email users no longer see a messaging-password unlock modal.
  test('US-3: email user reaches messages without unlock modal (#60)', async ({
    browser,
  }) => {
    const viewer = await openMessagesWithSessionBootstrap(
      browser,
      fixture!.viewerSession,
      fixture!.conversationId
    );

    try {
      const dialog = viewer.page.getByRole('dialog', {
        name: /re-authentication required/i,
      });
      await expect(dialog).toHaveCount(0);

      await expect(
        viewer.page.getByRole('heading', {
          name: /enter your messaging password/i,
        })
      ).toHaveCount(0);

      await expect(
        viewer.page.locator('[data-testid="message-thread"]')
      ).toBeVisible({ timeout: 60000 });

      await expect(
        viewer.page.getByRole('textbox', { name: /Message input/i })
      ).toBeVisible({ timeout: 45000 });
    } finally {
      await viewer.close();
    }
  });

  test.skip('US-1: OAuth user with no keys sees setup mode', async () => {
    // Removed with #60 — device keys bootstrap without a messaging password.
  });

  test.skip('US-2: OAuth user with keys sees unlock mode + provider badge', async () => {
    // Removed with #60 — see #106 for cross-device recovery without a password UI.
  });
});
