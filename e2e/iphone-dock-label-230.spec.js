import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// The five-slot mobile dock is unchanged; only the visible Transactions label
// shortens on narrow devices. Accessible name and route remain Transactions.
for (const width of [320, 390, 430, 480]) {
  for (const theme of ['light', 'dark']) {
    test('compact Finance dock label stays readable and opens Transactions at ' + width + 'px ' + theme,
      async ({ page }, testInfo) => {
        const errors = await seedGuest(page, { theme });
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/dashboard');
        const dock = page.getByRole('navigation', { name: 'Main navigation' });
        const finance = dock.getByRole('link', { name: 'Transactions', exact: true });
        await expect(finance).toHaveAttribute('href', '/financials/transactions');
        await expect(finance).toBeVisible();
        const compact = finance.locator('.dn-dock-compact-label');
        const full = finance.locator('.dn-dock-full-label');
        if (width <= 430) {
          await expect(compact).toBeVisible();
          await expect(full).toBeHidden();
          await expect(compact).toContainText('Finance');
        } else {
          await expect(full).toBeVisible();
          await expect(compact).toBeHidden();
        }
        const { linkWidth, textWidth, height } = await finance.evaluate((node) => ({
          linkWidth: node.getBoundingClientRect().width,
          textWidth: node.querySelector('.dn-dock-label').getBoundingClientRect().width,
          height: node.getBoundingClientRect().height,
        }));
        expect(linkWidth).toBeGreaterThanOrEqual(textWidth - 1);
        expect(height).toBeGreaterThanOrEqual(44);
        await testInfo.attach('Dock-' + width + '-' + theme, {
          body: await page.screenshot({ animations:'disabled', fullPage:false }),
          contentType: 'image/png',
        });
        await finance.click();
        await expect(page).toHaveURL(/\/financials\/transactions$/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        expect(errors).toEqual([]);
      });
  }
}
