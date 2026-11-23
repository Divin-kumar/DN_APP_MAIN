import { test, expect } from '@playwright/test';
import { calendarDate, fixtureMoments, seedGuest } from './fixtures.js';

test('desktop dashboard adapts to sparse sections and record lists keep their context', async ({ page }) => {
  await page.setViewportSize({ width: 1363, height: 936 });
  const moments = fixtureMoments().map(moment => ({ ...moment, date: calendarDate(-5) }));
  const activity = moments[0].activities[0];
  await seedGuest(page, { moments });
  await page.goto('/dashboard');
  const dashboard = page.locator('.dashboard-compact');
  await expect(dashboard).toHaveAttribute('data-activity-focus', 'true');
  const tasks = await dashboard.locator('.dn-dashboard-tasks').boundingBox();
  const activities = await dashboard.locator('.dashboard-activities-preview').boundingBox();
  expect(activities.width).toBeGreaterThan(tasks.width * 1.4);
  await page.evaluate(task => localStorage.setItem('dn_guest_tasks', JSON.stringify([task])), {
    id: 'linked', title: activity.title, status: 'in-progress', dueDate: calendarDate(1),
    momentId: moments[0].id, activityId: activity.id,
  });
  await page.goto('/tasks');
  await expect(page.locator('.dn-task-context').first()).toHaveText(moments[0].name);
  await page.getByRole('link', { name: 'Moments', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Moments', exact: true })).toBeVisible();
  await expect(page.locator('.dn-sidebar [aria-current="page"]')).toHaveAccessibleName('Moments');
  await page.getByRole('link', { name: 'Activities', exact: true }).click();
  const card = page.locator('.dn-v2-activity-card').filter({ hasText: activity.title });
  await expect(card.locator('.dn-v2-activity-cover svg')).toHaveCount(1);
  await expect(card.locator('.event-activity-context [aria-hidden="true"]')).toHaveText('Journal');
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  const row = page.locator('.dn-transactions-page .dn-transaction-card').filter({ hasText: 'Room deposit' });
  const title = await row.locator('.dn-transaction-copy > strong').boundingBox();
  const details = await row.locator('summary').boundingBox();
  const amount = await row.locator('.dn-transaction-value').boundingBox();
  expect(details.x).toBeGreaterThan(amount.x + amount.width);
  expect(details.y).toBeLessThan(title.y + title.height + 5);
});

test('quick transaction confirmation follows sheet dismissal at iPhone Plus size', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seedGuest(page);
  await page.goto('/financials/transactions');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('button', { name: 'Transaction', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' });
  await dialog.getByRole('textbox', { name: 'Title *' }).fill('Save timing');
  await dialog.getByRole('spinbutton', { name: 'Amount *' }).fill('1');
  await dialog.getByRole('radio', { name: 'Cash' }).check();
  await page.evaluate(() => {
    window.auditToastOverlap = false;
    const observer = new MutationObserver(() => {
      if (document.querySelector('.app-toast-message')?.textContent !== 'Transaction added') return;
      window.auditToastOverlap = Boolean(document.querySelector('.dn-transaction-dialog'));
      observer.disconnect();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(page.locator('.app-toast-message')).toHaveText('Transaction added');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.auditToastOverlap)).toBe(false);
});
