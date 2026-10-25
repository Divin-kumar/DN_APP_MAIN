import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest, activityDetailAction } from './fixtures.js';

test('detail shows actual content in reading order, compact file previews and recorded dates', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].activities[0].completed = true;
  moments[0].activities[0].completedAt = '2026-10-24T12:00:00Z';
  await seedGuest(page, { moments, incomes: [{ id: 'refund', name: 'Booking refund', amount: 250, date: '2026-10-25',
    eventId: 'moment-one', activityId: 'shared', type: 'Other' }] });
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  await expect(page.getByRole('navigation', { name: 'Activity parent' })).toContainText('Moment: Weekend in Ooty');
  await expect(page.locator('.activity-status-pill')).toHaveText('Completed');
  await expect(page.getByRole('button', { name: /^(Edit|Complete|Close|Reopen|Delete activity)$/ })).toHaveCount(0);
  await expect(page.getByText(/^(Parent Moment|Finance|Transaction history|All Moment transactions|Manage transactions|No description added\.|No attachments added\.)$/)).toHaveCount(0);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
  await page.locator('.activity-attachments input[type=file]').setInputFiles({ name: 'Field notes.final.png', mimeType: 'image/png', buffer: png });
  const preview = page.getByRole('button', { name: 'Preview Field notes.final.png', exact: true });
  await expect(preview).toContainText('Field notes.final.png');
  await expect(preview.locator('small')).toHaveCount(0);
  await preview.scrollIntoViewIfNeeded();
  await expect.poll(() => preview.locator('img').evaluate((node) => node.naturalWidth)).toBe(1);
  const thumbnail = await preview.locator('img').boundingBox();
  expect(thumbnail.width).toBe(44); expect(thumbnail.height).toBe(44);
  await expect(page.locator('.activity-cover img')).toHaveCount(1);
  const totals = page.getByRole('group', { name: 'Totals for this Activity' });
  await expect(totals.locator('dd')).toHaveText(['₹250', '₹120', '₹130']);
  await expect(totals).not.toContainText('Totals for this Activity');
  const readingOrder = ['.activity-cover', '.activity-detail-heading', '.activity-detail-metadata', '.activity-description',
    '.dn-transactions-results', '.moment-finance-summary', '.activity-attachments', '.activity-detail-footer'];
  expect(await page.evaluate((selectors) => selectors.every((selector, index) => !index || Boolean(
    document.querySelector(selectors[index - 1]).compareDocumentPosition(document.querySelector(selector)) & Node.DOCUMENT_POSITION_FOLLOWING)), readingOrder)).toBe(true);
  await expect(page.locator('.activity-detail-footer')).toHaveText('Created20 Oct 2026Completed24 Oct 2026');
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await preview.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Download original' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
});

test('the metadata menu closes/reopens, edits, restores and confirms deletion without touching standalone finance', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/activities/shared');
  const trigger = page.getByRole('button', { name: 'Activity options', exact: true });
  await trigger.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem')).toHaveText(['Close', 'Edit', 'Cancel', 'Delete']);
  await expect(page.getByRole('menuitem', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.activity-status-pill')).toHaveText('Completed');
  await expect(page.locator('.activity-detail-footer')).toContainText('Completed');
  await expect(page.getByRole('status').filter({ hasText: 'Activity completed' })).toBeAttached();
  await activityDetailAction(page, 'Reopen');
  await expect(page.locator('.activity-status-pill')).toHaveText('In progress');
  await expect(page.locator('.activity-detail-footer')).not.toContainText('Completed');
  await activityDetailAction(page, 'Edit');
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Activity title', exact: true })).toHaveValue('Book a lakeside stay');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await activityDetailAction(page, 'Cancel');
  await expect(page.locator('.activity-status-pill')).toHaveText('Cancelled');
  await trigger.click();
  await expect(page.getByRole('menuitem')).toHaveText(['Restore', 'Edit', 'Delete']);
  await page.getByRole('menuitem', { name: 'Restore', exact: true }).click();
  await expect(page.locator('.activity-status-pill')).toHaveText('In progress');
  const ledger = await page.evaluate(() => localStorage.getItem('dn_guest_expenses'));
  const sibling = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0].activities[1]);
  await activityDetailAction(page, 'Delete');
  const confirmation = page.getByRole('dialog', { name: 'Delete activity?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  await activityDetailAction(page, 'Delete');
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/activities$/);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_expenses'))).toBe(ledger);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0].activities[0])).toEqual(sibling);
});

test('empty sections stay quiet and absent legacy metadata does not invent dates or write records', async ({ page }) => {
  const moments = fixtureMoments();
  const activity = moments[0].activities[0];
  activity.description = ''; activity.expenses = []; activity.date = ''; activity.createdAt = 'bad date'; delete activity.completedAt;
  await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('h1')).toHaveText(activity.title);
  await expect(page.locator('.activity-detail-metadata')).toContainText('Date to be decided');
  await expect(page.locator('.activity-description, .activity-detail-footer')).toHaveCount(0);
  await expect(page.getByText(/^(No description added\.|No attachments added\.|No transactions have been recorded for this Activity\.)$/)).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Totals for this Activity' }).locator('dd')).toHaveText(['₹0', '₹0', '₹0']);
  await expect(page.getByRole('heading', { name: 'Attachments', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add attachment', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
});
