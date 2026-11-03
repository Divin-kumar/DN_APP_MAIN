import { test, expect } from '@playwright/test';
import { accountScope, fixtureMoments, seedGuest } from './fixtures.js';

async function openSort(page, label) {
  const trigger = page.getByRole('button', { name: /^Filters and sort(?:,|$)/ });
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('group', { name: label })).toBeVisible();
  return sheet;
}
async function pickSort(sheet, label, field) {
  await sheet.getByRole('group', { name: label })
    .getByRole('button', { name: new RegExp('^Sort by ' + field + '(?:,|$)') }).click();
}
async function apply(sheet) {
  await sheet.getByRole('button', { name: 'Show results' }).click();
  await expect(sheet).toHaveCount(0);
}

test('Moments sort chips toggle, persist and Reset restores the saved baseline only after Apply', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].date = '2025-01-08'; moments[1].date = '2027-11-20';
  await seedGuest(page, { moments }); await page.goto('/events');
  const cards = page.locator('.life-journey-items .event-story-main');
  await expect(cards.first()).toContainText('Weekend in Ooty');
  const source = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));

  let sheet = await openSort(page, 'Sort moments');
  await pickSort(sheet, 'Sort moments', 'Name');
  await expect(cards.first()).toContainText('Weekend in Ooty');
  await apply(sheet);
  await expect(cards.first()).toContainText('A separate Moment');

  sheet = await openSort(page, 'Sort moments');
  await pickSort(sheet, 'Sort moments', 'Name');
  await expect(sheet.getByRole('button', { name: 'Sort by Name, descending' })).toBeVisible();
  await apply(sheet);
  await expect(cards.first()).toContainText('Weekend in Ooty');

  await page.reload();
  sheet = await openSort(page, 'Sort moments');
  await expect(sheet.getByRole('button', { name: 'Sort by Name, descending' })).toHaveAttribute('aria-pressed', 'true');
  await sheet.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Sort by Event date, ascending' })).toBeVisible();
  await apply(sheet);
  await expect(cards.first()).toContainText('Weekend in Ooty');
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(source);
});

test('Moment sort state stays separate between Guest and synthetic Account', async ({ page }) => {
  const moments = fixtureMoments();
  await seedGuest(page, { moments }); await page.goto('/events');
  let sheet = await openSort(page, 'Sort moments');
  await pickSort(sheet, 'Sort moments', 'Name'); await apply(sheet);
  await accountScope(page, 'sort-owner', moments);
  sheet = await openSort(page, 'Sort moments');
  await expect(sheet.getByRole('button', { name: 'Sort by Event date, ascending' })).toBeVisible();
  await pickSort(sheet, 'Sort moments', 'Status'); await apply(sheet);
  const values = await page.evaluate(() => ['guest', 'account:sort-owner'].map(
    (scope) => JSON.parse(localStorage.getItem(`dn_list_state_${encodeURIComponent(scope)}_moments`)).field));
  expect(values).toEqual(['name', 'status']);
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
});

test('Main and Moment Transactions sort independently without changing totals or records', async ({ page }) => {
  await seedGuest(page); await page.goto('/financials');
  const source = await page.evaluate(() => ['dn_guest_incomes', 'dn_guest_expenses', 'dn_guest_eventGroups'].map((key) => localStorage.getItem(key)));
  const totals = await page.locator('.dn-finance-summary-grid').innerText();
  const cards = page.locator('.dn-transactions-results .dn-transaction-copy strong');

  let sheet = await openSort(page, 'Sort transactions');
  await pickSort(sheet, 'Sort transactions', 'Amount');
  await apply(sheet);
  await expect(cards.first()).toHaveText('Parking');
  sheet = await openSort(page, 'Sort transactions');
  await pickSort(sheet, 'Sort transactions', 'Amount');
  await apply(sheet);
  await expect(cards.first()).toHaveText('Unrelated expense');
  expect(await page.locator('.dn-finance-summary-grid').innerText()).toBe(totals);

  await page.reload();
  sheet = await openSort(page, 'Sort transactions');
  await expect(sheet.getByRole('button', { name: 'Sort by Amount, descending' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await page.goto('/events/moment-one/transactions');
  sheet = await openSort(page, 'Sort Moment transactions');
  await expect(sheet.getByRole('button', { name: 'Sort by Date, descending' })).toBeVisible();
  await pickSort(sheet, 'Sort Moment transactions', 'Title');
  await apply(sheet);
  await page.goto('/financials');
  sheet = await openSort(page, 'Sort transactions');
  await expect(sheet.getByRole('button', { name: 'Sort by Amount, descending' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  expect(await page.evaluate(() => ['dn_guest_incomes', 'dn_guest_expenses', 'dn_guest_eventGroups'].map((key) => localStorage.getItem(key))).toEqual(source);
});
