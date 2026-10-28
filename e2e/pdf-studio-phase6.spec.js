import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addOriginal, fixtureMoments, seedGuest } from './fixtures.js';

async function openStudio(page) {
  await page.goto('/events');
  const card = page.getByRole('group', { name: /Weekend in Ooty.*Swipe either direction for actions/ });
  await card.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Summary', exact: true }).click();
  const summary = page.getByRole('dialog', { name: 'Moment summary', exact: true });
  await summary.getByRole('button', { name: 'Open PDF Studio' }).click();
  const studio = page.getByRole('dialog', { name: 'PDF Studio' });
  await expect(studio).toBeVisible();
  return studio;
}
const fingerprint = (page) => page.evaluate(async () => {
  const src = document.querySelector('.dn-pdf-preview-page img')?.src;
  if (!src) return '';
  const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
});

test('PDF Studio presents actual pages, requires refresh after customization and produces a valid binary PDF', async ({ page }) => {
  const moments = fixtureMoments();
  const errors = await seedGuest(page, { moments });
  await addOriginal(page, { count: 2 });
  const unchanged = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const studio = await openStudio(page);
  await expect(studio.getByRole('combobox', { name: 'PDF story format' })).toHaveValue('journey');
  const pageImage = studio.getByRole('img', { name: 'Rendered PDF page 1' });
  await expect(pageImage).toBeVisible();
  await expect(studio.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled();
  const journalHash = await fingerprint(page);

  await studio.getByRole('combobox', { name: 'PDF story format' }).selectOption('diary');
  await expect(studio.getByText('Settings changed. Update the preview to download.')).toBeVisible();
  await expect(studio.getByRole('button', { name: 'Download customized PDF' })).toBeDisabled();
  await studio.getByRole('button', { name: 'Update preview' }).click();
  await expect(studio.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled({ timeout: 20000 });
  const diaryHash = await fingerprint(page);
  expect(diaryHash).not.toBe(journalHash);

  await studio.getByRole('combobox', { name: 'PDF story format' }).selectOption('chronicle');
  await expect(studio.getByText('Completed tasks')).toBeVisible();
  await studio.getByLabel('Cancelled tasks').check();
  await studio.getByRole('button', { name: 'Update preview' }).click();
  await expect(studio.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled({ timeout: 20000 });
  const taskHash = await fingerprint(page);
  expect(taskHash).not.toBe(diaryHash);
  expect(taskHash).not.toBe(journalHash);

  const promise = page.waitForEvent('download');
  await studio.getByRole('button', { name: 'Download customized PDF' }).click();
  const file = await readFile(await (await promise).path());
  const pdf = file.toString('latin1');
  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  expect(pdf).toMatch(/\/Subtype \/Image/);
  expect(pdf).toMatch(/startxref\n\d+\n%%EOF/);
  expect(file.length).toBeGreaterThan(2000);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(unchanged);
  expect(errors).toEqual([]);
});

test('PDF Studio stays contained at 320px and page navigation remains keyboard accessible', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.setViewportSize({ width: 320, height: 740 });
  const studio = await openStudio(page);
  await expect(studio.getByRole('img', { name: 'Rendered PDF page 1' })).toBeVisible();
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflowing).toBe(false);
  await expect(studio.getByRole('button', { name: 'Previous PDF page' })).toBeDisabled();
  await expect(studio.getByRole('combobox', { name: 'PDF page spacing' })).toBeVisible();
  await studio.getByRole('combobox', { name: 'PDF page spacing' }).selectOption('compact');
  await expect(studio.getByRole('button', { name: 'Download customized PDF' })).toBeDisabled();
  await studio.getByRole('button', { name: 'Update preview' }).click();
  await expect(studio.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled({ timeout: 20000 });
  expect(errors).toEqual([]);
});


test('Journal keeps dates, photo captions and lead photographs on one PDF page even at page edges', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].notes = '<p>Remember our morning together, &amp; all the little details.</p>';
  const chapter = moments[0].activities.find((item) => item.id === 'shared');
  chapter.date = '2026-03-03';
  chapter.completed = true;
  chapter.description = '<p>A memory with a very long story.</p>'.repeat(55);
  moments[0].activities.unshift({
    id: 'earlier-journal', title: 'Our opening chapter', date: '2026-02-02',
    completed: true, description: ('A long first chapter to fill the printed page. ').repeat(95),
  });
  const errors = await seedGuest(page, { moments });
  await addOriginal(page, { width: 600, height: 900, count: 2 });
  await page.goto('/events');
  const unchanged = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const layout = await page.evaluate(async () => {
    const { renderMomentStudioPdf } = await import('/src/utils/momentPdf.js');
    const event = JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
    const result = await renderMomentStudioPdf(event, {
      template: 'journey', includeCover: true, density: 'balanced',
    });
    return { layout: result.layout, pages: result.pages.length, size: result.blob.size };
  });
  const cover = layout.layout.find((item) => item.kind === 'cover');
  expect(cover?.imagePage).toBe(1);
  const photoChapter = layout.layout.find((item) => item.id === 'shared');
  expect(photoChapter).toBeTruthy();
  expect(photoChapter.leadPhotoPage).toBe(photoChapter.datePage);
  expect(photoChapter.titlePage).toBe(photoChapter.datePage);
  expect(layout.pages).toBeGreaterThan(1);
  expect(layout.size).toBeGreaterThan(2000);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(unchanged);
  expect(errors).toEqual([]);
});
