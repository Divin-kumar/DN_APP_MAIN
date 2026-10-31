import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// CHG-233: CSS and geometry contract only. Browser emulation cannot prove
// native iPhone Safari will never zoom or that VoiceOver passes.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`Activity Detail and editable iPhone fields remain readable at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/events/moment-one/activities/shared');

      const detail = page.locator('.activity-detail-page');
      await expect(detail.getByRole('heading', { name: 'Book a lakeside stay' })).toBeVisible();
      await expect(detail.getByRole('navigation', { name: 'Parent Moment' })).toBeVisible();
      await expect(detail.getByRole('button', { name: 'Activity options' })).toBeVisible();

      const type = await detail.evaluate((root) => {
        const px = (selector) => {
          const el = root.querySelector(selector);
          return el ? parseFloat(getComputedStyle(el).fontSize) : null;
        };
        return {
          category: px('.activity-parent-context-type'),
          parentLink: px('.activity-parent-context-link'),
          status: px('.activity-status-pill'),
          priority: px('.activity-detail-priority'),
          due: px('.activity-detail-due'),
          footerLabel: px('.activity-secondary-metadata dt'),
          footerValue: px('.activity-secondary-metadata dd'),
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      expect(type.category).toBeGreaterThanOrEqual(11.5);
      expect(type.parentLink).toBeGreaterThanOrEqual(13);
      expect(type.status).toBeGreaterThanOrEqual(12.5);
      expect(type.priority).toBeGreaterThanOrEqual(12.5);
      expect(type.due).toBeGreaterThanOrEqual(12.5);
      expect(type.footerLabel).toBeGreaterThanOrEqual(12.5);
      expect(type.footerValue).toBeGreaterThanOrEqual(12.5);
      expect(type.pageWidth).toBeLessThanOrEqual(type.viewportWidth + 1);

      const originalRecords = await page.evaluate(() =>
        ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
          .map(key => localStorage.getItem(key)));

      // Read-only visits and opening/cancelling a create form must not touch data.
      await page.goto('/activities');
      const activitySearch = page.getByRole('searchbox', { name: 'Search activities and Moments' });
      await expect(activitySearch).toBeVisible();
      expect(await activitySearch.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      await page.goto('/events');
      const momentSearch = page.getByRole('searchbox', { name: 'Search moments' });
      await expect(momentSearch).toBeVisible();
      expect(await momentSearch.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);

      await page.goto('/financials/transactions');
      await page.getByRole('button', { name: 'Open quick create menu' }).click();
      await page.getByRole('button', { name: 'Transaction', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Add Transaction' });
      await expect(editor).toBeVisible();
      const editFonts = await editor.locator('input[type="number"],input[type="text"]')
        .evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
      expect(editFonts.length).toBeGreaterThanOrEqual(2);
      expect(editFonts.every(size => size >= 16)).toBe(true);
      await editor.getByRole('button', { name: 'Cancel' }).click();
      await expect(editor).toHaveCount(0);

      expect(await page.evaluate(() =>
        ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
          .map(key => localStorage.getItem(key)))).toEqual(originalRecords);
      expect(errors).toEqual([]);
    });
  }
}
