import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

const moments = () => [
  { id: 'diary', name: 'October Diary', type: 'Diary', date: '2026-10-01',
    activities: [
      { id: 'diary-am', title: 'Morning reflection', date: '2026-10-31', time: '07:30', description: 'Morning notes' },
      { id: 'diary-pm', title: 'Evening reflection', date: '2026-10-31', time: '20:30', description: 'Evening notes' },
    ], attachments: [{ id: 'old-photo', activityId: 'diary-pm', type: 'image/jpeg', name: 'evening.jpg' }] },
  { id: 'journal', name: 'Photo Journal', type: 'Journal', date: '2026-10-31',
    activities: [
      { id: 'journal-a', title: 'Morning photo', date: '2026-10-31', time: '07:30' },
      { id: 'journal-b', title: 'Evening photo', date: '2026-10-31', time: '20:30' },
    ], attachments: [{ id: 'photo-a', activityId: 'journal-a', name: 'morning.jpg', type: 'image/jpeg' }] },
  { id: 'tasks', name: 'Project board', type: 'Project', date: '2026-10-31',
    activities: [
      { id: 'task-a', title: 'Review plans', date: '2026-10-31', time: '09:00' },
      { id: 'task-b', title: 'Email team', date: '2026-10-31', time: '13:00' },
    ], attachments: [] },
];
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));

for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'light'], [430, 932, 'dark']]) {
  test(`Diary merges historical same-day records without changing Journal/Tasks at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { moments: moments(), incomes: [], expenses: [], theme });
    await page.goto('/activities');
    await expect.poll(async () => (await read(page)).find((item) => item.id === 'diary').activities.length)
      .toBe(1);
    const records = await read(page);
    const diary = records.find((item) => item.id === 'diary');
    const journal = records.find((item) => item.id === 'journal');
    const task = records.find((item) => item.id === 'tasks');
    expect(diary.activities[0].id).toBe('diary-am');
    expect(diary.activities[0].entries.map((part) => part.title)).toEqual(['Morning reflection', 'Evening reflection']);
    expect(diary.activities[0].mergedActivityIds).toContain('diary-pm');
    expect(diary.attachments[0].activityId).toBe('diary-am');
    expect(diary.attachments[0].entryId).toBe('diary-pm');
    expect(journal.activities).toHaveLength(2);
    expect(task.activities).toHaveLength(2);

    await page.goto('/events/diary/activities/diary-pm');
    await expect(page).toHaveURL(/\/events\/diary\/activities\/diary-am$/);
    await expect(page.getByRole('region', { name: 'Daily diary entries' })).toContainText('Morning reflection');
    await expect(page.getByRole('region', { name: 'Daily diary entries' })).toContainText('Evening reflection');
    await expect(page.locator('.dn-activity-entry-item')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Diary appends new entries, Journal offers optional link then deliberate append, and Tasks stay independent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { moments: moments(), incomes: [], expenses: [] });
  await page.goto('/events/diary/activities');
  await expect.poll(async () => (await read(page)).find((item) => item.id === 'diary').activities.length).toBe(1);
  await page.goto('/events/diary/activities?create=activity');
  const editor = page.getByRole('dialog', { name: 'Add entry' });
  await expect(editor).toBeVisible();
  await expect(editor.getByText('This entry will be added to the existing daily Activity.')).toBeVisible();
  await editor.getByPlaceholder('Entry title').fill('Late reflection');
  await editor.locator('input[type="date"]').fill('2026-10-31');
  await editor.getByRole('button', { name: 'Add entry' }).click();
  await expect(editor).toHaveCount(0);
  const diary = (await read(page)).find((item) => item.id === 'diary');
  expect(diary.activities).toHaveLength(1);
  expect(diary.activities[0].entries).toHaveLength(3);

  await page.goto('/events/journal/activities');
  await expect(page.getByRole('button', { name: 'Link or append existing' })).toBeVisible();
  let journal = (await read(page)).find((item) => item.id === 'journal');
  expect(journal.activities).toHaveLength(2);
  await page.getByRole('button', { name: 'Link or append existing' }).click();
  const merge = page.getByRole('dialog', { name: 'Organize Journal memories' });
  await merge.locator('#journal-merge-destination').click();
  await page.getByRole('option', { name: /Morning photo/ }).click();
  await merge.locator('#journal-merge-source').click();
  await page.getByRole('option', { name: /Evening photo/ }).click();
  await merge.getByRole('button', { name: 'Link memories' }).click();
  await expect(merge).toHaveCount(0);
  journal = (await read(page)).find((item) => item.id === 'journal');
  expect(journal.activities).toHaveLength(2);
  expect(journal.activities[0].linkedJournalActivityIds).toEqual(['journal-b']);
  await page.goto('/events/journal/activities/journal-a');
  await expect(page.getByRole('region', { name: 'Linked Journal memories' })).toContainText('Evening photo');
  await page.goto('/events/journal/activities');
  await page.getByRole('button', { name: 'Link or append existing' }).click();
  const appendDialog = page.getByRole('dialog', { name: 'Organize Journal memories' });
  await appendDialog.locator('#journal-arrange-action').click();
  await page.getByRole('option', { name: 'Append · combine memories' }).click();
  await appendDialog.locator('#journal-merge-destination').click();
  await page.getByRole('option', { name: /Morning photo/ }).click();
  await appendDialog.locator('#journal-merge-source').click();
  await page.getByRole('option', { name: /Evening photo/ }).click();
  await appendDialog.getByRole('button', { name: 'Append existing memory' }).click();
  await expect(appendDialog).toHaveCount(0);
  journal = (await read(page)).find((item) => item.id === 'journal');
  expect(journal.activities).toHaveLength(1);
  expect(journal.activities[0].mergedActivityIds).toContain('journal-b');
  expect(journal.activities[0].entries[0].title).toBe('Evening photo');
  // Journal's Story presents the preserved memory as dated chapters, not a
  // separate 'Appended entries' subsection or a silently duplicated record.
  await page.goto('/events/journal/overview');
  const journalStory = page.locator('.dn-v2-story');
  await expect(journalStory.locator('[aria-label="Appended entries"]')).toHaveCount(0);
  await expect(journalStory.locator('.dn-journal-chapter')).toHaveCount(2);
  await expect(journalStory).toContainText('Evening photo');

  await page.goto('/events/tasks/activities?create=activity');
  const taskEditor = page.getByRole('dialog', { name: 'Add activity' });
  await expect(taskEditor).toBeVisible();
  await expect(taskEditor.getByText('Every Task is a separate Activity with its own status and priority.')).toBeVisible();
  await expect(taskEditor.locator('#dn-journal-entry-choice')).toHaveCount(0);
  await taskEditor.getByRole('button', { name: 'Cancel' }).click();
  expect((await read(page)).find((item) => item.id === 'tasks').activities).toHaveLength(2);
  expect(errors).toEqual([]);
});
