import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

const load = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
const moments = () => [
  { id: 'diary', name: 'Daily diary', type: 'Diary', date: '2026-10-31',
    activities: [
      { id: 'morning', title: 'Morning thoughts', date: '2026-10-31', time: '08:00', description: 'A fresh start' },
      { id: 'evening', title: 'Evening thoughts', date: '2026-10-31', time: '21:00', description: 'Quiet finish' },
    ], attachments: [] },
  { id: 'journal', name: 'Travel journal', type: 'Journal', date: '2026-10-31',
    activities: [{ id: 'chapter', title: 'Day one', date: '2026-10-31', priority: 'medium',
      description: 'The story begins', entries: [
        { id: 'continuation', title: 'New details', date: '2026-10-31', time: '13:15',
          priority: 'medium', description: 'More memories' },
      ] }], attachments: [] },
];

for (const [width, theme] of [[390, 'light'], [320, 'dark']]) {
  test(`Diary status and legacy Journal entry edits preserve original Activity ownership at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = await seedGuest(page, { moments: moments(), incomes: [], expenses: [], theme });
    await page.goto('/events/diary/activities/morning');
    const menu = page.getByRole('button', { name: 'Activity options' });
    await menu.click();
    await page.getByRole('menuitem', { name: 'Complete', exact: true }).click();
    await expect(page.locator('.activity-status-pill')).toContainText('Completed');
    await menu.click();
    await page.getByRole('menuitem', { name: 'Reopen', exact: true }).click();
    await expect(page.locator('.activity-status-pill')).toContainText('In progress');
    await expect(page.locator('.dn-content-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Edit original activity writing' }).click();
    const activityEditor = page.getByRole('dialog', { name: 'Edit activity' });
    await expect(activityEditor.getByRole('textbox', { name: 'Activity title' })).toHaveValue('Morning thoughts');
    await activityEditor.getByRole('textbox', { name: 'Description (optional)' }).fill('A revised fresh start');
    await activityEditor.getByRole('button', { name: 'Save activity' }).click();
    await expect(activityEditor).toHaveCount(0);
    const diary = (await load(page)).find((item) => item.id === 'diary');
    expect(diary.activities).toHaveLength(2);
    expect(diary.activities[0].id).toBe('morning');
    expect(diary.activities[0].description).toContain('A revised fresh start');
    expect(diary.activities[1].description).toBe('Quiet finish');

    await page.goto('/events/journal/activities/chapter');
    await expect(page.locator('.dn-content-row')).toHaveCount(2);
    const entry = page.locator('.dn-content-row').nth(1);
    await expect(entry).toContainText('New details');
    await entry.getByRole('button', { name: 'Edit entry' }).click();
    const editor = page.getByRole('dialog', { name: 'Edit entry' });
    await expect(editor.getByRole('textbox', { name: 'Entry content' })).toBeVisible();
    await expect(editor.locator('input[type="date"]')).toBeEnabled();
    await editor.getByRole('textbox', { name: 'Entry content' }).fill('Updated memory from tomorrow');
    await editor.locator('input[type="date"]').fill('2026-11-01');
    await editor.getByRole('button', { name: 'Save entry' }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.dn-content-row-date')).toContainText('1 Nov 2026');
    const journal = (await load(page)).find((item) => item.id === 'journal');
    expect(journal.activities).toHaveLength(1);
    expect(journal.activities[0].title).toBe('Day one');
    expect(journal.activities[0].description).toBe('The story begins');
    expect(journal.activities[0].entries[0].id).toBe('continuation');
    expect(journal.activities[0].entries[0].title).toBe('New details');
    expect(journal.activities[0].entries[0].date).toBe('2026-11-01');
    expect(journal.activities[0].entries[0].description).toContain('Updated memory from tomorrow');
    expect(errors).toEqual([]);
  });
}
