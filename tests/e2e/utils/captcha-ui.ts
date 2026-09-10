/**
 * Playwright helpers for Turnstile on auth forms (#302).
 *
 * @module tests/e2e/utils/captcha-ui
 */

import { expect, type Page } from '@playwright/test';

/**
 * Wait for Cloudflare Turnstile to issue a token when the widget is present.
 * No-op when `NEXT_PUBLIC_CAPTCHA_SITE_KEY` was not baked into the build
 * (widget absent). Call after fill, before submit.
 */
export async function waitForCaptchaIfPresent(
  page: Page,
  timeout = 45000
): Promise<void> {
  const widget = page.getByTestId('captcha-widget');
  if ((await widget.count()) === 0) return;

  // Managed Turnstile writes the token into a hidden response field.
  const response = widget.locator('[name="cf-turnstile-response"]').first();
  await expect(response).toHaveValue(/.+/, { timeout });
}
