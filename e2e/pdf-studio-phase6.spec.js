import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addOriginal, calendarDate, fixtureMoments, seedGuest } from './fixtures.js';

async function openStudio(page) {
  await page.goto('/events');
  const card = page.getByRole('group', { name: /Weekend in Ooty.*Swipe either direction for actions/ });
  await card.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'PDF Studio', exact: true }).click();
  const studio = page.locator('.dn-pdf-studio-page');
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
  // Writing may span pages, then one grouped photo spread follows it.
  expect(photoChapter.titlePage).toBe(photoChapter.datePage);
  expect(photoChapter.leadPhotoPage).toBeGreaterThanOrEqual(photoChapter.textEndPage);
  expect(photoChapter.gridPages).toHaveLength(1);
  expect(photoChapter.photoCount).toBe(2);
  expect(layout.pages).toBeGreaterThan(1);
  expect(layout.size).toBeGreaterThan(2000);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(unchanged);
  expect(errors).toEqual([]);
});


test('Journal keeps 1–5 photos together after the writing, with a cover photo first', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].activities.find((item) => item.id === 'shared').completed = true;
  moments[0].activities.find((item) => item.id === 'shared').date = '2026-01-14';
  const errors = await seedGuest(page, { moments });
  await addOriginal(page, { width: 680, height: 940, count: 5 });
  await page.goto('/events');
  const cases = await page.evaluate(async () => {
    const { renderMomentStudioPdf } = await import('/src/utils/momentPdf.js');
    const stored = JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
    return Promise.all([1, 2, 3, 4, 5].map(async (count) => {
      const clone = structuredClone(stored);
      clone.attachments = clone.attachments.filter((item) => item.activityId !== 'shared'
        || Number(item.id.replace('photo-', '')) < count);
      const result = await renderMomentStudioPdf(clone, { template: 'journey', includeCover: true, includeIntro: true });
      const chapter = result.layout.find((entry) => entry.kind === 'journal-entry' && entry.id === 'shared');
      return { count, cover: result.layout.find((entry) => entry.kind === 'cover')?.imagePage,
        pages: result.pages.length, chapter };
    }));
  });
  for (const entry of cases) {
    expect(entry.cover).toBe(1);
    expect(entry.chapter.photoCount).toBe(entry.count);
    expect(entry.chapter.gridPages).toHaveLength(1);
    expect(entry.chapter.gridPages[0]).toBeGreaterThanOrEqual(entry.chapter.textEndPage);
    expect(entry.pages).toBeGreaterThanOrEqual(entry.chapter.gridPages[0]);
  }
  expect(errors).toEqual([]);
});

test('a Code List refresh preserves customized controls and the actual PDF preview', async ({ page }) => {
  const errors = await seedGuest(page);
  const studio = await openStudio(page);
  await expect(studio.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled();
  await studio.getByRole('combobox', { name: 'PDF story format' }).selectOption('diary');
  await studio.getByRole('combobox', { name: 'PDF page spacing' }).selectOption('compact');
  await studio.getByRole('checkbox', { name: /^Cover page/ }).uncheck();
  await studio.getByRole('checkbox', { name: /^Earlier reflections/ }).check();
  await studio.getByRole('button', { name: 'Update preview' }).click();
  await expect(studio.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled();
  const before = await fingerprint(page);
  const image = studio.getByRole('img', { name: 'Rendered PDF page 1' });
  const oldUrl = await image.getAttribute('src');
  await page.evaluate(async () => {
    const app = (await import('/src/store/useAppStore.js')).default;
    const values = app.getState().adminValues;
    app.setState({ adminValues: { ...values, eventTypes: [...values.eventTypes] } });
  });
  await expect(image).not.toHaveAttribute('src', oldUrl);
  await expect(studio.getByRole('button', { name: 'Download customized PDF' })).toBeEnabled();
  await expect(studio.getByRole('combobox', { name: 'PDF story format' })).toHaveValue('diary');
  await expect(studio.getByRole('combobox', { name: 'PDF page spacing' })).toHaveValue('compact');
  await expect(studio.getByRole('checkbox', { name: /^Cover page/ })).not.toBeChecked();
  await expect(studio.getByRole('checkbox', { name: /^Earlier reflections/ })).toBeChecked();
  expect(await fingerprint(page)).toBe(before);

  // Download still embeds the exact JPEG bytes shown by this refreshed preview.
  const previewBytes = await image.evaluate(async (element) =>
    Array.from(new Uint8Array(await (await fetch(element.src)).arrayBuffer())));
  const download = page.waitForEvent('download');
  await studio.getByRole('button', { name: 'Download customized PDF' }).click();
  const pdf = await readFile(await (await download).path());
  expect(pdf.includes(Buffer.from(previewBytes))).toBe(true);
  expect(errors).toEqual([]);
});

test('Journal cover skips an unavailable original and uses the first readable owned photo', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].activities[0].date = calendarDate(-2);
  moments[0].activities[0].completed = true;
  const errors = await seedGuest(page, { moments });
  await addOriginal(page, { count: 2 });
  await page.goto('/events');
  const result = await page.evaluate(async () => {
    const { renderMomentStudioPdf } = await import('/src/utils/momentPdf.js');
    const event = JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
    event.attachments[0].assetId = 'a'.repeat(64);
    const before = JSON.stringify(event);
    const book = await renderMomentStudioPdf(event, { template: 'journey', includeCover: true });
    return { cover: book.layout.find((entry) => entry.kind === 'cover'),
      chapter: book.layout.find((entry) => entry.id === 'shared'), unchanged: before === JSON.stringify(event) };
  });
  expect(result.cover).toMatchObject({ imagePage: 1, attachmentId: 'photo-0' });
  expect(result.chapter.photoCount).toBe(1);
  expect(result.unchanged).toBe(true);
  expect(errors).toEqual([]);
});

