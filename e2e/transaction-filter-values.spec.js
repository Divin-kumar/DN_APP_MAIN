import { test, expect } from '@playwright/test';
import { accountScope, seedGuest } from './fixtures.js';

const moments = [{ id: 'money-moment', name: 'Payment review', type: 'Personal', date: '2026-10-20',
  activities: [{ id: 'money-activity', title: 'Supplies', date: '2026-10-20', expenses: [] }], attachments: [], memories: [] }];
const incomes = [
  { id: 'cash-income', name: 'Cash fund', type: 'Other', amount: 1000, date: '2026-10-20', eventId: 'money-moment', paymentMethod: 'Cash' },
  { id: 'online-income', name: 'Online fund', type: 'Other', amount: 500, date: '2026-10-21', eventId: 'money-moment', paymentMethod: 'Online' },
];
const expenses = [
  { id: 'cash-expense', name: 'Cash supplies', category: 'Other', amount: 250, date: '2026-10-20', eventId: 'money-moment', paymentMethod: 'Cash' },
  { id: 'online-expense', name: 'Online supplies', category: 'Other', amount: 100, date: '2026-10-21', eventId: 'money-moment', paymentMethod: 'Online' },
  { id: 'legacy-expense', name: 'Older supplies', category: 'Other', amount: 75, date: '2026-10-21', eventId: 'money-moment' },
];
const snapshot = (page) => page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map((key) => localStorage.getItem(key)));
async function openFilters(page) {
  const button = page.getByRole('button', { name: /^Filters and sort/ });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}
async function select(page, name, value) {
  await page.getByRole('combobox', { name, exact: true }).last().click();
  const search = page.locator('.dropdown-menu-portal input[type="search"]');
  if (await search.count()) await search.fill(value);
  await page.getByRole('option', { name: value, exact: true }).click();
}
async function addFilter(page, field, value, comparison = 'Is') {
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await select(page, 'Filter by', field);
  await select(page, 'Comparison', comparison);
  if (value) await select(page, `Value for ${field}`, value);
}
async function totals(page, isMoment, values) {
  const amounts = isMoment ? page.locator('.moment-finance-summary dd') : page.locator('.dn-finance-metric strong');
  await expect(amounts).toHaveText(values);
}

