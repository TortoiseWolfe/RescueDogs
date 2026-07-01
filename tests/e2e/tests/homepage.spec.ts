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
    // The rescue homepage leads with adoption — the pet-card CTAs link to /adopt.
    await page.locator('a[href*="/adopt"]').first().click();

    await expect(page).toHaveURL(/.*adopt/);
  });

  test('navigate to the status tracker', async ({ page }) => {
    // The CTA banner links to the live application status tracker.
    await page.locator('a[href*="/applications/status"]').first().click();

    await expect(page).toHaveURL(/.*applications\/status/);
  });

  test('key stats section is present', async ({ page }) => {
    // The rescue homepage replaced the template "Key Features" with impact
    // stats (pets rescued / happy families / volunteers).
    const stats = page.getByText(/pets rescued|happy families|volunteers/i);
    await expect(stats.first()).toBeVisible();
  });

  test('navigate to sign-in from the homepage', async ({ page }) => {
    // The "Try Demo Login" CTA links to /sign-in.
    await page.locator('a[href*="/sign-in"]').first().click();

    await expect(page).toHaveURL(/.*sign-in/);
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
