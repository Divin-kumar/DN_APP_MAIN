import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic touch-enabled Chromium, not physical iPhone Safari or VoiceOver.
// Multi-select comparisons are deliberately no longer offered in the compact
// new-rule editor. Previously saved Any of / None of conditions still render,
// can be edited, and must remain touch-accessible without a data migration.
test.use({ hasTouch: true, isMobile: true });

for (const [width, height] of [[320, 640], [390, 844], [430, 932], [844, 390]]) {
  test(`saved multi-value filters retain touch targets at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page);
    await page.goto('/financials/transactions');
    await page.evaluate(() => {
      // Write synthetic filter preferences only, never any source transactions.
      const key = `dn_list_state_guest_${encodeURIComponent('conditions:transactions')}`;
      localStorage.setItem(key, JSON.stringify({
        migrationVersion: 1,
        group: {
          id: 'root', kind: 'group', join: 'AND',
          children: [{
            id: 'legacy-payment-choice', kind: 'rule', field: 'paymentMethod',
            operator: 'any_of', value: ['Cash', 'Online'],
          }],
        },
      }));
    });
    await page.reload();
    await page.getByRole('button', { name: /^Filters and sort/ }).tap();
    const sheet = page.getByRole('dialog', { name: 'Transaction filters' });
    const before = await page.evaluate(() => ({
      records: ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map(key => localStorage.getItem(key)),
      lists: Object.fromEntries(Object.keys(localStorage)
        .filter(key => key.startsWith('dn_list_state_'))
        .sort().map(key => [key, localStorage.getItem(key)])),
    }));

    await expect(sheet.getByRole('button', { name: 'Remove Cash' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Remove Online' })).toBeVisible();
    const tokens = sheet.locator('.dn-condition-selected-values button');
    const boxes = await tokens.evaluateAll(nodes => nodes.map(node => ({
      height: node.getBoundingClientRect().height,
      text: parseFloat(getComputedStyle(node).fontSize),
    })));
    expect(boxes).toHaveLength(2);
    expect(boxes.every(box => box.height >= 44 && box.text >= 12)).toBe(true);
    await testInfo.attach(`filter-tokens-${width}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });

    await sheet.getByRole('button', { name: 'Remove Cash' }).tap();
    await expect(sheet.getByRole('button', { name: 'Remove Cash' })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Remove Online' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).tap();
    await expect(sheet).toHaveCount(0);
    const after = await page.evaluate(() => ({
      records: ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map(key => localStorage.getItem(key)),
      lists: Object.fromEntries(Object.keys(localStorage)
        .filter(key => key.startsWith('dn_list_state_'))
        .sort().map(key => [key, localStorage.getItem(key)])),
    }));
    expect(after).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
