/**
 * Integration Test: Dashboard Real-Time Updates - T060
 * Tests Supabase realtime subscription for payment status updates.
 *
 * Every test here seeds rows with the service-role client and watches the
 * payment hub (/payment) react; no payment provider or credentials are needed.
 * Realtime features the hub does not have yet (reconnect UI, batched-update
 * pill, realtime error alert, trend chart) have no test here until they ship.
 */

import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  requireAdminClient,
  seedIsolatedPayment,
  deleteIsolatedPayment,
  openPaymentHubAs,
  seedIsolatedSubscription,
  deleteIsolatedSubscription,
  openSubscriptionsAs,
  type IsolatedPayment,
  type IsolatedSubscription,
} from '../utils/test-user-factory';

test.describe('Payment Dashboard Real-Time Updates', () => {
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

  test('should load payment demo page', async ({ page }) => {
    // Basic test - verify page loads
    await expect(
      page.getByRole('heading', { name: /Payment Integration Demo/i })
    ).toBeVisible();
  });

  test('should show payment history section after consent', async ({
    page,
  }) => {
    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();

    // Wait for Step 2 and Step 4 (Payment History) to appear
    await expect(page.getByRole('heading', { name: /Step 4/i })).toBeVisible({
      timeout: 5000,
    });

    // Payment History heading should be visible
    await expect(
      page.getByRole('heading', { name: /Payment History/i })
    ).toBeVisible();
  });

  test('should update payment list when new payment added', async ({
    browser,
  }) => {
    // Seed a throwaway user with one payment, open the hub Overview tab AS them,
    // then service-role insert a SECOND payment and assert the list grows live
    // (realtime → 1s debounce → refetch). No provider/creds needed.
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();

      opened = await openPaymentHubAs(browser, fixture.session);
      const { page } = opened;
      const count = page.getByTestId('transaction-count');
      await expect(count).toContainText('1 total', { timeout: 30000 });

      await fixture.addResult(); // live insert
      await expect(count).toContainText('2 total', { timeout: 15000 });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });

  test('should update webhook verification status in real-time', async ({
    browser,
  }) => {
    // The webhook is the only thing that sets webhook_verified, and what the
    // buyer sees is that column. Seed the row UNVERIFIED (what a redirect-only
    // payment looks like), open the hub as its owner, then do server-side what
    // the stripe-webhook function does - a service-role UPDATE - and assert the
    // indicator flips live. No provider involved.
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();
      const admin = requireAdminClient('06-realtime-dashboard');

      const unverify = await admin
        .from('payment_results')
        .update({ webhook_verified: false, verification_method: 'redirect' })
        .eq('id', fixture.resultId);
      expect(unverify.error).toBeNull();

      opened = await openPaymentHubAs(browser, fixture.session);
      const { page } = opened;
      const notVerified = page.locator('[aria-label="Webhook not verified"]');
      const verified = page.locator('[aria-label="Webhook verified"]');

      await expect(notVerified).toHaveCount(1, { timeout: 30000 });
      await expect(verified).toHaveCount(0);
      await expect(page.getByTestId('realtime-status')).toHaveText(/Live/i, {
        timeout: 30000,
      });

      const verify = await admin
        .from('payment_results')
        .update({ webhook_verified: true, verification_method: 'webhook' })
        .eq('id', fixture.resultId);
      expect(verify.error).toBeNull();

      await expect(verified).toHaveCount(1, { timeout: 15000 });
      await expect(notVerified).toHaveCount(0);
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });

  test('should handle subscription status changes in real-time', async ({
    browser,
  }) => {
    // Seed an active subscription, open the hub Subscriptions tab AS that user,
    // then service-role UPDATE the row to grace_period and assert the badge
    // flips live (useSubscriptionsRealtime → refetch).
    let fixture: IsolatedSubscription | null = null;
    let opened: Awaited<ReturnType<typeof openSubscriptionsAs>> | null = null;
    try {
      fixture = await seedIsolatedSubscription('active', {
        provider: 'stripe',
      });
      const admin = requireAdminClient('06-realtime-dashboard');

      opened = await openSubscriptionsAs(browser, fixture);
      const { page } = opened;
      await expect(page.getByText(/Active/i).first()).toBeVisible({
        timeout: 30000,
      });

      // Flip status server-side; the realtime subscription should refetch.
      const graceExpires = fixture.gracePeriodExpires ?? '2099-01-01';
      await admin
        .from('subscriptions')
        .update({ status: 'grace_period', grace_period_expires: graceExpires })
        .eq('id', fixture.subscriptionId);

      await expect(page.getByText(/Grace Period/i).first()).toBeVisible({
        timeout: 15000,
      });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedSubscription(fixture);
    }
  });

  test('should show live transaction counter', async ({ browser }) => {
    // The hub's PaymentHistory shows a `transaction-count` badge + a
    // `realtime-status` indicator. Seed a payment, open the hub, assert the
    // counter reads 1 and the realtime status reaches "Live".
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();

      opened = await openPaymentHubAs(browser, fixture.session);
      const { page } = opened;
      await expect(page.getByTestId('transaction-count')).toContainText(
        '1 total',
        { timeout: 30000 }
      );
      await expect(page.getByTestId('realtime-status')).toHaveText(/Live/i, {
        timeout: 30000,
      });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });

  test('should show a realtime connection-status indicator', async ({
    browser,
  }) => {
    // The hub surfaces the channel connection state via a `realtime-status`
    // badge. Assert it renders and reaches "Live" on a healthy connection.
    // (Simulating a true mid-session channel drop is out of scope; the badge is
    // the affordance a reconnection/offline UI would build on.)
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();

      opened = await openPaymentHubAs(browser, fixture.session);
      const status = opened.page.getByTestId('realtime-status');
      await expect(status).toBeVisible({ timeout: 30000 });
      await expect(status).toHaveText(/Live/i, { timeout: 30000 });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });
});
