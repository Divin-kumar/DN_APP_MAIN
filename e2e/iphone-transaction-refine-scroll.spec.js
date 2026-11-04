import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Chromium geometry regression coverage. Native iPhone Safari still needs a
// device pass; these checks protect the shared Refine top row and dock clearance.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  test('Transactions Refine stays readable and applies sorting only when confirmed at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height });
    const expenses = Array.from({ length: 24 }, (_, index) => ({
      id: 'refine-expense-' + index,
      name: 'Expense ' + index,
      amount: 100 + index,
      category: 'Other',
      date: '2026-10-' + String(1 + (index % 28)).padStart(2, '0'),
    }));
    const errors = await seedGuest(page, { moments: [], incomes: [], expenses });
    await page.goto('/financials/transactions');

    const results = page.locator('.dn-financial-workspace .dn-transactions-results');
    const dock = page.locator('.mobile-tabbar');
    await expect(results.locator('.dn-transaction-card')).toHaveCount(24);
    await expect(dock).toBeVisible();

    const measure = async () => page.evaluate(() => {
      const list = document.querySelector('.dn-financial-workspace .dn-transactions-results');
      const dock = document.querySelector('.mobile-tabbar');
      const listRect = list.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      return {
        listTop: listRect.top,
        listBottom: listRect.bottom,
        listHeight: listRect.height,
        dockTop: dockRect.top,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    let geometry = await measure();
    expect(geometry.listHeight).toBeGreaterThan(30);
    expect(geometry.listBottom).toBeLessThanOrEqual(geometry.dockTop - 4);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);

    const refine = page.getByRole('button', { name: /^Filters and sort/ });
    await refine.click();
    const sheet = page.locator('.dn-refine-sheet');
    const sort = sheet.locator('.dn-refine-sort-chips');
    const footer = sheet.locator('.dn-list-controls-footer');
    await expect(sheet).toBeVisible();
    await expect(sort.getByRole('button')).toHaveCount(3);
    await expect(sheet.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Show results' })).toBeVisible();
    const positions = await sheet.evaluate((root) => {
      const sort = root.querySelector('.dn-refine-sort-chips').getBoundingClientRect();
      const conditions = root.querySelectorAll('.dn-refine-sheet-section')[1].getBoundingClientRect();
      const footer = root.querySelector('.dn-list-controls-footer').getBoundingClientRect();
      const dialog = root.getBoundingClientRect();
      return { sortBottom:sort.bottom, conditionsTop:conditions.top, footerBottom:footer.bottom,
        dialogBottom:dialog.bottom, dialogLeft:dialog.left, dialogRight:dialog.right,
        pageWidth:document.documentElement.scrollWidth };
    });
    expect(positions.sortBottom).toBeLessThanOrEqual(positions.conditionsTop + 1);
    expect(positions.footerBottom).toBeLessThanOrEqual(positions.dialogBottom + 1);
    expect(positions.dialogLeft).toBeGreaterThanOrEqual(-1);
    expect(positions.dialogRight).toBeLessThanOrEqual(width + 1);
    expect(positions.pageWidth).toBeLessThanOrEqual(width + 1);
    const selected = sort.locator('button[aria-pressed="true"]');
    await expect(selected).toHaveAttribute('aria-label', /descending/);
    await selected.click();
    await expect(sort.locator('button[aria-pressed="true"]')).toHaveAttribute('aria-label', /ascending/);
    // Cancel discards the entire draft, including the sort direction.
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.dn-list-controls-summary')).toContainText('Newest first');
    await refine.click();
    await expect(sheet.locator('button[aria-pressed="true"]')).toHaveAttribute('aria-label', /descending/);
    await sheet.locator('button[aria-pressed="true"]').click();
    await sheet.getByRole('button', { name: 'Show results' }).click();
    await expect(page.locator('.dn-list-controls-summary')).toContainText('Oldest first');
    await refine.click();
    await sheet.getByRole('button', { name: 'Reset', exact: true }).click();
    await sheet.getByRole('button', { name: 'Show results' }).click();
    await expect(page.locator('.dn-list-controls-summary')).toContainText('Newest first');
    geometry = await measure();
    expect(geometry.listBottom).toBeLessThanOrEqual(geometry.dockTop - 4);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);
    const scrolled = await results.evaluate((node) => {
      const before = node.scrollTop;
      node.scrollTop = node.scrollHeight;
      return { before, after: node.scrollTop, canScroll: node.scrollHeight > node.clientHeight };
    });
    expect(scrolled.canScroll).toBe(true);
    expect(scrolled.after).toBeGreaterThan(scrolled.before);
    expect(errors).toEqual([]);
  });
}
