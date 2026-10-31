import { test, expect } from '@playwright/test';
import { seedGuest, fixtureMoments } from './fixtures.js';

// CHG-238 | The same quiet Activity form language from universal + to Moment
// workspace, without opening the iPhone keyboard before the user taps a field.
for (const [width, height, theme] of [[320, 694, 'dark'], [390, 844, 'light'], [430, 932, 'dark']]) {
  test(`Detail universal + keeps contextual labels and compact actions at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    const errors = await seedGuest(page, { theme, moments, incomes: [], expenses: [] });
    await page.goto('/events/moment-one/activities/shared');
    await expect(page.locator('.activity-detail-heading h1')).toBeVisible();
    await page.getByRole('button', { name: 'Open quick create menu' }).click();
    await page.getByRole('group', { name: 'Quick create actions' })
      .getByRole('button', { name: 'Activity', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add an activity' });
    const form = dialog.locator('form.dn-activity-create-form');
    await expect(form).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Moment type' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Life moment' })).toContainText(moments[0].name);
    await expect(dialog.getByRole('combobox', { name: 'Journal entry action' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Journal append destination' })).toContainText('Book a lakeside stay');
    await expect(dialog.getByRole('textbox', { name: 'Entry title' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Activity priority' })).toBeVisible();
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const save = dialog.getByRole('button', { name: 'Save entry' });
    await expect(cancel).toBeVisible();
    await expect(save).toBeVisible();
    const alignment = await dialog.locator('.dn-activity-create-actions').evaluate((node) => {
      const [first, second] = node.querySelectorAll('button');
      const a = first.getBoundingClientRect(), b = second.getBoundingClientRect();
      return { oneRow: Math.abs(a.top - b.top) < 2, order: a.left < b.left,
        inside: a.left >= node.getBoundingClientRect().left - 1 && b.right <= node.getBoundingClientRect().right + 1 };
    });
    expect(alignment).toEqual({ oneRow: true, order: true, inside: true });
    await cancel.click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });

  test(`Moment composer does not summon keyboard immediately on ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    const errors = await seedGuest(page, { theme, moments, incomes: [], expenses: [] });
    await page.goto('/events/moment-one/activities?create=activity');
    const dialog = page.getByRole('dialog', { name: 'Add entry' });
    await expect(dialog).toBeVisible();
    const editor = dialog.locator('form.dn-activity-create-workspace');
    await expect(editor).toBeVisible();
    const title = dialog.getByRole('textbox', { name: 'Entry title' });
    await expect(title).toBeVisible();
    await expect(title).not.toBeFocused();
    await expect(dialog.getByRole('combobox', { name: 'Activity priority' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Journal entry action' })).toBeVisible();
    const actions = dialog.locator('.dn-activity-create-actions');
    await expect(actions.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Add entry' })).toBeVisible();
    await actions.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Changing Moment type from Journal Detail clears inherited append target', async ({ page }) => {
  const moments = [
    { id: 'journal', name: 'Private journal', type: 'Journal', date: '2026-10-30',
      activities: [{ id: 'entry', title: 'Original page', date: '2026-10-30' }], attachments: [] },
    { id: 'tasks', name: 'Tasks group', type: 'Project', date: '2026-10-30',
      activities: [{ id: 'task', title: 'Existing task', date: '2026-10-30' }], attachments: [] },
  ];
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/journal/activities/entry');
  await expect(page.locator('.activity-detail-heading h1')).toBeVisible();
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Activity', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add an activity' });
  await expect(dialog.getByRole('combobox', { name: 'Journal append destination' })).toContainText('Original page');
  await dialog.getByRole('combobox', { name: 'Moment type' }).click();
  await page.getByRole('option', { name: 'Project', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Life moment' })).toContainText('Choose a life moment');
  await dialog.getByRole('combobox', { name: 'Life moment' }).click();
  await page.getByRole('option', { name: 'Tasks group', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Journal entry action' })).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Activity title' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
  expect(errors).toEqual([]);
});
