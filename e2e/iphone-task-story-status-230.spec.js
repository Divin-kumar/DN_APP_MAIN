import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic iPhone Chromium with coarse-pointer gestures, not physical Safari.
test.use({ hasTouch: true, isMobile: true });
const moment = () => ({
  id: 'iphone-task-story', name: 'My Task Story', type: 'Tasks',
  date: '2026-11-02', notes: 'A focused review of my tasks.',
  attachments: [], memories: [],
  activities: [{
    id: 'task-chapter', title: 'Finish the photo selection',
    date: '2026-11-03', time: '09:30', completed: false,
    status: 'in-progress', description: 'Choose the best original pictures.',
    entries: [{ id: 'follow-up', date: '2026-11-04', time: '10:15',
      description: 'Review the remaining photos.' }],
  }],
});
for (const [width, height, theme] of [
  [320, 640, 'dark'], [390, 844, 'light'], [430, 932, 'dark'], [844, 390, 'light'],
]) {
  test(`Task Story status remains iPhone-friendly at ${width}x${height} ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { moments: [moment()], incomes: [], expenses: [], theme });
    await page.goto('/events/iphone-task-story/overview');
    const story = page.locator('.dn-v2-story[data-presentation="chronicle"]');
    await expect(story).toBeVisible();
    const status = story.getByRole('combobox', { name: 'Change status for Finish the photo selection' });
    await expect(status).toHaveValue('in-progress');
    const row = story.locator('[data-story-activity="task-chapter"]');
    await row.scrollIntoViewIfNeeded();
    const measurements = await row.evaluate((node) => {
      const select = node.querySelector('.dn-task-status-control');
      const date = node.querySelector('.dn-task-row-when');
      const notes = node.querySelector('.dn-task-row-description');
      const continuation = node.querySelector('.dn-story-writing-text');
      const time = node.querySelector('.dn-story-writing-heading');
      const box = select.getBoundingClientRect();
      const styleSize = (el) => el ? parseFloat(getComputedStyle(el).fontSize) : null;
      return {
        height: box.height, width: box.width, left: box.left, right: box.right,
        selectFont: styleSize(select), dateFont: styleSize(date),
        notesFont: styleSize(notes), continuationFont: styleSize(continuation),
        timeFont: styleSize(time),
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(measurements.height).toBeGreaterThanOrEqual(43.9);
    expect(measurements.width).toBeGreaterThanOrEqual(44);
    expect(measurements.selectFont).toBeGreaterThanOrEqual(13);
    expect(measurements.dateFont).toBeGreaterThanOrEqual(12);
    expect(measurements.notesFont).toBeGreaterThanOrEqual(13);
    expect(measurements.continuationFont).toBeGreaterThanOrEqual(13);
    expect(measurements.timeFont).toBeGreaterThanOrEqual(13);
    expect(measurements.left).toBeGreaterThanOrEqual(-1);
    expect(measurements.right).toBeLessThanOrEqual(width + 1);
    expect(measurements.documentWidth).toBeLessThanOrEqual(width + 1);

    // The native status picker must keep its existing save and regroup flow.
    await testInfo.attach(`task-story-${width}-${theme}`, {
      body: await page.screenshot(), contentType: 'image/png',
    });
    await status.selectOption('completed');
    await expect(story.locator('[data-task-status="completed"] [data-story-activity="task-chapter"]')).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
    const task = saved.find((item) => item.id === 'iphone-task-story')?.activities.find((item) => item.id === 'task-chapter');
    expect(task.status).toBe('completed');
    expect(task.completed).toBe(true);
    expect(task.description).toBe('Choose the best original pictures.');
    expect(task.entries).toHaveLength(1);
    expect(task.entries[0].description).toBe('Review the remaining photos.');
    expect(errors).toEqual([]);
  });
}
