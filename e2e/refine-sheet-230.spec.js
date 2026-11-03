import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

const savedListState = (page) => page.evaluate(() =>
  Object.fromEntries(Object.keys(localStorage).filter((key) =>
    key.startsWith('dn_list_state_')).sort().map((key) => [key, localStorage.getItem(key)])));

test('Moments Refine draft discards sort/filter on Cancel and Escape', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/events');
  const prior = await savedListState(page);
  const refine = page.getByRole('button', { name: /^Filters and sort/ });
  await refine.click();
  const sheet = page.getByRole('dialog', { name: 'Moment filters' });
  await expect(sheet).toBeVisible();
  const chips = sheet.getByRole('group', { name: 'Sort moments' });
  await chips.getByRole('button', { name: /^Sort by Name/ }).click();
  await expect(chips.getByRole('button', { name: 'Sort by Name, ascending' })).toHaveAttribute('aria-pressed', 'true');
  const priorRules = await sheet.locator('.dn-condition-rule').count();
  await sheet.getByRole('button', { name: 'Add filter' }).click();
  await expect(sheet.locator('.dn-condition-rule')).toHaveCount(priorRules + 1);
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  expect(await savedListState(page)).toEqual(prior);

  await refine.click();
  await sheet.getByRole('button', { name: /^Sort by Name/ }).click();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  expect(await savedListState(page)).toEqual(prior);
  expect(errors).toEqual([]);
});

test('Moments Refine applies draft sort only when Show results is pressed', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/events');
  const priorRecords = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const refine = page.getByRole('button', { name: /^Filters and sort/ });
  await refine.click();
  const sheet = page.getByRole('dialog', { name: 'Moment filters' });
  const chips = sheet.getByRole('group', { name: 'Sort moments' });
  await chips.getByRole('button', { name: /^Sort by Name/ }).click();
  await chips.getByRole('button', { name: 'Sort by Name, ascending' }).click();
  await expect(chips.getByRole('button', { name: 'Sort by Name, descending' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Show results' }).click();
  await expect(sheet).toHaveCount(0);
  await refine.click();
  await expect(sheet.getByRole('button', { name: 'Sort by Name, descending' })).toHaveAttribute('aria-pressed', 'true');
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(priorRecords);
  expect(errors).toEqual([]);
});

const sharedLists = [
  { route: '/activities', title: 'Activity filters', sort: 'Sort activities' },
  { route: '/financials/transactions', title: 'Transaction filters', sort: 'Sort transactions' },
  { route: '/events/moment-one/activities', title: 'Activity filters', sort: 'Sort activities' },
  { route: '/events/moment-one/transactions', title: 'Moment transaction filters', sort: 'Sort Moment transactions' },
];
for (const list of sharedLists) {
  test(list.route + ' uses the same cancellable Refine sheet without changing Guest records', async ({ page }) => {
    const errors = await seedGuest(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(list.route);
    const recordSnapshot = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    const trigger = page.getByRole('button', { name: /^Filters and sort/ });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: list.title });
    await expect(sheet).toBeVisible();
    const options = sheet.getByRole('group', { name: list.sort });
    await expect(options.getByRole('button', { name: /^Sort by / }).first()).toBeVisible();
    const priorRules = await sheet.locator('.dn-condition-rule').count();
    await sheet.getByRole('button', { name: 'Add filter' }).click();
    await expect(sheet.locator('.dn-condition-rule')).toHaveCount(priorRules + 1);
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(sheet).toHaveCount(0);
    expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)))).toEqual(recordSnapshot);
    expect(errors).toEqual([]);
  });
}
