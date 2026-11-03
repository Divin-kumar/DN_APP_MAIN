import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Source-shared modal geometry checks. Synthetic Chromium is not iPhone Safari.
for (const [route, label] of [
  ['/financials/transactions', 'Transaction filters'],
  ['/events', 'Moment filters'],
  ['/activities', 'Activity filters'],
  ['/events/moment-one/activities', 'Activity filters'],
]) {
  for (const [width, height] of [[320, 640], [390, 844]]) {
    test(`Refine opens a compact, scroll-safe sheet for ${label} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page);
      await page.goto(route);
      const trigger = page.getByRole('button', { name: /^Filters and sort/ }).first();
      await expect(trigger).toBeVisible();
      await trigger.click();
      const sheet = page.getByRole('dialog', { name: label });
      await expect(sheet).toBeVisible();
      const sort = sheet.locator('.dn-refine-sort-chips');
      const footer = sheet.locator('.dn-list-controls-footer');
      await expect(sort).toBeVisible();
      await expect(sheet.locator('.dn-conditions')).toBeVisible();
      await expect(footer.getByRole('button', { name: 'Reset' })).toBeVisible();
      await expect(footer.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(footer.getByRole('button', { name: 'Show results' })).toBeVisible();
      const geometry = await page.evaluate(() => {
        const dialog = document.querySelector('.dn-modal.dn-refine-sheet');
        const rail = dialog.querySelector('.dn-refine-sort-chips');
        const footer = dialog.querySelector('.dn-list-controls-footer');
        const bounds = [dialog, rail, footer, ...rail.querySelectorAll('button')].map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, height: r.height };
        });
        return { width: document.documentElement.scrollWidth, bounds };
      });
      expect(geometry.width).toBeLessThanOrEqual(width + 1);
      const [dialog, rail, controls, ...chips] = geometry.bounds;
      expect(dialog.left).toBeGreaterThanOrEqual(-1);
      expect(dialog.right).toBeLessThanOrEqual(width + 1);
      expect(rail.left).toBeGreaterThanOrEqual(dialog.left - 1);
      expect(controls.right).toBeLessThanOrEqual(dialog.right + 1);
      expect(chips.length).toBeGreaterThanOrEqual(3);
      expect(chips.every(({ height }) => height >= 43.5)).toBe(true);

      const first = sort.getByRole('button').first();
      const before = await first.getAttribute('aria-label');
      await first.click();
      const after = await first.getAttribute('aria-label');
      expect(after).not.toBe(before); // Selected field reverses ascending/descending.
      await footer.getByRole('button', { name: 'Cancel' }).click();
      await expect(sheet).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}

test('selected chip does not create overlapping controls in the Refine footer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/events');
  await page.getByRole('button', { name: /^Filters and sort/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Moment filters' });
  const sort = sheet.locator('.dn-refine-sort-chips');
  const before = await sort.boundingBox();
  await sort.getByRole('button', { name: /^Sort by Name/ }).click();
  const after = await sort.boundingBox();
  expect(Math.abs(before.width - after.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(before.x - after.x)).toBeLessThanOrEqual(1);
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  expect(errors).toEqual([]);
});
