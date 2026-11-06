import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest, addOriginal } from './fixtures.js';

for (const width of [320, 430]) test(`PDF content selection remembers activities and files at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const errors = await seedGuest(page, { theme: width === 320 ? 'light' : 'dark' });
  await addOriginal(page, { count: 2 });
  await page.goto('/events/moment-one/pdf');
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const launch = page.getByRole('button', { name: /^Content / });
  await expect(launch).toBeEnabled();
  await launch.click();
  const sheet = page.getByRole('dialog', { name: 'PDF content' });
  await expect(sheet.getByRole('button', { name: 'Activity: A cancelled plan' })).toHaveCount(0);
  const activity = sheet.getByRole('button', { name: 'Activity: Book a lakeside stay', exact: true });
  await sheet.getByRole('button', { name: 'Attachments for Book a lakeside stay' }).click();
  const file = sheet.getByRole('button', { name: 'Attachment: Activity photo 0.png', exact: true });
  const thumbnail = file.locator('.dn-pdf-content-thumbnail img');
  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  const thumbnailUrl = await thumbnail.getAttribute('src');
  const marker = file.locator('.dn-pdf-content-tick');
  const markerStyle = await marker.evaluate(node => ({ border: getComputedStyle(node).borderTopWidth, radius: getComputedStyle(node).borderRadius }));
  expect(markerStyle).toEqual({ border: '0px', radius: '0px' });
  expect((await file.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await sheet.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await sheet.screenshot({ path: test.info().outputPath('pdf-content-sheet.png') });
  await file.click();
  await activity.click();
  await expect(file).toBeDisabled();
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => page.evaluate(url => window.__dnUrls.revoked.includes(url), thumbnailUrl)).toBe(true);
  await launch.click();
  await expect(activity).toHaveAttribute('aria-pressed', 'true');
  await activity.click();
  await sheet.getByRole('button', { name: 'Apply selection' }).click();
  await expect(launch).toContainText('1 activities · 1 attachments');
  await expect(page.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled();
  await page.reload();
  await expect(launch).toContainText('1 activities · 1 attachments');
  await launch.click();
  await expect(activity).toHaveAttribute('aria-pressed', 'false');
  await sheet.getByRole('button', { name: 'Select all / Reset' }).click();
  await sheet.getByRole('button', { name: 'Attachments for Book a lakeside stay' }).click();
  await file.click();
  await sheet.getByRole('button', { name: 'Apply selection' }).click();
  await expect(launch).toContainText('2 activities · 2 attachments');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  expect(errors).toEqual([]);
});

for (const template of ['journey', 'diary', 'chronicle']) test(`${template} PDF omits selected activity writing and attachment references`, async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].activities[0].description = 'EXCLUDED_WRITING_SENTINEL';
  moments[0].attachments = [{ id: 'hidden-file', name: 'EXCLUDED_FILE_SENTINEL.pdf', type: 'application/pdf' },
    { id: 'linked-file', name: 'EXCLUDED_LINKED_SENTINEL.pdf', type: 'application/pdf', activityId: 'shared' },
    { id: 'keep-file', name: 'KEEP_FILE.pdf', type: 'application/pdf' }];
  await seedGuest(page, { moments });
  await page.goto('/events');
  const output = await page.evaluate(async template => {
    const { renderMomentStudioPdf } = await import('/src/utils/momentPdf.js');
    const event = JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
    const result = await renderMomentStudioPdf(event, { template, searchableText: true,
      contentSelection: { excludedActivities: ['shared'], excludedAttachments: ['hidden-file'] } });
    return result.pages.flatMap(p => p.textRuns.map(run => run.text)).join(' ');
  }, template);
  expect(output).not.toContain('EXCLUDED_');
  expect(output).toContain('Choose the train');
  // Existing Diary/Tasks formats are writing-only; Journal renders file references.
  if (template === 'journey') expect(output).toContain('KEEP_FILE');
});

test('PDF content keeps unavailable photos selectable with a quiet fallback', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].attachments = [{ id: 'missing', name: 'Unavailable photo.jpg', type: 'image/jpeg' }];
  const errors = await seedGuest(page, { moments });
  await page.goto('/events/moment-one/pdf');
  await page.getByRole('button', { name: /^Content / }).click();
  const sheet = page.getByRole('dialog', { name: 'PDF content' });
  const file = sheet.getByRole('button', { name: 'Attachment: Unavailable photo.jpg', exact: true });
  await expect(file.locator('.dn-pdf-content-thumbnail svg')).toBeVisible();
  await file.click();
  await expect(file).toHaveAttribute('aria-pressed', 'false');
  await sheet.getByRole('button', { name: 'Apply selection' }).click();
  await expect(page.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled();
  expect(errors).toEqual([]);
});
