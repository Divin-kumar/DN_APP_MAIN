import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic mobile Chromium only; real Safari, PWA and VoiceOver remain manual checks.
test.use({ hasTouch: true, isMobile: true });

const makeMoment = (id, type) => ({
  id, name: 'A quiet Story chapter', type, date: '2026-10-14',
  notes: 'The introduction stays part of the same Story.',
  attachments: type === 'Diary' ? [{
    id: id + '-file', name: 'Keepsake note.txt', type: 'text/plain',
    activityId: id + '-chapter', size: 24,
  }] : [],
  memories: [],
  activities: [{
    id: id + '-chapter', title: 'A day worth remembering',
    date: '2026-10-14', time: '09:30', status: 'in-progress',
    description: '<p>We saved the important little details.</p>',
    entries: [{ id: id + '-continuation', date: '2026-10-15',
      time: '10:15', description: '<p>Another paragraph in the same Activity.</p>' }],
  }],
});

for (const { width, theme } of [
  { width: 320, theme: 'dark' },
  { width: 390, theme: 'light' },
  { width: 430, theme: 'dark' },
]) {
  test(`Story reading metadata and paper chrome at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const variants = [
      { id: 'polish-journal', type: 'Vacation', presentation: 'journey', paper: '.dn-journal-page' },
      { id: 'polish-diary', type: 'Diary', presentation: 'diary', paper: '.dn-diary-monthbook' },
      { id: 'polish-tasks', type: 'Tasks', presentation: 'chronicle', paper: '.dn-task-group' },
    ];
    const errors = await seedGuest(page, {
      moments: variants.map(({ id, type }) => makeMoment(id, type)), theme,
      incomes: [], expenses: [],
    });
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    for (const variant of variants) {
      await page.goto(`/events/${variant.id}/story`);
      const story = page.locator('.dn-v2-story');
      await expect(story).toHaveAttribute('data-presentation', variant.presentation);
      const paper = story.locator(variant.paper).first();
      await expect(paper).toBeVisible();
      expect(await paper.evaluate((node) => getComputedStyle(node).colorScheme)).toBe(theme);
      const caption = story.locator('.dn-v2-story-header p');
      await expect(caption).toBeVisible();
      expect(await caption.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12.95);
      const continuation = story.locator('.dn-story-writing-heading').first();
      await expect(continuation).toBeVisible();
      expect(await continuation.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12.95);
      const recordedTime = story.locator('.dn-story-entry-aside').first();
      if (variant.presentation !== 'chronicle') {
        await expect(recordedTime).toBeVisible();
        expect(await recordedTime.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12.95);
      }
      if (variant.presentation === 'diary') {
        const fileLink = story.locator('.dn-story-entry-files').first();
        await expect(fileLink).toBeVisible();
        const rect = await fileLink.boundingBox();
        expect(rect.height).toBeGreaterThanOrEqual(43.9);
        expect(rect.x).toBeGreaterThanOrEqual(-1);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
      }
      if (variant.presentation === 'chronicle') {
        const status = story.getByRole('combobox', { name: 'Change status for A day worth remembering' });
        await expect(status).toHaveValue('in-progress');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    }
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
  });
}
