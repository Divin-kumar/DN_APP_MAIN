import { test, expect } from '@playwright/test';
import { calendarDate, seedGuest } from './fixtures.js';

// Detail universal + adds dated writing to the opened Activity, regardless of
// its Diary/Journal/Tasks presentation. No new Activity or append target picker.
const fixture = () => [
  { id: 'daily', name: 'My month', type: 'Diary', date: calendarDate(-2),
    activities: [{ id: 'daily-day', eventId: 'daily', title: 'Daily notes',
      date: calendarDate(-2), entryMode: 'diary', entries: [
        { id: 'first-note', title: 'Early thought', description: 'Original', date: calendarDate(-2), time: '09:00' },
      ] }], attachments: [] },
  { id: 'journal', name: 'Weekend journal', type: 'Journal', date: calendarDate(-2),
    activities: [{ id: 'same', eventId: 'journal', title: 'Original memory', date: calendarDate(-2),
      description: 'Before we added more.' }], attachments: [] },
  { id: 'tasks', name: 'Project checklist', type: 'Project', date: calendarDate(-2),
    activities: [{ id: 'same', eventId: 'tasks', title: 'Existing task', date: calendarDate(-2) }], attachments: [] },
];
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
const begin = async (page) => {
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Add entry', exact: true }).click();
  return page.getByRole('dialog', { name: 'Add entry' });
};

for (const [width, height, theme] of [[390, 844, 'light'], [430, 932, 'dark']]) {
  for (const scenario of [
    { momentId: 'daily', activityId: 'daily-day' },
    { momentId: 'journal', activityId: 'same' },
    { momentId: 'tasks', activityId: 'same' },
  ]) {
    test(`Detail + adds to ${scenario.momentId}'s own Activity at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const initial = fixture();
      const errors = await seedGuest(page, { theme, moments: initial, incomes: [], expenses: [] });
      await page.goto(`/events/${scenario.momentId}/activities/${scenario.activityId}`);
      await expect(page.locator('.activity-detail-heading h1')).toBeVisible();
      const before = await read(page);
      const dialog = await begin(page);
      const activity = initial.find((item) => item.id === scenario.momentId).activities[0];
      await expect(dialog).toContainText(activity.title);
      await expect(dialog.getByRole('textbox', { name: 'Entry content' })).toBeVisible();
      await expect(dialog.locator('input[type="date"]')).toBeVisible();
      await expect(dialog.getByRole('combobox', { name: 'Life moment' })).toHaveCount(0);
      await expect(dialog.getByRole('combobox', { name: 'Journal entry action' })).toHaveCount(0);
      const note = `Extra writing in ${scenario.momentId}`;
      await dialog.getByRole('textbox', { name: 'Entry content' }).fill(note);
      await dialog.locator('input[type="date"]').fill(calendarDate(-1));
      await dialog.getByRole('button', { name: 'Save entry' }).click();
      await expect(dialog).toHaveCount(0);
      const after = await read(page);
      for (const other of before.filter((item) => item.id !== scenario.momentId)) {
        expect(after.find((item) => item.id === other.id)).toMatchObject(other);
      }
      const owner = after.find((item) => item.id === scenario.momentId);
      expect(owner.activities).toHaveLength(1);
      expect(owner.activities[0].id).toBe(scenario.activityId);
      expect(owner.activities[0].title).toBe(activity.title);
      expect(owner.activities[0].entries.at(-1).description).toContain(note);
      expect(owner.activities[0].entries.at(-1).date).toBe(calendarDate(-1));
      expect(owner.activities[0].entries.length).toBe((activity.entries?.length || 0) + 1);
      if (scenario.momentId === 'daily') expect(owner.activities[0].entries[0]).toEqual(activity.entries[0]);
      if (scenario.momentId === 'journal') expect(owner.activities[0].description).toBe(activity.description);
      expect(errors).toEqual([]);
    });
  }
}

test('A cancelled Journal Activity refuses new entries without changing history', async ({ page }) => {
  const moments = fixture();
  moments[1].activities[0].cancelled = true;
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/journal/activities/same');
  const before = await read(page);
  const dialog = await begin(page);
  await dialog.getByRole('textbox', { name: 'Entry content' }).fill('Should not be saved');
  await dialog.getByRole('button', { name: 'Save entry' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Reopen or restore');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(await read(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test('Saved global Moment-type filter cannot redirect a Detail entry to a different Activity', async ({ page }) => {
  const moments = fixture();
  await page.setViewportSize({ width: 320, height: 694 });
  const errors = await seedGuest(page, { moments, theme: 'dark', incomes: [], expenses: [] });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Activity', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Add an activity' });
  await dialog.getByRole('combobox', { name: 'Moment type' }).click();
  await page.getByRole('option', { name: 'Project', exact: true }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.goto('/events/journal/activities/same');
  dialog = await begin(page);
  await expect(dialog).toContainText('Original memory');
  await expect(dialog.getByRole('combobox', { name: 'Moment type' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect((await read(page)).map((item) => item.id)).toEqual(moments.map((item) => item.id));
  expect(errors).toEqual([]);
});

test('Duplicate submit events save only one content entry', async ({ page }) => {
  const moments = fixture();
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { moments, theme: 'light', incomes: [], expenses: [] });
  await page.goto('/events/journal/activities/same');
  const dialog = await begin(page);
  await dialog.getByRole('textbox', { name: 'Entry content' }).fill('One added paragraph');
  await dialog.evaluate((node) => {
    const form = node.querySelector('form.dn-entry-add-form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(dialog).toHaveCount(0);
  const data = await read(page);
  expect(data.find((m) => m.id === 'journal').activities[0].entries).toHaveLength(1);
  expect(data.find((m) => m.id === 'tasks')).toMatchObject(moments[2]);
  expect(errors).toEqual([]);
});
