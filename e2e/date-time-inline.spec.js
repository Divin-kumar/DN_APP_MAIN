import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

// All user-editable business dates use the same shared clock control:
// Moment, Activity, Transaction and an existing Activity's Add entry.
async function expectCompactDateTime(row) {
  await expect(row.locator('input[type="date"]')).toBeVisible();
  const time = row.locator('input[type="time"]');
  await expect(time).toBeVisible();

  await time.fill('11:45');
  const clear = row.getByRole('button', { name: /^Clear .* time$/ });
  await expect(clear).toBeVisible();
  await expect(clear.locator('svg')).toBeVisible();
  await expect(clear).toHaveAttribute('title', 'Clear time');

  const metrics = await row.evaluate((element) => {
    const date = element.querySelector('input[type="date"]').getBoundingClientRect();
    const clock = element.querySelector('input[type="time"]').getBoundingClientRect();
    const action = element.querySelector('.activity-time-clear').getBoundingClientRect();
    const root = element.getBoundingClientRect();
    return {
      dateTop: date.top, timeTop: clock.top, clearTop: action.top,
      timeBottom: clock.bottom, clearBottom: action.bottom,
      dateRight: date.right, timeLeft: clock.left,
      timeRight: clock.right, clearLeft: action.left,
      clearRight: action.right, rootRight: root.right,
      controlWidth: element.querySelector('.activity-time-control').clientWidth,
      controlScrollWidth: element.querySelector('.activity-time-control').scrollWidth,
    };
  });
  // Labels remain in the row above their controls. Clear is *beside* the
  // input, not wrapped below it, even on a 320px phone.
  expect(Math.abs(metrics.dateTop - metrics.timeTop)).toBeLessThanOrEqual(4);
  expect(Math.abs(metrics.clearTop - metrics.timeTop)).toBeLessThanOrEqual(4);
  expect(Math.abs(metrics.clearBottom - metrics.timeBottom)).toBeLessThanOrEqual(4);
  expect(metrics.dateRight).toBeLessThanOrEqual(metrics.timeLeft + 1);
  expect(metrics.timeRight).toBeLessThanOrEqual(metrics.clearLeft + 1);
  expect(metrics.clearRight).toBeLessThanOrEqual(metrics.rootRight + 1);
  expect(metrics.controlScrollWidth).toBeLessThanOrEqual(metrics.controlWidth + 1);

  await clear.click();
  await expect(time).toHaveValue('');
  await expect(clear).toHaveCount(0);
}

async function openQuickCreate(page, label) {
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
}

for (const width of [320, 390, 1280]) {
  test(`Date, Time, compact Clear time stay inline across all four entry forms at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    const errors = await seedGuest(page, { moments: fixtureMoments(), incomes: [], expenses: [] });
    await page.goto('/events');
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));

    // Standard new/edit Moment form: date remains in More options.
    await page.goto('/events?create=event');
    const momentDialog = page.getByRole('dialog', { name: 'New event' });
    await momentDialog.locator('details.dn-form-disclosure > summary').click();
    await expectCompactDateTime(momentDialog.locator('.activity-date-time-row'));
    await momentDialog.getByRole('button', { name: 'Close dialog' }).click();

    // A universal new Activity uses the same shared form component.
    await page.goto('/events');
    await openQuickCreate(page, 'Activity');
    const activityDialog = page.getByRole('dialog', { name: 'Add an activity' });
    await activityDialog.locator('details.dn-form-disclosure').filter({ hasText: 'More options' }).last().locator('summary').click();
    await expectCompactDateTime(activityDialog.locator('.activity-date-time-row'));
    await activityDialog.getByRole('button', { name: 'Close dialog' }).click();

    // Both income and expense use TransactionForm, with this same date/time row.
    await openQuickCreate(page, 'Transaction');
    const transactionDialog = page.getByRole('dialog', { name: 'Add Transaction' });
    await transactionDialog.locator('details.dn-form-disclosure > summary').click();
    await expectCompactDateTime(transactionDialog.locator('.activity-date-time-row'));
    await transactionDialog.getByRole('button', { name: 'Close dialog' }).click();

    // Add entry has its own form but still shares the Date and Time components.
    await page.goto('/events/moment-one/activities/shared');
    await expect(page.locator('.activity-detail-page')).toBeVisible();
    await openQuickCreate(page, 'Add entry');
    const entryDialog = page.getByRole('dialog', { name: 'Add entry' });
    await expectCompactDateTime(entryDialog.locator('.activity-date-time-row'));
    await entryDialog.getByRole('button', { name: 'Close dialog' }).click();

    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
