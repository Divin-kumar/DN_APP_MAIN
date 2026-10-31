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


for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) for (const theme of ['dark', 'light']) {
  test('Story introduction opens without an unwanted phone keyboard at ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events/moment-one/overview');
    const introduction = page.getByRole('region', { name: 'Moment introduction' });
    const action = introduction.getByRole('button', { name: 'Add introduction' });
    await expect(action).toBeVisible();
    const target = await action.boundingBox();
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.x + target.width).toBeLessThanOrEqual(width + 1);
    const before = await page.evaluate(() => [
      'dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses',
    ].map((key) => localStorage.getItem(key)));

    await action.click();
    const dialog = page.getByRole('dialog', { name: 'Edit event notes' });
    const editor = dialog.getByRole('textbox', { name: 'Moment notes' });
    await expect(editor).toBeVisible();
    await expect(editor).not.toBeFocused();
    const size = await editor.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
    await editor.click();
    await expect(editor).toBeFocused();
    await editor.fill('Unsaved phone introduction draft');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const after = await page.evaluate(() => [
      'dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses',
    ].map((key) => localStorage.getItem(key)));
    expect(after).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('three canonical form surfaces keep defaults tucked away and reveal them on demand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  const openQuick = async (label) => {
    await page.getByRole('button', { name: 'Open quick create menu' }).click();
    await page.getByRole('group', { name: 'Quick create actions' }).getByRole('button', { name: label, exact: true }).click();
  };
  await page.goto('/events/moment-one/activities/shared');
  await openQuick('Activity');
  let dialog = page.getByRole('dialog', { name: 'Add an activity' });
  await expect(dialog.locator('.dn-activity-moment-disclosure > summary')).toContainText('Weekend in Ooty');
  await expect(dialog.locator('input[type="date"]')).toBeHidden();
  await expect(dialog.getByRole('textbox', { name: 'Entry title' })).toBeVisible();
  await dialog.locator('.dn-form-disclosure:not(.dn-activity-moment-disclosure) > summary').click();
  await expect(dialog.locator('input[type="date"]')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await openQuick('Life moment');
  dialog = page.getByRole('dialog', { name: 'Create a life moment' });
  await expect(dialog.getByRole('textbox', { name: 'Moment name' })).toBeVisible();
  await expect(dialog.locator('input[name="date"]')).toBeHidden();
  await dialog.locator('.dn-form-disclosure > summary').click();
  await expect(dialog.locator('input[name="date"]')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await openQuick('Transaction');
  dialog = page.getByRole('dialog', { name: 'Add Transaction' });
  await expect(dialog.getByRole('spinbutton', { name: 'Amount *' })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Linked Moment' })).toBeHidden();
  await dialog.locator('.dn-form-disclosure > summary').click();
  await expect(dialog.getByRole('combobox', { name: 'Linked Moment' })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Linked Activity' })).toContainText('Book a lakeside stay');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(errors).toEqual([]);
});
