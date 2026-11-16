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

for (const [width, theme] of [[320, 'dark'], [430, 'light'], [1280, 'dark']]) {
  test(`Finance Insights reconciles historical months, category details and CSV at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = await seedGuest(page, {
      theme,
      incomes: [
        { id: 'salary', name: 'Salary', type: 'Salary', amount: 27778, date: '2024-03-01' },
        { id: 'claim', name: 'Expense claim', type: 'Claim', amount: 500.21, date: '2024-03-04' },
      ],
      expenses: [
        { id: 'rent', name: 'Rent', category: 'Housing', amount: 6500, date: '2024-03-01' },
        { id: 'meal', name: 'Lunch', category: 'Long food and personal expense category', amount: 25.49, date: '2024-03-06', time: '13:15', paymentMethod: 'Cash' },
        { id: 'auto', name: 'Auto', category: 'Travel', amount: 60, date: '2024-02-29' },
        { id: 'large', name: 'Home', category: 'Home', amount: 1234567.85, date: '2024-04-01' },
      ],
    });
    await page.goto('/insights');
    const storage = () => page.evaluate(() => ['dn_guest_incomes', 'dn_guest_expenses'].map((key) => localStorage.getItem(key)));
    const before = await storage();
    await page.getByRole('searchbox', { name: 'Search milestones in Insights' }).fill('Weekend');
    const views = page.getByRole('group', { name: 'Insights view' });
    await views.getByRole('button', { name: 'Finance' }).click();
    await expect(views.getByRole('button', { name: 'Finance' })).toHaveAttribute('aria-pressed', 'true');
    const month = page.getByRole('combobox', { name: 'Report month' });
    await expect(month).toHaveValue(/^2026-/);
    await expect(month.locator('optgroup[label="2024"] option')).toHaveCount(3);
    await month.selectOption({ label: 'April 2024' });
    await expect(month).toHaveValue('2024-04');
    const monthly = page.getByRole('table', { name: 'Monthly finance totals for 2024' });
    await expect(monthly).toBeHidden();
    const summary = page.getByRole('region', { name: 'April 2024' });
    await expect(summary).toContainText('₹12,34,567.85');
    await month.selectOption('2024-03');
    await expect(page.getByRole('region', { name: 'March 2024' })).toContainText('₹21,752.72');
    await month.selectOption('2024-04');
    const compare = page.getByRole('button', { name: 'Compare months' });
    await compare.click();
    await expect(monthly.getByRole('row')).toHaveCount(4);
    const march = monthly.getByRole('button', { name: 'March 2024' });
    await expect(march.locator('xpath=ancestor::tr').getByRole('cell')).toHaveText(['₹28,278.21', '₹6,525.49', '₹21,752.72']);
    await expect(monthly.getByRole('button', { name: 'April 2024' })).toHaveAttribute('aria-pressed', 'true');
    await expect(monthly.getByRole('row').nth(1)).toContainText('₹12,34,567.85');
    await march.click();
    await expect(month).toHaveValue('2024-03');
    await expect(page.getByRole('heading', { name: 'March 2024' })).toBeVisible();
    const breakdown = page.getByRole('button', { name: 'Breakdown' });
    await expect(page.getByRole('heading', { name: 'Income by type' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Transactions', exact: true })).toBeVisible();
    await breakdown.click();
    await expect(compare).toHaveAttribute('aria-expanded', 'false');
    await expect(monthly).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Income by type' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Expenses by category' })).toBeVisible();

    const details = page.getByRole('region', { name: 'Transactions', exact: true });
    await expect(details.getByRole('listitem')).toHaveCount(4);
    const food = page.getByRole('button', { name: /Long food and personal expense category/ });
    await expect(food).toContainText('₹25.49');
    await food.click();
    await expect(food).toHaveAttribute('aria-pressed', 'true');
    await expect(details.getByRole('listitem')).toHaveCount(1);
    await expect(details).toContainText('13:15');
    await expect(details).toContainText('Lunch');
    await expect(details.getByRole('list', { name: /6 Mar/ })).toBeVisible();
    await expect(details.getByRole('listitem')).toContainText('-₹25.49');
    await expect(details.locator('li time')).toHaveAttribute('datetime', '2024-03-06T13:15');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export report transactions as CSV' }).click();
    const report = await download;
    expect(report.suggestedFilename()).toBe('dn-finance-2024-03.csv');
    const csv = await readFile(await report.path(), 'utf8');
    expect(csv).toContain('"Expense","2024-03-06","13:15","Lunch","Long food and personal expense category","25.49","Cash"');
    expect(csv).not.toContain('Rent');
    expect(csv).not.toContain('Salary');

    await page.getByRole('button', { name: 'Show all transactions' }).click();
    await expect(details.getByRole('listitem')).toHaveCount(4);
    await expect(details.getByRole('list', { name: /1 Mar/ }).getByRole('listitem')).toHaveCount(2);
    await expect(details.getByText('+₹27,778', { exact: true })).toBeVisible();
    await month.selectOption('2024-02');
    await expect(details).toContainText('29 Feb');
    await expect(details).toContainText('Auto');
    await expect(details).not.toContainText('Lunch');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await views.getByRole('button', { name: 'Overview' }).click();
    await expect(page.getByRole('searchbox', { name: 'Search milestones in Insights' })).toHaveValue('Weekend');
    expect(await storage()).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('Finance Insights groups history by transaction date and downloads the whole selected month', async ({ page }) => {
  await seedGuest(page, {
    moments: [], incomes: [],
    expenses: Array.from({ length: 41 }, (_, index) => ({
      id: `expense-${index}`, name: `Expense ${index}`, category: 'Travel',
      amount: 1.05, date: '2024-06-20', createdAt: '2026-11-14T12:00:00Z',
    })),
  });
  await page.goto('/insights');
  await page.getByRole('group', { name: 'Insights view' }).getByRole('button', { name: 'Finance' }).click();
  await expect(page.getByRole('combobox', { name: 'Report month' })).toHaveValue('2024-06');
  const ledger = page.getByRole('list', { name: /20 Jun/ });
  await expect(ledger.getByRole('listitem')).toHaveCount(40);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report transactions as CSV' }).click();
  const report = await download;
  expect((await readFile(await report.path(), 'utf8')).trimEnd().split('\r\n')).toHaveLength(42);
  await page.getByRole('button', { name: 'Show more transactions' }).click();
  await expect(ledger.getByRole('listitem')).toHaveCount(41);
  await expect(page.getByRole('list', { name: /20 Jun/ })).toHaveCount(1);
});
