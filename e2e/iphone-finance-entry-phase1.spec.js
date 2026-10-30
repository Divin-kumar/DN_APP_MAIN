import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Finance keeps three one-row totals and a quiet Transactions heading.
// Creation is deliberately available only through the universal + menu.
for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'light'], [430, 932, 'dark']]) {
  test('iPhone Finance totals and universal transaction entry fit at ' + width + 'px ' + theme, async ({ page }) => {
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
    await expect(heading).toHaveText('Transactions');
    await expect(heading.getByRole('button')).toHaveCount(0);
    await expect(heading.locator('.dn-transactions-heading-description, .dn-transaction-add')).toHaveCount(0);

    const quickCreate = page.getByRole('button', { name: 'Open quick create menu' });
    await expect(quickCreate).toBeVisible();
    const size = await quickCreate.boundingBox();
    expect(size.height).toBeGreaterThanOrEqual(43.95);
    expect(size.width).toBeGreaterThanOrEqual(44);
    await quickCreate.click();
    await page.getByRole('button', { name: 'Transaction', exact: true }).click();

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


/* The premium list keeps amounts beside titles even when names and amounts
   are long. These browser checks do not claim native iPhone Safari proof. */
for (const [width, height] of [[320,640],[390,844],[430,932]]) for (const theme of ['dark','light']) {
  test('Transaction card hierarchy at '+width+'px '+theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const title = 'Accommodation deposits for our long family getaway and travel plans';
    const errors = await seedGuest(page, { theme,
      expenses: [
        { id:'long', name:title, amount:1234567, date:'2026-10-24', eventId:'moment-one', category:'Travel', paymentMethod:'Online',
          notes:'Kept for the trip.' },
        { id:'other', name:'Extra purchase', amount:85, date:'2026-10-23', category:'Other', paymentMethod:'Cash' },
      ] });
    await page.goto('/financials/transactions');
    const card = page.locator('.dn-transactions-page .dn-transaction-card').filter({ hasText:title });
    await expect(card).toBeVisible();
    await expect(card.locator('.dn-transaction-value')).toContainText('12,34,567');
    await expect(card.locator('.dn-transaction-meta')).toContainText('Travel');
    await expect(card.locator('.dn-transaction-meta')).toContainText('Online');
    const before = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    const metrics = await card.evaluate((node) => {
      const titleRect = node.querySelector('.dn-transaction-copy > strong').getBoundingClientRect();
      const amount = node.querySelector('.dn-transaction-value').getBoundingClientRect();
      const copy = node.querySelector('.dn-transaction-copy').getBoundingClientRect();
      const meta = node.querySelector('.dn-transaction-meta').getBoundingClientRect();
      const icon = node.querySelector('.dn-transaction-icon').getBoundingClientRect();
      const edge = node.getBoundingClientRect();
      return {
        titleTop:titleRect.top, titleRight:titleRect.right, amountTop:amount.top, amountLeft:amount.left,
        amountRight:amount.right, amountWidth:amount.width, metaTop:meta.top, titleBottom:titleRect.bottom,
        amountBottom:amount.bottom, iconRight:icon.right, copyLeft:copy.left, cardRight:edge.right,
        titleSize:parseFloat(getComputedStyle(node.querySelector('.dn-transaction-copy > strong')).fontSize),
        valueSize:parseFloat(getComputedStyle(node.querySelector('.dn-transaction-value')).fontSize),
        pageWidth:document.documentElement.scrollWidth,
      };
    });
    expect(Math.abs(metrics.titleTop-metrics.amountTop)).toBeLessThanOrEqual(3);
    expect(metrics.amountLeft).toBeGreaterThanOrEqual(metrics.titleRight - 1);
    expect(metrics.amountRight).toBeLessThanOrEqual(metrics.cardRight - 8);
    expect(metrics.copyLeft).toBeGreaterThanOrEqual(metrics.iconRight + 4);
    expect(metrics.metaTop).toBeGreaterThanOrEqual(Math.max(metrics.titleBottom,metrics.amountBottom) - 1);
    expect(metrics.titleSize).toBeGreaterThanOrEqual(14);
    expect(metrics.valueSize).toBeGreaterThanOrEqual(13);
    expect(metrics.pageWidth).toBeLessThanOrEqual(width + 1);

    const details = card.locator('.dn-transaction-details > summary');
    await expect(details).toBeVisible();
    expect((await details.boundingBox()).height).toBeGreaterThanOrEqual(43.9);
    await details.click();
    await expect(card.locator('.dn-transaction-details-content')).toContainText('Kept for the trip.');
    await details.click();
    await card.locator('.dn-transaction-copy > strong').click();
    const menu = page.getByRole('menu', { name:/Actions for Accommodation deposits/ });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name:'Edit', exact:true })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name:'Delete', exact:true })).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
      .map((key) => localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}
