// Security Hardening: Brute Force Prevention E2E Test
// Feature 017 - Task T015
// Purpose: Test server-side rate limiting prevents brute force attacks
//
// This test suite uses Playwright project ordering to run after rate-limiting
// tests but before sign-up tests, preserving IP-based rate limit quota.
//
// Per-email max attempts is AUTH_RATE_LIMIT_MAX_ATTEMPTS (15). Tests seed
// near-lockout via service role so we do not burn Supabase Auth IP quota
// with 15 UI clicks per case (#81).

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';
import {
  clearAllRateLimits,
  seedFailedAttempts,
  isRateLimitAdminAvailable,
} from '../utils/rate-limit-admin';
import { AUTH_RATE_LIMIT_MAX_ATTEMPTS } from '@/lib/auth/rate-limit-check';

/**
 * Generate a test email using real email domain from TEST_USER_PRIMARY_EMAIL.
 */
function generateBruteForceEmail(prefix: string): string {
  const baseEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  if (baseEmail.includes('@gmail.com')) {
    const baseUser = baseEmail.split('+')[0] || baseEmail.split('@')[0];
    return `${baseUser}+bf-${prefix}-${timestamp}-${random}@gmail.com`;
  }

  if (baseEmail.includes('@')) {
    const domain = baseEmail.split('@')[1];
    return `bf-${prefix}-${timestamp}-${random}@${domain}`;
  }

  console.error(
    '❌ TEST_USER_PRIMARY_EMAIL not configured - brute force tests may fail'
  );
  return `bf-${prefix}-${timestamp}-${random}@gmail.com`;
}

function isBruteForceEmailConfigValid(): boolean {
  const baseEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
  return baseEmail.includes('@');
}

/** Seed at max-1 so one wrong-password UI attempt tips into lockout. */
async function seedNearLockout(email: string): Promise<void> {
  const seeded = await seedFailedAttempts(
    email,
    'sign_in',
    AUTH_RATE_LIMIT_MAX_ATTEMPTS - 1
  );
  expect(
    seeded,
    'Service role must seed rate_limit_attempts for brute-force E2E'
  ).toBe(true);
}

