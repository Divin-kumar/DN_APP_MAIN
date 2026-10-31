import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// CHG-224: only the shared app shell owns the five-position iPhone dock.
// These journeys cover both themes, short/tall screens, page state, and the
// existing universal create forms without touching Guest business records.
for (const [width, height] of [[320, 640], [375, 667], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`premium five-slot iPhone dock remains centered and usable at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard');

      const dock = page.getByRole('navigation', { name: 'Main navigation' });
      await expect(dock).toBeVisible();
      await expect(dock.locator(':scope > *')).toHaveCount(5);
      const destinations = [
        ['Dashboard', '/dashboard'],
        ['Activities', '/activities'],
        ['Moments', '/events'],
        ['Transactions', '/financials/transactions'],
      ];
      for (const [label, path] of destinations) {
        const item = dock.getByRole('link', { name: label, exact: true });
        await expect(item).toHaveAttribute('href', path);
        await expect(item).toBeVisible();
        await item.click();
        await expect(page).toHaveURL(new RegExp(path.replaceAll('/', '\\/') + '$'));
        await expect(item).toHaveAttribute('aria-current', 'page');
        await expect(dock.locator('.mobile-tab-active')).toHaveCount(1);
      }

      const geometry = await dock.evaluate((nav) => {
        const rect = nav.getBoundingClientRect();
        const slots = [...nav.children].map((node) => node.getBoundingClientRect());
        const plus = nav.querySelector('.mobile-dock-create-trigger').getBoundingClientRect();
        return {
          left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width,
          centers: slots.map((slot) => slot.left + slot.width / 2),
          plusCenter: plus.left + plus.width / 2,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width + 1);
      expect(geometry.bottom).toBeLessThanOrEqual(height + 1);
      expect(Math.abs(geometry.plusCenter - (geometry.left + geometry.right) / 2)).toBeLessThan(2);
      expect(Math.abs(geometry.centers[2] - geometry.plusCenter)).toBeLessThan(2);

      const originals = await page.evaluate(() =>
        ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
          .map((key) => localStorage.getItem(key)));
      const create = dock.getByRole('button', { name: 'Open quick create menu' });
      await create.click();
      await expect(dock.getByRole('button', { name: 'Close quick create menu' })).toHaveAttribute('aria-expanded', 'true');
      const menu = dock.getByRole('group', { name: 'Quick create actions' });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Life moment' })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Activity' })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Transaction' })).toBeVisible();
      const menuRect = await menu.boundingBox();
      const dockRect = await dock.boundingBox();
      expect(menuRect.x).toBeGreaterThanOrEqual(0);
      expect(menuRect.x + menuRect.width).toBeLessThanOrEqual(width + 1);
      expect(menuRect.y + menuRect.height).toBeLessThan(dockRect.y + 5);

      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(dock.getByRole('button', { name: 'Open quick create menu' })).toBeFocused();
      await create.click();
      await menu.getByRole('button', { name: 'Transaction', exact: true }).click();
      const transactionDialog = page.getByRole('dialog', { name: 'Add Transaction' });
      await expect(transactionDialog).toBeVisible();
      await transactionDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(transactionDialog).toHaveCount(0);
      expect(await page.evaluate(() =>
        ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
          .map((key) => localStorage.getItem(key)))).toEqual(originals);
      expect(errors).toEqual([]);
    });
  }
}

test('Transactions retains its own nested scroll area above the new dock', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto('/financials/transactions');
  const dock = page.getByRole('navigation', { name: 'Main navigation' });
  const results = page.locator('.dn-transactions-results');
  await expect(results).toBeVisible();
  const metrics = page.locator('.dn-finance-summary');
  await expect(metrics).toBeVisible();
  await expect(dock.getByRole('link', { name: 'Transactions' })).toHaveAttribute('aria-current', 'page');
  const placement = await page.evaluate(() => {
    const results = document.querySelector('.dn-transactions-results').getBoundingClientRect();
    const nav = document.querySelector('.dn-premium-dock').getBoundingClientRect();
    return { listBottom: results.bottom, dockTop: nav.top,
      documentWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth };
  });
  expect(placement.listBottom).toBeLessThanOrEqual(placement.dockTop + 2);
  expect(placement.documentWidth).toBeLessThanOrEqual(placement.viewportWidth + 1);
  expect(errors).toEqual([]);
});

test.describe('short touch-enabled iPhone landscape dock', () => {
  test.use({ hasTouch: true });
  for (const [width, height] of [[844, 390], [932, 430]]) {
    test(`keeps the centered five-slot dock after rotating to ${width}x${height}`, async ({ page }) => {
      const errors = await seedGuest(page, { theme: 'dark' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/activities');
      await page.setViewportSize({ width, height });
      const dock = page.getByRole('navigation', { name: 'Main navigation' });
      await expect(dock).toBeVisible();
      await expect(dock.locator(':scope > *')).toHaveCount(5);
      await expect(dock.getByRole('link', { name: 'Activities' })).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.dn-sidebar')).toBeHidden();
      const layout = await dock.evaluate((nav) => {
        const rect = nav.getBoundingClientRect();
        const plus = nav.querySelector('.mobile-dock-create-trigger').getBoundingClientRect();
        return {
          left: rect.left, right: rect.right, bottom: rect.bottom,
          center: rect.left + rect.width / 2,
          plusCenter: plus.left + plus.width / 2,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(width + 1);
      expect(layout.bottom).toBeLessThanOrEqual(height + 1);
      expect(Math.abs(layout.center - layout.plusCenter)).toBeLessThan(2);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      await dock.getByRole('button', { name: 'Open quick create menu' }).click();
      await expect(dock.getByRole('group', { name: 'Quick create actions' })).toBeVisible();
      await page.keyboard.press('Escape');
      await dock.getByRole('link', { name: 'Transactions' }).click();
      await expect(dock.getByRole('link', { name: 'Transactions' })).toHaveAttribute('aria-current', 'page');
      const results = page.locator('.dn-transactions-results');
      await expect(results).toBeVisible();
      const bounds = await page.evaluate(() => ({
        listBottom: document.querySelector('.dn-transactions-results').getBoundingClientRect().bottom,
        navTop: document.querySelector('.dn-premium-dock').getBoundingClientRect().top,
      }));
      expect(bounds.listBottom).toBeLessThanOrEqual(bounds.navTop + 2);
      expect(errors).toEqual([]);
    });
  }
});
