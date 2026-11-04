import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Filter & Sort defaults have a dedicated route. Old Code Lists bookmarks
// must redirect to the new page without changing Guest records.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`Saved List defaults shortcut reaches its section at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/settings');
      const originals = await page.evaluate(() =>
        ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
          .map((key) => localStorage.getItem(key)));
      const shortcut = page.getByRole('link', { name: 'Open List defaults' });
      await expect(shortcut).toHaveAttribute('href', '/settings/list-defaults');
      await shortcut.click();
      await expect(page).toHaveURL(/\/settings\/list-defaults$/);
      const section = page.locator('#list-order');
      await expect(section.getByRole('heading', { name: 'List defaults' })).toBeVisible();
      await expect(section).toBeInViewport();
      const layout = await page.evaluate(() => {
        const pane = document.querySelector('.dn-content');
        const section = document.getElementById('list-order');
        const bounds = section.getBoundingClientRect();
        return { paneTop: pane.getBoundingClientRect().top,
          paneBottom: pane.getBoundingClientRect().bottom,
          top: bounds.top, bottom: bounds.bottom,
          paneScrollTop: pane.scrollTop,
          documentWidth: document.documentElement.scrollWidth };
      });
      expect(layout.paneScrollTop).toBeGreaterThanOrEqual(0);
      expect(layout.top).toBeLessThan(layout.paneBottom);
      expect(layout.bottom).toBeGreaterThan(layout.paneTop);
      expect(layout.documentWidth).toBeLessThanOrEqual(width + 1);
      await page.locator('.dn-header').getByRole('link', { name: 'Back to Settings' }).click();
      await expect(page).toHaveURL(/\/settings$/);
      expect(await page.evaluate(() =>
        ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
          .map((key) => localStorage.getItem(key)))).toEqual(originals);
      expect(errors).toEqual([]);
    });

    test(`Old Code Lists defaults bookmark redirects to its own page at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/settings/code-lists#list-order');
      await expect(page).toHaveURL(/\/settings\/list-defaults$/);
      await expect(page.locator('#list-order')).toBeInViewport();
      await expect(page.getByRole('heading', { name: 'List defaults', level: 1 })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test('Reset all settings discloses saved list-default loss before confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/settings');
  const before = await page.evaluate(() =>
    ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
  await page.getByRole('button', { name: 'Reset all settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset all settings?' });
  await expect(dialog.getByText('Saved default sorting and filters for Moments, Activities and Transactions')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() =>
    ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)))).toEqual(before);
  expect(errors).toEqual([]);
});