test('configured filter choices stay scoped when switching from Guest to a synthetic account', async ({ page }) => {
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/financials');
  await totals(page, false, ['₹0', '₹0', '₹0']);
  await page.evaluate(async () => {
    const app = (await import('/src/store/useAppStore.js')).default;
    await app.getState().setAdminValues({ paymentMethods: ['Guest wallet'] });
  });
  await openFilters(page);
  await addFilter(page, 'Payment method', 'Guest wallet');
  await accountScope(page, 'payment-choice-owner', moments);
  await page.evaluate(async () => {
    const app = (await import('/src/store/useAppStore.js')).default;
    app.setState({ adminValues: { paymentMethods: ['Account wallet'] }, adminValuesOwner: 'payment-choice-owner' });
  });
  await openFilters(page);
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await select(page, 'Filter by', 'Payment method');
  await page.getByRole('combobox', { name: 'Value for Payment method', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Account wallet', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Guest wallet', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
  const guestLists = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_admin_values')));
  expect(guestLists.paymentMethods.map((entry) => entry.value)).toEqual(['Guest wallet']);
  expect(errors).toEqual([]);
});

for (const width of [320, 1280]) test(`payment filters and search reconcile both transaction pages at ${width}px`, async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width, height: 844 });
  const errors = await seedGuest(page, { moments, incomes, expenses });
  await page.goto('/financials');
  await totals(page, false, ['₹1,500', '₹425', '₹1,075']);
  const before = await snapshot(page);
  for (const [route, isMoment] of [['/financials', false], ['/events/money-moment/transactions', true]]) {
    await page.goto(route);
    await openFilters(page);
    await addFilter(page, 'Payment method', 'Cash');
    await totals(page, isMoment, ['₹1,000', '₹250', '₹750']);
    await expect(page.locator('.dn-transactions-results .dn-transaction-card')).toHaveCount(2);
    await page.reload();
    await totals(page, isMoment, ['₹1,000', '₹250', '₹750']);
    await page.getByRole('combobox', { name: /Change Payment method filter/ }).click();
    await page.getByRole('option', { name: 'Online', exact: true }).click();
    await totals(page, isMoment, ['₹500', '₹100', '₹400']);
    await openFilters(page);
    await addFilter(page, 'Type', 'Expense');
    await totals(page, isMoment, ['₹0', '₹100', '-₹100']);
    const search = page.getByRole('searchbox', { name: isMoment ? 'Search Moment transactions' : 'Search transactions', exact: true });
    await search.fill('No matching title');
    await search.press('Enter');
    await totals(page, isMoment, ['₹0', '₹0', '₹0']);
    await search.fill('');
    await search.press('Enter');
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await addFilter(page, 'Payment method', null, 'Not specified');
    await totals(page, isMoment, ['₹0', '₹75', '-₹75']);
    await expect(page.locator('.dn-transactions-results .dn-transaction-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await totals(page, isMoment, ['₹1,500', '₹425', '₹1,075']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(await snapshot(page)).toEqual(before);
  expect(errors).toEqual([]);
});

for (const width of [320, 1280]) test(`Settings payment choices reach forms, filters and retained history at ${width}px`, async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width, height: 844 });
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/settings/code-lists');
  const section = page.locator('.code-list-section').filter({ has: page.getByRole('heading', { name: 'Payment Methods', exact: true }) });
  await section.getByRole('textbox', { name: 'Add payment method' }).fill('UPI');
  await section.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(section.getByRole('button', { name: /^UPI\. Tap/ })).toBeVisible();
  const preferences = page.getByRole('region', { name: 'List sorting and filters preferences' });
  await preferences.getByRole('button', { name: /Transactions filters/ }).click();
  await addFilter(page, 'Payment method', 'UPI');
  await page.goto('/financials/transactions?create=expense');
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' });
  await dialog.getByRole('textbox', { name: 'Title *', exact: true }).fill('UPI supplies');
  await dialog.getByRole('spinbutton').fill('120');
  await dialog.getByRole('radio', { name: 'UPI', exact: true }).check();
  await select(page, 'Linked Moment', 'Payment review');
  await select(page, 'Linked Activity', 'Supplies');
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator('.dn-transaction-card').filter({ hasText: 'UPI supplies' });
  await expect(card).toContainText('UPI');
  await totals(page, false, ['₹0', '₹120', '-₹120']);
  await page.reload();
  await expect(card).toContainText('UPI');
  const stored = await page.evaluate(() => ({ expense: JSON.parse(localStorage.getItem('dn_guest_expenses'))[0],
    mirror: JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0].activities[0].expenses[0] }));
  expect(stored.expense.paymentMethod).toBe('UPI');
  expect(stored.mirror.paymentMethod).toBe('UPI');
  const before = await snapshot(page);
  await page.goto('/settings/code-lists');
  await section.getByRole('button', { name: /^UPI\. Tap/ }).click();
  await page.getByRole('menuitem', { name: 'Disable', exact: true }).click();
  await expect(section).toContainText('Inactive');
  expect(await snapshot(page)).toEqual(before);
  await page.goto('/financials');
  await totals(page, false, ['₹0', '₹120', '-₹120']);
  await card.locator('.dn-transaction-copy > strong').click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Transaction' });
  await expect(editor.getByRole('radio', { name: 'UPI', exact: true })).toBeChecked();
  await expect(editor).toContainText('saved method is no longer active');
  await editor.getByRole('textbox', { name: 'Title *', exact: true }).fill('Updated supplies');
  await editor.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(editor).toHaveCount(0);
  const updated = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_expenses'))[0]);
  expect(updated.id).toBe(stored.expense.id);
  expect(updated.paymentMethod).toBe('UPI');
  await page.goto('/financials/transactions?create=income');
  await expect(page.getByRole('dialog').getByRole('radio', { name: 'UPI', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
