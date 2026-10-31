import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// CHG-234: one meaningful title in the shell, not a second title row in
// the content. Browser emulation is not a replacement for iPhone Safari.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`route titles replace duplicate page headings at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard'); // about:blank has no accessible localStorage.
      const initial = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map(key => localStorage.getItem(key)));
      const mainTitle = page.locator('.dn-header .dn-shell-page-title');
      const cases = [
        ['/dashboard', 'Dashboard', null],
        ['/events', 'Moments', '.life-timeline-heading'],
        ['/activities', 'Activities', '.life-timeline-heading'],
        ['/financials/transactions', 'Transactions', '.dn-transactions-page .transactions-heading'],
        ['/insights', 'Insights', '.insights-page > .insights-heading'],
        ['/settings', 'Settings', '.dn-settings-home .settings-heading'],
        ['/settings/data-backup', 'Data & Backup', '.dn-data-page-header'],
        ['/settings/code-lists', 'Code Lists', '.dn-premium-code-lists > .settings-subpage-header'],
        ['/settings/about', 'About DN', '.dn-premium-about > .settings-subpage-header'],
      ];
      for (const [path, title, duplicate] of cases) {
        await page.goto(path);
        await expect(mainTitle).toHaveText(title);
        await expect(mainTitle).toBeVisible();
        if (duplicate) await expect(page.locator(duplicate)).toHaveCount(0);
        const bounds = await page.evaluate(() => {
          const h = document.querySelector('.dn-header .dn-shell-page-title');
          const header = document.querySelector('.dn-header').getBoundingClientRect();
          const title = h.getBoundingClientRect();
          const profile = document.querySelector('.dn-header .header-user-controls').getBoundingClientRect();
          return {
            headerBottom: header.bottom, titleTop: title.top, titleBottom: title.bottom,
            titleRight: title.right, profileLeft: profile.left,
            viewportWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          };
        });
        expect(bounds.titleTop).toBeGreaterThanOrEqual(-1);
        expect(bounds.titleBottom).toBeLessThanOrEqual(bounds.headerBottom + 1);
        expect(bounds.titleRight).toBeLessThanOrEqual(bounds.profileLeft + 1);
        expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewportWidth + 1);
        await expect(page.locator('.dn-header h1')).toHaveCount(1);
      }

      // Back actions moved into the persistent header, not the page body.
      await page.goto('/settings/data-backup');
      await page.locator('.dn-header').getByRole('link', { name: 'Back to Settings' }).click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(mainTitle).toHaveText('Settings');
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map(key => localStorage.getItem(key)))).toEqual(initial);
      expect(errors).toEqual([]);
    });
  }
}

test('Moment names use truncated header titles without hiding the important story hero', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seedGuest(page);
  await page.goto('/events/moment-one/story');
  const title = page.locator('.dn-header .dn-shell-page-title');
  await expect(title).toHaveText('Weekend in Ooty — family plans and memories');
  await expect(page.locator('.dn-moment-hero-swipe h1')).toHaveText('Weekend in Ooty — family plans and memories');
  await expect(page.locator('.dn-moment-panel #dn-moment-panel-title')).toHaveText('Your Moment Story');
  await expect(page.locator('.dn-moment-panel .dn-workspace-section-heading')).toHaveCount(0);
  await expect(title).toHaveCSS('text-overflow', 'ellipsis');
  await page.goto('/events/moment-one/activities/shared');
  await expect(title).toHaveText('Activity Detail');
  await expect(page.locator('.activity-detail-content h1')).toHaveText('Book a lakeside stay');
});

test('Insights Export shares the search toolbar without changing export behavior', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seedGuest(page);
  await page.goto('/insights');
  await expect(page.locator('.dn-header h1')).toHaveText('Insights');
  const toolbar = page.locator('.insights-discovery.dn-insights-compact-search');
  const input = toolbar.getByRole('searchbox', { name: 'Search milestones in Insights' });
  const button = toolbar.getByRole('button', { name: 'Export Insights data' });
  await expect(input).toBeVisible();
  await expect(button).toBeVisible();
  const alignment = await toolbar.evaluate(node => {
    const r1 = node.querySelector('input').getBoundingClientRect();
    const r2 = node.querySelector('.insights-export').getBoundingClientRect();
    return { inputTop: r1.top, buttonTop: r2.top, buttonHeight: r2.height };
  });
  expect(Math.abs(alignment.inputTop - alignment.buttonTop)).toBeLessThanOrEqual(3);
  expect(alignment.buttonHeight).toBeGreaterThanOrEqual(44);
});
