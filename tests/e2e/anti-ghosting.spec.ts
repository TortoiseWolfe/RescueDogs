/**
 * THE anti-ghosting loop — the spec that defines done for the MVP.
 *
 * Two live browser contexts:
 *   A (adopter)       applies for a pet and watches the status tracker
 *   B (shelter staff) advances the application through the pipeline
 *
 * The core assertion: A's tracker updates WITHOUT a reload when B acts
 * (Supabase Realtime). Constitution Principle I: No One Gets Ghosted.
 *
 * Uses the demo seed accounts (supabase/seed-rescue-demo.sql), not the
 * shared storage-state test users — both contexts are created fresh.
 * Requires SUPABASE_SERVICE_ROLE_KEY for the pre-test cleanup that makes
 * the spec re-runnable (resets Noodle + the adopter's Noodle application).
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  dismissCookieBanner,
  performSignIn,
  getAdminClient,
} from './utils/test-user-factory';

const ADOPTER = { email: 'adopter@demo.test', password: 'DemoPass123!' };
const STAFF = { email: 'staff@demo.test', password: 'DemoPass123!' };

// Fixed UUIDs from supabase/seed-rescue-demo.sql
const ADOPTER_ID = '33333333-3333-3333-3333-333333333301';
const NOODLE_ID = '44444444-4444-4444-4444-444444444404';

test.describe('anti-ghosting loop', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300_000);

  let adopterContext: BrowserContext;
  let staffContext: BrowserContext;
  let adopterPage: Page;
  let staffPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Re-runnability: remove any previous run's application for Noodle and
    // make Noodle available again (approval flips pets.status to pending).
    // Best-effort: without SUPABASE_SERVICE_ROLE_KEY the spec still runs —
    // it just requires a clean slate (no prior Noodle application).
    const admin = getAdminClient();
    if (admin) {
      await admin
        .from('applications')
        .delete()
        .eq('adopter_id', ADOPTER_ID)
        .eq('pet_id', NOODLE_ID);
      await admin
        .from('pets')
        .update({ status: 'available' })
        .eq('id', NOODLE_ID);
    } else {
      console.warn(
        'anti-ghosting: no SUPABASE_SERVICE_ROLE_KEY — skipping pre-test cleanup; re-runs need a manual reset'
      );
    }

    adopterContext = await browser.newContext();
    staffContext = await browser.newContext();
    adopterPage = await adopterContext.newPage();
    staffPage = await staffContext.newPage();
  });

  test.afterAll(async () => {
    await adopterContext?.close();
    await staffContext?.close();
  });

  let applicationId: string;

  test('adopter applies and lands on a live tracker', async () => {
    await adopterPage.goto('/sign-in');
    await adopterPage.waitForLoadState('domcontentloaded');
    await dismissCookieBanner(adopterPage);
    const signIn = await performSignIn(
      adopterPage,
      ADOPTER.email,
      ADOPTER.password,
      { timeout: 30000 }
    );
    expect(signIn.success, `adopter sign-in: ${signIn.error}`).toBe(true);

    await adopterPage.goto(`/adopt?pet=${NOODLE_ID}`);
    await adopterPage.waitForLoadState('domcontentloaded');

    // Universal application: saved profile answers prefill the form
    const fullName = adopterPage.locator('[name="full_name"]');
    await expect(fullName).toHaveValue('Dana Adopter', { timeout: 20000 });

    // Pet preselected from the ?pet= param
    await expect(adopterPage.locator('[name="pet_id"]')).toHaveValue(NOODLE_ID);

    await adopterPage
      .locator('[name="why_this_pet"]')
      .fill('Noodle would complete our tiny-dog household.');

    await adopterPage
      .getByRole('button', { name: /submit application/i })
      .click();

    // Lands on the tracker with the new application id. The optional trailing
    // slash matters: the static export uses `trailingSlash: true`, so the real
    // URL is /applications/status/?id=… — without the `/?` the regex never
    // matches and waitForURL times out even though navigation succeeded.
    await adopterPage.waitForURL(/\/applications\/status\/?\?id=/, {
      timeout: 30000,
    });
    applicationId = new URL(adopterPage.url()).searchParams.get('id')!;
    expect(applicationId).toBeTruthy();

    await expect(
      adopterPage.getByRole('heading', { name: /application for noodle/i })
    ).toBeVisible({ timeout: 20000 });

    // Step 1 of the pipeline is current
    const submittedStep = adopterPage
      .locator('.steps .step')
      .filter({ hasText: 'Submitted' });
    await expect(submittedStep).toHaveClass(/step-primary/);
  });

  test('staff sees the application and advances it — tracker updates live', async () => {
    await staffPage.goto('/sign-in');
    await staffPage.waitForLoadState('domcontentloaded');
    await dismissCookieBanner(staffPage);
    const signIn = await performSignIn(staffPage, STAFF.email, STAFF.password, {
      timeout: 30000,
    });
    expect(signIn.success, `staff sign-in: ${signIn.error}`).toBe(true);

    // Pipeline dashboard shows Noodle's application
    await staffPage.goto('/shelter');
    await expect(
      staffPage.getByRole('heading', { name: /second chance rescue/i })
    ).toBeVisible({ timeout: 20000 });
    await expect(staffPage.getByText('Noodle').first()).toBeVisible({
      timeout: 20000,
    });

    // Open the detail page and advance: submitted -> under_review (with a note)
    await staffPage.goto(`/shelter/application?id=${applicationId}`);
    const statusSelect = staffPage.getByRole('combobox').first();
    await expect(statusSelect).toBeVisible({ timeout: 20000 });
    await statusSelect.selectOption({ label: 'Under Review' });
    await staffPage
      .locator('textarea')
      .first()
      .fill('Thanks! A volunteer is reading your application now.');
    await staffPage.getByRole('button', { name: /update status/i }).click();

    // THE anti-ghosting assertion: adopter's tracker advances WITHOUT reload
    const underReviewStep = adopterPage
      .locator('.steps .step')
      .filter({ hasText: 'Under Review' });
    await expect(underReviewStep).toHaveClass(/step-primary/, {
      timeout: 30000,
    });
    // The staff note reaches the adopter
    await expect(
      adopterPage.getByText(/a volunteer is reading your application/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test('staff approves — adopter sees the terminal state live', async () => {
    // under_review -> home_visit
    const statusSelect = staffPage.getByRole('combobox').first();
    await statusSelect.selectOption({ label: 'Home Visit' });
    await staffPage.getByRole('button', { name: /update status/i }).click();

    const homeVisitStep = adopterPage
      .locator('.steps .step')
      .filter({ hasText: 'Home Visit' });
    await expect(homeVisitStep).toHaveClass(/step-primary/, {
      timeout: 30000,
    });

    // home_visit -> approved (terminal: requires the inline confirm step)
    await statusSelect.selectOption({ label: 'Approved' });
    await staffPage.getByRole('button', { name: /update status/i }).click();
    await staffPage.getByRole('button', { name: /confirm/i }).click();

    // Adopter sees Approved as the final, successful step — no reload
    const approvedStep = adopterPage
      .locator('.steps .step')
      .filter({ hasText: 'Approved' });
    await expect(approvedStep).toHaveClass(/step-(success|primary)/, {
      timeout: 30000,
    });

    // Terminal state: the withdraw control is gone
    await expect(
      adopterPage.getByRole('button', { name: /withdraw application/i })
    ).toHaveCount(0);
  });
});
