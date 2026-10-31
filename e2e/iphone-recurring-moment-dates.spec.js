import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Recurrence is the same local calendar calculation in Dashboard and the
// Activity's Moment picker. Feb 29 and Jan 31 must remain February dates
// on short-month repetitions, never overflow into March.
for (const [width, height, theme] of [[320, 640, 'light'], [390, 844, 'dark'], [430, 932, 'light']]) {
  test(`Activity Moment picker shows clamped February recurrence at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.clock.setFixedTime(new Date('2026-02-01T12:00:00Z'));
    const errors = await seedGuest(page, { theme, moments: [
      { id: 'jan31', name: 'Monthly family supper', type: 'Personal', date: '2020-01-31', recurrence: 'monthly', activities: [], memories: [], attachments: [] },
      { id: 'feb29', name: 'Leap day anniversary', type: 'Anniversary', date: '2000-02-29', recurrence: 'yearly', activities: [], memories: [], attachments: [] },
    ] });
    await page.goto('/events?create=activity');
    const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    const picker = page.getByRole('dialog', { name: 'Choose a life moment' });
    await expect(picker).toBeVisible();
    const monthly = picker.locator('.activity-event-option-main').filter({ hasText: 'Monthly family supper' });
    const yearly = picker.locator('.activity-event-option-main').filter({ hasText: 'Leap day anniversary' });
    await expect(monthly).toContainText('28 Feb 2026');
    await expect(yearly).toContainText('28 Feb 2026');
    await expect(picker.locator('.activity-event-option-date strong')).not.toContainText('03');
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toEqual(original);
    expect(errors).toEqual([]);
  });
}
