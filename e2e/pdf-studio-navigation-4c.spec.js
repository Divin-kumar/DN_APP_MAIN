import { test, expect } from '@playwright/test';
import { addOriginal, calendarDate, fixtureMoments, seedGuest } from './fixtures.js';

const fixture = () => {
  const moments = fixtureMoments();
  moments[0].activities = ['Alpha memory', 'Beta memory', 'Gamma memory'].map((title, index) => ({
    id: 'chapter-' + index,
    eventId: 'moment-one',
    title,
    date: calendarDate(-8 + index),
    completed: false,
    description: 'One short real memory written with its own date and description.',
    entries: [{ id: 'note-' + index, date: calendarDate(-8 + index),
      time: '10:00', description: 'Continuation belongs to the same Activity.' }],
  }));
  return moments;
};

test('optional Activity page boundaries apply to Journal, Diary and Tasks without rewriting records', async ({ page }) => {
  const moments = fixture();
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events');
  const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const results = await page.evaluate(async () => {
    const { renderMomentStudioPdf } = await import('/src/utils/momentPdf.js');
    const record = JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    const report = [];
    try {
      for (const template of ['journey', 'diary', 'chronicle']) {
        for (const pageBreakBetweenActivities of [false, true]) {
          const canvasPages = new WeakMap();
          let created = 0;
          const position = {};
          const continuations = [];
          let currentTitle = '';
          CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
            if (!canvasPages.has(this.canvas)) canvasPages.set(this.canvas, ++created);
            const string = String(value);
            for (const title of ['Alpha memory', 'Beta memory', 'Gamma memory']) {
              if (string.startsWith(title)) {
                position[title] = canvasPages.get(this.canvas);
                currentTitle = title;
              }
            }
            if (string.startsWith('Continuation belongs')) {
              continuations.push({ activity: currentTitle, page: canvasPages.get(this.canvas) });
            }
            return fillText.call(this, value, ...args);
          };
          const pdf = await renderMomentStudioPdf(record, {
            template, includeCover: false, includeIntro: false,
            includeUpcoming: false, includeReflections: false,
            pageBreakBetweenActivities,
          });
          report.push({ template, pageBreakBetweenActivities, physicalPages: pdf.pages.length,
            positions: position, continuations, renderedBytes: pdf.blob.size });
        }
      }
    } finally {
      CanvasRenderingContext2D.prototype.fillText = fillText;
    }
    return report;
  });
  for (const template of ['journey', 'diary', 'chronicle']) {
    const normal = results.find((x) => x.template === template && !x.pageBreakBetweenActivities);
    const separate = results.find((x) => x.template === template && x.pageBreakBetweenActivities);
    const positions = ['Alpha memory', 'Beta memory', 'Gamma memory'].map((title) => separate.positions[title]);
    expect(positions.every(Number.isInteger)).toBe(true);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect(separate.physicalPages).toBeGreaterThanOrEqual(3);
    expect(separate.continuations).toHaveLength(3);
    for (const part of separate.continuations) {
      expect(part.page).toBe(separate.positions[part.activity]);
    }
    expect(separate.physicalPages).toBeGreaterThanOrEqual(normal.physicalPages);
    expect(separate.renderedBytes).toBeGreaterThan(2000);
    expect(normal.renderedBytes).toBeGreaterThan(2000);
  }
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
  expect(errors).toEqual([]);
});

