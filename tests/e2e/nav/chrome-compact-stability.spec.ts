import { test, expect } from '@playwright/test';

// #185 regression: `chromeCompact` used to be measured from the brand element
// that `chromeCompact` itself resizes, so a signed-in user at 390px (iPhone
// 12/13/14/15) sat inside a feedback band -- row 378px vs needed 389 full /
// 365 compact -- and the header flickered every frame. The flag must settle.
test('header chrome-compact flag settles and stays settled (#185)', async ({
  page,
}) => {
  const loopErrors: string[] = [];
  const record = (text: string) => {
    if (text.includes('ResizeObserver loop')) loopErrors.push(text);
  };
  page.on('pageerror', (err) => record(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') record(msg.text());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const row = page.locator('[data-chrome-compact]').first();
  await expect(row).toBeVisible();
  await page.waitForTimeout(300);

  const settled = await row.getAttribute('data-chrome-compact');
  const samples: (string | null)[] = [];
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    samples.push(await row.getAttribute('data-chrome-compact'));
  }

  expect(samples.filter((v) => v !== settled)).toEqual([]);
  expect(loopErrors).toEqual([]);
});
