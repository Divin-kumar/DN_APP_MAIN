import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Guest UI only. Cancelled drafts must not touch stored records.
for (const width of [320, 390, 430]) {
  for (const theme of ['light', 'dark']) {
    test(`Task date/time stays inline at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 820 });
      const errors = await seedGuest(page, { theme });
      await page.goto('/tasks');
      const before = await page.evaluate(() => [
        localStorage.getItem('dn_guest_tasks'), localStorage.getItem('dn_guest_eventGroups'),
      ]);
      await page.getByRole('button', { name: 'Open quick create menu' }).click();
      await page.getByRole('button', { name: 'Task', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'New Task' });
      const row = dialog.locator('.dn-task-date-row');
      const date = row.locator('input[type="date"]');
      const time = row.locator('input[type="time"]');
      await expect(date).toBeVisible();
      await expect(time).toBeVisible();
      const localToday = await page.evaluate(() => {
        const now = new Date();
        return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      });
      await expect(date).toHaveValue(localToday);
      await expect(time).toBeEnabled();
      await expect(dialog.getByText('Choose a due date to set a time.')).toHaveCount(0);
      const title = dialog.getByRole('textbox', { name: 'Task title' });
      const notes = dialog.locator('.dn-form-disclosure textarea');
      await expect(notes).toBeHidden();
      await dialog.getByText('More options', { exact: true }).click();
      await expect(notes).toBeVisible();
      const fields = await dialog.evaluate((element) => ({
        title: element.querySelector('.dn-task-field input').getBoundingClientRect().top,
        date: element.querySelector('.dn-task-date-row').getBoundingClientRect().top,
        notes: element.querySelector('.dn-task-field textarea').getBoundingClientRect().top,
      }));
      expect(fields.title).toBeLessThan(fields.date);
      expect(fields.date).toBeLessThan(fields.notes);
      await date.fill('2026-11-10');
      await expect(time).toBeEnabled();
      await expect(dialog.getByText('Choose a due date to set a time.')).toHaveCount(0);
      await time.fill('11:45');
      const clear = row.getByRole('button', { name: 'Clear task time' });
      await expect(clear).toBeVisible();
      const geometry = await row.evaluate((element) => {
        const d = element.querySelector('input[type="date"]').getBoundingClientRect();
        const t = element.querySelector('input[type="time"]').getBoundingClientRect();
        const c = element.querySelector('.activity-time-clear').getBoundingClientRect();
        const b = element.getBoundingClientRect();
        return { dateTop: d.top, timeTop: t.top, dateRight: d.right, timeLeft: t.left,
          clearLeft: c.left, timeRight: t.right, clearRight: c.right, rowRight: b.right,
          scroll: document.documentElement.scrollWidth };
      });
      expect(Math.abs(geometry.dateTop - geometry.timeTop)).toBeLessThanOrEqual(4);
      expect(geometry.dateRight).toBeLessThanOrEqual(geometry.timeLeft + 1);
      expect(geometry.timeRight).toBeLessThanOrEqual(geometry.clearLeft + 1);
      expect(geometry.clearRight).toBeLessThanOrEqual(geometry.rowRight + 1);
      expect(geometry.scroll).toBeLessThanOrEqual(width + 1);
      await clear.click();
      await expect(time).toHaveValue('');
      await expect(clear).toHaveCount(0);
      await date.fill('');
      await expect(time).toBeDisabled();
      await title.fill('Draft for layout check');
      await notes.fill('Unsaved notes stay private');
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      expect(await page.evaluate(() => [
        localStorage.getItem('dn_guest_tasks'), localStorage.getItem('dn_guest_eventGroups'),
      ])).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
for (const width of [320, 390]) {
  test(`Moment form reports blank-name correction inline at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    const errors = await seedGuest(page, { theme: 'dark' });
    await page.goto('/events');
    const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    await page.goto('/events?create=event');
    const dialog = page.getByRole('dialog', { name: 'New event' });
    const name = dialog.getByRole('textbox', { name: 'Moment name' });
    await name.fill('   ');
    const nativeDialogs = [];
    page.on('dialog', async (item) => { nativeDialogs.push(item.message()); await item.dismiss(); });
    await dialog.getByRole('button', { name: 'Save Event' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Enter a Moment name.');
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await name.fill('Valid title for later');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(nativeDialogs).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
