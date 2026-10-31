import { test, expect } from '@playwright/test';
import { calendarDate, seedGuest } from './fixtures.js';

// CHG-233: detail-origin + must inherit the actual parent, not a stale
// list-picker filter or the first Moment with a matching Activity ID.
const fixture = [
  { id: 'journal', name: 'Our photo Journal', type: 'Journal', date: calendarDate(-2),
    activities: [{ id: 'shared', title: 'First journal page', date: calendarDate(-1), completed: true }],
    memories: [], attachments: [] },
  { id: 'diary', name: 'October Diary', type: 'Diary', date: calendarDate(-2),
    activities: [{ id: 'day', title: 'Morning words', date: calendarDate(-1), completed: true }],
    memories: [], attachments: [] },
  { id: 'tasks', name: 'Household Tasks', type: 'Project', date: calendarDate(-2),
    activities: [{ id: 'shared', title: 'Existing checklist item', date: calendarDate(-1), completed: false }],
    memories: [], attachments: [] },
];

const cases = [
  { id: 'journal', activity: 'shared', kind: 'journal entry', dialog: 'Add a journal entry', route: 'story' },
  { id: 'diary', activity: 'day', kind: 'diary entry', dialog: 'Add a diary entry', route: 'story' },
  { id: 'tasks', activity: 'shared', kind: 'activity', dialog: 'Add an activity', route: 'activities' },
];

for (const scenario of cases) {
  for (const theme of ['light', 'dark']) {
    test(`Detail + appends ${scenario.kind} to ${scenario.id} (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const errors = await seedGuest(page, { moments: fixture, theme });
      await page.goto(`/events/${scenario.id}/activities/${scenario.activity}`);
      await expect(page.locator('.activity-detail-heading h1')).toBeVisible();
      const plus = page.getByRole('navigation', { name: 'Main navigation' })
        .getByRole('button', { name: 'Open quick create menu' });
      await plus.click();
      await page.getByRole('group', { name: 'Quick create actions' })
        .getByRole('button', { name: 'Activity', exact: true }).click();

      const dialog = page.getByRole('dialog', { name: scenario.dialog });
      await expect(dialog).toBeVisible();
      const parent = fixture.find((moment) => moment.id === scenario.id);
      await expect(dialog.getByRole('combobox', { name: 'Life moment' })).toContainText(parent.name);
      await expect(dialog.locator('.dn-quick-activity-context')).toContainText(parent.name);
      const title = `Appended ${scenario.kind} from Detail`;
      await dialog.getByRole('textbox', { name: scenario.kind === 'activity' ? 'Activity title' : 'Entry title' }).fill(title);
      await dialog.getByRole('button', { name: `Save ${scenario.kind}` }).click();
      await expect(dialog).toHaveCount(0);

      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
      const parentAfter = saved.find((moment) => moment.id === scenario.id);
      expect(parentAfter.activities).toHaveLength(parent.activities.length + 1);
      expect(parentAfter.activities.at(-1)).toMatchObject({ eventId: scenario.id, title, completed: false });
      expect(parentAfter.activities[0]).toEqual(parent.activities[0]);
      for (const other of fixture.filter((moment) => moment.id !== scenario.id)) {
        expect(saved.find((moment) => moment.id === other.id)).toEqual(other);
      }
      await page.getByRole('button', { name: 'View', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/events/${scenario.id}/${scenario.route}$`));
      expect(errors).toEqual([]);
    });
  }
}

test('Detail context overrides an incompatible saved type picker, without losing the parent', async ({ page }) => {
  const errors = await seedGuest(page, { moments: fixture, theme: 'light' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Activity', exact: true }).click();
  const initial = page.getByRole('dialog', { name: 'Add an activity' });
  await initial.getByRole('combobox', { name: 'Moment type' }).click();
  await page.getByRole('option', { name: 'Project', exact: true }).click();
  await initial.getByRole('button', { name: 'Cancel' }).click();

  await page.goto('/events/diary/activities/day');
  await expect(page.locator('.activity-detail-heading h1')).toContainText('Morning words');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('group', { name: 'Quick create actions' })
    .getByRole('button', { name: 'Activity', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a diary entry' });
  await expect(dialog.getByRole('combobox', { name: 'Moment type' })).toContainText('All moment types');
  await expect(dialog.getByRole('combobox', { name: 'Life moment' })).toContainText('October Diary');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(errors).toEqual([]);
});
