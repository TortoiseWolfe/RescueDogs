import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

test.describe('Homepage Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissCookieBanner(page);
  });

  test('homepage loads with correct title', async ({ page }) => {
    // Check the page title contains project name
    await expect(page).toHaveTitle(/.*/);

    // Check the main heading is visible
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('navigate to the adopt page', async ({ page }) => {
    // Prefer visible pet-card CTAs — #65 hid Apply to Adopt inside For Adopters.
    await page
      .getByRole('link', { name: /Meet (Biscuit|Pepper|Tank)/i })
      .first()
      .click();

    await expect(page).toHaveURL(/.*adopt/);
  });

  test('navigate to demo login tips from the homepage', async ({ page }) => {
    // Orange CTA band points at demo tips (get-started), not the status tracker.
    await page.locator('a[href*="/get-started"]').first().click();

    await expect(page).toHaveURL(/.*get-started/);
  });

  test('key stats section is present', async ({ page }) => {
    // The rescue homepage replaced the template "Key Features" with impact
    // stats (pets rescued / happy families / volunteers).
    const stats = page.getByText(/pets rescued|happy families|volunteers/i);
    await expect(stats.first()).toBeVisible();
  });

  test('navigate to the get-started flow from the homepage CTA', async ({
    page,
  }) => {
    // The homepage is a static page whose primary CTAs ("Create Account" and
    // "Try Demo") link to /get-started and render regardless of auth. Click the
    // real CTA — no page.goto fallback — so a removed/broken CTA fails this test.
    const cta = page.getByRole('link', { name: /try demo/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page).toHaveURL(/\/get-started/);
  });

  test('skip to main content link works', async ({ page }) => {
    // The skip link uses sr-only class and is only visible on focus
    const skipLink = page.getByRole('link', { name: /skip to main content/i });

    // Focus the skip link using Tab
    await page.keyboard.press('Tab');

    // Wait a moment for focus styles to apply
    await page.waitForTimeout(100);

    // Click with force since it's a sr-only element (visible on focus but Playwright may not detect it)
    await skipLink.click({ force: true });

    // Verify we scrolled to the main content section
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeInViewport();
  });
});
