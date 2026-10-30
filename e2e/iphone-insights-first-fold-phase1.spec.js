import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Chromium geometry catches regressions but does not prove installed iPhone Safari.
for (const [width, height] of [[320,640],[390,844],[430,932]]) for (const theme of ['dark','light']) {
  test('Insights first fold and milestone search '+width+'px '+theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/insights');
    const before = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    const heading = page.locator('.insights-page > .insights-heading');
    await expect(heading.getByRole('heading', { name:'Insights', exact:true })).toBeVisible();
    await expect(heading.locator('.insights-eyebrow, p')).toHaveCount(0);
    const exportAction = heading.getByRole('button', { name:'Export Insights data' });
    await expect(exportAction).toBeVisible();
    const discovery = page.locator('.insights-page > .insights-discovery');
    const field = discovery.getByRole('searchbox', { name:'Search Insights' });
    await expect(field).toBeVisible();
    const metrics = page.locator('.insights-metric-grid > .insight-metric');
    await expect(metrics).toHaveCount(4);
    const sizes = await page.evaluate(() => {
      const header = document.querySelector('.insights-page > .insights-heading');
      const title = header.querySelector('h2').getBoundingClientRect();
      const exportRect = header.querySelector('.insights-export').getBoundingClientRect();
      const search = document.querySelector('.insights-discovery input').getBoundingClientRect();
      const tiles = [...document.querySelectorAll('.insights-metric-grid > .insight-metric')].map(node => {
        const box = node.getBoundingClientRect(), value = node.querySelector('strong').getBoundingClientRect();
        const detail = node.querySelector('small').getBoundingClientRect();
        return { left:box.left, right:box.right, top:box.top, height:box.height,
          valueRight:value.right, detailRight:detail.right, font:parseFloat(getComputedStyle(node.querySelector('strong')).fontSize) };
      });
      return { titleTop:title.top, exportTop:exportRect.top, exportWidth:exportRect.width,
        exportHeight:exportRect.height, searchTop:search.top,
        inputFont:parseFloat(getComputedStyle(document.querySelector('.insights-discovery input')).fontSize),
        tiles, scrollWidth:document.documentElement.scrollWidth };
    });
    expect(Math.abs(sizes.titleTop - sizes.exportTop)).toBeLessThanOrEqual(14);
    expect(sizes.exportWidth).toBeGreaterThanOrEqual(44);
    expect(sizes.exportHeight).toBeGreaterThanOrEqual(43.9);
    expect(sizes.searchTop).toBeGreaterThan(sizes.exportTop + sizes.exportHeight - 1);
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
    await expect(discovery.locator('.dn-list-controls-context')).toContainText('1 milestones shown');
    await expect(discovery.locator('.dn-list-controls-summary')).toContainText('Milestone lists only');
    await expect(discovery.getByRole('button', { name:'Clear search' })).toBeVisible();
    await discovery.getByRole('button', { name:'Clear search' }).click();
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
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name:'Export Insights data' }).click();
  const report = await download;
  expect(report.suggestedFilename()).toMatch(/^dn-insights-\d{4}-\d{2}-\d{2}\.json$/);
  const content = JSON.parse((await import('node:fs/promises')).readFile
    ? await (await import('node:fs/promises')).readFile(await report.path(), 'utf8') : '{}');
  expect(content.overview).toHaveProperty('events',2);
  expect(content.incomes).toHaveLength(1);
  expect(content.expenses).toHaveLength(2);
  expect(await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
    .map((key) => localStorage.getItem(key)))).toEqual(before);
  expect(errors).toEqual([]);
});
