import { test, expect } from '@playwright/test';
import { addOriginal, fixtureMoments, seedGuest } from './fixtures.js';

test('Moments always follow recorded Event Date, including across past and future years', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].date = '2027-11-20'; moments[1].date = '2025-01-08';
  moments[0].createdAt = '2024-01-01'; moments[1].createdAt = '2026-12-31';
  await seedGuest(page, { moments });
  await page.goto('/events');
  const cards = page.locator('.life-journey-items .event-story-main');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText('A separate Moment');
  await expect(cards.nth(1)).toContainText('Weekend in Ooty');
  await expect(cards.nth(0)).toContainText('08 Jan 2025');
  await page.reload();
  await expect(cards.nth(0)).toContainText('A separate Moment');
  await expect(page.getByRole('button', { name: 'Sort by Name, ascending' })).toHaveCount(0);
});

test('Summary photos belong to their Moment/Activity card, never a footer gallery', async ({ page }) => {
  await seedGuest(page); await addOriginal(page, { count: 3 });
  await page.goto('/events');
  const card = page.getByRole('group', { name: /Weekend in Ooty/ });
  await card.focus(); await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Summary', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Moment summary', exact: true });
  await expect(dialog.locator('.event-summary-activities li').first().locator('.dn-attachment-tile')).toHaveCount(3);
  await expect(dialog.locator('.event-summary-activities li').first()).toContainText('Book a lakeside stay');
  await expect(dialog.locator('.moment-summary-media').first().locator('.dn-attachment-tile')).toHaveCount(1);
  await expect(dialog.locator('.moment-summary-attachments')).toHaveCount(0);
});

test('Dashboard sections remember separate visibility choices across reloads', async ({ page }) => {
  await seedGuest(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Hide Moments on dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide Activities on dashboard' }).click();
  await expect(page.getByRole('button', { name: 'Show Activities on dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide Moments on dashboard' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show Activities on dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide Moments on dashboard' }).click();
  await expect(page.getByRole('button', { name: 'Show Moments on dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Show Activities on dashboard' }).click();
  await expect(page.getByRole('button', { name: 'Hide Activities on dashboard' })).toBeVisible();
});

test('Advanced Activity conditions support nested filters, clear and saved presets', async ({ page }) => {
  await seedGuest(page); await page.goto('/activities');
  await page.getByRole('button', { name: 'Advanced filters', exact: true }).click();
  await page.getByRole('button', { name: 'Condition', exact: true }).click();
  await page.getByRole('combobox', { name: 'Condition field' }).selectOption('activity.title');
  await page.getByRole('combobox', { name: 'Condition operator' }).selectOption('contains');
  await page.locator('.dn-condition-rule input.dn-condition-value').fill('Book a');
  await expect(page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Open A different activity with the same ID', exact: true })).toHaveCount(0);
  await page.getByPlaceholder('Filter name').fill('My book plan');
  await page.getByRole('button', { name: 'Save filter', exact: true }).click();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Open A different activity with the same ID', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My book plan', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
