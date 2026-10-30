import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Chromium can verify editor font size and user-intent focus, but cannot prove
// the exact Safari virtual keyboard position or installed-PWA zoom behavior.
for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'dark'], [430, 932, 'light']]) {
  test('iPhone Moment and Transaction sheets preserve editable inputs and Guest records at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events');
    const saved = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));

    await page.getByRole('button', { name: 'Open quick create menu', exact: true }).click();
    await page.getByRole('button', { name: 'Life moment', exact: true }).click();
    const moment = page.getByRole('dialog', { name: 'Create a life moment', exact: true });
    const momentName = moment.getByRole('textbox', { name: 'Moment name', exact: true });
    await expect(momentName).toBeVisible();
    await expect(momentName).not.toBeFocused();
    const verifyFields = async (dialog) => {
      const metrics = await dialog.locator('input:not([type="radio"]):not([type="checkbox"]), textarea, [contenteditable="true"]').evaluateAll(
        (nodes) => nodes.filter((node) => node.getClientRects().length).map((node) => ({
          tag: node.tagName, type: node.getAttribute('type') || '',
          size: parseFloat(getComputedStyle(node).fontSize),
        })),
      );
      expect(metrics.length).toBeGreaterThan(0);
      for (const metric of metrics) expect(metric.size, metric.tag + ' ' + metric.type + ' mobile font size').toBeGreaterThanOrEqual(16);
      const close = await dialog.getByRole('button', { name: 'Close dialog', exact: true }).boundingBox();
      // Chromium can report a fractional px below the declared 44px size
      // while Framer Motion scales the modal into place.
      expect(close.width).toBeGreaterThanOrEqual(43.95);
      expect(close.height).toBeGreaterThanOrEqual(43.95);
    };
    await verifyFields(moment);
    await momentName.click();
    await expect(momentName).toBeFocused();
    await momentName.fill('Draft not saved on phone');
    await moment.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(moment).toHaveCount(0);

    await page.goto('/financials/transactions');
    await page.getByRole('button', { name: 'Open quick create menu', exact: true }).click();
    await page.getByRole('button', { name: 'Transaction', exact: true }).click();
    const transaction = page.getByRole('dialog', { name: 'Add Transaction', exact: true });
    const amount = transaction.getByRole('spinbutton', { name: 'Amount *', exact: true });
    await expect(amount).toBeVisible();
    await expect(amount).not.toBeFocused();
    await verifyFields(transaction);
    await amount.click();
    await amount.fill('124.50');
    await expect(amount).toBeFocused();
    await transaction.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(transaction).toHaveCount(0);

    const after = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    expect(after).toEqual(saved);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
