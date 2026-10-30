import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Chromium geometry regression coverage. Native iPhone Safari still needs a
// device pass; these checks protect the shared Refine top row and dock clearance.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  test('Transactions Refine actions stay at top in one row above the dock at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height });
    const expenses = Array.from({ length: 24 }, (_, index) => ({
      id: 'refine-expense-' + index,
      name: 'Expense ' + index,
      amount: 100 + index,
      category: 'Other',
      date: '2026-10-' + String(1 + (index % 28)).padStart(2, '0'),
    }));
    const errors = await seedGuest(page, { moments: [], expenses });
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
    const panel = page.locator('.dn-financial-workspace .dn-list-controls-panel');
    const actions = panel.locator('.dn-list-controls-action-line');
    const field = actions.getByRole('combobox', { name: 'Sort transactions field' });
    const direction = actions.getByRole('button', { name: 'Sort ascending' });
    const reset = actions.getByRole('button', { name: 'Reset' });

    await expect(actions).toBeVisible();
    const actionAboveConditions = await panel.evaluate((node) => {
      const actions = node.querySelector('.dn-list-controls-action-line').getBoundingClientRect();
      const conditions = node.querySelector('.dn-list-controls-builder').getBoundingClientRect();
      return actions.bottom <= conditions.top + 1;
    });
    expect(actionAboveConditions).toBe(true);
    await expect(field).toBeVisible();
    await expect(direction).toContainText('Desc');
    await expect(reset).toBeVisible();
    const boxes = await Promise.all([field, direction, reset].map((item) => item.boundingBox()));
    expect(boxes.every(Boolean)).toBe(true);
    expect(Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y))).toBeLessThanOrEqual(5);
    expect(boxes[0].x + boxes[0].width).toBeLessThanOrEqual(boxes[1].x + 2);
    expect(boxes[1].x + boxes[1].width).toBeLessThanOrEqual(boxes[2].x + 2);
    expect(boxes[2].x + boxes[2].width).toBeLessThanOrEqual(width + 1);
    expect(boxes.every((box) => box.height >= 43)).toBe(true);

    await direction.click();
    await expect(actions.getByRole('button', { name: 'Sort descending' })).toContainText('Asc');
    await expect(page.locator('.dn-list-controls-summary')).toContainText('Oldest first');
    await reset.click();
    await expect(actions.getByRole('button', { name: 'Sort ascending' })).toContainText('Desc');
    await expect(page.locator('.dn-list-controls-summary')).toContainText('Newest first');

    geometry = await measure();
    expect(geometry.listBottom).toBeLessThanOrEqual(geometry.dockTop - 4);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);

    await refine.click();
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
