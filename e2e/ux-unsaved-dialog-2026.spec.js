import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Unintended dismissal should retain draft; explicit Cancel intentionally discards.
test('Task sheet protects edited drafts from accidental Close', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { theme: 'light' });
  await page.goto('/tasks');
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_tasks'));
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New Task' });
  const title = dialog.getByRole('textbox', { name: 'Task title' });
  await title.fill('Keep my draft');
  await expect(title).toHaveValue('Keep my draft');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog.getByText('Discard unsaved changes?')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  await expect(title).toHaveValue('Keep my draft');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_tasks'))).toBe(before);
  expect(errors).toEqual([]);
});

test('Moment date/time stays visible and Close protects a draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { theme: 'dark' });
  await page.goto('/events?create=event');
  const dialog = page.getByRole('dialog', { name: 'New Moment' });
  await expect(dialog.locator('.activity-date-time-row input[type="date"]')).toBeVisible();
  await expect(dialog.locator('.activity-date-time-row input[type="time"]')).toBeVisible();
  const title = dialog.getByRole('textbox', { name: 'Moment name' });
  await title.fill('A lovely day');
  await expect(title).toHaveValue('A lovely day');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog.getByText('Discard unsaved changes?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  await expect(title).toHaveValue('A lovely day');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});