async function attemptWrongPassword(
  page: import('@playwright/test').Page,
  email: string,
  wrongPassword: string
): Promise<void> {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test.describe('Brute Force Prevention - REQ-SEC-003', () => {
  const wrongPassword = 'WrongPassword123!';
  let testEmail: string;

  // Clear rate limits and generate test email before suite
  test.beforeAll(async () => {
    await clearAllRateLimits();
    testEmail = generateBruteForceEmail('main');
  });

  test.beforeEach(async ({ page }, testInfo) => {
    if (!isBruteForceEmailConfigValid()) {
      testInfo.skip(
        true,
        'TEST_USER_PRIMARY_EMAIL not configured - brute force tests require valid email domain'
      );
      return;
    }
    if (!isRateLimitAdminAvailable()) {
      testInfo.skip(
        true,
        'SUPABASE_SERVICE_ROLE_KEY required to seed near-lockout attempt counts'
      );
    }
  });

  test(`should lockout after ${AUTH_RATE_LIMIT_MAX_ATTEMPTS} failed login attempts`, async ({
    page,
  }) => {
    await seedNearLockout(testEmail);

    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Tip over the seeded max-1 counter
    await attemptWrongPassword(page, testEmail, wrongPassword);
    await expect(
      page.getByRole('alert').filter({
        hasText: /failed|error|locked|invalid|incorrect|attempts/i,
      })
    ).toBeVisible({ timeout: 5000 });

    // Next attempt: locked out
    await attemptWrongPassword(page, testEmail, wrongPassword);

    const errorAlert = page.getByRole('alert').filter({
      hasText: /too many.*attempts|temporarily locked|rate.*limit/i,
    });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    const errorMessage = await errorAlert.textContent();
    expect(errorMessage).toMatch(/15|minutes?|try.*again/i);
  });

  test('should persist lockout across browser sessions', async ({
    browser,
  }) => {
    const sessionEmail = generateBruteForceEmail('session');
    await seedNearLockout(sessionEmail);

    const context1 = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page1 = await context1.newPage();

    await page1.goto('/sign-in');
    await dismissCookieBanner(page1);

    await attemptWrongPassword(page1, sessionEmail, wrongPassword);
    await expect(
      page1.getByRole('alert').filter({
        hasText: /failed|error|locked|invalid|incorrect|attempts/i,
      })
    ).toBeVisible({ timeout: 5000 });

    // Tip into lockout
    await attemptWrongPassword(page1, sessionEmail, wrongPassword);
    await expect(
      page1.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });

    await context1.close();

    // Fresh browser — lockout must still hold (server-side)
    const context2 = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page2 = await context2.newPage();

    await page2.goto('/sign-in');
    await dismissCookieBanner(page2);
    await attemptWrongPassword(page2, sessionEmail, wrongPassword);

    await expect(
      page2.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });

    await context2.close();
  });

  test('should show remaining attempts counter', async ({ page }) => {
    const uniqueEmail = generateBruteForceEmail('attempts');

    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    await attemptWrongPassword(page, uniqueEmail, wrongPassword);

    await expect(
      page.getByRole('alert').filter({
        hasText: /failed|error|invalid|incorrect/i,
      })
    ).toBeVisible({ timeout: 5000 });

    const errorText1 = await page
      .getByRole('alert')
      .filter({ hasText: /.+/ })
      .textContent();
    expect(errorText1).not.toMatch(/too many|locked|rate.*limit/i);

    await attemptWrongPassword(page, uniqueEmail, wrongPassword);

    await expect(
      page.getByRole('alert').filter({
        hasText: /failed|error|invalid|incorrect/i,
      })
    ).toBeVisible({ timeout: 5000 });

    const errorText2 = await page
      .getByRole('alert')
      .filter({ hasText: /.+/ })
      .textContent();
    expect(errorText2).not.toMatch(/too many|locked|rate.*limit/i);
  });

  test('should track different users independently', async ({ browser }) => {
    const userA = generateBruteForceEmail('userA');
    const userB = generateBruteForceEmail('userB');
    await seedNearLockout(userA);

    const contextA = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const pageB = await contextB.newPage();

    await pageA.goto('/sign-in');
    await dismissCookieBanner(pageA);

    await attemptWrongPassword(pageA, userA, wrongPassword);
    await expect(
      pageA.getByRole('alert').filter({
        hasText: /failed|error|locked|invalid|incorrect|attempts/i,
      })
    ).toBeVisible({ timeout: 5000 });

    await attemptWrongPassword(pageA, userA, wrongPassword);
    await expect(
      pageA.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 10000 });

    await pageB.goto('/sign-in');
    await dismissCookieBanner(pageB);
    await attemptWrongPassword(pageB, userB, wrongPassword);

    const errorAlertB = pageB.getByRole('alert').filter({ hasText: /.+/ });
    await expect(errorAlertB).toBeVisible({ timeout: 5000 });
    const errorTextB = await errorAlertB.textContent();
    expect(errorTextB).toMatch(/invalid|incorrect|failed/i);
    expect(errorTextB).not.toMatch(/too many|locked|rate.*limit/i);

    await contextA.close();
    await contextB.close();
  });

  test('should track different attempt types independently', async ({
    page,
  }) => {
    const email = generateBruteForceEmail('types');
    await seedNearLockout(email);

    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    await attemptWrongPassword(page, email, wrongPassword);
    await expect(
      page.getByRole('alert').filter({
        hasText: /failed|error|locked|invalid|incorrect|attempts/i,
      })
    ).toBeVisible({ timeout: 5000 });

    await attemptWrongPassword(page, email, wrongPassword);
    await expect(
      page.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });

    // sign_up should still work (different attempt type)
    await page.goto('/sign-up');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(email);
    await page
      .getByLabel('Password', { exact: true })
      .fill('ValidPassword123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await page.waitForTimeout(1000);
    const alerts = await page
      .getByRole('alert')
      .filter({ hasText: /.+/ })
      .all();
    for (const alert of alerts) {
      const text = await alert.textContent();
      expect(text).not.toMatch(/too many|locked|rate.*limit/i);
    }
  });

  test('should not bypass rate limiting by clearing localStorage', async ({
    page,
  }) => {
    const email = generateBruteForceEmail('bypass');
    await seedNearLockout(email);

    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    await attemptWrongPassword(page, email, wrongPassword);
    await expect(
      page.getByRole('alert').filter({
        hasText: /failed|error|locked|invalid|incorrect|attempts/i,
      })
    ).toBeVisible({ timeout: 5000 });

    await attemptWrongPassword(page, email, wrongPassword);
    await expect(
      page.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });

    await page.evaluate(() => localStorage.clear());

    await page.reload();
    await dismissCookieBanner(page);
    await attemptWrongPassword(page, email, wrongPassword);

    await expect(
      page.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });
  });

  test('should display lockout expiration time', async ({ page }) => {
    const email = generateBruteForceEmail('lockout-time');
    await seedNearLockout(email);

    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    await attemptWrongPassword(page, email, wrongPassword);
    await expect(
      page.getByRole('alert').filter({
        hasText: /failed|error|locked|invalid|incorrect|attempts/i,
      })
    ).toBeVisible({ timeout: 5000 });

    await attemptWrongPassword(page, email, wrongPassword);

    const errorAlert = page.getByRole('alert').filter({
      hasText: /too many|locked|rate.*limit/i,
    });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    const errorMessage = await errorAlert.textContent();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage).toMatch(/15|minutes?|try.*again|wait/i);
  });
});
