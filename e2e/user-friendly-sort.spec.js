import { test, expect } from '@playwright/test';
import { accountScope, fixtureMoments, seedGuest } from './fixtures.js';

async function openSort(page, label) {
  const trigger = page.getByRole('button', { name: /^Filters and sort(?:,|$)/ });
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await expect(page.getByRole('combobox', { name: `${label} field`, exact: true })).toBeVisible();
}
async function chooseSort(page, label, option) {
  await page.getByRole('combobox', { name: `${label} field`, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('Moments offer explicit sort choices, reverse direction, persist and reset to their recorded chronology', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].date = '2025-01-08'; moments[1].date = '2027-11-20';
  await seedGuest(page, { moments }); await page.goto('/events');
  const cards = page.locator('.life-journey-items .event-story-main');
  await expect(cards.first()).toContainText('Weekend in Ooty');
  const source = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await openSort(page, 'Sort moments');
  await chooseSort(page, 'Sort moments', 'Name');
  await expect(cards.first()).toContainText('A separate Moment');
  await page.getByRole('button', { name: 'Sort descending', exact: true }).click();
  await expect(cards.first()).toContainText('Weekend in Ooty');
  await page.reload(); await openSort(page, 'Sort moments');
  await expect(page.getByRole('combobox', { name: 'Sort moments field', exact: true })).toContainText('Name');
  await expect(page.getByRole('button', { name: 'Sort ascending', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Sort moments field', exact: true })).toContainText('Event date');
  await expect(cards.first()).toContainText('Weekend in Ooty');
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(source);
});

test('Moment sort memory stays separate between Guest and a synthetic Account', async ({ page }) => {
  const moments = fixtureMoments();
  await seedGuest(page, { moments }); await page.goto('/events'); await openSort(page, 'Sort moments');
  await chooseSort(page, 'Sort moments', 'Name');
  await accountScope(page, 'sort-owner', moments);
  await openSort(page, 'Sort moments');
  await expect(page.getByRole('combobox', { name: 'Sort moments field', exact: true })).toContainText('Event date');
  await chooseSort(page, 'Sort moments', 'Status');
  const values = await page.evaluate(() => ['guest', 'account:sort-owner'].map((scope) => JSON.parse(localStorage.getItem(`dn_list_state_${encodeURIComponent(scope)}_moments`)).field));
  expect(values).toEqual(['name', 'status']);
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
});

test('Main and Moment Transactions sort independently while their totals and business records stay intact', async ({ page }) => {
  await seedGuest(page); await page.goto('/financials');
  const source = await page.evaluate(() => ['dn_guest_incomes', 'dn_guest_expenses', 'dn_guest_eventGroups'].map((key) => localStorage.getItem(key)));
  const totals = await page.locator('.dn-finance-summary-grid').innerText();
  const cards = page.locator('.dn-transactions-results .dn-transaction-copy strong');
  await openSort(page, 'Sort transactions'); await chooseSort(page, 'Sort transactions', 'Amount');
  await expect(cards.first()).toHaveText('Unrelated expense');
  await page.getByRole('button', { name: 'Sort ascending', exact: true }).click();
  await expect(cards.first()).toHaveText('Parking');
  expect(await page.locator('.dn-finance-summary-grid').innerText()).toBe(totals);
  await page.reload(); await openSort(page, 'Sort transactions');
  await expect(cards.first()).toHaveText('Parking');
  await page.goto('/events/moment-one/transactions');
  await openSort(page, 'Sort Moment transactions');
  await expect(page.getByRole('combobox', { name: 'Sort Moment transactions field', exact: true })).toContainText('Date');
  await chooseSort(page, 'Sort Moment transactions', 'Title');
  await expect(cards.first()).toHaveText('Parking');
  await page.goto('/financials'); await openSort(page, 'Sort transactions');
  await expect(page.getByRole('combobox', { name: 'Sort transactions field', exact: true })).toContainText('Amount');
  await expect(cards.first()).toHaveText('Parking');
  expect(await page.evaluate(() => ['dn_guest_incomes', 'dn_guest_expenses', 'dn_guest_eventGroups'].map((key) => localStorage.getItem(key)))).toEqual(source);
});
