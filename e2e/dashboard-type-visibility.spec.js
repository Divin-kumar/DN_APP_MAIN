import { test, expect } from '@playwright/test';
import { accountScope, seedGuest } from './fixtures.js';

test.use({ timezoneId: 'Asia/Kolkata' });

const moments = [
  { id: 'personal', name: 'Personal moment', type: 'Personal', date: '2026-10-26', activities: [
    { id: 'personal-today', title: 'Personal task today', date: '2026-10-26' },
    { id: 'personal-past', title: 'Personal task last year', date: '2025-10-26' },
  ] },
  { id: 'vacation', name: 'Vacation moment', type: 'Vacation', date: '2026-10-26', activities: [
    { id: 'vacation-today', title: 'Vacation task today', date: '2026-10-26' },
    { id: 'vacation-past', title: 'Vacation task last year', date: '2025-10-26' },
  ] },
  { id: 'custom', name: 'Family moment', type: 'Other', customType: 'Family', date: '2026-10-26', activities: [
    { id: 'custom-today', title: 'Family task today', date: '2026-10-26' },
  ] },
  { id: 'generic', name: 'Generic Other moment', type: 'Other', customType: 'One-off', date: '2026-10-26', activities: [
    { id: 'generic-today', title: 'Generic task today', date: '2026-10-26' },
  ] },
];

async function seedTypeSettings(page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('dn_type_settings_seeded')) return;
    localStorage.setItem('dn_guest_admin_values', JSON.stringify({ eventTypes: [
      'Personal', { value: 'Vacation', label: 'Vacation' },
      { value: 'Family', label: 'Family' },
      { value: 'Other', label: 'Other', showInDashboardUpcoming: false, showActivitiesOnDashboard: false },
    ] }));
    localStorage.setItem('dn_type_settings_seeded', 'true');
  });
}

async function editType(page, name) {
  await page.goto('/settings/code-lists');
  await page.getByRole('button', { name: `${name}. Tap or swipe either direction for actions.`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  return page.getByRole('dialog', { name: 'Edit moment type', exact: true });
}

const items = (page, section) => page.getByRole('region', { name: section, exact: true }).locator(section === 'Moments' ? '.dashboard-moment-row' : '.dashboard-activity-card');

test('Moment type switches independently save Dashboard Moments and Activities visibility', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date('2026-10-26T09:30:00+05:30') });
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await seedTypeSettings(page);
  await page.goto('/dashboard');
  await expect(items(page, 'Activities')).toHaveCount(3);
  await expect(items(page, 'Moments')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Open Family task today', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Generic task today', exact: true })).toHaveCount(0);

  let editor = await editType(page, 'Personal');
  await expect(editor.getByRole('switch', { name: 'Show Moments on Dashboard', exact: true })).toBeChecked();
  await expect(editor.getByRole('switch', { name: 'Show Activities on Dashboard', exact: true })).toBeChecked();
  await editor.getByRole('switch', { name: 'Show Activities on Dashboard', exact: true }).click();
  await editor.getByRole('button', { name: 'Save moment type', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.goto('/dashboard');
  await expect(items(page, 'Activities')).toHaveCount(2);
  await expect(items(page, 'Moments')).toHaveCount(3);
  await expect(page.getByRole('region', { name: 'Moments', exact: true })).toContainText('Personal moment');
  await expect(page.getByRole('button', { name: 'Open Personal task today', exact: true })).toHaveCount(0);
  await page.getByRole('group', { name: 'Activity dates', exact: true }).getByRole('button', { name: 'On This Day', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Vacation task last year', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Personal task last year', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open Personal task today', exact: true })).toHaveCount(0);
  await expect(items(page, 'Activities')).toHaveCount(2);

  editor = await editType(page, 'Personal');
  await expect(editor.getByRole('switch', { name: 'Show Activities on Dashboard', exact: true })).not.toBeChecked();
  await editor.getByRole('switch', { name: 'Show Activities on Dashboard', exact: true }).click();
  await editor.getByRole('switch', { name: 'Show Moments on Dashboard', exact: true }).click();
  await editor.getByRole('button', { name: 'Save moment type', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.goto('/dashboard');
  await expect(items(page, 'Activities')).toHaveCount(3);
  await expect(items(page, 'Moments')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Open Personal task today', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Moments', exact: true })).not.toContainText('Personal moment');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_admin_values')).eventTypes.find(({ value }) => value === 'Personal'));
  expect(saved.showInDashboardUpcoming).toBe(false);
  expect(saved.showActivitiesOnDashboard).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
  expect(errors).toEqual([]);
});

test('synthetic account Dashboard type choices do not inherit or overwrite Guest visibility', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T09:30:00+05:30') });
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await seedTypeSettings(page);
  await page.goto('/dashboard');
  // Ensure Guest auth/data hydration has settled before simulating a different account.
  // Otherwise a late Guest initialization can overwrite the synthetic test scope.
  await expect(items(page, 'Activities')).toHaveCount(3);
  const guestSettings = await page.evaluate(() => localStorage.getItem('dn_guest_admin_values'));
  await accountScope(page, 'dashboard-types-owner', moments);
  await page.evaluate(async () => {
    const app = (await import('/src/store/useAppStore.js')).default;
    app.setState({ adminValuesOwner: 'dashboard-types-owner', adminValuesLoading: false, adminValuesError: null,
      adminValues: { eventTypes: [{ value: 'Personal', showInDashboardUpcoming: true, showActivitiesOnDashboard: false },
        { value: 'Vacation', showInDashboardUpcoming: false, showActivitiesOnDashboard: true },
        { value: 'Other', showInDashboardUpcoming: false, showActivitiesOnDashboard: false }] } });
  });
  await expect(items(page, 'Activities')).toHaveCount(1);
  await expect(items(page, 'Moments')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open Personal task today', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Vacation task today', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_admin_values'))).toBe(guestSettings);
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
  expect(errors).toEqual([]);
});
