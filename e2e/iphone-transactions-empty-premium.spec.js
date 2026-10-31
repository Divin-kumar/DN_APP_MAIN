import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// The list's own scroll surface remains intact; there is no Add Transaction CTA.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test('No-match recovery uses shared Refine state at ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/financials/transactions');
      const original = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      const rows = page.locator('.dn-financial-workspace .dn-transactions-results .dn-transaction-card');
      await expect(rows).toHaveCount(4);
      await page.getByRole('searchbox', { name: 'Search transactions' }).fill('unique-unmatched-text-999');
      const empty = page.locator('.dn-financial-workspace .dn-transactions-empty-premium');
      await expect(empty).toBeVisible();
      await expect(empty.getByText('No matching transactions')).toBeVisible();
      const reset = empty.getByRole('button', { name: 'Restore saved defaults' });
      await expect(reset).toBeVisible();
      const geometry = await empty.evaluate((node) => {
        const outer = node.getBoundingClientRect();
        const button = node.querySelector('button').getBoundingClientRect();
        const scroll = node.closest('.dn-transactions-results').getBoundingClientRect();
        const dock = document.querySelector('.mobile-tabbar').getBoundingClientRect();
        return { left: outer.left, right: outer.right, buttonHeight: button.height,
          documentWidth: document.documentElement.scrollWidth,
          listBottom: scroll.bottom, dockTop: dock.top };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(width + 1);
      expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);
      expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44);
      expect(geometry.listBottom).toBeLessThanOrEqual(geometry.dockTop - 4);
      await reset.click();
      await expect(rows).toHaveCount(4);
      await expect(empty).toHaveCount(0);
      await expect(page.getByRole('searchbox', { name: 'Search transactions' })).toHaveValue('');
      const refine = page.getByRole('button', { name: /^Filters and sort/ });
      await refine.click();
      await expect(page.locator('.dn-financial-workspace .dn-list-controls-summary')).toContainText('Newest first');
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(original);
      expect(errors).toEqual([]);
    });
  }
}

test('Truly empty Guest ledger gives a calm first-use message without an Add CTA', async ({ page }) => {
  const errors = await seedGuest(page, { moments: [], incomes: [], expenses: [] });
  await page.goto('/financials/transactions');
  const empty = page.locator('.dn-financial-workspace .dn-transactions-empty-premium');
  await expect(empty.getByText('No transactions yet')).toBeVisible();
  await expect(empty.getByText('Transactions you record will appear here.')).toBeVisible();
  await expect(empty.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Transaction' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
