import { test, expect } from '@playwright/test';
import { calendarDate, seedGuest } from './fixtures.js';

// Activity Detail is a contextual + entry point. Daily and Journal append to
// the opened record; task-style Moments add a sibling, never a child.
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

for (const [width, height, theme] of [[390, 844, 'light'], [430, 932, 'dark']]) {
  for (const scenario of [
    { momentId: 'daily', activityId: 'daily-day', mode: 'diary' },
    { momentId: 'journal', activityId: 'same', mode: 'journey' },
    { momentId: 'tasks', activityId: 'same', mode: 'chronicle' },
  ]) {
    test(`Detail universal + targets ${scenario.momentId} correctly on ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const original = fixture();
      const errors = await seedGuest(page, { theme, moments: original, incomes: [], expenses: [] });
      await page.goto(`/events/${scenario.momentId}/activities/${scenario.activityId}`);
      await expect(page.locator('.activity-detail-heading h1')).toBeVisible();
      const normalizedBefore = await read(page);
      const dock = page.getByRole('navigation', { name: 'Main navigation' });
      await dock.getByRole('button', { name: 'Open quick create menu' }).click();
      await dock.getByRole('group', { name: 'Quick create actions' })
        .getByRole('button', { name: 'Activity', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Add an activity' });
      const moment = original.find((record) => record.id === scenario.momentId);
      await expect(editor.getByRole('combobox', { name: 'Life moment' })).toContainText(moment.name);
      await expect(editor.locator('.dn-quick-activity-context')).toContainText(moment.name);

      if (scenario.mode === 'journey') {
        await expect(editor.locator('#dn-journal-entry-choice')).toContainText('Append to existing entry');
        await expect(editor.locator('#dn-journal-append-target')).toContainText('Original memory');
      } else if (scenario.mode === 'diary') {
        await expect(editor.getByText('This entry will be added to the existing daily Activity.')).toBeVisible();
        await expect(editor.locator('input[type="date"]')).toHaveValue(calendarDate(-2));
      } else {
        await expect(editor.locator('#dn-journal-entry-choice')).toHaveCount(0);
      }

      const title = `Added ${scenario.momentId} from detail`;
      await editor.getByRole('textbox', { name: scenario.mode === 'chronicle' ? 'Activity title' : 'Entry title' }).fill(title);
      await editor.getByRole('button', { name: scenario.mode === 'chronicle' ? 'Save activity' : 'Save entry' }).click();
      await expect(editor).toHaveCount(0);

      const after = await read(page);
      for (const other of normalizedBefore.filter((item) => item.id !== scenario.momentId)) {
        // Other Moments may receive additive legacy normalization on a scoped save.
        // Their existing record identity and all previously stored fields remain.
        expect(after.find((item) => item.id === other.id)).toMatchObject(other);
      }
      const updated = after.find((item) => item.id === scenario.momentId);
      if (scenario.mode === 'chronicle') {
        expect(updated.activities).toHaveLength(2);
        expect(updated.activities[0]).toEqual(normalizedBefore.find((item) =>
          item.id === scenario.momentId).activities[0]);
        expect(updated.activities[1]).toMatchObject({ title, eventId: scenario.momentId });
      } else {
        expect(updated.activities).toHaveLength(1);
        expect(updated.activities[0].id).toBe(scenario.activityId);
        expect(updated.activities[0].entries.at(-1).title).toBe(title);
        if (scenario.mode === 'diary') {
          expect(updated.activities[0].entries[0]).toEqual(moment.activities[0].entries[0]);
        } else {
          expect(updated.activities[0].description).toBe('Before we added more.');
        }
      }
      expect(errors).toEqual([]);
    });
  }
}

test('Cancelled Journal entry does not become an unsafe implicit append destination', async ({ page }) => {
  const moments = fixture();
  moments[1].activities[0].cancelled = true;
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events/journal/activities/same');
  await expect(page.locator('.activity-detail-heading h1')).toBeVisible();
  const normalizedBefore = await read(page);
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Activity', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add an activity' });
  await expect(editor.locator('#dn-journal-entry-choice')).toContainText('New entry · Separate memory');
  await editor.getByRole('button', { name: 'Cancel' }).click();
  expect(await read(page)).toEqual(normalizedBefore);
  expect(errors).toEqual([]);
});

test('Saved Moment-type picker cannot hide Activity Detail parent at 320px', async ({ page }) => {
  const moments = fixture();
  await page.setViewportSize({ width: 320, height: 694 });
  const errors = await seedGuest(page, { moments, theme: 'dark', incomes: [], expenses: [] });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Activity', exact: true }).click();
  let editor = page.getByRole('dialog', { name: 'Add an activity' });
  await editor.getByRole('combobox', { name: 'Moment type' }).click();
  await page.getByRole('option', { name: 'Project', exact: true }).click();
  await editor.getByRole('button', { name: 'Cancel' }).click();

  await page.goto('/events/journal/activities/same');
  await expect(page.locator('.activity-detail-heading h1')).toBeVisible();
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Activity', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Add an activity' });
  await expect(editor.getByRole('combobox', { name: 'Moment type' })).toContainText('All moment types');
  await expect(editor.getByRole('combobox', { name: 'Life moment' })).toContainText('Weekend journal');
  await expect(editor.locator('#dn-journal-append-target')).toContainText('Original memory');
  await editor.getByRole('button', { name: 'Cancel' }).click();
  expect((await read(page)).map((item) => item.id)).toEqual(moments.map((item) => item.id));
  expect(errors).toEqual([]);
});

test('Rapid duplicate Save taps append only one entry to Journal', async ({ page }) => {
  const moments = fixture();
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { moments, theme: 'light', incomes: [], expenses: [] });
  await page.goto('/events/journal/activities/same');
  await expect(page.locator('.activity-detail-heading h1')).toBeVisible();
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Activity', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add an activity' });
  const normalizedBefore = await read(page);
  await editor.getByRole('textbox', { name: 'Entry title' }).fill('One added paragraph');
  await editor.evaluate((node) => {
    const form = node.querySelector('form.quick-create-activity-form');
    // Dispatch twice in one event turn, before React can paint a disabled state.
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(editor).toHaveCount(0);
  const after = await read(page);
  expect(after.find((moment) => moment.id === 'journal').activities[0].entries)
    .toHaveLength(1);
  expect(after.find((moment) => moment.id === 'tasks')).toMatchObject(normalizedBefore.find((moment) => moment.id === 'tasks'));
  expect(errors).toEqual([]);
});
