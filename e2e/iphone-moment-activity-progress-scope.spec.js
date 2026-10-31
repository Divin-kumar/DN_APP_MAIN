import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest, setActivityStatusCondition } from './fixtures.js';

// CHG-229: the Moment Activity progress bar represents the Moment's entire
// active (non-cancelled) Activity collection, not the currently visible cards.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`Moment Activity progress ignores Refine/search at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const moments = fixtureMoments();
      const errors = await seedGuest(page, { theme, moments });
      await page.goto('/events/moment-one/activities');

      const workspace = page.locator('.dn-moment-panel.event-section-activities');
      const progress = workspace.locator('.event-activity-progress');
      const bar = progress.getByRole('progressbar');
      const cards = workspace.locator('.event-activity-list .event-activity-card');
      await expect(cards).toHaveCount(3);
      // One completed + one open Activity; cancelled is visible but not counted.
      await expect(progress).toContainText('1 of 2');
      await expect(bar).toHaveAttribute('aria-valuenow', '50');

      const before = await page.evaluate(() => [
        localStorage.getItem('dn_guest_eventGroups'),
        localStorage.getItem('dn_guest_incomes'),
        localStorage.getItem('dn_guest_expenses'),
      ]);

      // One completed card may be 100% of the search results but is still only
      // half of this Moment's two non-cancelled Activities.
      await setActivityStatusCondition(page, 'completed');
      await expect(cards).toHaveCount(1);
      await expect(cards.first().locator('.event-activity-status')).toHaveText('Completed');
      await expect(progress).toContainText('1 of 2');
      await expect(bar).toHaveAttribute('aria-valuenow', '50');

      // A cancelled-only result must not remove the two active Activities
      // from the progress denominator.
      await setActivityStatusCondition(page, 'cancelled');
      await expect(cards).toHaveCount(1);
      await expect(cards.first().locator('.event-activity-status')).toHaveText('Cancelled');
      await expect(progress).toContainText('1 of 2');
      await expect(bar).toHaveAttribute('aria-valuenow', '50');

      // Return to an unfiltered working list. Search is discovery-only.
      await page.getByRole('button', { name: /Filters and sort/ }).click();
      await page.getByRole('button', { name: 'Clear all', exact: true }).click();
      await page.getByRole('button', { name: /Filters and sort/ }).click();
      await expect(cards).toHaveCount(3);
      const search = page.getByRole('searchbox', { name: 'Search activities by title' });
      await search.fill('Book a lakeside stay');
      await expect(cards).toHaveCount(1);
      await expect(progress).toContainText('1 of 2');
      await expect(bar).toHaveAttribute('aria-valuenow', '50');

      await search.fill('This particular activity is missing');
      await expect(cards).toHaveCount(0);
      await expect(workspace.locator('.event-activity-filter-empty')).toContainText('No activities match these filters.');
      await expect(progress).toContainText('1 of 2');
      await expect(bar).toHaveAttribute('aria-valuenow', '50');

      await search.fill('');
      await expect(cards).toHaveCount(3);
      await expect(bar).toHaveAttribute('aria-valuenow', '50');
      await page.locator('.dn-moment-nav a[href="/events/moment-one/story"]').click();
      await page.locator('.dn-moment-nav a[href="/events/moment-one/activities"]').click();
      await expect(progress).toContainText('1 of 2');
      await expect(bar).toHaveAttribute('aria-valuenow', '50');

      expect(await page.evaluate(() => [
        localStorage.getItem('dn_guest_eventGroups'),
        localStorage.getItem('dn_guest_incomes'),
        localStorage.getItem('dn_guest_expenses'),
      ])).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
