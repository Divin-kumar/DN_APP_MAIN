import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// The editorial search line and Refine affordance are shared across all lists.
// Synthetic Chromium geometry cannot prove installed iPhone Safari behavior.
const pages = [
  { path:'/activities', search:'Search activities and Moments', sample:'Book a lakeside stay' },
  { path:'/events', search:'Search moments', sample:'Weekend in Ooty' },
  { path:'/financials/transactions', search:'Search transactions', sample:'Room deposit' },
];
for (const [width, height] of [[320,640],[390,844],[430,932]]) for (const theme of ['dark','light']) {
  for (const item of pages) test('Editorial discovery strip '+item.path+' '+width+'px '+theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto(item.path);
    const root = page.locator('.dn-command-controls');
    const field = root.getByRole('searchbox', { name:item.search });
    const filter = root.getByRole('button', { name:/Filters and sort/ });
    await expect(field).toBeVisible();
    await expect(filter).toBeVisible();
    const measures = await root.evaluate((node) => {
      const rail = node.querySelector('.dn-list-controls-row');
      const search = node.querySelector('.dn-list-controls-search');
      const icon = node.querySelector('.dn-list-controls-search-icon');
      const input = search.querySelector('input');
      const filter = node.querySelector('.dn-list-controls-trigger');
      const r = rail.getBoundingClientRect(), s = search.getBoundingClientRect(),
        b = filter.getBoundingClientRect();
      return {
        railBorder: getComputedStyle(rail).borderTopWidth,
        railBackground: getComputedStyle(rail).backgroundColor,
        searchUnderline: getComputedStyle(search).borderBottomWidth,
        innerBorder: getComputedStyle(input).borderTopWidth,
        refineLabel:filter.querySelector('span:not(.dn-list-controls-badge)').textContent,
        inputSize: parseFloat(getComputedStyle(input).fontSize),
        iconVisible: getComputedStyle(icon).display !== 'none',
        buttonWidth:b.width, buttonHeight:b.height,
        sameRow:Math.abs(s.top - b.top) < 3,
        inside:b.right <= r.right + 1 && s.left >= r.left - 1,
        pageWidth:document.documentElement.scrollWidth,
      };
    });
    expect(measures.railBorder).toBe('0px');
    expect(measures.railBackground).toBe('rgba(0, 0, 0, 0)');
    expect(measures.searchUnderline).toBe('1px');
    expect(measures.innerBorder).toBe('0px');
    expect(measures.refineLabel).toBe('Refine');
    expect(measures.iconVisible).toBe(true);
    expect(measures.inputSize).toBeGreaterThanOrEqual(16);
    expect(measures.buttonWidth).toBeGreaterThanOrEqual(43.9);
    expect(measures.buttonHeight).toBeGreaterThanOrEqual(43.9);
    expect(measures.sameRow).toBe(true);
    expect(measures.inside).toBe(true);
    expect(measures.pageWidth).toBeLessThanOrEqual(width + 1);

    const before = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    await filter.click();
    const sheet = page.locator('.dn-refine-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name:'Add filter' })).toBeVisible();
    await sheet.getByRole('button', { name:'Cancel', exact:true }).click();
    await expect(sheet).toHaveCount(0);
    await field.click();
    await field.fill(item.sample);
    await expect(field).toHaveValue(item.sample);
    await expect(page.locator('.dn-list-controls-context')).toContainText('1 ');
    expect(await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map((key) => localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}

for (const [width, height] of [[320,640],[390,844],[430,932]]) for (const theme of ['dark','light']) {
  test('Transactions uses universal create and a readable Refine editor '+width+'px '+theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/financials/transactions');
    const before = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    await expect(page.locator('.dn-header').getByRole('heading', { name: 'Transactions' })).toBeVisible();
    await expect(page.locator('.dn-transactions-page .transactions-heading')).toHaveCount(0);
    await expect(page.locator('.dn-transactions-page .dn-transaction-add, .dn-transactions-heading-description')).toHaveCount(0);
    const refine = page.locator('.dn-transactions-page').getByRole('button', { name:/Filters and sort/ });
    await refine.click();
    await page.getByRole('button', { name:'Add filter', exact:true }).click();
    const rule = page.locator('.dn-refine-sheet .dn-condition-rule').last();
    await expect(rule).toBeVisible();
    // A brand-new rule has no value control yet. Choose a real field before
    // checking the shared single-line alignment of all four controls.
    await rule.getByRole('combobox', { name:'Filter by', exact:true }).click();
    await page.getByRole('option', { name:'Title', exact:true }).click();
    await expect(rule.getByRole('textbox', { name:'Value for Title' })).toBeVisible();
    const geometry = await rule.evaluate((node) => {
      const parts = [...node.children].map((child) => child.getBoundingClientRect());
      const box = node.getBoundingClientRect();
      return { fieldTop:parts[0].top, fieldRight:parts[0].right, comparisonLeft:parts[1].left, comparisonTop:parts[1].top, valueTop:parts[2].top,
        comparisonRight:parts[1].right, valueLeft:parts[2].left,
        valueRight:parts[2].right, removeLeft:parts[3].left,
        removeWidth:parts[3].width, removeHeight:parts[3].height,
        removeRight:parts[3].right, ruleRight:box.right,
        pageWidth:document.documentElement.scrollWidth };
    });
    expect(Math.abs(geometry.fieldTop - geometry.comparisonTop)).toBeLessThanOrEqual(5);
    expect(geometry.fieldRight).toBeLessThanOrEqual(geometry.comparisonLeft + 2);
    expect(Math.abs(geometry.comparisonTop - geometry.valueTop)).toBeLessThanOrEqual(4);
    expect(geometry.comparisonRight).toBeLessThanOrEqual(geometry.valueLeft + 2);
    expect(geometry.valueRight).toBeLessThanOrEqual(geometry.removeLeft + 2);
    expect(geometry.removeRight).toBeLessThanOrEqual(geometry.ruleRight + 1);
    expect(geometry.removeWidth).toBeGreaterThanOrEqual(43.9);
    expect(geometry.removeHeight).toBeGreaterThanOrEqual(43.9);
    expect(geometry.pageWidth).toBeLessThanOrEqual(width + 1);
    await page.getByRole('button', { name:'Remove filter', exact:true }).click();
    await page.locator('.dn-refine-sheet').getByRole('button', { name:'Cancel', exact:true }).click();
    const quickCreate = page.getByRole('button', { name:'Open quick create menu' });
    await expect(quickCreate).toBeVisible();
    await quickCreate.click();
    await page.getByRole('button', { name:'Transaction', exact:true }).click();
    await expect(page.getByRole('dialog', { name:'Add Transaction' })).toBeVisible();
    await page.getByRole('button', { name:'Cancel', exact:true }).click();
    expect(await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map((key) => localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}
