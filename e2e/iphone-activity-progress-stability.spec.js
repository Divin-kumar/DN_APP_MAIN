import { test, expect } from '@playwright/test';
import { seedGuest, setActivityStatusCondition } from './fixtures.js';

// A completed-only or text-search view must not masquerade as 100% overall
// completion. The progress summary covers every non-cancelled Activity in
// the current Moment workspace; Refine only changes the displayed cards.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`global Activity progress stays honest through filters and search at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/activities');
      const progress = page.locator('.activities-page .event-activity-progress');
      await expect(progress).toContainText('1 of 3');
      await expect(progress).toContainText('overall active steps complete');
      await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
      const cards = page.locator('.activities-page .dn-v2-activity-card');
      await expect(cards).toHaveCount(3);
      const originals = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map(key => localStorage.getItem(key)));

      // The single Completed card must not make the full Activity progress
      // become 100% merely because the visible list is filtered.
      await setActivityStatusCondition(page, 'completed');
      await expect(cards).toHaveCount(1);
      await expect(progress).toContainText('1 of 3');
      await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');

      // Reset restores Settings baseline. A search must also leave the full
      // completion fraction unchanged, and data must not be rewritten.
      await page.getByRole('button', { name: /^Filters and sort/ }).click();
      await page.locator('.dn-list-controls-action-line').getByRole('button', { name: 'Reset' }).click();
      await page.getByRole('button', { name: /^Filters and sort/ }).click();
      await expect(cards).toHaveCount(3);
      await page.getByRole('searchbox', { name: 'Search activities and Moments' }).fill('Book a lakeside stay');
      await expect(cards).toHaveCount(1);
      await expect(progress).toContainText('1 of 3');
      await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');

      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map(key => localStorage.getItem(key)))).toEqual(originals);
      expect(errors).toEqual([]);
    });
  }
}
