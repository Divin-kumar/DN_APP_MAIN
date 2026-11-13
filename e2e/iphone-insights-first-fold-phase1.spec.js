import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { seedGuest } from './fixtures.js';

// Chromium geometry catches regressions but does not prove installed iPhone Safari.
for (const [width, height] of [[320,640],[390,844],[430,932]]) for (const theme of ['dark','light']) {
  test('Insights first fold and milestone search '+width+'px '+theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/insights');
    const before = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    const heading = page.locator('.dn-header');
    await expect(heading.getByRole('heading', { name:'Insights', exact:true })).toBeVisible();
    await expect(page.locator('.insights-page > .insights-heading')).toHaveCount(0);
    const exportAction = page.locator('.insights-discovery').getByRole('button', { name:'Export Insights data' });
    await expect(exportAction).toBeVisible();
    const discovery = page.locator('.insights-page > .insights-discovery');
    const field = page.locator('.dn-command-controls').getByRole('searchbox', { name:'Search milestones in Insights' });
    await expect(field).toBeVisible();
    const metrics = page.locator('.insights-metric-grid > .insight-metric');
    await expect(metrics).toHaveCount(4);
    const sizes = await page.evaluate(() => {
      const header = document.querySelector('.dn-header');
      const title = header.querySelector('h1').getBoundingClientRect();
      const exportRect = document.querySelector('.insights-discovery .insights-export').getBoundingClientRect();
      const search = document.querySelector('.dn-command-controls input').getBoundingClientRect();
      const tiles = [...document.querySelectorAll('.insights-metric-grid > .insight-metric')].map(node => {
        const box = node.getBoundingClientRect(), value = node.querySelector('strong').getBoundingClientRect();
        const detail = node.querySelector('small').getBoundingClientRect();
        return { left:box.left, right:box.right, top:box.top, height:box.height,
          valueRight:value.right, detailRight:detail.right, font:parseFloat(getComputedStyle(node.querySelector('strong')).fontSize) };
      });
      return { titleTop:title.top, exportTop:exportRect.top, exportWidth:exportRect.width,
        exportHeight:exportRect.height, searchTop:search.top,
        inputFont:parseFloat(getComputedStyle(document.querySelector('.dn-command-controls input')).fontSize),
        tiles, scrollWidth:document.documentElement.scrollWidth };
    });
    expect(sizes.titleTop).toBeLessThan(sizes.exportTop);
    expect(sizes.exportWidth).toBeGreaterThanOrEqual(44);
    expect(sizes.exportHeight).toBeGreaterThanOrEqual(43.9);
    expect(sizes.searchTop).toBeGreaterThan(sizes.exportTop);
    expect(sizes.inputFont).toBeGreaterThanOrEqual(16);
    expect(sizes.scrollWidth).toBeLessThanOrEqual(width + 1);
    for (const tile of sizes.tiles) {
      expect(tile.left).toBeGreaterThanOrEqual(-1);
      expect(tile.right).toBeLessThanOrEqual(width + 1);
      expect(tile.height).toBeLessThan(180);
      expect(tile.valueRight).toBeLessThanOrEqual(tile.right + 1);
      expect(tile.detailRight).toBeLessThanOrEqual(tile.right + 1);
      expect(tile.font).toBeGreaterThanOrEqual(15);
    }
    expect(Math.abs(sizes.tiles[0].top - sizes.tiles[1].top)).toBeLessThanOrEqual(1);
    expect(Math.abs(sizes.tiles[2].top - sizes.tiles[3].top)).toBeLessThanOrEqual(1);
    await expect(metrics.nth(0)).toContainText('Life moments');
    await expect(metrics.nth(3)).toContainText('Net flow');
    await expect(metrics.nth(3).locator('strong')).toContainText('₹');
    await expect(discovery.locator('.dn-list-controls-summary')).toContainText('Milestone lists only');
    await field.fill('Weekend');
    await expect(discovery.locator('.dn-list-controls-context')).toContainText('1 milestone shown');
    await expect(discovery.locator('.dn-list-controls-summary')).toContainText('Milestone lists only');
    await expect(page.locator('.dn-command-controls').getByRole('button', { name:'Clear search' })).toBeVisible();
    await page.locator('.dn-command-controls').getByRole('button', { name:'Clear search' }).click();
    await expect(field).toHaveValue('');
    expect(await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map((key) => localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('Insights Export is still a complete JSON report and does not alter Guest records', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/insights');
  const before = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
    .map((key) => localStorage.getItem(key)));
  await page.getByRole('searchbox', { name: 'Search milestones in Insights' }).fill('Weekend');
  await expect(page.locator('.milestone-row')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name:'Export Insights data' }).click();
  const report = await download;
  expect(report.suggestedFilename()).toMatch(/^dn-insights-\d{4}-\d{2}-\d{2}\.json$/);
  const content = JSON.parse(await readFile(await report.path(), 'utf8'));
  expect(content.overview).toHaveProperty('events',2);
  expect(content.incomes).toHaveLength(1);
  // Export includes the nested-only expense in the reconciled Guest ledger.
  expect(content.expenses).toHaveLength(3);
  expect(content.expenses.map((item) => item.id).sort()).toEqual(['duplicate','nested-only','other']);
  expect(await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
    .map((key) => localStorage.getItem(key)))).toEqual(before);
  expect(errors).toEqual([]);
});

for (const [width, height, theme] of [[320, 640, 'dark'], [430, 932, 'light'], [1280, 800, 'dark']]) {
  test(`Insights displays complete milestone names and large category amounts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const category = 'Home and family essentials with a long category name';
    const amount = 1234567;
    const date = new Date();
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    const errors = await seedGuest(page, {
      theme,
      expenses: [{ id: 'large-expense', name: 'Home expenses', category, amount, date: month }],
    });
    await page.goto('/insights');
    const milestone = page.locator('.milestone-row strong').first();
    await expect(milestone).toHaveText('Weekend in Ooty — family plans and memories');
    const spending = page.locator('.category-insight-row').filter({ hasText: category });
    const categoryValue = spending.locator('strong');
    await expect(categoryValue).toHaveText('₹12,34,567');
    const totals = page.locator('.financial-insight-totals');
    await expect(totals.locator('strong').nth(1)).toHaveText('₹12,35,586');

    expect(await milestone.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('normal');
    const layout = await spending.evaluate((row) => {
      const [label, bar, value] = row.children;
      const rowRect = row.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const valueRect = value.getBoundingClientRect();
      return {
        overlapsValue: labelRect.right > valueRect.left + 1,
        valueFits: value.scrollWidth <= value.clientWidth + 1 && valueRect.right <= rowRect.right + 1,
        barBelowLabel: barRect.top >= labelRect.bottom - 1,
      };
    });
    expect(layout.overlapsValue).toBe(false);
    expect(layout.valueFits).toBe(true);
    if (width < 580) expect(layout.barBelowLabel).toBe(true);
    expect(await totals.locator('strong').evaluateAll((values) =>
      values.every((value) => value.scrollWidth <= value.clientWidth + 1))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
