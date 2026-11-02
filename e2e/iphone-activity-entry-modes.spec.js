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
      { id: 'journal-a', title: 'Morning photo', date: '2026-10-31', time: '07:30', linkedJournalActivityIds: ['journal-b'] },
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
  test(`Existing same-day Diary Activities remain separate and linked originals survive at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const original = moments();
    const errors = await seedGuest(page, { moments: original, incomes: [], expenses: [], theme });
    await page.goto('/activities');
    const records = await read(page);
    const diary = records.find((item) => item.id === 'diary');
    const journal = records.find((item) => item.id === 'journal');
    const tasks = records.find((item) => item.id === 'tasks');
    expect(diary.activities).toHaveLength(2);
    expect(diary.activities.map((item) => item.id)).toEqual(['diary-am', 'diary-pm']);
    expect(diary.attachments[0]).toEqual(original[0].attachments[0]);
    expect(journal.activities).toHaveLength(2);
    expect(journal.activities[0].linkedJournalActivityIds).toEqual(['journal-b']);
    expect(tasks.activities).toHaveLength(2);
    await page.goto('/events/diary/activities/diary-pm');
    await expect(page.locator('.activity-detail-heading h1')).toHaveText('Evening reflection');
    await expect(page.getByRole('region', { name: 'Activity entries' })).toContainText('Evening notes');
    await expect(page.locator('.dn-content-row')).toHaveCount(1);
    expect(await read(page)).toEqual(records);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Diary Journal and Tasks create independent Activities; prior Journal links stay readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { moments: moments(), incomes: [], expenses: [] });
  for (const [kind, title] of [['diary', 'Late reflection'], ['journal', 'Evening continuation'], ['tasks', 'Review cost']]) {
    await page.goto(`/events/${kind}/activities?create=activity`);
    const dialog = page.getByRole('dialog', { name: 'Add activity' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Activity title' }).fill(title);
    await dialog.locator('.dn-form-disclosure > summary').click();
    await dialog.locator('input[type="date"]').fill('2026-10-31');
    await dialog.getByRole('button', { name: 'Add activity' }).click();
    await expect(dialog).toHaveCount(0);
    const owner = (await read(page)).find((item) => item.id === kind);
    expect(owner.activities).toHaveLength(3);
    expect(owner.activities[2].title).toBe(title);
    expect(owner.activities[2].entries).toEqual([]);
    expect(owner.activities.map((item) => item.id)).toEqual(expect.arrayContaining(
      kind === 'diary' ? ['diary-am', 'diary-pm'] : kind === 'journal' ? ['journal-a', 'journal-b'] : ['task-a', 'task-b']));
    await expect(page.getByRole('button', { name: 'Link or append existing' })).toHaveCount(0);
  }
  const journal = (await read(page)).find((item) => item.id === 'journal');
  expect(journal.activities[0].linkedJournalActivityIds).toEqual(['journal-b']);
  await page.goto('/events/journal/activities/journal-a');
  await expect(page.getByRole('region', { name: 'Linked Journal memories' })).toContainText('Evening photo');
  expect(errors).toEqual([]);
});

test('Old merged Diary aliases still navigate to the surviving Activity without rewriting IDs', async ({ page }) => {
  const saved = moments();
  saved[0].activities = [{
    ...saved[0].activities[0], mergedActivityIds: ['diary-old'],
    entries: [{ id: 'diary-old', date: '2026-10-31', time: '19:20', title: 'Earlier evening',
      description: 'Preserved old writing', sourceActivityId: 'diary-old',
      legacyActivityFields: { id: 'diary-old' } }],
  }];
  saved[0].attachments = [{ id: 'old-photo', activityId: 'diary-am', entryId: 'diary-old', type: 'image/jpeg' }];
  const errors = await seedGuest(page, { moments: saved, incomes: [], expenses: [] });
  await page.goto('/events/diary/activities/diary-old');
  await expect(page).toHaveURL(/\/events\/diary\/activities\/diary-am$/);
  await expect(page.getByRole('region', { name: 'Activity entries' })).toContainText('Preserved old writing');
  const data = (await read(page)).find((m) => m.id === 'diary');
  expect(data.activities[0].mergedActivityIds).toEqual(['diary-old']);
  expect(data.attachments[0].entryId).toBe('diary-old');
  expect(errors).toEqual([]);
});