for (const [width, height, theme] of [[320, 740, 'dark'], [390, 844, 'light']]) {
  test(`long-book PDF jump and thumbnails remain accessible at ${width}px ${theme}`, async ({ page }) => {
    const moments = fixture();
    const errors = await seedGuest(page, { moments, incomes: [], expenses: [], theme });
    await page.setViewportSize({ width, height });
    await page.goto('/events/moment-one/pdf');
    const studio = page.locator('.dn-pdf-studio-page');
    const download = studio.getByRole('button', { name: 'Download customized PDF' });
    await expect(download).toBeEnabled({ timeout: 30000 });
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    const activityLayout = studio.getByRole('radiogroup', { name: 'Activity page layout' });
    const newPage = activityLayout.getByRole('radio', { name: 'Start each Activity on a new PDF page' });
    const natural = activityLayout.getByRole('radio', { name: 'Continue Activities on the same PDF page' });
    await expect(natural).toHaveAttribute('aria-checked', 'true');
    await expect(natural).toHaveAttribute('tabindex', '0');
    await natural.focus();
    const sameDay = activityLayout.getByRole('radio', { name: 'Start each recorded day on a new PDF page' });
    await natural.press('ArrowRight');
    await expect(sameDay).toBeFocused();
    await expect(sameDay).toHaveAttribute('aria-checked', 'true');
    await sameDay.press('ArrowRight');
    await expect(newPage).toBeFocused();
    await expect(newPage).toHaveAttribute('aria-checked', 'true');
    await newPage.press('Home');
    await expect(natural).toBeFocused();
    await expect(natural).toHaveAttribute('aria-checked', 'true');
    await natural.press('End');
    await expect(newPage).toBeFocused();
    await expect(newPage).toHaveAttribute('aria-checked', 'true');
    await expect(download).toBeDisabled();
    await studio.getByRole('button', { name: 'Update preview' }).click();
    await expect(download).toBeEnabled({ timeout: 30000 });
    const count = Number((await studio.locator('.dn-pdf-page-count').innerText()).match(/\d+/)?.[0]);
    expect(count).toBeGreaterThanOrEqual(3);

    const jump = studio.getByRole('spinbutton', { name: 'Jump to PDF page' });
    await jump.fill(String(count));
    await studio.getByRole('button', { name: 'Go to PDF page' }).click();
    await expect(studio.getByRole('img', { name: 'Rendered PDF page ' + count })).toBeVisible();
    await expect(jump).toHaveValue(String(count));
    await studio.getByRole('button', { name: 'Toggle PDF page thumbnails' }).click();
    const thumbnails = studio.getByRole('navigation', { name: 'PDF page thumbnails' });
    await expect(thumbnails.getByRole('button', { name: 'Go to PDF page ' + count })).toHaveAttribute('aria-current', 'page');
    await studio.getByRole('button', { name: 'Go to first PDF page' }).click();
    await expect(jump).toHaveValue('1');
    await studio.getByRole('button', { name: 'Go to last PDF page' }).click();
    await expect(jump).toHaveValue(String(count));
    await expect(thumbnails.getByRole('button', { name: 'Go to PDF page ' + count })).toHaveAttribute('aria-current', 'page');

    await studio.getByRole('button', { name: 'Open full-screen PDF preview' }).click();
    const dialog = studio.getByRole('dialog', { name: 'Full-screen PDF preview' });
    await expect(dialog).toBeVisible();
    const fullJump = dialog.getByRole('spinbutton', { name: 'Jump to fullscreen PDF page' });
    await fullJump.fill('1');
    await dialog.getByRole('button', { name: 'Go to fullscreen PDF page' }).click();
    await expect(dialog.getByRole('img', { name: 'Fullscreen PDF page 1' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close full-screen PDF preview' }).click();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
  });
}


test('real original photo remains on its PDF page at 40% writable space and moves at 39%', async ({ page }) => {
  const errors = await seedGuest(page, { incomes: [], expenses: [] });
  await addOriginal(page, { width: 680, height: 940, count: 1 });
  const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const results = await page.evaluate(async () => {
    const { MomentPdfPainter } = await import('/src/utils/momentPdf.js');
    const moment = JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
    const attachment = moment.attachments.find((file) => file.id === 'photo-0');
    const top = 43;
    const bottom = 842 - 51;
    const writableHeight = bottom - top;
    const result = [];
    for (const freeFraction of [.4, .39]) {
      const painter = new MomentPdfPainter(() => {}, { template: 'journey', pageQuality: 'standard' });
      painter.y = bottom - writableHeight * freeFraction;
      const positions = await painter.photoGrid([attachment], {
        uid: null, isGuest: true, sample: false, assertCurrent: () => {},
      });
      const placed = positions.find((entry) => entry.id === attachment.id);
      const rendered = await painter.renderedPages();
      result.push({ freeFraction, page: placed?.page, width: placed?.width,
        height: placed?.height, pageCount: rendered.pages.length });
    }
    return result;
  });
  expect(results[0].page).toBe(1);
  expect(results[0].pageCount).toBe(1);
  expect(results[1].page).toBe(2);
  expect(results[1].pageCount).toBe(2);
  for (const result of results) {
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.width / result.height).toBeCloseTo(680 / 940, 2);
  }
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
  expect(errors).toEqual([]);
});

test('new-date chapters keep separate same-day Activities together without merging stored records', async ({ page }) => {
  const moments = fixture();
  moments[0].activities[1].date = moments[0].activities[0].date;
  moments[0].activities[1].entries[0].date = moments[0].activities[0].date;
  const errors = await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events');
  const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const results = await page.evaluate(async () => {
    const { renderMomentStudioPdf } = await import('/src/utils/momentPdf.js');
    const saved = JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
    const originalDraw = CanvasRenderingContext2D.prototype.fillText;
    const cases = [];
    try {
      for (const template of ['journey', 'diary']) {
        for (const layout of ['day', 'activity']) {
          const pageMap = new WeakMap();
          const positions = {};
          const continued = [];
          let allocated = 0;
          let activity = '';
          CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
            if (!pageMap.has(this.canvas)) pageMap.set(this.canvas, ++allocated);
            const text = String(value);
            for (const title of ['Alpha memory', 'Beta memory', 'Gamma memory']) {
              if (text.startsWith(title)) { positions[title] = pageMap.get(this.canvas); activity = title; }
            }
            if (text.startsWith('Continuation belongs')) {
              continued.push({ activity, page: pageMap.get(this.canvas) });
            }
            return originalDraw.call(this, value, ...args);
          };
          const output = await renderMomentStudioPdf(saved, {
            template, includeCover: false, includeIntro: false, includeUpcoming: false,
            pageBreakBetweenDays: layout === 'day',
            pageBreakBetweenActivities: layout === 'activity',
          });
          cases.push({ template, layout, positions, continued, pages: output.pages.length });
        }
      }
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalDraw;
    }
    return cases;
  });
  for (const template of ['journey', 'diary']) {
    const grouped = results.find((r) => r.template === template && r.layout === 'day');
    const separated = results.find((r) => r.template === template && r.layout === 'activity');
    expect(grouped.positions['Alpha memory']).toBe(grouped.positions['Beta memory']);
    expect(grouped.positions['Gamma memory']).toBeGreaterThan(grouped.positions['Beta memory']);
    expect(separated.positions['Beta memory']).toBeGreaterThan(separated.positions['Alpha memory']);
    expect(grouped.pages).toBeLessThan(separated.pages);
    expect(grouped.continued).toHaveLength(3);
    for (const part of grouped.continued) {
      expect(part.page).toBe(grouped.positions[part.activity]);
    }
  }
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
  expect(errors).toEqual([]);
});
