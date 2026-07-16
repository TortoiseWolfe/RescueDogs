/**
 * Mobile Card Layout Test (T014)
 * PRP-017: Mobile-First Design Overhaul
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Wait for layout to stabilize after viewport change
 */
async function waitForLayoutStability(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for layout to stabilize
  await page.waitForFunction(
    () => {
      return new Promise((resolve) => {
        let stable = 0;
        const check = () => {
          stable++;
          if (stable >= 3) {
            resolve(true);
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    },
    { timeout: 5000 }
  );
}

test.describe('Mobile Card Layout', () => {
  test('Cards stack vertically on mobile (320px-767px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Scope to pet cards — `[class*="card"]` also matches card-body/title and
    // nests, which falsely fail a vertical-stack check (parent contains child).
    const cards = page.locator(
      'section[aria-labelledby="meet-pets-heading"] article.card'
    );
    await expect(cards).toHaveCount(3);

    const box1 = await cards.nth(0).boundingBox();
    const box2 = await cards.nth(1).boundingBox();

    expect(box1, 'First pet card should be visible').toBeTruthy();
    expect(box2, 'Second pet card should be visible').toBeTruthy();

    // Vertical stacking: second card should be below first
    expect(box2!.y, 'Cards should stack vertically on mobile').toBeGreaterThan(
      box1!.y + box1!.height - 10 // Allow small overlap for spacing
    );
  });

  test('Cards use grid layout on tablet (768px+)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const container = page.locator(
      'section[aria-labelledby="meet-pets-heading"] > div > .grid'
    );

    await expect(container).toBeVisible();
    const display = await container.evaluate(
      (el) => window.getComputedStyle(el).display
    );

    expect(display, 'Should use grid layout on tablet').toBe('grid');
  });

  test('Cards fit within viewport at all mobile widths', async ({ page }) => {
    const widths = [320, 390, 428];

    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);
      await waitForLayoutStability(page);

      const cards = page.locator(
        'section[aria-labelledby="meet-pets-heading"] article.card'
      );

      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        const box = await cards.nth(i).boundingBox();

        if (box) {
          expect(
            box.width,
            `Card width should not exceed ${width}px`
          ).toBeLessThanOrEqual(width + 1);
        }
      }
    }
  });
});
