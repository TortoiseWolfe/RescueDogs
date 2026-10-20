/**
 * Integration Test: One-Time Payment (Stripe) - T055
 * Tests Stripe payment UI and consent flow
 *
 * The hosted Stripe Checkout page cannot be driven from CI, so the checkout
 * test stops at our own boundary: it mocks the create-stripe-checkout edge
 * function and asserts the request the app sends. The declined-card and
 * cancelled-checkout cases happen on Stripe's page (declined) or have no
 * notice in the app yet (cancelled, see #478), so they have no test here.
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

test.describe('Stripe One-Time Payment Flow', () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    // storage-state-auth.json already carries a valid Supabase session.
    // Direct nav avoids the /sign-in hop; auth-hydration race handled by retry.
    await page.goto('/payment-demo', { waitUntil: 'networkidle' });
    if (page.url().includes('/sign-in')) {
      await page.waitForTimeout(3000);
      await page.goto('/payment-demo', { waitUntil: 'networkidle' });
    }
    await dismissCookieBanner(page);

    await page
      .getByRole('heading', { name: /Step [12]|GDPR Consent/i })
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });

    await page.evaluate(() => {
      localStorage.removeItem('payment_consent');
      localStorage.removeItem('payment_consent_date');
      localStorage.removeItem('gdpr_consent');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await dismissCookieBanner(page);

    await page
      .getByRole('heading', { name: /Step [12]|GDPR Consent/i })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  test('should create a payment intent and call create-stripe-checkout', async ({
    page,
  }) => {
    // Hosted Checkout is Stripe's page; we stop at the edge-function call.
    // The mock returns a fake session, so Stripe.js's redirect then fails and
    // the app stays on /payment-demo, which is what keeps this deterministic.
    await page.route(
      '**/functions/v1/create-stripe-checkout',
      async (route) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-origin': '*',
              'access-control-allow-headers': '*',
              'access-control-allow-methods': 'POST, OPTIONS',
            },
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ sessionId: 'cs_test_e2e_not_a_session' }),
        });
      }
    );

    await page.getByRole('button', { name: /Accept/i }).click();
    await page
      .getByRole('heading', { name: /Step 2/i })
      .waitFor({ timeout: 5000 });

    await page
      .getByRole('tab', { name: /stripe/i })
      .first()
      .click();
    const request = page.waitForRequest(
      (r) =>
        r.url().includes('/functions/v1/create-stripe-checkout') &&
        r.method() === 'POST',
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: /Pay \$20\.00/i }).click();
    const sent = await request;
    const body = sent.postDataJSON() as { payment_intent_id?: string };
    const hasAuth = !!(await sent.allHeaders())['authorization'];

    // The id sent is the payment_intents row the app just inserted.
    expect(body.payment_intent_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(hasAuth).toBe(true);
  });

  test('should enforce payment consent requirement', async ({ page }) => {
    // The GDPR consent section should be visible first
    await expect(
      page.getByRole('heading', { name: /GDPR Consent/i })
    ).toBeVisible();

    // Payment buttons should not be visible until consent is granted
    // (they're in Step 2 which is hidden until Step 1 consent is completed)
    const step2 = page.getByRole('heading', { name: /Step 2/i });
    await expect(step2).not.toBeVisible();
  });

  test('should show payment options after granting consent', async ({
    page,
  }) => {
    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();

    // Wait for Step 2 to appear
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible({
      timeout: 5000,
    });

    // Provider tabs should be visible (use .first() as there are multiple payment sections)
    await expect(
      page.getByRole('tab', { name: /stripe/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: /paypal/i }).first()
    ).toBeVisible();

    // Payment buttons should be visible (but may be disabled without API keys)
    await expect(
      page.getByRole('button', { name: /Pay \$20\.00/i })
    ).toBeVisible();
  });

  test('should allow selecting different payment providers', async ({
    page,
  }) => {
    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page
      .getByRole('heading', { name: /Step 2/i })
      .waitFor({ timeout: 5000 });

    // Select Stripe tab
    const stripeTab = page.getByRole('tab', { name: /stripe/i }).first();
    await stripeTab.click();
    await expect(stripeTab).toHaveClass(/tab-active/);

    // Select PayPal tab
    const paypalTab = page.getByRole('tab', { name: /paypal/i }).first();
    await paypalTab.click();
    await expect(paypalTab).toHaveClass(/tab-active/);
  });
});
