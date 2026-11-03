import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Phase 3C browser acceptance. Only synthetic Guest records are used.
// A native iPhone Safari review remains a distinct owner sign-off gate.
test('v4 exports independent Guest Tasks, previews without writes and restores with destination-wins on repeat', async ({ page, browser, baseURL }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  const sourceErrors = await seedGuest(page);
  await page.goto('/settings/data-backup');
  const sourceTasks = [
    { id: 'common-task', title: 'Original export title', notes: 'From source', priority: 'medium',
      status: 'in-progress', dueDate: '2026-11-08', dueTime: '09:20', momentId: 'moment-one', activityId: 'shared' },
    { id: 'new-task', title: 'Preserve this checklist', notes: 'Tamil தமிழ்', priority: 'high',
      status: 'completed', completedAt: '2026-11-03T12:00:00.000Z',
      dueDate: '', dueTime: '', momentId: '', activityId: '' },
  ];
  await page.evaluate((tasks) => localStorage.setItem('dn_guest_tasks', JSON.stringify(tasks)), sourceTasks);
  const beforeSource = await page.evaluate(() => [
    localStorage.getItem('dn_guest_tasks'), localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_expenses'),
  ]);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await pending;
  const filePath = await download.path();
  const { readFile } = await import('node:fs/promises');
  const document = JSON.parse(await readFile(filePath, 'utf8'));
  expect(document.backupVersion).toBe(4);
  expect(document.tasks).toHaveLength(2);
  expect(document.tasks.map((task) => task.id)).toEqual(['common-task', 'new-task']);
  expect(document.tasks[0].dueTime).toBe('09:20');
  expect(document.tasks[1].dueTime).toBe('');
  expect(document.activities.some((activity) => activity.id === 'new-task')).toBe(false);
  expect(await page.evaluate(() => [
    localStorage.getItem('dn_guest_tasks'), localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_expenses'),
  ])).toEqual(beforeSource);

  const context = await browser.newContext({ baseURL });
  try {
    const destination = await context.newPage();
    const destinationErrors = await seedGuest(destination, { moments: [], expenses: [], incomes: [] });
    await destination.goto('/settings/data-backup');
    const destinationTasks = [
      { ...sourceTasks[0], title: 'Destination wins', notes: 'Private original' },
      { id: 'existing-only', title: 'Keep unrelated Task', priority: 'low', status: 'in-progress',
        dueDate: '', dueTime: '', momentId: '', activityId: '' },
    ];
    await destination.evaluate((tasks) => localStorage.setItem('dn_guest_tasks', JSON.stringify(tasks)), destinationTasks);
    const initial = await destination.evaluate(() => ({
      tasks: localStorage.getItem('dn_guest_tasks'),
      moments: localStorage.getItem('dn_guest_eventGroups'),
      expenses: localStorage.getItem('dn_guest_expenses'),
    }));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await destination.getByLabel('Choose a DN backup JSON file').setInputFiles(filePath);
      const review = destination.getByRole('dialog', { name: 'Review backup restore' });
      await expect(review).toBeVisible();
      await expect(review).toContainText('2 independent Tasks');
      if (attempt === 0) {
        expect(await destination.evaluate(() => ({
          tasks: localStorage.getItem('dn_guest_tasks'),
          moments: localStorage.getItem('dn_guest_eventGroups'),
          expenses: localStorage.getItem('dn_guest_expenses'),
        }))).toEqual(initial);
      }
      await Promise.all([
        destination.waitForEvent('load'),
        review.getByRole('button', { name: 'Confirm restore' }).click(),
      ]);
      const result = await destination.evaluate(() => ({
        tasks: JSON.parse(localStorage.getItem('dn_guest_tasks')),
        moments: JSON.parse(localStorage.getItem('dn_guest_eventGroups')),
      }));
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks.map((task) => task.id)).toEqual(['common-task', 'existing-only', 'new-task']);
      expect(result.tasks[0].title).toBe('Destination wins');
      expect(result.tasks[0].notes).toBe('Private original');
      expect(result.tasks[2].notes).toBe('Tamil தமிழ்');
      expect(result.tasks[2].dueTime).toBe('');
      expect(result.moments.find((moment) => moment.id === 'moment-one').activities.some((activity) => activity.id === 'shared')).toBe(true);
    }
    expect(destinationErrors).toEqual([]);
  } finally {
    await context.close();
  }
  expect(sourceErrors).toEqual([]);
});
