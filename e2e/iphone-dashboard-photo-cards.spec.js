import { test, expect } from '@playwright/test';
import { addOriginal, calendarDate, seedGuest } from './fixtures.js';

// Synthetic viewport checks. Native installed iPhone Safari remains a separate
// device-level QA gate; no originals or records are written during rendering.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['dark', 'light']) {
    test('Home keeps an editorial greeting, readable Moments and Activities at ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.addInitScript(task => localStorage.setItem('dn_guest_tasks', JSON.stringify([task])), {
        id: 'home-task', title: 'Prepare family trip', status: 'in-progress', priority: 'high', dueDate: calendarDate(2),
      });
      await page.goto('/dashboard');
      const greeting = page.locator('.dashboard-greeting-compact');
      await expect(greeting).toBeVisible();
      const moment = page.locator('.dashboard-moment-row').filter({ hasText: 'Weekend in Ooty' }).first();
      const activity = page.locator('.dashboard-activity-card').filter({ hasText: 'Book a lakeside stay' }).first();
      await page.getByRole('button', { name: 'Show Tasks on dashboard' }).click();
      await expect(page.getByRole('link', { name: 'Open Task Prepare family trip' })).toBeVisible();
      await expect(moment).toBeVisible();
      await expect(activity).toBeVisible();
      const geometry = await page.evaluate(() => {
        const greeting = document.querySelector('.dashboard-greeting-compact');
        const moment = document.querySelector('.dashboard-moment-row');
        const activity = document.querySelector('.dashboard-activity-card');
        const task = document.querySelector('.dn-dashboard-task-row');
        const tile = moment?.querySelector('.dashboard-upcoming-date');
        const badge = activity?.querySelector('.dashboard-upcoming-date');
        const box = (node) => node.getBoundingClientRect();
        return { greetingHeight: box(greeting).height, greetingBorder: getComputedStyle(greeting).borderTopWidth,
          tile: box(tile).width, badge: box(badge).width,
          taskTile: box(task.querySelector('.dn-dashboard-task-date')).width,
          rowStyles: [task, moment, activity].map(row => {
            const style = getComputedStyle(row);
            return [style.backgroundColor, style.borderTopLeftRadius, box(row).height];
          }),
          momentRight: box(moment).right, activityRight: box(activity).right,
          pageWidth: document.documentElement.scrollWidth };
      });
      expect(geometry.greetingHeight).toBeLessThanOrEqual(110);
      expect(geometry.greetingBorder).toBe('0px');
      expect(geometry.tile).toBeGreaterThanOrEqual(44);
      expect(geometry.badge).toBeGreaterThanOrEqual(44);
      expect(Math.abs(geometry.tile - geometry.taskTile)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.badge - geometry.taskTile)).toBeLessThanOrEqual(1);
      expect(geometry.rowStyles[0]).toEqual(geometry.rowStyles[1]);
      expect(geometry.rowStyles[0]).toEqual(geometry.rowStyles[2]);
      expect(geometry.momentRight).toBeLessThanOrEqual(width + 1);
      expect(geometry.activityRight).toBeLessThanOrEqual(width + 1);
      expect(geometry.pageWidth).toBeLessThanOrEqual(width + 1);

      await activity.getByRole('button', { name: 'Open Book a lakeside stay' }).click();
      await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
      expect(errors).toEqual([]);
    });
  }
}

test('original photos decorate the correct Home date tiles without writing to records', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await addOriginal(page, { count: 2 });
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.goto('/dashboard');
  const moment = page.locator('.dashboard-moment-row').filter({ hasText: 'Weekend in Ooty' }).first();
  const activity = page.locator('.dashboard-activity-card').filter({ hasText: 'Book a lakeside stay' }).first();
  await moment.scrollIntoViewIfNeeded();
  await expect.poll(async () => moment.locator('.dashboard-cover-photo img').count()).toBe(1);
  await activity.scrollIntoViewIfNeeded();
  await expect.poll(async () => activity.locator('.dashboard-cover-photo img').count()).toBe(1);
  await expect(moment.locator('.dashboard-upcoming-date strong')).toBeVisible();
  await expect(activity.locator('.dashboard-upcoming-date strong')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  expect(errors).toEqual([]);
});
