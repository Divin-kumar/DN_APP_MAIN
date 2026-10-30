import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Three-column amounts and the direct Add Transaction action share the same
// no-write Guest fixture across narrow iPhone layouts and both app themes.
for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'light'], [430, 932, 'dark']]) {
  test('iPhone Finance totals and direct transaction entry fit at ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/financials/transactions');
    const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));

    const metrics = page.locator('.dn-finance-summary-grid .dn-finance-metric');
    await expect(metrics).toHaveCount(3);
    for (const name of ['Income', 'Expense', 'Balance']) {
      await expect(page.locator('.dn-finance-metric-heading').filter({ hasText: name })).toBeVisible();
    }
    const positions = await metrics.evaluateAll((nodes) => nodes.map((node) => ({
      top: node.getBoundingClientRect().top,
      left: node.getBoundingClientRect().left,
      right: node.getBoundingClientRect().right,
    })));
    expect(Math.max(...positions.map((x) => x.top)) - Math.min(...positions.map((x) => x.top))).toBeLessThanOrEqual(1);
    expect(positions[0].right).toBeLessThanOrEqual(positions[1].left + 1);
    expect(positions[1].right).toBeLessThanOrEqual(positions[2].left + 1);

    const heading = page.locator('.dn-transactions-page .transactions-heading');
    await expect(heading.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
    const caption = heading.locator('.dn-transactions-heading-description');
    await expect(caption).toHaveText('All income and expenses');
    const textMetrics = await caption.evaluate((node) => ({
      nowrap: getComputedStyle(node).whiteSpace === 'nowrap',
      full: node.scrollWidth <= node.clientWidth + 1,
    }));
    expect(textMetrics.nowrap).toBe(true);
    expect(textMetrics.full).toBe(true);

    const add = heading.getByRole('button', { name: 'Add Transaction', exact: true });
    const size = await add.boundingBox();
    expect(size.height).toBeGreaterThanOrEqual(43.95);
    expect(size.width).toBeGreaterThanOrEqual(44);
    await add.click();

    const dialog = page.getByRole('dialog', { name: 'Add Transaction', exact: true });
    await expect(dialog.getByRole('combobox', { name: 'Transaction Type', exact: true })).toBeVisible();
    const amount = dialog.getByRole('spinbutton', { name: 'Amount *', exact: true });
    await expect(amount).not.toBeFocused();
    await amount.fill('245');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    const after = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    expect(after).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