test('Journal includes owned photos and files for undated and selected upcoming entries without inventing dates', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].activities[0].date = '';
  moments[0].activities.push({ id: 'future-photo', title: 'Our next visit', date: calendarDate(10), completed: false });
  const errors = await seedGuest(page, { moments });
  await addOriginal(page, { count: 2 });
  await page.goto('/events');
  const cases = await page.evaluate(async () => {
    const { renderMomentStudioPdf } = await import('/src/utils/momentPdf.js');
    const event = JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
    event.attachments.push({ ...event.attachments[1], id: 'future-photo-file', activityId: 'future-photo' },
      { id: 'future-document', name: 'Next visit.pdf', type: 'application/pdf', activityId: 'future-photo' });
    const before = JSON.stringify(event);
    const originalDraw = CanvasRenderingContext2D.prototype.drawImage;
    const originalText = CanvasRenderingContext2D.prototype.fillText;
    const cases = [];
    try {
      for (const options of [
        { template: 'journey', includeUpcoming: true }, { template: 'journey', includeUpcoming: false },
        { template: 'diary', includeUpcoming: true }, { template: 'chronicle' },
      ]) {
        let photoCount = 0;
        const text = [];
        CanvasRenderingContext2D.prototype.drawImage = function (...args) { photoCount += 1; return originalDraw.apply(this, args); };
        CanvasRenderingContext2D.prototype.fillText = function (...args) { text.push(args[0]); return originalText.apply(this, args); };
        const book = await renderMomentStudioPdf(event, { ...options, includeCover: false });
        cases.push({ options, photoCount, text: text.join('\n'), layout: book.layout,
          unchanged: before === JSON.stringify(event) });
      }
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = originalDraw;
      CanvasRenderingContext2D.prototype.fillText = originalText;
    }
    return cases;
  });
  expect(cases.map((entry) => entry.photoCount)).toEqual([4, 3, 0, 0]);
  expect(cases.every((entry) => entry.unchanged)).toBe(true);
  expect(cases[0].layout.find((entry) => entry.id === 'shared')).toMatchObject({ section: 'undated', date: null, datePage: null, photoCount: 2 });
  expect(cases[0].layout.find((entry) => entry.id === 'future-photo')).toMatchObject({ section: 'upcoming', date: calendarDate(10), photoCount: 1 });
  expect(cases[0].text).toContain('Other file: Next visit.pdf');
  expect(cases[1].text).not.toContain('Next visit.pdf');
  expect(cases[1].layout.some((entry) => entry.id === 'future-photo')).toBe(false);
  expect(errors).toEqual([]);
});

test('public Guest Journal keeps the reflections heading with its writing on the actual rendered page', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  await page.goto('/events');
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('dn_dev_fixture_data') || 'null')?.imagesReady), { timeout: 20000 }).toBe(true);
  const pages = await page.evaluate(async () => {
    const { renderMomentStudioPdf } = await import('/src/utils/momentPdf.js');
    const event = JSON.parse(localStorage.getItem('dn_dev_fixture_data')).events[0];
    const draw = CanvasRenderingContext2D.prototype.fillText;
    const canvases = new WeakMap();
    let count = 0;
    const writing = {};
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (!canvases.has(this.canvas)) canvases.set(this.canvas, ++count);
      if (['Earlier reflections', 'Why we keep photos', 'Pictures hold the scene. Our words hold the feeling.'].includes(args[0])) {
        writing[args[0]] = canvases.get(this.canvas);
      }
      return draw.apply(this, args);
    };
    try {
      await renderMomentStudioPdf(event, { template: 'journey', includeReflections: true });
      return writing;
    } finally { CanvasRenderingContext2D.prototype.fillText = draw; }
  });
  expect(pages['Earlier reflections']).toBeGreaterThan(0);
  expect(pages['Why we keep photos']).toBe(pages['Earlier reflections']);
  expect(pages['Pictures hold the scene. Our words hold the feeling.']).toBe(pages['Earlier reflections']);
  expect(errors).toEqual([]);
});
