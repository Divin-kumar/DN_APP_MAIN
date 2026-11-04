import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic touch-enabled Chromium, not physical iPhone Safari or VoiceOver.
test.use({ hasTouch: true, isMobile: true });
for (const [width, height] of [[320, 640], [390, 844], [430, 932], [844, 390]]) {
  test(`multi-value filter choices retain touch targets at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page);
    await page.goto('/financials/transactions');
    await page.getByRole('button', { name: /^Filters and sort/ }).tap();
    const sheet = page.getByRole('dialog', { name: 'Transaction filters' });
    // First-visit saved default migration may legitimately write a list key.
    const before = await page.evaluate(() => ({
      records: ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k => localStorage.getItem(k)),
      lists: Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('dn_list_state_'))
        .sort().map(k=>[k,localStorage.getItem(k)])),
    }));
    await sheet.getByRole('button', { name: 'Add filter' }).tap();
    await sheet.getByRole('combobox', { name: 'Filter by' }).tap();
    await page.getByRole('option', { name: 'Payment method', exact: true }).tap();
    await sheet.getByRole('combobox', { name: 'Comparison' }).tap();
    await page.getByRole('option', { name: 'Any of', exact: true }).tap();
    const picker = sheet.getByRole('combobox', { name: 'Value for Payment method' });
    await picker.tap();
    await page.getByRole('option', { name: 'Cash', exact: true }).tap();
    await picker.tap();
    await page.getByRole('option', { name: 'Online', exact: true }).tap();
    const tokens = sheet.locator('.dn-condition-selected-values button');
    await expect(tokens).toHaveCount(2);
    const boxes = await tokens.evaluateAll(nodes => nodes.map(node => ({
      height: node.getBoundingClientRect().height,
      text: parseFloat(getComputedStyle(node).fontSize),
    })));
    expect(boxes.every(box => box.height >= 44 && box.text >= 12)).toBe(true);
    await testInfo.attach(`filter-tokens-${width}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await sheet.getByRole('button', { name: 'Remove Cash' }).tap();
    await expect(sheet.getByRole('button', { name: 'Remove Cash' })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Remove Online' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).tap();
    const after = await page.evaluate(() => ({
      records: ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k => localStorage.getItem(k)),
      lists: Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('dn_list_state_'))
        .sort().map(k=>[k,localStorage.getItem(k)])),
    }));
    expect(after).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
