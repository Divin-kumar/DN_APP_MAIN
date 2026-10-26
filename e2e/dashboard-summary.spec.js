import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

test.use({ timezoneId: 'Asia/Kolkata' });

const moments = [
  { id: 'recent', name: 'A family day', type: 'Personal', date: '2026-10-26', activities: [
    { id: 'today', title: 'Today’s task', date: '2026-10-26', expenses: [{ id: 'expense', amount: 999, date: '2026-10-26' }] },
    { id: 'done', title: 'Already complete', date: '2026-10-26', status: 'completed' },
    { id: 'overdue', title: 'Earlier task', date: '2026-10-24' },
    { id: 'undated', title: 'No date yet', date: '' },
    { id: 'cancelled', title: 'Cancelled task', date: '2026-10-26', cancelled: true },
  ] },
  { id: 'week', name: 'Earlier this week', type: 'Personal', date: '2026-10-20', activities: [
    { id: 'future', title: 'Tomorrow’s task', date: '2026-10-27' },
  ] },
  { id: 'archived', name: 'Archived day', type: 'Personal', date: '2026-10-26', archived: true,
    activities: [{ id: 'hidden', title: 'Archived task', date: '2026-10-26' }] },
];

for (const width of [390, 768, 1440]) {
  test(`daily summary shows scoped real counts and stays within the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-10-26T09:30:00+05:30') });
    const errors = await seedGuest(page, { moments,
      incomes: [{ id: 'income', name: 'Monthly fund', amount: 1000, date: '2026-10-01', type: 'Other' }],
      expenses: [{ id: 'expense', name: 'Shared master wins', amount: 450, date: '2026-10-26', category: 'Other' },
        { id: 'previous', name: 'Prior month', amount: 100, date: '2026-09-26', category: 'Other' }] });
    await page.goto('/dashboard');
    const greeting = page.locator('.dashboard-summary-greeting');
    await expect(greeting.getByRole('heading', { name: 'Good morning, Guest' })).toBeVisible();
    const metric = (label) => greeting.locator('.dashboard-summary-metric').filter({ has: page.getByText(label, { exact: true }) });
    await expect(metric('Activities today').locator('strong')).toHaveText('2');
    await expect(metric('Recent moments').locator('strong')).toHaveText('2');
    await expect(metric('Pending activities').locator('strong')).toHaveText('4');
    await expect(metric('Spent · Oct 2026').locator('strong')).toHaveText('₹450');
    await expect(metric('Spent · Oct 2026')).toContainText('Balance ₹550');
    await expect(greeting).toContainText('Past 7 days: 3 activities, 1 completed.');
    await expect(greeting).toContainText('1 pending activity is dated before today.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const tile of await greeting.locator('.dashboard-summary-metric').all()) {
      const bounds = await tile.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    if (width === 1440) {
      const momentPanel = await page.getByRole('region', { name: 'Moments', exact: true }).boundingBox();
      const activityPanel = await page.getByRole('region', { name: 'Activities', exact: true }).boundingBox();
      expect(Math.abs(momentPanel.y - activityPanel.y)).toBeLessThan(2);
    }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
    expect(errors).toEqual([]);
  });
}

test('unreadable guest spending never appears as zero and recovers through summary retry', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T09:30:00+05:30') });
  await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.addInitScript(() => localStorage.setItem('dn_guest_expenses', '{corrupt'));
  await page.goto('/dashboard');
  const greeting = page.locator('.dashboard-summary-greeting');
  const spending = greeting.locator('.dashboard-summary-metric').filter({ hasText: 'Spent · Oct 2026' });
  await expect(spending.locator('strong')).toHaveText('—');
  await expect(greeting).toContainText('Spending couldn’t be loaded.');
  await page.evaluate(() => localStorage.setItem('dn_guest_expenses', JSON.stringify([
    { id: 'restored', name: 'Recovered expense', amount: 37, date: '2026-10-26', category: 'Other' },
  ])));
  await greeting.getByRole('button', { name: 'Retry finances', exact: true }).click();
  // The existing nested-only expense remains part of the ledger after recovery.
  await expect(spending.locator('strong')).toHaveText('₹1,036');
});
