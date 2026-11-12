import { test, expect } from '@playwright/test';
import { addOriginal, seedGuest } from './fixtures.js';

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
    // Establish the DN origin before reading localStorage; seedGuest registers an init script.
    await page.goto('/events');
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    for (const variant of variants) {
      await page.goto(`/events/${variant.id}/story`);
      const story = page.locator('.dn-v2-story');
      await expect(story).toHaveAttribute('data-presentation', variant.presentation);
      const paper = story.locator(variant.paper).first();
      await expect(paper).toBeVisible();
      expect(await paper.evaluate((node) => getComputedStyle(node).colorScheme)).toBe(theme);
      const kicker = story.locator('.dn-v2-story-kicker');
      const summary = story.locator('.dn-v2-story-stats span').first();
      const introAction = story.getByRole('region', { name: 'Moment introduction' }).getByRole('button', { name: /introduction/ });
      for (const element of [kicker, summary, introAction]) {
        await expect(element).toBeVisible();
        expect(await element.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)))
          .toBeGreaterThanOrEqual(12);
      }
      expect(await summary.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12.95);
      expect(await introAction.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12.95);
      expect(await summary.evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe('0px');
      const caption = story.locator('.dn-v2-story-header p');
      await expect(caption).toBeVisible();
      expect(await caption.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12.95);
      const continuation = story.locator('.dn-story-writing-heading').first();
      await expect(continuation).toBeVisible();
      expect(await continuation.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12.95);
      const bodyCopy = story.locator(variant.presentation === 'chronicle'
        ? '.dn-task-group .dn-task-row-description'
        : variant.presentation === 'journey'
          ? '.dn-journal-page .dn-v2-story-entry-description'
          : '.dn-diary-monthbook .dn-v2-story-entry-description').first();
      await expect(bodyCopy).toBeVisible();
      expect(await bodyCopy.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
        variant.presentation + ' reading size').toBeGreaterThanOrEqual(variant.presentation === 'chronicle' ? 13 : 16);
      const datedWriting = story.locator(variant.presentation === 'chronicle'
        ? '.dn-task-group .dn-story-writing-text'
        : variant.presentation === 'journey'
          ? '.dn-journal-page .dn-story-writing-text'
          : '.dn-diary-monthbook .dn-story-writing-text').first();
      await expect(datedWriting).toBeVisible();
      expect(await datedWriting.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
        variant.presentation + ' continuation size').toBeGreaterThanOrEqual(variant.presentation === 'chronicle' ? 13 : 16);
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
      const chapterLink = story.locator('[data-story-activity="' + variant.id + '-chapter"]')
        .locator(variant.presentation === 'chronicle' ? '.dn-task-row-heading a' : '.dn-v2-story-entry-body > h4 a');
      await expect(chapterLink).toBeVisible();
      const target = await chapterLink.boundingBox();
      expect(target.height).toBeGreaterThanOrEqual(43.9);
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.x).toBeGreaterThanOrEqual(-1);
      expect(target.x + target.width).toBeLessThanOrEqual(width + 1);
      if (variant.presentation === 'journey') {
        const ornaments = story.locator('.dn-journal-page-date > span');
        await expect(ornaments).toHaveCount(2);
        for (const ornament of await ornaments.all()) {
          await expect(ornament).toHaveAttribute('aria-hidden', 'true');
        }
      }
      if (variant.presentation === 'diary') {
        await chapterLink.click();
        await expect(page).toHaveURL(new RegExp('/events/' + variant.id + '/activities/' + variant.id + '-chapter'));
        await page.goto('/events/' + variant.id + '/story');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    }
    // The same iPhone text hierarchy should apply to shared form guidance.
    await page.goto('/events');
    await page.getByRole('button', { name: 'Open quick create menu' }).click();
    await page.getByRole('button', { name: 'Life moment', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Create a life moment' });
    const guidance = modal.locator('.event-form-intro');
    await expect(guidance).toBeVisible();
    expect(await guidance.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)))
      .toBeGreaterThanOrEqual(12.95);
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
  });
}


// Real Guest-backed originals in portrait and landscape orientations. The
// phone Story frame must preserve the original image proportions and viewer.
for (const { width, height, theme, originalWidth, originalHeight } of [
  { width: 320, height: 740, theme: 'dark', originalWidth: 600, originalHeight: 900 },
  { width: 390, height: 844, theme: 'light', originalWidth: 900, originalHeight: 600 },
]) {
  test(`Journal photo framing and original preview at ${width}px ${theme}`, async ({ page }) => {
    const errors = await seedGuest(page, { theme });
    await addOriginal(page, { width: originalWidth, height: originalHeight, count: 2 });
    await page.setViewportSize({ width, height });
    await page.goto('/events/moment-one/story');
    const source = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    const journal = page.locator('.dn-v2-story[data-presentation="journey"]');
    const album = journal.locator('[data-story-activity="shared"] .dn-journal-gallery');
    await expect(album).toHaveAttribute('data-album-layout', 'pair');
    const button = album.getByRole('button', { name: 'Preview Activity photo 0.png' });
    const photo = button.locator('img');
    // Gallery originals load only when the attachment tile approaches the
    // visible Story viewport; scroll the button before expecting an <img>.
    await button.scrollIntoViewIfNeeded();
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((img) => img.naturalWidth)).toBe(originalWidth);
    const dimensions = await photo.evaluate((img) => {
      const style = getComputedStyle(img);
      const frame = img.closest('button').getBoundingClientRect();
      const picture = img.getBoundingClientRect();
      return {
        fit: style.objectFit,
        naturalHeight: img.naturalHeight,
        width: picture.width,
        frameWidth: frame.width,
        viewport: window.innerWidth,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    expect(dimensions.fit).toBe('contain');
    expect(dimensions.naturalHeight).toBe(originalHeight);
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.frameWidth + 1);
    expect(dimensions.frameWidth).toBeLessThanOrEqual(width);
    expect(dimensions.overflow).toBe(false);
    await button.tap();
    const original = page.getByRole('dialog', { name: 'Activity photo 0.png' });
    await expect(original).toBeVisible();
    await expect(original.getByRole('img', { name: 'Activity photo 0.png' })).toBeVisible();
    await original.getByRole('button', { name: 'Close dialog' }).tap();
    await expect(original).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(source);
    expect(errors).toEqual([]);
  });
}
