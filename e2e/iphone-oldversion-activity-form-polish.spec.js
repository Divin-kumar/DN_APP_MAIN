import { test, expect } from '@playwright/test';
import { seedGuest, fixtureMoments, calendarDate } from './fixtures.js';

// A single Activity owns dated content. No Diary auto-append or Journal
// destination selection; these journeys use disposable Guest storage only.
for (const [width, height, theme] of [[320, 694, 'dark'], [390, 844, 'light'], [430, 932, 'dark']]) {
  test(`Detail universal + offers a content-only Add entry form at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    const errors = await seedGuest(page, { theme, moments, incomes: [], expenses: [] });
    await page.goto('/events/moment-one/activities/shared');
    await expect(page.locator('.activity-detail-heading h1')).toHaveText('Book a lakeside stay');
    await page.getByRole('button', { name: 'Open quick create menu' }).click();
    await page.getByRole('group', { name: 'Quick create actions' })
      .getByRole('button', { name: 'Add entry', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add entry' });
    await expect(dialog.locator('form.dn-entry-add-form')).toBeVisible();
    await expect(dialog.getByText('Book a lakeside stay')).toBeVisible();
    const content = dialog.getByRole('textbox', { name: 'Entry content' });
    await expect(content).toBeVisible();
    await expect(content).not.toBeFocused();
    await expect(dialog.locator('input[type="date"]')).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Activity title' })).toHaveCount(0);
    await expect(dialog.getByRole('combobox', { name: 'Journal entry action' })).toHaveCount(0);
    await expect(dialog.getByRole('combobox', { name: 'Journal append destination' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Save entry' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });

  test(`Moment Activity creation stays independent and unfocused at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    const errors = await seedGuest(page, { theme, moments, incomes: [], expenses: [] });
    await page.goto('/events/moment-one/activities?create=activity');
    const dialog = page.getByRole('dialog', { name: 'Add activity' });
    await expect(dialog.locator('form.dn-activity-create-workspace')).toBeVisible();
    const title = dialog.getByRole('textbox', { name: 'Activity title' });
    await expect(title).toBeVisible();
    await expect(title).not.toBeFocused();
    await expect(dialog.getByRole('textbox', { name: 'Description (optional)' })).toBeHidden();
    await dialog.locator('details').filter({ has: dialog.getByText('Description', { exact: true }) }).locator('summary').click();
    await expect(dialog.getByRole('textbox', { name: 'Description (optional)' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Journal entry action' })).toHaveCount(0);
    await expect(dialog.getByRole('combobox', { name: 'Journal append destination' })).toHaveCount(0);
    await expect(dialog.getByRole('combobox', { name: 'Activity priority' })).toBeHidden();
    await dialog.getByText('More options', { exact: true }).click();
    await expect(dialog.getByRole('combobox', { name: 'Activity priority' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
    expect(errors).toEqual([]);
  });
}

test('Add entry saves only inside the opened Activity, including a different date', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const moments = fixtureMoments();
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/moment-one/activities/shared');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Add entry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add entry' });
  await dialog.getByRole('textbox', { name: 'Entry content' }).fill('A later note from a different day');
  await dialog.locator('input[type="date"]').fill(calendarDate(2));
  await dialog.getByRole('button', { name: 'Save entry' }).click();
  await expect(dialog).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
  const updated = stored.find((moment) => moment.id === 'moment-one').activities.find((activity) => activity.id === 'shared');
  const original = moments[0].activities[0];
  expect(updated.id).toBe(original.id);
  expect(updated.description).toBe(original.description);
  // The first scoped save normalizes legacy nested expenses with extra
  // financial metadata. Check that their original identity and money survive.
  for (const expense of original.expenses) {
    const retained = updated.expenses.find((item) => item.id === expense.id);
    expect(retained, 'preserved expense ' + expense.id).toBeTruthy();
    expect(retained.amount).toBe(expense.amount);
    expect(retained.date).toBe(expense.date);
    if (expense.name) expect(retained.name).toBe(expense.name);
  }
  expect(updated.extra).toEqual(original.extra);
  expect(updated.entries).toHaveLength(1);
  expect(updated.entries[0].date).toBe(calendarDate(2));
  expect(updated.entries[0].description).toContain('A later note from a different day');
  const unrelated = stored.find((moment) => moment.id === 'moment-two').activities[0];
  expect(unrelated.id).toBe(moments[1].activities[0].id);
  expect(unrelated.title).toBe(moments[1].activities[0].title);
  await expect(page.locator('.dn-content-row')).toHaveCount(2);
  await expect(page.locator('.dn-content-row-date')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Historic missing time is shown before timed rows without changing saved content', async ({ page }) => {
  const moments = fixtureMoments();
  const activity = moments[0].activities[0];
  activity.entries = [
    { id: 'late', date: activity.date, time: '16:45', description: 'Late update' },
    { id: 'untimed', date: activity.date, description: 'Old update without time' },
    { id: 'early', date: activity.date, time: '08:00', description: 'Early update' },
  ];
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('.dn-content-row-body')).toHaveCount(4);
  const text = await page.locator('.dn-content-row-body').allTextContents();
  expect(text).toHaveLength(4);
  expect(text[0]).toContain('Travel notes');
  expect(text[1]).toContain('Old update without time');
  expect(text[2]).toContain('Early update');
  expect(text[3]).toContain('Late update');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
  expect(errors).toEqual([]);
});

test.describe('Touch landscape composer focus safety', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('landscape Activity creation does not auto-open its title keyboard', async ({ page }) => {
    const moments = fixtureMoments();
    await page.setViewportSize({ width: 844, height: 390 });
    const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
    await page.goto('/events/moment-one/activities?create=activity');
    const dialog = page.getByRole('dialog', { name: 'Add activity' });
    await expect(dialog.getByRole('textbox', { name: 'Activity title' })).not.toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
    expect(errors).toEqual([]);
  });
});
